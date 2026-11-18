import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, X } from 'lucide-react';
import { useRigStore } from '../../store/useRigStore';

/** The project deck (docs/presentation/VARUNA-AI_Governor_Deck.pptx), rendered slide by slide */
const SLIDES = [
  'VARUNA-AI',
  'Why it matters',
  'The problem',
  'Our solution',
  'How it works',
  'Live demo',
  'Real numbers',
  'What it can change for India',
  'Ready for a pilot',
  'Thank you',
  'Sources and image credits',
];
const DECK_FILE = '/deck/VARUNA-AI_Governor_Deck.pptx';

export const PresentationModal: React.FC = () => {
  const isOpen = useRigStore((s) => s.isPresentationOpen);
  const setOpen = useRigStore((s) => s.setPresentationOpen);
  const [slide, setSlide] = useState(0);

  // Arrow keys / space page through the deck, Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setSlide((s) => Math.min(SLIDES.length - 1, s + 1));
      else if (e.key === 'ArrowLeft') setSlide((s) => Math.max(0, s - 1));
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-bg/90 backdrop-blur-md" role="dialog" aria-label="Project presentation">
      <div className="w-full max-w-5xl glass-panel rounded-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-accent-400 shrink-0" />
            <span className="text-sm font-semibold text-ink truncate">Presentation · {SLIDES[slide]}</span>
            <span className="text-xs text-ink-muted shrink-0">
              {slide + 1} / {SLIDES.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href={DECK_FILE} download className="btn" title="Download the PowerPoint file">
              <Download className="w-3.5 h-3.5" />
              Download .pptx
            </a>
            <button onClick={() => setOpen(false)} className="btn btn-icon" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative bg-bg">
          <img
            src={`/deck/slide-${slide + 1}.jpg`}
            alt={`Slide ${slide + 1}: ${SLIDES[slide]}`}
            className="w-full aspect-video object-contain select-none"
            draggable={false}
          />
          <button
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
            className="btn btn-icon absolute left-3 top-1/2 -translate-y-1/2"
            title="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSlide((s) => Math.min(SLIDES.length - 1, s + 1))}
            disabled={slide === SLIDES.length - 1}
            className="btn btn-icon absolute right-3 top-1/2 -translate-y-1/2"
            title="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2 p-3 overflow-x-auto border-t border-line">
          {SLIDES.map((title, i) => (
            <button
              key={title}
              onClick={() => setSlide(i)}
              aria-pressed={i === slide}
              className={`shrink-0 w-28 rounded-md overflow-hidden border transition-colors ${i === slide ? 'border-accent-400' : 'border-line hover:border-line-strong'}`}
              title={title}
            >
              <img src={`/deck/slide-${i + 1}.jpg`} alt="" loading="lazy" className="w-full aspect-video object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
