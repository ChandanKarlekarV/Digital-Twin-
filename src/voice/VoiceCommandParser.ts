/**
 * VARUNA-AI voice command parser.
 *
 * Browser speech recognition produces messy transcripts ("crane to", "pipe for",
 * "heli pad", "varun a open the drill bit please"). Instead of raw substring
 * checks, transcripts are normalised, then scored against an intent table:
 * every token of a phrase must appear in order (tokens of 5+ letters may be one
 * edit away), and the longest/most specific phrase wins. Numbered targets
 * (pipe 1-9, well 1-7, crane 1-2) are only complete once a number is heard.
 */

export type VoiceIntentId =
  | 'split_view'
  | 'assemble'
  | 'helipad'
  | 'crane'
  | 'accommodation'
  | 'industrial_pipes'
  | 'jackup_legs'
  | 'drill_string'
  | 'drill_bit'
  | 'drill'
  | 'motor'
  | 'main_deck'
  | 'upper_rig'
  | 'pipe'
  | 'well'
  | 'wells_all'
  | 'slice'
  | 'command_dock'
  | 'presentation'
  | 'database'
  | 'compliance'
  | 'weather'
  | 'water_status'
  | 'physics_report'
  | 'view_topside'
  | 'zoom_in'
  | 'zoom_out'
  | 'view_subsea'
  | 'view_manifold'
  | 'start_camera'
  | 'stop_camera'
  | 'close'
  | 'repeat'
  | 'help'
  | 'sleep';

export interface ParsedVoiceCommand {
  id: VoiceIntentId;
  /** Number for pipe/well/crane intents, when heard */
  num?: number;
  /** false when a required number is still missing (e.g. "open crane") */
  complete: boolean;
  /** 0..1: how much of the utterance the matched phrase explains */
  score: number;
  phrase: string;
}

interface IntentDef {
  id: VoiceIntentId;
  phrases: string[];
  numbered?: { max: number };
}

// Order matters only for ties: more specific intents first.
const INTENTS: IntentDef[] = [
  { id: 'drill_string', phrases: ['drill string', 'drilling string', 'subsea drill string'] },
  { id: 'drill_bit', phrases: ['drill bit', 'cutter bit', 'pdc bit', 'bit'] },
  { id: 'split_view', phrases: ['split view', 'exploded view', 'explode', 'split', 'disassemble', 'take apart'] },
  { id: 'assemble', phrases: ['assemble', 'reassemble', 'merge', 'close split', 'put back together', 'join'] },
  { id: 'helipad', phrases: ['helipad', 'heli deck', 'helideck', 'helicopter', 'landing pad'] },
  { id: 'crane', phrases: ['crane', 'port crane', 'starboard crane', 'lattice boom', 'pedestal crane'], numbered: { max: 2 } },
  { id: 'accommodation', phrases: ['accommodation', 'living quarters', 'quarters', 'living module'] },
  { id: 'industrial_pipes', phrases: ['industrial pipe', 'pipe fitting', 'process piping', 'industrial piping', 'valve manifold'] },
  { id: 'jackup_legs', phrases: ['jackup legs', 'jackup', 'legs', 'stability columns', 'columns', 'foundation'] },
  { id: 'motor', phrases: ['motor', 'top drive', 'mud pump', 'induction motor'] },
  { id: 'drill', phrases: ['drill', 'drilling', 'derrick', 'rotary'] },
  { id: 'main_deck', phrases: ['main deck', 'deck structure', 'platform deck', 'deck'] },
  { id: 'upper_rig', phrases: ['upper rig', 'top side', 'topside rig', 'superstructure'] },
  { id: 'wells_all', phrases: ['all wells', 'wells', 'well cluster', 'wellhead cluster', 'christmas trees'] },
  { id: 'well', phrases: ['well', 'wellhead', 'christmas tree'], numbered: { max: 7 } },
  { id: 'pipe', phrases: ['pipe', 'flow line', 'flowline', 'riser', 'line'], numbered: { max: 9 } },
  { id: 'slice', phrases: ['slice', 'cross section', 'cut pipe', 'slice pipe', 'slice it'] },
  { id: 'command_dock', phrases: ['command dock', 'tools dock', 'dock', 'command center'] },
  { id: 'presentation', phrases: ['presentation', 'ppt', 'slides', 'slide deck'] },
  { id: 'database', phrases: ['database', 'data base', 'ledger', 'six month', 'production ledger', 'history'] },
  { id: 'compliance', phrases: ['compliance', 'audit report', 'compliance report', 'audit'] },
  { id: 'weather', phrases: ['weather', 'forecast', 'metocean', 'wind'] },
  { id: 'water_status', phrases: ['water status', 'ocean status', 'water current', 'sea state', 'current status'] },
  { id: 'physics_report', phrases: ['latex', 'physics report', 'math report', 'equations', 'derivation'] },
  { id: 'view_subsea', phrases: ['dive', 'subsea view', 'underwater', 'go under water', 'below water'] },
  { id: 'view_manifold', phrases: ['manifold', 'seabed', 'sea bed', 'sea floor', 'seafloor'] },
  { id: 'view_topside', phrases: ['reset view', 'home view', 'default view', 'overview', 'full view', 'show whole rig'] },
  { id: 'zoom_in', phrases: ['zoom in', 'zoom closer', 'get closer', 'move closer', 'come closer', 'magnify', 'enlarge', 'bigger'] },
  { id: 'zoom_out', phrases: ['zoom out', 'zoom back', 'move back', 'further', 'farther', 'pull back', 'smaller'] },
  { id: 'start_camera', phrases: ['start camera', 'start webcam', 'enable gestures', 'gesture mode', 'turn on camera'] },
  { id: 'stop_camera', phrases: ['stop camera', 'stop webcam', 'disable gestures', 'turn off camera'] },
  { id: 'close', phrases: ['close', 'close window', 'close panel', 'dismiss', 'cancel', 'go back', 'exit'] },
  { id: 'repeat', phrases: ['repeat', 'say again', 'what did you say', 'pardon'] },
  { id: 'help', phrases: ['help', 'what can you do', 'list commands', 'commands'] },
  { id: 'sleep', phrases: ['go to sleep', 'stop listening', 'sleep', 'thank you', 'thanks', 'that is all'] },
];

const NUMBER_WORDS: Record<string, number> = {
  one: 1, won: 1, first: 1,
  two: 2, second: 2,
  three: 3, tree: 3, free: 3, third: 3,
  four: 4, fourth: 4,
  five: 5, fifth: 5,
  six: 6, sixth: 6, sex: 6,
  seven: 7, seventh: 7,
  eight: 8, ate: 8, eighth: 8,
  nine: 9, nein: 9, ninth: 9,
};
// Homophones that are only numbers when they follow a numbered target ("crane to", "pipe for")
const CONTEXT_NUMBER_WORDS: Record<string, number> = { to: 2, too: 2, for: 4, fore: 4 };
const NUMBERED_TARGETS = new Set(['crane', 'pipe', 'well', 'line', 'riser', 'flowline', 'wellhead', 'tree']);

// Frequent recogniser mistakes for domain words
const REPLACEMENTS: [RegExp, string][] = [
  [/\b(heli|helly|hell|healy|deli)\s*(pad|pads|path|bad)\b/g, 'helipad'],
  [/\bheli\s*deck\b/g, 'helideck'],
  [/\b(crain|crayon|crane's|cranes|grain|train)\b/g, 'crane'],
  [/\b(pipeline|pipelines|pipes|pype|type)\b/g, 'pipe'],
  [/\bjack[\s-]*up\b/g, 'jackup'],
  [/\b(drill|drills|dril|drew)\s+(bits?|bed|bid)\b/g, 'drill bit'],
  [/\bp\s*p\s*t\b/g, 'ppt'],
  [/\bwells?\s+(head)\b/g, 'wellhead'],
  [/\bx\s*mas\b/g, 'christmas'],
  [/\b(no\.?|number)\s+/g, ''],
  [/#/g, ' '],
];

const FILLER = new Set([
  'please', 'can', 'could', 'would', 'you', 'hey', 'hello', 'hi', 'ok', 'okay', 'the', 'a', 'an', 'me',
  'show', 'open', 'opening', 'display', 'go', 'goto', 'take', 'switch', 'turn', 'on', 'view', 'of',
  'and', 'then', 'now', 'just', 'let', 'lets', 'see', 'look', 'at', 'into', 'mode', 'varuna', 'i', 'want',
]);

/*
 * Wake word "Varuna". Recognisers spell it many ways (Varun, Baruna, Veruna, Verna,
 * "var una", "Varun a", "Bharuna"...), so words are compared by sound, not spelling:
 * b/bh/w/ph -> v, h dropped, every vowel run -> "a". "Varuna" becomes "varana" and any
 * word (or two short words joined) within one edit of that wakes it.
 */
function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const wakeKey = (w: string) =>
  w.toLowerCase().replace(/[^a-z]/g, '').replace(/bh|ph|b|w/g, 'v').replace(/h/g, '').replace(/[aeiouy]+/g, 'a').replace(/(.)\1+/g, '$1');
// Must open with the v/f sound (or "ar", from a clipped "aruna") so rig words like "marine" never wake it
const isWakeKey = (k: string) =>
  k.length >= 4 && /^(v|f|ar)/.test(k) && k.includes('r') && k.includes('n') && levenshtein(k, 'varana') <= 1;

/** [start, end) word spans that are the wake word, including a trailing "AI". */
function wakeSpans(words: string[]): [number, number][] {
  const spans: [number, number][] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = words[i + 1] && words[i].length <= 5 && words[i + 1].length <= 4 ? words[i] + words[i + 1] : '';
    let end = pair && isWakeKey(wakeKey(pair)) ? i + 2 : isWakeKey(wakeKey(words[i])) ? i + 1 : 0;
    if (!end) continue;
    if (/^a\.?i\.?$/i.test(words[end] ?? '')) end++;
    spans.push([i, end]);
    i = end - 1;
  }
  return spans;
}

const splitWords = (text: string) => text.replace(/[^\w\s'-]/g, ' ').split(/\s+/).filter(Boolean);

export function hasWakeWord(text: string): boolean {
  return wakeSpans(splitWords(text)).length > 0;
}

export function stripWakeWord(text: string): string {
  const words = splitWords(text);
  const drop = new Set<number>();
  for (const [s, e] of wakeSpans(words)) for (let i = s; i < e; i++) drop.add(i);
  return words.filter((_, i) => !drop.has(i)).join(' ');
}

export function normalizeTranscript(raw: string): string[] {
  let text = ` ${raw.toLowerCase()} `
    .replace(/[^\w\s#'-]/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  for (const [re, rep] of REPLACEMENTS) text = text.replace(re, rep);

  const tokens = text.split(/[\s-]+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = out[out.length - 1];
    if (NUMBER_WORDS[t] !== undefined) {
      out.push(String(NUMBER_WORDS[t]));
    } else if (prev && NUMBERED_TARGETS.has(prev) && CONTEXT_NUMBER_WORDS[t] !== undefined) {
      out.push(String(CONTEXT_NUMBER_WORDS[t]));
    } else {
      // "pipe3" / "well7" glued by the recogniser
      const glued = /^([a-z]+)(\d)$/.exec(t);
      if (glued && NUMBERED_TARGETS.has(glued[1])) out.push(glued[1], glued[2]);
      else out.push(t);
    }
  }
  return out;
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function tokenMatches(spoken: string, expected: string): boolean {
  if (spoken === expected) return true;
  // Simple plural / fuzzy tolerance on longer words only (short words collide too easily)
  if (spoken === expected + 's' || expected === spoken + 's') return true;
  return expected.length >= 5 && editDistanceAtMostOne(spoken, expected);
}

/** Index after the last matched token, or -1 if the phrase is not contained in order. */
function matchPhrase(tokens: string[], phrase: string[]): { start: number; end: number } | null {
  for (let s = 0; s < tokens.length; s++) {
    if (!tokenMatches(tokens[s], phrase[0])) continue;
    let k = 1;
    let t = s + 1;
    // allow at most one filler word between phrase tokens ("pipe the fitting" is not allowed, "drill the bit" is)
    let gaps = 0;
    while (k < phrase.length && t < tokens.length) {
      if (tokenMatches(tokens[t], phrase[k])) {
        k++;
        t++;
      } else if (gaps === 0 && FILLER.has(tokens[t])) {
        gaps++;
        t++;
      } else break;
    }
    if (k === phrase.length) return { start: s, end: t };
  }
  return null;
}

export function parseVoiceCommand(raw: string): ParsedVoiceCommand | null {
  const tokens = normalizeTranscript(stripWakeWord(raw));
  if (tokens.length === 0) return null;
  // Phrases may themselves contain filler words ("exploded view"), so only use this for scoring
  const meaningfulCount = Math.max(1, tokens.filter((t) => !FILLER.has(t)).length);

  let best: ParsedVoiceCommand | null = null;
  let bestRank = -1;

  INTENTS.forEach((intent, order) => {
    for (const phrase of intent.phrases) {
      const words = phrase.split(' ');
      const m = matchPhrase(tokens, words);
      if (!m) continue;

      let num: number | undefined;
      let complete = true;
      if (intent.numbered) {
        // number right after the target, or anywhere in the utterance as a fallback
        const after = tokens.slice(m.end, m.end + 2).find((t) => /^\d+$/.test(t));
        const before = tokens.slice(Math.max(0, m.start - 1), m.start).find((t) => /^\d+$/.test(t));
        const n = Number(after ?? before);
        if (n >= 1 && n <= intent.numbered.max) num = n;
        else if (intent.id === 'crane' && /\bport\b/.test(phrase)) num = 1;
        else if (intent.id === 'crane' && /\b(starboard|pedestal)\b/.test(phrase)) num = 2;
        else if (intent.id === 'crane' && /\blattice\b/.test(phrase)) num = 1;
        complete = num !== undefined;
      }

      const covered = words.length + (num !== undefined ? 1 : 0);
      const score = Math.min(1, covered / meaningfulCount);
      // Rank: longer phrases beat shorter ones; completed numbered intents beat incomplete; then table order
      const rank = words.length * 100 + (complete ? 50 : 0) + (num !== undefined ? 25 : 0) - order * 0.01;
      if (rank > bestRank) {
        bestRank = rank;
        best = { id: intent.id, num, complete, score, phrase };
      }
    }
  });

  return best;
}

/** Phrases that are the start of another intent's longer phrase ("drill" -> "drill bit", "close" -> "close split"). */
const PREFIX_PHRASES = new Set(
  INTENTS.flatMap((a) =>
    a.phrases.filter((p) => INTENTS.some((b) => b.id !== a.id && b.phrases.some((q) => q.startsWith(p + ' '))))
  )
);

/**
 * Safe to run on the first interim result: complete, explains the whole utterance, and
 * cannot be the beginning of a longer, different command.
 */
export function isUnambiguous(p: ParsedVoiceCommand): boolean {
  return p.complete && p.score >= 1 && !PREFIX_PHRASES.has(p.phrase);
}

export const VOICE_HELP_TEXT =
  'You can say: split view, assemble, helipad, crane one or two, accommodation, drill bit, drill string, ' +
  'pipe one to nine, well one to seven, slice pipe, weather, water status, zoom in, zoom out, or reset view. ' +
  'You can also ask me about the rig: pressure, temperature, flow, density, gas, water cut, drill speed, or rig status.';
