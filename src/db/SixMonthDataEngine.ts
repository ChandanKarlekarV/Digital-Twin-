/**
 * 6-Month Historical Data Engine & Seeder for KG-D6 Subsea Digital Twin
 * 180 days of KG-D6 daily settlements computed from the published quarterly block rates
 * (src/data/kgd6Production.ts) through the network physics and flow-computer chain.
 */

import { DailyProductionSummary, SixMonthAnalytics, AiAnomalyEvent } from '../types/eod';
import { productionAt, CONDENSATE_PRICE_USD_BBL } from '../data/kgd6Production';
import { solveNetwork, slugging, drillState, DRILL, WATER_CUT_PCT } from '../physics/KgD6FlowModel';
import { steadyRecord } from '../physics/MeterComputer';

/** FNV-1a 64-bit digest (hex) */
const fnv64 = (s: string) => {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < s.length; i++) h = ((h ^ BigInt(s.charCodeAt(i))) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h.toString(16).toUpperCase().padStart(16, '0');
};

export class SixMonthDataEngine {
  private static instance: SixMonthDataEngine;
  private dailySummaries: DailyProductionSummary[] = [];
  private aiAnomalies: AiAnomalyEvent[] = [];
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SixMonthDataEngine {
    if (!SixMonthDataEngine.instance) {
      SixMonthDataEngine.instance = new SixMonthDataEngine();
    }
    return SixMonthDataEngine.instance;
  }

  /**
   * Generates or retrieves 180 days (6 months) of KG-D6 daily production settlements.
   */
  public generateSixMonthHistory(targetDate = new Date()): DailyProductionSummary[] {
    if (this.dailySummaries.length >= 180 && this.isInitialized) {
      return this.dailySummaries;
    }

    const summaries: DailyProductionSummary[] = [];
    const totalDays = 180;
    const nowMs = targetDate.getTime();
    const usdToInrRate = 86.85; // ASSUMPTION: fixed conversion for the INR column
    const drill = drillState(DRILL.rpm, DRILL.wobKn);

    for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(nowMs - dayOffset * 24 * 3600 * 1000);
      dayDate.setHours(0, 0, 0, 0);
      const dateStr = dayDate.toISOString().split('T')[0];
      const midday = dayDate.getTime() + 12 * 3600 * 1000;

      // Published block rate for that day, through the network physics and flow computer
      const net = solveNetwork(productionAt(midday));
      const exp = steadyRecord(net['TOPSIDE-MPFM-01'], WATER_CUT_PCT, midday);
      const man = net['MANIFOLD-D6-MAIN'];
      const slugAmp = slugging(net['RISER-ALPHA']).ampBar;

      const purified = Math.round(exp.net_oil_bpd);
      const water = Math.round(exp.produced_water_bpd ?? 0);
      const gross = purified + water;
      const valueUsd = Math.round(purified * CONDENSATE_PRICE_USD_BBL);

      summaries.push({
        id: totalDays - dayOffset,
        date_str: dateStr,
        timestamp_midnight: dayDate.getTime(),
        settlement_type: 'AUTOMATED_MIDNIGHT',
        gross_liquid_bpd: gross,
        gross_barrels_day: gross,
        water_cut_avg_pct: exp.water_cut_pct,
        purified_oil_bpd: purified,
        purified_barrels_day: purified,
        produced_water_bpd: water,
        associated_gas_mmscfd: exp.associated_gas_mmscfd ?? 0,
        avg_line_pressure_bar: Number(man.pBar.toFixed(1)),
        max_line_pressure_bar: Number((man.pBar + slugAmp).toFixed(1)),
        avg_temperature_c: Number(man.tC.toFixed(1)),
        avg_api_gravity: exp.api_gravity,
        avg_base_density: exp.corrected_density,
        avg_drill_rop_mhr: Number(drill.ropMh.toFixed(1)),
        total_drilled_meters: Math.round(drill.ropMh * 24),
        avg_drill_torque_knm: Number(drill.torqueKnm.toFixed(1)),
        drilling_uptime_hours: 24,
        plant_uptime_pct: 100,
        purity_compliance_pct: Number((100 - exp.water_cut_pct * 0.4).toFixed(1)),
        estimated_gross_value_usd: valueUsd,
        estimated_gross_value_inr: Number(((valueUsd * usdToInrRate) / 1e7).toFixed(2)),
        ai_anomalies_detected: 0,
        status: 'CERTIFIED',
        hash_signature: `DGH-KG6-${fnv64(`${dateStr}:${gross}:${purified}:${man.pBar.toFixed(1)}:${exp.api_gravity}`)}`,
      });
    }
    this.dailySummaries = summaries;
    this.aiAnomalies = []; // only real detections are logged (by the live AI pipeline)
    this.isInitialized = true;
    return summaries;
  }

  /**
   * Filter daily summaries for the past N weeks (e.g. 4 or 5 weeks = 28 or 35 days)
   */
  public getPastWeeks(weeks = 5): DailyProductionSummary[] {
    const days = weeks * 7;
    const summaries = this.getDailySummaries();
    return summaries.slice(-days);
  }

  /**
   * Filter daily summaries for a specific week (week 1 = most recent 7 days, week 2 = 8-14 days ago, etc.)
   */
  public getSpecificWeek(weekNum: number): DailyProductionSummary[] {
    const summaries = this.getDailySummaries();
    const total = summaries.length;
    const endIdx = total - (weekNum - 1) * 7;
    const startIdx = Math.max(0, endIdx - 7);
    return summaries.slice(startIdx, endIdx);
  }

  /**
   * Compute comprehensive 6-Month Macro KPI Analytics
   */
  public getSixMonthAnalytics(): SixMonthAnalytics {
    if (!this.isInitialized || this.dailySummaries.length === 0) {
      this.generateSixMonthHistory();
    }

    const summaries = this.dailySummaries;
    const totalDays = summaries.length;

    let totalGross = 0;
    let totalPurified = 0;
    let totalWater = 0;
    let totalGas = 0;
    let totalMeters = 0;
    let totalRevenueUsd = 0;
    let totalRevenueInrCr = 0;
    let sumWaterCut = 0;
    let sumPressure = 0;
    let sumTemp = 0;
    let sumUptime = 0;
    let totalAnomalies = 0;

    for (const d of summaries) {
      totalGross += d.gross_barrels_day;
      totalPurified += d.purified_barrels_day;
      totalWater += d.produced_water_bpd;
      totalGas += d.associated_gas_mmscfd;
      totalMeters += d.total_drilled_meters;
      totalRevenueUsd += d.estimated_gross_value_usd;
      totalRevenueInrCr += d.estimated_gross_value_inr;
      sumWaterCut += d.water_cut_avg_pct;
      sumPressure += d.avg_line_pressure_bar;
      sumTemp += d.avg_temperature_c;
      sumUptime += d.plant_uptime_pct;
      totalAnomalies += d.ai_anomalies_detected;
    }

    return {
      period_start: summaries[0]?.date_str || '',
      period_end: summaries[summaries.length - 1]?.date_str || '',
      total_days: totalDays,
      total_gross_extracted_barrels: totalGross,
      total_purified_dry_barrels: totalPurified,
      total_produced_water_barrels: totalWater,
      total_gas_produced_mmscf: Number(totalGas.toFixed(1)),
      overall_avg_purified_bpd: Math.round(totalPurified / totalDays),
      overall_avg_water_cut_pct: Number((sumWaterCut / totalDays).toFixed(2)),
      overall_avg_pressure_bar: Number((sumPressure / totalDays).toFixed(1)),
      overall_avg_temp_c: Number((sumTemp / totalDays).toFixed(1)),
      total_meters_drilled: totalMeters,
      avg_daily_plant_uptime_pct: Number((sumUptime / totalDays).toFixed(2)),
      total_estimated_revenue_usd: totalRevenueUsd,
      total_estimated_revenue_inr_cr: Number(totalRevenueInrCr.toFixed(2)),
      total_ai_anomalies_resolved: totalAnomalies,
    };
  }

  /**
   * Append a newly settled daily midnight ledger entry
   */
  public addDailySettlement(entry: DailyProductionSummary): void {
    const existingIdx = this.dailySummaries.findIndex((s) => s.date_str === entry.date_str);
    if (existingIdx >= 0) {
      this.dailySummaries[existingIdx] = entry;
    } else {
      this.dailySummaries.push(entry);
    }
  }

  public getDailySummaries(): DailyProductionSummary[] {
    if (!this.isInitialized) this.generateSixMonthHistory();
    return this.dailySummaries;
  }

  public getAiAnomalies(): AiAnomalyEvent[] {
    if (!this.isInitialized) this.generateSixMonthHistory();
    return this.aiAnomalies;
  }
}

export const sixMonthDataEngine = SixMonthDataEngine.getInstance();
