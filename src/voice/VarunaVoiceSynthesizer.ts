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

    const rpm = record?.drill_rpm ?? 120;
    const torque = (record?.drill_torque_knm ?? 28.4).toFixed(1);

    let message = '';
    switch (assetId) {
      case 'DRILL-SYSTEM':
        message = `Here's the drill string. It's turning at ${rpm} RPM with about ${torque} kNm of torque. Everything looks normal.`;
        break;
      case 'CRANE-SYSTEM':
        message = `These are the pedestal cranes. Hydraulic pressure is steady at 210 bar, and they're rated for 150 tonnes.`;
        break;
      case 'PILLAR-FOUNDATION':
        message = `This is the jacket and its support legs. Load is balanced across all four columns, and the structure is stable.`;
        break;
      case 'RISER-ALPHA':
      case 'RISER-BRAVO':
      case 'SUBSEA-PIPES':
        message = `This is the production riser. Line pressure is ${pVal} bar, and it's carrying about ${bpdVal} BPD. Wall integrity is good.`;
        break;
      case 'MANIFOLD-D6-MAIN':
      case 'XT-WELLHEAD-01':
      case 'XT-WELLHEAD-02':
        message = `You're looking at the subsea manifold. Header pressure is ${pVal} bar, gathering about ${bpdVal} BPD. All branch valves are open and healthy.`;
        break;
      case 'SUBSEA-BEDROCK':
        message = `This is the seabed and the rock below it. The reservoir sits around two thousand metres down, and the borehole casing is holding well.`;
        break;
      case 'TOPSIDE-DRILL-RIG':
      default:
        message = `This is the KG-D6 platform. Line pressure is ${pVal} bar, and all topside systems are running normally.`;
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

  private cachedVoice: SpeechSynthesisVoice | null = null;
  private voicesListenerAttached = false;
  private speechToken = 0;

  /**
   * Picks the most natural-sounding English voice the system offers. Neural/"Natural"
   * voices (Edge, Windows 11), Google network voices and Apple enhanced voices sound far
   * more human than the legacy desktop SAPI voices, which are ranked last.
   */
  private pickVoice(): SpeechSynthesisVoice | null {
    if (this.cachedVoice) return this.cachedVoice;
    const synth = window.speechSynthesis;
    if (!this.voicesListenerAttached) {
      this.voicesListenerAttached = true;
      synth.addEventListener?.('voiceschanged', () => {
        this.cachedVoice = null;
      });
    }
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
    if (voices.length === 0) return null;

    const userLang = (navigator.language || 'en-US').toLowerCase();
    const score = (v: SpeechSynthesisVoice) => {
      const n = v.name.toLowerCase();
      let s = 0;
      if (n.includes('natural') || n.includes('neural')) s += 100;
      if (n.includes('online')) s += 20;
      if (n.includes('google')) s += 60;
      if (n.includes('enhanced') || n.includes('premium') || n.includes('siri')) s += 70;
      if (/(aria|jenny|guy|sonia|ryan|neerja|prabhat|samantha|daniel|karen)/.test(n)) s += 15;
      if (n.includes('desktop') || /(david|zira|mark)\b/.test(n)) s -= 40;
      if (v.lang.toLowerCase() === userLang) s += 10;
      if (!v.localService) s += 5;
      return s;
    };
    this.cachedVoice = voices.sort((a, b) => score(b) - score(a))[0];
    return this.cachedVoice;
  }

  /** Rewrites engineering shorthand so it is read the way a person would say it. */
  private humanize(text: string): string {
    return text
      .replace(/\bKG-D6\b/g, 'K G D six')
      .replace(/(\d)\s*°\s*C\b/g, '$1 degrees')
      .replace(/(\d)\s*%/g, '$1 percent')
      .replace(/\bkNm\b/gi, 'kilonewton metres')
      .replace(/\bkilonewton-meters\b/gi, 'kilonewton metres')
      .replace(/\bBPD\b/g, 'barrels a day')
      .replace(/\bRPM\b/g, 'R P M')
      .replace(/\bMT\b/g, 'tonnes')
      .replace(/\bSCADA\b/g, 'skada')
      .replace(/\bESD\b/g, 'E S D')
      .replace(/\bMPFM\b/g, 'multiphase meter')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private finishSpeaking(message: string, token: number): void {
    if (token !== this.speechToken) return;
    useRigStore.getState().setVoiceStatus({ isSpeaking: false, lastMessage: message });
  }

  private speakWebSpeechFallback(message: string): void {
    const token = ++this.speechToken;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => this.finishSpeaking(message, token), 3000);
      return;
    }

    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const voice = this.pickVoice();

      // Speak sentence by sentence: natural pauses, and Chrome no longer cuts off long text
      const sentences = this.humanize(message).match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [message];
      sentences.forEach((sentence, i) => {
        const u = new SpeechSynthesisUtterance(sentence);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        // Neural voices already have natural prosody; legacy voices sound better a touch slower
        const natural = !!voice && /natural|neural|google|enhanced|premium|siri/i.test(voice.name);
        u.rate = natural ? 1.0 : 0.94;
        u.pitch = 1.0;
        u.volume = 0.95;
        if (i === sentences.length - 1) {
          u.onend = () => this.finishSpeaking(message, token);
          u.onerror = () => this.finishSpeaking(message, token);
        }
        synth.speak(u);
      });
    } catch {
      this.finishSpeaking(message, token);
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
