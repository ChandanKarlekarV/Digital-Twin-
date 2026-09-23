/**
 * VARUNA-AI Voice Commander — Rock-Solid Single-Instance Web Speech Engine
 *
 * Key features:
 * 1. Single reliable SpeechRecognition instance (no dual-instance mic crash).
 * 2. Instant wake-up upon hearing "Varuna" (or phonetic matches).
 * 3. Interim fast-track execution for instant response.
 * 4. Automatic smooth restart on pause or end with zero gaps.
 * 5. Broad phonetic wake word matching (varuna, varun, verona, aruna, karuna, etc.)
 */

import { useRigStore } from '../store/useRigStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

class JarvisVoiceCommander {
  private recognizer: any = null;
  private isRunning = false;
  private autoRestart = true;
  private restartTimeout: any = null;

  private lastExecutedText = '';
  private lastExecutedTime = 0;
  private readonly DEBOUNCE_MS = 1100;

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
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        useRigStore.getState().setIsListeningSpeech(true);
        useRigStore.getState().setVoiceCommanderActive(true);
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

        const rawText = (finalTranscript || interimTranscript).trim();
        if (!rawText) return;

        const store = useRigStore.getState();
        const wakeWordRegex = /\b(varuna|varun|verona|viruna|waruna|baruna|varna|aruna|karuna|veruna|barun|varun a|varun ai|varuna ai|hey varuna|ok varuna)\b/i;
        const hasWakeWord = wakeWordRegex.test(rawText);

        // Update transcript UI if awake or wake word detected
        if (store.isVarunaAwake || hasWakeWord) {
          store.setVoiceTranscript(rawText);
        }

        // If user says ONLY wake word while asleep, WAKE UP IMMEDIATELY
        if (hasWakeWord && !store.isVarunaAwake) {
          const stripped = rawText.replace(wakeWordRegex, '').trim();
          if (!stripped) {
            store.wakeVaruna();
            this.lastExecutedText = rawText;
            this.lastExecutedTime = Date.now();
            return;
          }
        }

        // Execute on final transcript
        if (finalTranscript.trim()) {
          this.tryExecute(finalTranscript.trim());
          return;
        }

        // Fast-track interim execution
        if (interimTranscript.trim().length > 3) {
          this.tryExecuteInterim(interimTranscript.trim());
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('[VoiceCommander] Speech error:', event.error);
        if (event.error === 'not-allowed') {
          useRigStore.getState().setIsListeningSpeech(false);
          this.autoRestart = false;
        }
      };

      rec.onend = () => {
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
              // Ignore if already active
            }
          }
        }, 80);
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
      try { this.recognizer.abort(); } catch {}
      try { this.recognizer.stop(); } catch {}
      this.recognizer = null;
    }

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

  private tryExecute(text: string): void {
    const now = Date.now();
    if (text.toLowerCase() === this.lastExecutedText.toLowerCase() && now - this.lastExecutedTime < this.DEBOUNCE_MS) return;
    this.lastExecutedText = text;
    this.lastExecutedTime = now;
    useRigStore.getState().executeVoiceCommand(text);
  }

  private tryExecuteInterim(text: string): void {
    const lower = text.toLowerCase();
    const now = Date.now();

    const wakeWordRegex = /\b(varuna|varun|verona|viruna|waruna|baruna|varna|aruna|karuna|veruna|barun|varun a|varun ai|varuna ai|hey varuna|ok varuna)\b/i;
    const wakePresent = wakeWordRegex.test(lower);
    const commandPresent = /\b(helipad|crane|split|merge|jarvis|pipe |accommodation|drill|deck|scada|command dock|subsea|open ppt|jack.up|slice)\b/i.test(lower);

    if (!wakePresent && !commandPresent) return;
    if (lower === this.lastExecutedText.toLowerCase() && now - this.lastExecutedTime < this.DEBOUNCE_MS) return;

    const stripped = lower.replace(wakeWordRegex, '').trim();
    if (wakePresent && !stripped) {
      const store = useRigStore.getState();
      if (!store.isVarunaAwake) {
        store.wakeVaruna();
        this.lastExecutedText = text;
        this.lastExecutedTime = now;
      }
      return;
    }

    if (commandPresent) {
      this.lastExecutedText = text;
      this.lastExecutedTime = now;
      useRigStore.getState().executeVoiceCommand(text);
    }
  }
}

export const jarvisVoiceCommander = new JarvisVoiceCommander();
