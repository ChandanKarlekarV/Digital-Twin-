import React, { useEffect, useState, useRef } from 'react';
import { Scene } from './components/canvas/Scene';
import { telemetryEmitter } from './physics/TelemetryEmitter';
import { useRigStore, CameraViewMode } from './store/useRigStore';
import { CommandDock } from './components/hud/CommandDock';
import { TelemetryDrawer } from './components/hud/TelemetryDrawer';
import { PhysicsAuditModal } from './components/hud/PhysicsAuditModal';
import { EmergencyIncidentPanel } from './components/hud/EmergencyIncidentPanel';
import { VarunaVoiceIndicator } from './components/hud/VarunaVoiceIndicator';
import { CurrentControlWidget } from './components/hud/CurrentControlWidget';
import { CriticalAnomaliesMonitor } from './components/hud/CriticalAnomaliesMonitor';
import { IncidentControlManager } from './components/hud/IncidentControlManager';
import { ElevenLabsConfigModal } from './components/hud/ElevenLabsConfigModal';
import { HardwareLinkModal } from './components/hud/HardwareLinkModal';
import { ComplianceReportModal } from './components/hud/ComplianceReportModal';
import { KgD6WeatherSidePanel } from './components/hud/KgD6WeatherSidePanel';
import { JarvisGestureVoiceHUD } from './components/hud/JarvisGestureVoiceHUD';
import { JarvisPipeSliceModal } from './components/hud/JarvisPipeSliceModal';
import { HolographicPartInspectionModal } from './components/hud/HolographicPartInspectionModal';
import { MidnightSettlementModal } from './components/hud/MidnightSettlementModal';
import { SihPresentationModal } from './components/hud/SihPresentationModal';
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
  FileText,
  Wind,
  Layers,
  Scissors,
  Video,
  Volume2,
  Mic,
  Sliders,
  RotateCcw,
  Zap,
  Calendar,
  Database,
} from 'lucide-react';
import { varunaVoice } from './voice/VarunaVoiceSynthesizer';
import { jarvisVoiceCommander } from './voice/JarvisVoiceCommander';

import { telemetryDb } from './db/TelemetryDatabase';
import { sixMonthDataEngine } from './db/SixMonthDataEngine';

const hudButton =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel border border-reliance-cyan/30 text-[11px] font-mono font-bold tracking-wider text-white/90 hover:text-white hover:border-reliance-cyan/70 transition-colors cursor-pointer';
const hudButtonActive = 'border-reliance-cyan bg-reliance-cyan/15 text-reliance-cyan';
const hudMenu =
  'absolute top-full mt-2 rounded-2xl glass-panel border border-reliance-cyan/30 p-1.5 shadow-dock z-50 text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-150';

/** Camera presets with the real model depths (water line = 0 m, mudline ≈ -16 m, bit ≈ -98 m) */
const CAMERA_PRESETS: { mode: CameraViewMode; label: string; depth: string }[] = [
  { mode: 'topside', label: 'Full rig', depth: 'auto-fit' },
  { mode: 'upper_rig', label: 'Topside & derrick', depth: '+25 m' },
  { mode: 'subsea', label: 'Below the waterline', depth: '-12 m' },
  { mode: 'manifold', label: 'Seabed manifold', depth: '-16 m' },
  { mode: 'drill', label: 'Drill string & bit', depth: '-98 m' },
];

const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-2.5 pt-1.5 pb-1 text-[9px] uppercase tracking-widest text-reliance-textMuted font-bold">{children}</div>
);

const MenuItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, title, hint, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
      active ? 'bg-reliance-cyan/15 text-white' : 'hover:bg-white/10 text-white/90'
    }`}
  >
    <Icon className="w-4 h-4 text-reliance-cyan shrink-0" />
    <span>
      <span className="block text-[11px] font-bold">{title}</span>
      <span className="block text-[9px] text-reliance-textMuted">{hint}</span>
    </span>
  </button>
);

export default function App() {
  const cameraViewMode = useRigStore((s) => s.cameraViewMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const scannerMode = useRigStore((s) => s.scannerMode);
  const isCommandDockOpen = useRigStore((s) => s.isCommandDockOpen);
  const toggleCommandDock = useRigStore((s) => s.toggleCommandDock);

  const toggleIncidentModal = useRigStore((s) => s.toggleIncidentModal);
  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);
  const setVoiceModalOpen = useRigStore((s) => s.setVoiceModalOpen);
  const setHardwareModalOpen = useRigStore((s) => s.setHardwareModalOpen);
  const setReportModalOpen = useRigStore((s) => s.setReportModalOpen);
  const setEodModalOpen = useRigStore((s) => s.setEodModalOpen);
  const setSihModalOpen = useRigStore((s) => s.setSihModalOpen);

  const isSplitViewActive = useRigStore((s) => s.isSplitViewActive);
  const setSplitViewActive = useRigStore((s) => s.setSplitViewActive);
  const isPipeSliced = useRigStore((s) => s.isPipeSliced);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);
  const isVoiceCommanderActive = useRigStore((s) => s.isVoiceCommanderActive);

  const customObjFileName = useRigStore((s) => s.customObjFileName);
  const setCustomObjUrl = useRigStore((s) => s.setCustomObjUrl);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fps, setFps] = useState<number>(76);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  // One top-bar menu open at a time
  const [openMenu, setOpenMenu] = useState<'tools' | 'view' | 'voice' | null>(null);
  const toggleMenu = (m: 'tools' | 'view' | 'voice') => setOpenMenu((cur) => (cur === m ? null : m));
  const runMenu = (action: () => void) => {
    action();
    setOpenMenu(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomObjUrl(url, file.name);
      varunaVoice.speakDiagnostic('TOPSIDE-DRILL-RIG');
    }
  };

  useEffect(() => {
    // 1. Immediately seed 6-month & 5-week historical production databases
    sixMonthDataEngine.generateSixMonthHistory();
    telemetryDb.seedSixMonthHistory().catch(console.error);

    // 2. Start the 50.0 Hz physical sensor engine
    telemetryEmitter.start();

    // 3. Start 10-second continuous dynamic tide & metocean phase cycling
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

      {/* ================= TOP BAR ================= */}
<header className="absolute top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between gap-3 pointer-events-none">
        {/* Left: brand, tools menu, exploded-view toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="hidden md:flex items-center gap-2 pr-2 mr-1 border-r border-reliance-cyan/20">
            <span className="w-2 h-2 rounded-full bg-reliance-cyan animate-pulse" />
            <span className="font-mono text-xs font-extrabold tracking-[0.2em] text-reliance-cyan">VARUNA</span>
            <span className="font-mono text-[10px] text-reliance-textMuted">KG-D6 TWIN</span>
          </div>

          <div className="relative">
            <button
              onClick={() => toggleMenu('tools')}
              className={`${hudButton} ${openMenu === 'tools' ? hudButtonActive : ''}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>TOOLS</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'tools' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'tools' && (
              <div className={`${hudMenu} left-0 w-72`}>
                <MenuLabel>Operations</MenuLabel>
                <MenuItem icon={Zap} title="Command Dock" hint="Diagnostics, scenarios & sensors" onClick={() => runMenu(toggleCommandDock)} />
                <MenuItem icon={Scissors} title={isPipeSliced ? 'Close Pipe 1 Section' : 'Slice Pipe 1'} hint="Cut-away of the multiphase core" active={isPipeSliced} onClick={() => runMenu(() => setPipeSliced(!isPipeSliced))} />
                <MenuItem icon={Cpu} title="Hardware SCADA Gateway" hint="Serial, Modbus & WebSocket links" onClick={() => runMenu(() => setHardwareModalOpen(true))} />
                <MenuItem icon={Wind} title="KG-D6 Weather & Metocean" hint="Bay of Bengal marine forecast" onClick={() => runMenu(toggleWeatherPanel)} />
                <MenuLabel>Data & Reports</MenuLabel>
                <MenuItem icon={Calendar} title="6-Month Production Ledger" hint="180-day database & midnight settlement" onClick={() => runMenu(() => setEodModalOpen(true))} />
                <MenuItem icon={FileCheck} title="Compliance Audit Report" hint="DGH / ISO export, PDF & CSV" onClick={() => runMenu(() => setReportModalOpen(true))} />
                <MenuItem icon={FileText} title="SIH Presentation Deck" hint="6-slide deck & video demo" onClick={() => runMenu(() => setSihModalOpen(true))} />
                <div className="border-t border-white/10 mt-1 pt-1">
                  <button
                    onClick={() => runMenu(() => fileInputRef.current?.click())}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 text-white/80 flex items-center justify-between text-[10px]"
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-reliance-cyan" />
                      Import .OBJ model
                    </span>
                    <span className="text-[9px] text-reliance-textMuted truncate max-w-[110px]">{customObjFileName}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setSplitViewActive(!isSplitViewActive)}
            className={`${hudButton} ${isSplitViewActive ? hudButtonActive : ''}`}
            title="Split the rig into its sub-assemblies"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isSplitViewActive ? 'ASSEMBLE' : 'EXPLODE'}</span>
          </button>
        </div>

        {/* Centre: site & feed status */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full glass-panel border border-reliance-cyan/25 text-[10px] font-mono pointer-events-auto">
          <span className="flex items-center gap-1.5 text-white/90">
            <Compass className="w-3.5 h-3.5 text-reliance-cyan" />
            16°19′N 82°20′E
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="flex items-center gap-1.5 text-reliance-cyan font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-reliance-cyan animate-ping" />
            LIVE FEED
          </span>
          <span className="w-px h-3 bg-white/20" />
          <span className="text-reliance-textMuted">
            TARGET <strong className="text-white">{selectedAssetId || 'KG-D6 MAIN'}</strong>
          </span>
        </div>

        {/* Right: camera, voice */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <button onClick={() => toggleMenu('view')} className={`${hudButton} ${openMenu === 'view' ? hudButtonActive : ''}`}>
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">VIEW</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'view' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'view' && (
              <div className={`${hudMenu} right-0 w-56`}>
                <MenuLabel>Camera</MenuLabel>
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset.mode}
                    onClick={() => runMenu(() => setCameraViewMode(preset.mode))}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between text-[11px] transition-colors ${
                      cameraViewMode === preset.mode ? 'bg-reliance-cyan/20 text-white font-bold' : 'hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <span>{preset.label}</span>
                    <span className="text-[9px] text-reliance-textMuted">{preset.depth}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => toggleMenu('voice')} className={`${hudButton} ${openMenu === 'voice' ? hudButtonActive : ''}`}>
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">VOICE</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'voice' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'voice' && (
              <div className={`${hudMenu} right-0 w-60`}>
                <MenuLabel>Voice assistant</MenuLabel>
                <MenuItem
                  icon={Mic}
                  title="Voice listener"
                  hint={isVoiceCommanderActive ? 'Listening for “Varuna”' : 'Muted'}
                  active={isVoiceCommanderActive}
                  onClick={() => runMenu(() => jarvisVoiceCommander.toggle())}
                />
                <MenuItem icon={Volume2} title="ElevenLabs voice" hint="Use a studio-quality voice" onClick={() => runMenu(() => setVoiceModalOpen(true))} />
              </div>
            )}
          </div>

          <VarunaVoiceIndicator />
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

      {/* ================= 6-MONTH AI PRODUCTION LEDGER & MIDNIGHT SETTLEMENT MODAL ================= */}
      <MidnightSettlementModal />

      {/* ================= SIH 6-PAGE PRESENTATION & VIDEO DEMO MODAL ================= */}
      <SihPresentationModal />

      {/* ================= KG-D6 LIVE WEATHER & MARINE FORECAST SIDE PANEL ================= */}
      <KgD6WeatherSidePanel />

      {/* ================= JARVIS FULL-SCREEN PIPE 1 SLICE INSPECTION MODAL ================= */}
      <JarvisPipeSliceModal />

      {/* ================= JARVIS DEDICATED HOLOGRAPHIC PART INSPECTION DECK ================= */}
      <HolographicPartInspectionModal />

      {/* ================= BOTTOM-LEFT DOCK: ENVIRONMENT, ANOMALIES & GESTURE/VOICE ================= */}
      {/* Positioned at bottom-left so the entire top-left under SYSTEM TOOLS is 100% clear and unobstructed */}
      <div className="absolute bottom-10 left-4 z-30 flex items-end gap-3 pointer-events-auto max-w-[calc(100vw-360px)]">
        {/* Left Side of Cluster: Environmental Conditions & Tides and Critical Anomalies */}
        <div className="w-76 sm:w-84 flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none">
          {/* Panel 1: Environmental Conditions & Tides (Bottom Left) */}
          <CurrentControlWidget />

          {/* Panel 2: Critical Anomalies Monitor */}
          <CriticalAnomaliesMonitor />
        </div>

        {/* Right of Cluster: Jarvis Gesture Camera & Varuna Voice HUD */}
        <JarvisGestureVoiceHUD />
      </div>

      {/* ================= RIGHT SIDEBAR: SYSTEM TELEMETRY & PRODUCTION DATA ================= */}
      <TelemetryDrawer />

      {/* ================= INTERACTIVE PHYSICS AUDIT MODAL ================= */}
      <PhysicsAuditModal />

      {/* ================= 3D VIEWPORT (Occupies 100% of Screen) ================= */}
      <main id="canvas-container" className="relative w-full h-full flex-1 overflow-hidden">
        <Scene />
      </main>

      {/* ================= BOTTOM STATUS FOOTER ================= */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 h-8 px-4 flex items-center justify-between glass-pill border-t border-reliance-cyan/15 text-[11px] font-mono text-reliance-textMuted pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <span>
            TARGET: <strong className="text-reliance-cyan">{selectedAssetId || 'KG-D6 MAIN'}</strong>
          </span>
          <span>
            FREQ: <strong className="text-reliance-cyan">50.0 Hz (20ms)</strong>
          </span>
          <span>
            FPS: <strong className={fps >= 55 ? 'text-reliance-cyan' : 'text-white'}>{fps}.0</strong>
          </span>
          <span className="hidden sm:inline">
            6-MO DB: <strong className="text-reliance-cyan">180 DAYS SYNCED</strong>
          </span>
          <span className="hidden md:inline">
            GPU RASTER: <strong className="text-white">HARDWARE ACCEL</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-reliance-textMuted/70">RELIANCE OFFSHORE CYBER-PHYSICAL SUITE</span>
          <span className="w-2 h-2 rounded-full bg-reliance-cyan animate-pulse" />
        </div>
      </footer>
    </div>
  );
}

