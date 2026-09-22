/**
 * Dynamic 10-Second Metocean Tide & Current Phase Engine
 * Automatically transitions through 4 realistic physical oceanographic phases
 * every 10 seconds:
 *   Phase 0: FLOOD (Rising Inflow) -> 2.6 kt, NE (045°), 1.4m Swell
 *   Phase 1: HIGH SLACK (High Water) -> 0.8 kt, ENE (075°), 0.8m Swell
 *   Phase 2: EBB (Falling Outflow) -> 4.6 kt, SW (225°), 2.8m Swell
 *   Phase 3: STORM SURGE (Bay of Bengal Surge) -> 8.8 kt, SSW (205°), 6.5m Swell
 */

import { useRigStore, CurrentFlowPower, MetoceanCondition, TidePhase } from '../store/useRigStore';

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
  {
    index: 0,
    id: 'flood',
    power: 'moderate',
    metocean: 'calm',
    label: 'FLOOD PHASE (Rising Tide)',
    speedKnots: 2.6,
    directionDeg: 45,
    swellHeightM: 1.4,
    wavePeriodSec: 7.2,
    waterCutAdjustmentPct: 0.0,
    description: 'Lunar tidal flood driving deepwater current Northeast at 2.6 knots.',
  },
  {
    index: 1,
    id: 'slack',
    power: 'slow',
    metocean: 'calm',
    label: 'HIGH SLACK (Peak Stand)',
    speedKnots: 0.8,
    directionDeg: 75,
    swellHeightM: 0.8,
    wavePeriodSec: 9.0,
    waterCutAdjustmentPct: -1.2,
    description: 'High water turnaround. Minimal hydrodynamic lateral drag on risers.',
  },
  {
    index: 2,
    id: 'ebb',
    power: 'fast',
    metocean: 'monsoon',
    label: 'EBB PHASE (Monsoon Outflow)',
    speedKnots: 4.6,
    directionDeg: 225,
    swellHeightM: 2.8,
    wavePeriodSec: 6.4,
    waterCutAdjustmentPct: +1.5,
    description: 'Strong tidal ebb surging Southwest towards Godavari deep canyon at 4.6 knots.',
  },
  {
    index: 3,
    id: 'spring_surge',
    power: 'storm',
    metocean: 'cyclonic',
    label: 'CYCLONIC STORM SURGE',
    speedKnots: 8.8,
    directionDeg: 205,
    swellHeightM: 6.5,
    wavePeriodSec: 5.2,
    waterCutAdjustmentPct: +4.8,
    description: 'Bay of Bengal tropical storm surge. Extreme surface swell and maximum column shear.',
  },
];

class DynamicTideEngine {
  private timerId: number | null = null;
  private animTimerId: number | null = null;
  private secondsInCurrentPhase = 0;
  private readonly PHASE_DURATION_SECONDS = 60; // 1 minute per tidal cycle phase

  // Interpolation targets for smooth transition
  private targetSpeedKnots = 2.6;
  private targetDirectionDeg = 45;
  private currentLerpedSpeed = 2.6;
  private currentLerpedDirection = 45;

  public start(): void {
    if (this.timerId !== null) return;

    this.secondsInCurrentPhase = 0;
    useRigStore.setState({
      dynamicTideSecondsRemaining: this.PHASE_DURATION_SECONDS,
    });

    this.timerId = window.setInterval(() => {
      this.tick();
    }, 1000);

    // Smooth continuous lerp loop (30 FPS) to prevent any sudden jumps
    this.animTimerId = window.setInterval(() => {
      this.smoothStep();
    }, 33);
  }

  public stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.animTimerId !== null) {
      clearInterval(this.animTimerId);
      this.animTimerId = null;
    }
  }

  private smoothStep(): void {
    const store = useRigStore.getState();
    if (!store.isDynamicTideCycling) return;

    // Smoothly blend speed (lerp alpha 0.04)
    const speedDelta = this.targetSpeedKnots - this.currentLerpedSpeed;
    if (Math.abs(speedDelta) > 0.01) {
      this.currentLerpedSpeed += speedDelta * 0.04;
      useRigStore.setState({ currentSpeedKnots: Number(this.currentLerpedSpeed.toFixed(2)) });
    }

    // Smoothly blend angle across shortest circular arc
    let angleDelta = ((this.targetDirectionDeg - this.currentLerpedDirection + 540) % 360) - 180;
    if (Math.abs(angleDelta) > 0.1) {
      this.currentLerpedDirection = (this.currentLerpedDirection + angleDelta * 0.03 + 360) % 360;
      useRigStore.setState({
        currentDirectionDeg: Math.round(this.currentLerpedDirection),
        currentDirectionLabel: this.getCompassLabel(this.currentLerpedDirection),
      });
    }
  }

  public tick(): void {
    const store = useRigStore.getState();
    if (!store.isDynamicTideCycling) return;

    this.secondsInCurrentPhase++;
    const remaining = Math.max(0, this.PHASE_DURATION_SECONDS - this.secondsInCurrentPhase);

    useRigStore.setState({
      dynamicTideSecondsRemaining: remaining,
    });

    if (this.secondsInCurrentPhase >= this.PHASE_DURATION_SECONDS) {
      this.secondsInCurrentPhase = 0;
      const nextPhaseIndex = (store.tidePhaseIndex + 1) % TIDE_PHASES_SCHEDULE.length;
      this.applyPhase(nextPhaseIndex);
    }
  }

  public applyPhase(phaseIndex: number): void {
    const phase = TIDE_PHASES_SCHEDULE[phaseIndex] || TIDE_PHASES_SCHEDULE[0];
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

  /**
   * Generates a spoken diagnostic report for "varuna tell me the water status"
   */
  public getWaterStatusSpeech(): string {
    const store = useRigStore.getState();
    const phase = TIDE_PHASES_SCHEDULE[store.tidePhaseIndex] || TIDE_PHASES_SCHEDULE[0];
    const seabedPressureBar = Math.round(204 + (store.currentSpeedKnots * 1.8)); // Subsea hydrostatic + dynamic head at -2040m

    return `Hydrodynamic water telemetry report: Current flow velocity is ${store.currentSpeedKnots.toFixed(1)} knots heading ${store.currentDirectionLabel}. Subsea seabed hydrostatic pressure is ${seabedPressureBar} bar at 2,040 meters depth. Ocean state is in ${phase.label}, with surface swell height at ${phase.swellHeightM} meters. Tidal cycle duration is set to 1 minute per phase with smooth hydrodynamic transitions active.`;
  }

  private getCompassLabel(deg: number): string {
    const norm = ((deg % 360) + 360) % 360;
    if (norm >= 337.5 || norm < 22.5) return `N (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 67.5) return `NE (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 112.5) return `E (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 157.5) return `SE (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 202.5) return `S (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 247.5) return `SW (${Math.round(norm).toString().padStart(3, '0')}°)`;
    if (norm < 292.5) return `W (${Math.round(norm).toString().padStart(3, '0')}°)`;
    return `NW (${Math.round(norm).toString().padStart(3, '0')}°)`;
  }
}

export const dynamicTideEngine = new DynamicTideEngine();
