/**
 * Metocean current engine.
 *
 * Primary source: live Open-Meteo marine data at the KG-D6 block (surface current speed and
 * direction, wave height and period), refreshed every 10 minutes. The current shown in the
 * twin eases toward those real values. Only when the feed is unreachable (offline, blocked)
 * does it fall back to a four-phase tidal cycle, one minute per phase. Picking a phase by
 * hand overrides the live feed until the next refresh.
 */

import { useRigStore, CurrentFlowPower, MetoceanCondition, TidePhase } from '../store/useRigStore';
import { KgD6WeatherService } from '../services/KgD6WeatherService';
import { MJ_FIELD } from '../data/kgd6Production';

export interface DynamicTidePhaseDefinition {
  index: number;
  id: TidePhase;
  power: CurrentFlowPower;
  metocean: MetoceanCondition;
  label: string;
  speedKnots: number;
  directionDeg: number;
  swellHeightM: number;
  wavePeriodSec: number;
  waterCutAdjustmentPct: number;
  description: string;
}

export const TIDE_PHASES_SCHEDULE: DynamicTidePhaseDefinition[] = [
  { index: 0, id: 'flood', power: 'moderate', metocean: 'calm', label: 'FLOOD PHASE (Rising Tide)', speedKnots: 1.2, directionDeg: 45, swellHeightM: 1.4, wavePeriodSec: 7.2, waterCutAdjustmentPct: 0, description: 'Flood tide setting northeast along the shelf.' },
  { index: 1, id: 'slack', power: 'slow', metocean: 'calm', label: 'HIGH SLACK (Peak Stand)', speedKnots: 0.3, directionDeg: 75, swellHeightM: 0.8, wavePeriodSec: 9.0, waterCutAdjustmentPct: -1.2, description: 'High-water turnaround. Minimal drag on the risers.' },
  { index: 2, id: 'ebb', power: 'fast', metocean: 'monsoon', label: 'EBB PHASE (Monsoon Outflow)', speedKnots: 2.0, directionDeg: 225, swellHeightM: 2.8, wavePeriodSec: 6.4, waterCutAdjustmentPct: 1.5, description: 'Ebb tide plus monsoon outflow setting southwest.' },
  { index: 3, id: 'spring_surge', power: 'storm', metocean: 'cyclonic', label: 'CYCLONIC STORM SURGE', speedKnots: 3.5, directionDeg: 205, swellHeightM: 6.5, wavePeriodSec: 9.5, waterCutAdjustmentPct: 4.8, description: 'Bay of Bengal cyclone surge. Extreme swell and column shear.' },
];

/** Seawater density (kg/m³), gravity, model water depth to the wellheads/reservoir (m) */
const RHO_SEA = 1025;
const G = 9.81;
const DEPTH_M = MJ_FIELD.waterDepthM;
const P_ATM_BAR = 1.01325;
const KNOT_MS = 0.514444;

const LIVE_REFRESH_MS = 10 * 60 * 1000;

interface LiveSea {
  speedKt: number;
  dirDeg: number;
  waveM: number;
  periodS: number;
  at: number;
}

/** Closest tidal regime for a measured surface current speed */
const phaseForSpeed = (kt: number, waveM: number) => (waveM >= 4 || kt >= 3 ? 3 : kt < 0.5 ? 1 : kt < 1.5 ? 0 : 2);

export function compassLabel(deg: number): string {
  const norm = ((deg % 360) + 360) % 360;
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${names[Math.round(norm / 45) % 8]} (${Math.round(norm).toString().padStart(3, '0')}°)`;
}

class DynamicTideEngine {
  private timerId: number | null = null;
  private animTimerId: number | null = null;
  private liveTimerId: number | null = null;
  private secondsInCurrentPhase = 0;
  private readonly PHASE_DURATION_SECONDS = 60;

  private live: LiveSea | null = null;
  private manualUntil = 0;
  private targetSpeedKnots = TIDE_PHASES_SCHEDULE[0].speedKnots;
  private targetDirectionDeg = TIDE_PHASES_SCHEDULE[0].directionDeg;
  private speed = this.targetSpeedKnots;
  private direction = this.targetDirectionDeg;

  public start(): void {
    if (this.timerId !== null) return;
    this.secondsInCurrentPhase = 0;
    useRigStore.setState({ dynamicTideSecondsRemaining: this.PHASE_DURATION_SECONDS });
    this.timerId = window.setInterval(() => this.tick(), 1000);
    this.animTimerId = window.setInterval(() => this.smoothStep(), 50);
    this.syncLive();
    this.liveTimerId = window.setInterval(() => this.syncLive(), LIVE_REFRESH_MS);
  }

  public stop(): void {
    for (const id of [this.timerId, this.animTimerId, this.liveTimerId]) if (id !== null) clearInterval(id);
    this.timerId = this.animTimerId = this.liveTimerId = null;
  }

  /** True while the current comes from the real Open-Meteo feed */
  public get isLive(): boolean {
    return !!this.live && Date.now() > this.manualUntil;
  }

  private async syncLive(): Promise<void> {
    try {
      const r = await KgD6WeatherService.getLiveWeather(true);
      if (!r.isLiveFetched) return;
      this.live = { speedKt: r.oceanCurrentSpeedKt, dirDeg: r.oceanCurrentDirectionDeg, waveM: r.significantWaveHeightM, periodS: r.peakWavePeriodSec, at: Date.now() };
      if (this.isLive) this.applyLive();
    } catch {
      // keep the tidal fallback
    }
  }

  private applyLive(): void {
    const l = this.live!;
    this.targetSpeedKnots = l.speedKt;
    this.targetDirectionDeg = l.dirDeg;
    const phase = TIDE_PHASES_SCHEDULE[phaseForSpeed(l.speedKt, l.waveM)];
    useRigStore.setState({ tidePhaseIndex: phase.index, tidePhase: phase.id, currentFlowPower: phase.power, metoceanCondition: phase.metocean });
  }

  /** Eases the displayed current toward its target (time constant ~1.2 s) */
  private smoothStep(): void {
    const store = useRigStore.getState();
    if (!store.isDynamicTideCycling) {
      // Manual mode: follow the sliders so re-enabling auto eases from where the user left it
      this.speed = store.currentSpeedKnots;
      this.direction = store.currentDirectionDeg;
      return;
    }
    const ds = this.targetSpeedKnots - this.speed;
    const da = ((this.targetDirectionDeg - this.direction + 540) % 360) - 180;
    if (Math.abs(ds) < 0.01 && Math.abs(da) < 0.1) return;
    this.speed += ds * 0.04;
    this.direction = (this.direction + da * 0.04 + 360) % 360;
    useRigStore.setState({
      currentSpeedKnots: Number(this.speed.toFixed(2)),
      currentDirectionDeg: Math.round(this.direction),
      currentDirectionLabel: compassLabel(this.direction),
    });
  }

  public tick(): void {
    const store = useRigStore.getState();
    if (!store.isDynamicTideCycling) return;
    if (this.isLive) {
      if (this.manualUntil && Date.now() > this.manualUntil) this.manualUntil = 0;
      if (this.targetSpeedKnots !== this.live!.speedKt || this.targetDirectionDeg !== this.live!.dirDeg) this.applyLive();
      return;
    }
    this.secondsInCurrentPhase++;
    useRigStore.setState({ dynamicTideSecondsRemaining: Math.max(0, this.PHASE_DURATION_SECONDS - this.secondsInCurrentPhase) });
    if (this.secondsInCurrentPhase >= this.PHASE_DURATION_SECONDS) {
      this.applyPhase((store.tidePhaseIndex + 1) % TIDE_PHASES_SCHEDULE.length, false);
    }
  }

  /** Sets a tidal phase. Chosen by hand it overrides the live feed until the next refresh. */
  public applyPhase(phaseIndex: number, manual = true): void {
    const phase = TIDE_PHASES_SCHEDULE[phaseIndex] || TIDE_PHASES_SCHEDULE[0];
    if (manual && this.live) this.manualUntil = Date.now() + LIVE_REFRESH_MS;
    if (manual) useRigStore.setState({ isDynamicTideCycling: true });
    this.secondsInCurrentPhase = 0;
    this.targetSpeedKnots = phase.speedKnots;
    this.targetDirectionDeg = phase.directionDeg;
    useRigStore.setState({
      tidePhaseIndex: phaseIndex,
      tidePhase: phase.id,
      currentFlowPower: phase.power,
      metoceanCondition: phase.metocean,
      dynamicTideSecondsRemaining: this.PHASE_DURATION_SECONDS,
    });
  }

  /** Spoken report for "Varuna, water status" */
  public getWaterStatusSpeech(): string {
    const store = useRigStore.getState();
    const kt = store.currentSpeedKnots;
    // Absolute pressure at depth: P = Patm + ρgh. The current's dynamic head ½ρv² is shown separately: it is tiny.
    const seabedBar = P_ATM_BAR + (RHO_SEA * G * DEPTH_M) / 1e5;
    const dynamicMbar = (0.5 * RHO_SEA * (kt * KNOT_MS) ** 2) / 100;
    const live = this.isLive && this.live;
    const sea = live
      ? `Significant wave height is ${live.waveM.toFixed(1)} metres with a ${live.periodS.toFixed(0)} second period, from the live Open-Meteo marine feed.`
      : `The live marine feed is unavailable, so the twin is running the ${TIDE_PHASES_SCHEDULE[store.tidePhaseIndex]?.label.toLowerCase() ?? 'tidal'} model.`;
    return `Surface current is ${kt.toFixed(1)} knots setting ${store.currentDirectionLabel}. ${sea} Hydrostatic pressure at ${DEPTH_M.toLocaleString('en-US')} metres is ${seabedBar.toFixed(1)} bar; the current adds only ${dynamicMbar.toFixed(1)} millibar of dynamic head.`;
  }
}

export const dynamicTideEngine = new DynamicTideEngine();
