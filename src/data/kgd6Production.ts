/**
 * Published KG-D6 block output: quarterly averages from Reliance Industries' results
 * presentations and annual reports (gas in MMSCMD, oil + condensate in bbl/d).
 * These are the ONLY production numbers the twin uses; everything else is computed
 * from them with the physics in src/physics/KgD6FlowModel.ts.
 */
export interface QuarterOutput {
  quarter: string;
  /** Inclusive quarter dates (Indian fiscal year: Q1 = Apr-Jun) */
  start: string;
  end: string;
  gasMmscmd: number;
  /** null where the source gave no condensate figure (interpolated) */
  liquidsBpd: number | null;
  source: string;
}

export const KGD6_QUARTERS: QuarterOutput[] = [
  { quarter: 'Q4 FY25', start: '2025-01-01', end: '2025-03-31', gasMmscmd: 26.7, liquidsBpd: 19670, source: 'RIL results presentation 4Q FY25 (25 Apr 2025)' },
  { quarter: 'Q2 FY26', start: '2025-07-01', end: '2025-09-30', gasMmscmd: 26.1, liquidsBpd: 18746, source: 'RIL results presentation Q2 FY26 (17 Oct 2025)' },
  { quarter: 'Q3 FY26', start: '2025-10-01', end: '2025-12-31', gasMmscmd: 25.6, liquidsBpd: 17290, source: 'RIL results presentation Q3 FY26 (16 Jan 2026)' },
  { quarter: 'Q1 FY27', start: '2026-04-01', end: '2026-06-30', gasMmscmd: 24.8, liquidsBpd: null, source: 'RIL Q2 FY27 results (prior-quarter comparison)' },
  { quarter: 'Q2 FY27', start: '2026-07-01', end: '2026-09-30', gasMmscmd: 24.0, liquidsBpd: 15903, source: 'RIL Q2 FY27 results coverage (30 Oct 2026)' },
];

/** FY2025-26 annual averages (RIL Integrated Annual Report 2025-26) */
export const KGD6_FY26 = { gasMmscmd: 25.9, liquidsBpd: 18170 };

/** Oil & condensate realisation, Q2 FY27 (USD/bbl, results coverage) */
export const CONDENSATE_PRICE_USD_BBL = 98.9;

/** MJ field (KG-D6): 700-1,200 m water depth, wells ~4,200 m below sea level, HPHT gas-condensate, 8 development wells */
export const MJ_FIELD = { waterDepthM: 1000, wellDepthM: 4200, developmentWells: 8 };

export const SCF_PER_SCM = 35.3147;

const mid = (q: QuarterOutput) => (Date.parse(q.start) + Date.parse(q.end) + 86_400_000) / 2;

function interp(t: number, pick: (q: QuarterOutput) => number | null): number {
  const pts = KGD6_QUARTERS.map((q) => [mid(q), pick(q)] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    if (t <= t1) {
      const [t0, v0] = pts[i - 1];
      return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
    }
  }
  return pts[pts.length - 1][1]; // after the latest published quarter: hold its average
}

export interface BlockProduction {
  gasMmscmd: number;
  gasMmscfd: number;
  liquidsBpd: number;
  /** Published quarter this rate comes from, or "interpolated" */
  basis: string;
}

/**
 * Block output at time t: linear between published quarter mid-points, held flat at the
 * latest published quarter after it (no extrapolated decline is invented).
 */
export function productionAt(t: number = Date.now()): BlockProduction {
  const gas = interp(t, (q) => q.gasMmscmd);
  const liquids = interp(t, (q) => q.liquidsBpd);
  const latest = KGD6_QUARTERS[KGD6_QUARTERS.length - 1];
  const within = KGD6_QUARTERS.find((q) => t >= Date.parse(q.start) && t < Date.parse(q.end) + 86_400_000);
  const basis = t >= mid(latest) ? `${latest.quarter} average` : within ? `${within.quarter} (interpolated)` : 'interpolated';
  return { gasMmscmd: gas, gasMmscfd: gas * SCF_PER_SCM, liquidsBpd: liquids, basis };
}
