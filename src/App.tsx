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
import { IncidentControlManager } from './components/hud/IncidentControlManager';
import { ElevenLabsConfigModal } from './components/hud/ElevenLabsConfigModal';
import { HardwareLinkModal } from './components/hud/HardwareLinkModal';
import { ComplianceReportModal } from './components/hud/ComplianceReportModal';
import { KgD6WeatherSidePanel } from './components/hud/KgD6WeatherSidePanel';
import { JarvisGestureVoiceHUD } from './components/hud/JarvisGestureVoiceHUD';
import { JarvisPipeSliceModal } from './components/hud/JarvisPipeSliceModal';
import { HolographicPartInspectionModal } from './components/hud/HolographicPartInspectionModal';
import { dynamicTideEngine } from './physics/DynamicTideEngine';
import {
  Compass,
  Radio,
  Eye,
  ChevronDown,
  FolderOpen,
  AlertTriangle,
  Sparkles,
  Cpu,
  FileCheck,
  Wind,
  Layers,
  Scissors,
  Video,
} from 'lucide-react';
import { varunaVoice } from './voice/VarunaVoiceSynthesizer';

export default function App() {
  const cameraViewMode = useRigStore((s) => s.cameraViewMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const isCommandDockOpen = useRigStore((s) => s.isCommandDockOpen);
  const toggleCommandDock = useRigStore((s) => s.toggleCommandDock);

  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);
  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);
  const setVoiceModalOpen = useRigStore((s) => s.setVoiceModalOpen);
  const setHardwareModalOpen = useRigStore((s) => s.setHardwareModalOpen);
  const setReportModalOpen = useRigStore((s) => s.setReportModalOpen);

  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const isGestureCameraActive = useRigStore((s) => s.isGestureCameraActive);

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

    // Start 10-second continuous dynamic tide & metocean phase cycling
    dynamicTideEngine.start();

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
      dynamicTideEngine.stop();
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
        {/* Left: Command Dock Pill Trigger & Quick Action Modules */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={toggleCommandDock}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/90 hover:bg-reliance-navy/90 transition-all shadow-cyan-glow cursor-pointer"
          >
            <div className="w-2 h-2 rounded-full bg-reliance-cyan animate-pulse" />
            <span className="font-extrabold tracking-wider text-xs uppercase text-reliance-cyan">
              COMMAND
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-reliance-cyan transition-transform duration-200 ${
                isCommandDockOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Quick Anomaly Simulator Button */}
          <button
            onClick={toggleIncidentModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-reliance-red/40 text-[11px] font-mono text-rose-300 hover:bg-reliance-red/20 transition-all cursor-pointer shadow-red-glow"
            title="Open Subsea Anomaly & Incident Suite (Pipe Choke, Drill Damage, Oil Overload, Squall)"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">ANOMALIES</span>
          </button>

          {/* Quick KG-D6 Weather Button */}
          <button
            onClick={toggleWeatherPanel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-amber-400/40 text-[11px] font-mono text-amber-300 hover:bg-amber-400/20 transition-all cursor-pointer shadow-amber-glow"
            title="Open KG-D6 Real-Time Weather & Marine Metocean Forecast"
          >
            <Wind className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">WEATHER</span>
          </button>

          {/* Quick Jarvis Split / Explode View Button */}
          <button
            onClick={() => setSplitViewActive(!isSplitViewActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border text-[11px] font-mono transition-all cursor-pointer ${
              isSplitViewActive
                ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-amber-glow font-bold'
                : 'border-amber-400/40 text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Toggle Jarvis Holographic Exploded Split View"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">{isSplitViewActive ? 'ASSEMBLE' : 'JARVIS SPLIT'}</span>
          </button>

          {/* Quick Pipe 1 Slice Button */}
          <button
            onClick={() => setPipeSliced(!isPipeSliced)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border text-[11px] font-mono transition-all cursor-pointer ${
              isPipeSliced
                ? 'bg-reliance-cyan/30 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                : 'border-reliance-cyan/40 text-reliance-cyan hover:bg-reliance-blue/30'
            }`}
            title="Toggle Pipe 1 Axial Cross-Section Slice"
          >
            <Scissors className="w-3.5 h-3.5 text-reliance-cyan" />
            <span className="hidden lg:inline">{isPipeSliced ? 'CLOSE SLICE' : 'SLICE PIPE 1'}</span>
          </button>

          {/* Quick ElevenLabs Voice Button */}
          <button
            onClick={() => setVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-purple-400/40 text-[11px] font-mono text-purple-300 hover:bg-purple-500/20 transition-all cursor-pointer"
            title="Configure ElevenLabs Voice Synthesizer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">VOICE</span>
          </button>

          {/* Quick Hardware HAL Bridge Button */}
          <button
            onClick={() => setHardwareModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-emerald-400/40 text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
            title="Configure Hardware Serial / SCADA Gateway"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">HARDWARE</span>
          </button>

          {/* Quick Compliance Report Button */}
          <button
            onClick={() => setReportModalOpen(true)}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-panel border border-white/20 text-[11px] font-mono text-white hover:bg-white/10 transition-all cursor-pointer"
            title="Export Official PDF/CSV Compliance Audit Report"
          >
            <FileCheck className="w-3.5 h-3.5 text-reliance-cyan" />
            <span>AUDIT REPORT</span>
          </button>
        </div>

        {/* Center: Live Coordinates, Depth & Active Camera */}
        <div className="hidden xl:flex items-center gap-4 px-5 py-2 rounded-full glass-panel border border-reliance-cyan/25 text-xs font-mono">
          <button
            onClick={toggleWeatherPanel}
            className="flex items-center gap-1.5 text-amber-300 hover:text-white transition-all cursor-pointer"
            title="Click to Open KG-D6 Real-Time Weather & Marine Forecast"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold">16°18'00"N 82°20'00"E</span>
          </button>
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
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
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

      {/* ================= INCIDENT CONTROL MANAGER MODAL ================= */}
      <IncidentControlManager />

      {/* ================= ELEVENLABS VOICE CONFIG MODAL ================= */}
      <ElevenLabsConfigModal />

      {/* ================= HARDWARE LINK MODAL ================= */}
      <HardwareLinkModal />

      {/* ================= COMPLIANCE AUDIT REPORT MODAL ================= */}
      <ComplianceReportModal />

      {/* ================= KG-D6 LIVE WEATHER & MARINE FORECAST SIDE PANEL ================= */}
      <KgD6WeatherSidePanel />

      {/* ================= JARVIS FLOATING GESTURE CAMERA & VOICE HUD ================= */}
      <JarvisGestureVoiceHUD />

      {/* ================= JARVIS FULL-SCREEN PIPE 1 SLICE INSPECTION MODAL ================= */}
      <JarvisPipeSliceModal />

      {/* ================= JARVIS DEDICATED HOLOGRAPHIC PART INSPECTION DECK ================= */}
      <HolographicPartInspectionModal />

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
