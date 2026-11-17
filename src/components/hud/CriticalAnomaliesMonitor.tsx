import React from 'react';
import {
  ShieldAlert,
  Gauge,
  Thermometer,
  Radio,
  Sliders,
  RotateCcw,
  Scale,
} from 'lucide-react';
import { useLeakStatus, leakDetector } from '../../services/LeakDetector';
import { telemetryDb } from '../../db/TelemetryDatabase';
import {
  useRigStore,
  EmergencyScenario,
  INCIDENT_SCENARIOS_CATALOG,
} from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

/** Pipeline mass balance (API RP 1130): manifold meter in, topside meter out, line-pack compensated */
const LeakBalanceRow: React.FC = () => {
  const s = useLeakStatus();
  const tone =
    s.state === 'alarm'
      ? { box: 'bg-danger-950 border-danger-500', text: 'text-danger-300', bar: 'bg-danger-400', label: 'Leak alarm' }
      : s.state === 'watch'
      ? { box: 'bg-warning-950 border-warning-600', text: 'text-warning-300', bar: 'bg-warning-400', label: 'Watching' }
      : { box: 'bg-surface-2 border-line', text: 'text-success-300', bar: 'bg-success-400', label: 'No leak' };
  const progress = Math.min(100, (s.cusum / s.limit) * 100);
  return (
    <div className={`mt-2 p-2 rounded-md border ${tone.box}`} title="Compensated mass balance: subsea manifold meter in, topside export meter out, corrected for gas stored in the risers">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 text-ink">
          <Scale className={`w-3.5 h-3.5 ${tone.text}`} />
          Mass balance
        </span>
        <span className={`font-semibold ${tone.text}`}>{tone.label}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
        <span>
          Missing <strong className="text-ink font-medium">{Math.max(0, s.imbalancePct).toFixed(2)}%</strong>
          {s.state !== 'normal' && <> · {s.lossMmscmd.toFixed(2)} MMSCMD</>}
        </span>
        <span>±{s.sigmaKgS.toFixed(1)} kg/s band</span>
      </div>
      <div className="mt-1 h-1 rounded-full bg-surface-3 overflow-hidden" aria-label="Evidence toward a leak alarm">
        <div className={`h-full ${tone.bar} transition-all duration-500`} style={{ width: `${progress}%` }} />
      </div>
      {s.state !== 'normal' && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
          <span className="text-ink truncate" title={s.location ?? ''}>
            {s.location}
          </span>
          <button onClick={() => leakDetector.reset()} className="btn h-6 px-2 text-[10px]" title="Clear after the leak is isolated">
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export const CriticalAnomaliesMonitor: React.FC = () => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);
  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);
  const currentRecord = useTelemetryStore((s) => s.currentRecord);

  const isIncidentActive = emergencyScenario !== 'none';
  const currentMeta = isIncidentActive ? INCIDENT_SCENARIOS_CATALOG[emergencyScenario] : null;

  const quickAlertItems = [
    {
      id: 'pipe_blockage' as EmergencyScenario,
      label: 'Line pressure',
      sub: 'Selected asset',
      icon: Gauge,
      val: currentRecord ? `${currentRecord.p_line_bar.toFixed(1)} bar` : '254.2 bar',
      isTriggered: emergencyScenario === 'pipe_blockage' || emergencyScenario === 'rupture',
    },
    {
      id: 'hydrate_plug' as EmergencyScenario,
      label: 'Line temperature',
      sub: 'Selected asset',
      icon: Thermometer,
      val: currentRecord ? `${currentRecord.t_line_c.toFixed(1)} °C` : '48.6 °C',
      isTriggered: emergencyScenario === 'hydrate_plug',
    },
    {
      id: 'stuck_drill' as EmergencyScenario,
      label: 'Drill torque',
      sub: 'Drill string',
      icon: Radio,
      val: `${(telemetryDb.getLatest('TOPSIDE-DRILL-RIG')?.drill_torque_knm ?? 0).toFixed(1)} kNm`,
      isTriggered: emergencyScenario === 'stuck_drill' || emergencyScenario === 'drill_damage',
    },
  ];

  const handleTriggerScenario = (scenario: EmergencyScenario) => {
    if (emergencyScenario === scenario) {
      setEmergencyScenario('none');
      varunaVoice.speakCustom('Emergency scenario cleared. All systems nominal.');
    } else {
      setEmergencyScenario(scenario, 1);
      varunaVoice.speakIncidentAlert(scenario, 1);
    }
  };

  return (
    <div className="w-full glass-panel border border-rose-500/40 bg-rose-950/20 rounded-2xl p-2.5 shadow-red-glow backdrop-blur-xl text-white font-sans transition-all">
      {/* Header */}
      <div className={`flex items-center justify-between ${isExpanded ? 'pb-2 mb-2 border-b border-rose-500/30' : ''}`}>
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer flex-1"
        >
          <div className="p-1 rounded-lg bg-rose-500/20 text-rose-400 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <span>Anomalies</span>
              {isIncidentActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              )}
            </h3>
            <div className="text-[8px] font-mono text-rose-200/70">
              {isIncidentActive ? (
                <span className="text-rose-300 font-bold">
                  ACTIVE: {currentMeta?.shortLabel} (PHASE {incidentPhase}/4)
                </span>
              ) : (
                'All sensors normal'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleIncidentModal}
            className="px-1.5 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-[9px] font-mono text-rose-200 transition-all cursor-pointer flex items-center gap-1"
            title="Open incident drills"
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>Drills</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-white/10 text-rose-300 cursor-pointer transition-all"
          >
            <RotateCcw className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <LeakBalanceRow />

      {/* 3 Quick Alert Items */}
      {isExpanded && (
        <div className="space-y-1.5 animate-in fade-in duration-150">
        {quickAlertItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleTriggerScenario(item.id)}
              className={`w-full p-2 rounded-xl text-left font-mono transition-all cursor-pointer border flex items-center justify-between ${
                item.isTriggered
                  ? 'bg-rose-500/30 border-rose-400 text-white shadow-red-glow animate-pulse'
                  : 'bg-reliance-navy/40 border-white/10 hover:border-rose-400/40 text-white/90'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${item.isTriggered ? 'text-rose-400' : 'text-reliance-cyan'}`} />
                <div>
                  <div className={`text-[10px] font-bold ${item.isTriggered ? 'text-rose-200' : 'text-white'}`}>
                    {item.label}
                  </div>
                  <div className="text-[8px] text-white/60">{item.sub}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[10px] font-extrabold ${item.isTriggered ? 'text-rose-300' : 'text-reliance-cyan'}`}>
                  {item.val}
                </div>
                <div className="text-[8px] text-rose-300/80">
                  {item.isTriggered ? '[SIMULATING]' : '[CLICK TEST]'}
                </div>
              </div>
            </button>
          );
        })}

        {/* Action Footer if Active */}
        {isIncidentActive && (
          <div className="mt-2 pt-2 border-t border-rose-500/30 flex items-center gap-1.5">
            <button
              onClick={() => setEmergencyScenario('none')}
              className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-red-glow"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET ESD TRIP</span>
            </button>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
