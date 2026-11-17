/**
 * KG-D6 production network physics. Deterministic: no random numbers anywhere.
 *
 * Input: the published block rate (src/data/kgd6Production.ts). Output: pressure,
 * temperature and flow at every metered asset, from
 *   - real-gas density   rho = P M / (Z R T), Z from Papay, pseudo-criticals from Sutton
 *   - pipe friction      P_up^2 - P_dn^2 = K Q^2   (isothermal general flow equation)
 *   - riser gas column   dP = rho_g g H
 *   - flowline cooling   T_out = T_sea + (T_in - T_sea) exp(-beta Q_d / Q)
 *   - riser slugging     Gregory-Scott slug frequency, slug-body holdup (Gregory et al.)
 *   - drill string       bit torque mu W D / 3 (Pessier), ROP ~ RPM W, torsional mode c / 4L
 *
 * Every pipe segment is calibrated ONCE at the design point (the latest published quarter)
 * to the design pressures/temperatures below; from then on readings follow the physics.
 * Values marked ASSUMPTION are not published by the operator.
 */
import { KGD6_QUARTERS, MJ_FIELD, BlockProduction, productionAt } from '../data/kgd6Production';
import { astm1250Engine } from './ASTM1250Engine';

const G = 9.80665;
const R_GAS = 8.314462;
const BBL_M3 = 0.1589873;
const DAY_S = 86400;

// ---- Fluids ----
/** ASSUMPTION: lean, methane-rich gas, specific gravity 0.60 */
export const GAS_SG = 0.6;
/** Air density at standard conditions (15.56 °C, 1.01325 bar) */
const AIR_RHO_STD = 1.2232;
export const GAS_RHO_STD = GAS_SG * AIR_RHO_STD; // kg/Sm³
const GAS_M = (28.9647 * GAS_SG) / 1000; // kg/mol
// Sutton (1985) pseudo-critical properties for natural gas
const PPC_BAR = (756.8 - 131.0 * GAS_SG - 3.6 * GAS_SG ** 2) * 0.0689476;
const TPC_K = (169.2 + 349.5 * GAS_SG - 74.0 * GAS_SG ** 2) / 1.8;

/** Papay (1968) explicit Z-factor */
export function zFactor(pBar: number, tC: number): number {
  const pr = pBar / PPC_BAR;
  const tr = (tC + 273.15) / TPC_K;
  return 1 - (3.52 * pr) / 10 ** (0.9813 * tr) + (0.274 * pr * pr) / 10 ** (0.8157 * tr);
}

/** In-situ gas density, kg/m³ */
export function gasDensity(pBar: number, tC: number): number {
  return (pBar * 1e5 * GAS_M) / (zFactor(pBar, tC) * R_GAS * (tC + 273.15));
}

/** ASSUMPTION: condensate 807.2 kg/m³ at 15.56 °C (43.7 °API) */
export const CONDENSATE_RHO_15C = 807.2;
export const BRINE_RHO = 1025.0;
/** ASSUMPTION: produced-water cut of the liquid stream (not published) */
export const WATER_CUT_PCT = 3.0;
/** In-situ condensate density from ASTM D1250 forward: rho15 * CTL(T) * CPL(P), the same
 *  correction the meter later inverts, so base density and API come back exactly. */
export const condensateDensity = (tC: number, pBar = 1.01325) =>
  CONDENSATE_RHO_15C * astm1250Engine.computeCTL(CONDENSATE_RHO_15C, tC) * astm1250Engine.computeCPL(pBar);
export const mixDensity = (wcPct: number, tC: number, pBar = 1.01325) =>
  (1 - wcPct / 100) * condensateDensity(tC, pBar) + (wcPct / 100) * BRINE_RHO;

// ---- Network ----
/** ASSUMPTION: seabed temperature at ~1,000 m in the Bay of Bengal */
export const SEABED_TEMP_C = 6.0;
/** ASSUMPTION: topside arrival pressure held by the export compressors */
export const ARRIVAL_PRESSURE_BAR = 85.0;
/** ASSUMPTION: flowing reservoir-side temperature at the bottom of the wells (HPHT) */
const RESERVOIR_TEMP_C = 140.0;
/** ASSUMPTION: pipe inside diameters (m) */
const D_RISER = 0.3048; // 12"
const D_FLOWLINE = 0.2032; // 8"
const RISER_HEIGHT_M = MJ_FIELD.waterDepthM;

/** Design point = latest published quarter */
const DESIGN_Q = KGD6_QUARTERS[KGD6_QUARTERS.length - 1].gasMmscmd;

/** Design readings each segment is calibrated to (the twin's layout) */
const DESIGN = {
  topside: { p: ARRIVAL_PRESSURE_BAR, t: 38.0 },
  riserA: { p: 242.0, t: 52.0 },
  riserB: { p: 238.5, t: 50.5 },
  manifold: { p: 255.0, t: 68.0 },
  well1: { p: 278.0, t: 78.5 },
  well2: { p: 282.0, t: 81.0 },
};

const RISER_SPLIT = { a: 0.5, b: 0.5 }; // ASSUMPTION: two equal production risers
const WELL_SHARE = 1 / MJ_FIELD.developmentWells;

const coolBeta = (tIn: number, tOut: number) => Math.log((tIn - SEABED_TEMP_C) / (tOut - SEABED_TEMP_C));
const cool = (tIn: number, beta: number, qRatio: number) =>
  SEABED_TEMP_C + (tIn - SEABED_TEMP_C) * Math.exp(-beta / Math.max(qRatio, 0.05));

/** Riser: base pressure from top pressure, friction and the gas column (2 fixed-point passes) */
function riserBase(pTop: number, k: number, q: number, tAvg: number): number {
  let pBase = Math.sqrt(pTop * pTop + k * q * q);
  for (let i = 0; i < 3; i++) {
    const head = (gasDensity((pTop + pBase) / 2, tAvg) * G * RISER_HEIGHT_M) / 1e5;
    pBase = Math.sqrt(pTop * pTop + k * q * q) + head;
  }
  return pBase;
}

function calibrateRiser(pBase: number, q: number, tAvg: number): number {
  const head = (gasDensity((ARRIVAL_PRESSURE_BAR + pBase) / 2, tAvg) * G * RISER_HEIGHT_M) / 1e5;
  return ((pBase - head) ** 2 - ARRIVAL_PRESSURE_BAR ** 2) / (q * q);
}
const friction = (pUp: number, pDn: number, q: number) => (pUp * pUp - pDn * pDn) / (q * q);

// Calibration (once)
const qA = DESIGN_Q * RISER_SPLIT.a;
const qB = DESIGN_Q * RISER_SPLIT.b;
const qW = DESIGN_Q * WELL_SHARE;
const CAL = {
  kRiserA: calibrateRiser(DESIGN.riserA.p, qA, (DESIGN.riserA.t + DESIGN.topside.t) / 2),
  kRiserB: calibrateRiser(DESIGN.riserB.p, qB, (DESIGN.riserB.t + DESIGN.topside.t) / 2),
  kJumperA: friction(DESIGN.manifold.p, DESIGN.riserA.p, qA),
  kJumperB: friction(DESIGN.manifold.p, DESIGN.riserB.p, qB),
  kWell1: friction(DESIGN.well1.p, DESIGN.manifold.p, qW),
  kWell2: friction(DESIGN.well2.p, DESIGN.manifold.p, qW),
  bWell1: coolBeta(RESERVOIR_TEMP_C, DESIGN.well1.t),
  bWell2: coolBeta(RESERVOIR_TEMP_C, DESIGN.well2.t),
  bManifold: coolBeta((DESIGN.well1.t + DESIGN.well2.t) / 2, DESIGN.manifold.t),
  bRiserA: coolBeta(DESIGN.manifold.t, DESIGN.riserA.t),
  bRiserB: coolBeta(DESIGN.manifold.t, DESIGN.riserB.t),
  bTopside: coolBeta((DESIGN.riserA.t + DESIGN.riserB.t) / 2, DESIGN.topside.t),
};

export interface AssetState {
  id: string;
  pBar: number;
  tC: number;
  gasMmscmd: number;
  condensateBpd: number;
  waterBpd: number;
  /** Liquid (condensate + water) mass rate through the meter, kg/s */
  liquidKgS: number;
  /** Pipe diameter for slug calculations (0 = no slugging, e.g. topside meter) */
  pipeD: number;
  vertical: boolean;
}

/** Extra flow resistance / flow factor per asset (incident drills) */
export interface Disturbance {
  /** multiplies segment friction K (blockage) */
  kFactor?: Record<string, number>;
  /** multiplies the block rate (choke-back, shut-in) */
  flowFactor?: number;
}

const liquids = (block: BlockProduction, share: number) => {
  const cond = block.liquidsBpd * share;
  const water = (cond * WATER_CUT_PCT) / (100 - WATER_CUT_PCT);
  const kgS = ((cond * CONDENSATE_RHO_15C + water * BRINE_RHO) * BBL_M3) / DAY_S;
  return { cond, water, kgS };
};

/** ASSUMPTION: shut-in wellhead pressure and backpressure exponent (Rawlins-Schellhardt q = C (Ps² - Pwh²)^n) */
const P_SHUTIN_BAR = 350;
const DELIV_N = 0.8;

const bisect = (f: (x: number) => number, lo: number, hi: number) => {
  // f increasing; returns the root in [lo, hi]
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2;
    if (f(m) > 0) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
};

/** Pressures and temperatures for a total gas rate q (MMSCMD) */
function networkAt(q: number, d: Disturbance) {
  const k = (id: string) => d.kFactor?.[id] ?? 1;
  const r = q / DESIGN_Q;
  const tW1 = cool(RESERVOIR_TEMP_C, CAL.bWell1, r);
  const tW2 = cool(RESERVOIR_TEMP_C, CAL.bWell2, r);
  const tMan = cool((tW1 + tW2) / 2, CAL.bManifold, r);
  const pTop = ARRIVAL_PRESSURE_BAR;

  // One riser branch: riser-base pressure, then the jumper up to the manifold
  const branch = (qs: number, kRiser: number, kJumper: number, beta: number, id: string, design: number) => {
    const rs = qs / (DESIGN_Q * design);
    const tR = cool(tMan, beta, rs);
    const tTopR = cool(tR, CAL.bTopside, rs);
    const pR = riserBase(pTop, kRiser * k(id), qs, (tR + tTopR) / 2);
    const pM = Math.sqrt(pR * pR + kJumper * k('MANIFOLD-D6-MAIN') * qs * qs);
    return { pR, pM, tR, tTopR };
  };
  const A = (qs: number) => branch(qs, CAL.kRiserA, CAL.kJumperA, CAL.bRiserA, 'RISER-ALPHA', RISER_SPLIT.a);
  const B = (qs: number) => branch(qs, CAL.kRiserB, CAL.kJumperB, CAL.bRiserB, 'RISER-BRAVO', RISER_SPLIT.b);
  // Parallel risers share the flow so that both deliver the same manifold pressure
  const split = bisect((s) => A(q * s).pM - B(q * (1 - s)).pM, 0, 1);
  const a = A(q * split);
  const b = B(q * (1 - split));
  const pMan = (a.pM + b.pM) / 2;
  const pW1 = Math.sqrt(pMan ** 2 + CAL.kWell1 * k('XT-WELLHEAD-01') * (q * WELL_SHARE) ** 2);
  const pW2 = Math.sqrt(pMan ** 2 + CAL.kWell2 * k('XT-WELLHEAD-02') * (q * WELL_SHARE) ** 2);
  // Arrival temperature: flow-weighted mix of the two risers
  const tTop = split * a.tTopR + (1 - split) * b.tTopR;
  return { split, pTop, tTop, a, b, pMan, tMan, pW1, tW1, pW2, tW2 };
}

/**
 * Network solution for a block production rate. Undisturbed, the published rate flows and
 * the wells' deliverability constant C is fitted to it. Under a disturbance (blockage,
 * hydrate) the rate is re-solved from that deliverability: a restriction raises the
 * back-pressure, so flow falls and upstream pressure rises, as in a real field.
 */
export function solveNetwork(block: BlockProduction, d: Disturbance = {}): Record<string, AssetState> {
  const qPub = Math.max(block.gasMmscmd, 1e-3);
  const base = networkAt(qPub, {});
  const pwh0 = (base.pW1 + base.pW2) / 2;
  const C = qPub / (P_SHUTIN_BAR ** 2 - pwh0 ** 2) ** DELIV_N;
  const disturbed = Object.values(d.kFactor ?? {}).some((v) => Math.abs(v - 1) > 1e-6);
  let q = qPub;
  if (disturbed) {
    q = bisect((x) => {
      const n = networkAt(x, d);
      const pwh = Math.min((n.pW1 + n.pW2) / 2, P_SHUTIN_BAR);
      return x - C * (P_SHUTIN_BAR ** 2 - pwh ** 2) ** DELIV_N;
    }, 1e-4, qPub);
  }
  q *= d.flowFactor ?? 1;
  const n = networkAt(q, d);
  const b = { ...block, gasMmscmd: q, liquidsBpd: block.liquidsBpd * (q / qPub) };

  const node = (id: string, p: number, t: number, share: number, pipeD: number, vertical: boolean): AssetState => {
    const l = liquids(b, share);
    return { id, pBar: p, tC: t, gasMmscmd: q * share, condensateBpd: l.cond, waterBpd: l.water, liquidKgS: l.kgS, pipeD, vertical };
  };
  return {
    'TOPSIDE-MPFM-01': node('TOPSIDE-MPFM-01', n.pTop, n.tTop, 1, 0, false),
    'RISER-ALPHA': node('RISER-ALPHA', n.a.pR, n.a.tR, n.split, D_RISER, true),
    'RISER-BRAVO': node('RISER-BRAVO', n.b.pR, n.b.tR, 1 - n.split, D_RISER, true),
    'MANIFOLD-D6-MAIN': node('MANIFOLD-D6-MAIN', n.pMan, n.tMan, 1, D_FLOWLINE * 2, false),
    'XT-WELLHEAD-01': node('XT-WELLHEAD-01', n.pW1, n.tW1, WELL_SHARE, D_FLOWLINE, false),
    'XT-WELLHEAD-02': node('XT-WELLHEAD-02', n.pW2, n.tW2, WELL_SHARE, D_FLOWLINE, false),
  };
}
/**
 * Hydrodynamic slugging. Frequency: Gregory & Scott (1969),
 *   f = 0.0226 [ v_sl / (g D) * (19.75 / v_m + v_m) ]^1.2
 * Amplitude: hydrostatic head of one slug (length ~30 D) at the slug-body holdup
 * H_s = 1 / (1 + (v_m / 8.66)^1.39) (Gregory, Nicholson & Aziz 1978); vertical risers
 * feel the full head, horizontal lines a tenth of it (frictional).
 */
export function slugging(s: AssetState): { freqHz: number; ampBar: number } {
  if (!s.pipeD) return { freqHz: 0, ampBar: 0 };
  const area = (Math.PI / 4) * s.pipeD ** 2;
  const qGasActual = (s.gasMmscmd * 1e6 * GAS_RHO_STD) / DAY_S / gasDensity(s.pBar, s.tC); // m³/s
  const qLiq = ((s.condensateBpd + s.waterBpd) * BBL_M3) / DAY_S;
  const vsl = qLiq / area;
  const vm = vsl + qGasActual / area;
  if (vm <= 0 || vsl <= 0) return { freqHz: 0, ampBar: 0 };
  const freqHz = 0.0226 * ((vsl / (G * s.pipeD)) * (19.75 / vm + vm)) ** 1.2;
  const holdup = 1 / (1 + (vm / 8.66) ** 1.39);
  const ampBar = ((mixDensity(WATER_CUT_PCT, s.tC) * G * 30 * s.pipeD * holdup) / 1e5) * (s.vertical ? 1 : 0.1);
  return { freqHz, ampBar };
}

// ---- Drilling (development well on the platform) ----
/** ASSUMPTION: 8½" PDC bit, bit friction 0.25, design 140 kN WOB / 120 RPM / 2,800 L/min mud */
export const DRILL = {
  bitD: 0.2159,
  bitMu: 0.25,
  wobKn: 140,
  rpm: 120,
  mudLpm: 2800,
  designTorqueKnm: 28.4,
  designRopMh: 12.5,
  designSppBar: 210,
  mudDensity: 1200,
  /** torsional wave speed sqrt(G/rho) of steel, m/s */
  torsionalC: Math.sqrt(79.3e9 / 7850),
};
const bitTorque = (wobKn: number) => (DRILL.bitMu * wobKn * DRILL.bitD) / 3; // kNm (Pessier & Fear 1992)
/** Off-bottom string torque: the design torque minus the bit's share (calibrated) */
const STRING_TORQUE_KNM = DRILL.designTorqueKnm - bitTorque(DRILL.wobKn);
/** First torsional mode of a string fixed at the top, free at the bit: f = c / 4L */
export const STICK_SLIP_HZ = DRILL.torsionalC / (4 * MJ_FIELD.wellDepthM);

export function drillState(rpm: number, wobKn: number) {
  return {
    torqueKnm: STRING_TORQUE_KNM * (rpm > 0 ? 1 : 1.25) + bitTorque(wobKn),
    // Bingham-type ROP ~ RPM * WOB, calibrated at the design point
    ropMh: (DRILL.designRopMh * (rpm / DRILL.rpm) * (wobKn / DRILL.wobKn)),
    // Turbulent annular/bit losses ~ Q^1.8
    sppBar: DRILL.designSppBar * (DRILL.mudLpm / 2800) ** 1.8,
  };
}

/** Convenience: today's steady network */
export const networkNow = (t = Date.now()) => solveNetwork(productionAt(t));
