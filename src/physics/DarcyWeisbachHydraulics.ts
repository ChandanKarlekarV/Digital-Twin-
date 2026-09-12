/**
 * Darcy-Weisbach Subsea Pipeline Hydraulic & Blockage Friction Engine
 * Computes fluid velocity, Reynolds number, Haaland explicit friction factor,
 * pressure differential ΔP, and wax/hydrate effective hydraulic constriction.
 */

export interface HydraulicCalculationInput {
  massRateKgS: number;       // Mass flow rate (kg/s)
  densityKgM3: number;       // Fluid mixture density (kg/m³)
  pipeDiameterM?: number;    // Pipe inner diameter (m, default: 0.457m = 18")
  pipeLengthM?: number;      // Pipe segment length (m, default: 1500m)
  roughnessM?: number;       // Steel pipe surface roughness (m, default: 0.000045m)
  viscosityPaS?: number;     // Dynamic viscosity (Pa·s, default: 0.0085 Pa·s)
  blockageRatio?: number;    // Cross-sectional constriction ratio (0.0 to 0.95)
}

export interface HydraulicCalculationResult {
  nominalDiameterM: number;
  effectiveDiameterM: number;
  flowVelocityMS: number;
  reynoldsNumber: number;
  flowRegime: 'laminar' | 'transitional' | 'turbulent';
  frictionFactor: number;
  pressureDropPa: number;
  pressureDropBar: number;
  headLossMeters: number;
  blockageSeverityPct: number;
}

export class DarcyWeisbachEngine {
  private readonly DEFAULT_DIAMETER = 0.457; // 18-inch subsea header
  private readonly DEFAULT_LENGTH = 1500.0;  // 1.5 km seabed manifold run
  private readonly DEFAULT_ROUGHNESS = 0.000045; // Commercial carbon steel
  private readonly DEFAULT_VISCOSITY = 0.0085;   // 8.5 cP medium crude

  public calculate(input: HydraulicCalculationInput): HydraulicCalculationResult {
    const D0 = input.pipeDiameterM || this.DEFAULT_DIAMETER;
    const L = input.pipeLengthM || this.DEFAULT_LENGTH;
    const eps = input.roughnessM || this.DEFAULT_ROUGHNESS;
    const mu = input.viscosityPaS || this.DEFAULT_VISCOSITY;
    const rho = Math.max(100, input.densityKgM3);
    const mDot = Math.max(0.1, input.massRateKgS);
    const blockage = Math.min(0.95, Math.max(0, input.blockageRatio || 0));

    // Effective constricted hydraulic diameter
    // Area_eff = Area_0 * (1 - blockage) => D_eff = D0 * sqrt(1 - blockage)
    const effectiveDiameter = D0 * Math.sqrt(Math.max(0.05, 1 - blockage));

    // Volumetric flow rate Q (m³/s) and cross-sectional area A (m²)
    const area = (Math.PI / 4) * Math.pow(effectiveDiameter, 2);
    const volRateQ = mDot / rho;
    const velocity = volRateQ / area;

    // Reynolds number Re = (rho * v * D) / mu
    const reynolds = (rho * velocity * effectiveDiameter) / mu;

    // Determine flow regime and Darcy friction factor (f_D)
    let frictionFactor = 0.02;
    let regime: 'laminar' | 'transitional' | 'turbulent' = 'turbulent';

    if (reynolds < 2300) {
      regime = 'laminar';
      frictionFactor = 64 / Math.max(1, reynolds);
    } else if (reynolds < 4000) {
      regime = 'transitional';
      // Interpolate between laminar and turbulent
      const fLam = 64 / 2300;
      const fTurb = Math.pow(-1.8 * Math.log10(Math.pow(eps / (3.7 * effectiveDiameter), 1.11) + 6.9 / 4000), -2);
      const frac = (reynolds - 2300) / 1700;
      frictionFactor = fLam + frac * (fTurb - fLam);
    } else {
      regime = 'turbulent';
      // Haaland Explicit Formula for turbulent pipe flow
      const relRoughness = eps / (3.7 * effectiveDiameter);
      const logTerm = -1.8 * Math.log10(Math.pow(relRoughness, 1.11) + 6.9 / reynolds);
      frictionFactor = Math.pow(logTerm, -2);
    }

    // Darcy-Weisbach Pressure Drop: ΔP = f_D * (L / D) * (rho * v^2 / 2)
    const dynamicPressure = (rho * Math.pow(velocity, 2)) / 2;
    const pressureDropPa = frictionFactor * (L / effectiveDiameter) * dynamicPressure;
    const pressureDropBar = pressureDropPa / 100000;
    const headLossMeters = pressureDropPa / (rho * 9.80665);

    return {
      nominalDiameterM: D0,
      effectiveDiameterM: Number(effectiveDiameter.toFixed(4)),
      flowVelocityMS: Number(velocity.toFixed(3)),
      reynoldsNumber: Math.round(reynolds),
      flowRegime: regime,
      frictionFactor: Number(frictionFactor.toFixed(5)),
      pressureDropPa: Number(pressureDropPa.toFixed(0)),
      pressureDropBar: Number(pressureDropBar.toFixed(2)),
      headLossMeters: Number(headLossMeters.toFixed(2)),
      blockageSeverityPct: Number((blockage * 100).toFixed(1)),
    };
  }
}

export const darcyWeisbachEngine = new DarcyWeisbachEngine();
