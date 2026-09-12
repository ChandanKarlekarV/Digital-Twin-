import { create } from 'zustand';
import { TelemetryRecord } from '../types/telemetry';
import { ASTM1250Result, astm1250Engine } from '../physics/ASTM1250Engine';
import { CoriolisCalculationResult, coriolisEngine } from '../physics/CoriolisEngine';
import { MultiphaseDeconvolutionResult, multiphaseCutEngine } from '../physics/MultiphaseCut';
import { HydraulicCalculationResult, darcyWeisbachEngine } from '../physics/DarcyWeisbachHydraulics';
import { DrillMechanicsResult, drillTorsionalEngine } from '../physics/DrillTorsionalStress';
import { useRigStore } from './useRigStore';

interface TelemetryState {
  currentRecord: TelemetryRecord | null;
  rawRecord: TelemetryRecord | null;
  kalmanRecord: TelemetryRecord | null;
  displayFilterMode: 'kalman' | 'raw';
  setDisplayFilterMode: (mode: 'kalman' | 'raw') => void;

  historyBuffer: TelemetryRecord[];

  // Real-time Physics derivations
  activeCoriolisResult: CoriolisCalculationResult | null;
  activeAstmResult: ASTM1250Result | null;
  activeMultiphaseResult: MultiphaseDeconvolutionResult | null;
  activeHydraulicResult: HydraulicCalculationResult | null;
  activeDrillResult: DrillMechanicsResult | null;

  // Actions
  updateTelemetry: (raw: TelemetryRecord, filtered: TelemetryRecord) => void;
}

const MAX_HISTORY_BUFFER = 100;

export const useTelemetryStore = create<TelemetryState>((set) => ({
  currentRecord: null,
  rawRecord: null,
  kalmanRecord: null,
  displayFilterMode: 'kalman',
  setDisplayFilterMode: (mode) =>
    set((state) => ({
      displayFilterMode: mode,
      currentRecord: mode === 'kalman' ? state.kalmanRecord : state.rawRecord,
    })),

  historyBuffer: [],

  activeCoriolisResult: null,
  activeAstmResult: null,
  activeMultiphaseResult: null,
  activeHydraulicResult: null,
  activeDrillResult: null,

  updateTelemetry: (raw, filtered) => {
    // Compute line-by-line physics derivations
    const active = filtered; // Filtered is default authoritative state
    const { emergencyScenario, incidentPhase } = useRigStore.getState();

    const coriolisRes = coriolisEngine.computeDensityFromFrequency(
      active.f_osc_hz,
      active.t_line_c
    );
    const astmRes = astm1250Engine.executeFullCorrection(
      coriolisRes.temp_compensated_density_kg_m3,
      active.t_line_c,
      active.p_line_bar
    );
    const multiphaseRes = multiphaseCutEngine.deconvolveFlow(
      coriolisRes.temp_compensated_density_kg_m3,
      astmRes.rho_base * 0.98, // In-situ expanded oil
      active.gross_mass_rate,
      astmRes.rho_base
    );

    // Calculate Hydraulic pipe parameters
    const isBlockage = emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug';
    const blockageRatio = isBlockage ? Math.min(0.92, 0.2 + incidentPhase * 0.22) : 0.0;
    const hydraulicRes = darcyWeisbachEngine.calculate({
      massRateKgS: active.gross_mass_rate,
      densityKgM3: coriolisRes.temp_compensated_density_kg_m3,
      blockageRatio,
    });

    // Calculate Drill Mechanics parameters
    const isDrillIssue = emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill';
    const baseTorque = 28.4;
    const addedTorque = isDrillIssue ? incidentPhase * 6.5 : 0;
    const isJam = isDrillIssue && incidentPhase >= 3;
    const drillRes = drillTorsionalEngine.calculate({
      torqueKNm: baseTorque + addedTorque,
      rotarySpeedRPM: isJam ? 0 : Math.max(0, 120 - (isDrillIssue ? incidentPhase * 30 : 0)),
      isJamActive: isJam,
    });

    set((state) => {
      const activeRecord = state.displayFilterMode === 'kalman' ? filtered : raw;
      const newHistory = [...state.historyBuffer, activeRecord];
      if (newHistory.length > MAX_HISTORY_BUFFER) {
        newHistory.shift();
      }

      return {
        rawRecord: raw,
        kalmanRecord: filtered,
        currentRecord: activeRecord,
        historyBuffer: newHistory,
        activeCoriolisResult: coriolisRes,
        activeAstmResult: astmRes,
        activeMultiphaseResult: multiphaseRes,
        activeHydraulicResult: hydraulicRes,
        activeDrillResult: drillRes,
      };
    });
  },
}));
