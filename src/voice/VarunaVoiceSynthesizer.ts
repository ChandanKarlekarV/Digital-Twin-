import { useRigStore } from '../store/useRigStore';
import { useTelemetryStore } from '../store/useTelemetryStore';

/**
 * Tactical Subsea Audio & Voice Synthesis Engine for VARUNA-AI
 * Synthesizes authoritative tactical audio announcements and radar pings via Web Speech and Web Audio APIs.
 */
class VarunaVoiceSynthesizer {
  private isMuted = false;
  private audioCtx: AudioContext | null = null;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initAudio(): void {
    if (typeof window !== 'undefined' && !this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  /**
   * Synthesize a short tactical sonar/radar acknowledgment ping
   */
  public playSonarPing(frequency = 880, duration = 0.12): void {
    if (this.isMuted) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, this.audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Ignore audio sandbox restrictions
    }
  }

  /**
   * Speak a concise tactical subsea diagnostic for the selected asset
   */
  public speakDiagnostic(assetId: string): void {
    this.playSonarPing(920, 0.1);

    const record = useTelemetryStore.getState().currentRecord;
    const pVal = record ? Math.round(record.p_line_bar) : 242;
    const bpdVal = record ? Math.round(record.net_oil_bpd).toLocaleString() : '34,200';

    let message = '';
    switch (assetId) {
      case 'DRILL-SYSTEM':
        message = `Drill floor inspected. Rotary speed 120 RPM, torque 28.4 kilonewton-meters. Top-drive and derrick mast within nominal operating parameters.`;
        break;
      case 'CRANE-SYSTEM':
        message = `Topside heavy-lift pedestal cranes inspected. Hydraulic line pressure 210 bar. Safe working load 150 metric tons operational.`;
        break;
      case 'PILLAR-FOUNDATION':
        message = `Platform stability columns inspected. Semi-submersible hull ballast stability at 98.6%. Four primary buoyant column tensions balanced.`;
        break;
      case 'RISER-ALPHA':
      case 'RISER-BRAVO':
      case 'SUBSEA-PIPES':
        message = `Subsea riser and production flowlines inspected. Internal line pressure: ${pVal} bar. Multiphase flow rate: ${bpdVal} barrels per day. Wall integrity 99.4%.`;
        break;
      case 'MANIFOLD-D6-MAIN':
      case 'XT-WELLHEAD-01':
      case 'XT-WELLHEAD-02':
        message = `Subsea Production Manifold Hub D6 inspected. Header Pressure: ${pVal} bar. Total gathering rate: ${bpdVal} Barrels per day. All branch valves nominal.`;
        break;
      case 'SUBSEA-BEDROCK':
        message = `Subterranean geological formation inspected. KG-D6 deepwater turbidite reservoir at 2,040 meters subsea depth. Borehole casing integrity optimal.`;
        break;
      case 'TOPSIDE-DRILL-RIG':
      default:
        message = `Reliance KG-D6 platform inspected. Line Pressure: ${pVal} bar. Topside processing modules and Coriolis MPFM sensors locked.`;
        break;
    }

    useRigStore.getState().setVoiceStatus({
      isSpeaking: true,
      lastMessage: message,
    });

    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      }, 3500);
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Cancel any overlapping speech
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.volume = 0.9;

      // Select an authoritative natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Alex'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      };

      utterance.onerror = () => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      useRigStore.getState().setVoiceStatus({
        isSpeaking: false,
        lastMessage: message,
      });
    }
  }

  public speakCustom(message: string): void {
    this.playSonarPing(880, 0.08);

    useRigStore.getState().setVoiceStatus({
      isSpeaking: true,
      lastMessage: message,
    });

    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      }, 3500);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.05;
      utterance.pitch = 0.95;
      utterance.volume = 0.9;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('David') || v.name.includes('Alex'))
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      };

      utterance.onerror = () => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      useRigStore.getState().setVoiceStatus({
        isSpeaking: false,
        lastMessage: message,
      });
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const varunaVoice = new VarunaVoiceSynthesizer();
