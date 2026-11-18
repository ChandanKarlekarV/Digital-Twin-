/** Run: npx tsx src/test/voiceParser.test.ts */
import { parseVoiceCommand, hasWakeWord, stripWakeWord, isUnambiguous } from '../voice/VoiceCommandParser';

let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label, '->', got);
};

// Intents
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
  ['varuna open exploded view', 'split_view'],
  ['merge it', 'assemble'],
  ['close split', 'assemble'],
  ['open the slide deck', 'presentation'],
  ['what is the weather', 'weather'],
  ['jack up legs', 'jackup_legs'],
  ['open accomodation', 'accommodation'],
  ['reset view', 'view_topside'],
  ['zoom in', 'zoom_in'],
  ['zoom out', 'zoom_out'],
  ['varuna move closer', 'zoom_in'],
  ['close', 'close'],
  ['close window', 'close'],
  ['pipe3', 'pipe', 3],
  ['go to sleep', 'sleep'],
  ['open command dock', 'command_dock'],
];
for (const [text, id, num] of cases) {
  const r = parseVoiceCommand(text);
  check(r?.id === id && (num === undefined || r?.num === num), JSON.stringify(text), `${r?.id} ${r?.num ?? ''}`);
}

// Wake word: the ways recognisers spell "Varuna"
for (const t of ['Varuna', 'hey varuna', 'Varun a open crane', 'Baruna show helipad', 'veruna', 'waruna open drill', 'var una open drill',
  'Varuna AI status', 'Verna open pipe 3', 'Bharuna', 'ok Varun', 'VARUNA, what is the pressure?', 'Verona'])
  check(hasWakeWord(t), `wake  ${JSON.stringify(t)}`, true);
for (const t of ['open the crane', 'banana', 'run a test', 'variable flow', 'turn on camera', 'marine riser', 'warning', 'very nice', 'around'])
  check(!hasWakeWord(t), `sleep ${JSON.stringify(t)}`, false);
check(stripWakeWord('Varun a open crane two') === 'open crane two', 'strip "Varun a"', stripWakeWord('Varun a open crane two'));
check(stripWakeWord('varuna ai rig status') === 'rig status', 'strip "varuna ai"', stripWakeWord('varuna ai rig status'));

// Instant (first-interim) execution only when the command cannot still grow
const instant: [string, boolean][] = [['split view', true], ['helipad', true], ['crane 2', true], ['drill', false], ['close', false], ['open crane', false]];
for (const [t, want] of instant) {
  const p = parseVoiceCommand(t);
  check(!!p && isUnambiguous(p) === want, `instant ${JSON.stringify(t)}`, p && isUnambiguous(p));
}

console.log(fail ? `${fail} failures` : 'all passed');
if (fail) process.exit(1);
