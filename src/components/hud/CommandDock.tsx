import React, { useEffect, useRef } from 'react';
import {
  Camera,
  Scan,
  AlertTriangle,
  FileCode,
  SlidersHorizontal,
  Flame,
  Activity,
  Waves,
  Zap,
  CheckCircle2,
  FolderOpen,
  X,
  Sparkles,
  Cpu,
  ShieldCheck,
  Wrench,
  Sliders,
  Wind,
  Calendar,
  Database,
  FileText,
} from 'lucide-react';
import {
  useRigStore,
  CameraViewMode,
  ScannerMode,
  MetoceanCondition,
  EmergencyScenario,
} from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const CommandDock: React.FC = () => {
  const dockRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCommandDockOpen = useRigStore((s) => s.isCommandDockOpen);
  const setCommandDockOpen = useRigStore((s) => s.setCommandDockOpen);

  const cameraViewMode = useRigStore((s) => s.cameraViewMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);

  const scannerMode = useRigStore((s) => s.scannerMode);
  const setScannerMode = useRigStore((s) => s.setScannerMode);

  const metoceanCondition = useRigStore((s) => s.metoceanCondition);
  const setMetoceanCondition = useRigStore((s) => s.setMetoceanCondition);

  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const setEmergencyScenario = useRigStore((s) => s.setEmergencyScenario);

  const customObjFileName = useRigStore((s) => s.customObjFileName);
  const setCustomObjUrl = useRigStore((s) => s.setCustomObjUrl);

  const togglePhysicsModal = useRigStore((s) => s.togglePhysicsModal);
  const toggleTelemetryDrawer = useRigStore((s) => s.toggleTelemetryDrawer);
  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);
  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);
  const setVoiceModalOpen = useRigStore((s) => s.setVoiceModalOpen);
  const setHardwareModalOpen = useRigStore((s) => s.setHardwareModalOpen);
  const setReportModalOpen = useRigStore((s) => s.setReportModalOpen);
  const setEodModalOpen = useRigStore((s) => s.setEodModalOpen);
  const setSihModalOpen = useRigStore((s) => s.setSihModalOpen);

  const currentFlowPower = useRigStore((s) => s.currentFlowPower);
  const setCurrentFlowPower = useRigStore((s) => s.setCurrentFlowPower);
  const currentDirectionLabel = useRigStore((s) => s.currentDirectionLabel);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomObjUrl(url, file.name);
      varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCommandDockOpen) {
        setCommandDockOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandDockOpen, setCommandDockOpen]);

  if (!isCommandDockOpen) return null;

  return (
    <div
      ref={dockRef}
      className="absolute top-16 left-4 z-50 w-84 sm:w-96 rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 p-4 shadow-dock text-white font-sans backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {/* Hidden File Input for Custom .OBJ */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".obj"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-reliance-cyan/20 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-reliance-cyan" />
          <h2 className="font-extrabold text-xs tracking-wider uppercase text-reliance-cyan">
            VARUNA COMMAND SUITE
          </h2>
        </div>
        <button
          onClick={() => setCommandDockOpen(false)}
          className="p-1 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* 0. CUSTOM .OBJ RIG MODEL LOADER */}
        <div className="p-2.5 rounded-xl bg-reliance-blue/20 border border-reliance-cyan/30">
          <div className="flex items-center justify-between text-[11px] font-mono text-reliance-cyan mb-2 font-bold">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>CUSTOM 3D .OBJ RIG</span>
            </span>
            {customObjFileName && (
              <span className="text-[9px] text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                {customObjFileName}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2 px-3 rounded-lg bg-reliance-blue/60 hover:bg-reliance-blue border border-reliance-cyan/40 text-xs font-mono font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2 shadow-cyan-glow"
          >
            <FolderOpen className="w-3.5 h-3.5 text-reliance-cyan" />
            <span>{customObjFileName ? 'CHANGE .OBJ FILE' : 'SELECT .OBJ RIG FILE'}</span>
          </button>
        </div>

        {/* 1. CAMERA SPATIAL NAVIGATION */}
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-textMuted uppercase mb-1.5 font-semibold">
            <Camera className="w-3.5 h-3.5 text-reliance-cyan" />
            <span>Spatial Navigation Presets</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'topside', label: 'Topside Deck (+28m)' },
              { id: 'subsea', label: 'Dive Subsea (-85m)' },
              { id: 'manifold', label: 'Seabed Manifold (-118m)' },
              { id: 'riser', label: 'SCR Riser Hang-Off' },
            ].map((cam) => (
              <button
                key={cam.id}
                onClick={() => {
                  setCameraViewMode(cam.id as CameraViewMode);
                  varunaVoice.playSonarPing(750, 0.08);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                  cameraViewMode === cam.id
                    ? 'bg-reliance-blue/80 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                    : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white hover:border-reliance-cyan/40'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. MULTI-SPECTRAL SCANNERS */}
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-textMuted uppercase mb-1.5 font-semibold">
            <Scan className="w-3.5 h-3.5 text-reliance-cyan" />
            <span>Multi-Spectral Scanning Suite</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'hologram', label: 'Hologram (Cyber Twin)' },
              { id: 'normal', label: 'Color Coated' },
              { id: 'thermal', label: 'Thermal DTS (IR)' },
              { id: 'acoustic', label: 'Acoustic DAS (Sonic)' },
              { id: 'gamma', label: 'Gamma Tomography' },
            ].map((scan) => (
              <button
                key={scan.id}
                onClick={() => {
                  setScannerMode(scan.id as ScannerMode);
                  varunaVoice.playSonarPing(880, 0.08);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                  scannerMode === scan.id
                    ? 'bg-reliance-cyan/20 border-reliance-cyan text-reliance-cyan shadow-cyan-glow font-bold'
                    : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white hover:border-reliance-cyan/40'
                }`}
              >
                {scan.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. METOCEAN TIDES & WATER FLOW POWER */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-reliance-textMuted uppercase mb-1.5 font-semibold">
            <span className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-emerald-400" />
              <span>Water Flow Power & Tides</span>
            </span>
            <span className="text-reliance-cyan font-bold">
              {currentDirectionLabel}
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1 mb-2">
            {[
              { id: 'slow', label: 'SLOW', sub: '0.6 kt' },
              { id: 'moderate', label: 'MOD', sub: '2.4 kt' },
              { id: 'fast', label: 'FAST', sub: '4.6 kt' },
              { id: 'extreme', label: 'SURGE', sub: '8.2 kt' },
              { id: 'storm', label: 'STORM', sub: '8.8 kt' },
            ].map((p) => {
              const isActive = currentFlowPower === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setCurrentFlowPower(p.id as any);
                    varunaVoice.playSonarPing(700, 0.08);
                  }}
                  className={`p-1 rounded-lg text-center font-mono transition-all cursor-pointer border ${
                    isActive
                      ? p.id === 'storm'
                        ? 'bg-rose-500/40 border-rose-400 text-rose-200 font-bold shadow-red-glow animate-pulse'
                        : p.id === 'extreme'
                        ? 'bg-orange-500/30 border-orange-400 text-orange-200 font-bold'
                        : p.id === 'fast'
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300 font-bold'
                        : 'bg-reliance-cyan/20 border-reliance-cyan text-reliance-cyan font-bold'
                      : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
                  }`}
                >
                  <div className="text-[10px] font-bold">{p.label}</div>
                  <div className="text-[7.5px] opacity-75">{p.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. EMERGENCY INCIDENTS & ANOMALY INJECTIONS */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-mono text-reliance-red uppercase mb-1.5 font-semibold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-reliance-red" />
              <span>Subsea Anomaly Scenarios</span>
            </span>
            <button
              onClick={() => {
                toggleIncidentModal();
                setCommandDockOpen(false);
              }}
              className="text-[9px] text-reliance-cyan hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Sliders className="w-3 h-3" />
              <span>4-PHASE MANAGER</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                setEmergencyScenario('none');
                varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'none'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>ALL NOMINAL</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('pipe_blockage', 1);
                varunaVoice.speakIncidentAlert('pipe_blockage', 1);
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'pipe_blockage'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-amber-400'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-400" />
                <span>PIPE CHOKE / WAX</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('drill_damage', 1);
                varunaVoice.speakIncidentAlert('drill_damage', 1);
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'drill_damage'
                  ? 'bg-rose-500/30 border-rose-400 text-rose-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-rose-400'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <Wrench className="w-3 h-3 text-rose-400" />
                <span>DRILL DAMAGE</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('oil_overload', 1);
                varunaVoice.speakIncidentAlert('oil_overload', 1);
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'oil_overload'
                  ? 'bg-orange-500/30 border-orange-400 text-orange-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-orange-400'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400" />
                <span>OIL OVERLOAD</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('weather_squall', 1);
                varunaVoice.speakIncidentAlert('weather_squall', 1);
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'weather_squall'
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-cyan-400'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <Waves className="w-3 h-3 text-cyan-400" />
                <span>WEATHER SQUALL</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('rupture', 1);
                varunaVoice.speakIncidentAlert('rupture', 1);
              }}
              className={`p-2 rounded-lg text-left text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'rupture'
                  ? 'bg-reliance-red/30 border-reliance-red text-red-300 font-bold animate-pulse'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-reliance-red'
              }`}
            >
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-reliance-red" />
                <span>PIPE RUPTURE</span>
              </div>
            </button>
          </div>
        </div>

        {/* 5. MODALS & SYSTEM INTEGRATIONS */}
        <div className="pt-2 border-t border-reliance-cyan/20 grid grid-cols-2 gap-2">
          {/* SIH 6-Page Presentation Deck Button */}
          <button
            onClick={() => {
              setSihModalOpen(true);
              setCommandDockOpen(false);
            }}
            className="col-span-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-xs font-mono text-amber-200 border border-amber-400/50 transition-all cursor-pointer shadow-amber-glow font-bold"
          >
            <FileText className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>SIH 6-Page Presentation Deck &amp; Video Demo</span>
          </button>

          {/* Dedicated 6-Month Database Button */}
          <button
            onClick={() => {
              setEodModalOpen(true);
              setCommandDockOpen(false);
            }}
            className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 hover:from-emerald-600/50 hover:to-cyan-600/50 text-xs font-mono text-emerald-200 border border-emerald-400/50 transition-all cursor-pointer shadow-emerald-glow font-bold"
          >
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>6-Month AI Production Ledger &amp; Database</span>
          </button>

          <button
            onClick={() => {
              togglePhysicsModal();
              setCommandDockOpen(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-reliance-blue/60 hover:bg-reliance-blue text-xs font-mono text-reliance-cyan border border-reliance-cyan/40 transition-all cursor-pointer shadow-cyan-glow"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>LaTeX Math Audit</span>
          </button>

          <button
            onClick={() => {
              toggleWeatherPanel();
              setCommandDockOpen(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-mono text-amber-300 border border-amber-400/40 transition-all cursor-pointer shadow-amber-glow"
          >
            <Wind className="w-3.5 h-3.5 text-amber-400" />
            <span>KG-D6 Weather</span>
          </button>

          <button
            onClick={() => {
              setVoiceModalOpen(true);
              setCommandDockOpen(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-reliance-navy/80 hover:bg-reliance-blue/50 text-xs font-mono text-purple-300 border border-purple-400/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ElevenLabs Voice</span>
          </button>

          <button
            onClick={() => {
              setHardwareModalOpen(true);
              setCommandDockOpen(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-reliance-navy/80 hover:bg-reliance-blue/50 text-xs font-mono text-emerald-300 border border-emerald-400/30 transition-all cursor-pointer"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Hardware Gateway</span>
          </button>

          <button
            onClick={() => {
              setReportModalOpen(true);
              setCommandDockOpen(false);
            }}
            className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-reliance-navy/80 hover:bg-reliance-blue/50 text-xs font-mono text-white border border-white/20 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Compliance Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
