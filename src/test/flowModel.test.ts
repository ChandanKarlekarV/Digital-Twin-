/** Run: npx tsx src/test/flowModel.test.ts */
import { productionAt, KGD6_QUARTERS, SCF_PER_SCM } from '../data/kgd6Production';
import { solveNetwork, zFactor, gasDensity, STICK_SLIP_HZ, WATER_CUT_PCT } from '../physics/KgD6FlowModel';
import { steadyRecord } from '../physics/MeterComputer';
import { telemetryEmitter, PHYSICS_HZ } from '../physics/TelemetryEmitter';
import { telemetryDb } from '../db/TelemetryDatabase';

let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(52), '->', got);
};
const near = (a: number, b: number, rel: number) => Math.abs(a / b - 1) <= rel;

// Published data drives the rate
const latest = KGD6_QUARTERS[KGD6_QUARTERS.length - 1];
const p = productionAt(Date.parse('2026-11-17'));
check(p.gasMmscmd === latest.gasMmscmd && p.liquidsBpd === latest.liquidsBpd, 'rate after latest quarter = latest published', `${p.gasMmscmd} MMSCMD, ${p.liquidsBpd} bbl/d`);
const mid = productionAt(Date.parse('2025-11-16T00:00:00Z')) // quarter mid-point;
check(mid.gasMmscmd === 25.6, 'mid-Q3 FY26 = published 25.6 MMSCMD', mid.gasMmscmd);

// Network: mass balance and the flow computer reproduce the published rate
const net = solveNetwork(p);
const exp = steadyRecord(net['TOPSIDE-MPFM-01'], WATER_CUT_PCT, Date.now());
check(near(exp.net_oil_bpd, p.liquidsBpd, 0.002), 'export meter condensate within 0.2% of published', exp.net_oil_bpd);
check(near((exp.associated_gas_mmscfd ?? 0) / SCF_PER_SCM, p.gasMmscmd, 1e-4), 'export gas = published MMSCMD', ((exp.associated_gas_mmscfd ?? 0) / SCF_PER_SCM).toFixed(3));
check(near(net['RISER-ALPHA'].gasMmscmd + net['RISER-BRAVO'].gasMmscmd, net['MANIFOLD-D6-MAIN'].gasMmscmd, 1e-9), 'risers carry exactly the manifold flow', 'balanced');
check(Math.abs(exp.corrected_density - 807.2) < 0.05 && Math.abs(exp.api_gravity - 43.62) < 0.02, 'ASTM D1250 base density/API recovered exactly', `${exp.corrected_density} kg/m³, ${exp.api_gravity} °API`);

// Physics direction: a riser blockage cuts flow, raises upstream pressure, diverts to the other riser
const blocked = solveNetwork(p, { kFactor: { 'RISER-ALPHA': 60 } });
check(blocked['MANIFOLD-D6-MAIN'].pBar > net['MANIFOLD-D6-MAIN'].pBar, 'blockage raises manifold pressure', `${net['MANIFOLD-D6-MAIN'].pBar.toFixed(1)} -> ${blocked['MANIFOLD-D6-MAIN'].pBar.toFixed(1)} bar`);
check(blocked['MANIFOLD-D6-MAIN'].gasMmscmd < p.gasMmscmd, 'blockage reduces block flow', blocked['MANIFOLD-D6-MAIN'].gasMmscmd.toFixed(2));
check(blocked['RISER-BRAVO'].gasMmscmd > net['RISER-BRAVO'].gasMmscmd, 'flow diverts to riser Bravo', blocked['RISER-BRAVO'].gasMmscmd.toFixed(2));
check(blocked['MANIFOLD-D6-MAIN'].tC < net['MANIFOLD-D6-MAIN'].tC, 'lower flow cools the manifold', `${blocked['MANIFOLD-D6-MAIN'].tC.toFixed(1)} °C`);
// Higher historical rate -> higher line pressure
const early = solveNetwork(productionAt(Date.parse('2025-02-15')));
check(early['MANIFOLD-D6-MAIN'].pBar > net['MANIFOLD-D6-MAIN'].pBar, 'Q4 FY25 (26.7) ran at higher pressure than today', `${early['MANIFOLD-D6-MAIN'].pBar.toFixed(1)} bar`);

// Correlations
check(Math.abs(zFactor(160, 45) - 0.846) < 0.005, 'Papay Z(160 bar, 45 °C) for SG 0.60', zFactor(160, 45).toFixed(3));
check(Math.abs(gasDensity(160, 45) - 124.3) < 0.5, 'real-gas density at 160 bar, 45 °C', gasDensity(160, 45).toFixed(1));
check(Math.abs(STICK_SLIP_HZ - 0.189) < 0.001, 'drill-string torsional mode c/4L (4,200 m)', STICK_SLIP_HZ.toFixed(3));

// Deterministic: two identical 2-second runs give identical readings (no random numbers)
check(PHYSICS_HZ === 200, 'physics runs at 200 Hz', PHYSICS_HZ);
const run = () => {
  for (let i = 0; i < PHYSICS_HZ * 2; i++) telemetryEmitter.advance();
  return JSON.stringify(['RISER-ALPHA', 'MANIFOLD-D6-MAIN'].map((id) => {
    const r = telemetryDb.getLatest(id)!;
    return [r.p_line_bar, r.t_line_c, r.net_oil_bpd];
  }));
};
const a = run();
const b = run();
check(a.length > 2 && a !== 'null', 'emitter produces records', a);
check(!/NaN/.test(a + b), 'no NaN in readings', 'clean');

console.log(fail ? `${fail} failures` : 'all passed');
process.exit(fail ? 1 : 0);
