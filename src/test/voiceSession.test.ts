/**
 * Long voice session against a simulated browser recogniser: wake, several commands, the
 * window closing, waking again, a recogniser that silently dies, one that never starts.
 * Run: npx tsx src/test/voiceSession.test.ts
 */
let fail = 0;
const check = (ok: boolean, label: string, got: unknown) => {
  if (!ok) fail++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(56), '->', got);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Minimal stand-in for Chrome's webkitSpeechRecognition */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static failNextStart = false;
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;
  ended = false;
  private results: unknown[] = [];
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    if (this.running) throw new Error('InvalidStateError');
    if (FakeRecognition.failNextStart) {
      FakeRecognition.failNextStart = false; // start() accepted but nothing ever happens
      return;
    }
    this.running = true;
    setTimeout(() => this.onstart?.(), 5);
  }
  abort() {
    this.stopNow();
  }
  stop() {
    this.stopNow();
  }
  private stopNow() {
    if (this.ended) return;
    this.running = false;
    this.ended = true;
    setTimeout(() => this.onend?.(), 5);
  }
  /** The user says something: one interim then one final result */
  say(text: string) {
    if (!this.running) return false;
    const idx = this.results.length;
    const mk = (isFinal: boolean) => {
      const r: any = [{ transcript: text }];
      r.isFinal = isFinal;
      return r;
    };
    this.results.push(mk(false));
    this.onresult?.({ resultIndex: idx, results: this.results });
    this.results[idx] = mk(true);
    this.onresult?.({ resultIndex: idx, results: this.results });
    return true;
  }
  /** Chrome ends a continuous session on its own (silence timeout) */
  endByBrowser() {
    this.stopNow();
  }
}

/**
 * Speech output that takes real time (60 ms a word) and is picked up by the microphone,
 * as on a laptop with speakers: the recogniser hears VARUNA's own words as an echo.
 */
const MS_PER_WORD = 60;
class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
const fakeSynth = {
  speaking: false,
  pending: false,
  queue: [] as FakeUtterance[],
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
  getVoices: () => [],
  addEventListener() {},
  resume() {},
  cancel() {
    clearTimeout(this.timer);
    const q = this.queue;
    this.queue = [];
    this.speaking = false;
    q.forEach((u) => u.onerror?.({ error: 'interrupted' }));
  },
  speak(u: FakeUtterance) {
    this.queue.push(u);
    if (!this.speaking) this.next();
  },
  next() {
    const u = this.queue[0];
    if (!u) {
      this.speaking = false;
      return;
    }
    this.speaking = true;
    const words = u.text.split(/\s+/).filter(Boolean).length;
    if (u.text.trim()) setTimeout(() => echo(u.text), 20); // the mic hears it
    this.timer = setTimeout(() => {
      this.queue.shift();
      u.onend?.();
      this.next();
    }, words * MS_PER_WORD);
  },
};
let echo: (text: string) => void = () => {};
(globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
(globalThis as any).window = {
  webkitSpeechRecognition: FakeRecognition,
  speechSynthesis: fakeSynth,
  addEventListener() {},
  removeEventListener() {},
};
// Node 21+ already has a read-only `navigator` with a language

(async () => {
  const { varunaVoiceCommander } = await import('../voice/VarunaVoiceCommander');
  const { useRigStore } = await import('../store/useRigStore');
  const live = () => FakeRecognition.instances.filter((r) => r.running).pop();
  const say = async (text: string) => {
    const r = live();
    const ok = !!r && r.say(text);
    await sleep(120); // answers are spoken asynchronously
    return ok;
  };
  const reply = () => useRigStore.getState().voiceStatus.lastMessage;
  const awake = () => useRigStore.getState().isVarunaAwake && Date.now() < useRigStore.getState().varunaWakeExpiry;
  const closeWindow = () => useRigStore.setState({ isVarunaAwake: false, varunaWakeExpiry: 0 });
  const settle = () => sleep(900); // reply finished + echo tail + session recycle
  echo = (text) => live()?.say(text.toLowerCase().replace(/[.,!?]/g, ''));
  const zooms = () => useRigStore.getState().cameraNudge.seq;

  varunaVoiceCommander.start();
  await sleep(30);
  check(useRigStore.getState().micState === 'listening', 'mic listening after start', useRigStore.getState().micState);

  // Round 1: wake, two commands (what worked for you before)
  await say('Varuna');
  check(awake(), 'round 1: "Varuna" wakes', awake());
  await say('open crane two');
  check(useRigStore.getState().activeHoloModal === 'crane2', 'round 1: command 1 (open crane two)', useRigStore.getState().activeHoloModal);
  await settle();
  check(!!live(), 'a session is live after the reply', !!live());
  await say('zoom in');
  check(reply() === 'Zooming in.', 'round 1: command 2 (zoom in)', reply());
  await settle();

  // The window closes, then "Varuna" again (what failed for you)
  closeWindow();
  await say('what is the weather');
  check(reply() === 'Zooming in.', 'asleep: ignores speech without the wake word', reply());
  await say('Varuna');
  check(awake(), 'round 2: "Varuna" wakes again', awake());
  await say('is there a leak');
  check(/leak|balance/i.test(reply()), 'round 2: question answered', reply());
  await settle();
  await say('close');
  check(useRigStore.getState().activeHoloModal === null, 'round 2: close command', useRigStore.getState().activeHoloModal);
  await settle();

  // Round 3, 4, 5: many wake cycles in a row
  let cycles = 0;
  for (let i = 0; i < 3; i++) {
    closeWindow();
    await say('Varuna zoom out');
    if (reply() === 'Zooming out.') cycles++;
    useRigStore.getState().setVoiceStatus({ isSpeaking: false, lastMessage: 'x' });
    await settle();
  }
  check(cycles === 3, 'three more wake + command cycles', `${cycles}/3`);

  // Chrome ends the session on its own: it must come back
  live()?.endByBrowser();
  await sleep(400);
  closeWindow();
  await say('Varuna zoom in');
  check(reply() === 'Zooming in.', 'session ended by browser: auto-restarts', reply());
  await settle();

  // A restart that silently never starts: health check rebuilds it
  FakeRecognition.failNextStart = true;
  live()?.endByBrowser();
  await sleep(6500);
  closeWindow();
  const heard = await say('Varuna zoom out');
  check(heard && reply() === 'Zooming out.', 'dead restart rebuilt by health check', reply());

  // Wake button always gives a working session
  closeWindow();
  varunaVoiceCommander.wake();
  await sleep(50);
  await say('zoom in');
  check(reply() === 'Zooming in.', 'Wake button then command', reply());
  await settle();

  // ---- Back to back: commands given one after another without saying "Varuna" again ----
  // (a) right after the reply ends
  closeWindow();
  await say('Varuna open crane one');
  await sleep(500); // reply plays and ends
  const z0 = zooms();
  await say('zoom in');
  await sleep(150);
  await say('zoom out');
  await sleep(150);
  await say('open crane two');
  check(zooms() - z0 === 2, 'back to back: zoom in, zoom out after a reply', zooms() - z0);
  check(useRigStore.getState().activeHoloModal === 'crane2', 'back to back: third command (open crane two)', useRigStore.getState().activeHoloModal);

  // (b) while VARUNA is still speaking its reply (user does not wait)
  await settle();
  const z1 = zooms();
  await say('open helipad'); // reply ~5 words = 300 ms of speech
  await sleep(80);
  check(useRigStore.getState().voiceStatus.isSpeaking, '...VARUNA is speaking the reply', useRigStore.getState().voiceStatus.isSpeaking);
  await say('zoom in'); // spoken over VARUNA's voice
  check(zooms() - z1 === 1, 'command spoken during the reply is taken', zooms() - z1);

  // (c) VARUNA's own words must never run as commands ("Zooming in." echo must not zoom again)
  await settle();
  const z2 = zooms();
  await say('zoom in');
  await sleep(1200);
  check(zooms() - z2 === 1, 'echo of "Zooming in." does not zoom again', zooms() - z2);

  // (d) a long chain: six commands in a row, awake the whole time
  await settle();
  const chain = ['zoom in', 'zoom out', 'open crane one', 'close', 'zoom in', 'zoom out'];
  const z3 = zooms();
  let ok = 0;
  for (const cmd of chain) {
    const before = zooms();
    await say(cmd);
    await sleep(250);
    const st = useRigStore.getState();
    if (cmd.startsWith('zoom') ? zooms() === before + 1 : cmd === 'close' ? st.activeHoloModal === null : st.activeHoloModal === 'crane1') ok++;
  }
  check(ok === chain.length, 'six commands back to back', `${ok}/${chain.length}, zooms ${zooms() - z3}`);

  varunaVoiceCommander.stop();
  console.log(fail ? `${fail} failures` : 'all passed');
  process.exit(fail ? 1 : 0);
})();
