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
} from 'lucide-react';
import {
  useRigStore,
  CameraViewMode,
  ScannerMode,
  MetoceanCondition,
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
      className="absolute top-16 left-4 z-50 w-80 sm:w-96 rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 p-4 shadow-dock text-white font-sans backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150"
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
              {useRigStore.getState().currentDirectionLabel}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 mb-2">
            {[
              { id: 'slow', label: 'SLOW', sub: '0.6 kt' },
              { id: 'moderate', label: 'MODERATE', sub: '2.4 kt' },
              { id: 'fast', label: 'FAST', sub: '4.6 kt' },
              { id: 'extreme', label: 'EXTREME', sub: '8.2 kt' },
            ].map((p) => {
              const isActive = useRigStore((s) => s.currentFlowPower) === p.id;
              const setCurrentFlowPower = useRigStore((s) => s.setCurrentFlowPower);
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setCurrentFlowPower(p.id as any);
                    varunaVoice.playSonarPing(700, 0.08);
                  }}
                  className={`p-1.5 rounded-lg text-center font-mono transition-all cursor-pointer border ${
                    isActive
                      ? p.id === 'extreme'
                        ? 'bg-rose-500/30 border-rose-400 text-rose-300 font-bold'
                        : p.id === 'fast'
                        ? 'bg-amber-500/30 border-amber-400 text-amber-300 font-bold'
                        : 'bg-reliance-cyan/20 border-reliance-cyan text-reliance-cyan font-bold'
                      : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
                  }`}
                >
                  <div className="text-[10px] font-bold">{p.label}</div>
                  <div className="text-[8px] opacity-75">{p.sub}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. EMERGENCY INCIDENT SIMULATOR */}
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-red uppercase mb-1.5 font-semibold">
            <AlertTriangle className="w-3 h-3 text-reliance-red" />
            <span>Emergency Incident & ESD Injections</span>
          </div>
          <div className="space-y-1.5">
            <button
              onClick={() => {
                setEmergencyScenario('none');
                varunaVoice.speakDiagnostic('MANIFOLD-D6-MAIN');
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'none'
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ALL NOMINAL (NO ACTIVE ESD)</span>
              </div>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('rupture');
                varunaVoice.speakDiagnostic('RISER-ALPHA');
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'rupture'
                  ? 'bg-reliance-red/30 border-reliance-red text-red-300 shadow-red-glow font-bold animate-pulse'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-reliance-red hover:border-reliance-red/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-reliance-red" />
                <span>PIPE RUPTURE / CATASTROPHIC LEAK</span>
              </div>
              <span className="text-[10px] text-reliance-red font-bold">-60 BAR</span>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('stuck_drill');
                varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'stuck_drill'
                  ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-amber-400 hover:border-amber-400/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>DRILL STRING LOCK / JAM</span>
              </div>
              <span className="text-[10px] text-amber-400 font-bold">+45 BAR</span>
            </button>

            <button
              onClick={() => {
                setEmergencyScenario('hydrate_plug');
                varunaVoice.speakDiagnostic('XT-WELLHEAD-02');
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all cursor-pointer border ${
                emergencyScenario === 'hydrate_plug'
                  ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 font-bold'
                  : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-cyan-400 hover:border-cyan-400/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-cyan-400" />
                <span>HYDRATE ICE PLUG BLOCKAGE</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold">3.2°C</span>
            </button>
          </div>
        </div>

        {/* 5. QUICK AUDIT & DRAWER TOGGLES */}
        <div className="pt-2 border-t border-reliance-cyan/20 grid grid-cols-2 gap-2">
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
              toggleTelemetryDrawer();
              setCommandDockOpen(false);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-reliance-navy/80 hover:bg-reliance-navy text-xs font-mono text-white border border-white/20 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Telemetry Drawer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
