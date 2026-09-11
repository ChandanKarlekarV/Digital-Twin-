import React, { useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Activity,
  Gauge,
  Thermometer,
  Droplets,
  Layers,
  Waves,
  Zap,
  FileCode,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const TelemetryDrawer: React.FC = () => {
  const isTelemetryDrawerOpen = useRigStore((s) => s.isTelemetryDrawerOpen);
  const toggleTelemetryDrawer = useRigStore((s) => s.toggleTelemetryDrawer);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const togglePhysicsModal = useRigStore((s) => s.togglePhysicsModal);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const rawRecord = useTelemetryStore((s) => s.rawRecord);
  const kalmanRecord = useTelemetryStore((s) => s.kalmanRecord);
  const displayFilterMode = useTelemetryStore((s) => s.displayFilterMode);
  const setDisplayFilterMode = useTelemetryStore((s) => s.setDisplayFilterMode);
  const historyBuffer = useTelemetryStore((s) => s.historyBuffer);

  const assetInfo = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;

  // Compute SVG Sparkline paths for recent 40 ticks
  const sparklines = useMemo(() => {
    if (historyBuffer.length < 2) return { pressure: '', frequency: '', flow: '' };

    const samples = historyBuffer.slice(-40);
    const width = 160;
    const height = 32;

    const buildPath = (values: number[], min: number, max: number) => {
      const range = max - min || 1;
      return values
        .map((v, i) => {
          const x = (i / (values.length - 1)) * width;
          const y = height - ((v - min) / range) * (height - 6) - 3;
          return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    };

    const pVals = samples.map((s) => s.p_line_bar);
    const fVals = samples.map((s) => s.f_osc_hz);
    const bpdVals = samples.map((s) => s.net_oil_bpd);

    return {
      pressure: buildPath(pVals, Math.min(...pVals) - 2, Math.max(...pVals) + 2),
      frequency: buildPath(fVals, Math.min(...fVals) - 5, Math.max(...fVals) + 5),
      flow: buildPath(bpdVals, Math.min(...bpdVals) - 500, Math.max(...bpdVals) + 500),
    };
  }, [historyBuffer]);

  return (
    <div
      className={`fixed top-14 bottom-8 right-0 z-40 flex transition-transform duration-300 ease-out ${
        isTelemetryDrawerOpen ? 'translate-x-0' : 'translate-x-[calc(100%-24px)]'
      }`}
    >
      {/* Retracted Neon Blue Trigger Edge */}
      <button
        onClick={toggleTelemetryDrawer}
        className="w-6 h-36 my-auto -ml-3 rounded-l-xl glass-panel border-y border-l border-reliance-cyan/60 bg-reliance-deepnavy/95 text-reliance-cyan hover:bg-reliance-navy transition-all flex flex-col items-center justify-center gap-2 shadow-cyan-glow cursor-pointer"
        title={isTelemetryDrawerOpen ? 'Retract Telemetry Drawer' : 'Expand Telemetry Drawer'}
      >
        {isTelemetryDrawerOpen ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4 animate-pulse" />
        )}
        <span className="[writing-mode:vertical-lr] text-[9px] font-mono font-bold tracking-widest text-reliance-cyan uppercase rotate-180">
          TELEMETRY
        </span>
      </button>

      {/* Main Slide-out Panel */}
      <div className="w-84 sm:w-96 h-full glass-panel border-l border-reliance-cyan/40 bg-reliance-deepnavy/95 p-4 shadow-dock text-white font-sans backdrop-blur-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-reliance-cyan/20 pb-3 mb-3 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-cyan font-bold uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>LIVE MPFM TELEMETRY (10 Hz)</span>
            </div>
            <h2 className="text-sm font-extrabold text-white truncate max-w-[240px]">
              {assetInfo?.name || selectedAssetId || 'KG-D6 Network'}
            </h2>
          </div>
          <button
            onClick={() => {
              if (selectedAssetId) varunaVoice.speakDiagnostic(selectedAssetId);
            }}
            className="px-2 py-1 rounded-lg bg-reliance-blue/50 hover:bg-reliance-blue text-[10px] font-mono text-reliance-cyan border border-reliance-cyan/30 transition-all cursor-pointer"
          >
            SPEAK
          </button>
        </div>

        {/* Kalman Filter vs Raw Toggle */}
        <div className="mb-3 shrink-0 p-1.5 rounded-xl bg-reliance-dark/80 border border-reliance-cyan/20 flex items-center justify-between">
          <span className="text-[10px] font-mono text-reliance-textMuted px-1">SIGNAL FILTER:</span>
          <div className="flex gap-1">
            <button
              onClick={() => setDisplayFilterMode('kalman')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                displayFilterMode === 'kalman'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 font-bold'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              1D KALMAN
            </button>
            <button
              onClick={() => setDisplayFilterMode('raw')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer ${
                displayFilterMode === 'raw'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 font-bold'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              RAW SENSOR
            </button>
          </div>
        </div>

        {/* Scrollable Telemetry Cards */}
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          {/* Card 1: Net Standard Oil Volume Rate (BPD) */}
          <div className="p-3 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/25">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-reliance-textMuted font-mono flex items-center gap-1.5 text-[11px]">
                <Droplets className="w-3.5 h-3.5 text-emerald-400" />
                NET DRY OIL RATE
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">ASTM D1250</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-extrabold font-mono text-white tracking-tight">
                {currentRecord ? Math.round(currentRecord.net_oil_bpd).toLocaleString() : '---'}
                <span className="text-xs font-normal text-reliance-cyan ml-1.5">BPD</span>
              </div>
              <div className="text-[10px] font-mono text-reliance-textMuted text-right">
                <div>{(currentRecord?.gross_mass_rate || 0).toFixed(1)} kg/s GROSS</div>
              </div>
            </div>
            {/* Real-time Flow Sparkline */}
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[9px] font-mono text-reliance-textMuted">FLOW TREND (4s)</span>
              <svg width="160" height="24" className="overflow-visible">
                <path d={sparklines.flow} fill="none" stroke="#00F0FF" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* Card 2: Line Pressure & Sparkline */}
          <div className="p-3 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/25">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-reliance-textMuted font-mono flex items-center gap-1.5 text-[11px]">
                <Gauge className="w-3.5 h-3.5 text-reliance-cyan" />
                LINE PRESSURE
              </span>
              <span className="text-[10px] text-reliance-cyan font-mono">
                {currentRecord && currentRecord.p_line_bar > 200 ? 'HIGH-P DEEPWATER' : 'DECK P'}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-bold font-mono text-white">
                {currentRecord?.p_line_bar.toFixed(2) || '---'}
                <span className="text-xs font-normal text-reliance-textMuted ml-1.5">bar</span>
              </div>
              <div className="text-[10px] font-mono text-white/70">
                {currentRecord ? (currentRecord.p_line_bar * 14.5038).toFixed(0) : '---'} psi
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="text-[9px] font-mono text-reliance-textMuted">PRESSURE NOISE</span>
              <svg width="160" height="24" className="overflow-visible">
                <path
                  d={sparklines.pressure}
                  fill="none"
                  stroke={displayFilterMode === 'kalman' ? '#10B981' : '#F59E0B'}
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>

          {/* Card 3: Line Temperature & Water Cut Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/20">
              <div className="text-[10px] font-mono text-reliance-textMuted flex items-center gap-1 mb-1">
                <Thermometer className="w-3 h-3 text-amber-400" />
                TEMPERATURE
              </div>
              <div className="text-base font-bold font-mono text-white">
                {currentRecord?.t_line_c.toFixed(1) || '---'}
                <span className="text-[10px] text-reliance-textMuted ml-1">°C</span>
              </div>
              <div className="text-[9px] font-mono text-white/60">
                {currentRecord ? (currentRecord.t_line_c * 1.8 + 32).toFixed(1) : '---'} °F
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/20">
              <div className="text-[10px] font-mono text-reliance-textMuted flex items-center gap-1 mb-1">
                <Waves className="w-3 h-3 text-sky-400" />
                WATER-CUT (WC)
              </div>
              <div className="text-base font-bold font-mono text-white">
                {currentRecord?.water_cut_pct.toFixed(2) || '---'}
                <span className="text-[10px] text-reliance-textMuted ml-1">%</span>
              </div>
              <div className="text-[9px] font-mono text-emerald-400">LOW EMULSION</div>
            </div>
          </div>

          {/* Card 4: Coriolis Tube Resonant Frequency & Density */}
          <div className="p-3 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/25">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-reliance-textMuted font-mono flex items-center gap-1.5 text-[11px]">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                CORIOLIS RESONANCE (1/f)
              </span>
              <span className="text-[10px] text-amber-400 font-mono">TUBE STIFFNESS</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-bold font-mono text-white">
                {currentRecord?.f_osc_hz.toFixed(1) || '---'}
                <span className="text-xs font-normal text-reliance-textMuted ml-1.5">Hz</span>
              </div>
              <div className="text-[10px] font-mono text-reliance-cyan">
                τ: {currentRecord ? (1e6 / currentRecord.f_osc_hz).toFixed(1) : '---'} μs
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
              <span className="text-reliance-textMuted">CORRECTED DENSITY:</span>
              <span className="text-white font-bold">
                {currentRecord?.corrected_density.toFixed(1) || '---'} kg/m³
              </span>
            </div>
          </div>

          {/* Card 5: API Gravity Classification */}
          <div className="p-3 rounded-xl bg-reliance-navy/60 border border-reliance-cyan/25">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-reliance-textMuted font-mono flex items-center gap-1.5 text-[11px]">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                API GRAVITY QUALITY
              </span>
              <span className="text-[10px] text-purple-300 font-mono font-bold">
                {currentRecord?.api_gravity.toFixed(1)} °API
              </span>
            </div>
            <div className="text-xs font-sans text-emerald-300 font-semibold mt-1">
              {currentRecord && currentRecord.api_gravity > 40
                ? 'KG-D6 Premium Light Condensate'
                : 'Light Crude Oil'}
            </div>
          </div>
        </div>

        {/* Footer Audit Trigger */}
        <div className="pt-3 border-t border-reliance-cyan/20 shrink-0">
          <button
            onClick={togglePhysicsModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-reliance-blue/70 hover:bg-reliance-blue text-xs font-mono text-reliance-cyan border border-reliance-cyan/40 transition-all cursor-pointer shadow-cyan-glow font-bold"
          >
            <FileCode className="w-4 h-4" />
            <span>EXAMINE LaTeX DERIVATION CHAIN</span>
          </button>
        </div>
      </div>
    </div>
  );
};
