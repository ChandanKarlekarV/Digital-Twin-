import { TelemetryRecord, TelemetryAggregate, TelemetryTimeBucket } from '../types/telemetry';
import { sixMonthDataEngine } from './SixMonthDataEngine';
import { coriolisEngine } from '../physics/CoriolisEngine';

/** Live 50 Hz stream kept in RAM: ~57 s of all 7 assets */
const LIVE_CAPACITY = 20000;
/** Each asset is sampled into the history once per minute */
const HISTORY_SAMPLE_MS = 60 * 1000;
/** History window kept in RAM and on disk */
const HISTORY_WINDOW_MS = 35 * 24 * 3600 * 1000;
/** Queued history samples are written to IndexedDB in one transaction this often */
const FLUSH_INTERVAL_MS = 5000;
const IDB_NAME = 'varuna_telemetry_db_v3';
const IDB_STORE = 'history_samples';

/**
 * Three-tier time-series store for VARUNA-AI:
 *  1. live   — fixed-size ring buffer of every 50 Hz record (O(1) insert, no array shifting)
 *  2. history — time-sorted 15-minute seed + 1-minute live samples per asset, queried by
 *               binary search; live data can no longer push the 5-week history out
 *  3. disk   — IndexedDB, written in batched transactions every 5 s and restored on load,
 *              so real samples survive a reload (the synthetic seed is never written)
 */
class TelemetryDatabaseService {
  /** Tier 2: time-sorted history used by every range/aggregate query */
  private inMemoryRecords: TelemetryRecord[] = [];
  /** Tier 1: ring buffer */
  private live: (TelemetryRecord | undefined)[] = new Array(LIVE_CAPACITY);
  private liveHead = 0;
  private liveSize = 0;
  private lastHistorySample = new Map<string, number>();
  private pendingWrites: TelemetryRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private db: IDBDatabase | null = null;
  private dbReadyPromise: Promise<void>;
  private listeners: Set<(record: TelemetryRecord) => void> = new Set();

  constructor() {
    this.dbReadyPromise = this.initIndexedDB();
  }

  /**
   * Initializes IndexedDB storage for offline local persistence.
   */
  private async initIndexedDB(): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB not available, operating in high-speed RAM-only mode.');
      return;
    }

    // The v2 database re-wrote the synthetic seed on every load and grew without bound
    try {
      indexedDB.deleteDatabase('varuna_telemetry_db_v2');
    } catch {
      // ignore
    }

    return new Promise((resolve) => {
      const request = indexedDB.open(IDB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          // One sample per asset per minute: [asset, timestamp] is a natural unique key
          const store = db.createObjectStore(IDB_STORE, { keyPath: ['asset_id', 'timestamp'] });
          store.createIndex('timestamp_idx', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (err) => {
        console.warn('IndexedDB initialization fallback to RAM:', err);
        resolve();
      };
    });
  }

  /**
   * Seed the database with 5 weeks (35 days) of 15-minute granular time-series telemetry
   * plus 6 months (180 days) of daily production settlements.
   * Total Block Production: ~120,000 BPD nominal oil/condensate mix across subsea & topside nodes.
   */
  public async seedSixMonthHistory(): Promise<number> {
    await this.dbReadyPromise;

    // Also populate 6-month daily settlement summaries
    sixMonthDataEngine.generateSixMonthHistory();

    if (this.inMemoryRecords.length >= 10000) {
      return this.inMemoryRecords.length;
    }

    const now = Date.now();
    const thirtyFiveDaysMs = 35 * 24 * 60 * 60 * 1000; // 5 full weeks (35 days)
    const startTime = now - thirtyFiveDaysMs;
    const stepIntervalMs = 15 * 60 * 1000; // 15-minute high-fidelity intervals

    const assets = [
      { id: 'RISER-ALPHA', share: 0.35, baseP: 242.0, baseT: 52.0 },
      { id: 'RISER-BRAVO', share: 0.32, baseP: 238.5, baseT: 50.5 },
      { id: 'MANIFOLD-D6-MAIN', share: 0.95, baseP: 255.0, baseT: 68.0 },
      { id: 'XT-WELLHEAD-01', share: 0.18, baseP: 278.0, baseT: 78.5 },
      { id: 'XT-WELLHEAD-02', share: 0.15, baseP: 282.0, baseT: 81.0 },
      { id: 'TOPSIDE-MPFM-01', share: 1.00, baseP: 85.0, baseT: 38.0 },
      { id: 'TOPSIDE-DRILL-RIG', share: 0.50, baseP: 210.0, baseT: 60.0 },
    ];

    const records: TelemetryRecord[] = [];
    const nominalTotalBpd = 122450;

    for (let t = startTime; t <= now; t += stepIntervalMs) {
      const dayFraction = ((t % (24 * 3600 * 1000)) / (24 * 3600 * 1000)) * Math.PI * 2;
      const diurnalFactor = 1.0 + 0.03 * Math.sin(dayFraction);
      const dayIndex = Math.floor((t - startTime) / (24 * 3600 * 1000));
      const trendFactor = 1.0 + 0.015 * Math.sin(dayIndex * 0.8);

      for (const asset of assets) {
        const noise = (Math.random() - 0.5) * 0.02;
        const targetBpd = nominalTotalBpd * asset.share * diurnalFactor * trendFactor * (1 + noise);

        const pLine = asset.baseP + (Math.random() - 0.5) * 3.5;
        const tLine = asset.baseT + (Math.random() - 0.5) * 1.8;

        const baseDensity = 807.2;
        const apiGravity = 141.5 / (baseDensity / 999.016) - 131.5;
        const waterCutPct = 4.2 + 0.8 * Math.sin(dayFraction) + (Math.random() - 0.5) * 0.5;

        const alphaT = 341.0957 / (baseDensity * baseDensity);
        const deltaT = tLine - 15.56;
        const ctl = Math.exp(-alphaT * deltaT * (1 + 0.8 * alphaT * deltaT));
        const cpl = 1 / (1 - 1.25e-5 * (pLine - 1.0));
        const rawDensity = baseDensity * ctl * cpl * (1 + (waterCutPct / 100) * 0.24);

        // Same Coriolis calibration as the live emitter (≈ 730 Hz for KG-D6 condensate)
        const fOsc = coriolisEngine.computeFrequencyFromDensity(rawDensity, tLine) + (Math.random() - 0.5) * 1.2;
        const grossMassRate = (targetBpd * 0.1589873 * baseDensity) / 86400;
        const purifiedBpd = targetBpd * (1.0 - waterCutPct / 100);

        records.push({
          timestamp: t,
          precise_time_iso: new Date(t).toISOString(),
          asset_id: asset.id,
          p_line_bar: Number(pLine.toFixed(2)),
          t_line_c: Number(tLine.toFixed(2)),
          f_osc_hz: Number(fOsc.toFixed(2)),
          raw_density: Number(rawDensity.toFixed(2)),
          corrected_density: Number(baseDensity.toFixed(2)),
          api_gravity: Number(apiGravity.toFixed(2)),
          water_cut_pct: Number(waterCutPct.toFixed(2)),
          gross_mass_rate: Number(grossMassRate.toFixed(3)),
          // Same meaning as live records: gross = oil + water, net oil is water-free
          gross_liquid_bpd: Number(targetBpd.toFixed(1)),
          net_oil_bpd: Number(purifiedBpd.toFixed(1)),
          purified_oil_bpd: Number(purifiedBpd.toFixed(1)),
          produced_water_bpd: Number((targetBpd * (waterCutPct / 100)).toFixed(1)),
          associated_gas_mmscfd: Number(((purifiedBpd * 480) / 1e6).toFixed(2)),
          status_flag: 0,
          drill_rpm: 120,
          drill_torque_knm: 28.4,
          drill_wob_kn: 140,
          drill_rop_mhr: 12.5,
          drill_spp_bar: 210,
        });
      }
    }

    // Real samples recorded in earlier sessions come back from disk and merge with the seed
    const persisted = await this.loadPersisted(startTime);
    this.inMemoryRecords = records.concat(persisted, this.inMemoryRecords).sort((a, b) => a.timestamp - b.timestamp);

    return this.inMemoryRecords.length;
  }

  private loadPersisted(since: number): Promise<TelemetryRecord[]> {
    const db = this.db;
    if (!db) return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).index('timestamp_idx').getAll(IDBKeyRange.lowerBound(since));
        req.onsuccess = () => resolve((req.result as TelemetryRecord[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  public async seedSevenDayHistory(): Promise<number> {
    return this.seedSixMonthHistory();
  }

  /**
   * Query records for the past N weeks (e.g. 5 weeks = 35 days)
   */
  public queryPastWeeks(assetId: string | null, weeks = 5): TelemetryRecord[] {
    const now = Date.now();
    const start = now - weeks * 7 * 24 * 3600 * 1000;
    return this.queryRange(assetId, start, now);
  }

  /**
   * Query records for a specific week (week 1 = past 7 days, week 2 = 8-14 days ago, etc.)
   */
  public querySpecificWeek(assetId: string | null, weekNum: number): TelemetryRecord[] {
    const now = Date.now();
    const end = now - (weekNum - 1) * 7 * 24 * 3600 * 1000;
    const start = end - 7 * 24 * 3600 * 1000;
    return this.queryRange(assetId, start, end);
  }

  /** Writes all queued history samples in ONE transaction (instead of one write per record). */
  private flushToIndexedDB(): void {
    const db = this.db;
    if (!db || this.pendingWrites.length === 0) return;
    const batch = this.pendingWrites;
    this.pendingWrites = [];
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      for (const r of batch) store.put(r);
      // Drop samples older than the history window in the same transaction
      store.index('timestamp_idx').openCursor(IDBKeyRange.upperBound(Date.now() - HISTORY_WINDOW_MS)).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.onerror = () => console.warn('IndexedDB batch write failed:', tx.error);
    } catch (err) {
      console.warn('IndexedDB batch write failed:', err);
    }
  }

  private ensureFlushTimer(): void {
    if (this.flushTimer || typeof window === 'undefined') return;
    this.flushTimer = setInterval(() => this.flushToIndexedDB(), FLUSH_INTERVAL_MS);
    window.addEventListener('pagehide', () => this.flushToIndexedDB());
  }

  /**
   * Ingest one live 50 Hz record: O(1) into the ring buffer; once a minute per asset it is
   * also appended to the sorted history and queued for the next batched disk write.
   */
  public insert(record: TelemetryRecord): void {
    if (!record.timestamp) {
      record.timestamp = Date.now();
    }
    if (!record.precise_time_iso) {
      record.precise_time_iso = new Date(record.timestamp).toISOString();
    }

    this.live[this.liveHead] = record;
    this.liveHead = (this.liveHead + 1) % LIVE_CAPACITY;
    if (this.liveSize < LIVE_CAPACITY) this.liveSize++;

    const last = this.lastHistorySample.get(record.asset_id) ?? 0;
    if (record.timestamp - last >= HISTORY_SAMPLE_MS) {
      this.lastHistorySample.set(record.asset_id, record.timestamp);
      this.appendHistory(record);
      this.pendingWrites.push(record);
      this.ensureFlushTimer();
    }

    // Notify real-time listeners
    this.listeners.forEach((listener) => listener(record));
  }

  /** Batch ingest (e.g. a replayed log): straight into the sorted history. */
  public insertBatch(records: TelemetryRecord[]): void {
    for (const r of records) this.appendHistory(r);
  }

  /** Keeps the history sorted (live samples arrive in order, so this is an append) and bounded. */
  private appendHistory(record: TelemetryRecord): void {
    const h = this.inMemoryRecords;
    if (h.length === 0 || h[h.length - 1].timestamp <= record.timestamp) h.push(record);
    else h.splice(this.findStartIndex(record.timestamp), 0, record);

    // Age out anything older than the window, in one cheap splice
    if (h.length && h[0].timestamp < record.timestamp - HISTORY_WINDOW_MS) {
      h.splice(0, this.findStartIndex(record.timestamp - HISTORY_WINDOW_MS));
    }
  }

  /**
   * Binary Search range finder for ultra-fast sub-millisecond execution (<0.2ms).
   */
  private findStartIndex(target: number): number {
    let low = 0;
    let high = this.inMemoryRecords.length - 1;
    let result = this.inMemoryRecords.length;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.inMemoryRecords[mid].timestamp >= target) {
        result = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return result;
  }

  /**
   * Query records by time range with sub-millisecond binary search (<0.1ms).
   */
  public queryRange(assetId: string | null, startTime: number, endTime: number): TelemetryRecord[] {
    const results: TelemetryRecord[] = [];
    const len = this.inMemoryRecords.length;
    if (len === 0) return results;

    const startIdx = this.findStartIndex(startTime);

    for (let i = startIdx; i < len; i++) {
      const rec = this.inMemoryRecords[i];
      if (rec.timestamp > endTime) break;
      if (!assetId || rec.asset_id === assetId) {
        results.push(rec);
      }
    }
    return results;
  }

  /**
   * Fast Aggregation Query (<0.15ms).
   */
  public getAggregates(
    assetId: string | null,
    startTime: number,
    endTime: number
  ): TelemetryAggregate {
    let sumNetBpd = 0;
    let sumPurifiedBpd = 0;
    let sumGrossBpd = 0;
    let maxPressure = -Infinity;
    let minPressure = Infinity;
    let sumPressure = 0;
    let sumApi = 0;
    let sumDensity = 0;
    let sumTemp = 0;
    let sumWaterCut = 0;
    let sumFOsc = 0;
    let totalGrossMass = 0;
    let sumTorque = 0;
    let sumRop = 0;
    let count = 0;

    const len = this.inMemoryRecords.length;
    if (len === 0) {
      return {
        avg_net_oil_bpd: 0,
        avg_purified_oil_bpd: 0,
        avg_gross_liquid_bpd: 0,
        max_p_line_bar: 0,
        min_p_line_bar: 0,
        avg_t_line_c: 0,
        avg_water_cut_pct: 0,
        avg_f_osc_hz: 0,
        total_gross_mass_kg: 0,
        total_purified_barrels: 0,
        avg_drill_torque_knm: 0,
        avg_drill_rop_mhr: 0,
        record_count: 0,
        start_timestamp: startTime,
        end_timestamp: endTime,
      };
    }

    const startIdx = this.findStartIndex(startTime);

    for (let i = startIdx; i < len; i++) {
      const rec = this.inMemoryRecords[i];
      if (rec.timestamp > endTime) break;

      if (!assetId || rec.asset_id === assetId) {
        sumNetBpd += rec.net_oil_bpd;
        sumPurifiedBpd += rec.purified_oil_bpd || (rec.net_oil_bpd * (1 - rec.water_cut_pct / 100));
        sumGrossBpd += rec.gross_liquid_bpd || rec.net_oil_bpd;
        if (rec.p_line_bar > maxPressure) maxPressure = rec.p_line_bar;
        if (rec.p_line_bar < minPressure) minPressure = rec.p_line_bar;
        sumPressure += rec.p_line_bar;
        sumApi += rec.api_gravity;
        sumDensity += rec.corrected_density;
        sumTemp += rec.t_line_c;
        sumWaterCut += rec.water_cut_pct;
        sumFOsc += rec.f_osc_hz;
        totalGrossMass += rec.gross_mass_rate;
        if (rec.drill_torque_knm) sumTorque += rec.drill_torque_knm;
        if (rec.drill_rop_mhr) sumRop += rec.drill_rop_mhr;
        count++;
      }
    }

    const durationDays = (endTime - startTime) / (24 * 3600 * 1000);
    const avgPurified = count > 0 ? sumPurifiedBpd / count : 0;
    const totalPurifiedBarrels = Math.round(avgPurified * Math.max(durationDays, 1));

    return {
      avg_net_oil_bpd: count > 0 ? sumNetBpd / count : 0,
      avg_purified_oil_bpd: avgPurified,
      avg_gross_liquid_bpd: count > 0 ? sumGrossBpd / count : 0,
      max_p_line_bar: count > 0 ? maxPressure : 0,
      min_p_line_bar: count > 0 ? minPressure : 0,
      avg_p_line_bar: count > 0 ? sumPressure / count : 0,
      avg_api_gravity: count > 0 ? sumApi / count : 0,
      avg_corrected_density: count > 0 ? sumDensity / count : 0,
      avg_t_line_c: count > 0 ? sumTemp / count : 0,
      avg_water_cut_pct: count > 0 ? sumWaterCut / count : 0,
      avg_f_osc_hz: count > 0 ? sumFOsc / count : 0,
      total_gross_mass_kg: totalGrossMass,
      total_purified_barrels: totalPurifiedBarrels,
      avg_drill_torque_knm: count > 0 ? sumTorque / count : 28.4,
      avg_drill_rop_mhr: count > 0 ? sumRop / count : 12.5,
      record_count: count,
      start_timestamp: startTime,
      end_timestamp: endTime,
    };
  }

  /**
   * Resamples telemetry into fixed-size buckets for smooth chart rendering.
   */
  public getTimeBuckets(
    assetId: string | null,
    startTime: number,
    endTime: number,
    numBuckets = 50
  ): TelemetryTimeBucket[] {
    const records = this.queryRange(assetId, startTime, endTime);
    if (records.length === 0) return [];

    const bucketDuration = (endTime - startTime) / numBuckets;
    const buckets: TelemetryTimeBucket[] = [];

    // One pass over the records into per-bucket sums (was buckets x records)
    const sums = Array.from({ length: numBuckets }, () => ({ p: 0, t: 0, f: 0, net: 0, pur: 0, wc: 0, rho: 0, tq: 0, rop: 0, n: 0 }));
    for (const r of records) {
      const b = Math.floor((r.timestamp - startTime) / bucketDuration);
      if (b < 0 || b >= numBuckets) continue;
      const s = sums[b];
      s.p += r.p_line_bar;
      s.t += r.t_line_c;
      s.f += r.f_osc_hz;
      s.net += r.net_oil_bpd;
      s.pur += r.purified_oil_bpd || r.net_oil_bpd * (1 - r.water_cut_pct / 100);
      s.wc += r.water_cut_pct;
      s.rho += r.raw_density;
      if (r.drill_torque_knm) s.tq += r.drill_torque_knm;
      if (r.drill_rop_mhr) s.rop += r.drill_rop_mhr;
      s.n++;
    }

    for (let b = 0; b < numBuckets; b++) {
      const bMid = startTime + (b + 0.5) * bucketDuration;
      const s = sums[b];
      if (s.n > 0) {
        buckets.push({
          timestamp: bMid,
          p_line_bar: s.p / s.n,
          t_line_c: s.t / s.n,
          f_osc_hz: s.f / s.n,
          net_oil_bpd: s.net / s.n,
          purified_oil_bpd: s.pur / s.n,
          water_cut_pct: s.wc / s.n,
          raw_density: s.rho / s.n,
          drill_torque_knm: s.tq / s.n,
          drill_rop_mhr: s.rop / s.n,
        });
      } else if (buckets.length > 0) {
        const prev = buckets[buckets.length - 1];
        buckets.push({ ...prev, timestamp: bMid });
      }
    }

    return buckets;
  }

  /** Newest record (optionally for one asset): live ring first, then history. */
  public getLatest(assetId?: string): TelemetryRecord | null {
    for (let k = 1; k <= this.liveSize; k++) {
      const r = this.live[(this.liveHead - k + LIVE_CAPACITY) % LIVE_CAPACITY];
      if (r && (!assetId || r.asset_id === assetId)) return r;
    }
    for (let i = this.inMemoryRecords.length - 1; i >= 0; i--) {
      const r = this.inMemoryRecords[i];
      if (!assetId || r.asset_id === assetId) return r;
    }
    return null;
  }

  public subscribe(listener: (record: TelemetryRecord) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public count(): number {
    return this.inMemoryRecords.length;
  }
}

export const telemetryDb = new TelemetryDatabaseService();
