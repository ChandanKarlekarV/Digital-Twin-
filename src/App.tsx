import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { Scene } from './components/canvas/Scene';
import { telemetryEmitter } from './physics/TelemetryEmitter';
import { useRigStore, CameraViewMode, VIEW_LAYERS } from './store/useRigStore';
import { CommandDock } from './components/hud/CommandDock';
import { TelemetryDrawer } from './components/hud/TelemetryDrawer';
import { EmergencyIncidentPanel } from './components/hud/EmergencyIncidentPanel';
import { VarunaVoiceIndicator } from './components/hud/VarunaVoiceIndicator';
import { CurrentControlWidget } from './components/hud/CurrentControlWidget';
import { CriticalAnomaliesMonitor } from './components/hud/CriticalAnomaliesMonitor';
import { IncidentControlManager } from './components/hud/IncidentControlManager';
import { KgD6WeatherSidePanel } from './components/hud/KgD6WeatherSidePanel';
import { VarunaGestureVoiceHUD } from './components/hud/VarunaGestureVoiceHUD';
import { dynamicTideEngine } from './physics/DynamicTideEngine';
import { liveFeeds, useLiveFeeds } from './services/LiveFeeds';

/*
 * Modals load on first open, so their code (KaTeX, reports, the slide deck) stays out of
 * the start-up bundle. Each is mounted only while its store flag is set.
 */
type RigState = ReturnType<typeof useRigStore.getState>;
const lazyNamed = (load: () => Promise<Record<string, unknown>>, name: string) =>
  lazy(() => load().then((m) => ({ default: m[name] as React.ComponentType })));
const LAZY_MODALS: [React.ComponentType, (s: RigState) => boolean][] = [
  [lazyNamed(() => import('./components/hud/ElevenLabsConfigModal'), 'ElevenLabsConfigModal'), (s) => s.isVoiceModalOpen],
  [lazyNamed(() => import('./components/hud/ComplianceReportModal'), 'ComplianceReportModal'), (s) => s.isReportModalOpen],
  [lazyNamed(() => import('./components/hud/MidnightSettlementModal'), 'MidnightSettlementModal'), (s) => s.isEodModalOpen],
  [lazyNamed(() => import('./components/hud/SihPresentationModal'), 'SihPresentationModal'), (s) => s.isSihModalOpen],
  [lazyNamed(() => import('./components/hud/PipeSliceModal'), 'PipeSliceModal'), (s) => s.isPipeSliceModalOpen],
  [lazyNamed(() => import('./components/hud/HolographicPartInspectionModal'), 'HolographicPartInspectionModal'), (s) => !!s.activeHoloModal],
  [lazyNamed(() => import('./components/hud/PhysicsAuditModal'), 'PhysicsAuditModal'), (s) => s.isPhysicsModalOpen],
];
const LazyModal: React.FC<{ C: React.ComponentType; open: (s: RigState) => boolean }> = ({ C, open }) =>
  useRigStore(open) ? (
    <Suspense fallback={null}>
      <C />
    </Suspense>
  ) : null;
import {
  Compass,
  Eye,
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  FolderOpen,
  FileCheck,
  FileText,
  Wind,
  Layers,
  Scissors,
  Volume2,
  Mic,
  Sliders,
  Zap,
  Calendar,
  Database,
} from 'lucide-react';
import { varunaVoice } from './voice/VarunaVoiceSynthesizer';
import { varunaVoiceCommander } from './voice/VarunaVoiceCommander';

import { telemetryDb } from './db/TelemetryDatabase';
import { sixMonthDataEngine } from './db/SixMonthDataEngine';

// Button and menu styles come from the token component classes in index.css
const hudButton = 'btn';
const hudButtonActive = 'btn-active';
const hudMenu = 'menu';

/** Camera presets with the real model depths (water line = 0 m, mudline ≈ -16 m, bit ≈ -98 m) */
const CAMERA_PRESETS: { mode: CameraViewMode; label: string; depth: string }[] = [
  { mode: 'topside', label: 'Full rig', depth: 'auto-fit' },
  { mode: 'upper_rig', label: 'Topside & derrick', depth: '+25 m' },
  { mode: 'subsea', label: 'Below the waterline', depth: '-12 m' },
  { mode: 'manifold', label: 'Seabed manifold', depth: '-16 m' },
  { mode: 'drill', label: 'Drill string & bit', depth: '-98 m' },
];

const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="menu-label">{children}</div>;

const MenuItem: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, title, hint, active, onClick }) => (
  <button onClick={onClick} aria-pressed={!!active} className="menu-item">
    <Icon className="w-4 h-4 text-accent-400 shrink-0" />
    <span>
      <span className="block text-[12px] font-medium">{title}</span>
      <span className="block text-[10px] text-ink-muted">{hint}</span>
    </span>
  </button>
);

/**
 * One vertical tab rail for the two right-hand panels. It rides on the left edge of the
 * open panel (or the screen edge when both are closed), so the tabs never overlap a panel
 * or each other.
 */
const SidePanelRail: React.FC = () => {
  const telemetryOpen = useRigStore((s) => s.isTelemetryDrawerOpen);
  const weatherOpen = useRigStore((s) => s.isWeatherPanelOpen);
  const toggleTelemetry = useRigStore((s) => s.toggleTelemetryDrawer);
  const toggleWeather = useRigStore((s) => s.toggleWeatherPanel);
  const tab = (label: string, Icon: React.ComponentType<{ className?: string }>, open: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      aria-pressed={open}
      title={open ? `Close ${label}` : `Open ${label}`}
      className={`w-8 py-3 flex flex-col items-center gap-2 rounded-l-md border border-r-0 transition-colors cursor-pointer ${
        open ? 'bg-accent-900 border-accent-500 text-accent-100' : 'bg-surface/95 border-line text-ink-muted hover:text-ink hover:bg-surface-3'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-medium tracking-wide">{label}</span>
    </button>
  );
  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 transition-[right] duration-300 ease-out"
      style={{ right: telemetryOpen || weatherOpen ? 'var(--side-panel-w)' : 0 }}
    >
      {tab('Telemetry', Database, telemetryOpen, toggleTelemetry)}
      {tab('Weather', Wind, weatherOpen, toggleWeather)}
    </div>
  );
};

/** Footer readout of the live public feeds; a dot shows each feed's state */
const LiveFeedFooter: React.FC = () => {
  const f = useLiveFeeds();
  const dot = (s: string) => (
    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${s === 'live' ? 'bg-success-400' : s === 'error' ? 'bg-danger-400' : 'bg-warning-400'}`} />
  );
  const tide = f.tide.heightM !== null ? `${f.tide.heightM.toFixed(2)} m ${f.tide.trend === 'rising' ? '↑' : '↓'}` : '—';
  const quakes = f.quakes.state === 'live' ? (f.quakes.count ? `${f.quakes.count}, max M${f.quakes.largest?.magnitude.toFixed(1)}` : 'none in 30 days') : '—';
  return (
    <div className="hidden md:flex items-center gap-4 pointer-events-auto">
      <span title={`ECB reference rate ${f.fx.date ?? ''}`}>
        {dot(f.fx.state)}USD/INR <strong className="text-ink font-medium">{f.fx.usdInr?.toFixed(2) ?? '—'}</strong>
      </span>
      <span title={f.tide.state === 'live' ? `Today ${f.tide.todayMin?.toFixed(2)}–${f.tide.todayMax?.toFixed(2)} m (Open-Meteo)` : ''}>
        {dot(f.tide.state)}Tide <strong className="text-ink font-medium">{tide}</strong>
      </span>
      <span title="USGS, M2.5+ within 1,000 km of KG-D6">
        {dot(f.quakes.state)}Quakes <strong className="text-ink font-medium">{quakes}</strong>
      </span>
    </div>
  );
};

/** Zoom and layer-by-layer view buttons (the same actions as the two-hand and thumb gestures). */
const ViewControls: React.FC<{ right: string }> = ({ right }) => {
  const nudgeZoom = useRigStore((s) => s.nudgeZoom);
  const stepLayer = useRigStore((s) => s.stepLayer);
  const mode = useRigStore((s) => s.cameraViewMode);
  const layer = VIEW_LAYERS.findIndex((l) => l.mode === mode);
  const btn = 'btn btn-icon';
  return (
    <div
      className="absolute top-16 z-30 flex flex-col items-end gap-1.5 transition-[right] duration-300"
      style={{ right }}
    >
      <div className="flex flex-col gap-1 p-1 rounded-md glass-pill">
        <button className={btn} onClick={() => nudgeZoom(0.75)} title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button className={btn} onClick={() => nudgeZoom(1.33)} title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="h-px bg-line mx-1" />
        <button className={btn} onClick={() => stepLayer(-1)} disabled={layer === 0} title="Layer up">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button className={btn} onClick={() => stepLayer(1)} disabled={layer === VIEW_LAYERS.length - 1} title="Layer down">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
      <span className="px-2 py-1 rounded-md glass-pill text-[10px] text-ink-muted whitespace-nowrap">
        {layer >= 0 ? `Layer ${layer + 1}/${VIEW_LAYERS.length} · ${VIEW_LAYERS[layer].label}` : 'Custom view'}
      </span>
    </div>
  );
};

export default function App() {
  const cameraViewMode = useRigStore((s) => s.cameraViewMode);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const toggleCommandDock = useRigStore((s) => s.toggleCommandDock);

  const toggleWeatherPanel = useRigStore((s) => s.toggleWeatherPanel);
  const setVoiceModalOpen = useRigStore((s) => s.setVoiceModalOpen);
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

  const sidePanelOpen = useRigStore((s) => s.isTelemetryDrawerOpen || s.isWeatherPanelOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fps, setFps] = useState<number>(76);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  // One top-bar menu open at a time
  const [openMenu, setOpenMenu] = useState<'tools' | 'view' | 'voice' | null>(null);
  const toggleMenu = (m: 'tools' | 'view' | 'voice') => setOpenMenu((cur) => (cur === m ? null : m));
  // Close an open menu on any click outside the top bar, or on Escape
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('header')) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenu(null);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);
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

    // 2. Start the 200 Hz physics / sensor engine
    telemetryEmitter.start();

    // 3. Start 10-second continuous dynamic tide & metocean phase cycling
    dynamicTideEngine.start();

    // 4. Live public feeds (ECB FX, tide, USGS earthquakes); re-price the ledger when FX arrives
    liveFeeds.start();
    let fxDate: string | null = null;
    const unsubFx = liveFeeds.subscribe(() => {
      const fx = liveFeeds.getStatus().fx;
      if (fx.state === 'live' && fx.date !== fxDate) {
        fxDate = fx.date;
        sixMonthDataEngine.applyFx();
      }
    });

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
      liveFeeds.stop();
      unsubFx();
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
<header className="absolute top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between gap-3 pointer-events-none">
        {/* Left: brand, tools menu, exploded-view toggle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="hidden md:flex items-center gap-2 pr-3 mr-1 border-r border-line">
            <span className="w-2 h-2 rounded-full bg-accent-400" />
            <span className="text-sm font-semibold tracking-wide text-ink">VARUNA</span>
            <span className="hidden 2xl:inline text-[11px] text-ink-muted whitespace-nowrap">KG-D6 Digital Twin</span>
          </div>

          <div className="relative">
            <button
              onClick={() => toggleMenu('tools')}
              className={`${hudButton} ${openMenu === 'tools' ? hudButtonActive : ''}`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Tools</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'tools' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'tools' && (
              <div className={`${hudMenu} left-0 w-72`}>
                <MenuLabel>Operations</MenuLabel>
                <MenuItem icon={Zap} title="Command Dock" hint="Diagnostics, incident drills and sensors" onClick={() => runMenu(toggleCommandDock)} />
                <MenuItem icon={Scissors} title={isPipeSliced ? 'Close Pipe 1 Section' : 'Slice Pipe 1'} hint="Cross-section of the oil, gas and water flow" active={isPipeSliced} onClick={() => runMenu(() => setPipeSliced(!isPipeSliced))} />
                <MenuItem icon={Wind} title="Weather & Sea State" hint="Live Open-Meteo forecast for the block" onClick={() => runMenu(toggleWeatherPanel)} />
                <MenuLabel>Data & Reports</MenuLabel>
                <MenuItem icon={Calendar} title="Production Ledger" hint="180-day history and daily settlement" onClick={() => runMenu(() => setEodModalOpen(true))} />
                <MenuItem icon={FileCheck} title="Compliance Report" hint="DGH / ISO audit, export as PDF or CSV" onClick={() => runMenu(() => setReportModalOpen(true))} />
                <MenuItem icon={FileText} title="Presentation" hint="Deck for the Governor of Maharashtra" onClick={() => runMenu(() => setSihModalOpen(true))} />
                <div className="border-t border-line mt-1 pt-1">
                  <button
                    onClick={() => runMenu(() => fileInputRef.current?.click())}
                    className="menu-item justify-between text-[11px]"
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5 text-accent-400" />
                      Import .OBJ model
                    </span>
                    <span className="text-[10px] text-ink-muted truncate max-w-[110px]">{customObjFileName}</span>
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
            <span>{isSplitViewActive ? 'Assemble' : 'Exploded view'}</span>
          </button>
        </div>

        {/* Centre: site & feed status */}
        <div className="hidden xl:flex items-center gap-3 h-8 px-3 rounded-md glass-pill text-[11px] pointer-events-auto">
          <span className="flex items-center gap-1.5 text-ink-muted">
            <Compass className="w-3.5 h-3.5 text-accent-400" />
            16°19′N 82°20′E
          </span>
          <span className="w-px h-3 bg-line" />
          <span className="flex items-center gap-1.5 text-success-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
            Live
          </span>
          <span className="w-px h-3 bg-line" />
          <span className="text-ink-muted">
            Asset <strong className="text-ink font-medium">{selectedAssetId || 'KG-D6 main'}</strong>
          </span>
        </div>

        {/* Right: camera, voice */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <button onClick={() => toggleMenu('view')} className={`${hudButton} ${openMenu === 'view' ? hudButtonActive : ''}`}>
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Camera</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${openMenu === 'view' ? 'rotate-180' : ''}`} />
            </button>
            {openMenu === 'view' && (
              <div className={`${hudMenu} right-0 w-56`}>
                <MenuLabel>Camera</MenuLabel>
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset.mode}
                    onClick={() => runMenu(() => setCameraViewMode(preset.mode))}
                    aria-pressed={cameraViewMode === preset.mode}
                    className="menu-item justify-between text-[12px]"
                  >
                    <span>{preset.label}</span>
                    <span className="text-[10px] text-ink-muted">{preset.depth}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => toggleMenu('voice')} className={`${hudButton} ${openMenu === 'voice' ? hudButtonActive : ''}`}>
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice</span>
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
                  onClick={() => runMenu(() => varunaVoiceCommander.toggle())}
                />
                <MenuItem icon={Volume2} title="Voice quality" hint="Optional ElevenLabs studio voice" onClick={() => runMenu(() => setVoiceModalOpen(true))} />
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

      {/* Voice config, compliance, ledger, deck, pipe slice, part inspection, physics audit */}
      {LAZY_MODALS.map(([C, open], i) => (
        <LazyModal key={i} C={C} open={open} />
      ))}

      {/* KG-D6 live weather & marine side panel */}
      <KgD6WeatherSidePanel />

      {/* Bottom-left dock: sea conditions, anomalies, gesture/voice. Its right edge stops
          before the side panel, so nothing slides underneath it. */}
      <div
        className="absolute bottom-10 left-4 top-16 z-30 flex flex-wrap items-end content-end gap-3 pointer-events-none transition-[right] duration-300"
        style={{ right: sidePanelOpen ? 'calc(var(--side-panel-w) + 40px)' : '56px' }}
      >
        <div className="w-80 flex flex-col gap-2 max-h-full overflow-y-auto scrollbar-none pointer-events-auto">
          {/* Panel 1: Environmental Conditions & Tides (Bottom Left) */}
          <CurrentControlWidget />

          {/* Panel 2: Critical Anomalies Monitor */}
          <CriticalAnomaliesMonitor />
        </div>

        <div className="pointer-events-auto">
          <VarunaGestureVoiceHUD />
        </div>
      </div>

      <SidePanelRail />
      <ViewControls right={sidePanelOpen ? 'calc(var(--side-panel-w) + 48px)' : '48px'} />

      {/* ================= RIGHT SIDEBAR: SYSTEM TELEMETRY & PRODUCTION DATA ================= */}
      <TelemetryDrawer />

      {/* ================= 3D VIEWPORT (Occupies 100% of Screen) ================= */}
      <main id="canvas-container" className="relative w-full h-full flex-1 overflow-hidden">
        <Scene />
      </main>

      {/* ================= BOTTOM STATUS FOOTER ================= */}
      <footer className="absolute bottom-0 left-0 right-0 z-30 h-8 px-4 flex items-center justify-between glass-pill border-x-0 border-b-0 text-[11px] text-ink-muted pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <span>
            Asset <strong className="text-ink font-medium">{selectedAssetId || 'KG-D6 main'}</strong>
          </span>
          <span>
            Physics <strong className="text-ink font-medium">200 Hz</strong>
          </span>
          <span>
            Frame rate <strong className={fps >= 50 ? 'text-success-300 font-medium' : 'text-warning-300 font-medium'}>{fps} fps</strong>
          </span>
          <span className="hidden sm:inline">
            History <strong className="text-ink font-medium">180 days</strong>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <LiveFeedFooter />
        </div>
      </footer>
    </div>
  );
}

