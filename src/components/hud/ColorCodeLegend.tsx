import React, { useState } from 'react';
import { Palette, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useRigStore, HolographicComponentType } from '../../store/useRigStore';
import { varunaVoice } from '../../voice/VarunaVoiceSynthesizer';

export const ColorCodeLegend: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const openHoloModal = useRigStore((s) => s.openHoloModal);
  const setCameraViewMode = useRigStore((s) => s.setCameraViewMode);
  const setSelectedAssetId = useRigStore((s) => s.setSelectedAssetId);

  const legendItems = [
    { name: 'CRANE 1 (LATTICE BOOM)', color: '#FF9900', target: 'crane1', asset: 'CRANE-PORT' },
    { name: 'CRANE 2 (PEDESTAL)', color: '#FF007F', target: 'crane2', asset: 'CRANE-STARBOARD' },
    { name: 'HELIPAD', color: '#00FF66', target: 'helipad', asset: 'HELIPAD-DECK' },
    { name: 'ACCOMMODATION MODULE', color: '#9933FF', target: 'upper_rig', asset: 'TOPSIDE-DRILL-RIG' },
    { name: 'INDUSTRIAL PIPE FITTING', color: '#00FFFF', target: 'pipe1', asset: 'RISER-ALPHA' },
    { name: 'JACK-UP LEGS', color: '#00B4D8', target: 'topside', asset: 'PILLAR-FOUNDATION' },
    { name: 'SUBSEA DRILL STRING', color: '#00D2FF', target: 'drill', asset: 'DRILL-SYSTEM' },
    { name: 'DRILL BIT', color: '#FF3300', target: 'drill', asset: 'DRILL-SYSTEM' },
    { name: 'MAIN DECK STRUCTURE', color: '#1976D2', target: 'topside', asset: 'TOPSIDE-DRILL-RIG' },
  ];

  const handleItemClick = (item: (typeof legendItems)[0]) => {
    setSelectedAssetId(item.asset);
    if (
      item.target.startsWith('pipe') ||
      item.target === 'drill' ||
      item.target === 'helipad' ||
      item.target.startsWith('crane') ||
      item.target === 'upper_rig'
    ) {
      openHoloModal(item.target as HolographicComponentType);
    } else {
      setCameraViewMode(item.target as any);
      varunaVoice.speakDiagnostic(item.asset);
    }
  };

  return (
    <div className="hidden md:block font-mono text-xs animate-in fade-in duration-200 shrink-0">
      <div className="w-56 lg:w-64 glass-panel border border-reliance-cyan/40 bg-reliance-deepnavy/92 rounded-2xl p-2.5 shadow-dock backdrop-blur-xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-reliance-cyan/20">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-reliance-cyan uppercase tracking-wider">
            <Palette className="w-3.5 h-3.5 text-reliance-cyan" />
            <span>COLOR-CODE</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 rounded hover:bg-white/10 text-reliance-cyan cursor-pointer transition-all"
          >
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
        </div>

        {/* Legend List */}
        {isExpanded && (
          <div className="space-y-1 text-[9px]">
            {legendItems.map((item) => (
              <div
                key={item.name}
                onClick={() => handleItemClick(item)}
                className="flex items-center justify-between p-1 rounded-lg hover:bg-white/10 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0 border border-white/30 shadow-sm"
                    style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}80` }}
                  />
                  <span className="text-white/90 font-bold group-hover:text-reliance-cyan transition-colors truncate">
                    {item.name}
                  </span>
                </div>
                <Eye className="w-2.5 h-2.5 text-reliance-textMuted opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
