/**
 * Synthetic Coriolis Density & Resonant Frequency Model
 * Mathematical Foundation for KG-D6 Subsea Coriolis Transmitters.
 */

export interface CoriolisParams {
  C1: number; // Calibration factor 1 (default: 4.2875e-4)
  C2: number; // Calibration factor 2 (default: 0.5218)
  KT: number; // Temperature compensation coefficient (default: -0.0125 kg/m³/°C)
  T0: number; // Reference calibration temperature (°C, default: 20.0)
  tubeStiffness_k: number; // N/m
  tubeMass_m: number;      // kg
  tubeVolume_V: number;    // m³
}

export const DEFAULT_CORIOLIS_PARAMS: CoriolisParams = {
  C1: 4.2875e-4,
  C2: 0.5218,
  KT: -0.0125,
  T0: 20.0,
  tubeStiffness_k: 8.5e6,
  tubeMass_m: 0.85,
  tubeVolume_V: 0.0012,
};

export interface CoriolisCalculationResult {
  frequency_hz: number;
  period_us: number;
  uncompensated_density_kg_m3: number;
  temp_compensated_density_kg_m3: number;
  temperature_c: number;
  math_steps: {
    period_formula: string;
    period_val: string;
    raw_density_formula: string;
    raw_density_val: string;
    temp_comp_formula: string;
    temp_comp_val: string;
  };
}

export class CoriolisEngine {
  private params: CoriolisParams;

  constructor(params: Partial<CoriolisParams> = {}) {
    this.params = { ...DEFAULT_CORIOLIS_PARAMS, ...params };
  }

  /**
   * Compute tube oscillation period tau in microseconds from frequency (Hz).
   * tau = 10^6 / f
   */
  public computePeriodMicroseconds(frequencyHz: number): number {
    if (frequencyHz <= 0) return 0;
    return 1e6 / frequencyHz;
  }

  /**
   * Compute density from resonant frequency and temperature.
   * rho_obs(T) = C1 * tau^2 - C2 + KT * (T - T0)
   */
  public computeDensityFromFrequency(
    frequencyHz: number,
    temperatureC: number
  ): CoriolisCalculationResult {
    const tau = this.computePeriodMicroseconds(frequencyHz);
    const { C1, C2, KT, T0 } = this.params;

    // Density without temperature compensation
    const rhoUncomp = C1 * (tau * tau) - C2;

    // Temperature compensation delta
    const deltaT = temperatureC - T0;
    const tempCorrection = KT * deltaT;
    const rhoObs = rhoUncomp + tempCorrection;

    return {
      frequency_hz: frequencyHz,
      period_us: tau,
      uncompensated_density_kg_m3: rhoUncomp,
      temp_compensated_density_kg_m3: Math.max(0, rhoObs),
      temperature_c: temperatureC,
      math_steps: {
        period_formula: `\\tau = \\frac{10^6}{f}`,
        period_val: `${tau.toFixed(2)}\\,\\mu\\text{s}`,
        raw_density_formula: `\\rho_{\\text{raw}} = C_1 \\cdot \\tau^2 - C_2`,
        raw_density_val: `${rhoUncomp.toFixed(2)}\\,\\text{kg/m}^3`,
        temp_comp_formula: `\\rho_{\\text{obs}}(T) = \\rho_{\\text{raw}} + K_T (T - T_0)`,
        temp_comp_val: `${rhoObs.toFixed(2)}\\,\\text{kg/m}^3`,
      },
    };
  }

  /**
   * Inverse calculation: Compute theoretical resonant frequency for a given fluid density and temperature.
   * f = 10^6 / sqrt((rho - KT*(T - T0) + C2) / C1)
   */
  public computeFrequencyFromDensity(densityKgM3: number, temperatureC: number): number {
    const { C1, C2, KT, T0 } = this.params;
    const targetRhoUncomp = densityKgM3 - KT * (temperatureC - T0);
    const tauSquared = (targetRhoUncomp + C2) / C1;
    if (tauSquared <= 0) return 0;
    const tau = Math.sqrt(tauSquared);
    return 1e6 / tau;
  }
}

export const coriolisEngine = new CoriolisEngine();
