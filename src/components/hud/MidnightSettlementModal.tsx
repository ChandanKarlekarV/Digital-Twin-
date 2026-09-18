import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Download,
  Flame,
  Droplets,
  Layers,
  Search,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  X,
  Zap,
  RotateCcw,
  Sliders,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { sixMonthDataEngine } from '../../db/SixMonthDataEngine';
import { midnightSettlementEngine } from '../../services/MidnightSettlementEngine';
import { DailyProductionSummary, SixMonthAnalytics } from '../../types/eod';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const MidnightSettlementModal: React.FC = () => {
  const isEodModalOpen = useRigStore((s) => s.isEodModalOpen);
  const setEodModalOpen = useRigStore((s) => s.setEodModalOpen);

  const [activeTab, setActiveTab] = useState<'ledger' | 'anomalies' | 'analytics'>('ledger');
  const [searchTerm, setSearchTerm] = useState('');
  const [timeHorizon, setTimeHorizon] = useState<'all' | '5weeks' | 'w1' | 'w2' | 'w3' | 'w4' | 'w5'>('all');
  const [dailyRecords, setDailyRecords] = useState<DailyProductionSummary[]>([]);
  const [analytics, setAnalytics] = useState<SixMonthAnalytics | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyProductionSummary | null>(null);

  useEffect(() => {
    if (isEodModalOpen) {
      const records = sixMonthDataEngine.getDailySummaries();
      const stats = sixMonthDataEngine.getSixMonthAnalytics();
      setDailyRecords([...records].reverse()); // Most recent first
      setAnalytics(stats);
      if (records.length > 0) {
        setSelectedRecord(records[records.length - 1]);
      }
    }
  }, [isEodModalOpen]);

  // Trigger On-Demand Midnight Settlement
  const handleTriggerSettlement = () => {
    setIsSettling(true);
    varunaVoice.playSonarPing(880, 0.15);

    setTimeout(() => {
      const newSettlement = midnightSettlementEngine.executeMidnightSettlement('ON_DEMAND_MANUAL');
      const updated = sixMonthDataEngine.getDailySummaries();
      setDailyRecords([...updated].reverse());
      setAnalytics(sixMonthDataEngine.getSixMonthAnalytics());
      setSelectedRecord(newSettlement);
      setIsSettling(false);
    }, 600);
  };

  // Filter records by time horizon and search string
  const filteredRecords = useMemo(() => {
    let records = dailyRecords;

    if (timeHorizon === '5weeks') {
      records = dailyRecords.slice(0, 35); // Most recent 35 days (5 weeks)
    } else if (timeHorizon === 'w1') {
      records = dailyRecords.slice(0, 7); // Week 1 (Last 7 days)
    } else if (timeHorizon === 'w2') {
      records = dailyRecords.slice(7, 14); // Week 2 (8-14 days ago)
    } else if (timeHorizon === 'w3') {
      records = dailyRecords.slice(14, 21); // Week 3 (15-21 days ago)
    } else if (timeHorizon === 'w4') {
      records = dailyRecords.slice(21, 28); // Week 4 (22-28 days ago)
    } else if (timeHorizon === 'w5') {
      records = dailyRecords.slice(28, 35); // Week 5 (29-35 days ago)
    }

    if (!searchTerm.trim()) return records;
    return records.filter(
      (r) =>
        r.date_str.includes(searchTerm) ||
        r.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.hash_signature?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dailyRecords, timeHorizon, searchTerm]);

  // Export CSV
  const handleExportCsv = () => {
    varunaVoice.speakCustom('Exporting 6-Month KG-D6 daily production ledger in CSV format.');
    const headers = [
      'Date',
      'Gross_Liquid_BPD',
      'Water_Cut_Pct',
      'Purified_Oil_BPD',
      'Purified_Barrels_24H',
      'Produced_Water_BPD',
      'Gas_MMSCFD',
      'Avg_Pressure_Bar',
      'Avg_Temp_C',
      'Drill_ROP_Mhr',
      'Drilled_Meters',
      'Purity_Compliance_Pct',
      'Value_USD',
      'Value_INR_Cr',
      'Hash_Signature',
    ];

    const rows = dailyRecords.map((r) => [
      r.date_str,
      r.gross_liquid_bpd,
      r.water_cut_avg_pct,
      r.purified_oil_bpd,
      r.purified_barrels_day,
      r.produced_water_bpd,
      r.associated_gas_mmscfd,
      r.avg_line_pressure_bar,
      r.avg_temperature_c,
      r.avg_drill_rop_mhr,
      r.total_drilled_meters,
      r.purity_compliance_pct,
      r.estimated_gross_value_usd,
      r.estimated_gross_value_inr,
      r.hash_signature,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `KG_D6_6Month_Production_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isEodModalOpen) return null;

  const anomalies = sixMonthDataEngine.getAiAnomalies();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col glass-panel border border-reliance-cyan/50 bg-reliance-deepnavy/98 rounded-3xl shadow-dock overflow-hidden text-white font-sans">
        {/* ================= MODAL HEADER ================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-reliance-cyan/20 to-blue-600/30 border border-reliance-cyan/50 shadow-cyan-glow">
              <Calendar className="w-5 h-5 text-reliance-cyan animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono tracking-wider text-white">
                  6-MONTH AI PRODUCTION LEDGER & MIDNIGHT SETTLEMENT
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  180-DAY DATABASE ACTIVE
                </span>
              </div>
              <div className="text-xs font-mono text-reliance-textMuted flex items-center gap-2 mt-0.5">
                <span>RELIANCE KG-D6 SUBSEA PRODUCTION BLOCK</span>
                <span>•</span>
                <span>AUTOMATED 12:00 MIDNIGHT EOD RECONCILIATION</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSettlement}
              disabled={isSettling}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/30 to-orange-500/30 hover:from-amber-500/50 hover:to-orange-500/50 border border-amber-400 text-amber-200 font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-amber-glow"
            >
              <Zap className={`w-3.5 h-3.5 ${isSettling ? 'animate-spin text-amber-300' : 'text-amber-400'}`} />
              <span>{isSettling ? 'RECONCILING...' : '⚡ RECONCILE MIDNIGHT (NOW)'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-reliance-blue/40 hover:bg-reliance-blue/70 border border-reliance-cyan/40 text-reliance-cyan font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT CSV</span>
            </button>

            <button
              onClick={() => setEodModalOpen(false)}
              className="p-2 rounded-xl hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= 6-MONTH MACRO KPI SUMMARY CARDS ================= */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-reliance-navy/30 border-b border-reliance-cyan/15 font-mono text-xs">
            {/* Card 1: Gross Oil Extracted */}
            <div className="p-3 rounded-2xl bg-reliance-deepnavy/90 border border-reliance-cyan/30 flex flex-col justify-between">
              <div className="text-[10px] text-reliance-textMuted uppercase font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-reliance-cyan" />
                <span>Gross Extracted</span>
              </div>
              <div className="text-lg font-extrabold text-white mt-1">
                {(analytics.total_gross_extracted_barrels / 1000000).toFixed(2)} M <span className="text-xs font-normal text-reliance-cyan">bbl</span>
              </div>
              <div className="text-[9px] text-reliance-textMuted mt-0.5">
                Avg: {analytics.overall_avg_purified_bpd.toLocaleString()} BPD
              </div>
            </div>

            {/* Card 2: Net Dry Purified Oil */}
            <div className="p-3 rounded-2xl bg-reliance-deepnavy/90 border border-emerald-500/40 flex flex-col justify-between shadow-sm">
              <div className="text-[10px] text-emerald-300 uppercase font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Net Purified Oil</span>
              </div>
              <div className="text-lg font-extrabold text-emerald-300 mt-1">
                {(analytics.total_purified_dry_barrels / 1000000).toFixed(2)} M <span className="text-xs font-normal">bbl</span>
              </div>
              <div className="text-[9px] text-emerald-400/80 mt-0.5">
                ASTM D1250: &lt;0.5% BS&amp;W Spec
              </div>
            </div>

            {/* Card 3: Water Separated */}
            <div className="p-3 rounded-2xl bg-reliance-deepnavy/90 border border-blue-400/30 flex flex-col justify-between">
              <div className="text-[10px] text-blue-300 uppercase font-bold flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                <span>Water Separated</span>
              </div>
              <div className="text-lg font-extrabold text-blue-200 mt-1">
                {(analytics.total_produced_water_barrels / 1000000).toFixed(2)} M <span className="text-xs font-normal text-blue-400">bbl</span>
              </div>
              <div className="text-[9px] text-blue-300/80 mt-0.5">
                Avg Water-Cut: {analytics.overall_avg_water_cut_pct}%
              </div>
            </div>

            {/* Card 4: Footage Drilled */}
            <div className="p-3 rounded-2xl bg-reliance-deepnavy/90 border border-amber-500/30 flex flex-col justify-between">
              <div className="text-[10px] text-amber-300 uppercase font-bold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Drilled Footage</span>
              </div>
              <div className="text-lg font-extrabold text-amber-200 mt-1">
                {analytics.total_meters_drilled.toLocaleString()} <span className="text-xs font-normal text-amber-400">m</span>
              </div>
              <div className="text-[9px] text-amber-300/80 mt-0.5">
                Availability: {analytics.avg_daily_plant_uptime_pct}%
              </div>
            </div>

            {/* Card 5: Cumulative Valuation */}
            <div className="p-3 rounded-2xl bg-reliance-deepnavy/90 border border-purple-400/40 flex flex-col justify-between col-span-2 md:col-span-1">
              <div className="text-[10px] text-purple-300 uppercase font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>6-Mo Gross Value</span>
              </div>
              <div className="text-lg font-extrabold text-purple-200 mt-1">
                ₹{analytics.total_estimated_revenue_inr_cr.toLocaleString()} <span className="text-xs font-normal text-purple-400">Cr</span>
              </div>
              <div className="text-[9px] text-purple-300/80 mt-0.5">
                ${(analytics.total_estimated_revenue_usd / 1000000).toFixed(1)}M USD Brent Equivalent
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB NAVIGATION & TIME HORIZON FILTERS ================= */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-6 py-2.5 border-b border-reliance-cyan/15 bg-reliance-deepnavy font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-reliance-blue text-white shadow-cyan-glow'
                  : 'text-reliance-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Production Ledger ({filteredRecords.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('anomalies')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'anomalies'
                  ? 'bg-rose-600 text-white shadow-red-glow'
                  : 'text-reliance-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>AI Automated Events ({anomalies.length})</span>
            </button>
          </div>

          {/* Time Horizon Quick Filters & Search Box */}
          {activeTab === 'ledger' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'All 180D' },
                  { id: '5weeks', label: '5 Wks' },
                  { id: 'w1', label: 'Wk 1' },
                  { id: 'w2', label: 'Wk 2' },
                  { id: 'w3', label: 'Wk 3' },
                  { id: 'w4', label: 'Wk 4' },
                  { id: 'w5', label: 'Wk 5' },
                ].map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeHorizon(tf.id as any)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border ${
                      timeHorizon === tf.id
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-sm'
                        : 'bg-reliance-navy/60 border-white/10 text-reliance-textMuted hover:text-white'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>

              <div className="relative w-44 sm:w-56">
                <Search className="w-3.5 h-3.5 text-reliance-textMuted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search date, hash..."
                  className="w-full pl-8 pr-3 py-1 rounded-xl bg-reliance-navy/80 border border-reliance-cyan/30 text-white text-[11px] placeholder:text-reliance-textMuted/60 focus:outline-none focus:border-reliance-cyan font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* ================= TAB CONTENT ================= */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {activeTab === 'ledger' && (
            <div className="space-y-3">
              {/* Selected Day Expanded Diagnostic Card */}
              {selectedRecord && (
                <div className="p-3.5 rounded-2xl bg-reliance-navy/70 border border-reliance-cyan/40 shadow-dock font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-reliance-cyan/20 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-reliance-cyan" />
                      <span className="font-bold text-white text-sm">
                        KG-D6 SETTLEMENT AUDIT: {selectedRecord.date_str} (00:00:00 Midnight)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-400/40 font-bold">
                        {selectedRecord.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-reliance-cyan font-mono flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{selectedRecord.hash_signature}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px]">
                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-white/10">
                      <div className="text-[9px] text-reliance-textMuted">GROSS EXTRACTED</div>
                      <div className="font-bold text-white mt-0.5">{selectedRecord.gross_liquid_bpd.toLocaleString()} BPD</div>
                      <div className="text-[8.5px] text-reliance-textMuted">{selectedRecord.gross_barrels_day.toLocaleString()} bbl/24h</div>
                    </div>

                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-emerald-500/30">
                      <div className="text-[9px] text-emerald-300">NET PURIFIED OIL</div>
                      <div className="font-bold text-emerald-300 mt-0.5">{selectedRecord.purified_oil_bpd.toLocaleString()} BPD</div>
                      <div className="text-[8.5px] text-emerald-400/80">ASTM D1250: {selectedRecord.purity_compliance_pct}% Purity</div>
                    </div>

                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-blue-400/30">
                      <div className="text-[9px] text-blue-300">PRODUCED WATER</div>
                      <div className="font-bold text-blue-200 mt-0.5">{selectedRecord.produced_water_bpd.toLocaleString()} BPD</div>
                      <div className="text-[8.5px] text-blue-300/80">WC: {selectedRecord.water_cut_avg_pct}%</div>
                    </div>

                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-white/10">
                      <div className="text-[9px] text-reliance-textMuted">ASSOCIATED GAS</div>
                      <div className="font-bold text-amber-200 mt-0.5">{selectedRecord.associated_gas_mmscfd} MMSCFD</div>
                      <div className="text-[8.5px] text-reliance-textMuted">GOR: 480 SCF/bbl</div>
                    </div>

                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-white/10">
                      <div className="text-[9px] text-reliance-textMuted">DRILLSTRING METRICS</div>
                      <div className="font-bold text-white mt-0.5">{selectedRecord.total_drilled_meters} m Drilled</div>
                      <div className="text-[8.5px] text-reliance-textMuted">ROP: {selectedRecord.avg_drill_rop_mhr} m/h • {selectedRecord.avg_drill_torque_knm} kNm</div>
                    </div>

                    <div className="p-2 rounded-xl bg-reliance-deepnavy/90 border border-purple-400/30">
                      <div className="text-[9px] text-purple-300">DAILY VALUATION</div>
                      <div className="font-bold text-purple-200 mt-0.5">₹{selectedRecord.estimated_gross_value_inr} Cr</div>
                      <div className="text-[8.5px] text-purple-300/80">${(selectedRecord.estimated_gross_value_usd / 1e6).toFixed(2)}M USD</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ledger Records Table */}
              <div className="overflow-x-auto border border-reliance-cyan/20 rounded-2xl bg-reliance-dark/90">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-reliance-cyan/30 text-[10px] text-reliance-cyan uppercase tracking-wider bg-reliance-navy/60 sticky top-0 z-10">
                      <th className="py-2.5 px-3">Date (Midnight 00:00)</th>
                      <th className="py-2.5 px-3">Gross BPD</th>
                      <th className="py-2.5 px-3">Water-Cut</th>
                      <th className="py-2.5 px-3 text-emerald-300">Net Purified Oil</th>
                      <th className="py-2.5 px-3">Gas (MMSCFD)</th>
                      <th className="py-2.5 px-3">Avg Press / Temp</th>
                      <th className="py-2.5 px-3">Drill ROP &amp; Footage</th>
                      <th className="py-2.5 px-3">Revenue (₹ Cr)</th>
                      <th className="py-2.5 px-3">DGH Seal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredRecords.map((r) => (
                      <tr
                        key={r.date_str}
                        onClick={() => setSelectedRecord(r)}
                        className={`hover:bg-reliance-blue/20 cursor-pointer transition-colors ${
                          selectedRecord?.date_str === r.date_str ? 'bg-reliance-blue/30 border-l-2 border-reliance-cyan' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-reliance-cyan" />
                          <span>{r.date_str}</span>
                        </td>
                        <td className="py-2.5 px-3 text-white/90">
                          {r.gross_liquid_bpd.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-blue-300 font-bold">
                          {r.water_cut_avg_pct}%
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-extrabold shadow-sm">
                            {r.purified_oil_bpd.toLocaleString()} BPD
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white/80">
                          {r.associated_gas_mmscfd}
                        </td>
                        <td className="py-2.5 px-3 text-reliance-textMuted">
                          <span className="text-white">{r.avg_line_pressure_bar} bar</span> • {r.avg_temperature_c}°C
                        </td>
                        <td className="py-2.5 px-3 text-amber-300">
                          {r.avg_drill_rop_mhr} m/h ({r.total_drilled_meters}m)
                        </td>
                        <td className="py-2.5 px-3 text-purple-300 font-bold">
                          ₹{r.estimated_gross_value_inr} Cr
                        </td>
                        <td className="py-2.5 px-3 text-[10px] text-reliance-textMuted font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-reliance-cyan border border-white/10">
                            {r.hash_signature}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'anomalies' && (
            <div className="space-y-2">
              {anomalies.length === 0 ? (
                <div className="text-center py-12 text-reliance-textMuted font-mono text-sm">
                  No critical AI anomalies detected in 6-month historical log.
                </div>
              ) : (
                anomalies.map((a, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl glass-panel border border-rose-500/40 bg-rose-950/20 text-white font-mono text-xs flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 font-bold text-[10px] border border-rose-500/50">
                          {a.severity}
                        </span>
                        <span className="font-bold text-white text-sm">{a.category}</span>
                        <span className="text-reliance-textMuted text-[10px]">[{a.asset_id}]</span>
                        <span className="text-reliance-textMuted text-[10px]">{a.precise_time}</span>
                      </div>
                      <div className="text-xs text-rose-200">
                        <strong>Diagnosis:</strong> {a.ai_inference_summary}
                      </div>
                      <div className="text-[11px] text-reliance-cyan">
                        <strong>AI Recommended Action:</strong> {a.recommended_action}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-rose-300">{a.detected_value}</div>
                      <div className="text-[10px] text-reliance-textMuted">{a.nominal_baseline}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-reliance-cyan/20 bg-reliance-deepnavy font-mono text-xs text-reliance-textMuted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LOCAL DISK DB: SYNCED (180 DAYS)</span>
            </span>
            <span>•</span>
            <span>SAMPLING RATE: <strong>50.0 Hz (20ms)</strong></span>
          </div>

          <div className="text-[10px] text-reliance-textMuted/70">
            DGH / ISO 14001 SUBSEA DIGITAL TWIN LEDGER
          </div>
        </div>
      </div>
    </div>
  );
};
