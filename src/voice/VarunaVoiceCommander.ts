/**
 * VARUNA-AI Voice Commander — Web Speech recogniser that keeps itself alive.
 *
 * Reliability:
 * 1. Every listening session uses a FRESH recogniser object. Chrome sometimes silently
 *    refuses to restart an old one, which left the mic dead after a few commands.
 * 2. Health check every 2 s: if the mic should be on but no session is running (or a start
 *    never reported back), a new recogniser is built.
 * 3. After every reply VARUNA speaks, the session is recycled: on some machines Chrome's
 *    recogniser stays "on" but stops delivering words once audio has played.
 * 4. Echo guard follows VARUNA's real speech, bounded in time, so a stalled voice engine can
 *    never make it deaf. Saying "Varuna" while it talks interrupts it (barge-in).
 * 5. The microphone starts from a click (Wake, or the first click on the page), as browsers
 *    require, and every failure is shown in the HUD in plain words.
 *
 * Accuracy:
 * - Up to 5 recognition alternatives are scored by the intent parser.
 * - A complete, unambiguous command runs on the first interim result; anything else waits
 *   for two matching interims or the final result, and never runs twice.
 */

import { useRigStore } from '../store/useRigStore';
import { parseVoiceCommand, ParsedVoiceCommand, hasWakeWord, stripWakeWord, isUnambiguous } from './VoiceCommandParser';
import { varunaVoice } from './VarunaVoiceSynthesizer';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const ECHO_TAIL_MS = 600;
/** The same command twice within this time is one utterance delivered twice, not a repeat */
const DEBOUNCE_MS = 1200;
/** Keep the window open this long after the last word heard while awake */
const TALKING_GRACE_MS = 6000;
/** Give up auto-restarting after this many network errors in a row */
const MAX_NETWORK_ERRORS = 4;
const HEALTH_CHECK_MS = 2000;
/** A start() that has not reported back within this time is treated as dead */
const START_TIMEOUT_MS = 4000;

const signature = (p: ParsedVoiceCommand) => `${p.id}:${p.num ?? ''}`;

const MIC_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone blocked. Click the lock icon in the address bar, allow the microphone, then press Wake.',
  'service-not-allowed': 'Microphone blocked by the browser. Allow it in the address bar, then press Wake.',
  'audio-capture': 'No microphone found. Plug one in or check Windows sound settings, then press Wake.',
  network: 'Speech service unreachable. Voice needs Chrome or Edge with an internet connection.',
};

class VarunaVoiceCommander {
  private recognizer: any = null;
  /** The user wants the mic on (cleared only by stop() or a permission failure) */
  private wanted = false;
  private sessionLive = false;
  private startedAt = 0;
  private restartTimeout: ReturnType<typeof setTimeout> | undefined;
  private health: ReturnType<typeof setInterval> | undefined;
  private restartDelay = 150;
  private networkErrors = 0;
  /** A session open is scheduled (restart back-off or recycle) */
  private openScheduled = false;
  /** Set while we cut VARUNA off ourselves, so that stop does not recycle the session */
  private interrupting = false;

  private lastSpokeAt = 0;
  private lastSignature = '';
  private lastSignatureTime = 0;
  private interimCandidate = '';
  /** resultIndex of the utterance already handled by the interim fast-path */
  private handledResultIndex = -1;
  /** resultIndex whose bare wake word already woke VARUNA */
  private wokeResultIndex = -1;

  constructor() {
    useRigStore.subscribe((state, prev) => {
      if (prev.voiceStatus.isSpeaking && !state.voiceStatus.isSpeaking) {
        this.lastSpokeAt = Date.now();
        // Fresh session after a reply that finished by itself (see header, point 3). Not
        // after an interruption: the user is talking into the current session right now.
        if (this.interrupting) this.interrupting = false;
        else if (this.wanted && this.sessionLive) this.recycle(ECHO_TAIL_MS);
      }
    });
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** Turns listening on. Safe to call repeatedly; call it from a click to satisfy browser rules. */
  public start(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.isSupported()) {
      const store = useRigStore.getState();
      store.setIsListeningSpeech(false);
      store.setMicState('unsupported', 'This browser has no speech recognition. Open the app in Chrome or Edge, or type your question below.');
      return false;
    }
    this.wanted = true;
    this.networkErrors = 0;
    if (!this.health) this.health = setInterval(() => this.checkHealth(), HEALTH_CHECK_MS);
    if (!this.sessionLive && !this.recognizer) this.openSession();
    return true;
  }

  public stop(): void {
    this.wanted = false;
    clearTimeout(this.restartTimeout);
    clearInterval(this.health);
    this.health = undefined;
    this.closeSession();
    const store = useRigStore.getState();
    store.setIsListeningSpeech(false);
    store.setVoiceCommanderActive(false);
    store.setMicState('off');
  }

  public toggle(): void {
    if (this.wanted) this.stop();
    else this.start();
  }

  /** Wake button: make sure the mic is on (this click is the user gesture browsers need), then listen. */
  public wake(): void {
    varunaVoice.unlock();
    this.interruptSpeech(); // stop talking: the user wants to speak
    const s = useRigStore.getState();
    // A blocked, failed or stalled recogniser must be rebuilt, not resumed
    if (s.micState === 'blocked' || s.micState === 'error' || !this.sessionLive) this.closeSession();
    this.start();
    s.wakeVaruna();
  }

  /** Typed question or command, for noisy rooms or browsers without speech recognition */
  public ask(text: string): void {
    const t = text.trim();
    if (!t) return;
    varunaVoice.unlock();
    const s = useRigStore.getState();
    s.setVoiceTranscript(t);
    this.resetDebounce();
    s.executeVoiceCommand(hasWakeWord(t) ? t : `varuna ${t}`);
  }

  public resetDebounce(): void {
    this.lastSignature = '';
    this.lastSignatureTime = 0;
    this.interimCandidate = '';
  }

  // ---------------------------------------------------------------- sessions

  /** Builds and starts a brand-new recogniser */
  private openSession(): void {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const store = useRigStore.getState();
    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      // Indian English recognises "Varuna" far better than en-US; keep the user's English locale if set
      rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-IN';
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        if (rec !== this.recognizer) return;
        this.sessionLive = true;
        this.restartDelay = 150;
        const s = useRigStore.getState();
        s.setIsListeningSpeech(true);
        s.setVoiceCommanderActive(true);
        s.setMicState('listening');
      };

      rec.onresult = (event: any) => {
        if (rec !== this.recognizer) return;
        this.networkErrors = 0;
        this.handleResult(event);
      };

      rec.onerror = (event: any) => {
        if (rec !== this.recognizer) return;
        const err = event?.error as string;
        if (err === 'no-speech' || err === 'aborted') return;
        console.warn('[VoiceCommander] Speech error:', err);
        const s = useRigStore.getState();
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
          this.wanted = false; // needs the user: Wake retries
          s.setMicState(err === 'audio-capture' ? 'error' : 'blocked', MIC_MESSAGES[err]);
        } else if (err === 'network') {
          this.networkErrors++;
          this.restartDelay = Math.min(this.restartDelay * 2, 4000);
          if (this.networkErrors >= MAX_NETWORK_ERRORS) {
            this.wanted = false;
            s.setMicState('error', MIC_MESSAGES.network);
          }
        }
      };

      rec.onend = () => {
        if (rec !== this.recognizer) return; // an old session finishing late
        this.recognizer = null;
        this.sessionLive = false;
        this.handledResultIndex = -1;
        this.wokeResultIndex = -1;
        const s = useRigStore.getState();
        s.setIsListeningSpeech(false);
        if (!this.wanted) {
          if (s.micState === 'listening' || s.micState === 'starting') s.setMicState('off');
          return;
        }
        this.scheduleOpen(this.restartDelay);
      };

      this.recognizer = rec;
      this.sessionLive = false;
      this.startedAt = Date.now();
      if (store.micState !== 'listening') store.setMicState('starting');
      rec.start();
    } catch (err) {
      console.error('[VoiceCommander] Start error:', err);
      this.recognizer = null;
      this.sessionLive = false;
      this.scheduleOpen(1000);
    }
  }

  /** Cut VARUNA off and listen at once (no echo tail, no session recycle) */
  private interruptSpeech(): void {
    if (useRigStore.getState().voiceStatus.isSpeaking) this.interrupting = true;
    varunaVoice.stop();
    this.interrupting = false;
    this.lastSpokeAt = 0;
  }

  /** Ends the current recogniser without triggering its restart logic */
  private closeSession(): void {
    clearTimeout(this.restartTimeout);
    this.openScheduled = false;
    const rec = this.recognizer;
    this.recognizer = null;
    this.sessionLive = false;
    if (rec) {
      try {
        rec.abort();
      } catch {}
    }
  }

  private scheduleOpen(delay: number): void {
    clearTimeout(this.restartTimeout);
    this.openScheduled = true;
    this.restartTimeout = setTimeout(() => {
      this.openScheduled = false;
      if (this.wanted && !this.recognizer) this.openSession();
    }, delay);
  }

  /** Replace the running session with a fresh one after `delay` ms */
  private recycle(delay: number): void {
    this.closeSession();
    this.scheduleOpen(delay);
  }

  /** Rebuilds the recogniser when it should be running but is not */
  private checkHealth(): void {
    if (!this.wanted) return;
    if (this.recognizer && !this.sessionLive && Date.now() - this.startedAt > START_TIMEOUT_MS) {
      this.recycle(0); // start() never reported back
    } else if (!this.recognizer && !this.openScheduled) {
      this.openSession(); // lost without an onend, or a restart never happened
    }
  }

  // ---------------------------------------------------------------- results

  /** True while VARUNA's own voice could be picked up by the microphone */
  private hearingOwnVoice(): boolean {
    return varunaVoice.isSpeaking() || Date.now() - this.lastSpokeAt < ECHO_TAIL_MS;
  }

  private handleResult(event: any): void {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const store = useRigStore.getState();
      const result = event.results[i];
      const alternatives: string[] = [];
      for (let a = 0; a < result.length; a++) {
        const t = (result[a]?.transcript || '').trim();
        if (t) alternatives.push(t);
      }
      if (alternatives.length === 0) continue;

      const top = alternatives[0];
      const hasWake = alternatives.some(hasWakeWord);
      // Always show what the mic heard, so a misheard wake word is visible
      store.setVoiceHeard(top);

      // Echo guard, with barge-in: the wake word interrupts VARUNA, anything else is its own echo
      if (this.hearingOwnVoice()) {
        if (!hasWake) continue;
        this.interruptSpeech();
      }

      const awake = store.isVarunaAwake && Date.now() < store.varunaWakeExpiry;
      if (!awake && !hasWake) continue;

      store.setVoiceTranscript(top);
      // Still talking: keep the window open until the sentence is finished
      if (awake && store.varunaWakeExpiry - Date.now() < TALKING_GRACE_MS) {
        useRigStore.setState({ varunaWakeExpiry: Date.now() + TALKING_GRACE_MS });
      }

      // Pick the alternative that parses into the most complete intent
      const best = this.bestAlternative(alternatives, hasWake);

      // A new "Varuna ..." is a deliberate new request, even if it repeats the last command
      if (hasWake && this.handledResultIndex !== i && this.wokeResultIndex !== i && !result.isFinal) this.resetDebounce();

      if (result.isFinal) {
        this.interimCandidate = '';
        const woke = this.wokeResultIndex === i;
        this.wokeResultIndex = -1;
        if (this.handledResultIndex === i) {
          this.handledResultIndex = -1;
          continue; // already executed from the interim fast-path
        }
        // Bare wake word already handled on the interim result
        if (woke && !best.parsed && !stripWakeWord(top)) continue;
        this.execute(best.text, best.parsed);
      } else {
        // Bare wake word: wake immediately without waiting for the final result
        if (!awake && hasWake && !stripWakeWord(top) && this.wokeResultIndex !== i) {
          this.wokeResultIndex = i;
          store.wakeVaruna();
          continue;
        }
        // Interim fast-path: unambiguous intent at once, otherwise complete and seen twice in a row
        if (!best.parsed || !best.parsed.complete || this.handledResultIndex === i) continue;
        const sig = signature(best.parsed);
        if (isUnambiguous(best.parsed) || this.interimCandidate === sig) {
          this.handledResultIndex = i;
          this.interimCandidate = '';
          this.execute(best.text, best.parsed);
        } else {
          this.interimCandidate = sig;
        }
      }
    }
  }

  private bestAlternative(alternatives: string[], wakeHeard: boolean) {
    let best = { text: alternatives[0], parsed: parseVoiceCommand(alternatives[0]) };
    for (const raw of alternatives.slice(1)) {
      // keep the wake word if any alternative contained it, so the store's wake gate passes
      const text = wakeHeard && !hasWakeWord(raw) ? `varuna ${stripWakeWord(raw)}` : raw;
      const parsed = parseVoiceCommand(text);
      if (!parsed) continue;
      const cur = best.parsed;
      if (!cur || (parsed.complete && !cur.complete) || (parsed.complete === cur.complete && parsed.score > cur.score + 0.2)) {
        best = { text, parsed };
      }
    }
    if (wakeHeard && !hasWakeWord(best.text)) best.text = `varuna ${best.text}`;
    return best;
  }

  private execute(text: string, parsed: ParsedVoiceCommand | null): void {
    const now = Date.now();
    if (parsed) {
      const sig = signature(parsed);
      if (sig === this.lastSignature && now - this.lastSignatureTime < DEBOUNCE_MS) return;
      this.lastSignature = sig;
      this.lastSignatureTime = now;
    }
    useRigStore.getState().executeVoiceCommand(text);
  }
}

export const varunaVoiceCommander = new VarunaVoiceCommander();
