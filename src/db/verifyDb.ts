import { telemetryDb } from './TelemetryDatabase';

async function verifyDatabase() {
  console.log('--- Starting Telemetry Database Verification ---');
  const startTime = performance.now();
  const seededCount = await telemetryDb.seedSevenDayHistory();
  const seedDuration = performance.now() - startTime;
  console.log(`Seeded ${seededCount} records in ${seedDuration.toFixed(2)}ms`);

  // Sub-millisecond range query test
  const qStart = performance.now();
  const now = Date.now();
  const oneDayAgo = now - 24 * 3600 * 1000;
  const aggregates = telemetryDb.getAggregates('RISER-ALPHA', oneDayAgo, now);
  const qDuration = performance.now() - qStart;

  console.log(`Query Execution Time: ${qDuration.toFixed(3)}ms`);
  console.log('Aggregates for RISER-ALPHA (Last 24h):', {
    avg_net_oil_bpd: Math.round(aggregates.avg_net_oil_bpd),
    max_p_line_bar: aggregates.max_p_line_bar,
    min_p_line_bar: aggregates.min_p_line_bar,
    avg_t_line_c: aggregates.avg_t_line_c.toFixed(2),
    record_count: aggregates.record_count,
  });

  // Verify sub-millisecond requirement (< 1.0 ms)
  if (qDuration < 1.0) {
    console.log('✅ SUB-MILLISECOND REQUIREMENT PASSED (<1ms)');
  } else {
    console.warn('⚠️ Query duration exceeded 1ms');
  }
}

verifyDatabase().catch(console.error);
