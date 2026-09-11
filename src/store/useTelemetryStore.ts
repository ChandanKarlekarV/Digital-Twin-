import { create } from 'zustand';
import { TelemetryRecord } from '../types/telemetry';
import { ASTM1250Result, astm1250Engine } from '../physics/ASTM1250Engine';
import { CoriolisCalculationResult, coriolisEngine } from '../physics/CoriolisEngine';
import { MultiphaseDeconvolutionResult, multiphaseCutEngine } from '../physics/MultiphaseCut';

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
    const multiphaseRes = multiphaseCutEngine.deconvolveFlow(
      coriolisRes.temp_compensated_density_kg_m3,
      astmRes.rho_base * 0.98, // In-situ expanded oil
      active.gross_mass_rate,
      astmRes.rho_base
    );

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
      };
    });
  },
}));
