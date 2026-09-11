export interface TelemetryRecord {
  id?: number;
  timestamp: number; // Unix timestamp in ms
  asset_id: string;   // e.g. 'RISER-ALPHA', 'MANIFOLD-D6', 'WELLHEAD-XT1'
  p_line_bar: number; // Line pressure in bar (nominal ~240 bar subsea)
  t_line_c: number;   // Line temperature in °C (nominal ~45-85 °C)
  f_osc_hz: number;   // Coriolis tube oscillation frequency in Hz (~1100-1400 Hz)
  raw_density: number; // Raw uncompensated density in kg/m³
  corrected_density: number; // ASTM D1250 corrected base density at 15.56°C (kg/m³)
  api_gravity: number; // °API gravity (~42-45 °API for KG-D6 light crude/condensate)
  water_cut_pct: number; // Water-cut fraction in % (~2-12%)
  gross_mass_rate: number; // Gross mass flow rate (kg/s)
  net_oil_bpd: number; // Net standard oil volume rate (Barrels Per Day)
  status_flag: number; // 0 = Nominal, 1 = Warning, 2 = Critical ESD, 3 = Hydrate Risk, 4 = Drill Lock
}

export interface TelemetryAggregate {
  avg_net_oil_bpd: number;
  max_p_line_bar: number;
  min_p_line_bar: number;
  avg_t_line_c: number;
  avg_water_cut_pct: number;
  avg_f_osc_hz: number;
  total_gross_mass_kg: number;
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
  water_cut_pct: number;
  raw_density: number;
}
