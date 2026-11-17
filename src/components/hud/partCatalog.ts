/**
 * What the part-inspection panel shows for each component. Every metric says where its
 * number comes from:
 *   live   - the newest meter record, live weather or the leak detector
 *   model  - computed by the twin's physics for today's published rate
 *   design - a fixed equipment rating (illustrative: the operator does not publish these)
 */
import type React from 'react';
import { Activity, Anchor, Compass, Cpu, Disc, Droplets, Flame, Gauge, ShieldCheck, Thermometer, Waves, Wind, Zap } from 'lucide-react';
import type { HolographicComponentType } from '../../store/useRigStore';
import type { TelemetryRecord } from '../../types/telemetry';
import type { KgD6WeatherReport } from '../../services/KgD6WeatherService';
import type { LeakStatus } from '../../services/LeakDetector';
import { productionAt, MJ_FIELD, SCF_PER_SCM } from '../../data/kgd6Production';
import { solveNetwork, gasDensity, GAS_RHO_STD, DRILL, STICK_SLIP_HZ, slugging, AssetState } from '../../physics/KgD6FlowModel';
import { drillTorsionalEngine } from '../../physics/DrillTorsionalStress';
import { PHYSICS_HZ } from '../../physics/TelemetryEmitter';

export type Source = 'live' | 'model' | 'design';
export interface PartMetric {
  label: string;
  val: string;
  icon: React.ComponentType<{ className?: string }>;
  source: Source;
}
export interface PartData {
  title: string;
  tag: string;
  spec: string;
  depth: string;
  latex: string;
  metrics: PartMetric[];
}

export interface PartContext {
  latest: (assetId: string) => TelemetryRecord | null;
  weather: KgD6WeatherReport | null;
  leak: LeakStatus;
}

const n = (v: number | undefined, d = 1) => (v === undefined || !Number.isFinite(v) ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const gasMmscmd = (r: TelemetryRecord | null) => (r ? (r.associated_gas_mmscfd ?? 0) / SCF_PER_SCM : undefined);
const m = (label: string, val: string, icon: PartMetric['icon'], source: Source): PartMetric => ({ label, val, icon, source });

/** Actual gas velocity and Reynolds number in a pipe of diameter d (m) */
function pipeFlow(s: AssetState, d: number) {
  const rho = gasDensity(s.pBar, s.tC);
  const qActual = (s.gasMmscmd * 1e6 * GAS_RHO_STD) / 86400 / rho; // m³/s
  const v = qActual / ((Math.PI / 4) * d * d);
  const mu = 2.0e-5; // Pa·s, natural gas at line conditions
  return { v, re: (rho * v * d) / mu };
}

const PIPE_D: Record<string, number> = { riser: 0.3048, flowline: 0.2032, header: 0.4064 };

export function partData(type: HolographicComponentType, ctx: PartContext): PartData {
  const net = solveNetwork(productionAt());
  const pub = productionAt();
  const w = ctx.weather;
  const windNow = w ? `${n(w.windSpeedKnots)} kt from ${w.windDirectionLabel}` : 'loading…';

  // ---------- Pipes 1-9 ----------
  if (type.startsWith('pipe')) {
    const k = Number(type.slice(4));
    const meta =
      k === 1 ? { name: 'Production riser Alpha', id: 'RISER-ALPHA', kind: 'riser', metered: true }
      : k === 2 ? { name: 'Production riser Bravo', id: 'RISER-BRAVO', kind: 'riser', metered: true }
      : k === 9 ? { name: 'Subsea manifold header', id: 'MANIFOLD-D6-MAIN', kind: 'header', metered: true }
      : { name: `Infield flowline ${k - 2}`, id: 'XT-WELLHEAD-01', kind: 'flowline', metered: false };
    const r = meta.metered ? ctx.latest(meta.id) : null;
    const s = net[meta.id];
    const d = PIPE_D[meta.kind];
    const f = pipeFlow(s, d);
    const sl = slugging(s);
    const src: Source = meta.metered ? 'live' : 'model';
    return {
      title: `Pipe ${k} · ${meta.name}`,
      tag: meta.metered ? meta.id : `FLOWLINE-${k - 2}`,
      spec: `${Math.round(d / 0.0254)}" ${meta.kind === 'riser' ? 'steel riser' : meta.kind === 'header' ? 'manifold header' : 'infield flowline'} (design)`,
      depth: meta.kind === 'riser' ? `Seabed to topside (~${MJ_FIELD.waterDepthM.toLocaleString()} m)` : 'Seabed',
      latex: '\\Delta P^2 = K\\,Q^2,\\qquad \\rho_g = \\frac{P M}{Z R T},\\qquad Re = \\frac{\\rho v D}{\\mu}',
      metrics: [
        m('Gas flow', `${n(meta.metered ? gasMmscmd(r) : s.gasMmscmd, 2)} MMSCMD`, Droplets, src),
        m('Condensate', `${n(meta.metered ? r?.net_oil_bpd : s.condensateBpd, 0)} bbl/d`, Droplets, src),
        m('Line pressure', `${n(meta.metered ? r?.p_line_bar : s.pBar)} bar`, Gauge, src),
        m('Fluid temperature', `${n(meta.metered ? r?.t_line_c : s.tC)} °C`, Thermometer, src),
        m('Gas velocity', `${n(f.v, 2)} m/s · Re ${n(f.re / 1e6, 1)}M`, Activity, 'model'),
        m('Slug period', sl.freqHz ? `${n(1 / sl.freqHz, 0)} s · ±${n(sl.ampBar, 2)} bar` : 'no slugging', Waves, 'model'),
      ],
    };
  }

  // ---------- Wells ----------
  if (type.startsWith('well')) {
    const single = type !== 'wells1_7';
    const k = single ? Number(type.slice(4)) : 0;
    const metered = k === 1 || k === 2;
    const id = k === 2 ? 'XT-WELLHEAD-02' : 'XT-WELLHEAD-01';
    const r = metered ? ctx.latest(id) : null;
    const s = net[id];
    const src: Source = metered ? 'live' : 'model';
    return {
      title: single ? `Subsea well ${k} · Christmas tree` : 'Subsea wells 1–7',
      tag: single ? (metered ? id : `WELL-${k}`) : 'WELL-CLUSTER',
      spec: 'Subsea Christmas tree, HPHT gas-condensate service (design)',
      depth: `Wells ~${MJ_FIELD.wellDepthM.toLocaleString()} m below sea level (MJ field)`,
      latex: 'q = C\\,(P_s^2 - P_{wh}^2)^{n}',
      metrics: [
        m('Wellhead pressure', `${n(metered ? r?.p_line_bar : s.pBar)} bar`, Gauge, src),
        m('Wellhead temperature', `${n(metered ? r?.t_line_c : s.tC)} °C`, Thermometer, src),
        m(single ? 'Gas rate' : 'Block gas rate', `${n(single ? (metered ? gasMmscmd(r) : s.gasMmscmd) : pub.gasMmscmd, 2)} MMSCMD`, Droplets, single ? src : 'live'),
        m(single ? 'Condensate' : 'Block condensate', `${n(single ? (metered ? r?.net_oil_bpd : s.condensateBpd) : pub.liquidsBpd, 0)} bbl/d`, Droplets, single ? src : 'live'),
        m('Reservoir fluid', 'Gas-condensate (HPHT)', Flame, 'design'),
        m('Wells in the MJ field', `${MJ_FIELD.developmentWells} development wells`, Compass, 'design'),
      ],
    };
  }

  // ---------- Drilling ----------
  const dr = ctx.latest('TOPSIDE-DRILL-RIG');
  const rpm = dr?.drill_rpm ?? DRILL.rpm;
  const torque = dr?.drill_torque_knm ?? DRILL.designTorqueKnm;
  const rop = dr?.drill_rop_mhr ?? DRILL.designRopMh;
  const stress = drillTorsionalEngine.calculate({ torqueKNm: torque, rotarySpeedRPM: rpm });
  const bitArea = (Math.PI / 4) * DRILL.bitD ** 2;
  const bitTorqueNm = ((DRILL.bitMu * DRILL.wobKn * DRILL.bitD) / 3) * 1000;
  // Teale (1965) mechanical specific energy, MPa
  const mse = (DRILL.wobKn * 1000) / bitArea / 1e6 + (2 * Math.PI * rpm * 60 * bitTorqueNm) / (bitArea * Math.max(rop, 0.1)) / 1e6;

  if (type === 'drill' || type === 'drill_string' || type === 'drill_bit') {
    const common = [
      m('Rotary speed', `${n(rpm, 0)} RPM`, Disc, 'live' as Source),
      m('Torque', `${n(torque)} kNm`, Zap, 'live' as Source),
      m('Rate of penetration', `${n(rop)} m/h`, Activity, 'live' as Source),
    ];
    if (type === 'drill_bit')
      return {
        title: '8½" PDC drill bit',
        tag: 'PDC-BIT-8.5IN',
        spec: '8½" (215.9 mm) PDC bit, bit friction 0.25 (design)',
        depth: 'Bottom of hole',
        latex: 'MSE = \\frac{W}{A_b} + \\frac{2\\pi N T_b}{A_b\\,ROP},\\qquad T_b = \\frac{\\mu W D}{3}',
        metrics: [
          ...common,
          m('Weight on bit', `${n(dr?.drill_wob_kn ?? DRILL.wobKn, 0)} kN`, Gauge, 'live'),
          m('Bit torque', `${n(bitTorqueNm / 1000, 2)} kNm`, Zap, 'model'),
          m('Specific energy (MSE)', `${n(mse, 0)} MPa`, Activity, 'model'),
        ],
      };
    return {
      title: type === 'drill' ? 'Drilling system' : 'Drill string',
      tag: type === 'drill' ? 'DRILL-SYSTEM' : 'DRILL-STRING',
      spec: '6⅝" S-135 drill pipe, 5.901" ID (design)',
      depth: `String to ~${MJ_FIELD.wellDepthM.toLocaleString()} m`,
      latex: '\\tau = \\frac{T\\,r_o}{J},\\qquad SF = \\frac{\\tau_y}{\\tau},\\qquad f_{ss} = \\frac{\\sqrt{G/\\rho}}{4L}',
      metrics: [
        ...common,
        m('Standpipe pressure', `${n(dr?.drill_spp_bar)} bar`, Gauge, 'live'),
        m('Shear stress / safety factor', `${n(stress.torsionalShearStressMPa)} MPa · SF ${n(stress.safetyFactor, 1)}`, ShieldCheck, 'model'),
        m('Stick-slip mode', `${n(STICK_SLIP_HZ, 3)} Hz (${n(1 / STICK_SLIP_HZ, 1)} s)`, Waves, 'model'),
      ],
    };
  }

  const exp = ctx.latest('TOPSIDE-MPFM-01');
  const sea = w ? `Hs ${n(w.significantWaveHeightM, 2)} m · ${n(w.peakWavePeriodSec, 0)} s` : 'loading…';

  switch (type) {
    case 'helipad':
      return {
        title: 'Helideck',
        tag: 'HELIDECK',
        spec: 'CAP 437 helideck (design)',
        depth: 'Topside',
        latex: '\\text{Operating limits are set by wind over deck and sea state (CAP 437)}',
        metrics: [
          m('Wind', windNow, Wind, 'live'),
          m('Gusts', w ? `${n(w.windGustsKnots)} kt` : '—', Wind, 'live'),
          m('Sea state', sea, Waves, 'live'),
          m('Visibility', w ? `${n(w.visibilityKm)} km` : '—', Compass, 'live'),
          m('Design helicopter', 'Sikorsky S-92 class', Anchor, 'design'),
          m('Max landing weight', '12.8 t', Gauge, 'design'),
        ],
      };
    case 'crane1':
    case 'crane2':
      return {
        title: type === 'crane1' ? 'Crane 1 (lattice boom)' : 'Crane 2 (pedestal)',
        tag: type === 'crane1' ? 'CRANE-1' : 'CRANE-2',
        spec: type === 'crane1' ? '42 m lattice boom (design)' : '28 m boom (design)',
        depth: 'Main deck',
        latex: '\\text{Dynamic factor } = 1 + 0.4\\,\\frac{H_s}{3\\text{ m}}' + (w ? ` = ${n(1 + (0.4 * w.significantWaveHeightM) / 3, 2)}` : ''),
        metrics: [
          m('Wind now', windNow, Wind, 'live'),
          m('Sea state', sea, Waves, 'live'),
          m('Lift status', w ? (w.windSpeedKnots < (type === 'crane1' ? 38 : 35) ? 'Within wind limit' : 'STOP: wind over limit') : '—', ShieldCheck, 'live'),
          m('Wind limit', type === 'crane1' ? '38 kt' : '35 kt', Gauge, 'design'),
          m('Safe working load', type === 'crane1' ? '65 t' : '30 t', Anchor, 'design'),
          m('Max radius', type === 'crane1' ? '42 m' : '28 m', Compass, 'design'),
        ],
      };
    case 'command_dock':
      return {
        title: 'Command dock · digital twin',
        tag: 'VARUNA-AI',
        spec: 'Browser digital twin: physics, metering, leak detection, voice and gestures',
        depth: 'Control room',
        latex: 'r = \\dot m_{in} - \\dot m_{out} - \\frac{dM_{pack}}{dt}',
        metrics: [
          m('Physics rate', `${PHYSICS_HZ} Hz fixed step`, Cpu, 'live'),
          m('Production basis', `${n(pub.gasMmscmd, 1)} MMSCMD · ${pub.basis}`, Droplets, 'live'),
          m('Leak detection', ctx.leak.state === 'normal' ? 'No leak' : ctx.leak.state === 'watch' ? 'Watching' : 'LEAK ALARM', ShieldCheck, 'live'),
          m('Mass imbalance', `${n(Math.max(0, ctx.leak.imbalancePct), 2)}%`, Activity, 'live'),
          m('Weather feed', w?.isLiveFetched ? 'Open-Meteo live' : 'Offline climatology', Wind, 'live'),
          m('Voice wake word', '“Varuna”', Zap, 'design'),
        ],
      };
    case 'accommodation':
      return {
        title: 'Accommodation module',
        tag: 'ACCOMMODATION',
        spec: 'Living quarters and temporary refuge (design)',
        depth: 'Topside',
        latex: 'Q_{HVAC} = \\dot m\\,c_p\\,\\Delta T',
        metrics: [
          m('Outside air', w ? `${n(w.airTemperatureC)} °C · ${n(w.relativeHumidityPct, 0)}% RH` : '—', Thermometer, 'live'),
          m('Wind', windNow, Wind, 'live'),
          m('Beds (POB)', '120', ShieldCheck, 'design'),
          m('Refuge endurance', '96 h', Zap, 'design'),
          m('Fire rating', 'H-60', ShieldCheck, 'design'),
          m('HVAC overpressure', '50 Pa', Gauge, 'design'),
        ],
      };
    case 'industrial_pipes':
      return {
        title: 'Topside process piping',
        tag: 'PROCESS-PIPING',
        spec: 'Duplex stainless steel, ANSI 2500 flanges (design)',
        depth: 'Topside',
        latex: '\\sigma_{hoop} = \\frac{P\\,D}{2\\,t}',
        metrics: [
          m('Export gas', `${n(gasMmscmd(exp), 2)} MMSCMD`, Droplets, 'live'),
          m('Export condensate', `${n(exp?.net_oil_bpd, 0)} bbl/d`, Droplets, 'live'),
          m('Arrival pressure', `${n(exp?.p_line_bar)} bar`, Gauge, 'live'),
          m('Arrival temperature', `${n(exp?.t_line_c)} °C`, Thermometer, 'live'),
          m('Design pressure', '414 bar', Gauge, 'design'),
          m('Flange rating', 'ANSI 2500', ShieldCheck, 'design'),
        ],
      };
    case 'jackup_legs':
      return {
        title: 'Support legs & foundation',
        tag: 'SUPPORT-LEGS',
        spec: 'Steel jacket legs, fixed platform (design)',
        depth: 'Seabed to topside',
        latex: 'F_D = \\tfrac{1}{2}\\,\\rho\\,C_d\\,D\\,v^2\\ \\text{per metre (Morison)}',
        metrics: [
          m('Current at site', w ? `${n(w.oceanCurrentSpeedKt)} kt` : '—', Waves, 'live'),
          m('Waves', sea, Waves, 'live'),
          m('Drag per metre (D 0.5 m)', w ? `${n(0.5 * 1025 * 1.2 * 0.5 * (w.oceanCurrentSpeedKt * 0.5144) ** 2, 0)} N/m` : '—', Gauge, 'model'),
          m('Sea temperature', w ? `${n(w.seaSurfaceTemperatureC)} °C` : '—', Thermometer, 'live'),
          m('Legs', '4', Anchor, 'design'),
          m('Cathodic protection', 'Sacrificial anodes', ShieldCheck, 'design'),
        ],
      };
    case 'main_deck':
    case 'upper_rig':
      return {
        title: type === 'main_deck' ? 'Main deck' : 'Topside & derrick',
        tag: type === 'main_deck' ? 'MAIN-DECK' : 'TOPSIDE',
        spec: type === 'main_deck' ? 'S355 structural steel (design)' : 'Production topside with drilling derrick (design)',
        depth: 'Topside',
        latex: '\\sigma = \\frac{M\\,y}{I}',
        metrics: [
          m('Export gas', `${n(gasMmscmd(exp), 2)} MMSCMD`, Droplets, 'live'),
          m('Export condensate', `${n(exp?.net_oil_bpd, 0)} bbl/d`, Droplets, 'live'),
          m('Wind', windNow, Wind, 'live'),
          m('Published block rate', `${n(pub.gasMmscmd, 1)} MMSCMD (${pub.basis})`, Flame, 'live'),
          m(type === 'main_deck' ? 'Deck area' : 'Derrick height', type === 'main_deck' ? '4,800 m²' : '65 m', Compass, 'design'),
          m('Variable deck load', '6,500 t', Anchor, 'design'),
        ],
      };
    case 'motor':
    default:
      return {
        title: 'Top drive motor',
        tag: 'TOP-DRIVE',
        spec: 'AC top drive with VFD (design)',
        depth: 'Drill floor',
        latex: 'P = T\\,\\omega' + ` = ${n((torque * rpm * 2 * Math.PI) / 60, 0)}\\text{ kW}`,
        metrics: [
          m('Rotary speed', `${n(rpm, 0)} RPM`, Disc, 'live'),
          m('Torque', `${n(torque)} kNm`, Zap, 'live'),
          m('Shaft power', `${n((torque * rpm * 2 * Math.PI) / 60, 0)} kW`, Activity, 'model'),
          m('Standpipe pressure', `${n(dr?.drill_spp_bar)} bar`, Gauge, 'live'),
          m('Rated power', '895 kW (1,200 hp)', Zap, 'design'),
          m('Supply', '4,160 V, 3-phase', Cpu, 'design'),
        ],
      };
  }
}
