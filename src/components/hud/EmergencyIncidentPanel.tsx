import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Flame,
  Activity,
  CheckCircle2,
  XCircle,
  Volume2,
  RotateCcw,
  Zap,
  Waves,
  Wrench,
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

export const EmergencyIncidentPanel: React.FC = () => {
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);
  const setScannerMode = useRigStore((s) => s.setScannerMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const nextIncidentPhase = useRigStore((s) => s.nextIncidentPhase);
  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeHydraulicResult = useTelemetryStore((s) => s.activeHydraulicResult);
  const activeDrillResult = useTelemetryStore((s) => s.activeDrillResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);

  const prevScenario = useRef<EmergencyScenario>('none');
  const prevPhase = useRef<number>(1);

  // Trigger automated alarm and tactical voice announcement on scenario change
  useEffect(() => {
    if (emergencyScenario !== prevScenario.current || incidentPhase !== prevPhase.current) {
      if (emergencyScenario !== 'none') {
        varunaVoice.speakIncidentAlert(emergencyScenario, incidentPhase);

        if (emergencyScenario === 'rupture') {
          setScannerMode('acoustic');
          setCameraViewMode('riser');
        } else if (emergencyScenario === 'drill_damage' || emergencyScenario === 'stuck_drill') {
          setCameraViewMode('topside');
        } else if (emergencyScenario === 'pipe_blockage' || emergencyScenario === 'hydrate_plug') {
          setScannerMode('thermal');
          setCameraViewMode('manifold');
        }
      }
      prevScenario.current = emergencyScenario;
      prevPhase.current = incidentPhase;
    }
  }, [emergencyScenario, incidentPhase, setScannerMode, setCameraViewMode]);

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

          {emergencyScenario === 'pipe_blockage' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">MANIFOLD ΔP SURGE:</span>
                <span className="text-white font-bold">+{activeHydraulicResult?.pressureDropBar.toFixed(1)} bar</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">CHOKE CONSTRICTION:</span>
                <span className="text-reliance-red font-bold animate-pulse">{activeHydraulicResult?.blockageSeverityPct}%</span>
              </div>
            </>
          )}

          {emergencyScenario === 'drill_damage' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">DOWNHOLE TORQUE:</span>
                <span className="text-white font-bold">{((activeDrillResult?.torqueNm || 0) / 1000).toFixed(1)} kNm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">YIELD SAFETY FACTOR:</span>
                <span className="text-reliance-red font-bold animate-pulse">{activeDrillResult?.safetyFactor.toFixed(2)}</span>
              </div>
            </>
          )}

          {emergencyScenario === 'oil_overload' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">NET OIL GATHERING:</span>
                <span className="text-white font-bold">{Math.round(activeMultiphaseResult?.net_oil_bpd || 0).toLocaleString()} BPD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">WATER-CUT SURGE:</span>
                <span className="text-amber-300 font-bold">{activeMultiphaseResult?.water_cut_percentage.toFixed(1)}%</span>
              </div>
            </>
          )}

          {emergencyScenario === 'weather_squall' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">SIGNIFICANT WAVE HEIGHT:</span>
                <span className="text-white font-bold">{(1.5 + incidentPhase * 1.8).toFixed(1)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">STORM TIDAL CURRENT:</span>
                <span className="text-cyan-300 font-bold">{(2.4 + incidentPhase * 1.6).toFixed(1)} kt</span>
              </div>
            </>
          )}

          {emergencyScenario === 'rupture' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">LINE DECOMPRESSION:</span>
                <span className="text-white font-bold">{currentRecord?.p_line_bar.toFixed(1)} bar (-68 bar)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">SEAWATER INGRESS:</span>
                <span className="text-white font-bold">{currentRecord?.water_cut_pct.toFixed(1)}%</span>
              </div>
            </>
          )}

          {emergencyScenario === 'hydrate_plug' && (
            <>
              <div className="flex justify-between">
                <span className="text-red-200">SEABED TEMP:</span>
                <span className="text-white font-bold">{currentRecord?.t_line_c.toFixed(1)}°C (&lt; 4.0°C)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">DIFFERENTIAL ΔP:</span>
                <span className="text-white font-bold">+38.5 bar</span>
              </div>
            </>
          )}
        </div>

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
