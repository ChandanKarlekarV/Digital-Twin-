import React, { useMemo, useState, useEffect } from 'react';
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
  Database,
  Calendar,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { telemetryDb } from '../../db/TelemetryDatabase';
import { TelemetryRecord } from '../../types/telemetry';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const TelemetryDrawer: React.FC = () => {
  const isTelemetryDrawerOpen = useRigStore((s) => s.isTelemetryDrawerOpen);
  const toggleTelemetryDrawer = useRigStore((s) => s.toggleTelemetryDrawer);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);
  const togglePhysicsModal = useRigStore((s) => s.togglePhysicsModal);
  const setEodModalOpen = useRigStore((s) => s.setEodModalOpen);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const displayFilterMode = useTelemetryStore((s) => s.displayFilterMode);
  const setDisplayFilterMode = useTelemetryStore((s) => s.setDisplayFilterMode);
  const historyBuffer = useTelemetryStore((s) => s.historyBuffer);

  // Drawer Active View Tab: 'live' or 'database'
  const [drawerTab, setDrawerTab] = useState<'live' | 'database'>('live');

  // Database Tab Filtering States
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 = All 5 Weeks, 1 = Week 1, etc.
  const [dbAssetFilter, setDbAssetFilter] = useState<string>('ALL');
  const [dbSearchTerm, setDbSearchTerm] = useState<string>('');
  const [dbPage, setDbPage] = useState<number>(1);
  const itemsPerPage = 12;

  const [historicalRecords, setHistoricalRecords] = useState<TelemetryRecord[]>([]);

  // Load historical data when database tab opens or filters change
  useEffect(() => {
    if (drawerTab === 'database' || isTelemetryDrawerOpen) {
      let records: TelemetryRecord[] = [];
      const assetTarget = dbAssetFilter === 'ALL' ? null : dbAssetFilter;

      if (selectedWeek === 0) {
        records = telemetryDb.queryPastWeeks(assetTarget, 5);
      } else {
        records = telemetryDb.querySpecificWeek(assetTarget, selectedWeek);
      }

      // If database is still seeding, trigger seed & fallback to recent buffer
      if (records.length === 0) {
        telemetryDb.seedSixMonthHistory().then(() => {
          const loaded = selectedWeek === 0
            ? telemetryDb.queryPastWeeks(assetTarget, 5)
            : telemetryDb.querySpecificWeek(assetTarget, selectedWeek);
          setHistoricalRecords([...loaded].reverse());
        });
      } else {
        setHistoricalRecords([...records].reverse());
      }
    }
  }, [drawerTab, selectedWeek, dbAssetFilter, isTelemetryDrawerOpen]);

  const assetInfo = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;

  // Filter records by search string
  const filteredDbRecords = useMemo(() => {
    if (!dbSearchTerm.trim()) return historicalRecords;
    const term = dbSearchTerm.toLowerCase();
    return historicalRecords.filter(
      (r) =>
        r.asset_id.toLowerCase().includes(term) ||
        (r.precise_time_iso && r.precise_time_iso.toLowerCase().includes(term)) ||
        r.p_line_bar.toString().includes(term) ||
        r.net_oil_bpd.toString().includes(term)
    );
  }, [historicalRecords, dbSearchTerm]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredDbRecords.length / itemsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (dbPage - 1) * itemsPerPage;
    return filteredDbRecords.slice(start, start + itemsPerPage);
  }, [filteredDbRecords, dbPage]);

  // Compute database summary statistics
  const dbStats = useMemo(() => {
    if (filteredDbRecords.length === 0) return null;
    const count = filteredDbRecords.length;
    let sumP = 0;
    let sumT = 0;
    let sumBpd = 0;
    let sumWC = 0;

    for (const r of filteredDbRecords) {
      sumP += r.p_line_bar;
      sumT += r.t_line_c;
      sumBpd += r.net_oil_bpd;
      sumWC += r.water_cut_pct;
    }

    return {
      totalCount: count,
      avgPressure: (sumP / count).toFixed(1),
      avgTemp: (sumT / count).toFixed(1),
      avgBpd: Math.round(sumBpd / count).toLocaleString(),
      avgWaterCut: (sumWC / count).toFixed(1),
    };
  }, [filteredDbRecords]);

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
        className="w-6 h-40 my-auto -ml-3 rounded-l-xl glass-panel border-y border-l border-reliance-cyan/60 bg-reliance-deepnavy/95 text-reliance-cyan hover:bg-reliance-navy transition-all flex flex-col items-center justify-center gap-2 shadow-cyan-glow cursor-pointer"
        title={isTelemetryDrawerOpen ? 'Retract Telemetry Drawer' : 'Expand Telemetry Drawer'}
      >
        {isTelemetryDrawerOpen ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4 animate-pulse" />
        )}
        <span className="[writing-mode:vertical-lr] text-[9px] font-mono font-bold tracking-widest text-reliance-cyan uppercase rotate-180">
          TELEMETRY &amp; DB
        </span>
      </button>

      {/* Main Slide-out Panel */}
      <div
        className={`${
          drawerTab === 'database' ? 'w-[420px] sm:w-[480px]' : 'w-84 sm:w-96'
        } h-full glass-panel border-l border-reliance-cyan/40 bg-reliance-deepnavy/98 p-3.5 shadow-dock text-white font-sans backdrop-blur-xl flex flex-col overflow-hidden transition-all duration-200`}
      >
        {/* Header & Mode Switcher */}
        <div className="border-b border-reliance-cyan/20 pb-2.5 mb-2.5 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-cyan font-bold uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>MPFM TELEMETRY (50.0 Hz / 20ms)</span>
              </div>
              <h2 className="text-sm font-extrabold text-white truncate max-w-[240px]">
                {assetInfo?.name || selectedAssetId || 'KG-D6 Subsea Complex'}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (selectedAssetId) varunaVoice.speakDiagnostic(selectedAssetId);
                }}
                className="px-2 py-1 rounded-lg bg-reliance-blue/50 hover:bg-reliance-blue text-[10px] font-mono text-reliance-cyan border border-reliance-cyan/30 transition-all cursor-pointer font-bold"
              >
                SPEAK
              </button>
            </div>
          </div>

          {/* Tab Selection: Live Sensor Stream vs 4-5 Weeks Database */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-reliance-dark/90 rounded-xl border border-reliance-cyan/20 font-mono text-xs">
            <button
              onClick={() => setDrawerTab('live')}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
                drawerTab === 'live'
                  ? 'bg-reliance-blue text-white shadow-cyan-glow'
                  : 'text-reliance-textMuted hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-reliance-cyan" />
              <span>LIVE SENSORS</span>
            </button>

            <button
              onClick={() => {
                setDrawerTab('database');
                varunaVoice.playSonarPing(880, 0.08);
              }}
              className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
                drawerTab === 'database'
                  ? 'bg-emerald-600 text-white shadow-emerald-glow'
                  : 'text-reliance-textMuted hover:text-emerald-300'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>4-5 WKS DATABASE</span>
            </button>
          </div>
        </div>

        {/* ================= VIEW 1: LIVE SENSORS & KALMAN ================= */}
        {drawerTab === 'live' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Kalman Filter vs Raw Toggle */}
            <div className="mb-2.5 shrink-0 p-1.5 rounded-xl bg-reliance-dark/80 border border-reliance-cyan/20 flex items-center justify-between">
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
            <div className="space-y-2 overflow-y-auto pr-1 flex-1 scrollbar-thin">
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
            <div className="pt-2.5 border-t border-reliance-cyan/20 shrink-0">
              <button
                onClick={togglePhysicsModal}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-reliance-blue/70 hover:bg-reliance-blue text-xs font-mono text-reliance-cyan border border-reliance-cyan/40 transition-all cursor-pointer shadow-cyan-glow font-bold"
              >
                <FileCode className="w-4 h-4" />
                <span>EXAMINE LaTeX DERIVATION CHAIN</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: HISTORICAL DATABASE (4-5 WEEKS) ================= */}
        {drawerTab === 'database' && (
          <div className="flex flex-col flex-1 overflow-hidden font-mono text-xs">
            {/* Week Selector Chips */}
            <div className="mb-2 shrink-0">
              <div className="text-[10px] text-reliance-textMuted uppercase font-bold mb-1 flex items-center justify-between">
                <span>SELECT TIME HORIZON:</span>
                <span className="text-emerald-400 font-bold">{filteredDbRecords.length} Records</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[
                  { id: 0, label: '5 Wks' },
                  { id: 1, label: 'Wk 1' },
                  { id: 2, label: 'Wk 2' },
                  { id: 3, label: 'Wk 3' },
                  { id: 4, label: 'Wk 4' },
                  { id: 5, label: 'Wk 5' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setSelectedWeek(w.id);
                      setDbPage(1);
                    }}
                    className={`py-1 rounded-lg text-center font-bold text-[10px] transition-all cursor-pointer border ${
                      selectedWeek === w.id
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-sm'
                        : 'bg-reliance-navy/50 border-white/10 text-reliance-textMuted hover:text-white'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Selector & Search Filter */}
            <div className="grid grid-cols-2 gap-1.5 mb-2 shrink-0">
              <select
                value={dbAssetFilter}
                onChange={(e) => {
                  setDbAssetFilter(e.target.value);
                  setDbPage(1);
                }}
                className="w-full px-2 py-1.5 rounded-lg bg-reliance-navy/90 border border-reliance-cyan/30 text-[10px] text-white focus:outline-none focus:border-reliance-cyan"
              >
                <option value="ALL">All 7 Rig Subsystems</option>
                <option value="RISER-ALPHA">Riser Alpha</option>
                <option value="RISER-BRAVO">Riser Bravo</option>
                <option value="MANIFOLD-D6-MAIN">Subsea Manifold</option>
                <option value="XT-WELLHEAD-01">Wellhead XT-01</option>
                <option value="XT-WELLHEAD-02">Wellhead XT-02</option>
                <option value="TOPSIDE-MPFM-01">Topside MPFM-01</option>
                <option value="TOPSIDE-DRILL-RIG">Topside Drill Rig</option>
              </select>

              <div className="relative">
                <Search className="w-3 h-3 text-reliance-textMuted absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dbSearchTerm}
                  onChange={(e) => {
                    setDbSearchTerm(e.target.value);
                    setDbPage(1);
                  }}
                  placeholder="Search time / bar..."
                  className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-reliance-navy/90 border border-reliance-cyan/30 text-[10px] text-white placeholder:text-reliance-textMuted/50 focus:outline-none focus:border-reliance-cyan"
                />
              </div>
            </div>

            {/* Summary KPI Strip */}
            {dbStats && (
              <div className="grid grid-cols-4 gap-1 p-2 rounded-xl bg-reliance-navy/40 border border-reliance-cyan/20 mb-2 shrink-0 text-[10px]">
                <div>
                  <div className="text-reliance-textMuted text-[8.5px]">AVG FLOW</div>
                  <div className="font-bold text-white truncate">{dbStats.avgBpd} <span className="text-[8px] text-reliance-cyan">BPD</span></div>
                </div>
                <div>
                  <div className="text-reliance-textMuted text-[8.5px]">AVG PRESS</div>
                  <div className="font-bold text-white">{dbStats.avgPressure} <span className="text-[8px] text-reliance-textMuted">bar</span></div>
                </div>
                <div>
                  <div className="text-reliance-textMuted text-[8.5px]">WATER-CUT</div>
                  <div className="font-bold text-blue-300">{dbStats.avgWaterCut}%</div>
                </div>
                <div>
                  <div className="text-reliance-textMuted text-[8.5px]">RECORDS</div>
                  <div className="font-bold text-emerald-400">{dbStats.totalCount}</div>
                </div>
              </div>
            )}

            {/* Historical Telemetry Table */}
            <div className="flex-1 overflow-y-auto border border-reliance-cyan/20 rounded-xl bg-reliance-dark/80 scrollbar-thin">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead className="sticky top-0 bg-reliance-deepnavy border-b border-reliance-cyan/30 text-reliance-cyan font-bold uppercase text-[9px] z-10">
                  <tr>
                    <th className="py-2 px-2">Time (UTC)</th>
                    <th className="py-2 px-2">Asset</th>
                    <th className="py-2 px-2">Press</th>
                    <th className="py-2 px-2">Temp</th>
                    <th className="py-2 px-2 text-emerald-300">Net Oil</th>
                    <th className="py-2 px-2">WC%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-reliance-textMuted">
                        No telemetry records found.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r, i) => {
                      const isoStr = r.precise_time_iso || new Date(r.timestamp).toISOString();
                      const timeShort = isoStr.replace('T', ' ').slice(5, 16);
                      return (
                        <tr
                          key={r.timestamp + '-' + r.asset_id + '-' + i}
                          onClick={() => setSelectedAssetId(r.asset_id)}
                          className="hover:bg-reliance-blue/30 cursor-pointer transition-colors"
                        >
                          <td className="py-1.5 px-2 text-white/80 whitespace-nowrap">
                            {timeShort}
                          </td>
                          <td className="py-1.5 px-2">
                            <span className="px-1 py-0.5 rounded bg-white/10 text-[8.5px] text-reliance-cyan font-bold truncate max-w-[70px] inline-block">
                              {r.asset_id.replace('TOPSIDE-', '').replace('RISER-', 'R-')}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 font-bold text-white whitespace-nowrap">
                            {r.p_line_bar.toFixed(1)} <span className="text-[8px] text-reliance-textMuted">b</span>
                          </td>
                          <td className="py-1.5 px-2 text-amber-300 whitespace-nowrap">
                            {r.t_line_c.toFixed(1)}°
                          </td>
                          <td className="py-1.5 px-2 text-emerald-300 font-bold whitespace-nowrap">
                            {Math.round(r.net_oil_bpd).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-blue-300 whitespace-nowrap">
                            {r.water_cut_pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2 shrink-0 border-t border-reliance-cyan/15 text-[10px]">
              <span className="text-reliance-textMuted">
                Page <strong className="text-white">{dbPage}</strong> of <strong className="text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  disabled={dbPage <= 1}
                  onClick={() => setDbPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded bg-reliance-navy/80 hover:bg-reliance-blue disabled:opacity-40 disabled:pointer-events-none text-white transition-all cursor-pointer font-bold"
                >
                  Prev
                </button>
                <button
                  disabled={dbPage >= totalPages}
                  onClick={() => setDbPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 rounded bg-reliance-navy/80 hover:bg-reliance-blue disabled:opacity-40 disabled:pointer-events-none text-white transition-all cursor-pointer font-bold"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Open Full 6-Month Ledger Button */}
            <div className="pt-2 shrink-0">
              <button
                onClick={() => {
                  setEodModalOpen(true);
                  varunaVoice.speakCustom('Launching KG-D6 6-Month AI Production Ledger and Midnight Settlement.');
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-emerald-600/40 to-cyan-600/40 hover:from-emerald-600/60 hover:to-cyan-600/60 text-xs font-mono text-emerald-200 border border-emerald-400/50 transition-all cursor-pointer shadow-emerald-glow font-bold"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>EXPAND 180-DAY PRODUCTION LEDGER</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
