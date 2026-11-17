import { telemetryDb } from '../db/TelemetryDatabase';
import { useTelemetryStore } from '../store/useTelemetryStore';
import { useRigStore } from '../store/useRigStore';
import { KalmanFilter1D } from './KalmanFilter';
import { meterRecord, drillRecord, tubeFrequency, DRILL_ASSET } from './MeterComputer';
import { leakDetector } from '../services/LeakDetector';
import type { TelemetryRecord } from '../types/telemetry';
import { aiIngestionPipeline } from '../services/AiIngestionPipeline';
import { midnightSettlementEngine } from '../services/MidnightSettlementEngine';
import { productionAt } from '../data/kgd6Production';
import {
  solveNetwork,
  slugging,
  drillState,
  WATER_CUT_PCT,
  DRILL,
  STICK_SLIP_HZ,
  gasDensity,
  GAS_RHO_STD,
  RISER_VOLUME_M3,
  Disturbance,
} from './KgD6FlowModel';

/** Physics integration rate (fixed step) */
export const PHYSICS_HZ = 200;
/** Records written to the database (meter computer output rate) */
export const STORE_HZ = 50;
/** Live values pushed to the UI */
const UI_HZ = 25;
const DT = 1 / PHYSICS_HZ;
const STORE_EVERY = PHYSICS_HZ / STORE_HZ;
const UI_EVERY = PHYSICS_HZ / UI_HZ;
/** Incident drills ease in/out with this time constant (s) */
const INCIDENT_TAU = 4;
/** Fluid temperature follows the steady solution with the riser transit time (thermal inertia), s */
const THERMAL_TAU = 60;
/** Auto-advance an incident drill every 6 s */
const INCIDENT_PHASE_S = 6;

const PRODUCTION_ASSETS = ['RISER-ALPHA', 'RISER-BRAVO', 'MANIFOLD-D6-MAIN', 'XT-WELLHEAD-01', 'XT-WELLHEAD-02', 'TOPSIDE-MPFM-01'];

/**
 * Transmitter model: first-order lag (time constant tau) and finite resolution. Readings
 * differ from the true process value only through these two real instrument effects.
 */
class Sensor {
  private v: number;
  constructor(initial: number, private tau: number, private res: number) {
    this.v = initial;
  }
  step(truth: number, dt: number): number {
    this.v += (truth - this.v) * (1 - Math.exp(-dt / this.tau));
    return Math.round(this.v / this.res) * this.res;
  }
}

interface AssetSim {
  p: Sensor;
  t: Sensor;
  mass: Sensor;
  f: Sensor;
  wc: Sensor;
  kP: KalmanFilter1D;
  kT: KalmanFilter1D;
  kF: KalmanFilter1D;
  kMass: KalmanFilter1D;
  kWC: KalmanFilter1D;
  slugPhase: number;
  last?: { p: number; t: number; mass: number; f: number; wc: number; fp: number; ft: number; ff: number; fm: number; fwc: number };
}

/** Smoothed incident disturbance (eases toward the drill's target) */
interface Incident {
  flow: number;
  kRiserA: number;
  kManifold: number;
  dWC: number;
  rupture: number;
  rpm: number;
  liquid: number;
  stickSlip: number;
}
const CALM: Incident = { flow: 1, kRiserA: 1, kManifold: 1, dWC: 0, rupture: 0, rpm: DRILL.rpm, liquid: 1, stickSlip: 0 };

/**
 * Target disturbance for an incident drill phase (1-4). Phases 1-3 escalate; phase 4 is
 * the recovery the incident catalog describes (restriction clearing, riser isolated,
 * drill string freed...). Flow and pressure follow from the network physics.
 */
function incidentTarget(scenario: string, phase: number): Incident {
  const i = { ...CALM };
  const ph = Math.max(1, Math.min(4, phase)) - 1;
  switch (scenario) {
    case 'pipe_blockage': // restriction in riser Alpha
      i.kRiserA = [4, 15, 60, 2][ph];
      break;
    case 'hydrate_plug': // hydrate in the manifold; free water arrives with it
      i.kManifold = [3, 10, 40, 1.5][ph];
      i.dWC = [3.5, 7, 10.5, 2][ph];
      break;
    case 'rupture': // loss of containment in riser Alpha; phase 4 = SSIV closed, riser isolated
      i.rupture = [0.02, 0.06, 0.15, 0][ph];
      i.kRiserA = [1, 1, 1, 1e5][ph];
      break;
    case 'oil_overload': // condensate surge into the topside separator
      i.liquid = [1.25, 1.5, 1.8, 1.1][ph];
      i.dWC = [2, 6, 12, 2][ph];
      break;
    case 'stuck_drill':
    case 'drill_damage':
      i.rpm = [96, 64, 0, 60][ph];
      i.stickSlip = [0.25, 0.5, 0.75, 0.1][ph];
      break;
  }
  return i;
}

const STATUS: Record<string, (ph: number) => number> = {
  pipe_blockage: (ph) => (ph === 3 ? 2 : ph === 4 ? 0 : 1),
  hydrate_plug: (ph) => (ph === 3 ? 2 : ph === 4 ? 0 : 3),
  rupture: () => 0, // no flag from the drill itself: the mass-balance detector must find it
  oil_overload: (ph) => (ph === 3 ? 2 : ph === 4 ? 0 : 1),
  stuck_drill: (ph) => (ph === 3 ? 4 : ph === 4 ? 0 : 1),
  drill_damage: (ph) => (ph === 3 ? 4 : ph === 4 ? 0 : 1),
};const AFFECTS: Record<string, string[]> = {
  pipe_blockage: ['RISER-ALPHA', 'MANIFOLD-D6-MAIN'],
  hydrate_plug: ['MANIFOLD-D6-MAIN', 'XT-WELLHEAD-01'],
  rupture: ['RISER-ALPHA', 'MANIFOLD-D6-MAIN'],
  oil_overload: ['TOPSIDE-MPFM-01'],
  stuck_drill: [DRILL_ASSET],
  drill_damage: [DRILL_ASSET],
};

const fOscFor = tubeFrequency;

/**
 * KG-D6 telemetry at a fixed 200 Hz physics step.
 *
 * Production comes from the published block rate (productionAt), the network physics from
 * KgD6FlowModel, transients from riser slugging and incident drills, and readings from the
 * transmitter model above. A setInterval wakes every 10 ms and runs however many 5 ms steps
 * real time requires (an accumulator), so the physics rate does not depend on timer jitter.
 */
class TelemetryEmitterService {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private step = 0;
  private simTime = 0;
  private lastWall = 0;
  private acc = 0;
  private sims = new Map<string, AssetSim>();
  private incident: Incident = { ...CALM };
  private drillSensors = { torque: new Sensor(DRILL.designTorqueKnm, 0.05, 0.1), rop: new Sensor(DRILL.designRopMh, 2, 0.1) };
  private kTorque = new KalmanFilter1D({ Q: 0.02, R: 0.05, initialState: DRILL.designTorqueKnm, maxResidualThreshold: 25 });
  private kRop = new KalmanFilter1D({ Q: 0.01, R: 0.05, initialState: DRILL.designRopMh, maxResidualThreshold: 15 });
  private phaseClock = 0;
  private lastPack: number | null = null;
  private fluidT = new Map<string, number>();

  constructor() {
    this.initSims();
  }

  private initSims(): void {
    const net = solveNetwork(productionAt());
    for (const id of PRODUCTION_ASSETS) {
      const s = net[id];
      const wc = WATER_CUT_PCT;
      const f0 = fOscFor(wc, s.tC, s.pBar);
      this.sims.set(id, {
        // Pressure transmitter 0.1 s / 0.01 bar; RTD in thermowell 4 s / 0.01 °C;
        // Coriolis mass 0.2 s / 0.01 kg/s and tube frequency 0.1 s / 0.001 Hz
        p: new Sensor(s.pBar, 0.1, 0.01),
        t: new Sensor(s.tC, 4, 0.01),
        mass: new Sensor(s.liquidKgS, 0.2, 0.01),
        f: new Sensor(f0, 0.1, 0.001),
        wc: new Sensor(wc, 1, 0.01),
        kP: new KalmanFilter1D({ Q: 0.01, R: 0.05, initialState: s.pBar, maxResidualThreshold: 45 }),
        kT: new KalmanFilter1D({ Q: 0.002, R: 0.02, initialState: s.tC, maxResidualThreshold: 15 }),
        kF: new KalmanFilter1D({ Q: 0.005, R: 0.02, initialState: f0, maxResidualThreshold: 20 }),
        kMass: new KalmanFilter1D({ Q: 0.02, R: 0.05, initialState: s.liquidKgS, maxResidualThreshold: 30 }),
        kWC: new KalmanFilter1D({ Q: 0.005, R: 0.02, initialState: wc, maxResidualThreshold: 10 }),
        slugPhase: 0,
      });
    }
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    telemetryDb.seedSixMonthHistory().catch(console.error);
    aiIngestionPipeline.start();
    midnightSettlementEngine.start();
    this.lastWall = performance.now();
    this.timerId = setInterval(() => this.pump(), 10);
  }

  public stop(): void {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = null;
    aiIngestionPipeline.stop();
    midnightSettlementEngine.stop();
    this.isRunning = false;
  }

  /** Physics integration rate */
  public getSamplingRateHz(): number {
    return PHYSICS_HZ;
  }

  public getStorageRateHz(): number {
    return STORE_HZ;
  }

  /**
   * Runs the fixed steps owed since the last wake-up. Background tabs only wake about once a
   * second, so up to 2 s is caught up (~400 steps, ~12 ms); longer stalls skip ahead.
   */
  private pump(): void {
    const now = performance.now();
    this.acc = Math.min(this.acc + (now - this.lastWall) / 1000, 2);
    this.lastWall = now;
    while (this.acc >= DT) {
      this.acc -= DT;
      this.advance(DT);
    }
  }

  /** One physics step. Public for tests. */
  public advance(dt: number = DT): void {
    this.step++;
    this.simTime += dt;
    const store = useRigStore.getState();
    const { emergencyScenario: scenario, incidentPhase: phase } = store;

    // Incident drill clock
    if (store.isAutoSimulatingPhases && scenario !== 'none') {
      this.phaseClock += dt;
      if (this.phaseClock >= INCIDENT_PHASE_S) {
        this.phaseClock = 0;
        if (phase < 4) store.nextIncidentPhase();
        else store.setEmergencyScenario('none', 1);
      }
    } else {
      this.phaseClock = 0;
    }

    // Ease the disturbance toward the drill's target
    const target = scenario === 'none' ? CALM : incidentTarget(scenario, phase);
    const a = 1 - Math.exp(-dt / INCIDENT_TAU);
    (Object.keys(CALM) as (keyof Incident)[]).forEach((k) => (this.incident[k] += (target[k] - this.incident[k]) * a));

    const d: Disturbance = {
      flowFactor: this.incident.flow,
      leakFraction: this.incident.rupture,
      liquidFactor: this.incident.liquid,
      kFactor: { 'RISER-ALPHA': this.incident.kRiserA, 'MANIFOLD-D6-MAIN': this.incident.kManifold },
    };
    const block = productionAt();
    const net = solveNetwork(block, d);
    // Thermal inertia: the fluid in each line takes about a transit time to reach a new temperature
    const aT = 1 - Math.exp(-dt / THERMAL_TAU);
    for (const node of Object.values(net)) {
      const prevT = this.fluidT.get(node.id) ?? node.tC;
      node.tC = prevT + (node.tC - prevT) * aT;
      this.fluidT.set(node.id, node.tC);
    }
    // Mass conservation in the risers: gas stored by rising pressure (line pack) is held back,
    // gas released by falling pressure adds to the export flow
    const man = net['MANIFOLD-D6-MAIN'];
    const top = net['TOPSIDE-MPFM-01'];
    const pack = gasDensity((man.pBar + top.pBar) / 2, (man.tC + top.tC) / 2) * RISER_VOLUME_M3;
    const dPack = this.lastPack === null ? 0 : (pack - this.lastPack) / dt;
    this.lastPack = pack;
    const gasKgS = (top.gasMmscmd * 1e6 * GAS_RHO_STD) / 86400;
    top.gasMmscmd = (Math.max(0, gasKgS - dPack) * 86400) / (1e6 * GAS_RHO_STD);
    const store_ = this.step % STORE_EVERY === 0;
    const ui = this.step % UI_EVERY === 0;
    const activeAsset = store.selectedAssetId || 'RISER-ALPHA';
    const statusFor = (id: string) => (scenario !== 'none' && AFFECTS[scenario]?.includes(id) ? STATUS[scenario]?.(phase) ?? 0 : 0);

    const stored: Record<string, TelemetryRecord> = {};
    for (const id of PRODUCTION_ASSETS) {
      const sim = this.sims.get(id)!;
      const s = net[id];
      // Slugging: deterministic pressure wave at the Gregory-Scott frequency
      const slug = slugging(s);
      sim.slugPhase = (sim.slugPhase + 2 * Math.PI * slug.freqHz * dt) % (2 * Math.PI);
      let pTrue = s.pBar + slug.ampBar * Math.sin(sim.slugPhase);
      if (id === 'RISER-ALPHA' && this.incident.rupture > 0.001) pTrue = Math.max(12, pTrue * (1 - 0.3 * this.incident.rupture));
      const wcTrue = WATER_CUT_PCT + this.incident.dWC;

      const p = sim.p.step(pTrue, dt);
      const t = sim.t.step(s.tC, dt);
      const mass = sim.mass.step(s.liquidKgS * (1 + this.incident.dWC / 100), dt);
      const wc = sim.wc.step(wcTrue, dt);
      const f = sim.f.step(fOscFor(wcTrue, s.tC, pTrue), dt);
      sim.last = {
        p, t, mass, f, wc,
        fp: sim.kP.update(p).filtered,
        ft: sim.kT.update(t).filtered,
        ff: sim.kF.update(f).filtered,
        fm: sim.kMass.update(mass).filtered,
        fwc: sim.kWC.update(wc).filtered,
      };

      if (store_ || (ui && id === activeAsset)) {
        const L = sim.last;
        const raw = meterRecord(id, s, { p: L.p, t: L.t, f: L.f, mass: L.mass, wc: L.wc }, statusFor(id));
        const filtered = meterRecord(id, s, { p: L.fp, t: L.ft, f: L.ff, mass: L.fm, wc: L.fwc }, statusFor(id));
        if (store_) {
          telemetryDb.insert(filtered);
          stored[id] = filtered;
        }
        if (ui && id === activeAsset) useTelemetryStore.getState().updateTelemetry(raw, filtered);
      }
    }

    // Pipeline leak detection runs on the measured (filtered) meter records only
    if (store_) leakDetector.update(stored, this.simTime);

    // Drilling: torque, ROP and standpipe pressure from the drill-string model
    const rpm = this.incident.rpm;
    const dState = drillState(rpm, DRILL.wobKn);
    const stuck = this.incident.stickSlip;
    // Stick-slip: torsional oscillation at the string's first mode, growing with the drill phase
    const torqueTrue = dState.torqueKnm * (1 + 0.25 * stuck * Math.sin(2 * Math.PI * STICK_SLIP_HZ * this.simTime));
    const torque = this.drillSensors.torque.step(torqueTrue, dt);
    const rop = this.drillSensors.rop.step(dState.ropMh, dt);
    const fTorque = this.kTorque.update(torque).filtered;
    const fRop = this.kRop.update(rop).filtered;
    if (store_ || (ui && activeAsset === DRILL_ASSET)) {
      const mk = (tq: number, rp: number) => drillRecord(rpm, tq, rp, statusFor(DRILL_ASSET));
      const filtered = mk(fTorque, fRop);
      if (store_) telemetryDb.insert(filtered);
      if (ui && activeAsset === DRILL_ASSET) useTelemetryStore.getState().updateTelemetry(mk(torque, rop), filtered);
    }
  }
}

export const telemetryEmitter = new TelemetryEmitterService();
