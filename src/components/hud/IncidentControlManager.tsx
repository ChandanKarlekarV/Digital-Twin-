import React from 'react';
import {
  X,
  ShieldAlert,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Activity,
  CheckCircle2,
  Waves,
  Wrench,
  Flame,
  Zap,
} from 'lucide-react';
import {
  useRigStore,
  EmergencyScenario,
  IncidentPhase,
  INCIDENT_SCENARIOS_CATALOG,
} from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const IncidentControlManager: React.FC = () => {
  const isIncidentModalOpen = useRigStore((s) => s.isIncidentModalOpen);
  const setIncidentModalOpen = useRigStore((s) => s.setIncidentModalOpen);

  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);
  const isAutoSimulatingPhases = useRigStore((s) => s.isAutoSimulatingPhases);

  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);
  const setIncidentPhase = useRigStore((s) => s.setIncidentPhase);
  const nextIncidentPhase = useRigStore((s) => s.nextIncidentPhase);
  const prevIncidentPhase = useRigStore((s) => s.prevIncidentPhase);
  const toggleAutoSimulatePhases = useRigStore((s) => s.toggleAutoSimulatePhases);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);

  if (!isIncidentModalOpen) return null;

  const currentMeta = INCIDENT_SCENARIOS_CATALOG[emergencyScenario] || INCIDENT_SCENARIOS_CATALOG.none;
  const currentPhaseData = currentMeta.phases[incidentPhase];

  const handleSelectScenario = (scenario: EmergencyScenario) => {
    setEmergencyScenario(scenario, 1);
    const meta = INCIDENT_SCENARIOS_CATALOG[scenario];
    if (meta?.targetAssetId) {
      setSelectedAssetId(meta.targetAssetId);
    }
    varunaVoice.speakIncidentAlert(scenario, 1);
  };

  const getScenarioIcon = (scenario: EmergencyScenario) => {
    switch (scenario) {
      case 'pipe_blockage':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'drill_damage':
        return <Wrench className="w-4 h-4 text-rose-400" />;
      case 'oil_overload':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'weather_squall':
        return <Waves className="w-4 h-4 text-cyan-400" />;
      case 'rupture':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'hydrate_plug':
        return <Zap className="w-4 h-4 text-sky-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl glass-panel border border-reliance-red/40 bg-reliance-deepnavy/95 shadow-red-glow text-white font-sans flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-red/20 bg-reliance-navy/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-red/30 border border-reliance-red/40 text-reliance-red animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reliance-red/20 text-reliance-red border border-reliance-red/30 font-bold uppercase">
                  SUBSEA ANOMALY & INCIDENT SIMULATOR
                </span>
                <span className="text-xs text-reliance-textMuted font-mono">
                  {emergencyScenario.toUpperCase()}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Dynamic Incident Progression & Tactical Anomaly Injection
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIncidentModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans">
          {/* 1. SCENARIO SELECTOR GRID */}
          <div>
            <div className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2">
              Select Subsea Anomaly Scenario:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  'none',
                  'pipe_blockage',
                  'drill_damage',
                  'oil_overload',
                  'weather_squall',
                  'rupture',
                  'hydrate_plug',
                  'stuck_drill',
                ] as EmergencyScenario[]
              ).map((sc) => {
                const meta = INCIDENT_SCENARIOS_CATALOG[sc];
                const isSelected = emergencyScenario === sc;
                return (
                  <button
                    key={sc}
                    onClick={() => handleSelectScenario(sc)}
                    className={`p-3 rounded-xl text-left font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-reliance-red/30 border-reliance-red text-white shadow-red-glow font-bold'
                        : 'bg-reliance-navy/50 border-white/10 text-reliance-textMuted hover:text-white hover:border-reliance-cyan/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getScenarioIcon(sc)}
                      <span className="text-xs font-bold truncate">{meta?.shortLabel || sc}</span>
                    </div>
                    <div className="text-[9px] text-white/50 truncate">{meta?.title || ''}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. ACTIVE SCENARIO DETAIL & 4-PHASE PROGRESSION */}
          <div className="p-4 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/30 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-mono text-reliance-red uppercase tracking-wider font-bold">
                  ACTIVE FAILURE:
                </span>
                <h3 className="text-base font-bold text-white">{currentMeta.title}</h3>
                <p className="text-xs text-rose-300 font-mono mt-0.5">
                  Primary Risk: {currentMeta.primaryRisk}
                </p>
              </div>

              {/* Auto Simulation Toggle */}
              <button
                onClick={toggleAutoSimulatePhases}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                  isAutoSimulatingPhases
                    ? 'bg-amber-500/30 border-amber-400 text-amber-300 shadow-amber-glow animate-pulse'
                    : 'bg-reliance-navy border-reliance-cyan/30 text-reliance-cyan hover:bg-reliance-blue/50'
                }`}
              >
                {isAutoSimulatingPhases ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isAutoSimulatingPhases ? 'AUTO-PLAYING PHASES' : 'AUTO-SIMULATE'}</span>
              </button>
            </div>

            {/* Phase Stepper Buttons */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-reliance-textMuted mb-2">
                <span>INCIDENT PROGRESSION TIMELINE:</span>
                <span className="text-reliance-cyan font-bold">CURRENT: PHASE {incidentPhase} OF 4</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as IncidentPhase[]).map((phaseNum) => {
                  const pData = currentMeta.phases[phaseNum];
                  const isActive = incidentPhase === phaseNum;
                  return (
                    <button
                      key={phaseNum}
                      onClick={() => {
                        setIncidentPhase(phaseNum);
                        varunaVoice.speakIncidentAlert(emergencyScenario, phaseNum);
                      }}
                      className={`p-2.5 rounded-lg text-left font-mono transition-all cursor-pointer border ${
                        isActive
                          ? phaseNum === 3
                            ? 'bg-reliance-red/40 border-reliance-red text-white shadow-red-glow font-bold'
                            : phaseNum === 4
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 font-bold'
                            : 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                          : 'bg-reliance-dark/80 border-white/10 text-reliance-textMuted hover:text-white'
                      }`}
                    >
                      <div className="text-[10px] font-bold">Phase {phaseNum}</div>
                      <div className="text-[9px] truncate opacity-80">{pData?.label || ''}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Phase Deep Dive */}
            <div className="p-3.5 rounded-lg bg-reliance-dark/90 border border-reliance-cyan/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-reliance-cyan font-bold">
                  {currentPhaseData?.label}
                </span>
                <button
                  onClick={() => varunaVoice.speakIncidentAlert(emergencyScenario, incidentPhase)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-reliance-blue/60 hover:bg-reliance-blue text-[11px] font-mono text-reliance-cyan border border-reliance-cyan/40 transition-all cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>SPEAK VARUNA ALERT</span>
                </button>
              </div>

              <p className="text-xs text-reliance-textMuted leading-relaxed">
                {currentPhaseData?.description}
              </p>

              <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs font-mono">
                <span className="text-emerald-400 font-bold">RECOMMENDED ACTION:</span>
                <span className="text-white">{currentPhaseData?.actionRecommended}</span>
              </div>
            </div>

            {/* Stepper Navigation Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={prevIncidentPhase}
                disabled={incidentPhase <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-reliance-navy border border-white/20 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREVIOUS PHASE</span>
              </button>

              <button
                onClick={() => handleSelectScenario('none')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold hover:bg-emerald-500/30 cursor-pointer"
              >
                RESTORE NOMINAL STATUS
              </button>

              <button
                onClick={nextIncidentPhase}
                disabled={incidentPhase >= 4}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-reliance-navy border border-white/20 text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/10 cursor-pointer"
              >
                <span>NEXT PHASE</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
