import { useRigStore, EmergencyScenario, IncidentPhase, INCIDENT_SCENARIOS_CATALOG } from '../store/useRigStore';
import { useTelemetryStore } from '../store/useTelemetryStore';

export interface ElevenLabsVoiceOption {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const PRELOADED_ELEVENLABS_VOICES: ElevenLabsVoiceOption[] = [
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam (Tactical Offshore Operator)',
    category: 'Authoritative / Tactical',
    description: 'Deep, crisp, authoritative tactical commander voice optimal for subsea operations.',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel (Marine Dispatch & Control)',
    category: 'Calm / Professional',
    description: 'Clear, professional offshore control room announcer.',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni (Cyber-Physical AI)',
    category: 'Technical / Analytical',
    description: 'Precise, calculated artificial intelligence voice for physics diagnostics.',
  },
  {
    id: 'TxGEqnHWrfWFTfGW9XjX',
    name: 'Josh (Deepwater Subsea Specialist)',
    category: 'Resonant / Direct',
    description: 'Resonant, grounded voice for emergency alerts and telemetry.',
  },
];

/**
 * Tactical Subsea Audio & Voice Synthesis Engine for VARUNA-AI
 * Synthesizes procedural emergency klaxons, storm gale sirens, drill overload beeps,
 * and natural voice announcements via ElevenLabs API & Web Speech fallback.
 */
class VarunaVoiceSynthesizer {
  private isMuted = false;
  private audioCtx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initAudio(): void {
    if (typeof window !== 'undefined' && !this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
   * Procedural Emergency Alarm Klaxon / Warning Sound Generator
   * Generates distinct, high-impact audio alert signatures tailored for each incident type:
   * - Weather Squall: Marine storm gale oscillating siren (480 Hz <-> 720 Hz)
   * - Drill Damage / Stuck Drill: High-torque mechanical overload screech (3 rapid sweeps)
   * - Pipe Blockage / Hydrate Plug: Subsea pressure choke klaxon (560 Hz -> 380 Hz)
   * - Oil Overload: Process vessel high-level warning pulse
   * - Pipe Rupture: Critical ESD two-tone emergency alarm
   */
  public playEmergencyAlarm(scenario: EmergencyScenario): void {
    if (this.isMuted) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      if (scenario === 'weather_squall') {
        // Marine Storm Gale Warning Siren (Dual-Tone Rising Sweep)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.linearRampToValueAtTime(740, now + 0.35);
        osc.frequency.linearRampToValueAtTime(420, now + 0.7);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.75);
      } else if (scenario === 'drill_damage' || scenario === 'stuck_drill') {
        // High-Torque Mechanical Strain Alert (3 Rapid Alarm Pulses)
        [0, 0.16, 0.32].forEach((offset) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(950, now + offset);
          osc.frequency.exponentialRampToValueAtTime(1400, now + offset + 0.12);

          gain.gain.setValueAtTime(0.2, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.14);
        });
      } else if (scenario === 'pipe_blockage' || scenario === 'hydrate_plug') {
        // Subsea Choke & Flowline Constriction Klaxon
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.5);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (scenario === 'oil_overload') {
        // High-Level Separator Flooding Pulse (Dual Alternating Chime)
        [0, 0.22].forEach((offset, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(idx === 0 ? 880 : 660, now + offset);

          gain.gain.setValueAtTime(0.22, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.2);
        });
      } else if (scenario === 'rupture') {
        // Critical Emergency ESD Decompression Siren (Urgent Two-Tone Sweep)
        [0, 0.25, 0.5].forEach((offset, idx) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(idx % 2 === 0 ? 880 : 440, now + offset);

          gain.gain.setValueAtTime(0.28, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.22);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + 0.23);
        });
      } else {
        // Default tactical sonar acknowledgment
        this.playSonarPing(880, 0.12);
      }
    } catch {
      // Ignore audio sandbox restrictions
    }
  }

  /**
   * Synthesize tactical alert for subsea incident scenario and progressive phase
   * Plays the distinctive warning alarm sound FIRST, then speaks the tactical voice advisory!
   */
  public speakIncidentAlert(scenario: EmergencyScenario, phase: IncidentPhase = 1): void {
    const meta = INCIDENT_SCENARIOS_CATALOG[scenario];
    if (!meta) return;

    // 1. Play realistic procedural warning alarm / siren immediately
    this.playEmergencyAlarm(scenario);

    // 2. Announce tactical incident diagnostics aloud after brief alarm lead-in
    const alertMessage = meta.phases[phase]?.tacticalVoiceAlert || meta.title;

    setTimeout(() => {
      this.speakCustom(alertMessage);
    }, 450);
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
        message = `Drill floor inspected. Rotary speed 120 RPM, torque 28.4 kilonewton-meters. Top-drive and derrick mast within nominal operating envelope.`;
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

    this.speakCustom(message);
  }

  /**
   * Speak custom message using ElevenLabs (if configured) or fallback to Web Speech
   */
  public async speakCustom(message: string): Promise<void> {
    if (this.isMuted) return;

    useRigStore.getState().setVoiceStatus({
      isSpeaking: true,
      lastMessage: message,
    });

    const apiKey = useRigStore.getState().elevenLabsApiKey;
    const voiceId = useRigStore.getState().elevenLabsVoiceId || 'pNInz6obpgDQGcFmaJgB';

    // 1. Try ElevenLabs API if key is provided
    if (apiKey && typeof window !== 'undefined') {
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: message,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.8,
              style: 0.1,
              use_speaker_boost: true,
            },
          }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);

          if (this.currentAudioElement) {
            this.currentAudioElement.pause();
          }

          const audio = new Audio(audioUrl);
          this.currentAudioElement = audio;

          audio.onended = () => {
            useRigStore.getState().setVoiceStatus({
              isSpeaking: false,
              lastMessage: message,
            });
            URL.revokeObjectURL(audioUrl);
          };

          audio.onerror = () => {
            this.speakWebSpeechFallback(message);
          };

          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('ElevenLabs speech generation fallback to WebSpeech:', err);
      }
    }

    // 2. Fallback to Web Speech API
    this.speakWebSpeechFallback(message);
  }

  private speakWebSpeechFallback(message: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => {
        useRigStore.getState().setVoiceStatus({
          isSpeaking: false,
          lastMessage: message,
        });
      }, 3000);
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
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('David') ||
            v.name.includes('Alex') ||
            v.name.includes('Guy'))
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
    if (this.isMuted) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
      }
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const varunaVoice = new VarunaVoiceSynthesizer();
