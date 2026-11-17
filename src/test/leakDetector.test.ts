/** Run: npx tsx src/test/leakDetector.test.ts */
import { telemetryEmitter, PHYSICS_HZ } from '../physics/TelemetryEmitter';
import { leakDetector } from '../services/LeakDetector';
import { useRigStore } from '../store/useRigStore';

let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(48), '->', got);
};

/** Runs the plant; returns the worst state seen and when the first alarm came */
function run(sec: number) {
  let worst = 'normal';
  let firstAlarm: number | null = null;
  for (let i = 0; i < PHYSICS_HZ * sec; i++) {
    telemetryEmitter.advance();
    const s = leakDetector.getStatus().state;
    if (s === 'alarm') {
      worst = 'alarm';
      if (firstAlarm === null) firstAlarm = i / PHYSICS_HZ;
    } else if (s === 'watch' && worst === 'normal') worst = 'watch';
  }
  return { worst, firstAlarm, status: leakDetector.getStatus() };
}
const scenario = (sc: string, ph = 1) => useRigStore.setState({ emergencyScenario: sc, incidentPhase: ph, isAutoSimulatingPhases: false } as never);
/** Settle the plant, then clear the detector so each case starts clean */
function fresh() {
  scenario('none');
  run(30);
  leakDetector.reset();
}

fresh();
let r = run(60);
check(r.worst === 'normal', 'normal running (meters biased +0.2%/-0.1%)', `${r.worst}, ${r.status.imbalancePct.toFixed(2)}%`);

fresh();
scenario('pipe_blockage', 3);
r = run(30);
scenario('none');
const r2 = run(30);
check(r.worst !== 'alarm' && r2.worst !== 'alarm', 'no false alarm: blockage and its recovery', `${r.worst} / ${r2.worst}`);

fresh();
scenario('hydrate_plug', 3);
r = run(30);
scenario('none');
const r3 = run(30);
check(r.worst !== 'alarm' && r3.worst !== 'alarm', 'no false alarm: hydrate and its recovery', `${r.worst} / ${r3.worst}`);

fresh();
scenario('rupture', 1); // 2 % of riser Alpha's flow escapes
r = run(60);
check(r.worst === 'alarm', 'small leak (2% of riser Alpha) is detected', `alarm after ${r.firstAlarm?.toFixed(1)} s, ${r.status.imbalancePct.toFixed(2)}%`);

fresh();
scenario('rupture', 2); // 6 %
r = run(30);
check(r.worst === 'alarm' && (r.firstAlarm ?? 99) < 15, 'larger leak (6%) alarms within 15 s', `after ${r.firstAlarm?.toFixed(1)} s`);
check(/Riser Alpha/.test(r.status.location ?? ''), 'leak located on riser Alpha', r.status.location);
check(Math.abs(r.status.lossMmscmd - 0.06 * 0.5 * 24) < 0.3, 'loss size ~ 6% of riser Alpha (~0.7 MMSCMD)', `${r.status.lossMmscmd.toFixed(2)} MMSCMD`);

fresh();
scenario('oil_overload', 3); // condensate surge: more liquid on both meters, nothing lost
r = run(40);
check(r.worst !== 'alarm', 'no false alarm: condensate surge', r.worst);

fresh();
scenario('rupture', 4); // SSIV closed: riser Alpha isolated, flow through Bravo
run(40);
leakDetector.reset();
r = run(40);
check(r.worst !== 'alarm', 'isolated riser: balance restored', `${r.worst}, ${r.status.imbalancePct.toFixed(2)}%`);

console.log(fail ? `${fail} failures` : 'all passed');
process.exit(fail ? 1 : 0);
