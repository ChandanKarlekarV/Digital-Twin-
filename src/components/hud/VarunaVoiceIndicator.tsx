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
    <div className="hidden lg:flex items-center gap-2.5 h-10 pl-3 pr-1 rounded-md glass-pill w-[clamp(220px,24vw,340px)]">
      {/* Speaking indicator */}
      <div className="flex items-end gap-0.5 h-4 shrink-0" aria-hidden>
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-0.5 rounded-full bg-accent-400 transition-all duration-150 ${
              voiceStatus.isSpeaking ? (bar === 2 ? 'h-4 animate-pulse' : 'h-2.5 animate-pulse') : 'h-1.5 opacity-50'
            }`}
          />
        ))}
      </div>

      {/* Last thing VARUNA said */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] font-medium text-ink-muted">
          <Radio className="w-3 h-3 text-success-400" />
          VARUNA-AI
        </div>
        <p className="text-[11px] text-ink truncate leading-tight" title={voiceStatus.lastMessage}>
          {voiceStatus.lastMessage || 'Monitoring the rig.'}
        </p>
      </div>

      <button
        onClick={handleToggleMute}
        title={isMuted ? 'Unmute voice' : 'Mute voice'}
        className="btn btn-icon border-transparent bg-transparent shrink-0"
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-danger-400" /> : <Volume2 className="w-3.5 h-3.5 text-ink-muted" />}
      </button>
    </div>
  );
};
