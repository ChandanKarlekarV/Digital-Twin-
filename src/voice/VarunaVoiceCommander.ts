/**
 * VARUNA-AI Voice Commander — single-instance Web Speech recogniser.
 *
 * Reliability:
 * 1. The microphone is (re)started from a user click (Wake button, or the first click on
 *    the page), which browsers require, and again after every pause or error.
 * 2. Every failure is shown in the HUD in plain words (blocked, no microphone, no speech
 *    service, unsupported browser) instead of failing silently.
 * 3. Echo guard follows the browser's real speech state, so a dropped utterance can no
 *    longer leave VARUNA deaf. Saying "Varuna" while it talks interrupts it (barge-in).
 * 4. While VARUNA is awake, the listening window stays open as long as you keep talking.
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
const DEBOUNCE_MS = 2500;
/** Keep the window open this long after the last word heard while awake */
const TALKING_GRACE_MS = 6000;
/** Give up auto-restarting after this many network errors in a row */
const MAX_NETWORK_ERRORS = 4;

const signature = (p: ParsedVoiceCommand) => `${p.id}:${p.num ?? ''}`;

const MIC_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone blocked. Click the lock icon in the address bar, allow the microphone, then press Wake.',
  'service-not-allowed': 'Microphone blocked by the browser. Allow it in the address bar, then press Wake.',
  'audio-capture': 'No microphone found. Plug one in or check Windows sound settings, then press Wake.',
  network: 'Speech service unreachable. Voice needs Chrome or Edge with an internet connection.',
};

class VarunaVoiceCommander {
  private recognizer: any = null;
  private isRunning = false;
  private autoRestart = true;
  private restartTimeout: ReturnType<typeof setTimeout> | undefined;
  private restartDelay = 150;
  private networkErrors = 0;

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
      if (prev.voiceStatus.isSpeaking && !state.voiceStatus.isSpeaking) this.lastSpokeAt = Date.now();
    });
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /** Starts listening. Safe to call repeatedly; call it from a click to satisfy browser rules. */
  public start(): boolean {
    if (typeof window === 'undefined') return false;
    const store = useRigStore.getState();

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      store.setIsListeningSpeech(false);
      store.setMicState('unsupported', 'This browser has no speech recognition. Open the app in Chrome or Edge, or type your question below.');
      return false;
    }

    if (this.isRunning && this.recognizer) {
      this.autoRestart = true;
      return true;
    }

    try {
      this.autoRestart = true;
      this.isRunning = true;
      this.networkErrors = 0;
      store.setMicState('starting');

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      // Indian English recognises "Varuna" far better than en-US; keep the user's English locale if set
      rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-IN';
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        this.restartDelay = 150;
        const s = useRigStore.getState();
        s.setIsListeningSpeech(true);
        s.setVoiceCommanderActive(true);
        s.setMicState('listening');
      };

      rec.onresult = (event: any) => {
        this.networkErrors = 0;
        this.handleResult(event);
      };

      rec.onerror = (event: any) => {
        const err = event?.error as string;
        if (err === 'no-speech' || err === 'aborted') return;
        console.warn('[VoiceCommander] Speech error:', err);
        const s = useRigStore.getState();
        if (err === 'not-allowed' || err === 'service-not-allowed' || err === 'audio-capture') {
          this.autoRestart = false;
          s.setMicState(err === 'audio-capture' ? 'error' : 'blocked', MIC_MESSAGES[err]);
        } else if (err === 'network') {
          this.networkErrors++;
          this.restartDelay = Math.min(this.restartDelay * 2, 4000);
          if (this.networkErrors >= MAX_NETWORK_ERRORS) {
            this.autoRestart = false;
            s.setMicState('error', MIC_MESSAGES.network);
          }
        } else {
          s.setMicState('error', `Voice error (${err}). Press Wake to retry.`);
        }
      };

      rec.onend = () => {
        this.handledResultIndex = -1;
        this.wokeResultIndex = -1;
        const s = useRigStore.getState();
        s.setIsListeningSpeech(false);
        if (!this.isRunning || !this.autoRestart) {
          this.isRunning = false;
          this.recognizer = null;
          if (s.micState === 'listening' || s.micState === 'starting') s.setMicState('off');
          return;
        }
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (!this.isRunning || !this.autoRestart || !this.recognizer) return;
          try {
            this.recognizer.start();
          } catch {
            // already started
          }
        }, this.restartDelay);
      };

      this.recognizer = rec;
      rec.start();
      return true;
    } catch (err) {
      console.error('[VoiceCommander] Start error:', err);
      this.isRunning = false;
      this.recognizer = null;
      store.setMicState('error', 'Could not start the microphone. Press Wake to retry.');
      return false;
    }
  }

  public stop(): void {
    this.autoRestart = false;
    this.isRunning = false;
    clearTimeout(this.restartTimeout);

    if (this.recognizer) {
      try {
        this.recognizer.abort();
      } catch {}
      this.recognizer = null;
    }

    const store = useRigStore.getState();
    store.setIsListeningSpeech(false);
    store.setVoiceCommanderActive(false);
    store.setMicState('off');
  }

  public toggle(): void {
    if (this.isRunning) this.stop();
    else this.start();
  }

  /** Wake button: make sure the mic is on (this click is the user gesture browsers need), then listen. */
  public wake(): void {
    varunaVoice.unlock();
    const s = useRigStore.getState();
    // A blocked or failed recogniser must be rebuilt, not resumed
    if (s.micState === 'blocked' || s.micState === 'error') {
      this.isRunning = false;
      this.recognizer = null;
    }
    this.start();
    varunaVoice.stop(); // stop talking: the user wants to speak
    this.lastSpokeAt = 0; // and listen at once, no echo tail
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

  /** True while VARUNA's own voice could be picked up by the microphone */
  private hearingOwnVoice(): boolean {
    return varunaVoice.isSpeaking() || Date.now() - this.lastSpokeAt < ECHO_TAIL_MS;
  }

  private handleResult(event: any): void {
    const store = useRigStore.getState();

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const alternatives: string[] = [];
      for (let a = 0; a < result.length; a++) {
        const t = (result[a]?.transcript || '').trim();
        if (t) alternatives.push(t);
      }
      if (alternatives.length === 0) continue;

      const top = alternatives[0];
      const hasWake = alternatives.some(hasWakeWord);

      // Echo guard, with barge-in: the wake word interrupts VARUNA, anything else is its own echo
      if (this.hearingOwnVoice()) {
        if (!hasWake) continue;
        varunaVoice.stop();
        this.lastSpokeAt = 0;
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
