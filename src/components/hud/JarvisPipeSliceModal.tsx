import React, { useState } from 'react';
import {
  X,
  Activity,
  Layers,
  Zap,
  ShieldCheck,
  Thermometer,
  Gauge,
  Droplets,
  Radio,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Scan,
  Sparkles,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const JarvisPipeSliceModal: React.FC = () => {
  const isPipeSliceModalOpen = useRigStore((s) => s.isPipeSliceModalOpen);
  const setPipeSliceModalOpen = useRigStore((s) => s.setPipeSliceModalOpen);
  const setPipeSliced = useRigStore((s) => s.setPipeSliced);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeHydraulicResult = useTelemetryStore((s) => s.activeHydraulicResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);

  const [activeLayer, setActiveLayer] = useState<'all' | 'steel' | 'fluid' | 'fiber'>('all');
  const [isNdtScanning, setIsNdtScanning] = useState(false);
  const [isMegInjected, setIsMegInjected] = useState(false);

  if (!isPipeSliceModalOpen) return null;

  const handleNdtScan = () => {
    setIsNdtScanning(true);
    varunaVoice.playSonarPing(880, 0.15);
    varunaVoice.speakCustom('Executing non-destructive ultrasonic pulse-echo wall inspection. Wall thickness 18.4 millimeters verified.');
    setTimeout(() => setIsNdtScanning(false), 2400);
  };

  const handleInjectMeg = () => {
    setIsMegInjected(true);
    varunaVoice.speakCustom('Subsea chemical injection skid engaged. Dosing 15 liters per minute Monoethylene Glycol into gathering header.');
    setTimeout(() => setIsMegInjected(false), 4000);
  };

  const handleClose = () => {
    setPipeSliceModalOpen(false);
    setPipeSliced(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-reliance-dark/90 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-5xl h-[90vh] glass-panel-alert border-2 border-reliance-cyan/60 bg-reliance-deepnavy/98 rounded-3xl shadow-cyan-glow flex flex-col overflow-hidden text-white font-sans">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-reliance-cyan/30 bg-reliance-blue/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/40 animate-pulse">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-reliance-cyan bg-reliance-cyan/20 px-2 py-0.5 rounded border border-reliance-cyan/40">
                  JARVIS HOLOGRAPHIC DISSECTION
                </span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  AXIAL CUT ACTIVE
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-white mt-0.5 font-mono">
                PIPE 1 • SCR PRODUCTION RISER ALPHA LONGITUDINAL CROSS-SECTION
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-reliance-navy/80 hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer border border-white/15"
              title="Close Fullscreen Dissection"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto">
          {/* Left / Center 7 Cols: Holographic Interactive Cut-Section Visualizer */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* Visual Cross-Section Dissection Diagram */}
            <div className="relative flex-1 min-h-[300px] rounded-2xl bg-black/60 border border-reliance-cyan/40 p-4 flex flex-col justify-between overflow-hidden shadow-inner">
              {/* Holographic Grid Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#00ffff0d_1px,transparent_1px),linear-gradient(to_bottom,#00ffff0d_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

              {/* Top HUD Header */}
              <div className="relative z-10 flex items-center justify-between text-xs font-mono">
                <span className="text-reliance-cyan font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-reliance-cyan" />
                  <span>LONGITUDINAL WALL & FLUID CORE PROFILE</span>
                </span>
                <span className="text-[10px] text-reliance-textMuted bg-reliance-navy/80 px-2 py-0.5 rounded border border-white/10">
                  SCALE: 1:1 RADIAL
                </span>
              </div>

              {/* Interactive Multi-Layer Cut Diagram Graphic */}
              <div className="relative z-10 my-auto py-6 flex flex-col items-center justify-center">
                {/* Outer Pipe Shell Layer */}
                <div
                  className={`relative w-full max-w-md h-28 rounded-2xl border-4 transition-all duration-300 flex items-center justify-center p-3 shadow-dock ${
                    activeLayer === 'steel' || activeLayer === 'all'
                      ? 'border-reliance-cyan bg-reliance-navy/80 shadow-cyan-glow'
                      : 'border-white/20 bg-black/40 opacity-40'
                  }`}
                >
                  {/* Outer Steel Label */}
                  <span className="absolute -top-3 left-4 text-[9px] font-mono font-bold bg-reliance-deepnavy border border-reliance-cyan/60 px-2 py-0.5 rounded text-reliance-cyan">
                    OUTER WALL: ASTM A106 CARBON STEEL (18.4 mm)
                  </span>

                  {/* Optical DTS Sensor Strip */}
                  <div
                    className={`absolute top-1 left-4 right-4 h-1.5 rounded-full transition-all ${
                      activeLayer === 'fiber' || activeLayer === 'all'
                        ? 'bg-rose-500 shadow-red-glow animate-pulse'
                        : 'bg-white/20'
                    }`}
                  >
                    <span className="absolute right-0 -top-4 text-[8px] font-mono text-rose-400 font-bold">
                      DTS / DAS FIBER (10 Hz ACOUSTIC)
                    </span>
                  </div>

                  {/* Inner Fluid Streamline Core */}
                  <div
                    className={`w-full h-16 rounded-xl border-2 transition-all flex items-center justify-between px-4 relative overflow-hidden ${
                      activeLayer === 'fluid' || activeLayer === 'all'
                        ? 'border-emerald-400/80 bg-gradient-to-r from-emerald-500/30 via-cyan-500/30 to-emerald-500/30 shadow-emerald-glow'
                        : 'border-white/10 bg-transparent'
                    }`}
                  >
                    {/* Animated Multiphase Fluid Arrows */}
                    <div className="absolute inset-0 flex items-center justify-around opacity-60">
                      <div className="w-8 h-1 bg-cyan-400 rounded-full animate-ping" />
                      <div className="w-12 h-1 bg-emerald-400 rounded-full animate-pulse" />
                      <div className="w-10 h-1 bg-amber-400 rounded-full animate-ping" />
                      <div className="w-14 h-1 bg-cyan-400 rounded-full animate-pulse" />
                    </div>

                    <div className="relative z-10 font-mono text-[10px] text-emerald-300 font-bold">
                      MULTIPHASE CORE (CRUDE + GAS SLUGS)
                    </div>
                    <div className="relative z-10 font-mono text-[10px] text-reliance-cyan font-bold">
                      {activeHydraulicResult?.flowVelocityMS.toFixed(2) || '2.40'} m/s • {Math.round(activeMultiphaseResult?.net_oil_bpd || 31469).toLocaleString()} BPD
                    </div>
                  </div>
                </div>

                {/* Ultrasonic Scanner Beam (when NDT scanning) */}
                {isNdtScanning && (
                  <div className="w-full max-w-md h-1 bg-reliance-cyan shadow-cyan-glow mt-2 animate-bounce" />
                )}
              </div>

              {/* Layer Toggles Filter */}
              <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/10 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-reliance-textMuted mr-1">LAYERS:</span>
                  {(['all', 'steel', 'fluid', 'fiber'] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setActiveLayer(l)}
                      className={`px-2 py-1 rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer ${
                        activeLayer === l
                          ? 'bg-reliance-cyan text-reliance-dark shadow-cyan-glow'
                          : 'bg-reliance-navy/60 text-reliance-textMuted hover:text-white border border-white/10'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <div className="text-[10px] text-emerald-400 font-bold">
                  INTEGRITY: 99.8% NOMINAL
                </div>
              </div>
            </div>

            {/* Quick Action Skid Controls */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <button
                onClick={handleNdtScan}
                className="py-2.5 px-3 rounded-xl bg-reliance-blue/80 hover:bg-reliance-blue border border-reliance-cyan text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-cyan-glow"
              >
                <Scan className="w-4 h-4 text-reliance-cyan" />
                <span>{isNdtScanning ? 'SCANNING ULTRASONIC...' : 'ULTRASONIC NDT SCAN'}</span>
              </button>

              <button
                onClick={handleInjectMeg}
                className="py-2.5 px-3 rounded-xl bg-purple-600/60 hover:bg-purple-600 border border-purple-400 text-white font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-purple-glow"
              >
                <Sparkles className="w-4 h-4 text-purple-300" />
                <span>{isMegInjected ? 'DOSING MEG INJECTED...' : 'INJECT ANTI-HYDRATE MEG'}</span>
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Live Radial Telemetry & Physical Metrics */}
          <div className="lg:col-span-5 flex flex-col space-y-3 font-mono">
            {/* Wall Thickness & Metallurgical Specs */}
            <div className="p-3 rounded-2xl bg-reliance-navy/60 border border-reliance-cyan/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-reliance-cyan font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>METALLURGY & WALL SPECS</span>
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                  API 5L X65
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">OUTER DIAMETER</div>
                  <div className="text-sm font-extrabold text-white">355.6 mm (14")</div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">WALL THICKNESS</div>
                  <div className="text-sm font-extrabold text-reliance-cyan">18.40 mm</div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">DESIGN BURST LIMIT</div>
                  <div className="text-sm font-extrabold text-white">480 bar (6,960 psi)</div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">CORROSION ALLOWANCE</div>
                  <div className="text-sm font-extrabold text-emerald-400">3.0 mm (0.02 used)</div>
                </div>
              </div>
            </div>

            {/* Fluid Dynamics & Darcy-Weisbach Hydraulics */}
            <div className="p-3 rounded-2xl bg-reliance-navy/60 border border-emerald-400/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>INTERNAL FLUID VELOCITY & ΔP</span>
                </span>
                <span className="text-[9px] text-reliance-textMuted">
                  Re: {activeHydraulicResult?.reynoldsNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">FLOW VELOCITY</div>
                  <div className="text-sm font-extrabold text-white">
                    {activeHydraulicResult?.flowVelocityMS.toFixed(3)} m/s
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">DIFFERENTIAL ΔP</div>
                  <div className="text-sm font-extrabold text-amber-300">
                    {activeHydraulicResult?.pressureDropBar.toFixed(2)} bar
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">DYNAMIC VISCOSITY</div>
                  <div className="text-sm font-extrabold text-white">14.8 cP (0.0148 Pa·s)</div>
                </div>
                <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10">
                  <div className="text-[9px] text-reliance-textMuted">WATER-CUT RATIO</div>
                  <div className="text-sm font-extrabold text-cyan-300">
                    {activeMultiphaseResult?.water_cut_percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>

            {/* DTS Distributed Thermal Profile */}
            <div className="p-3 rounded-2xl bg-reliance-navy/60 border border-purple-400/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-purple-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-purple-400" />
                  <span>OPTICAL FIBER DTS / DAS TRACES</span>
                </span>
                <span className="text-[9px] text-emerald-400 font-bold">10 Hz LIVE</span>
              </div>

              <div className="p-2 rounded-xl bg-reliance-dark/80 border border-white/10 text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-reliance-textMuted">HANG-OFF TEMP (+12m):</span>
                  <span className="text-white font-bold">{currentRecord?.t_line_c.toFixed(1)}°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-reliance-textMuted">MID-WATER TEMP (-45m):</span>
                  <span className="text-white font-bold">18.2°C</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-reliance-textMuted">SEABED TOUCHDOWN (-118m):</span>
                  <span className="text-white font-bold">5.8°C</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
