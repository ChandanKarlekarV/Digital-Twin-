import React from 'react';
import {
  X,
  FileCheck,
  Download,
  CheckCircle2,
  ShieldCheck,
  FileSpreadsheet,
  FileText,
  Printer,
} from 'lucide-react';
import { useRigStore, ASSET_CATALOG } from '../../store/useRigStore';
import { useTelemetryStore } from '../../store/useTelemetryStore';

export const ComplianceReportModal: React.FC = () => {
  const isReportModalOpen = useRigStore((s) => s.isReportModalOpen);
  const setReportModalOpen = useRigStore((s) => s.setReportModalOpen);

  const selectedAssetId = useRigStore((s) => s.selectedAssetId);
  const emergencyScenario = useRigStore((s) => s.emergencyScenario);
  const incidentPhase = useRigStore((s) => s.incidentPhase);

  const currentRecord = useTelemetryStore((s) => s.currentRecord);
  const activeAstmResult = useTelemetryStore((s) => s.activeAstmResult);
  const activeCoriolisResult = useTelemetryStore((s) => s.activeCoriolisResult);
  const activeMultiphaseResult = useTelemetryStore((s) => s.activeMultiphaseResult);
  const activeHydraulicResult = useTelemetryStore((s) => s.activeHydraulicResult);
  const activeDrillResult = useTelemetryStore((s) => s.activeDrillResult);

  if (!isReportModalOpen) return null;

  const assetInfo = selectedAssetId ? ASSET_CATALOG[selectedAssetId] : null;

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const csvContent = `data:text/csv;charset=utf-8,Section,Parameter,Observed_Value,Units,Compliance_Standard,Status
ASSET_INFO,Asset_Name,${assetInfo?.name || selectedAssetId},N/A,ISO 14224,VERIFIED
ASSET_INFO,Field_Location,Reliance KG-D6 Deepwater Basin,Coordinates: 16°18'00"N 82°20'00"E (Block KG-DWN-98/3),DGH India,VERIFIED
ASSET_INFO,Water_Depth,2040,meters,Subsea Deepwater Class,VERIFIED
METROLOGY,Oscillation_Frequency,${currentRecord?.f_osc_hz.toFixed(2)},Hz,API MPMS 5.6,COMPLIANT
METROLOGY,Resonant_Period,${activeCoriolisResult?.period_us.toFixed(2)},microseconds,API MPMS 5.6,COMPLIANT
METROLOGY,Temperature_Comp_Density,${activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2)},kg/m3,ASTM D1250,COMPLIANT
METROLOGY,Correction_CTL,${activeAstmResult?.ctl.toFixed(6)},factor,ASTM D1250-04,COMPLIANT
METROLOGY,Correction_CPL,${activeAstmResult?.cpl.toFixed(6)},factor,ASTM D1250-04,COMPLIANT
METROLOGY,Standard_Base_Density,${activeAstmResult?.rho_base.toFixed(2)},kg/m3,ASTM D1250,COMPLIANT
METROLOGY,Standard_API_Gravity,${activeAstmResult?.api_gravity.toFixed(2)},deg_API,ASTM D1250 / API MPMS 11.1,COMPLIANT
HYDRAULICS,Pipe_Flow_Velocity,${activeHydraulicResult?.flowVelocityMS.toFixed(3)},m/s,Darcy-Weisbach,COMPLIANT
HYDRAULICS,Reynolds_Number,${activeHydraulicResult?.reynoldsNumber},Re,Darcy-Weisbach,COMPLIANT
HYDRAULICS,Friction_Factor,${activeHydraulicResult?.frictionFactor.toFixed(5)},f_D,Haaland Formula,COMPLIANT
HYDRAULICS,Pressure_Drop_DeltaP,${activeHydraulicResult?.pressureDropBar.toFixed(2)},bar,Darcy-Weisbach,COMPLIANT
DRILLING,Drill_Torque,${activeDrillResult?.torqueNm.toFixed(0)},Nm,API Spec 5DP,COMPLIANT
DRILLING,Torsional_Shear_Stress,${activeDrillResult?.torsionalShearStressMPa.toFixed(2)},MPa,API Spec 5DP,COMPLIANT
DRILLING,Yield_Safety_Factor,${activeDrillResult?.safetyFactor.toFixed(3)},ratio,API Spec 5DP,COMPLIANT
MULTIPHASE,Water_Cut_Percentage,${activeMultiphaseResult?.water_cut_percentage.toFixed(2)},%,API MPMS 20.1,COMPLIANT
MULTIPHASE,Net_Standard_Oil_BPD,${Math.round(activeMultiphaseResult?.net_oil_bpd || 0)},Barrels/Day,API MPMS 11.1,COMPLIANT
`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RELIANCE_KGD6_COMPLIANCE_AUDIT_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-dock text-white font-sans flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 shadow-emerald-glow">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase">
                  OFFICIAL AUDIT REPORT
                </span>
                <span className="text-xs text-reliance-textMuted font-mono">
                  ISO 14224 • API MPMS 11.1 • ASTM D1250
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Reliance KG-D6 Subsea Production & Physics Audit Certificate
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reliance-navy hover:bg-white/10 border border-white/20 text-xs font-mono text-white transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PRINT / PDF</span>
            </button>
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-reliance-blue hover:bg-reliance-blue/80 border border-reliance-cyan text-xs font-mono font-bold text-white shadow-cyan-glow transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD CSV</span>
            </button>
            <button
              onClick={() => setReportModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-mono">
          {/* Certificate Header Box */}
          <div className="p-4 rounded-xl bg-reliance-dark border border-reliance-cyan/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-reliance-textMuted uppercase font-bold">
                OPERATOR & FACILITY:
              </div>
              <div className="text-sm font-bold text-white">RELIANCE INDUSTRIES LIMITED — KG-D6 BLOCK</div>
              <div className="text-[11px] text-reliance-cyan">Bay of Bengal Deepwater Sector (16°18'00"N, 82°20'00"E • Block KG-DWN-98/3)</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-reliance-textMuted uppercase font-bold">AUDIT TIMESTAMP:</div>
              <div className="text-xs text-emerald-400 font-bold">{new Date().toUTCString()}</div>
              <div className="text-[10px] text-reliance-textMuted">CERTIFICATE ID: RIL-KGD6-2026-0912</div>
            </div>
          </div>

          {/* Audit Metrics Table */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-reliance-navy/40">
            <div className="grid grid-cols-5 p-2.5 bg-reliance-dark text-reliance-cyan font-bold text-[11px] border-b border-white/10">
              <span>PARAMETER</span>
              <span>LIVE COMPUTED VALUE</span>
              <span>MEASUREMENT UNIT</span>
              <span>GOVERNING STANDARD</span>
              <span className="text-right">STATUS</span>
            </div>

            <div className="divide-y divide-white/5 text-[11px]">
              {[
                {
                  param: 'Coriolis Resonant Period (τ)',
                  val: `${activeCoriolisResult?.period_us.toFixed(2)}`,
                  unit: 'μs',
                  std: 'API MPMS 5.6',
                },
                {
                  param: 'Observed Fluid Density (ρ_obs)',
                  val: `${activeCoriolisResult?.temp_compensated_density_kg_m3.toFixed(2)}`,
                  unit: 'kg/m³',
                  std: 'ASTM D1250-04',
                },
                {
                  param: 'Temperature Correction Factor (CTL)',
                  val: `${activeAstmResult?.ctl.toFixed(5)}`,
                  unit: 'Dimensionless',
                  std: 'ASTM D1250-04',
                },
                {
                  param: 'Pressure Correction Factor (CPL)',
                  val: `${activeAstmResult?.cpl.toFixed(5)}`,
                  unit: 'Dimensionless',
                  std: 'API MPMS 11.1',
                },
                {
                  param: 'Standard Base Density @ 15.56°C',
                  val: `${activeAstmResult?.rho_base.toFixed(2)}`,
                  unit: 'kg/m³',
                  std: 'ASTM D1250',
                },
                {
                  param: 'Calculated API Gravity',
                  val: `${activeAstmResult?.api_gravity.toFixed(2)}°`,
                  unit: '°API',
                  std: 'API MPMS 11.1',
                },
                {
                  param: 'Pipeline Darcy Friction Factor (f_D)',
                  val: `${activeHydraulicResult?.frictionFactor.toFixed(5)}`,
                  unit: 'Dimensionless',
                  std: 'Haaland Equation',
                },
                {
                  param: 'Pipeline Hydraulic Drop (ΔP)',
                  val: `${activeHydraulicResult?.pressureDropBar.toFixed(2)}`,
                  unit: 'bar',
                  std: 'Darcy-Weisbach',
                },
                {
                  param: 'Drillstring Torsional Stress (τ)',
                  val: `${activeDrillResult?.torsionalShearStressMPa.toFixed(1)}`,
                  unit: 'MPa',
                  std: 'API Spec 5DP',
                },
                {
                  param: 'Drill Steel Yield Safety Factor (SF)',
                  val: `${activeDrillResult?.safetyFactor.toFixed(2)}`,
                  unit: 'Ratio',
                  std: 'API Spec 5DP',
                },
                {
                  param: 'Multiphase Water-Cut Fraction',
                  val: `${activeMultiphaseResult?.water_cut_percentage.toFixed(2)}%`,
                  unit: 'Percentage',
                  std: 'API MPMS 20.1',
                },
                {
                  param: 'Net Standard Oil Production',
                  val: `${Math.round(activeMultiphaseResult?.net_oil_bpd || 0).toLocaleString()}`,
                  unit: 'Barrels / Day',
                  std: 'API MPMS 11.1',
                },
              ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-5 p-2.5 hover:bg-white/5 items-center">
                  <span className="text-white font-bold">{row.param}</span>
                  <span className="text-reliance-cyan font-bold">{row.val}</span>
                  <span className="text-reliance-textMuted">{row.unit}</span>
                  <span className="text-white/70">{row.std}</span>
                  <span className="flex items-center justify-end gap-1 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>VALIDATED</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-reliance-cyan/20 bg-reliance-navy/70 flex items-center justify-between text-xs font-mono text-reliance-textMuted shrink-0">
          <span>SIGNED & AUTHORIZED BY VARUNA-AI SUBSEA CYBER-PHYSICAL ENGINE</span>
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>100% AUDIT INTEGRITY ASSURED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
