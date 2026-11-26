import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Maximize2, X } from 'lucide-react';
import { Deck, ThemeConfig } from '../types/deck';
import { SlideCanvas } from './SlideCanvas';

interface PresenterModeProps {
  deck: Deck;
  theme: ThemeConfig;
  initialIndex: number;
  onClose: () => void;
}

export const PresenterMode: React.FC<PresenterModeProps> = ({
  deck,
  theme,
  initialIndex,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [showNotes, setShowNotes] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setIndex((i) => Math.min(i + 1, deck.slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key.toLowerCase() === 'n') {
        setShowNotes((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deck.slides.length, onClose]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen restrictions inside embedded iframes
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 45) {
      if (delta < 0) {
        setIndex((i) => Math.min(i + 1, deck.slides.length - 1));
      } else {
        setIndex((i) => Math.max(i - 1, 0));
      }
    }
  };

  const currentSlide = deck.slides[index];
  const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
  const secs = String(elapsedSeconds % 60).padStart(2, '0');
  const progress = ((index + 1) / deck.slides.length) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
      {/* Top Progress Bar */}
      <div className="h-1 bg-slate-800 w-full shrink-0">
        <div
          className="h-full bg-blue-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main Stage (supports touch swipe on mobile) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex flex-col lg:flex-row items-center justify-center p-3 sm:p-6 md:p-10 min-h-0 gap-4 lg:gap-6 overflow-hidden"
      >
        <div className="flex-1 w-full h-full flex items-center justify-center min-w-0">
          <div className="w-full max-w-[1160px] rounded-xl overflow-hidden shadow-2xl border border-slate-800">
            {currentSlide && (
              <SlideCanvas
                slide={currentSlide}
                slideIndex={index}
                totalSlides={deck.slides.length}
                deckTitle={deck.title}
                theme={theme}
              />
            )}
          </div>
        </div>

        {showNotes && currentSlide && (
          <div className="w-full lg:w-[340px] max-h-[34vh] lg:max-h-[620px] lg:h-full bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col shrink-0">
            <div className="text-xs font-semibold text-slate-300 pb-2.5 border-b border-slate-800 flex items-center justify-between">
              <span>Speaker Notes</span>
              <span className="font-mono-tabular text-slate-400">
                Slide {index + 1} / {deck.slides.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto pt-3 text-xs sm:text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
              {currentSlide.speakerNotes?.trim() || 'No speaker notes for this slide.'}
            </div>
          </div>
        )}
      </div>

      {/* Presenter Controls Bar */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-400 min-w-0">
          <span className="hidden sm:inline font-medium text-slate-200 truncate max-w-[240px]">
            {deck.title}
          </span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="font-mono-tabular text-slate-200">
            {String(index + 1).padStart(2, '0')} / {String(deck.slides.length).padStart(2, '0')}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            {mins}:{secs}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
            title="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(i + 1, deck.slides.length - 1))}
            disabled={index === deck.slides.length - 1}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-200 cursor-pointer"
            title="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-800 mx-0.5 sm:mx-1" />
          <button
            type="button"
            onClick={() => setShowNotes((prev) => !prev)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              showNotes ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
