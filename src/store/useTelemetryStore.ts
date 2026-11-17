import { create } from 'zustand';
import { TelemetryRecord } from '../types/telemetry';
import { ASTM1250Result, astm1250Engine } from '../physics/ASTM1250Engine';
import { CoriolisCalculationResult, coriolisEngine } from '../physics/CoriolisEngine';
import { MultiphaseDeconvolutionResult, multiphaseCutEngine } from '../physics/MultiphaseCut';
import { HydraulicCalculationResult, darcyWeisbachEngine } from '../physics/DarcyWeisbachHydraulics';
import { DrillMechanicsResult, drillTorsionalEngine } from '../physics/DrillTorsionalStress';
import { condensateDensity, CONDENSATE_RHO_15C, gasDensity, GAS_RHO_STD } from '../physics/KgD6FlowModel';
import { telemetryDb } from '../db/TelemetryDatabase';

/** Inside diameters of each metered line, m (design assumptions, as in KgD6FlowModel) */
const PIPE_ID: Record<string, number> = { 'RISER-ALPHA': 0.3048, 'RISER-BRAVO': 0.3048, 'MANIFOLD-D6-MAIN': 0.4064, 'XT-WELLHEAD-01': 0.2032, 'XT-WELLHEAD-02': 0.2032, 'TOPSIDE-MPFM-01': 0.3048 };

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

    const coriolisRes = coriolisEngine.computeDensityFromFrequency(
      active.f_osc_hz,
      active.t_line_c
    );
    const astmRes = astm1250Engine.executeFullCorrection(
      coriolisRes.temp_compensated_density_kg_m3,
      active.t_line_c,
      active.p_line_bar
    );
    // Same chain as the flow computer: in-situ condensate density from ASTM D1250 forward
    const multiphaseRes = multiphaseCutEngine.deconvolveFlow(
      coriolisRes.temp_compensated_density_kg_m3,
      condensateDensity(active.t_line_c, active.p_line_bar),
      active.gross_mass_rate,
      CONDENSATE_RHO_15C
    );

    // Pipe hydraulics of the gas-condensate mixture in this asset's line (no-slip density,
    // gas viscosity). Restrictions are already in the network physics, so none is added here.
    const gasKgS = ((active.associated_gas_mmscfd ?? 0) / 35.3147) * 1e6 * GAS_RHO_STD / 86400;
    const gasM3S = gasKgS / gasDensity(active.p_line_bar, active.t_line_c);
    const liqM3S = active.gross_mass_rate / Math.max(coriolisRes.temp_compensated_density_kg_m3, 1);
    const mixKgS = gasKgS + active.gross_mass_rate;
    const hydraulicRes = darcyWeisbachEngine.calculate({
      massRateKgS: mixKgS,
      densityKgM3: mixKgS / Math.max(gasM3S + liqM3S, 1e-6),
      pipeDiameterM: PIPE_ID[active.asset_id] ?? 0.3048,
      pipeLengthM: 1000,
      viscosityPaS: 2.0e-5,
    });

    // Drill mechanics from the newest drill-string reading
    const drill = active.asset_id === 'TOPSIDE-DRILL-RIG' ? active : telemetryDb.getLatest('TOPSIDE-DRILL-RIG');
    const drillRes = drillTorsionalEngine.calculate({
      torqueKNm: drill?.drill_torque_knm ?? 28.4,
      rotarySpeedRPM: drill?.drill_rpm ?? 120,
      isJamActive: (drill?.drill_rpm ?? 120) === 0,
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
