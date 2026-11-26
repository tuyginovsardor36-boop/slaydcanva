import React from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Slide, ThemeConfig } from '../types/deck';
import { SlideCanvas } from './SlideCanvas';

interface SlideThumbnailsProps {
  slides: Slide[];
  activeSlideId: string;
  deckTitle: string;
  theme: ThemeConfig;
  onSelect: (id: string) => void;
  onOpenAddAiSlide: () => void;
  onDuplicateSlide: (id: string) => void;
  onDeleteSlide: (id: string) => void;
  onMoveSlide: (id: string, direction: 'up' | 'down') => void;
}

export const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  activeSlideId,
  deckTitle,
  theme,
  onSelect,
  onOpenAddAiSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
}) => {
  return (
    <>
      {/* Desktop Left Filmstrip Rail */}
      <aside className="hidden lg:flex w-[236px] shrink-0 bg-white border-r border-slate-200 flex-col h-full">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 tracking-tight">Slides</span>
          <span className="text-xs font-mono-tabular text-slate-500">{slides.length} total</span>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-3">
          {slides.map((slide, idx) => {
            const isActive = slide.id === activeSlideId;
            return (
              <div
                key={slide.id}
                className={`group relative rounded-lg p-1.5 transition-colors ${
                  isActive ? 'bg-blue-50/70 ring-2 ring-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`text-[11px] font-mono-tabular pt-0.5 w-5 shrink-0 text-right ${
                      isActive ? 'text-blue-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <button
                    type="button"
                    onClick={() => onSelect(slide.id)}
                    className="flex-1 text-left rounded-md overflow-hidden border border-slate-200 shadow-xs focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
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
                </div>

                <div className="mt-1.5 pl-7 flex items-center justify-between opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <span className="text-[11px] text-slate-500 truncate max-w-[85px] capitalize">
                    {slide.layout.replace('-', ' ')}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onMoveSlide(slide.id, 'up')}
                      disabled={idx === 0}
                      title="Move up"
                      className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveSlide(slide.id, 'down')}
                      disabled={idx === slides.length - 1}
                      title="Move down"
                      className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateSlide(slide.id)}
                      title="Duplicate slide"
                      className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSlide(slide.id)}
                      disabled={slides.length <= 1}
                      title="Delete slide"
                      className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={onOpenAddAiSlide}
            className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add AI Slide</span>
          </button>
        </div>
      </aside>

      {/* Mobile & Tablet Horizontal Filmstrip */}
      <div className="flex lg:hidden items-center gap-2.5 px-3 py-2.5 bg-white border-y border-slate-200 overflow-x-auto studio-scroll shrink-0">
        {slides.map((slide, idx) => {
          const isActive = slide.id === activeSlideId;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
              className={`relative shrink-0 w-[108px] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                isActive
                  ? 'border-blue-600 ring-2 ring-blue-600/30'
                  : 'border-slate-200 opacity-85'
              }`}
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
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[10px] font-mono-tabular">
                {String(idx + 1).padStart(2, '0')}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenAddAiSlide}
          className="shrink-0 h-[61px] min-w-[76px] px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-700 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-blue-700" />
          <span>AI Slide</span>
        </button>
      </div>
    </>
  );
};
