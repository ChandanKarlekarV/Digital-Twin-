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
import { CriticalAnomaliesMonitor } from './components/hud/CriticalAnomaliesMonitor';
import { ColorCodeLegend } from './components/hud/ColorCodeLegend';
import { IncidentControlManager } from './components/hud/IncidentControlManager';
import { ElevenLabsConfigModal } from './components/hud/ElevenLabsConfigModal';
import { HardwareLinkModal } from './components/hud/HardwareLinkModal';
import { ComplianceReportModal } from './components/hud/ComplianceReportModal';
import { KgD6WeatherSidePanel } from './components/hud/KgD6WeatherSidePanel';
import { JarvisGestureVoiceHUD } from './components/hud/JarvisGestureVoiceHUD';
import { JarvisPipeSliceModal } from './components/hud/JarvisPipeSliceModal';
import { HolographicPartInspectionModal } from './components/hud/HolographicPartInspectionModal';
import { MidnightSettlementModal } from './components/hud/MidnightSettlementModal';
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
  const setEodModalOpen = useRigStore((s) => s.setEodModalOpen);

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

  // Dropdown States for Consolidated Top Navigation Bar
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const [isCommsDropdownOpen, setIsCommsDropdownOpen] = useState(false);

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

      {/* ================= TOP TACTICAL HUD (CLEAN & CONSOLIDATED) ================= */}
      <header className="absolute top-0 left-0 right-0 z-40 h-14 px-4 flex items-center justify-between pointer-events-none">
        {/* Far Left: Consolidated SYSTEM TOOLS / COMMAND Dropdown Menu & Quick EXPLODED VIEW */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => {
                setIsToolsDropdownOpen(!isToolsDropdownOpen);
                setIsViewDropdownOpen(false);
                setIsCommsDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/95 hover:bg-reliance-navy text-reliance-cyan transition-all shadow-cyan-glow cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-reliance-cyan animate-pulse" />
              <span className="font-extrabold tracking-wider text-xs uppercase font-mono">
                SYSTEM TOOLS
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-reliance-cyan transition-transform duration-200 ${
                  isToolsDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* System Tools Consolidated Dropdown Menu */}
            {isToolsDropdownOpen && (
              <div className="absolute top-full mt-2 left-0 w-72 rounded-2xl glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/98 p-2 shadow-dock backdrop-blur-2xl z-50 text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2.5 py-1 text-[9px] text-reliance-textMuted uppercase font-bold border-b border-white/10 mb-1 flex justify-between items-center">
                  <span>TACTICAL OPERATIONS</span>
                  <span className="text-reliance-cyan font-extrabold">[CMD]</span>
                </div>

                {/* Command Dock Toggle */}
                <button
                  onClick={() => {
                    toggleCommandDock();
                    setIsToolsDropdownOpen(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-reliance-blue/30 text-white flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-reliance-cyan" />
                  <div>
                    <div className="font-bold text-[11px]">Command Dock</div>
                    <div className="text-[9px] text-reliance-textMuted">Open main technical tools & diagnostics</div>
                  </div>
                </button>

                {/* Jarvis Exploded View */}
                <button
                  onClick={() => {
                    const nextState = !isSplitViewActive;
                    setSplitViewActive(nextState);
                    setIsToolsDropdownOpen(false);
                    if (nextState) {
                      varunaVoice.speakCustom('Exploded modular view engaged.');
                    } else {
                      varunaVoice.speakCustom('Subsea rig assembly restored.');
                    }
                  }}
                  className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer ${
                    isSplitViewActive
                      ? 'bg-amber-500/20 text-amber-200 font-bold'
                      : 'hover:bg-white/10 text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-bold text-[11px]">
                    {isSplitViewActive ? 'Assemble Subsea Rig' : 'Jarvis Split Exploded View'}
                  </div>
                  <div className="text-[9px] text-reliance-textMuted">Iron Man piece-by-piece disassembly</div>
                </div>
              </button>

              {/* Slice Pipe 1 */}
              <button
                onClick={() => {
                  setPipeSliced(!isPipeSliced);
                  setIsToolsDropdownOpen(false);
                }}
                className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2 transition-all cursor-pointer ${
                  isPipeSliced
                    ? 'bg-reliance-cyan/20 text-reliance-cyan font-bold'
                    : 'hover:bg-white/10 text-white'
                }`}
              >
                <Scissors className="w-4 h-4 text-reliance-cyan" />
                <div>
                  <div className="font-bold text-[11px]">
                    {isPipeSliced ? 'Close Cross-Section' : 'Slice Pipe 1 Cross-Section'}
                  </div>
                  <div className="text-[9px] text-reliance-textMuted">Expose internal multiphase fluid core</div>
                </div>
              </button>

              {/* Hardware Gateway */}
              <button
                onClick={() => {
                  setHardwareModalOpen(true);
                  setIsToolsDropdownOpen(false);
                }}
                className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-emerald-500/20 text-emerald-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Cpu className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-[11px]">Hardware SCADA Gateway</div>
                  <div className="text-[9px] text-emerald-400/70">Serial USB / Modbus / Live WebSocket</div>
                </div>
              </button>

              {/* 6-Month AI Production Ledger & Midnight Settlement */}
              <button
                onClick={() => {
                  setEodModalOpen(true);
                  setIsToolsDropdownOpen(false);
                }}
                className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-emerald-500/20 text-emerald-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-bold text-[11px]">6-Month AI Production Ledger</div>
                  <div className="text-[9px] text-emerald-400/70">180-Day Database & Midnight EOD Settlement</div>
                </div>
              </button>

              {/* Compliance Audit Report */}
              <button
                onClick={() => {
                  setReportModalOpen(true);
                  setIsToolsDropdownOpen(false);
                }}
                className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-white/10 text-white flex items-center gap-2 transition-all cursor-pointer"
              >
                <FileCheck className="w-4 h-4 text-reliance-cyan" />
                <div>
                  <div className="font-bold text-[11px]">Compliance Audit Report</div>
                  <div className="text-[9px] text-reliance-textMuted">Export DGH / ISO verification PDF & CSV</div>
                </div>
              </button>

              {/* Weather Panel */}
              <button
                onClick={() => {
                  toggleWeatherPanel();
                  setIsToolsDropdownOpen(false);
                }}
                className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-amber-500/20 text-amber-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Wind className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="font-bold text-[11px]">KG-D6 Weather & Metocean</div>
                  <div className="text-[9px] text-amber-400/70">Bay of Bengal marine radar forecast</div>
                </div>
              </button>

              {/* Custom Model File Load */}
              <div className="border-t border-white/10 pt-1 mt-1">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsToolsDropdownOpen(false);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-white/10 text-white/80 flex items-center justify-between text-[10px]"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-reliance-cyan" />
                    <span>Import Custom .OBJ Rig</span>
                  </span>
                  <span className="text-[8px] text-reliance-textMuted truncate max-w-[80px]">
                    {customObjFileName || 'untitled.obj'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dedicated EXPLODED VIEW Quick Button */}
        <button
          onClick={() => {
            const nextState = !isSplitViewActive;
            setSplitViewActive(nextState);
            if (nextState) {
              varunaVoice.speakCustom('Exploded modular view engaged. All subsea and topside subsystems decoupled.');
            } else {
              varunaVoice.speakCustom('Subsea rig assembly restored.');
            }
          }}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-panel border transition-all cursor-pointer font-mono text-xs font-extrabold tracking-wider uppercase ${
            isSplitViewActive
              ? 'border-amber-400 bg-amber-500/25 text-amber-300 shadow-amber-glow animate-pulse'
              : 'border-reliance-cyan/40 bg-reliance-deepnavy/95 hover:bg-reliance-navy text-white hover:text-amber-300 hover:border-amber-400/60 shadow-cyan-glow'
          }`}
          title="Toggle Exploded View to isolate and access all rig subsystems"
        >
          <Layers className={`w-3.5 h-3.5 ${isSplitViewActive ? 'text-amber-300' : 'text-amber-400'}`} />
          <span>{isSplitViewActive ? 'ASSEMBLE RIG' : 'EXPLODED VIEW'}</span>
          {isSplitViewActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping ml-0.5" />
          )}
        </button>

        {/* Dedicated 6-MONTH AI LEDGER & MIDNIGHT SETTLEMENT Quick Button */}
        <button
          onClick={() => {
            setEodModalOpen(true);
            varunaVoice.speakCustom('Opening KG-D6 6-Month AI Production Ledger and Midnight Settlement.');
          }}
          className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-panel border border-emerald-400/50 bg-reliance-deepnavy/95 hover:bg-emerald-950/40 text-emerald-300 font-mono text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer shadow-cyan-glow"
          title="Open 6-Month AI Production Ledger & 12:00 Midnight Settlement"
        >
          <Calendar className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>6-MO LEDGER &amp; EOD</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5" />
        </button>
      </div>

        {/* Center Top: Geolocation Coordinates & Active Feed Badge */}
        <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full glass-panel border border-reliance-cyan/30 bg-reliance-deepnavy/90 text-xs font-mono shadow-dock pointer-events-auto">
          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>16°19'00"N 82°20'00"E</span>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="flex items-center gap-1.5 text-reliance-cyan font-bold uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>KG-D6 SUBSEA MANIFOLD | ACTIVE FEED</span>
          </div>
          <div className="w-px h-3 bg-white/20" />
          <div className="text-reliance-textMuted text-[10px]">
            SEABED DEPTH: <strong className="text-white">-2,040 m</strong>
          </div>
        </div>

        {/* Right Side: Consolidated Dropdowns (VIEW OPTIONS & VOICE & COMMS) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* 1. VIEW OPTIONS DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => {
                setIsViewDropdownOpen(!isViewDropdownOpen);
                setIsCommsDropdownOpen(false);
                setIsToolsDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/90 hover:bg-reliance-navy text-xs font-mono text-white transition-all cursor-pointer shadow-cyan-glow"
            >
              <Eye className="w-3.5 h-3.5 text-reliance-cyan" />
              <span className="font-bold hidden sm:inline uppercase">VIEW OPTIONS</span>
              <ChevronDown
                className={`w-3 h-3 text-reliance-cyan transition-transform duration-200 ${
                  isViewDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isViewDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-52 rounded-xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/98 p-1.5 shadow-dock backdrop-blur-2xl z-50 text-xs font-mono animate-in fade-in duration-150">
                <div className="px-2 py-1 text-[9px] text-reliance-textMuted uppercase font-bold border-b border-white/10 mb-1">
                  CAMERA PERSPECTIVE
                </div>
                <button
                  onClick={() => {
                    setCameraViewMode('topside');
                    setIsViewDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between mb-0.5 ${
                    cameraViewMode === 'topside'
                      ? 'bg-reliance-blue text-white font-bold'
                      : 'hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Topside Rig</span>
                  <span className="text-[9px] opacity-60">+12m</span>
                </button>
                <button
                  onClick={() => {
                    setCameraViewMode('subsea');
                    setIsViewDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between mb-0.5 ${
                    cameraViewMode === 'subsea'
                      ? 'bg-reliance-blue text-white font-bold'
                      : 'hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Dive Subsea</span>
                  <span className="text-[9px] opacity-60">-35m</span>
                </button>
                <button
                  onClick={() => {
                    setCameraViewMode('manifold');
                    setIsViewDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between mb-0.5 ${
                    cameraViewMode === 'manifold'
                      ? 'bg-reliance-blue text-white font-bold'
                      : 'hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Seabed Manifold</span>
                  <span className="text-[9px] opacity-60">-1,020m</span>
                </button>
                <button
                  onClick={() => {
                    setCameraViewMode('drill');
                    setIsViewDropdownOpen(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between ${
                    cameraViewMode === 'drill'
                      ? 'bg-reliance-blue text-white font-bold'
                      : 'hover:bg-white/10 text-white/80'
                  }`}
                >
                  <span>Down View / Drill</span>
                  <span className="text-[9px] opacity-60">-2,040m</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. VOICE & COMMS DROPDOWN */}
          <div className="relative">
            <button
              onClick={() => {
                setIsCommsDropdownOpen(!isCommsDropdownOpen);
                setIsViewDropdownOpen(false);
                setIsToolsDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-panel border border-purple-400/40 bg-reliance-deepnavy/90 hover:bg-purple-900/30 text-xs font-mono text-purple-200 transition-all cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
              <span className="font-bold hidden sm:inline uppercase">VOICE & COMMS</span>
              <ChevronDown
                className={`w-3 h-3 text-purple-400 transition-transform duration-200 ${
                  isCommsDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isCommsDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-64 rounded-xl glass-panel border border-purple-400/50 bg-reliance-deepnavy/98 p-2 shadow-dock backdrop-blur-2xl z-50 text-xs font-mono animate-in fade-in duration-150">
                <div className="px-2 py-1 text-[9px] text-reliance-textMuted uppercase font-bold border-b border-white/10 mb-1">
                  VOICE SYNTHESIS & RECOGNITION
                </div>

                <button
                  onClick={() => {
                    jarvisVoiceCommander.toggle();
                    setIsCommsDropdownOpen(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-lg text-left hover:bg-white/10 text-white flex items-center justify-between mb-1"
                >
                  <span className="flex items-center gap-2">
                    <Mic className="w-3.5 h-3.5 text-purple-400" />
                    <span>Jarvis Listener</span>
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      isVoiceCommanderActive ? 'bg-purple-500/30 text-purple-200' : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {isVoiceCommanderActive ? 'ACTIVE' : 'MUTED'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setVoiceModalOpen(true);
                    setIsCommsDropdownOpen(false);
                  }}
                  className="w-full px-2.5 py-2 rounded-lg text-left hover:bg-purple-500/20 text-purple-200 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>ElevenLabs AI Voice</span>
                  </span>
                  <span className="text-[9px] text-reliance-textMuted">CONFIGURE</span>
                </button>
              </div>
            )}
          </div>

          {/* Varuna Voice Status Light */}
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

      {/* ================= KG-D6 LIVE WEATHER & MARINE FORECAST SIDE PANEL ================= */}
      <KgD6WeatherSidePanel />

      {/* ================= JARVIS FLOATING GESTURE CAMERA & VOICE HUD ================= */}
      <JarvisGestureVoiceHUD />

      {/* ================= JARVIS FULL-SCREEN PIPE 1 SLICE INSPECTION MODAL ================= */}
      <JarvisPipeSliceModal />

      {/* ================= JARVIS DEDICATED HOLOGRAPHIC PART INSPECTION DECK ================= */}
      <HolographicPartInspectionModal />

      {/* ================= BOTTOM-LEFT DOCK: ENVIRONMENTAL TAB & COLOR-CODE LEGEND ================= */}
      {/* Positioned at bottom-left so the entire top-left under SYSTEM TOOLS is 100% clear and unobstructed */}
      <div className="absolute bottom-10 left-4 z-30 flex items-end gap-3 pointer-events-auto max-w-[calc(100vw-360px)]">
        {/* Left Side of Cluster: Environmental Conditions & Tides and Critical Anomalies */}
        <div className="w-76 sm:w-84 flex flex-col gap-2 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-none">
          {/* Panel 1: Environmental Conditions & Tides (Bottom Left) */}
          <CurrentControlWidget />

          {/* Panel 2: Critical Anomalies Monitor */}
          <CriticalAnomaliesMonitor />
        </div>

        {/* Right Side of Cluster: Color-Code Segregation Legend (Placed on the right side of Environmental Tab) */}
        <ColorCodeLegend />
      </div>

      {/* ================= RIGHT SIDEBAR: SYSTEM TELEMETRY & PRODUCTION DATA ================= */}
      <TelemetryDrawer />

      {/* ================= INTERACTIVE PHYSICS AUDIT MODAL ================= */}
      <PhysicsAuditModal />

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
            FREQ: <strong className="text-emerald-400">50.0 Hz (20ms)</strong>
          </span>
          <span>
            FPS: <strong className={fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}>{fps}.0</strong>
          </span>
          <span className="hidden sm:inline text-emerald-300">
            6-MO DB: <strong className="text-emerald-400">180 DAYS SYNCED</strong>
          </span>
          <span className="hidden md:inline">
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

