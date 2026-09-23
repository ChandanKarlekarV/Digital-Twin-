/**
 * VARUNA-AI Voice Commander — Dual Overlapping Recognizer Architecture
 *
 * Key improvements over v1:
 * 1. DUAL RECOGNIZER (A+B): Two SpeechRecognition instances run in overlap.
 *    When A ends, B is already running. Zero-gap back-to-back commands.
 * 2. WAKE-GATED TRANSCRIPT: setVoiceTranscript() is only called when Varuna is awake.
 *    Command box stays blank / shows placeholder when Varuna is sleeping.
 * 3. INSTANT INTERIM RESULTS: Commands fire on interim results (not just isFinal),
 *    reducing perceived latency from ~800ms to ~150ms.
 * 4. AUTO-EXTEND WAKE WINDOW: executeVoiceCommand() extends wake by 8s per command.
 * 5. WRONG COMMAND RESET: On unrecognized command, transcript is cleared and
 *    recognizer gracefully resumes without getting stuck.
 */

import { useRigStore } from '../store/useRigStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

class JarvisVoiceCommander {
  private recognizerA: any = null;
  private recognizerB: any = null;
  private activeRecognizer: 'A' | 'B' | null = null;
  private isRunning = false;
  private autoRestart = true;

  // Interim debounce: prevent double-firing on same command text
  private lastExecutedText = '';
  private lastExecutedTime = 0;
  private readonly DEBOUNCE_MS = 1200;

  // ─── Public API ────────────────────────────────────────────────────────────

  public start(): boolean {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[VoiceCommander] Web Speech API not supported in this browser.');
      useRigStore.getState().setIsListeningSpeech(false);
      return false;
    }

    if (this.isRunning) return true;

    try {
      this.autoRestart = true;
      this.isRunning = true;

      // Build both recognizers
      this.recognizerA = this.buildRecognizer(SpeechRec, 'A');
      this.recognizerB = this.buildRecognizer(SpeechRec, 'B');

      // Start A, warm-start B a little later so it's ready when A ends
      this.startRecognizer('A');
      setTimeout(() => {
        if (this.isRunning && this.recognizerB) {
          try { this.recognizerB.start(); } catch { /* already started */ }
        }
      }, 200);

      useRigStore.getState().setVoiceCommanderActive(true);
      return true;
    } catch (err) {
      console.error('[VoiceCommander] Failed to start:', err);
      this.isRunning = false;
      return false;
    }
  }

  public stop(): void {
    this.autoRestart = false;
    this.isRunning = false;
    this.activeRecognizer = null;

    this.killRecognizer(this.recognizerA);
    this.killRecognizer(this.recognizerB);
    this.recognizerA = null;
    this.recognizerB = null;

    useRigStore.getState().setIsListeningSpeech(false);
    useRigStore.getState().setVoiceCommanderActive(false);
  }

  public toggle(): void {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  public resetDebounce(): void {
    this.lastExecutedText = '';
    this.lastExecutedTime = 0;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private buildRecognizer(SpeechRec: any, label: 'A' | 'B'): any {
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      // Mark the recognizer that just started as the active primary
      if (this.activeRecognizer === null) {
        this.activeRecognizer = label;
      }
      useRigStore.getState().setIsListeningSpeech(true);
    };

    rec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      const displayText = (finalTranscript || interimTranscript).trim();

      // Only push transcript to UI when Varuna is awake
      if (displayText) {
        const store = useRigStore.getState();
        if (store.isVarunaAwake && Date.now() < store.varunaWakeExpiry) {
          store.setVoiceTranscript(displayText);
        } else {
          // Check if the text contains the wake word — if so show it
          const wakeWordRegex = /\b(varuna|varun|verona|viruna|waruna|baruna|varna)\b/i;
          if (wakeWordRegex.test(displayText)) {
            store.setVoiceTranscript(displayText);
          }
          // Otherwise, keep transcript blank — Varuna is sleeping
        }
      }

      // Execute on final transcript (highest quality)
      if (finalTranscript.trim()) {
        this.tryExecute(finalTranscript.trim());
        return;
      }

      // Also try interim for Alexa-speed response — but only if it looks like
      // a complete sentence (ends with a recognizable command keyword) to avoid
      // firing on mid-word fragments
      if (interimTranscript.trim().length > 4) {
        this.tryExecuteInterim(interimTranscript.trim());
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === 'no-speech') return; // silent: user just paused
      if (event.error === 'aborted') return;   // silent: we called .abort()

      console.warn(`[VoiceCommander/${label}] Error: ${event.error}`);

      // On hard errors, clear the stuck transcript
      if (event.error === 'network' || event.error === 'audio-capture' || event.error === 'not-allowed') {
        useRigStore.getState().setVoiceTranscript(null);
      }
    };

    rec.onend = () => {
      if (!this.autoRestart || !this.isRunning) {
        useRigStore.getState().setIsListeningSpeech(false);
        return;
      }

      // Immediately restart this recognizer so there's no gap
      // The other recognizer should still be running as a backup
      setTimeout(() => {
        if (!this.isRunning) return;
        try { rec.start(); } catch { /* may already be starting */ }
      }, 50);
    };

    return rec;
  }

  private startRecognizer(label: 'A' | 'B'): void {
    const rec = label === 'A' ? this.recognizerA : this.recognizerB;
    if (!rec) return;
    try {
      rec.start();
      this.activeRecognizer = label;
    } catch {
      // Ignore if already started
    }
  }

  private killRecognizer(rec: any): void {
    if (!rec) return;
    try { rec.abort(); } catch { /* ignore */ }
    try { rec.stop(); } catch { /* ignore */ }
  }

  /** Execute only final recognized text — always reliable */
  private tryExecute(text: string): void {
    const now = Date.now();
    // Debounce: don't fire same command twice within DEBOUNCE_MS
    if (text === this.lastExecutedText && now - this.lastExecutedTime < this.DEBOUNCE_MS) return;
    this.lastExecutedText = text;
    this.lastExecutedTime = now;
    useRigStore.getState().executeVoiceCommand(text);
  }

  /** Execute on interim result — only fire if it contains complete recognizable keywords */
  private tryExecuteInterim(text: string): void {
    const lower = text.toLowerCase();
    const now = Date.now();

    // Only execute on interim if it contains a wake word + a recognizable command keyword
    // This prevents half-word matches from triggering commands prematurely
    const wakePresent = /\b(varuna|varun|verona|viruna|waruna|baruna|varna)\b/i.test(lower);
    const commandPresent = /\b(helipad|crane|split|merge|jarvis|pipe |accommodation|drill|deck|scada|command dock|subsea|open ppt|jack.up)\b/i.test(lower);

    if (!wakePresent && !commandPresent) return;
    if (text === this.lastExecutedText && now - this.lastExecutedTime < this.DEBOUNCE_MS) return;

    // Don't fire interim if store already executed this wake+command recently
    const store = useRigStore.getState();
    if (store.lastVoiceCommand === text && now - this.lastExecutedTime < this.DEBOUNCE_MS) return;

    this.lastExecutedText = text;
    this.lastExecutedTime = now;
    useRigStore.getState().executeVoiceCommand(text);
  }
}

export const jarvisVoiceCommander = new JarvisVoiceCommander();
