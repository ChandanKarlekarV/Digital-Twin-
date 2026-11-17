/**
 * Pipeline leak detection by compensated mass balance: the computational pipeline
 * monitoring (CPM) method of API RP 1130, applied to the riser segment between the subsea
 * manifold meter (in) and the topside export meter (out).
 *
 *   residual   r = m_in - m_out - dM/dt
 *   line pack  M = rho_g(P_avg, T_avg) * V_risers           (real-gas density, Papay Z)
 *   noise      sigma = sqrt((u m_in)^2 + (u m_out)^2 + (0.3 dM/dt)^2),  u = 0.5 % per meter
 *   decision   one-sided CUSUM  S = max(0, S + r / sigma - kappa)
 *              WATCH when S > H/2, ALARM when S > H
 *   location   the riser whose measured base pressure falls furthest below the
 *              network model's prediction for today's published rate
 *
 * Only measured (filtered) meter records go in; the detector never sees the simulation's
 * truth, so it works the same on real plant data.
 */
import { useSyncExternalStore } from 'react';
import type { TelemetryRecord } from '../types/telemetry';
import { gasDensity, GAS_RHO_STD, RISER_VOLUME_M3, solveNetwork } from '../physics/KgD6FlowModel';
import { productionAt, SCF_PER_SCM } from '../data/kgd6Production';
import { aiIngestionPipeline } from './AiIngestionPipeline';

const IN = 'MANIFOLD-D6-MAIN';
const OUT = 'TOPSIDE-MPFM-01';
const RISERS = ['RISER-ALPHA', 'RISER-BRAVO'];

/** Meter uncertainty, 1 sigma, per meter (AGA-9 ultrasonic gas meters are ~0.7 % at 95 %) */
const METER_U = 0.005;
/** Relative uncertainty of the line-pack rate term */
const PACK_U = 0.3;
/** CUSUM allowance (sigma) and decision limit: a 1-sigma standing offset never accumulates */
const KAPPA = 1.0;
const H = 12;
/** Evaluate once per second of process time */
const UPDATE_S = 1.0;
/** Window for the reported leak size */
const SIZE_WINDOW = 10;

export type LeakState = 'normal' | 'watch' | 'alarm';

export interface LeakStatus {
  state: LeakState;
  /** Mean compensated imbalance over the last SIZE_WINDOW updates, kg/s (positive = mass missing) */
  imbalanceKgS: number;
  /** ...as a share of the inflow */
  imbalancePct: number;
  /** Same loss expressed as gas, MMSCMD */
  lossMmscmd: number;
  /** Line-pack rate of change, kg/s (positive = risers filling) */
  linePackRateKgS: number;
  sigmaKgS: number;
  cusum: number;
  limit: number;
  /** Suspected location when not normal */
  location: string | null;
  /** Process time the current state began, s */
  since: number;
}

const kgPerS = (r: TelemetryRecord) => ((r.associated_gas_mmscfd ?? 0) / SCF_PER_SCM) * 1e6 * GAS_RHO_STD / 86400 + r.gross_mass_rate;

const INITIAL: LeakStatus = {
  state: 'normal',
  imbalanceKgS: 0,
  imbalancePct: 0,
  lossMmscmd: 0,
  linePackRateKgS: 0,
  sigmaKgS: 0,
  cusum: 0,
  limit: H,
  location: null,
  since: 0,
};

class LeakDetectorService {
  private status: LeakStatus = INITIAL;
  private listeners = new Set<() => void>();
  private lastUpdate = -Infinity;
  private lastPack: { t: number; m: number } | null = null;
  private recent: number[] = [];
  private cusum = 0;
  private sumIn = 0;
  private sumOut = 0;
  private samples = 0;

  /** Feed the latest stored meter records (called at the store rate; evaluates at 1 Hz) */
  public update(records: Record<string, TelemetryRecord>, processTime: number): void {
    const rin = records[IN];
    const rout = records[OUT];
    if (!rin || !rout) return;
    // Integrate mass in and out over the window, so flows and line pack cover the same interval
    this.sumIn += kgPerS(rin);
    this.sumOut += kgPerS(rout);
    this.samples++;
    if (processTime - this.lastUpdate < UPDATE_S) return;
    this.lastUpdate = processTime;

    const mIn = this.sumIn / this.samples;
    const mOut = this.sumOut / this.samples;
    this.sumIn = this.sumOut = this.samples = 0;
    // Line pack in the risers from the average of the two meters' pressure and temperature
    const pack = gasDensity((rin.p_line_bar + rout.p_line_bar) / 2, (rin.t_line_c + rout.t_line_c) / 2) * RISER_VOLUME_M3;
    const prevPack = this.lastPack;
    this.lastPack = { t: processTime, m: pack };
    if (!prevPack) return; // need two line-pack samples before the balance means anything
    const dPack = (pack - prevPack.m) / (processTime - prevPack.t);

    const r = mIn - mOut - dPack;
    // The line-pack estimate is itself uncertain (fixed volume, averaged P and T): its share of the
    // noise grows with its size, so fast pressure transients widen the band instead of alarming
    const sigma = Math.hypot(METER_U * mIn, METER_U * mOut, PACK_U * dPack);
    this.cusum = Math.max(0, this.cusum + r / sigma - KAPPA);
    this.recent.push(r);
    if (this.recent.length > SIZE_WINDOW) this.recent.shift();
    const mean = this.recent.reduce((a, b) => a + b, 0) / this.recent.length;

    const state: LeakState = this.cusum > H ? 'alarm' : this.cusum > H / 2 ? 'watch' : 'normal';
    const prev = this.status;
    const location = state === 'normal' ? null : this.locate(records);
    const gasShare = mIn > 0 ? mean / mIn : 0;

    this.status = {
      state,
      imbalanceKgS: mean,
      imbalancePct: gasShare * 100,
      lossMmscmd: gasShare * productionAt().gasMmscmd,
      linePackRateKgS: dPack,
      sigmaKgS: sigma,
      cusum: this.cusum,
      limit: H,
      location,
      since: state === prev.state ? prev.since : processTime,
    };
    if (state === 'alarm' && prev.state !== 'alarm') this.raiseAlarm(rin.timestamp);
    this.listeners.forEach((l) => l());
  }

  /** Riser with the largest pressure shortfall against the model, or the riser segment in general */
  private locate(records: Record<string, TelemetryRecord>): string {
    const model = solveNetwork(productionAt());
    let worst: string | null = null;
    let worstDrop = 0.5; // bar: below this the pressure evidence is too weak to point at one riser
    for (const id of RISERS) {
      const r = records[id];
      if (!r) continue;
      const drop = model[id].pBar - r.p_line_bar;
      if (drop > worstDrop) {
        worstDrop = drop;
        worst = id;
      }
    }
    return worst ? `${worst === 'RISER-ALPHA' ? 'Riser Alpha' : 'Riser Bravo'} (pressure ${worstDrop.toFixed(1)} bar below model)` : 'Between the subsea manifold and the topside meter';
  }

  private raiseAlarm(timestamp: number): void {
    const s = this.status;
    aiIngestionPipeline.logAnomaly({
      timestamp,
      precise_time: new Date(timestamp).toISOString(),
      asset_id: IN,
      severity: 'CRITICAL_ESD',
      category: 'LEAK_DETECTED',
      detected_value: `Mass imbalance ${s.imbalanceKgS.toFixed(1)} kg/s (${s.imbalancePct.toFixed(1)}%)`,
      nominal_baseline: `Imbalance within ${s.sigmaKgS.toFixed(1)} kg/s meter uncertainty`,
      ai_inference_summary: `Compensated mass balance (API RP 1130) shows mass missing between the subsea manifold and the topside meter. Suspected location: ${s.location}.`,
      recommended_action: 'Confirm with the subsea leak sensors or an ROV survey; prepare to close the riser isolation valve.',
      is_automated_logged: true,
    });
    import('../voice/VarunaVoiceSynthesizer').then(({ varunaVoice }) =>
      varunaVoice.speakCustom(`Leak alarm. About ${s.imbalancePct.toFixed(0)} percent of the flow is missing between the manifold and the platform. Suspected location: ${s.location}.`)
    );
  }

  public getStatus = (): LeakStatus => this.status;

  public subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Clear the test after the leak is isolated (or for a new run) */
  public reset(): void {
    this.cusum = 0;
    this.recent = [];
    this.lastPack = null;
    this.lastUpdate = -Infinity;
    this.sumIn = this.sumOut = this.samples = 0;
    this.status = INITIAL;
    this.listeners.forEach((l) => l());
  }
}

export const leakDetector = new LeakDetectorService();

/** React hook: live leak-detection status */
export const useLeakStatus = () => useSyncExternalStore(leakDetector.subscribe, leakDetector.getStatus);
