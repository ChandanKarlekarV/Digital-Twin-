import React, { useState } from 'react';
import { X, FileCode, CheckCircle2, Zap, Copy, Check, Waves, Wrench, Activity, Download } from 'lucide-react';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';
import { KaTeXBlock } from '../common/KaTeXBlock';

export const PhysicsAuditModal: React.FC = () => {
  const isPhysicsModalOpen = useRigStore((s) => s.isPhysicsModalOpen);
  const setPhysicsModalOpen = useRigStore((s) => s.setPhysicsModalOpen);
  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeCoriolisResult = useTelemetryStore((s) => s.activeCoriolisResult);
  const activeAstmResult = useTelemetryStore((s) => s.activeAstmResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);
  const activeHydraulicResult = useTelemetryStore((s) => s.activeHydraulicResult);
  const activeDrillResult = useTelemetryStore((s) => s.activeDrillResult);

  const [activeTab, setActiveTab] = useState<number>(1);
  const [copied, setCopied] = useState(false);

  if (!isPhysicsModalOpen) return null;

  const assetInfo = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;

  const handleCopyMath = () => {
    const text = `
% VARUNA-AI SUBSEA DIGITAL TWIN MATHEMATICAL AUDIT REPORT
% Asset: ${assetInfo?.name || selectedAssetId}
% Scenario: ${emergencyScenario.toUpperCase()} (Phase ${incidentPhase})
% Timestamp: ${new Date().toISOString()}

1. Resonant Period: \\tau = ${activeCoriolisResult?.period_us.toFixed(2)} \\mu s
2. Observed Density: \\rho_{obs} = ${activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2)} kg/m^3
3. ASTM D1250: CTL = ${activeAstmResult?.ctl.toFixed(5)}, CPL = ${activeAstmResult?.cpl.toFixed(5)}
4. Base Density @ 15.56°C: \\rho_{base} = ${activeAstmResult?.rho_base.toFixed(2)} kg/m^3
5. Specific Gravity & API: SG = ${activeAstmResult?.specific_gravity_60_60.toFixed(4)}, °API = ${activeAstmResult?.api_gravity.toFixed(2)}
6. Darcy-Weisbach Pipeline ΔP: ${activeHydraulicResult?.pressureDropBar.toFixed(2)} bar (Re = ${activeHydraulicResult?.reynoldsNumber})
7. Drillstring Torsional Stress: \\tau = ${activeDrillResult?.torsionalShearStressMPa.toFixed(1)} MPa (SF = ${activeDrillResult?.safetyFactor.toFixed(2)})
8. Multiphase Net Flow: ${Math.round(activeMultiphaseResult?.net_oil_bpd || 0).toLocaleString()} BPD (WC = ${activeMultiphaseResult?.water_cut_percentage.toFixed(2)}%)
    `;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    const csvContent = `data:text/csv;charset=utf-8,Parameter,Value,Unit,Standard
Timestamp,${new Date().toISOString()},ISO-8601,N/A
Asset_ID,${selectedAssetId || 'KG-D6-MAIN'},N/A,ISO 14224
Emergency_Scenario,${emergencyScenario},N/A,API RP 14C
Incident_Phase,${incidentPhase},N/A,N/A
Oscillation_Frequency,${currentRecord?.f_osc_hz.toFixed(2)},Hz,API MPMS 5.6
Resonant_Period,${activeCoriolisResult?.period_us.toFixed(2)},us,API MPMS 5.6
Observed_Density,${activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2)},kg/m3,ASTM D1250
Line_Temperature,${currentRecord?.t_line_c.toFixed(2)},degC,API MPMS 7
Line_Pressure,${currentRecord?.p_line_bar.toFixed(2)},bar,API MPMS 11.1
Correction_CTL,${activeAstmResult?.ctl.toFixed(6)},factor,ASTM D1250-04
Correction_CPL,${activeAstmResult?.cpl.toFixed(6)},factor,ASTM D1250-04
Base_Density_60F,${activeAstmResult?.rho_base.toFixed(2)},kg/m3,ASTM D1250
Specific_Gravity_60_60,${activeAstmResult?.specific_gravity_60_60.toFixed(5)},ratio,ASTM D1250
API_Gravity,${activeAstmResult?.api_gravity.toFixed(2)},deg_API,ASTM D1250
Pipeline_Flow_Velocity,${activeHydraulicResult?.flowVelocityMS.toFixed(3)},m/s,Darcy-Weisbach
Reynolds_Number,${activeHydraulicResult?.reynoldsNumber},dimensionless,Darcy-Weisbach
Darcy_Friction_Factor,${activeHydraulicResult?.frictionFactor.toFixed(5)},factor,Haaland
Hydraulic_Pressure_Drop,${activeHydraulicResult?.pressureDropBar.toFixed(2)},bar,Darcy-Weisbach
Drill_Applied_Torque,${activeDrillResult?.torqueNm.toFixed(0)},Nm,API Spec 5DP
Drill_Shear_Stress,${activeDrillResult?.torsionalShearStressMPa.toFixed(2)},MPa,API Spec 5DP
Drill_Safety_Factor,${activeDrillResult?.safetyFactor.toFixed(3)},ratio,API Spec 5DP
Water_Cut_Percentage,${activeMultiphaseResult?.water_cut_percentage.toFixed(2)},pct,API MPMS 20.1
Net_Dry_Oil_Mass_Rate,${activeMultiphaseResult?.net_oil_mass_rate_kg_s.toFixed(2)},kg/s,API MPMS 20.1
Net_Standard_Oil_BPD,${Math.round(activeMultiphaseResult?.net_oil_bpd || 0)},Barrels/Day,API MPMS 11.1
`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `VARUNA_PHYSICS_AUDIT_${selectedAssetId || 'KG-D6'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic values formatted at 10 Hz
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

  // Hydraulic parameters
  const hydVel = activeHydraulicResult?.flowVelocityMS.toFixed(3) || '2.410';
  const hydRe = activeHydraulicResult?.reynoldsNumber.toLocaleString() || '128,450';
  const hydF = activeHydraulicResult?.frictionFactor.toFixed(5) || '0.01824';
  const hydDp = activeHydraulicResult?.pressureDropBar.toFixed(2) || '14.82';
  const hydD = activeHydraulicResult?.effectiveDiameterM.toFixed(3) || '0.457';
  const hydBlock = activeHydraulicResult?.blockageSeverityPct.toFixed(1) || '0.0';

  // Drill mechanics parameters
  const drillTorque = (activeDrillResult?.torqueNm ? (activeDrillResult.torqueNm / 1000).toFixed(1) : '28.4');
  const drillTau = activeDrillResult?.torsionalShearStressMPa.toFixed(1) || '184.2';
  const drillSF = activeDrillResult?.safetyFactor.toFixed(2) || '2.28';
  const drillRPM = activeDrillResult?.rotarySpeedRPM || 120;
  const drillPower = activeDrillResult?.rotaryPowerKW.toFixed(1) || '356.9';
  const drillAcoustic = activeDrillResult?.vibrationAcousticDb.toFixed(1) || '78.4';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-dock text-white font-sans flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-blue/50 border border-reliance-cyan/40 text-reliance-cyan shadow-cyan-glow">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/30 font-bold uppercase">
                  ASTM D1250 • DARCY-WEISBACH • KALMAN 1D
                </span>
                <span className="text-xs text-reliance-textMuted font-mono">
                  {assetInfo?.name || selectedAssetId}
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Interactive Physics & Real-Time Mathematical Derivations
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reliance-navy hover:bg-reliance-blue/50 border border-emerald-400/40 text-xs font-mono text-emerald-300 transition-all cursor-pointer"
              title="Download full CSV dataset"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT CSV</span>
            </button>
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
        <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-reliance-cyan/20 bg-reliance-dark/80 text-xs font-mono shrink-0">
          {[
            { step: 1, title: '1. Coriolis Resonance', sub: 'f_osc → ρ_obs' },
            { step: 2, title: '2. ASTM D1250 VCF', sub: 'CTL & CPL Factors' },
            { step: 3, title: '3. Darcy Hydraulics', sub: 'ΔP Friction & Choke' },
            { step: 4, title: '4. Drill Mechanics', sub: 'Torque & Stress τ' },
            { step: 5, title: '5. Multiphase Cut', sub: 'WC% → Net BPD' },
            { step: 6, title: '6. Kalman Filter 1D', sub: 'Innovation & Gain' },
          ].map((tab) => (
            <button
              key={tab.step}
              onClick={() => setActiveTab(tab.step)}
              className={`py-3 px-2.5 text-left transition-all cursor-pointer border-r border-reliance-cyan/15 ${
                activeTab === tab.step
                  ? 'bg-reliance-navy/90 text-reliance-cyan border-b-2 border-b-reliance-cyan font-bold shadow-cyan-glow'
                  : 'text-reliance-textMuted hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="text-[11px] truncate">{tab.title}</div>
              <div className="text-[9px] text-white/50 truncate">{tab.sub}</div>
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

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      API Gravity (°API):
                    </div>
                    <KaTeXBlock math={`^\\circ\\text{API} = \\frac{141.5}{\\text{SG}_{60/60}} - 131.5 = \\frac{141.5}{${sgVal}} - 131.5 = ${apiVal}^\\circ\\text{API}`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DARCY-WEISBACH PIPELINE HYDRAULICS */}
          {activeTab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-sky-400" />
                  3. Darcy-Weisbach Subsea Pipeline Hydraulics & Hydrate Friction
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Hydrodynamic pipe flow friction model tracking boundary layer shear, Reynolds number, and pressure drop along subsea gathering flowlines.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Flow Velocity & Reynolds Number:
                    </div>
                    <KaTeXBlock math={`v = \\frac{4 \\dot{m}}{\\pi \\rho D_{\\text{eff}}^2} = ${hydVel}\\,\\text{m/s}, \\quad Re = \\frac{\\rho v D_{\\text{eff}}}{\\mu} = ${hydRe}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Haaland Explicit Darcy Friction Factor:
                    </div>
                    <KaTeXBlock math={`f_D = \\left[-1.8 \\log_{10}\\left(\\left(\\frac{\\varepsilon/D}{3.7}\\right)^{1.11} + \\frac{6.9}{Re}\\right)\\right]^{-2} = ${hydF}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Darcy-Weisbach Differential Pressure Drop (ΔP):
                    </div>
                    <KaTeXBlock math={`\\Delta P = f_D \\cdot \\frac{L}{D_{\\text{eff}}} \\cdot \\frac{\\rho v^2}{2} = ${hydDp}\\,\\text{bar} \\quad (D_{\\text{eff}} = ${hydD}\\,\\text{m})`} />
                  </div>

                  <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                    <span className="text-xs font-mono text-sky-300">BLOCKAGE CONSTRICTION SEVERITY:</span>
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      {hydBlock}% CHOKED ({activeHydraulicResult?.flowRegime.toUpperCase()})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DRILLSTRING TORSIONAL MECHANICS */}
          {activeTab === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  4. Downhole Drillstring Mechanics & Torsional Stress Limits
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Resolves downhole shear stress, polar moment of inertia J, rotary power, and API Spec 5DP steel yield failure margins.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Polar Moment of Inertia (J):
                    </div>
                    <KaTeXBlock math={`J = \\frac{\\pi}{2}\\left(r_o^4 - r_i^4\\right) = \\frac{\\pi}{2}\\left(0.0841^4 - 0.0635^4\\right) = 5.297 \\times 10^{-5}\\,\\text{m}^4`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Maximum Torsional Shear Stress (τ_max):
                    </div>
                    <KaTeXBlock math={`\\tau_{\\text{max}} = \\frac{T \\cdot r_o}{J} = \\frac{${drillTorque}\\,\\text{kNm} \\times 0.0841}{5.297 \\times 10^{-5}} = ${drillTau}\\,\\text{MPa}`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Yield Safety Factor (SF) & Rotary Power:
                    </div>
                    <KaTeXBlock math={`SF = \\frac{\\tau_{\\text{yield}}}{\\tau_{\\text{max}}} = \\frac{420.0}{${drillTau}} = ${drillSF}, \\quad P_{\\text{rotary}} = T \\cdot \\omega = ${drillPower}\\,\\text{kW}`} />
                  </div>

                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <span className="text-xs font-mono text-amber-300">DRILL ACOUSTIC VIBRATION:</span>
                    <span className="text-xs font-mono font-bold text-white uppercase">
                      {drillAcoustic} dB ({drillRPM} RPM)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: MULTIPHASE WATER CUT & NET OIL */}
          {activeTab === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  5. Multiphase Cut & Net Standard Volume (Barrels Per Day)
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

          {/* STEP 6: KALMAN FILTER 1D RECURSIVE ESTIMATION */}
          {activeTab === 6 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-reliance-navy/50 border border-reliance-cyan/30">
                <h3 className="text-xs font-mono text-reliance-cyan uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  6. Discrete 1D Kalman Filter Recursive State Estimation
                </h3>
                <p className="text-xs text-reliance-textMuted mb-3 leading-relaxed">
                  Eliminates multiphase bubble noise, hydraulic cavitation spikes, and sensor transducer drift in real-time.
                </p>

                <div className="space-y-3 bg-reliance-dark/90 p-4 rounded-lg border border-reliance-cyan/20">
                  <div>
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      State Prediction & Error Covariance Extrapolation:
                    </div>
                    <KaTeXBlock math={`\\hat{x}_{k|k-1} = \\hat{x}_{k-1|k-1}, \\quad P_{k|k-1} = P_{k-1|k-1} + Q \\quad (Q = 0.02)`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Kalman Gain Matrix (K_k):
                    </div>
                    <KaTeXBlock math={`K_k = \\frac{P_{k|k-1}}{P_{k|k-1} + R} = \\frac{0.074}{0.074 + 0.250} = 0.2284 \\quad (R = 0.25)`} />
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-mono text-reliance-textMuted mb-1">
                      Measurement Update & Innovation Residual:
                    </div>
                    <KaTeXBlock math={`\\hat{x}_{k|k} = \\hat{x}_{k|k-1} + K_k \\cdot \\left(z_k - \\hat{x}_{k|k-1}\\right) = ${pressBar}\\,\\text{bar}`} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-reliance-cyan/20 bg-reliance-navy/70 flex items-center justify-between text-xs font-mono text-reliance-textMuted shrink-0">
          <span>MATHEMATICAL KERNEL: RELIANCE SUBSEA CYBER-PHYSICAL SUITE v2.0</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300">10 Hz LIVE REACTIVE SOLVER</span>
          </div>
        </div>
      </div>
    </div>
  );
};
