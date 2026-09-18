import React from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldAlert,
  Gauge,
  Thermometer,
  Radio,
  Sliders,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  useRigStore,
  EmergencyScenario,
  INCIDENT_SCENARIOS_CATALOG,
} from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

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
      label: 'Pressure Fluctuation',
      sub: 'Choke / Blockage ΔP',
      icon: Gauge,
      val: currentRecord ? `${currentRecord.p_line_bar.toFixed(1)} bar` : '254.2 bar',
      isTriggered: emergencyScenario === 'pipe_blockage' || emergencyScenario === 'rupture',
    },
    {
      id: 'hydrate_plug' as EmergencyScenario,
      label: 'Temp Warning',
      sub: 'Cryogenic Seabed (<4°C)',
      icon: Thermometer,
      val: currentRecord ? `${currentRecord.t_line_c.toFixed(1)} °C` : '48.6 °C',
      isTriggered: emergencyScenario === 'hydrate_plug',
    },
    {
      id: 'stuck_drill' as EmergencyScenario,
      label: 'Signal Loss / Jam',
      sub: 'Drillstring Torque Load',
      icon: Radio,
      val: emergencyScenario === 'stuck_drill' ? '42.0 kNm' : '28.4 kNm',
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
              <span>CRITICAL ANOMALIES</span>
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
                'ALL SENSOR CHANNELS NOMINAL'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleIncidentModal}
            className="px-1.5 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/40 text-[9px] font-mono text-rose-200 transition-all cursor-pointer flex items-center gap-1"
            title="Open Full Incident Stepper Suite"
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>SUITE</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-white/10 text-rose-300 cursor-pointer transition-all"
          >
            <RotateCcw className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

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
