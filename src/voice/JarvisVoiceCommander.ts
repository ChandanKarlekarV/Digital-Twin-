/**
 * Continuous Web Speech Recognition Voice Commander (Jarvis / Varuna AI Mode)
 * Continuously listens to user microphone and executes commands:
 * - "pipe 1" -> Fly to & zoom in on Pipe 1 (Riser Alpha)
 * - "slice it" / "cut pipe" -> Slice pipe open & trigger full-screen cross-section deck
 * - "split" / "explode" -> Jarvis Exploded Split View of all 6 modules
 * - "assemble" / "reassemble" -> Reassemble digital twin
 * - "topside", "subsea", "manifold", "weather report", "storm", etc.
 */

import { useRigStore } from '../store/useRigStore';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

class JarvisVoiceCommander {
  private recognition: any = null;
  private isListening = false;
  private autoRestart = true;
  private restartTimeout: number | null = null;

  public start(): boolean {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('Web Speech Recognition API is not supported in this browser environment.');
      useRigStore.getState().setIsListeningSpeech(false);
      return false;
    }

    if (this.isListening && this.recognition) {
      return true;
    }

    try {
      this.autoRestart = true;
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        useRigStore.getState().setIsListeningSpeech(true);
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const currentText = finalTranscript || interimTranscript;
        if (currentText) {
          useRigStore.getState().setVoiceTranscript(currentText.trim());
        }

        if (finalTranscript) {
          const cleanCmd = finalTranscript.trim();
          useRigStore.getState().executeVoiceCommand(cleanCmd);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('Speech Recognition notice:', event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        useRigStore.getState().setIsListeningSpeech(false);

        // Keep continuously listening like Jarvis unless explicitly stopped
        if (this.autoRestart && useRigStore.getState().isVoiceCommanderActive) {
          this.restartTimeout = window.setTimeout(() => {
            try {
              this.recognition?.start();
            } catch {
              // Ignore if already starting
            }
          }, 400);
        }
      };

      this.recognition.start();
      useRigStore.getState().setVoiceCommanderActive(true);
      return true;
    } catch (err) {
      console.error('Failed to start Speech Recognition:', err);
      useRigStore.getState().setIsListeningSpeech(false);
      return false;
    }
  }

  public stop(): void {
    this.autoRestart = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

    this.isListening = false;
    useRigStore.getState().setIsListeningSpeech(false);
    useRigStore.getState().setVoiceCommanderActive(false);
  }

  public toggle(): void {
    const active = useRigStore.getState().isVoiceCommanderActive;
    if (active) {
      this.stop();
    } else {
      this.start();
    }
  }
}

export const jarvisVoiceCommander = new JarvisVoiceCommander();
