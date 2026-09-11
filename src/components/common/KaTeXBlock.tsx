import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface KaTeXBlockProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export const KaTeXBlock: React.FC<KaTeXBlockProps> = ({
  math,
  displayMode = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(math, containerRef.current, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        console.warn('KaTeX render error:', err);
      }
    }
  }, [math, displayMode]);

  return <div ref={containerRef} className={`overflow-x-auto py-1 ${className}`} />;
};
