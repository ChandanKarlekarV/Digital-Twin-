import React, { useEffect, useRef } from 'react';
import {
  ShieldAlert,
  XCircle,
  RotateCcw,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import {
  useRigStore,
  EmergencyScenario,
  INCIDENT_SCENARIOS_CATALOG,
} from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';
import { telemetryDb } from '../../db/TelemetryDatabase';
import { solveNetwork } from '../../physics/KgD6FlowModel';
import { productionAt } from '../../data/kgd6Production';
import { useLeakStatus } from '../../services/LeakDetector';
import { KgD6WeatherService } from '../../services/KgD6WeatherService';
import { drillTorsionalEngine } from '../../physics/DrillTorsionalStress';

export const EmergencyIncidentPanel: React.FC = () => {
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const nextIncidentPhase = useRigStore((s) => s.nextIncidentPhase);
  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);

  // Measured manifold pressure against today's undisturbed network (re-evaluated on every telemetry update)
  useTelemetryStore((s) => s.currentRecord);
  const manifoldNow = telemetryDb.getLatest('MANIFOLD-D6-MAIN')?.p_line_bar;
  const baseline = solveNetwork(productionAt());
  const manifoldRiseBar = manifoldNow ? Math.max(0, manifoldNow - baseline['MANIFOLD-D6-MAIN'].pBar) : 0;
  const riserAlphaBar = telemetryDb.getLatest('RISER-ALPHA')?.p_line_bar ?? baseline['RISER-ALPHA'].pBar;
  const riserAlphaDrop = baseline['RISER-ALPHA'].pBar - riserAlphaBar;
  const leak = useLeakStatus();
  const fx = (v: number | undefined, d = 1) => (v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));
  const gasOf = (id: string) => (telemetryDb.getLatest(id)?.associated_gas_mmscfd ?? 0) / 35.3147;
  const drillRec = telemetryDb.getLatest('TOPSIDE-DRILL-RIG');
  const exportRec = telemetryDb.getLatest('TOPSIDE-MPFM-01');
  const manifoldRec = telemetryDb.getLatest('MANIFOLD-D6-MAIN');
  const wx = KgD6WeatherService.getCachedReport();
  const splitA = gasOf('RISER-ALPHA') / Math.max(gasOf('RISER-ALPHA') + gasOf('RISER-BRAVO'), 1e-6);
  const drillSF = drillRec ? drillTorsionalEngine.calculate({ torqueKNm: drillRec.drill_torque_knm ?? 0, rotarySpeedRPM: drillRec.drill_rpm ?? 0 }).safetyFactor : undefined;
  const liveRows: [string, string][] =
    emergencyScenario === 'pipe_blockage'
      ? [['Manifold pressure rise', `+${fx(manifoldRiseBar)} bar`], ['Riser split A / B', `${fx(splitA * 100, 0)}% / ${fx((1 - splitA) * 100, 0)}%`], ['Block gas', `${fx(gasOf('MANIFOLD-D6-MAIN'), 2)} MMSCMD`]]
      : emergencyScenario === 'hydrate_plug'
      ? [['Manifold temperature', `${fx(manifoldRec?.t_line_c)} °C`], ['Manifold pressure rise', `+${fx(manifoldRiseBar)} bar`], ['Water cut', `${fx(manifoldRec?.water_cut_pct)}%`]]
      : emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill'
      ? [['Rotary speed', `${fx(drillRec?.drill_rpm, 0)} RPM`], ['Torque', `${fx(drillRec?.drill_torque_knm)} kNm`], ['Yield safety factor', fx(drillSF, 2)]]
      : emergencyScenario === 'oil_overload'
      ? [['Export condensate', `${Math.round(exportRec?.net_oil_bpd ?? 0).toLocaleString()} bbl/d`], ['Water cut', `${fx(exportRec?.water_cut_pct)}%`]]
      : emergencyScenario === 'weather_squall'
      ? [['Wind (live)', wx ? `${fx(wx.windSpeedKnots)} kt, gusts ${fx(wx.windGustsKnots)} kt` : '—'], ['Waves (live)', wx ? `Hs ${fx(wx.significantWaveHeightM, 2)} m` : '—']]
      : emergencyScenario === 'rupture'
      ? [['Riser Alpha pressure', `${fx(riserAlphaBar)} bar (${riserAlphaDrop >= 0 ? '−' : '+'}${fx(Math.abs(riserAlphaDrop))} bar)`], ['Mass balance', leak.state === 'normal' ? 'balanced' : `${fx(leak.imbalancePct)}% missing`]]
      : [];

  const prevScenario = useRef<EmergencyScenario>('none');
  const prevPhase = useRef<number>(1);

  // Trigger automated alarm and tactical voice announcement on scenario change
  useEffect(() => {
    if (emergencyScenario !== prevScenario.current || incidentPhase !== prevPhase.current) {
      if (emergencyScenario !== 'none') {
        varunaVoice.speakIncidentAlert(emergencyScenario, incidentPhase);

        if (emergencyScenario === 'rupture') {
          setCameraViewMode('riser');
        } else if (emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill') {
          setCameraViewMode('topside');
        } else if (emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug') {
          setCameraViewMode('manifold');
        }
      }
      prevScenario.current = emergencyScenario;
      prevPhase.current = incidentPhase;
    }
  }, [emergencyScenario, incidentPhase, setCameraViewMode]);

  if (emergencyScenario === 'none') return null;

  const currentMeta = INCIDENT_SCENARIOS_CATALOG[emergencyScenario] || INCIDENT_SCENARIOS_CATALOG.none;
  const phaseData = currentMeta.phases[incidentPhase];

  return (
    <div className="absolute top-16 right-4 sm:right-16 z-50 w-88 sm:w-96 rounded-2xl glass-panel-alert p-4 shadow-red-glow text-white font-sans backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Alert Header */}
      <div className="flex items-center justify-between border-b border-reliance-red/40 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-reliance-red/30 text-reliance-red animate-pulse">
            <ShieldAlert className="w-5 h-5 text-reliance-red" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-reliance-red uppercase tracking-widest font-extrabold animate-pulse">
                ACTIVE INCIDENT • PHASE {incidentPhase}/4
              </span>
            </div>
            <h3 className="text-xs font-bold text-white uppercase">
              {currentMeta.shortLabel}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleIncidentModal}
            className="p-1 rounded-lg hover:bg-white/10 text-reliance-cyan hover:text-white transition-all cursor-pointer"
            title="Open Full Incident Suite"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={() => setEmergencyScenario('none')}
            className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Dismiss Alert"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dynamic Scenario Diagnostics */}
      <div className="space-y-2.5 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-reliance-red/20 border border-reliance-red/40 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-red-200">PHASE STATUS:</span>
            <span className="text-white font-bold">{phaseData?.label}</span>
          </div>

          {/* Live readings from the asset each drill affects */}
          {liveRows.map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-red-200">{label}:</span>
              <span className="text-white font-bold">{value}</span>
            </div>
          ))}        </div>

        <div className="p-2 rounded-lg bg-reliance-dark/80 border border-white/10 text-[10px] space-y-1">
          <div className="text-reliance-cyan font-bold">RECOMMENDED TACTICAL ACTION:</div>
          <div className="text-white/90">{phaseData?.actionRecommended}</div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2">
          {incidentPhase < 4 && (
            <button
              onClick={nextIncidentPhase}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white text-[11px] font-mono font-bold transition-all cursor-pointer"
            >
              <span>NEXT PHASE ({incidentPhase + 1})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setEmergencyScenario('none')}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-reliance-red/70 hover:bg-reliance-red text-white text-[11px] font-mono font-bold transition-all cursor-pointer shadow-red-glow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ESD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
