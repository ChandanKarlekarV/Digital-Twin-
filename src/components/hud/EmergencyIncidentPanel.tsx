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
} from 'lucide-react';
import { useRigStore, EmergencyScenario } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const EmergencyIncidentPanel: React.FC = () => {
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);
  const setScannerMode = useRigStore((s) => s.setScannerMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const currentRecord = useTelemetryStore((s) => s.currentRecord);

  const prevScenario = useRef<EmergencyScenario>('none');

  // Trigger automated alarm and tactical voice announcement on failure
  useEffect(() => {
    if (emergencyScenario !== prevScenario.current) {
      if (emergencyScenario === 'rupture') {
        varunaVoice.playSonarPing(440, 0.4);
        varunaVoice.speakDiagnostic('RISER-ALPHA');
        setScannerMode('acoustic'); // Auto-switch to DAS acoustic scanner
        setCameraViewMode('riser');
      } else if (emergencyScenario === 'stuck_drill') {
        varunaVoice.playSonarPing(520, 0.3);
        varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
        setCameraViewMode('topside');
      } else if (emergencyScenario === 'hydrate_plug') {
        varunaVoice.playSonarPing(680, 0.3);
        varunaVoice.speakDiagnostic('XT-WELLHEAD-02');
        setScannerMode('thermal'); // Auto-switch to DTS thermal scanner
        setCameraViewMode('manifold');
      }
      prevScenario.current = emergencyScenario;
    }
  }, [emergencyScenario, setScannerMode, setCameraViewMode]);

  if (emergencyScenario === 'none') return null;

  return (
    <div className="absolute top-16 right-4 sm:right-16 z-50 w-88 sm:w-96 rounded-2xl glass-panel-alert p-4 shadow-red-glow text-white font-sans backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Alert Header */}
      <div className="flex items-center justify-between border-b border-reliance-red/40 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-reliance-red/30 text-reliance-red animate-pulse">
            <ShieldAlert className="w-5 h-5 text-reliance-red" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-reliance-red uppercase tracking-widest font-extrabold animate-pulse">
              CRITICAL ESD TRIP
            </div>
            <h3 className="text-xs font-bold text-white uppercase">
              {emergencyScenario === 'rupture'
                ? 'CATATROPHIC PIPE RUPTURE'
                : emergencyScenario === 'stuck_drill'
                ? 'DRILL STRING MECHANICAL JAM'
                : 'SUBSEA HYDRATE ICE PLUG'}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setEmergencyScenario('none')}
          className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Dismiss Alert"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Dynamic Scenario Diagnostics */}
      <div className="space-y-2.5 text-xs font-mono">
        {/* Scenario A: Pipe Rupture */}
        {emergencyScenario === 'rupture' && (
          <>
            <div className="p-2.5 rounded-lg bg-reliance-red/20 border border-reliance-red/40 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-red-200">RAPID DECOMPRESSION:</span>
                <span className="text-white font-bold">{currentRecord?.p_line_bar.toFixed(1)} bar (-68 bar)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">SEAWATER INGRESS (WC):</span>
                <span className="text-white font-bold">{currentRecord?.water_cut_pct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-200">DAS ACOUSTIC SPIKE:</span>
                <span className="text-reliance-red font-bold animate-pulse">&gt;98.4 dB CRITICAL</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SSIV Hydraulic Actuator: TRIPPED (CLOSED)</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Subsea Wellhead Master Valves: ISOLATED</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Zap className="w-3.5 h-3.5" />
                <span>Control Room Alarm Broadcast: ACTIVE</span>
              </div>
            </div>
          </>
        )}

        {/* Scenario B: Drill Lock */}
        {emergencyScenario === 'stuck_drill' && (
          <>
            <div className="p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-amber-200">ROTARY TORQUE OVERLOAD:</span>
                <span className="text-white font-bold">52.4 kNm (Limit: 38 kNm)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-200">STANDPIPE PRESSURE:</span>
                <span className="text-white font-bold">{currentRecord?.p_line_bar.toFixed(1)} bar (+45 bar)</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Top Drive Motor: AUTO-CUTOUT EXECUTED</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Activity className="w-3.5 h-3.5" />
                <span>Drill String Slip Clamping: ENGAGED</span>
              </div>
            </div>
          </>
        )}

        {/* Scenario C: Hydrate Plug */}
        {emergencyScenario === 'hydrate_plug' && (
          <>
            <div className="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-cyan-200">SEABED CRYOGENIC TEMP:</span>
                <span className="text-white font-bold">{currentRecord?.t_line_c.toFixed(1)}°C (&lt; 4.0°C)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cyan-200">MANIFOLD DIFFERENTIAL ΔP:</span>
                <span className="text-white font-bold">+38.5 bar DIFFERENTIAL</span>
              </div>
            </div>

            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Subsea Methanol (MEG) Injection: ACTIVE</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Chemical Hydrate Dissociation: PROGRESSING</span>
              </div>
            </div>
          </>
        )}

        {/* Action Controls */}
        <div className="pt-2 border-t border-white/10 flex items-center gap-2">
          <button
            onClick={() => setEmergencyScenario('none')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-reliance-red/70 hover:bg-reliance-red text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-red-glow"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ESD / RESTORE NORMAL</span>
          </button>
        </div>
      </div>
    </div>
  );
};
