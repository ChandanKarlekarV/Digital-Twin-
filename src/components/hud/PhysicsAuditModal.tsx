import React, { useState } from 'react';
import { X, FileCode, CheckCircle2, Zap, Copy, Check } from 'lucide-react';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { KaTeXBlock } from '../common/KaTeXBlock';

export const PhysicsAuditModal: React.FC = () => {
  const isPhysicsModalOpen = useRigStore((s) => s.isPhysicsModalOpen);
  const setPhysicsModalOpen = useRigStore((s) => s.setPhysicsModalOpen);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeCoriolisResult = useTelemetryStore((s) => s.activeCoriolisResult);
  const activeAstmResult = useTelemetryStore((s) => s.activeAstmResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);

  const [activeTab, setActiveTab] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  if (!isPhysicsModalOpen) return null;

  const assetInfo = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;

  const handleCopyMath = () => {
    const text = `
% VARUNA-AI ASTM D1250 & CORIOLIS AUDIT REPORT
% Asset: ${assetInfo?.name || selectedAssetId}
% Timestamp: ${new Date().toISOString()}

1. Resonant Period: \\tau = ${activeCoriolisResult?.period_us.toFixed(2)} \\mu s
2. Raw Density: \\rho_{obs} = ${activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2)} kg/m^3
3. CTL: ${activeAstmResult?.ctl.toFixed(5)}, CPL: ${activeAstmResult?.cpl.toFixed(5)}
4. Base Density: \\rho_{base} = ${activeAstmResult?.rho_base.toFixed(2)} kg/m^3
5. API Gravity: ${activeAstmResult?.api_gravity.toFixed(2)} deg API
6. Net BPD: ${Math.round(activeMultiphaseResult?.net_oil_bpd || 0)} BPD
    `;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fOsc = currentRecord?.f_osc_hz.toFixed(2) || '1245.00';
  const tau = activeCoriolisResult?.period_us.toFixed(2) || '803.21';
  const rhoUncomp = activeCoriolisResult?.uncompensated_density_kg_m3.toFixed(2) || '785.40';
  const rhoComp = activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2) || '785.40';
  const tempC = currentRecord?.t_line_c.toFixed(1) || '52.0';
  const pressBar = currentRecord?.p_line_bar.toFixed(1) || '242.0';
  const ctlVal = activeAstmResult?.ctl.toFixed(5) || '0.98041';
  const cplVal = activeAstmResult?.cpl.toFixed(5) || '1.00302';
  const deltaT = ((currentRecord?.t_line_c || 52) - 15.56).toFixed(2);
  const rhoBase = activeAstmResult?.rho_base.toFixed(2) || '798.68';
  const sgVal = activeAstmResult?.specific_gravity_60_60.toFixed(4) || '0.7995';
  const apiVal = activeAstmResult?.api_gravity.toFixed(2) || '45.49';
  const wcVal = activeMultiphaseResult?.water_cut_percentage.toFixed(2) || '4.20';
  const netMass = activeMultiphaseResult?.net_oil_mass_rate_kg_s.toFixed(2) || '46.25';
  const netBpd = Math.round(activeMultiphaseResult?.net_oil_bpd || 34200).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-dock text-white font-sans flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-blue/50 border border-reliance-cyan/40 text-reliance-cyan shadow-cyan-glow">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/30 font-bold uppercase">
                  ASTM D1250 / API MPMS 11.1
                </span>
                <span className="text-xs text-reliance-textMuted font-mono">
                  {assetInfo?.name || selectedAssetId}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Interactive Physics & Mathematical Derivation Chain
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMath}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reliance-navy hover:bg-reliance-blue/50 border border-reliance-cyan/30 text-xs font-mono text-reliance-cyan transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY LATEX'}</span>
            </button>
            <button
              onClick={() => setPhysicsModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="grid grid-cols-4 border-b border-reliance-cyan/20 bg-reliance-dark/80 text-xs font-mono shrink-0">
          {[
            { step: 1, title: 'Step 1: Coriolis Resonance', sub: 'f_osc → ρ_obs' },
            { step: 2, title: 'Step 2: ASTM D1250 VCF', sub: 'CTL & CPL Factors' },
            { step: 3, title: 'Step 3: °API Gravity', sub: 'SG 60/60 & Grade' },
            { step: 4, title: 'Step 4: Multiphase Deconv', sub: 'Water-Cut → Net BPD' },
          ].map((tab) => (
            <button
              key={tab.step}
              onClick={() => setActiveTab(tab.step)}
              className={`py-3 px-3 text-left transition-all cursor-pointer border-r border-reliance-cyan/15 ${
                activeTab === tab.step
                  ? 'bg-reliance-navy/90 text-reliance-cyan border-b-2 border-b-reliance-cyan font-bold'
                  : 'text-reliance-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="text-[11px] truncate">{tab.title}</div>
              <div className="text-[9px] text-white/50">{tab.sub}</div>
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-sans">
          {/* STEP 1: CORIOLIS DENSITY MODEL */}
          {activeTab === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  1. Resonant Tube Oscillation Period & Temperature Compensation
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  The subsea Coriolis mass flow meter measures the natural oscillation frequency of vibrating titanium flow tubes, inversely proportional to fluid mass density.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Oscillation Period (μs):
                    </div>
                    <KaTeXBlock math={`\\tau = \\frac{10^6}{f_{\\text{osc}}} = \\frac{10^6}{${fOsc}\\,\\text{Hz}} = ${tau}\\,\\mu\\text{s}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Uncompensated Fluid Density:
                    </div>
                    <KaTeXBlock math={`\\rho_{\\text{raw}} = C_1 \\cdot \\tau^2 - C_2 = 4.2875 \\times 10^{-4} \\cdot (${tau})^2 - 0.5218 = ${rhoUncomp}\\,\\text{kg/m}^3`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Temperature-Compensated In-Situ Density:
                    </div>
                    <KaTeXBlock math={`\\rho_{\\text{obs}}(T) = \\rho_{\\text{raw}} + K_T(T - T_0) = ${rhoComp}\\,\\text{kg/m}^3 \\quad (T = ${tempC}^\\circ\\text{C})`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ASTM D1250 VCF CORRECTION */}
          {activeTab === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  2. Temperature & Pressure Volume Correction Factors (ASTM D1250 / API MPMS 11.1)
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Hydrocarbons expand with temperature and compress under deepwater hydrostatic pressure. Standard base density at 15.56°C (60°F) is resolved via Newton-Raphson iteration.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Correction for Temperature on Liquid (CTL):
                    </div>
                    <KaTeXBlock math={`\\text{CTL} = \\exp\\left[-\\alpha_T \\Delta T (1 + 0.8 \\alpha_T \\Delta T)\\right] = ${ctlVal} \\quad (\\Delta T = ${deltaT}^\\circ\\text{C})`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Correction for Pressure on Liquid (CPL):
                    </div>
                    <KaTeXBlock math={`\\text{CPL} = \\frac{1}{1 - F \\cdot (P_{\\text{obs}} - P_e)} = ${cplVal} \\quad (P_{\\text{obs}} = ${pressBar}\\,\\text{bar})`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Newton-Raphson Iterative Convergence (Base Density at 15.56°C):
                    </div>
                    <KaTeXBlock math={`\\rho_{\\text{base}} = \\frac{\\rho_{\\text{obs}}}{\\text{CTL} \\times \\text{CPL}} = \\frac{${rhoComp}}{${ctlVal} \\times ${cplVal}} = ${rhoBase}\\,\\text{kg/m}^3`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: API GRAVITY */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  3. Standard Specific Gravity & API Gravity Grading
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Specific Gravity relative to pure water at 60°F (999.016 kg/m³) determines the crude quality valuation.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Specific Gravity (60°F / 60°F):
                    </div>
                    <KaTeXBlock math={`\\text{SG}_{60/60} = \\frac{\\rho_{\\text{base}}}{\\rho_{\\text{water, 60}}} = \\frac{${rhoBase}}{999.016} = ${sgVal}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      API Gravity Equation:
                    </div>
                    <KaTeXBlock math={`^\\circ\\text{API} = \\frac{141.5}{\\text{SG}_{60/60}} - 131.5 = \\frac{141.5}{${sgVal}} - 131.5 = ${apiVal}^\\circ\\text{API}`} />
                  </div>

                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-300">KG-D6 CLASSIFICATION:</span>
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      {activeAstmResult?.api_classification || 'Light Condensate'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: MULTIPHASE WATER CUT & NET OIL */}
          {activeTab === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                  4. Multiphase Cut & Net Standard Volume (Barrels Per Day)
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Deconvoluting water fraction and standard barrel conversion factor (1 barrel = 0.1589873 m³).
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Water-Cut Fraction (WC):
                    </div>
                    <KaTeXBlock math={`\\text{WC} = \\frac{\\rho_{\\text{mix}} - \\rho_{\\text{oil}}}{\\rho_{\\text{water}} - \\rho_{\\text{oil}}} = ${wcVal}\\%`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Net Dry Oil Mass Flow Rate:
                    </div>
                    <KaTeXBlock math={`\\dot{m}_{\\text{net\\_oil}} = \\dot{m}_{\\text{total}} \\times \\left[1 - \\left(\\text{WC} \\cdot \\frac{\\rho_{\\text{water}}}{\\rho_{\\text{mix}}}\\right)\\right] = ${netMass}\\,\\text{kg/s}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Standard Net Oil Volume Rate (BPD):
                    </div>
                    <KaTeXBlock math={`\\text{Net BPD} = \\frac{\\dot{m}_{\\text{net\\_oil}}(\\text{kg/day})}{\\rho_{\\text{base}} \\times 0.1589873} = ${netBpd}\\,\\text{Barrels/Day}`} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-reliance-cyan/20 bg-reliance-navy/70 flex items-center justify-between text-xs font-mono text-reliance-textMuted shrink-0">
          <span>MATHEMATICAL KERNEL: RELIANCE PETROLEUM ENGINE v1.0</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300">10 Hz SYNCED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
