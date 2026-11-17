/**
 * VARUNA-AI rig Q&A. Answers only about the KG-D6 twin, from the newest live record of
 * the asset the question names (telemetryDb ring buffer), never from canned numbers.
 */
import { telemetryDb } from '../db/TelemetryDatabase';
import { useRigStore } from '../store/useRigStore';
import type { TelemetryRecord } from '../types/telemetry';
import type { ParsedVoiceCommand } from './VoiceCommandParser';
import { leakDetector } from '../services/LeakDetector';
import { liveFeeds } from '../services/LiveFeeds';

type Metric = 'tide' | 'quake' | 'fx' | 'leak' | 'pressure' | 'temperature' | 'flow' | 'gas' | 'density' | 'api' | 'water_cut' | 'frequency' | 'drill' | 'depth' | 'about' | 'status';

const METRICS: [Metric, RegExp][] = [
  ['tide', /\btide|sea level|high water|low water/],
  ['quake', /earthquake|quake|seismic|tremor/],
  ['fx', /exchange rate|\bdollars?\b|\brupees?\b|\busd\b|\binr\b/],
  ['leak', /\bleak|leaking|loss of containment|mass balance|missing (gas|flow)/],
  ['water_cut', /\bwater ?cut|water content|bs ?w\b/],
  ['pressure', /\bpressure|\bpsi\b|\bbar\b/],
  ['temperature', /\btemp|temperature|how hot\b/],
  ['gas', /\bgas\b|mmscfd/],
  ['density', /\bdensity|\bdense\b/],
  ['api', /\bapi\b|gravity/],
  ['frequency', /frequency|coriolis|oscillation/],
  ['drill', /\brpm\b|torque|weight on bit|\bwob\b|penetration|\brop\b|vibration|\bmud\b|drill (speed|status|rate|data)|how fast .*drill/],
  ['flow', /\bflow ?rate|production|producing|barrels|\bbpd\b|output|how much (oil|gas|condensate)|oil rate|condensate/],
  ['depth', /\bdepth|how deep/],
  ['about', /\b(what|tell me about|describe) (is )?(this|the) (rig|platform|field|twin)|kg ?d ?6|where is|who (operates|owns)|operator/],
  ['status', /\b(rig|platform|system|overall) (status|health|condition)|^status$|^health$|how is (the|everything)|is everything|any (alarm|alert|problem|issue)s?|status report|summary/],
];

/** Panel commands that mention metric-like words but must stay commands */
const COMMAND_FIRST = new Set(['water_status', 'weather', 'compliance', 'physics_report', 'database', 'help', 'sleep', 'close', 'repeat', 'start_camera', 'stop_camera']);

const QUESTION = /^(what|whats|what's|how|why|when|who|where|which|tell|give|is|are|can|do|does|explain)\b/;

const STATUS_TEXT = ['nominal', 'in warning', 'in critical shutdown', 'at hydrate risk', 'drill locked'];

/** Which metered asset the question is about; null = rig-wide default */
function assetFor(text: string, p: ParsedVoiceCommand | null): { id: string; name: string } | { pipeOnly: number } | null {
  if (/\bbravo\b/.test(text) || (p?.id === 'pipe' && p.num === 2)) return { id: 'RISER-BRAVO', name: 'riser Bravo' };
  if (/\balpha\b|\briser\b/.test(text) || (p?.id === 'pipe' && p.num === 1)) return { id: 'RISER-ALPHA', name: 'riser Alpha' };
  if (p?.id === 'pipe' && p.num) return { pipeOnly: p.num };
  if (p?.id === 'well' && p.num) return p.num <= 2 ? { id: `XT-WELLHEAD-0${p.num}`, name: `well ${p.num}` } : { pipeOnly: -p.num };
  if (/manifold|seabed|subsea/.test(text)) return { id: 'MANIFOLD-D6-MAIN', name: 'the subsea manifold' };
  if (/export|topside|meter|separator/.test(text)) return { id: 'TOPSIDE-MPFM-01', name: 'the topside export meter' };
  if (/drill/.test(text) || p?.id === 'drill' || p?.id === 'drill_bit' || p?.id === 'drill_string') return { id: 'TOPSIDE-DRILL-RIG', name: 'the drill system' };
  return null;
}

const f = (n: number | undefined, d = 0) => (n === undefined || !Number.isFinite(n) ? 'unavailable' : n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));

function reading(m: Metric, r: TelemetryRecord, name: string): string {
  switch (m) {
    case 'pressure': return `Pressure at ${name} is ${f(r.p_line_bar, 1)} bar.`;
    case 'temperature': return `Temperature at ${name} is ${f(r.t_line_c, 1)} °C.`;
    case 'flow': return `${name[0].toUpperCase() + name.slice(1)} is flowing ${f((r.associated_gas_mmscfd ?? 0) / 35.3147, 1)} million standard cubic metres a day of gas and ${f(r.net_oil_bpd)} barrels a day of condensate.`;
    case 'gas': return `Associated gas at ${name} is ${f(r.associated_gas_mmscfd, 1)} million standard cubic feet a day.`;
    case 'density': return `Density at ${name} is ${f(r.raw_density, 1)} kilograms per cubic metre at line conditions, ${f(r.corrected_density, 1)} corrected to 15 °C.`;
    case 'api': return `API gravity at ${name} is ${f(r.api_gravity, 1)} degrees.`;
    case 'water_cut': return `Water cut at ${name} is ${f(r.water_cut_pct, 1)}%.`;
    case 'frequency': return `The Coriolis tube at ${name} is oscillating at ${f(r.f_osc_hz, 1)} hertz.`;
    case 'drill': return `The drill is turning at ${f(r.drill_rpm)} RPM with ${f(r.drill_torque_knm, 1)} kNm torque, ${f(r.drill_wob_kn)} kilonewtons on bit, penetrating ${f(r.drill_rop_mhr, 1)} metres an hour.`;
    default: return '';
  }
}

function rigStatus(): string {
  const exp = telemetryDb.getLatest('TOPSIDE-MPFM-01');
  const man = telemetryDb.getLatest('MANIFOLD-D6-MAIN');
  const drill = telemetryDb.getLatest('TOPSIDE-DRILL-RIG');
  if (!exp && !man) return 'Live telemetry is still starting up. Ask me again in a second.';
  const { emergencyScenario } = useRigStore.getState();
  const worst = Math.max(exp?.status_flag ?? 0, man?.status_flag ?? 0, drill?.status_flag ?? 0);
  const parts = [
    emergencyScenario && emergencyScenario !== 'none' ? `Active incident: ${emergencyScenario.replace(/_/g, ' ')}.` : `All systems ${STATUS_TEXT[worst] ?? 'nominal'}.`,
    exp && `Export is ${f((exp.associated_gas_mmscfd ?? 0) / 35.3147, 1)} million standard cubic metres a day of gas and ${f(exp.net_oil_bpd)} barrels a day of condensate, water cut ${f(exp.water_cut_pct, 1)}%.`,
    man && `Manifold at ${f(man.p_line_bar, 1)} bar and ${f(man.t_line_c, 1)} °C.`,
    drill?.drill_rpm !== undefined && `Drill at ${f(drill.drill_rpm)} RPM.`,
  ];
  return parts.filter(Boolean).join(' ');
}

function liveAnswer(m: 'tide' | 'quake' | 'fx'): string {
  const f = liveFeeds.getStatus();
  if (m === 'tide') {
    if (f.tide.heightM === null) return 'The live tide feed has not loaded yet.';
    return `The sea level at the block is ${f.tide.heightM.toFixed(2)} metres above mean sea level and ${f.tide.trend}. Today it ranges from ${f.tide.todayMin?.toFixed(2)} to ${f.tide.todayMax?.toFixed(2)} metres.`;
  }
  if (m === 'quake') {
    if (f.quakes.state !== 'live') return 'The USGS earthquake feed has not loaded yet.';
    if (!f.quakes.count) return 'No earthquakes of magnitude 2.5 or more within 1,000 kilometres of KG-D6 in the last 30 days, according to USGS.';
    const q = f.quakes.largest!;
    return `${f.quakes.count} earthquakes within 1,000 kilometres in the last 30 days. The largest was magnitude ${q.magnitude.toFixed(1)}, ${Math.round(q.distanceKm)} kilometres away, ${q.place}.`;
  }
  if (f.fx.usdInr === null) return 'The exchange rate feed has not loaded yet.';
  return `One US dollar is ${f.fx.usdInr.toFixed(2)} rupees, the European Central Bank reference rate for ${f.fx.date}.`;
}

function leakAnswer(): string {
  const s = leakDetector.getStatus();
  if (s.state === 'alarm') return `Leak alarm. The mass balance is short by ${s.imbalancePct.toFixed(1)} percent, about ${s.lossMmscmd.toFixed(2)} million standard cubic metres a day. Suspected location: ${s.location}.`;
  if (s.state === 'watch') return `Watching a possible leak: ${s.imbalancePct.toFixed(1)} percent of the flow is unaccounted for. Suspected location: ${s.location}.`;
  return `No leak. The manifold and topside meters balance within ${s.imbalancePct.toFixed(2)} percent, inside the meters' uncertainty.`;
}

const ABOUT =
  'This is the digital twin of the KG-D6 block in the Krishna-Godavari basin, Bay of Bengal, off the Andhra Pradesh coast. ' +
  'It is operated by Reliance Industries with bp as partner. It is mainly a gas field: in the July to September 2026 quarter it averaged 24.0 million standard cubic metres of gas a day and about 15,900 barrels a day of oil and condensate. ' +
  'The twin runs that published rate through its pipeline physics at 200 steps a second.';

/**
 * Returns a spoken answer when the utterance is a question about the rig, the off-topic
 * reply when it is some other question, or null when it should run as a command.
 */
export function answerRigQuestion(raw: string, parsed: ParsedVoiceCommand | null): string | null {
  const text = raw.toLowerCase().replace(/[^\w\s'.-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (parsed && COMMAND_FIRST.has(parsed.id)) return null;

  const metric = METRICS.find(([, re]) => re.test(text))?.[0];
  if (!metric) return !parsed && QUESTION.test(text) ? 'I can only answer questions about the KG-D6 rig.' : null;
  if (metric === 'leak') return leakAnswer();
  if (metric === 'tide' || metric === 'quake' || metric === 'fx') return liveAnswer(metric);
  if (metric === 'status') return rigStatus();
  if (metric === 'about') return ABOUT;
  if (metric === 'depth') return 'The twin models 2,040 metres from sea level to the reservoir, the depth of the drill string and wells.';

  const asset = assetFor(text, parsed) ?? (metric === 'drill' ? { id: 'TOPSIDE-DRILL-RIG', name: 'the drill system' } : metric === 'flow' || metric === 'gas' ? { id: 'TOPSIDE-MPFM-01', name: 'the topside export meter' } : { id: 'MANIFOLD-D6-MAIN', name: 'the subsea manifold' });
  if ('pipeOnly' in asset) {
    const man = telemetryDb.getLatest('MANIFOLD-D6-MAIN');
    const what = asset.pipeOnly > 0 ? `Pipe ${asset.pipeOnly}` : `Well ${-asset.pipeOnly}`;
    return `${what} has no meter of its own; it commingles at the manifold. ${man ? reading(metric, man, 'the manifold') : ''}`.trim();
  }
  const r = telemetryDb.getLatest(asset.id);
  return r ? reading(metric, r, asset.name) : `There is no live reading for ${asset.name} yet.`;
}
