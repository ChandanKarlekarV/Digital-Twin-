/**
 * VARUNA-AI Voice Commander — single-instance Web Speech recogniser.
 *
 * Accuracy measures:
 * 1. Up to 5 recognition alternatives are scored by the intent parser; the best
 *    complete match wins instead of blindly taking alternative #0.
 * 2. Echo guard: while VARUNA is speaking (and ~700 ms after) results are ignored,
 *    so the assistant never re-triggers on its own voice ("Opening helipad...").
 * 3. Interim fast-path: a complete intent that explains the whole utterance and cannot
 *    grow into a longer command runs on the first interim result; anything else must be
 *    stable across two interims. The final result of that utterance is then skipped, so
 *    a command never runs twice.
 * 4. Automatic restart on end / network hiccups with exponential back-off.
 */

import { useRigStore } from '../store/useRigStore';
import { parseVoiceCommand, ParsedVoiceCommand, hasWakeWord, stripWakeWord, isUnambiguous } from './VoiceCommandParser';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const ECHO_TAIL_MS = 700;
const DEBOUNCE_MS = 2500;

const signature = (p: ParsedVoiceCommand) => `${p.id}:${p.num ?? ''}`;

class VarunaVoiceCommander {
  private recognizer: any = null;
  private isRunning = false;
  private autoRestart = true;
  private restartTimeout: ReturnType<typeof setTimeout> | undefined;
  private restartDelay = 120;

  private speakingUntil = 0;
  private lastSignature = '';
  private lastSignatureTime = 0;
  private interimCandidate = '';
  /** resultIndex of the utterance already handled by the interim fast-path */
  private handledResultIndex = -1;
  /** resultIndex whose bare wake word already woke VARUNA */
  private wokeResultIndex = -1;

  constructor() {
    // Track VARUNA's own speech for the echo guard
    useRigStore.subscribe((state, prev) => {
      if (state.voiceStatus.isSpeaking) this.speakingUntil = Number.POSITIVE_INFINITY;
      else if (prev.voiceStatus.isSpeaking) this.speakingUntil = Date.now() + ECHO_TAIL_MS;
    });
  }

  public start(): boolean {
    if (typeof window === 'undefined') return false;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[VoiceCommander] Web Speech API not supported in this browser.');
      useRigStore.getState().setIsListeningSpeech(false);
      return false;
    }

    if (this.isRunning && this.recognizer) return true;

    try {
      this.autoRestart = true;
      this.isRunning = true;

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      // Use the user's English locale (e.g. en-IN recognises "Varuna" far better than en-US)
      rec.lang = navigator.language?.startsWith('en') ? navigator.language : 'en-US';
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        this.restartDelay = 120;
        useRigStore.getState().setIsListeningSpeech(true);
        useRigStore.getState().setVoiceCommanderActive(true);
      };

      rec.onresult = (event: any) => this.handleResult(event);

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('[VoiceCommander] Speech error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          useRigStore.getState().setIsListeningSpeech(false);
          this.autoRestart = false;
        } else if (event.error === 'network') {
          this.restartDelay = Math.min(this.restartDelay * 2, 5000);
        }
      };

      rec.onend = () => {
        this.handledResultIndex = -1;
        this.wokeResultIndex = -1;
        if (!this.isRunning || !this.autoRestart) {
          useRigStore.getState().setIsListeningSpeech(false);
          return;
        }
        clearTimeout(this.restartTimeout);
        this.restartTimeout = setTimeout(() => {
          if (this.isRunning && this.autoRestart && this.recognizer) {
            try {
              this.recognizer.start();
            } catch {
              // already started
            }
          }
        }, this.restartDelay);
      };

      this.recognizer = rec;
      rec.start();
      return true;
    } catch (err) {
      console.error('[VoiceCommander] Start error:', err);
      this.isRunning = false;
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

    useRigStore.getState().setIsListeningSpeech(false);
    useRigStore.getState().setVoiceCommanderActive(false);
  }

  public toggle(): void {
    if (this.isRunning) this.stop();
    else this.start();
  }

  public resetDebounce(): void {
    this.lastSignature = '';
    this.lastSignatureTime = 0;
    this.interimCandidate = '';
  }

  private handleResult(event: any): void {
    // Echo guard: ignore everything heard while VARUNA itself is talking
    if (Date.now() < this.speakingUntil) return;

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
      const awake = store.isVarunaAwake && Date.now() < store.varunaWakeExpiry;

      if (awake || hasWake) store.setVoiceTranscript(top);
      if (!awake && !hasWake) continue;

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
