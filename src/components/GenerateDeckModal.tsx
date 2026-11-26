import React, { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Loader2, Wand2, X } from 'lucide-react';
import { Deck, GenerateOutlineSlide, SlideLayout, ThemeId } from '../types/deck';
import { LAYOUT_DEFINITIONS, PRESENTATION_THEMES } from '../constants/themes';

interface GenerateDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeckCreated: (deck: Deck) => void;
}

const SAMPLE_PROMPTS = [
  {
    label: 'Quyosh energetikasi',
    topic: "O'zbekistonda quyosh energetikasi va yashil texnologiyalar rivoji: 2027 strategiyasi",
    audience: 'Executive Leadership',
    tone: 'Executive & Data-Driven',
  },
  {
    label: 'Series B Investor Deck',
    topic: 'Series B investor pitch for an AI-assisted industrial energy optimization platform',
    audience: 'Venture Investors',
    tone: 'Executive & Data-Driven',
  },
  {
    label: 'Q3 Product Roadmap',
    topic: 'Q3 Product Strategy & Engineering Reliability Roadmap for an Enterprise Payments API',
    audience: 'Product & Engineering',
    tone: 'Analytical & Concise',
  },
];

export const GenerateDeckModal: React.FC<GenerateDeckModalProps> = ({
  isOpen,
  onClose,
  onDeckCreated,
}) => {
  const [step, setStep] = useState<'brief' | 'outline'>('brief');
  const [topic, setTopic] = useState('');
  const [sourceNotes, setSourceNotes] = useState('');
  const [audience, setAudience] = useState('Executive Leadership');
  const [tone, setTone] = useState('Analytical & Concise');
  const [slideCount, setSlideCount] = useState(7);
  const [themeId, setThemeId] = useState<ThemeId>('swiss-ivory');

  const [outlineTitle, setOutlineTitle] = useState('');
  const [outlineSubtitle, setOutlineSubtitle] = useState('');
  const [outlineSlides, setOutlineSlides] = useState<GenerateOutlineSlide[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePreviewOutline = async () => {
    if (!topic.trim()) {
      setError('Please enter a presentation topic or objective.');
      return;
    }
    setLoading(true);
    setLoadingLabel('Structuring presentation outline...');
    setError(null);
    try {
      const res = await fetch('/api/decks/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, tone, slideCount, sourceNotes }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate outline.');
      }
      setOutlineTitle(data.deckTitle || topic);
      setOutlineSubtitle(data.deckSubtitle || '');
      setOutlineSlides(Array.isArray(data.slides) ? data.slides : []);
      setStep('outline');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate outline.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDeck = async (useOutline: boolean) => {
    if (!topic.trim()) {
      setError('Please enter a presentation topic or objective.');
      return;
    }
    setLoading(true);
    setLoadingLabel('Creating slides, topic-matched photos, charts, and speaker notes...');
    setError(null);
    try {
      const res = await fetch('/api/decks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          audience,
          tone,
          slideCount: useOutline ? outlineSlides.length : slideCount,
          sourceNotes,
          outline: useOutline ? outlineSlides : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate slide deck.');
      }
      const now = new Date().toISOString();
      const newDeck: Deck = {
        id: `deck-${Date.now()}`,
        title: (useOutline && outlineTitle.trim()) ? outlineTitle.trim() : data.title || topic.trim(),
        subtitle: data.subtitle || outlineSubtitle || undefined,
        themeId,
        slides: data.slides,
        createdAt: now,
        updatedAt: now,
      };
      onDeckCreated(newDeck);
      setStep('brief');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate presentation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[780px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {step === 'brief' ? 'New AI Presentation' : 'Review & Edit Slide Outline'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {step === 'brief'
                ? 'AI writes your slides, creates charts, and finds topic-matched photos automatically.'
                : 'Adjust slide titles or layouts before generating full content.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto studio-scroll p-4 sm:p-6 space-y-5">
          {step === 'brief' ? (
            <>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-slate-800">Presentation Topic or Goal</label>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {SAMPLE_PROMPTS.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => {
                          setTopic(sample.topic);
                          setAudience(sample.audience);
                          setTone(sample.tone);
                        }}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Write in any language (Uzbek, English, Russian)... e.g., Tibbiyotda sun'iy intellekt va diagnostika kelajagi"
                  className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Reference Notes or Key Facts <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={sourceNotes}
                  onChange={(e) => setSourceNotes(e.target.value)}
                  placeholder="Paste metrics, meeting notes, or bulleted points to include..."
                  className="w-full text-sm sm:text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">Audience</label>
                  <select
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="w-full min-h-[42px] text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option>Executive Leadership</option>
                    <option>Venture Investors</option>
                    <option>Product & Engineering</option>
                    <option>Enterprise Customers</option>
                    <option>Students & Academic</option>
                    <option>Sales & Marketing Teams</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">Writing Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full min-h-[42px] text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option>Analytical & Concise</option>
                    <option>Executive & Data-Driven</option>
                    <option>Persuasive & Structured</option>
                    <option>Technical Architecture</option>
                    <option>Editorial Storytelling</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Slide Count ({slideCount})
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={12}
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="w-full h-10 accent-blue-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-2">Visual Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.values(PRESENTATION_THEMES).map((th) => {
                    const active = themeId === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setThemeId(th.id)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-blue-600 ring-2 ring-blue-600/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-4 h-4 rounded-sm border border-slate-300"
                              style={{ backgroundColor: th.bgHex }}
                            />
                            <span
                              className="w-4 h-4 rounded-sm"
                              style={{ backgroundColor: th.accentHex }}
                            />
                          </div>
                          {active && <Check className="w-3.5 h-3.5 text-blue-700" />}
                        </div>
                        <div className="text-xs font-semibold text-slate-900">{th.name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{th.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Deck Title</label>
                <input
                  type="text"
                  value={outlineTitle}
                  onChange={(e) => setOutlineTitle(e.target.value)}
                  className="w-full min-h-[42px] text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2.5">
                {outlineSlides.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-start gap-2.5"
                  >
                    <span className="text-xs font-mono-tabular font-semibold text-slate-500 pt-2 w-6 shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const next = [...outlineSlides];
                            next[idx] = { ...item, title: e.target.value };
                            setOutlineSlides(next);
                          }}
                          className="flex-1 min-h-[38px] text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                        />
                        <select
                          value={item.layout}
                          onChange={(e) => {
                            const next = [...outlineSlides];
                            next[idx] = { ...item, layout: e.target.value as SlideLayout };
                            setOutlineSlides(next);
                          }}
                          className="min-h-[38px] text-xs px-2 py-1.5 rounded border border-slate-200 bg-white"
                        >
                          {LAYOUT_DEFINITIONS.map((def) => (
                            <option key={def.id} value={def.id}>
                              {def.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        value={item.summary}
                        onChange={(e) => {
                          const next = [...outlineSlides];
                          next[idx] = { ...item, summary: e.target.value };
                          setOutlineSlides(next);
                        }}
                        className="w-full min-h-[36px] text-xs px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {step === 'outline' ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => setStep('brief')}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Brief</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !topic.trim()}
              onClick={handlePreviewOutline}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <span>Review Outline First</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {loading && (
              <span className="text-xs text-slate-600 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700 shrink-0" />
                <span className="truncate">{loadingLabel}</span>
              </span>
            )}
            <button
              type="button"
              disabled={loading || !topic.trim()}
              onClick={() => handleGenerateDeck(step === 'outline')}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{step === 'outline' ? 'Generate Full Slides' : 'Generate Presentation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
