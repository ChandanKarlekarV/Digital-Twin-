import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Key,
  Check,
  Radio,
  Play,
  Save,
  HelpCircle,
} from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice, PRELOADED_ELEVENLABS_VOICES } from '../../voice/VarunaVoiceSynthesizer';

export const ElevenLabsConfigModal: React.FC = () => {
  const isVoiceModalOpen = useRigStore((s) => s.isVoiceModalOpen);
  const setVoiceModalOpen = useRigStore((s) => s.setVoiceModalOpen);

  const elevenLabsApiKey = useRigStore((s) => s.elevenLabsApiKey);
  const elevenLabsVoiceId = useRigStore((s) => s.elevenLabsVoiceId);
  const setElevenLabsApiKey = useRigStore((s) => s.setElevenLabsApiKey);
  const setElevenLabsVoiceId = useRigStore((s) => s.setElevenLabsVoiceId);

  const [inputKey, setInputKey] = useState<string>(elevenLabsApiKey || '');
  const [customVoiceId, setCustomVoiceId] = useState<string>(elevenLabsVoiceId || 'pNInz6obpgDQGcFmaJgB');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(varunaVoice.getIsMuted());

  if (!isVoiceModalOpen) return null;

  const handleSave = () => {
    setElevenLabsApiKey(inputKey.trim() || null);
    setElevenLabsVoiceId(customVoiceId.trim() || 'pNInz6obpgDQGcFmaJgB');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    varunaVoice.speakCustom('VARUNA-AI Voice Synthesizer configured. Natural ElevenLabs speech engine active.');
  };

  const handleTestVoice = () => {
    varunaVoice.playSonarPing(880, 0.1);
    varunaVoice.speakCustom(
      'VARUNA-AI Tactical Voice Engine online. All deepwater subsea telemetry channels operating at 10 Hertz.'
    );
  };

  const handleToggleMute = () => {
    const muted = varunaVoice.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/95 shadow-dock text-white font-sans flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-reliance-cyan/20 bg-reliance-navy/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-reliance-blue/50 border border-reliance-cyan/40 text-reliance-cyan shadow-cyan-glow">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-reliance-cyan/20 text-reliance-cyan border border-reliance-cyan/30 font-bold uppercase">
                  ELEVENLABS & WEB SPEECH ENGINE
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Tactical Voice Synthesizer & Audio Configuration
              </h2>
            </div>
          </div>

          <button
            onClick={() => setVoiceModalOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-reliance-textMuted hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-sm font-sans">
          {/* 1. API Key Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-reliance-cyan font-bold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                <span>ELEVENLABS API KEY:</span>
              </label>
              <span className="text-[10px] font-mono text-reliance-textMuted">
                {inputKey ? 'KEY CONFIGURED' : 'WEB SPEECH FALLBACK ACTIVE'}
              </span>
            </div>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="xi-api-key (e.g. 29a8f... optional)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-reliance-dark border border-reliance-cyan/30 text-white font-mono text-xs focus:outline-none focus:border-reliance-cyan shadow-inner"
            />
            <p className="text-[11px] text-reliance-textMuted leading-relaxed flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-reliance-cyan shrink-0" />
              <span>Leave blank to use the built-in browser Web Speech API with procedural tactical radio filters.</span>
            </p>
          </div>

          {/* 2. Voice Persona Selection */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-reliance-cyan font-bold block">
              SELECT VOICE PERSONA:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRELOADED_ELEVENLABS_VOICES.map((voice) => {
                const isSelected = customVoiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    onClick={() => setCustomVoiceId(voice.id)}
                    className={`p-3 rounded-xl text-left font-mono transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-reliance-blue/60 border-reliance-cyan text-white shadow-cyan-glow font-bold'
                        : 'bg-reliance-navy/40 border-white/10 text-reliance-textMuted hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-reliance-cyan truncate">{voice.name}</div>
                    <div className="text-[9px] text-white/50">{voice.category}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Custom Voice ID Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-reliance-textMuted block">
              CUSTOM ELEVENLABS VOICE ID:
            </label>
            <input
              type="text"
              value={customVoiceId}
              onChange={(e) => setCustomVoiceId(e.target.value)}
              placeholder="e.g. pNInz6obpgDQGcFmaJgB"
              className="w-full px-3 py-2 rounded-lg bg-reliance-dark border border-white/20 text-white font-mono text-xs focus:outline-none focus:border-reliance-cyan"
            />
          </div>

          {/* 4. Action Buttons */}
          <div className="pt-3 border-t border-reliance-cyan/20 flex items-center justify-between gap-3">
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                  : 'bg-reliance-navy border-white/20 text-reliance-textMuted hover:text-white'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? 'AUDIO MUTED' : 'AUDIO ENABLED'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestVoice}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-reliance-navy hover:bg-reliance-blue/50 border border-reliance-cyan/30 text-xs font-mono text-reliance-cyan transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>TEST VOICE</span>
              </button>

              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-reliance-blue hover:bg-reliance-blue/80 border border-reliance-cyan text-xs font-mono font-bold text-white shadow-cyan-glow transition-all cursor-pointer"
              >
                {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isSaved ? 'SAVED' : 'SAVE SETTINGS'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
