import React, { useState } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const VarunaVoiceIndicator: React.FC = () => {
  const voiceStatus = useRigStore((s) => s.voiceStatus);
  const [isMuted, setIsMuted] = useState(varunaVoice.getIsMuted());

  const handleToggleMute = () => {
    const muted = varunaVoice.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl glass-panel border border-reliance-cyan/25 bg-reliance-deepnavy/85 shadow-dock">
      {/* Voice Status Waveform Animation */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((bar) => (
          <span
            key={`wave-bar-${bar}`}
            className={`w-1 rounded-full bg-reliance-cyan transition-all duration-150 ${
              voiceStatus.isSpeaking
                ? bar % 2 === 0
                  ? 'h-4 animate-bounce'
                  : 'h-6 animate-pulse'
                : 'h-2 opacity-40'
            }`}
          />
        ))}
      </div>

      {/* Transcript Text */}
      <div className="max-w-[280px] sm:max-w-md overflow-hidden">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-reliance-cyan font-bold tracking-wide">
          <Radio className="w-3 h-3 text-emerald-400" />
          <span>VARUNA TACTICAL VOICE</span>
        </div>
        <p className="text-[11px] font-sans text-white/90 truncate leading-tight">
          {voiceStatus.lastMessage || 'Subsea telemetry monitoring active.'}
        </p>
      </div>

      {/* Mute Toggle Button */}
      <button
        onClick={handleToggleMute}
        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        className="p-1.5 rounded-lg hover:bg-reliance-blue/40 text-reliance-textMuted hover:text-white transition-all cursor-pointer border border-transparent hover:border-reliance-cyan/30"
      >
        {isMuted ? (
          <VolumeX className="w-3.5 h-3.5 text-reliance-red" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-reliance-cyan" />
        )}
      </button>
    </div>
  );
};
