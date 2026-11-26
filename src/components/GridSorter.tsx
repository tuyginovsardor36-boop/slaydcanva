import React from 'react';
import { ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from 'lucide-react';
import { Slide, ThemeConfig } from '../types/deck';
import { SlideCanvas } from './SlideCanvas';

interface GridSorterProps {
  slides: Slide[];
  activeSlideId: string;
  deckTitle: string;
  theme: ThemeConfig;
  onSelectSlide: (id: string) => void;
  onMoveSlide: (id: string, direction: 'up' | 'down') => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onOpenAddAiSlide: () => void;
}

export const GridSorter: React.FC<GridSorterProps> = ({
  slides,
  activeSlideId,
  deckTitle,
  theme,
  onSelectSlide,
  onMoveSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onOpenAddAiSlide,
}) => {
  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 sm:p-8 bg-[#F4F5F7]">
      <div className="max-w-[1320px] mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Slide Sorter</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Reorder slides or tap any slide to open it in the editor.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddAiSlide}
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add AI Slide</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {slides.map((slide, idx) => {
            const isActive = slide.id === activeSlideId;
            return (
              <div
                key={slide.id}
                className={`group rounded-xl bg-white border p-3 transition-all ${
                  isActive
                    ? 'border-blue-600 ring-2 ring-blue-600/20 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectSlide(slide.id)}
                  className="w-full rounded-lg overflow-hidden border border-slate-200 block text-left cursor-pointer"
                >
                  <div className="pointer-events-none">
                    <SlideCanvas
                      slide={slide}
                      slideIndex={idx}
                      totalSlides={slides.length}
                      deckTitle={deckTitle}
                      theme={theme}
                    />
                  </div>
                </button>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono-tabular font-semibold text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-medium text-slate-800 truncate">{slide.title}</span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onMoveSlide(slide.id, 'up')}
                      disabled={idx === 0}
                      title="Move earlier"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveSlide(slide.id, 'down')}
                      disabled={idx === slides.length - 1}
                      title="Move later"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateSlide(slide.id)}
                      title="Duplicate slide"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSlide(slide.id)}
                      disabled={slides.length <= 1}
                      title="Delete slide"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded hover:bg-red-50 text-slate-500 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
