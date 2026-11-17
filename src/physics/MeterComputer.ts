/**
 * Flow-computer chain shared by the live emitter and the history seeder:
 * Coriolis frequency -> line density -> water cut (density deconvolution) ->
 * water-free condensate density -> ASTM D1250 base density and API.
 */
import type { TelemetryRecord } from '../types/telemetry';
import { coriolisEngine } from './CoriolisEngine';
import { astm1250Engine } from './ASTM1250Engine';
import { multiphaseCutEngine } from './MultiphaseCut';
import { SCF_PER_SCM } from '../data/kgd6Production';
import { AssetState, condensateDensity, mixDensity, CONDENSATE_RHO_15C, BRINE_RHO, DRILL, drillState } from './KgD6FlowModel';

/** Coriolis tube frequency for a liquid of this water cut at line conditions */
export const tubeFrequency = (wcPct: number, tC: number, pBar: number) =>
  coriolisEngine.computeFrequencyFromDensity(mixDensity(wcPct, tC, pBar), tC);

export function meterRecord(
  id: string,
  s: AssetState,
  m: { p: number; t: number; f: number; mass: number; wc: number },
  status: number,
  timestamp = Date.now()
): TelemetryRecord {
  const cor = coriolisEngine.computeDensityFromFrequency(m.f, m.t);
  const rhoMix = cor.temp_compensated_density_kg_m3;
  const mp = multiphaseCutEngine.deconvolveFlow(rhoMix, condensateDensity(m.t, m.p), m.mass, CONDENSATE_RHO_15C, BRINE_RHO);
  const wcf = mp.water_cut_vol_fraction;
  const rhoOil = wcf < 0.999 ? (rhoMix - wcf * BRINE_RHO) / (1 - wcf) : rhoMix;
  const astm = astm1250Engine.executeFullCorrection(rhoOil, m.t, m.p);
  return {
    timestamp,
    precise_time_iso: new Date(timestamp).toISOString(),
    asset_id: id,
    p_line_bar: Number(m.p.toFixed(2)),
    t_line_c: Number(m.t.toFixed(2)),
    f_osc_hz: Number(m.f.toFixed(3)),
    raw_density: Number(cor.uncompensated_density_kg_m3.toFixed(2)),
    corrected_density: Number(astm.rho_base.toFixed(2)),
    api_gravity: Number(astm.api_gravity.toFixed(2)),
    water_cut_pct: Number(m.wc.toFixed(2)),
    gross_mass_rate: Number(m.mass.toFixed(3)),
    gross_liquid_bpd: Number((mp.net_oil_bpd + mp.water_bpd).toFixed(1)),
    net_oil_bpd: Number(mp.net_oil_bpd.toFixed(1)),
    purified_oil_bpd: Number(mp.net_oil_bpd.toFixed(1)),
    produced_water_bpd: Number(mp.water_bpd.toFixed(1)),
    associated_gas_mmscfd: Number((s.gasMmscmd * SCF_PER_SCM).toFixed(2)),
    status_flag: status,
  };
}

/** Record of the true (steady) process state, as the meters would read it */
export function steadyRecord(s: AssetState, wcPct: number, timestamp: number): TelemetryRecord {
  return meterRecord(s.id, s, { p: s.pBar, t: s.tC, f: tubeFrequency(wcPct, s.tC, s.pBar), mass: s.liquidKgS, wc: wcPct }, 0, timestamp);
}

export const DRILL_ASSET = 'TOPSIDE-DRILL-RIG';
/** ASSUMPTION: mud return temperature */
export const DRILL_MUD_TEMP_C = 60;

export function drillRecord(rpm: number, torque: number, rop: number, status: number, timestamp = Date.now()): TelemetryRecord {
  const spp = drillState(rpm, DRILL.wobKn).sppBar;
  return {
    timestamp,
    precise_time_iso: new Date(timestamp).toISOString(),
    asset_id: DRILL_ASSET,
    p_line_bar: Number(spp.toFixed(2)),
    t_line_c: DRILL_MUD_TEMP_C,
    f_osc_hz: 0,
    raw_density: DRILL.mudDensity,
    corrected_density: DRILL.mudDensity,
    api_gravity: 0,
    water_cut_pct: 0,
    gross_mass_rate: Number(((DRILL.mudLpm / 60000) * DRILL.mudDensity).toFixed(2)),
    gross_liquid_bpd: 0,
    net_oil_bpd: 0,
    purified_oil_bpd: 0,
    produced_water_bpd: 0,
    associated_gas_mmscfd: 0,
    status_flag: status,
    drill_rpm: Number(rpm.toFixed(1)),
    drill_torque_knm: Number(torque.toFixed(2)),
    drill_wob_kn: DRILL.wobKn,
    drill_rop_mhr: Number(rop.toFixed(2)),
    drill_spp_bar: Number(spp.toFixed(1)),
    mud_flow_in_lpm: DRILL.mudLpm,
    mud_flow_out_lpm: DRILL.mudLpm,
  };
}
