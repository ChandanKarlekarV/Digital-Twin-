export interface TelemetryRecord {
  id?: number;
  timestamp: number; // Unix timestamp in ms
  precise_time_iso?: string; // High-precision ISO timestamp with microseconds
  asset_id: string;   // e.g. 'RISER-ALPHA', 'MANIFOLD-D6', 'WELLHEAD-XT1', 'TOPSIDE-DRILL-RIG'
  p_line_bar: number; // Line pressure in bar (nominal ~240 bar subsea)
  t_line_c: number;   // Line temperature in °C (nominal ~45-85 °C)
  f_osc_hz: number;   // Coriolis tube oscillation frequency in Hz (~1100-1400 Hz)
  raw_density: number; // Raw uncompensated density in kg/m³
  corrected_density: number; // ASTM D1250 corrected base density at 15.56°C (kg/m³)
  api_gravity: number; // °API gravity (~42-45 °API for KG-D6 light crude/condensate)
  water_cut_pct: number; // Water-cut fraction in % (~2-12%)
  gross_mass_rate: number; // Gross mass flow rate (kg/s)
  gross_liquid_bpd?: number; // Total gross liquid extracted (Barrels Per Day)
  net_oil_bpd: number; // Net standard oil volume rate (Barrels Per Day)
  purified_oil_bpd?: number; // Net dry purified oil volume rate (BPD after ASTM D1250 separation)
  produced_water_bpd?: number; // Separated water rate (BPD)
  associated_gas_mmscfd?: number; // Associated natural gas rate (Million Standard Cubic Feet / Day)
  status_flag: number; // 0 = Nominal, 1 = Warning, 2 = Critical ESD, 3 = Hydrate Risk, 4 = Drill Lock

  // High-Frequency Drill String Mechanics & Telemetry
  drill_rpm?: number; // Rotary drill speed (0 - 150 RPM)
  drill_torque_knm?: number; // Rotary torsional load (nominal 28.4 kNm)
  drill_wob_kn?: number; // Weight On Bit (nominal 140 kN)
  drill_rop_mhr?: number; // Rate of Penetration (nominal 12.5 m/hr)
  drill_spp_bar?: number; // Standpipe Mud Circulation Pressure (nominal 210 bar)
  mud_flow_in_lpm?: number; // Drilling mud inlet volume (nominal 2800 L/min)
  mud_flow_out_lpm?: number; // Drilling mud return volume (nominal 2800 L/min)
  drill_vibration_g?: number; // Drillstring tri-axial vibration load in Gs
}

export interface TelemetryAggregate {
  avg_net_oil_bpd: number;
  avg_purified_oil_bpd?: number;
  avg_gross_liquid_bpd?: number;
  max_p_line_bar: number;
  min_p_line_bar: number;
  avg_t_line_c: number;
  avg_water_cut_pct: number;
  avg_f_osc_hz: number;
  total_gross_mass_kg: number;
  total_purified_barrels?: number;
  avg_drill_torque_knm?: number;
  avg_drill_rop_mhr?: number;
  record_count: number;
  start_timestamp: number;
  end_timestamp: number;
}

export interface TelemetryTimeBucket {
  timestamp: number;
  p_line_bar: number;
  t_line_c: number;
  f_osc_hz: number;
  net_oil_bpd: number;
  purified_oil_bpd?: number;
  water_cut_pct: number;
  raw_density: number;
  drill_torque_knm?: number;
  drill_rop_mhr?: number;
}
