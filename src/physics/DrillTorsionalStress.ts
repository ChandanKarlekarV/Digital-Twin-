/**
 * Downhole Drillstring Mechanics & Torsional Stress Engine
 * Computes polar moment of inertia J, torsional shear stress τ, yield safety factor SF,
 * rotary power dissipation, and acoustic vibration emission index.
 */

export interface DrillMechanicsInput {
  torqueKNm: number;         // Applied surface/downhole torque (kNm)
  rotarySpeedRPM: number;    // Rotary speed (RPM)
  outerRadiusM?: number;     // Drill pipe outer radius (m, default: 0.084m = 6-5/8" pipe)
  innerRadiusM?: number;     // Drill pipe inner radius (m, default: 0.0635m = 5" ID)
  drillLengthM?: number;     // Total drillstring length (m, default: 2040m)
  steelYieldStressMPa?: number; // S-135 grade steel yield shear stress (MPa, default: 420 MPa)
  isJamActive?: boolean;     // Mechanical keyseat or bit stuck flag
}

export interface DrillMechanicsResult {
  torqueNm: number;
  rotarySpeedRPM: number;
  polarMomentJ: number;      // m⁴
  torsionalShearStressMPa: number;
  yieldLimitMPa: number;
  safetyFactor: number;
  rotaryPowerKW: number;
  vibrationAcousticDb: number;
  bitWearIndex: number;      // 0.0 to 1.0
  mechanicalStatus: 'nominal' | 'warning_high_torque' | 'critical_yield_breach' | 'stalled_jam';
}

export class DrillTorsionalStressEngine {
  private readonly DEFAULT_R_OUTER = 0.0841; // 6-5/8" OD drill pipe (0.168m dia)
  private readonly DEFAULT_R_INNER = 0.0635; // 5.0" ID
  private readonly DEFAULT_YIELD_SHEAR_MPA = 420.0; // API Spec 5DP S-135 High-Strength Drill Pipe
  private readonly SHEAR_MODULUS_GPA = 79.3; // High-strength steel G (GPa)

  public calculate(input: DrillMechanicsInput): DrillMechanicsResult {
    const rO = input.outerRadiusM || this.DEFAULT_R_OUTER;
    const rI = input.innerRadiusM || this.DEFAULT_R_INNER;
    const yieldLimit = input.steelYieldStressMPa || this.DEFAULT_YIELD_SHEAR_MPA;
    const torqueNm = Math.max(100, input.torqueKNm * 1000);
    const rpm = input.isJamActive ? 0 : Math.max(0, input.rotarySpeedRPM);

    // Polar Moment of Inertia J = (π / 2) * (r_o^4 - r_i^4)
    const J = (Math.PI / 2) * (Math.pow(rO, 4) - Math.pow(rI, 4));

    // Maximum Torsional Shear Stress τ_max = (T * r_o) / J
    const shearStressPa = (torqueNm * rO) / J;
    const shearStressMPa = shearStressPa / 1e6;

    // Safety Factor SF = τ_yield / τ_max
    const safetyFactor = Math.max(0.1, yieldLimit / shearStressMPa);

    // Rotary Power P = T * ω = T * (2π * N / 60) in Watts
    const omega = (2 * Math.PI * rpm) / 60;
    const powerWatts = torqueNm * omega;
    const powerKW = powerWatts / 1000;

    // Acoustic emission and bit wear index
    let acousticDb = 72.0 + (torqueNm / 50000) * 18.0 + (rpm / 150) * 6.0;
    let wearIndex = Math.min(1.0, (torqueNm / 45000) * 0.7 + (1.0 - Math.min(1.0, safetyFactor / 2.5)) * 0.3);

    if (input.isJamActive) {
      acousticDb = 108.5; // High acoustic strain shockwave
      wearIndex = 0.95;
    }

    let status: 'nominal' | 'warning_high_torque' | 'critical_yield_breach' | 'stalled_jam' = 'nominal';
    if (input.isJamActive || rpm === 0) {
      status = 'stalled_jam';
    } else if (safetyFactor < 1.15) {
      status = 'critical_yield_breach';
    } else if (safetyFactor < 1.6) {
      status = 'warning_high_torque';
    }

    return {
      torqueNm: Number(torqueNm.toFixed(0)),
      rotarySpeedRPM: rpm,
      polarMomentJ: Number(J.toExponential(4)),
      torsionalShearStressMPa: Number(shearStressMPa.toFixed(2)),
      yieldLimitMPa: yieldLimit,
      safetyFactor: Number(safetyFactor.toFixed(3)),
      rotaryPowerKW: Number(powerKW.toFixed(1)),
      vibrationAcousticDb: Number(acousticDb.toFixed(1)),
      bitWearIndex: Number(wearIndex.toFixed(2)),
      mechanicalStatus: status,
    };
  }
}

export const drillTorsionalEngine = new DrillTorsionalStressEngine();
