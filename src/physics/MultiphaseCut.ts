/**
 * Multiphase Cut & Net Oil Deconvolution Engine
 * Resolves water-cut, emulsion split, mass flow separation, and standard net volume rate (BPD).
 */

export interface MultiphaseDeconvolutionResult {
  rho_mix: number;           // Measured mixture density (kg/m³)
  rho_oil_obs: number;       // In-situ oil density (kg/m³)
  rho_water_obs: number;     // In-situ water density (kg/m³)
  water_cut_vol_fraction: number; // Water Cut (0.0 to 1.0)
  water_cut_percentage: number;   // Water Cut (0% to 100%)
  gross_mass_rate_kg_s: number;   // Gross total mass flow (kg/s)
  net_oil_mass_rate_kg_s: number; // Net dry oil mass flow (kg/s)
  net_oil_mass_rate_kg_day: number; // Net dry oil mass (kg/day)
  net_oil_bpd: number;            // Net Oil in Standard Barrels Per Day (BPD)
  water_bpd: number;              // Produced Water in Barrels Per Day (BWPD)
  math_steps: {
    wc_formula: string;
    wc_val: string;
    net_mass_formula: string;
    net_mass_val: string;
    net_bpd_formula: string;
    net_bpd_val: string;
  };
}

export class MultiphaseCutEngine {
  public static readonly BARREL_TO_M3 = 0.1589873;
  public static readonly SECONDS_PER_DAY = 86400;

  /**
   * Deconvolute multiphase flow into water-cut and net oil rate.
   */
  public deconvolveFlow(
    rhoMix: number,
    rhoOilObs: number,
    grossMassRateKgS: number,
    rhoBase: number,
    rhoWaterObs = 1025.0 // Subsea formation brine density ~1025 kg/m³
  ): MultiphaseDeconvolutionResult {
    // Clamp mixture density between pure oil and brine
    const boundedRhoMix = Math.max(rhoOilObs, Math.min(rhoWaterObs, rhoMix));

    // Water cut fraction
    const deltaRho = rhoWaterObs - rhoOilObs;
    let waterCutFraction = deltaRho > 1e-4 ? (boundedRhoMix - rhoOilObs) / deltaRho : 0.0;
    waterCutFraction = Math.max(0, Math.min(1, waterCutFraction));
    const waterCutPct = waterCutFraction * 100.0;

    // Mass fraction deconvolution:
    // mass_water_frac = WC * (rho_water / rho_mix)
    const waterMassFraction = (waterCutFraction * rhoWaterObs) / (boundedRhoMix > 0 ? boundedRhoMix : 1);
    const oilMassFraction = Math.max(0, 1.0 - waterMassFraction);

    const netOilMassRateKgS = grossMassRateKgS * oilMassFraction;
    const netOilMassRateKgDay = netOilMassRateKgS * MultiphaseCutEngine.SECONDS_PER_DAY;

    // Net BPD calculation
    // Volume (m³/day) = Mass (kg/day) / rho_base
    // BPD = Volume (m³/day) / 0.1589873
    const netOilVolumeM3Day = rhoBase > 0 ? netOilMassRateKgDay / rhoBase : 0;
    const netOilBpd = netOilVolumeM3Day / MultiphaseCutEngine.BARREL_TO_M3;

    // Water BPD
    const waterMassRateKgDay = (grossMassRateKgS - netOilMassRateKgS) * MultiphaseCutEngine.SECONDS_PER_DAY;
    const waterVolumeM3Day = waterMassRateKgDay / rhoWaterObs;
    const waterBpd = waterVolumeM3Day / MultiphaseCutEngine.BARREL_TO_M3;

    return {
      rho_mix: boundedRhoMix,
      rho_oil_obs: rhoOilObs,
      rho_water_obs: rhoWaterObs,
      water_cut_vol_fraction: waterCutFraction,
      water_cut_percentage: waterCutPct,
      gross_mass_rate_kg_s: grossMassRateKgS,
      net_oil_mass_rate_kg_s: netOilMassRateKgS,
      net_oil_mass_rate_kg_day: netOilMassRateKgDay,
      net_oil_bpd: netOilBpd,
      water_bpd: waterBpd,
      math_steps: {
        wc_formula: `\\text{WC} = \\frac{\\rho_{\\text{mix}} - \\rho_{\\text{oil}}}{\\rho_{\\text{water}} - \\rho_{\\text{oil}}}`,
        wc_val: `\\frac{${boundedRhoMix.toFixed(1)} - ${rhoOilObs.toFixed(1)}}{${rhoWaterObs.toFixed(1)} - ${rhoOilObs.toFixed(1)}} = ${(waterCutFraction * 100).toFixed(2)}\\%`,
        net_mass_formula: `\\dot{m}_{\\text{net\\_oil}} = \\dot{m}_{\\text{total}} \\times \\left[1 - \\left(\\text{WC} \\cdot \\frac{\\rho_{\\text{water}}}{\\rho_{\\text{mix}}}\\right)\\right]`,
        net_mass_val: `${grossMassRateKgS.toFixed(2)}\\,\\text{kg/s} \\times ${(oilMassFraction).toFixed(4)} = ${netOilMassRateKgS.toFixed(2)}\\,\\text{kg/s}`,
        net_bpd_formula: `\\text{Net BPD} = \\frac{\\dot{m}_{\\text{net\\_oil}}(\\text{kg/day})}{\\rho_{\\text{base}} \\times 0.1589873}`,
        net_bpd_val: `\\frac{${(netOilMassRateKgDay / 1000).toFixed(1)}\\,\\text{ton/day}}{${rhoBase.toFixed(1)} \\times 0.1589873} = ${Math.round(netOilBpd).toLocaleString()}\\,\\text{BPD}`,
      },
    };
  }
}

export const multiphaseCutEngine = new MultiphaseCutEngine();
