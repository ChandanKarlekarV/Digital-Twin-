/**
 * ASTM D1250 / API MPMS Chapter 11.1 Standard Density & VCF Correction Engine
 * Precision Newton-Raphson iterative solver for base density, VCF, and API Gravity.
 */

export interface ASTM1250Result {
  rho_obs: number;          // Observed density (kg/m³)
  t_obs: number;            // Observed temperature (°C)
  p_obs_bar: number;        // Observed line pressure (bar)
  rho_base: number;         // Standard density at 15.56°C (kg/m³)
  specific_gravity_60_60: number; // SG 60/60 relative to water at 60°F (999.016 kg/m³)
  api_gravity: number;      // °API Gravity
  api_classification: string; // e.g., 'Light Condensate / Light Crude'
  ctl: number;              // Correction for Temperature on Liquid
  cpl: number;              // Correction for Pressure on Liquid
  vcf_total: number;        // Combined Volume Correction Factor (CTL * CPL)
  iterations_count: number; // Newton-Raphson iterations
  math_steps: {
    ctl_formula: string;
    ctl_val: string;
    cpl_formula: string;
    cpl_val: string;
    base_density_formula: string;
    base_density_val: string;
    sg_formula: string;
    sg_val: string;
    api_formula: string;
    api_val: string;
  };
}

export class ASTM1250Engine {
  // ASTM D1250 constants for Crude Oil / Condensate (Commodity group A/B)
  public static readonly K0 = 341.0957;
  public static readonly K1 = 0.0;
  public static readonly RHO_WATER_60F = 999.016; // kg/m³ at 15.56°C (60°F)
  public static readonly FLUID_COMPRESSIBILITY_F = 1.25e-5; // bar^-1
  public static readonly EQUILIBRIUM_VAPOR_PRESSURE_PE = 1.013; // bar (atmospheric baseline)
  public static readonly BASE_TEMP_C = 15.56; // 60°F in °C

  /**
   * Compute Thermal Expansion Coefficient alpha_T given base density.
   * alpha_T = K0 / (rho_base^2) + K1 / rho_base
   */
  public computeAlphaT(rhoBase: number): number {
    if (rhoBase <= 0) return 0;
    return ASTM1250Engine.K0 / (rhoBase * rhoBase) + ASTM1250Engine.K1 / rhoBase;
  }

  /**
   * Compute Correction for Temperature of Liquid (CTL).
   * CTL = exp[-alpha_T * deltaT * (1 + 0.8 * alpha_T * deltaT)]
   */
  public computeCTL(rhoBase: number, tempC: number): number {
    const deltaT = tempC - ASTM1250Engine.BASE_TEMP_C;
    const alphaT = this.computeAlphaT(rhoBase);
    const exponent = -alphaT * deltaT * (1.0 + 0.8 * alphaT * deltaT);
    return Math.exp(exponent);
  }

  /**
   * Compute Correction for Pressure of Liquid (CPL).
   * CPL = 1 / (1 - F * (P_obs - P_e))
   */
  public computeCPL(pressureBar: number): number {
    const deltaP = Math.max(0, pressureBar - ASTM1250Engine.EQUILIBRIUM_VAPOR_PRESSURE_PE);
    const denominator = 1.0 - ASTM1250Engine.FLUID_COMPRESSIBILITY_F * deltaP;
    if (denominator <= 0.01) return 1.0;
    return 1.0 / denominator;
  }

  /**
   * Solve for base density rho_base at 15.56°C using Newton-Raphson iteration:
   * Target: f(rho_base) = rho_base * CTL(rho_base, T) * CPL(P) - rho_obs = 0
   */
  public solveBaseDensity(
    rhoObs: number,
    tempC: number,
    pressureBar: number,
    maxIterations = 20,
    tolerance = 1e-5
  ): { rhoBase: number; iterations: number } {
    const cpl = this.computeCPL(pressureBar);
    
    // Initial guess
    let rho = rhoObs > 0 ? rhoObs : 820.0;
    let iter = 0;

    for (iter = 0; iter < maxIterations; iter++) {
      const ctl = this.computeCTL(rho, tempC);
      const fVal = rho * ctl * cpl - rhoObs;

      if (Math.abs(fVal) < tolerance) {
        break;
      }

      // Numerical derivative f'(rho)
      const h = 1e-4;
      const ctlH = this.computeCTL(rho + h, tempC);
      const fValH = (rho + h) * ctlH * cpl - rhoObs;
      const fPrime = (fValH - fVal) / h;

      if (Math.abs(fPrime) < 1e-9) break;

      const step = fVal / fPrime;
      rho = rho - step;

      // Bound safety
      if (rho < 500) rho = 500;
      if (rho > 1200) rho = 1200;
    }

    return { rhoBase: rho, iterations: iter + 1 };
  }

  /**
   * Compute Specific Gravity at 60°F / 60°F.
   * SG = rho_base / 999.016
   */
  public computeSpecificGravity(rhoBase: number): number {
    return rhoBase / ASTM1250Engine.RHO_WATER_60F;
  }

  /**
   * Compute API Gravity (°API).
   * °API = 141.5 / SG - 131.5
   */
  public computeAPIGravity(specificGravity: number): number {
    if (specificGravity <= 0) return 0;
    return 141.5 / specificGravity - 131.5;
  }

  /**
   * Classify oil grade by API gravity.
   */
  public classifyAPIGrade(api: number): string {
    if (api >= 45.0) return 'Very Light Condensate / Natural Gasoline';
    if (api >= 31.1) return 'Light Crude Oil (KG-D6 Spec)';
    if (api >= 22.3) return 'Medium Crude Oil';
    if (api >= 10.0) return 'Heavy Crude Oil';
    return 'Extra Heavy Crude Oil / Bitumen';
  }

  /**
   * Full ASTM D1250 Calculation Pipeline with Step-by-Step LaTeX equations.
   */
  public executeFullCorrection(
    rhoObs: number,
    tempC: number,
    pressureBar: number
  ): ASTM1250Result {
    const { rhoBase, iterations } = this.solveBaseDensity(rhoObs, tempC, pressureBar);
    const ctl = this.computeCTL(rhoBase, tempC);
    const cpl = this.computeCPL(pressureBar);
    const vcf = ctl * cpl;
    const sg = this.computeSpecificGravity(rhoBase);
    const api = this.computeAPIGravity(sg);
    const classification = this.classifyAPIGrade(api);

    const deltaT = tempC - ASTM1250Engine.BASE_TEMP_C;
    const alphaT = this.computeAlphaT(rhoBase);

    return {
      rho_obs: rhoObs,
      t_obs: tempC,
      p_obs_bar: pressureBar,
      rho_base: rhoBase,
      specific_gravity_60_60: sg,
      api_gravity: api,
      api_classification: classification,
      ctl,
      cpl,
      vcf_total: vcf,
      iterations_count: iterations,
      math_steps: {
        ctl_formula: `\\text{CTL} = \\exp\\left[-\\alpha_T \\Delta T (1 + 0.8 \\alpha_T \\Delta T)\\right]`,
        ctl_val: `${ctl.toFixed(5)} \\quad (\\Delta T = ${deltaT.toFixed(2)}^\\circ\\text{C}, \\alpha_T = ${(alphaT * 1e4).toFixed(3)} \\times 10^{-4})`,
        cpl_formula: `\\text{CPL} = \\frac{1}{1 - F \\cdot (P_{\\text{obs}} - P_e)}`,
        cpl_val: `${cpl.toFixed(5)} \\quad (P_{\\text{obs}} = ${pressureBar.toFixed(1)}\\,\\text{bar})`,
        base_density_formula: `\\rho_{\\text{base}} = \\frac{\\rho_{\\text{obs}}}{\\text{CTL} \\times \\text{CPL}}`,
        base_density_val: `${rhoBase.toFixed(2)}\\,\\text{kg/m}^3 \\quad (\\text{Converged in } ${iterations}\\text{ iterations})`,
        sg_formula: `\\text{SG}_{60/60} = \\frac{\\rho_{\\text{base}}}{\\rho_{\\text{water, 60}}}`,
        sg_val: `${sg.toFixed(4)} \\quad (\\rho_{\\text{water, 60}} = 999.016\\,\\text{kg/m}^3)`,
        api_formula: `^\\circ\\text{API} = \\frac{141.5}{\\text{SG}_{60/60}} - 131.5`,
        api_val: `${api.toFixed(2)}^\\circ\\text{API} \\quad [\\text{${classification}}]`,
      },
    };
  }
}

export const astm1250Engine = new ASTM1250Engine();
