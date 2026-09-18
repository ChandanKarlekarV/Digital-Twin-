/**
 * Types for 6-Month Historical Database, AI Automated Ingestion, and 12:00 Midnight EOD Settlement
 */

export interface DailyProductionSummary {
  id?: number;
  date_str: string; // 'YYYY-MM-DD'
  timestamp_midnight: number; // Unix timestamp for 00:00:00 UTC/IST
  settlement_type: 'AUTOMATED_MIDNIGHT' | 'ON_DEMAND_MANUAL' | 'RECONCILED';

  // Gross & Purified Production
  gross_liquid_bpd: number; // Gross unseparated barrels per day
  gross_barrels_day: number; // Total gross barrels extracted in 24 hours
  water_cut_avg_pct: number; // Average water-cut percentage (BS&W)
  purified_oil_bpd: number; // Net dry standard oil rate (BPD)
  purified_barrels_day: number; // Total purified dry oil barrels delivered in 24 hours
  produced_water_bpd: number; // Total water volume separated and treated
  associated_gas_mmscfd: number; // Associated natural gas captured (MMSCFD)

  // Operating Physics Averages
  avg_line_pressure_bar: number; // 24-hr average subsea pressure
  max_line_pressure_bar: number; // Peak surge pressure
  avg_temperature_c: number; // 24-hr average fluid temperature
  avg_api_gravity: number; // ASTM D1250 standard gravity (°API)
  avg_base_density: number; // Density at 15.56°C (kg/m³)

  // Topside & Drilling Operations
  avg_drill_rop_mhr: number; // Average Rate of Penetration (m/hr)
  total_drilled_meters: number; // Total footage drilled in 24h
  avg_drill_torque_knm: number; // Average torsional stress
  drilling_uptime_hours: number; // Active rotating hours (e.g. 23.4 hrs)
  plant_uptime_pct: number; // Facility availability (e.g. 99.4%)

  // Quality & Economic Metrics
  purity_compliance_pct: number; // % meeting export spec (<0.5% BS&W)
  estimated_gross_value_usd: number; // Daily revenue based on Brent spot ($)
  estimated_gross_value_inr: number; // Daily revenue in Indian Rupees (₹ Crores)
  ai_anomalies_detected: number; // Number of AI automated alerts recorded
  status: 'CERTIFIED' | 'SETTLED' | 'PENDING_APPROVAL';
  hash_signature?: string; // Cryptographic SHA-256 integrity seal
}

export interface SixMonthAnalytics {
  period_start: string;
  period_end: string;
  total_days: number;
  total_gross_extracted_barrels: number;
  total_purified_dry_barrels: number;
  total_produced_water_barrels: number;
  total_gas_produced_mmscf: number;
  overall_avg_purified_bpd: number;
  overall_avg_water_cut_pct: number;
  overall_avg_pressure_bar: number;
  overall_avg_temp_c: number;
  total_meters_drilled: number;
  avg_daily_plant_uptime_pct: number;
  total_estimated_revenue_usd: number;
  total_estimated_revenue_inr_cr: number;
  total_ai_anomalies_resolved: number;
}

export interface AiAnomalyEvent {
  id?: number;
  timestamp: number;
  precise_time: string;
  asset_id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL_ESD';
  category: 'DRILL_OVERLOAD' | 'HYDRATE_RISK' | 'FLOW_RESTRICTION' | 'CORIOLIS_DRIFT' | 'PURITY_BREACH';
  detected_value: string;
  nominal_baseline: string;
  ai_inference_summary: string;
  recommended_action: string;
  is_automated_logged: boolean;
}
