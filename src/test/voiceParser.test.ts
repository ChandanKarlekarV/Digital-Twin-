import { parseVoiceCommand } from '../voice/VoiceCommandParser';

const cases: [string, string, number?][] = [
  ['varuna open crane 2', 'crane', 2],
  ['Varun a open crane to', 'crane', 2],
  ['open the crane', 'crane'],
  ['show me the heli pad please', 'helipad'],
  ['open pipe for', 'pipe', 4],
  ['pipeline number 7', 'pipe', 7],
  ['open industrial pipe fitting', 'industrial_pipes'],
  ['drill bit', 'drill_bit'],
  ['show drill string', 'drill_string'],
  ['open the drill', 'drill'],
  ['well three', 'well', 3],
  ['show all wells', 'wells_all'],
  ['split view', 'split_view'],
  ['varuna open jarvis view', 'split_view'],
  ['merge it', 'assemble'],
  ['close split', 'assemble'],
  ['open the slide deck', 'presentation'],
  ['what is the weather', 'weather'],
  ['switch to hologram mode', 'mode_hologram'],
  ['realistic mode', 'mode_realistic'],
  ['jack up legs', 'jackup_legs'],
  ['open accomodation', 'accommodation'],
  ['reset view', 'view_topside'],
  ['pipe3', 'pipe', 3],
  ['go to sleep', 'sleep'],
  ['open command dock', 'command_dock'],
];
let fail = 0;
for (const [text, id, num] of cases) {
  const r = parseVoiceCommand(text);
  const ok = r?.id === id && (num === undefined || r?.num === num);
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', JSON.stringify(text), '->', r?.id, r?.num, r?.complete);
}
console.log(fail ? `${fail} failures` : 'all passed');

