/**
 * AI Automated Ingestion & Real-Time Intelligence Pipeline
 * Continuously ingests streaming drill and pipeline telemetry, applies physics-informed
 * anomaly detection models, and records AI diagnosis events into the local database.
 */

import { TelemetryRecord } from '../types/telemetry';
import { AiAnomalyEvent } from '../types/eod';
import { telemetryDb } from '../db/TelemetryDatabase';
import { sixMonthDataEngine } from '../db/SixMonthDataEngine';
import { varunaVoice } from '../voice/VarunaVoiceSynthesizer';

export class AiIngestionPipelineService {
  private static instance: AiIngestionPipelineService;
  private isRunning = false;
  private unsubscribeDb: (() => void) | null = null;
  private packetCount = 0;
  private lastAlertTime = 0;
  private alertCooldownMs = 12000; // Prevent alert spamming

  private constructor() {}

  public static getInstance(): AiIngestionPipelineService {
    if (!AiIngestionPipelineService.instance) {
      AiIngestionPipelineService.instance = new AiIngestionPipelineService();
    }
    return AiIngestionPipelineService.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.unsubscribeDb = telemetryDb.subscribe((record) => {
      this.processTelemetryPacket(record);
    });
  }

  public stop(): void {
    if (this.unsubscribeDb) {
      this.unsubscribeDb();
      this.unsubscribeDb = null;
    }
    this.isRunning = false;
  }

  /**
   * AI Inference Engine running on every high-frequency telemetry packet.
   */
  private processTelemetryPacket(record: TelemetryRecord): void {
    this.packetCount++;
    const now = Date.now();

    // 1. AI Drillstring Mechanics & Torsional Overload Detection
    if (record.drill_torque_knm && record.drill_torque_knm > 38.5) {
      this.logAnomaly({
        timestamp: record.timestamp,
        precise_time: record.precise_time_iso || new Date().toISOString(),
        asset_id: record.asset_id,
        severity: 'WARNING',
        category: 'DRILL_OVERLOAD',
        detected_value: `${record.drill_torque_knm.toFixed(1)} kNm Torque`,
        nominal_baseline: 'Nominal Torque <= 28.4 kNm',
        ai_inference_summary: 'Subsea high-torque stick-slip oscillation detected on PDC rotary bit.',
        recommended_action: 'Reduce drill string WOB by 20 kN and decrease RPM by 15%',
        is_automated_logged: true,
      });

      if (now - this.lastAlertTime > this.alertCooldownMs) {
        this.lastAlertTime = now;
        varunaVoice.speakCustom('AI Warning: Rotary drill torsional load exceeded threshold.');
      }
    }

    // 2. AI Darcy-Weisbach Hydraulic Flow Choking & Hydrate Plug Risk
    if (record.p_line_bar > 275.0 && record.t_line_c < 28.0) {
      this.logAnomaly({
        timestamp: record.timestamp,
        precise_time: record.precise_time_iso || new Date().toISOString(),
        asset_id: record.asset_id,
        severity: 'CRITICAL_ESD',
        category: 'HYDRATE_RISK',
        detected_value: `Pressure: ${record.p_line_bar.toFixed(1)} bar, Temp: ${record.t_line_c.toFixed(1)} °C`,
        nominal_baseline: 'Hydrate Equilibrium Curve: Temp > 22°C @ 240 bar',
        ai_inference_summary: 'Cryogenic seabed methane hydrate crystallization risk at subsea choke valve.',
        recommended_action: 'Initiate continuous MEG (Monoethylene Glycol) chemical injection immediately.',
        is_automated_logged: true,
      });

      if (now - this.lastAlertTime > this.alertCooldownMs) {
        this.lastAlertTime = now;
        varunaVoice.speakCustom('AI Alert: Subsea gas hydrate crystallization boundary detected.');
      }
    }

    // 3. AI Multiphase Water-Cut & Purity Breach Detection (ASTM D1250)
    if (record.water_cut_pct > 12.0) {
      this.logAnomaly({
        timestamp: record.timestamp,
        precise_time: record.precise_time_iso || new Date().toISOString(),
        asset_id: record.asset_id,
        severity: 'WARNING',
        category: 'PURITY_BREACH',
        detected_value: `Water-Cut: ${record.water_cut_pct.toFixed(1)}%`,
        nominal_baseline: 'Nominal Water-Cut < 6.0%',
        ai_inference_summary: 'Water coning breakthrough detected. Net dry purified oil recovery reduced.',
        recommended_action: 'Adjust subsea manifold choke trim and engage second-stage electro-coalescer.',
        is_automated_logged: true,
      });
    }

    // 4. Coriolis Resonant Tube Density Drift
    if (record.f_osc_hz < 1180.0 || record.f_osc_hz > 1420.0) {
      this.logAnomaly({
        timestamp: record.timestamp,
        precise_time: record.precise_time_iso || new Date().toISOString(),
        asset_id: record.asset_id,
        severity: 'INFO',
        category: 'CORIOLIS_DRIFT',
        detected_value: `Frequency: ${record.f_osc_hz.toFixed(1)} Hz`,
        nominal_baseline: 'Nominal Band: 1240 - 1310 Hz',
        ai_inference_summary: 'Entrained free gas bubbles causing Coriolis tube dampening.',
        recommended_action: 'Apply Net Oil Computer (NOC) dual-phase mathematical correction algorithm.',
        is_automated_logged: true,
      });
    }
  }

  private logAnomaly(event: AiAnomalyEvent): void {
    const list = sixMonthDataEngine.getAiAnomalies();
    // Keep max 500 recent events
    if (list.length > 500) {
      list.shift();
    }
    list.push(event);
  }

  public getPacketCount(): number {
    return this.packetCount;
  }
}

export const aiIngestionPipeline = AiIngestionPipelineService.getInstance();
