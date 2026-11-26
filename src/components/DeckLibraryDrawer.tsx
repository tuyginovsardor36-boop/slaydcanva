import React from 'react';
import { Copy, FolderOpen, Trash2, Upload, Wand2, X } from 'lucide-react';
import { Deck } from '../types/deck';
import { PRESENTATION_THEMES } from '../constants/themes';

interface DeckLibraryDrawerProps {
  isOpen: boolean;
  decks: Deck[];
  activeDeckId: string;
  onClose: () => void;
  onSelectDeck: (id: string) => void;
  onOpenGenerateAiDeck: () => void;
  onDuplicateDeck: (id: string) => void;
  onDeleteDeck: (id: string) => void;
  onImportJson: (deck: Deck) => void;
}

export const DeckLibraryDrawer: React.FC<DeckLibraryDrawerProps> = ({
  isOpen,
  decks,
  activeDeckId,
  onClose,
  onSelectDeck,
  onOpenGenerateAiDeck,
  onDuplicateDeck,
  onDeleteDeck,
  onImportJson,
}) => {
  if (!isOpen) return null;

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          const imported: Deck = {
            ...parsed,
            id: `deck-${Date.now()}`,
            updatedAt: new Date().toISOString(),
          };
          onImportJson(imported);
          onClose();
        }
      } catch {
        // Ignore invalid JSON file
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-900/35" onClick={onClose} />
      <div className="relative z-10 w-[360px] max-w-[92vw] bg-white border-r border-slate-200 h-full flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Deck Library</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenGenerateAiDeck();
            }}
            className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>New AI Presentation</span>
          </button>
          <label className="min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
            <input type="file" accept="application/json" onChange={handleFileImport} className="hidden" />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto studio-scroll p-4 space-y-2.5">
          {decks.map((deck) => {
            const active = deck.id === activeDeckId;
            const th = PRESENTATION_THEMES[deck.themeId] ?? PRESENTATION_THEMES['swiss-ivory'];
            const updated = new Date(deck.updatedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            });
            return (
              <div
                key={deck.id}
                className={`p-3 rounded-lg border transition-colors ${
                  active ? 'border-blue-600 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDeck(deck.id);
                      onClose();
                    }}
                    className="flex-1 text-left min-w-0 min-h-[40px] cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-slate-900 truncate">{deck.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono-tabular">{deck.slides.length} slides</span>
                      <span aria-hidden="true">·</span>
                      <span>{th.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{updated}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDuplicateDeck(deck.id)}
                      title="Duplicate deck"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDeck(deck.id)}
                      disabled={decks.length <= 1}
                      title="Delete deck"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 cursor-pointer"
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
