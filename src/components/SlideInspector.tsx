import React, { useState } from 'react';
import { Check, Image as ImageIcon, Loader2, RefreshCw, Search, Wand2 } from 'lucide-react';
import { Slide, TopicImageCandidate } from '../types/deck';

interface SlideInspectorProps {
  slide: Slide;
  deckTitle: string;
  onChange: (updated: Slide) => void;
  variant?: 'sidebar' | 'mobile';
}

const QUICK_REFINEMENTS = [
  'Make copy shorter & sharper for executives',
  'Convert into 3–4 KPI metrics with deltas',
  'Restructure into 2-column comparison',
  'Turn into a 4-step roadmap',
  'Add a data chart to visualize this point',
  'Switch to a photo-split layout with a topic photo',
];

export const SlideInspector: React.FC<SlideInspectorProps> = ({
  slide,
  deckTitle,
  onChange,
  variant = 'sidebar',
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'photos' | 'notes'>('ai');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [photoQuery, setPhotoQuery] = useState(slide.imageSearchQuery ?? '');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<TopicImageCandidate[]>([]);

  const runAiRefine = async (instructionText: string) => {
    const trimmed = instructionText.trim();
    if (!trimmed || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/slides/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slide,
          instruction: trimmed,
          deckTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refine slide.');
      }
      if (data.slide) {
        onChange(data.slide);
        setAiPrompt('');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to refine slide.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchTopicPhotos = async (customQuery?: string) => {
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const res = await fetch('/api/images/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: (customQuery ?? photoQuery).trim(),
          slideTitle: slide.title,
          deckTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to find matching photos.');
      }
      const images: TopicImageCandidate[] = Array.isArray(data.images) ? data.images : [];
      setCandidates(images);
      if (images.length === 0) {
        setPhotoError('No matching photos found for that phrase. Try broader keywords.');
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Unable to search topic photos.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const applyTopicPhoto = (candidate: TopicImageCandidate) => {
    const targetLayout =
      slide.layout === 'title' || slide.layout === 'visual-split' ? slide.layout : 'visual-split';
    onChange({
      ...slide,
      layout: targetLayout,
      chart: undefined,
      imageUrl: candidate.url,
      imageCaption: candidate.caption,
      imageSearchQuery: candidate.query,
      bullets:
        targetLayout === 'visual-split' && (!slide.bullets || slide.bullets.length === 0)
          ? [slide.subtitle || slide.title]
          : slide.bullets,
    });
  };

  const notesWords = (slide.speakerNotes ?? '').trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.max(Math.round((notesWords / 130) * 60), 0);

  const containerClass =
    variant === 'sidebar'
      ? 'hidden lg:flex w-[316px] shrink-0 bg-white border-l border-slate-200 flex-col h-full'
      : 'flex lg:hidden flex-col bg-white border-t border-slate-200';

  return (
    <aside className={containerClass}>
      {/* Segmented Tabs */}
      <div className="p-2.5 border-b border-slate-200">
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`min-h-[36px] py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Editor
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('photos');
              if (candidates.length === 0 && !photoLoading) {
                handleSearchTopicPhotos();
              }
            }}
            className={`min-h-[36px] py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'photos'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Topic Photos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('notes')}
            className={`min-h-[36px] py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      <div className={`p-4 space-y-4 ${variant === 'sidebar' ? 'flex-1 overflow-y-auto studio-scroll' : ''}`}>
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-800">
                Ask AI to Edit This Slide
              </label>
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Translate to Uzbek, tighten for board review, or turn into a 3-metric comparison..."
                className="w-full text-sm sm:text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 resize-none"
              />
              <button
                type="button"
                disabled={aiLoading || !aiPrompt.trim()}
                onClick={() => runAiRefine(aiPrompt)}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Updating Slide...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Apply AI Edit</span>
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                {aiError}
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <span className="block text-[11px] font-semibold text-slate-500">One-Tap AI Actions</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {QUICK_REFINEMENTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={aiLoading}
                    onClick={() => runAiRefine(preset)}
                    className="w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left text-xs text-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    <span className="truncate">{preset}</span>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-3.5">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Topic-Matched Imagery</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Automatically finds real photographs matching “{slide.title}” and your deck topic.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={photoQuery}
                onChange={(e) => setPhotoQuery(e.target.value)}
                placeholder="Refine topic keywords..."
                className="flex-1 min-w-0 min-h-[42px] text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
              />
              <button
                type="button"
                disabled={photoLoading}
                onClick={() => handleSearchTopicPhotos()}
                className="min-h-[42px] px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {photoLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Find</span>
              </button>
            </div>

            {photoError && (
              <div className="p-2.5 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
                {photoError}
              </div>
            )}

            {photoLoading ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[0, 1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="aspect-4/3 rounded-lg bg-slate-100 animate-pulse border border-slate-200"
                  />
                ))}
              </div>
            ) : candidates.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {candidates.map((cand, idx) => {
                  const selected = slide.imageUrl === cand.url;
                  return (
                    <button
                      key={`${cand.caption}-${idx}`}
                      type="button"
                      onClick={() => applyTopicPhoto(cand)}
                      className={`group relative rounded-lg overflow-hidden border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-blue-600 ring-2 ring-blue-600/25'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="aspect-4/3 bg-slate-100 overflow-hidden">
                        <img
                          src={cand.url}
                          alt={cand.caption}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                      <div className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate bg-white">
                        {cand.caption}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleSearchTopicPhotos()}
                className="w-full min-h-[44px] py-3 px-4 rounded-lg border border-dashed border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span>Search Photos Matching This Topic</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">Speaker Notes</span>
              <span className="text-[11px] font-mono-tabular text-slate-500">
                {notesWords} words · ~{estSeconds}s
              </span>
            </div>
            <textarea
              value={slide.speakerNotes ?? ''}
              onChange={(e) => onChange({ ...slide, speakerNotes: e.target.value })}
              placeholder="AI-generated presenter talking points..."
              className="w-full min-h-[180px] lg:min-h-[280px] text-sm sm:text-xs leading-relaxed p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>
        )}
      </div>
    </aside>
  );
};
