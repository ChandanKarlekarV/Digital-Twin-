import React, { useEffect, useState, useRef } from 'react';
import { Scene } from './components/canvas/Scene';
import { telemetryEmitter } from './physics/TelemetryEmitter';
import { useRigStore } from './store/useRigStore';
import { CommandDock } from './components/hud/CommandDock';
import { TelemetryDrawer } from './components/hud/TelemetryDrawer';
import { PhysicsAuditModal } from './components/hud/PhysicsAuditModal';
import { EmergencyIncidentPanel } from './components/hud/EmergencyIncidentPanel';
import { VarunaVoiceIndicator } from './components/hud/VarunaVoiceIndicator';
import { CurrentControlWidget } from './components/hud/CurrentControlWidget';
import { Compass, Radio, Eye, ChevronDown, FolderOpen } from 'lucide-react';
import { varunaVoice } from './voice/VarunaVoiceSynthesizer';

export default function App() {
  const cameraViewMode = useRigStore((s) => s.cameraViewMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const isCommandDockOpen = useRigStore((s) => s.isCommandDockOpen);
  const toggleCommandDock = useRigStore((s) => s.toggleCommandDock);

  const customObjFileName = useRigStore((s) => s.customObjFileName);
  const setCustomObjUrl = useRigStore((s) => s.setCustomObjUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fps, setFps] = useState<number>(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomObjUrl(url, file.name);
      varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
    }
  };

  useEffect(() => {
    // Start the 10 Hz physical sensor engine & database seeder
    telemetryEmitter.start();

    // Rolling FPS calculation
    let animId: number;
    const calculateFps = () => {
      frameCount.current++;
      const now = performance.now();
      const delta = now - lastTime.current;
      if (delta >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / delta));
        frameCount.current = 0;
        lastTime.current = now;
      }
      animId = requestAnimationFrame(calculateFps);
    };
    animId = requestAnimationFrame(calculateFps);

    return () => {
      telemetryEmitter.stop();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-reliance-dark text-reliance-textMain font-sans flex flex-col">
      {/* Hidden File Input for Custom .OBJ Rig Model */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".obj"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ================= TOP TACTICAL HUD ================= */}
      <header className="absolute top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between pointer-events-none">
        {/* Left: Command Dock Pill Trigger & Custom OBJ Loader */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={toggleCommandDock}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/90 hover:bg-reliance-navy/90 transition-all shadow-cyan-glow cursor-pointer"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-reliance-cyan animate-pulse" />
            <span className="font-extrabold tracking-wider text-xs uppercase text-reliance-cyan">
              VARUNA COMMAND
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-reliance-cyan transition-transform duration-200 ${
                isCommandDockOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Quick .OBJ Model Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-panel border border-reliance-cyan/30 text-[11px] font-mono text-reliance-cyan hover:bg-reliance-blue/50 transition-all cursor-pointer shadow-cyan-glow"
            title="Load your custom .obj 3D rig model"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{customObjFileName ? `RIG: ${customObjFileName.slice(0, 14)}...` : 'LOAD .OBJ RIG'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-pill text-[11px] font-mono text-reliance-textMuted">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>10 Hz SYNC</span>
          </div>
        </div>

        {/* Center: Live Coordinates, Depth & Active Camera */}
        <div className="hidden lg:flex items-center gap-4 px-5 py-2 rounded-full glass-panel border border-reliance-cyan/25 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-reliance-cyan">
            <Compass className="w-3.5 h-3.5" />
            <span>16°35'N 82°18'E</span>
          </div>
          <div className="w-px h-3.5 bg-white/20" />
          <div className="text-reliance-textMuted">
            SEABED DEPTH: <span className="text-white font-bold">-2,040 m</span>
          </div>
          <div className="w-px h-3.5 bg-white/20" />
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-reliance-cyan" />
            <span className="text-reliance-cyan uppercase font-bold text-[11px]">
              {cameraViewMode.toUpperCase()} VIEW
            </span>
          </div>
        </div>

        {/* Right: Quick View Presets & Voice Indicator */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <VarunaVoiceIndicator />

          <div className="flex items-center p-1 rounded-xl glass-panel border border-reliance-cyan/20 text-xs font-mono">
            <button
              onClick={() => setCameraViewMode('topside')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                cameraViewMode === 'topside'
                  ? 'bg-reliance-blue text-white shadow-cyan-glow font-bold'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              TOPSIDE
            </button>
            <button
              onClick={() => setCameraViewMode('subsea')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                cameraViewMode === 'subsea'
                  ? 'bg-reliance-blue text-white shadow-cyan-glow font-bold'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              DIVE SUBSEA
            </button>
            <button
              onClick={() => setCameraViewMode('manifold')}
              className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                cameraViewMode === 'manifold'
                  ? 'bg-reliance-blue text-white shadow-cyan-glow font-bold'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              SEABED
            </button>
          </div>
        </div>
      </header>

      {/* ================= COMMAND DOCK DROPDOWN ================= */}
      <CommandDock />

      {/* ================= EMERGENCY INCIDENT PANEL ================= */}
      <EmergencyIncidentPanel />

      {/* ================= CLICK-TO-SLIDE TELEMETRY DRAWER ================= */}
      <TelemetryDrawer />

      {/* ================= INTERACTIVE PHYSICS AUDIT MODAL ================= */}
      <PhysicsAuditModal />

      {/* ================= WATER TIDES & FLOW POWER CONTROLLER ================= */}
      <CurrentControlWidget />

      {/* ================= 3D VIEWPORT (Occupies 100% of Screen) ================= */}
      <main id="canvas-container" className="relative w-full h-full flex-1 overflow-hidden">
        <Scene />
        <div className="absolute inset-0 scanlines pointer-events-none" />
      </main>

      {/* ================= BOTTOM STATUS FOOTER ================= */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 h-8 px-4 flex items-center justify-between glass-pill border-t border-reliance-cyan/15 text-[11px] font-mono text-reliance-textMuted pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <span>
            TARGET: <strong className="text-reliance-cyan">{selectedAssetId || 'KG-D6 MAIN'}</strong>
          </span>
          <span>
            FREQ: <strong className="text-emerald-400">10.0 Hz</strong>
          </span>
          <span>
            FPS: <strong className={fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}>{fps}.0</strong>
          </span>
          <span className="hidden sm:inline">
            GPU RASTER: <strong className="text-white">HARDWARE ACCEL</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-reliance-textMuted/70">RELIANCE OFFSHORE CYBER-PHYSICAL SUITE</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      </footer>
    </div>
  );
}
