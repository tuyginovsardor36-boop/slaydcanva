import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Table,
  Underline,
  X,
  Layers,
} from 'lucide-react';
import { ELEMENT_COLORS, FONT_OPTIONS } from '../data/defaults';
import { WordDocumentData, WorkspaceMode } from '../types/editor';

interface WordWorkspaceProps {
  doc: WordDocumentData;
  onChange: (next: WordDocumentData) => void;
  paperRef: React.RefObject<HTMLDivElement | null>;
  onModeChange?: (mode: WorkspaceMode) => void;
  mobileSheetOpen?: boolean;
  onOpenMobileSheet?: () => void;
  onCloseMobileSheet?: () => void;
}

interface OutlineItem {
  id: string;
  level: string;
  text: string;
}

export const WordWorkspace: React.FC<WordWorkspaceProps> = ({
  doc,
  onChange,
  paperRef,
  onModeChange,
  mobileSheetOpen = false,
  onOpenMobileSheet,
  onCloseMobileSheet,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showColorMenu, setShowColorMenu] = useState(false);

  // Sync incoming reset/external HTML changes only if DOM differs significantly on mount/reset
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== doc.html) {
      el.innerHTML = doc.html;
    }
  }, [doc.html]);

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange({
      ...doc,
      html: editorRef.current.innerHTML,
    });
  };

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const insertTable = () => {
    editorRef.current?.focus();
    const tableHtml = `
      <table>
        <thead>
          <tr><th>Sarlavha 1</th><th>Sarlavha 2</th><th>Sarlavha 3</th></tr>
        </thead>
        <tbody>
          <tr><td>Ma'lumot</td><td>Ma'lumot</td><td>Ma'lumot</td></tr>
          <tr><td>Ma'lumot</td><td>Ma'lumot</td><td>Ma'lumot</td></tr>
        </tbody>
      </table><p><br/></p>`;
    document.execCommand('insertHTML', false, tableHtml);
    handleInput();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${reader.result as string}" alt="Rasm" /><p><br/></p>`
      );
      handleInput();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Live document outline & stats
  const { outline, words, chars } = useMemo(() => {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<div>${doc.html}</div>`, 'text/html');
    const headings = Array.from(parsed.querySelectorAll('h1, h2, h3'));
    const outlineItems: OutlineItem[] = headings
      .map((h, i) => ({
        id: `heading-${i}`,
        level: h.tagName.toLowerCase(),
        text: (h.textContent || '').trim(),
      }))
      .filter((item) => item.text.length > 0);

    const plainText = (parsed.body.textContent || '').trim();
    const wordCount = plainText ? plainText.split(/\s+/).length : 0;
    const charCount = plainText.length;

    return { outline: outlineItems, words: wordCount, chars: charCount };
  }, [doc.html]);

  const scrollToHeading = (index: number) => {
    const el = editorRef.current;
    if (!el) return;
    const headings = el.querySelectorAll('h1, h2, h3');
    const target = headings[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const paddingStyle =
    doc.marginPreset === 'gost_academic'
      ? { top: 48, right: 48, bottom: 48, left: 72 }
      : doc.marginPreset === 'narrow'
        ? { top: 40, right: 40, bottom: 40, left: 40 }
        : doc.marginPreset === 'wide'
          ? { top: 84, right: 84, bottom: 84, left: 84 }
          : { top: 64, right: 64, bottom: 64, left: 64 };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Word Formatting Toolbar */}
      <div className="h-[46px] shrink-0 bg-white border-b border-slate-200 px-3 md:px-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {onModeChange && (
            <select
              aria-label="Muhit"
              value="word"
              onChange={(e) => onModeChange(e.target.value as WorkspaceMode)}
              className="md:hidden text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 outline-none"
            >
              <option value="pptx">PPTX</option>
              <option value="word">Word</option>
              <option value="pdf">PDF</option>
            </select>
          )}
          {onOpenMobileSheet && (
            <button
              type="button"
              onClick={onOpenMobileSheet}
              className="md:hidden flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-full whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tuzilma</span>
            </button>
          )}
          {/* Block format */}
          <select
            aria-label="Matn uslubi"
            defaultValue="p"
            onChange={(e) => exec('formatBlock', `<${e.target.value}>`)}
            className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-red-500"
          >
            <option value="p">Oddiy matn</option>
            <option value="h1">Sarlavha 1</option>
            <option value="h2">Sarlavha 2</option>
            <option value="h3">Sarlavha 3</option>
          </select>

          {/* Font family & base size */}
          <select
            aria-label="Shrift"
            value={doc.fontFamily}
            onChange={(e) => onChange({ ...doc, fontFamily: e.target.value })}
            className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-red-500"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Matn o'lchami"
            value={doc.fontSize}
            onChange={(e) => onChange({ ...doc, fontSize: Number(e.target.value) })}
            className="text-xs font-mono tabular-nums text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-red-500"
          >
            {[13, 14, 15, 16, 18].map((sz) => (
              <option key={sz} value={sz}>
                {sz}px
              </option>
            ))}
          </select>

          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => exec('bold')}
            title="Qalin (Ctrl+B)"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('italic')}
            title="Kursiv (Ctrl+I)"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('underline')}
            title="Tagiga chizish (Ctrl+U)"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorMenu((v) => !v)}
              title="Matn rangi"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
            >
              <span className="font-display font-bold underline decoration-red-600 decoration-2">
                A
              </span>
            </button>
            {showColorMenu && (
              <div className="absolute left-0 top-9 bg-white border border-slate-200 rounded-lg shadow-md p-2 flex items-center gap-1.5 z-30">
                {ELEMENT_COLORS.slice(0, 8).map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      exec('foreColor', hex);
                      setShowColorMenu(false);
                    }}
                    className="w-5 h-5 rounded-sm border border-slate-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: hex }}
                    aria-label={`Matn rangi ${hex}`}
                  />
                ))}
              </div>
            )}
          </div>

          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => exec('justifyLeft')}
            title="Chapga tekislash"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyCenter')}
            title="Markazga tekislash"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <AlignCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyRight')}
            title="O'ngga tekislash"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('justifyFull')}
            title="Kenglik bo'yicha tekislash"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <AlignJustify className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={() => exec('insertUnorderedList')}
            title="Nuqtali ro'yxat"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => exec('insertOrderedList')}
            title="Raqamli ro'yxat"
            className="p-1.5 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          <button
            type="button"
            onClick={insertTable}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap"
          >
            <Table className="w-3.5 h-3.5 text-slate-600" />
            <span>Jadval</span>
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap"
          >
            <ImagePlus className="w-3.5 h-3.5 text-slate-600" />
            <span>Rasm</span>
          </button>
          <button
            type="button"
            onClick={() => exec('insertHorizontalRule')}
            title="Ajratuvchi chiziq"
            className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap"
          >
            <Minus className="w-3.5 h-3.5 text-slate-600" />
            <span>Chiziq</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Main Word Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Outline & Page Settings Rail (Desktop) */}
        <aside className="hidden md:flex w-[224px] shrink-0 bg-white border-r border-slate-200 flex-col justify-between min-h-0">
          <div className="flex-1 overflow-y-auto p-3.5">
            <h2 className="text-xs font-semibold text-slate-700 mb-2.5">
              Hujjat tuzilmasi
            </h2>
            {outline.length === 0 ? (
              <p className="text-xs text-slate-400 leading-relaxed">
                Sarlavhalar (H1, H2, H3) qo'shilganda mundarija shu yerda ko'rinadi.
              </p>
            ) : (
              <ul className="space-y-1">
                {outline.map((item, idx) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToHeading(idx)}
                      className={`w-full text-left text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md px-2 py-1.5 truncate transition-colors ${
                        item.level === 'h1'
                          ? 'font-semibold text-slate-800'
                          : item.level === 'h2'
                            ? 'pl-4'
                            : 'pl-6 text-slate-500'
                      }`}
                    >
                      {item.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Paper Margins & Word Count */}
          <div className="border-t border-slate-200 p-3.5 space-y-3">
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1.5">
                Chetki hoshiya
              </div>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-md">
                {(
                  [
                    { key: 'gost_academic', label: "O'zDST (3×2)" },
                    { key: 'normal', label: 'Oddiy' },
                    { key: 'narrow', label: 'Tor' },
                    { key: 'wide', label: 'Keng' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => onChange({ ...doc, marginPreset: m.key })}
                    className={`py-1 text-[11px] font-medium rounded-xs transition-colors ${
                      doc.marginPreset === m.key
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>So'zlar</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {words}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Belgilar</span>
              <span className="font-mono tabular-nums text-slate-800 font-medium">
                {chars}
              </span>
            </div>
          </div>
        </aside>

        {/* Center A4 Paper Sheet */}
        <main className="flex-1 overflow-y-auto bg-[#F1F3F5] py-4 px-3 md:py-8 md:px-6 flex justify-center items-start">
          <div
            ref={paperRef}
            className="w-full max-w-[794px] md:w-[794px] min-h-[760px] md:min-h-[1123px] bg-white border border-slate-200/90 shadow-sm shrink-0 p-5 md:pt-(--word-pt) md:pr-(--word-pr) md:pb-(--word-pb) md:pl-(--word-pl)"
            style={
              {
                '--word-pt': `${paddingStyle.top}px`,
                '--word-pr': `${paddingStyle.right}px`,
                '--word-pb': `${paddingStyle.bottom}px`,
                '--word-pl': `${paddingStyle.left}px`,
                fontFamily: doc.fontFamily,
                fontSize: `${doc.fontSize}px`,
              } as React.CSSProperties
            }
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              className="word-editor-content min-h-[680px] md:min-h-[960px]"
            />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Sheet for Word Outline & Settings */}
      {mobileSheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] flex items-end"
          onClick={onCloseMobileSheet}
        >
          <div
            className="w-full bg-white rounded-t-3xl max-h-[75vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 mb-1" />
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                Hujjat tuzilmasi
              </span>
              <button
                type="button"
                onClick={onCloseMobileSheet}
                aria-label="Yopish"
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {outline.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Sarlavhalar (H1, H2, H3) qo'shilganda mundarija shu yerda ko'rinadi.
                </p>
              ) : (
                <ul className="space-y-1">
                  {outline.map((item, idx) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          scrollToHeading(idx);
                          onCloseMobileSheet?.();
                        }}
                        className={`w-full text-left text-sm text-slate-700 hover:bg-slate-100 rounded-lg px-3 py-2 truncate ${
                          item.level === 'h1'
                            ? 'font-semibold text-slate-900'
                            : item.level === 'h2'
                              ? 'pl-5'
                              : 'pl-7 text-slate-500'
                        }`}
                      >
                        {item.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="text-xs font-medium text-slate-700">Chetki hoshiya</div>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                  {(
                    [
                      { key: 'gost_academic', label: "O'zDST (3×2 sm)" },
                      { key: 'normal', label: 'Oddiy' },
                      { key: 'narrow', label: 'Tor' },
                      { key: 'wide', label: 'Keng' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => onChange({ ...doc, marginPreset: m.key })}
                      className={`py-2 text-xs font-medium rounded-lg transition-colors ${
                        doc.marginPreset === m.key
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span>So'zlar: <strong className="font-mono tabular-nums text-slate-900">{words}</strong></span>
                  <span>Belgilar: <strong className="font-mono tabular-nums text-slate-900">{chars}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
