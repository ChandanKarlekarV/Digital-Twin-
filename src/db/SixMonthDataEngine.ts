/**
 * 6-Month Historical Data Engine & Seeder for KG-D6 Subsea Digital Twin
 * Generates and indexes 180 days (6 full months) of calibrated offshore production,
 * multiphase separation, oil purification, and drilling mechanics.
 */

import { DailyProductionSummary, SixMonthAnalytics, AiAnomalyEvent } from '../types/eod';
import { TelemetryRecord } from '../types/telemetry';

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
    const anomalies: AiAnomalyEvent[] = [];
    const totalDays = 180;
    const nowMs = targetDate.getTime();

    // Baseline KG-D6 Field Constants
    const baselineNominalBpd = 122450;
    const usdToInrRate = 86.85;

    for (let dayOffset = totalDays - 1; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(nowMs - dayOffset * 24 * 3600 * 1000);
      dayDate.setHours(0, 0, 0, 0);

      const dateStr = dayDate.toISOString().split('T')[0];
      const timestampMidnight = dayDate.getTime();

      // Cyclical and seasonal variation factors (Monsoon storms in Oct-Nov, winter optimization in Dec-Jan)
      const seasonalIndex = (totalDays - dayOffset) / totalDays;
      const seasonalWave = Math.sin(seasonalIndex * Math.PI * 2) * 0.04;
      const weeklyCycle = Math.sin((dayOffset % 7) * (Math.PI * 2 / 7)) * 0.015;
      const randomJitter = (Math.sin(dayOffset * 37.7) * 0.025);

      // Total Gross Liquid Extracted (BPD)
      const efficiencyFactor = 0.96 + seasonalWave + weeklyCycle + randomJitter;
      const grossBpd = Math.round(baselineNominalBpd * efficiencyFactor);
      const grossBarrels = Math.round(grossBpd); // 24-hr daily volume at standard conditions

      // Multiphase Water-Cut & BS&W (ASTM D1250)
      // Realistic water-cut progression with intermittent water breakthroughs
      const isWaterSurgeDay = dayOffset % 23 === 0;
      const baseWaterCut = 4.2 + (180 - dayOffset) * 0.012; // Slight natural reservoir water encroachment
      const waterCutPct = Number((baseWaterCut + (isWaterSurgeDay ? 4.5 : Math.sin(dayOffset * 13.3) * 0.8)).toFixed(2));

      // Net Dry Purified Oil Produced
      const oilPurityFraction = 1.0 - (waterCutPct / 100);
      const purifiedBpd = Math.round(grossBpd * oilPurityFraction);
      const purifiedBarrels = Math.round(purifiedBpd);
      const producedWaterBpd = Math.round(grossBpd * (waterCutPct / 100));

      // Associated Natural Gas (KG-D6 Gas-to-Oil Ratio ~ 480 SCF/bbl)
      const gasRatio = 460 + Math.sin(dayOffset * 19.1) * 35;
      const gasMmscfd = Number(((purifiedBpd * gasRatio) / 1000000).toFixed(2));

      // Pressures & Temperatures
      const avgPressure = Number((246.5 - (180 - dayOffset) * 0.03 + Math.sin(dayOffset * 7.1) * 3.8).toFixed(1));
      const maxPressure = Number((avgPressure + 18.4 + Math.random() * 6.2).toFixed(1));
      const avgTemp = Number((54.2 + Math.sin(dayOffset * 5.5) * 4.1).toFixed(1));
      const apiGravity = Number((44.2 + Math.sin(dayOffset * 11.2) * 0.6).toFixed(1));
      const baseDensity = Number((805.4 + Math.sin(dayOffset * 11.2) * 2.8).toFixed(1));

      // Topside Drill String Operations
      const isDrillMaintenanceDay = dayOffset % 45 === 0;
      const drillUptime = isDrillMaintenanceDay ? 14.5 : Number((23.2 + Math.random() * 0.7).toFixed(1));
      const avgRop = isDrillMaintenanceDay ? 6.2 : Number((12.4 + Math.sin(dayOffset * 8.9) * 2.8).toFixed(1));
      const drilledMeters = Math.round(avgRop * drillUptime);
      const avgTorque = Number((28.6 + Math.sin(dayOffset * 4.3) * 3.1).toFixed(1));
      const plantUptime = isDrillMaintenanceDay ? 94.2 : Number((99.1 + Math.random() * 0.8).toFixed(1));

      // Economics & Valuation ($76 - $84 / bbl Brent light crude blend)
      const brentPriceUsd = 78.5 + Math.sin(dayOffset * 3.1) * 4.2;
      const grossValueUsd = Math.round(purifiedBarrels * brentPriceUsd);
      const grossValueInrCr = Number(((grossValueUsd * usdToInrRate) / 10000000).toFixed(2));

      // AI Anomaly Events per Day
      let dailyAnomaliesCount = 0;
      if (isWaterSurgeDay) {
        dailyAnomaliesCount += 1;
        anomalies.push({
          timestamp: timestampMidnight + 14 * 3600 * 1000,
          precise_time: `${dateStr}T14:00:00.000Z`,
          asset_id: 'MANIFOLD-D6-MAIN',
          severity: 'WARNING',
          category: 'PURITY_BREACH',
          detected_value: `Water-cut: ${waterCutPct}%`,
          nominal_baseline: 'Water-cut < 5.0%',
          ai_inference_summary: 'ASTM D1250 water encroachment surge detected in deepwater riser manifold',
          recommended_action: 'Increase demulsifier dosing at topside separator MPFM-01',
          is_automated_logged: true,
        });
      }

      if (avgTorque > 31.0) {
        dailyAnomaliesCount += 1;
        anomalies.push({
          timestamp: timestampMidnight + 9 * 3600 * 1000,
          precise_time: `${dateStr}T09:00:00.000Z`,
          asset_id: 'TOPSIDE-DRILL-RIG',
          severity: 'INFO',
          category: 'DRILL_OVERLOAD',
          detected_value: `Torque: ${avgTorque} kNm`,
          nominal_baseline: 'Nominal Torque: 28.4 kNm',
          ai_inference_summary: 'Subsea basalt transition layer encountered. Elevated stick-slip variance.',
          recommended_action: 'Reduce WOB by 15 kN and increase mud flow by 200 L/min',
          is_automated_logged: true,
        });
      }

      // Safe hash signature generation for browser and Node.js environments
      const rawPayload = `${dateStr}:${grossBarrels}:${purifiedBarrels}:${avgPressure}:${apiGravity}`;
      let hashSig = `DGH-KG6-${dateStr.replace(/-/g, '')}`;
      try {
        if (typeof btoa !== 'undefined') {
          hashSig = `DGH-KG6-${btoa(rawPayload).slice(0, 16)}`;
        } else if (typeof Buffer !== 'undefined') {
          hashSig = `DGH-KG6-${Buffer.from(rawPayload).toString('base64').slice(0, 16)}`;
        }
      } catch {
        hashSig = `DGH-KG6-${Math.abs(Math.sin(dayOffset * 99.7)).toString(36).substring(2, 18).toUpperCase()}`;
      }

      summaries.push({
        id: totalDays - dayOffset,
        date_str: dateStr,
        timestamp_midnight: timestampMidnight,
        settlement_type: 'AUTOMATED_MIDNIGHT',
        gross_liquid_bpd: grossBpd,
        gross_barrels_day: grossBarrels,
        water_cut_avg_pct: waterCutPct,
        purified_oil_bpd: purifiedBpd,
        purified_barrels_day: purifiedBarrels,
        produced_water_bpd: producedWaterBpd,
        associated_gas_mmscfd: gasMmscfd,
        avg_line_pressure_bar: avgPressure,
        max_line_pressure_bar: maxPressure,
        avg_temperature_c: avgTemp,
        avg_api_gravity: apiGravity,
        avg_base_density: baseDensity,
        avg_drill_rop_mhr: avgRop,
        total_drilled_meters: drilledMeters,
        avg_drill_torque_knm: avgTorque,
        drilling_uptime_hours: drillUptime,
        plant_uptime_pct: plantUptime,
        purity_compliance_pct: Number((100 - waterCutPct * 0.4).toFixed(1)),
        estimated_gross_value_usd: grossValueUsd,
        estimated_gross_value_inr: grossValueInrCr,
        ai_anomalies_detected: dailyAnomaliesCount,
        status: 'CERTIFIED',
        hash_signature: hashSig,
      });
    }

    this.dailySummaries = summaries;
    this.aiAnomalies = anomalies;
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
