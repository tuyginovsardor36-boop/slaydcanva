import React, { useState } from 'react';
import { Loader2, Wand2, X } from 'lucide-react';
import { Slide, SlideLayout } from '../types/deck';
import { LAYOUT_DEFINITIONS } from '../constants/themes';

interface AddAiSlideModalProps {
  isOpen: boolean;
  deckTitle: string;
  existingTitles: string[];
  onClose: () => void;
  onSlideCreated: (slide: Slide) => void;
}

const QUICK_SLIDE_PROMPTS = [
  'Add a KPI metrics summary slide with realistic benchmarks',
  'Add a visual slide with a topic-matched photograph and 3 takeaways',
  'Add a 4-step implementation roadmap slide',
  'Add a two-column strategic comparison slide',
];

export const AddAiSlideModal: React.FC<AddAiSlideModalProps> = ({
  isOpen,
  deckTitle,
  existingTitles,
  onClose,
  onSlideCreated,
}) => {
  const [prompt, setPrompt] = useState('');
  const [preferredLayout, setPreferredLayout] = useState<SlideLayout | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateSlide = async (customPrompt?: string) => {
    const finalPrompt = (customPrompt ?? prompt).trim();
    if (!finalPrompt || loading) {
      setError('Describe what this new slide should cover.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/slides/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          deckTitle,
          existingTitles,
          preferredLayout: preferredLayout || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create slide.');
      }
      if (data.slide) {
        onSlideCreated(data.slide);
        setPrompt('');
        setPreferredLayout('');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate slide.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs sm:p-4">
      <div className="bg-white border border-slate-200 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Add AI Slide</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Describe the slide content and AI will write, structure, and illustrate it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto studio-scroll">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Slide Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Market opportunity and regional adoption forecast with supporting photo..."
              className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Layout Preference <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              value={preferredLayout}
              onChange={(e) => setPreferredLayout(e.target.value as SlideLayout | '')}
              className="w-full min-h-[44px] text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="">Auto-select best layout</option>
              {LAYOUT_DEFINITIONS.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.label} — {def.description}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold text-slate-500">Quick AI Additions</span>
            <div className="grid grid-cols-1 gap-1.5">
              {QUICK_SLIDE_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => handleGenerateSlide(q)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-left text-xs text-slate-700 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !prompt.trim()}
            onClick={() => handleGenerateSlide()}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Slide...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                <span>Generate Slide</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
