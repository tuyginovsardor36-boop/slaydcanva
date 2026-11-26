import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Circle,
  Copy,
  ImagePlus,
  Italic,
  Minus,
  Palette,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Underline,
  Undo2,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  ELEMENT_COLORS,
  FONT_OPTIONS,
  getPdfDimensions,
  PAGE_COLORS,
  PPTX_CANVAS,
  uid,
} from '../data/defaults';
import { CanvasElement, CanvasPage, PdfOrientation, WorkspaceMode } from '../types/editor';
import { AiCanvasDrawModal } from './AiCanvasDrawModal';

interface CanvasWorkspaceProps {
  kind: 'pptx' | 'pdf';
  onModeChange?: (mode: WorkspaceMode) => void;
  pages: CanvasPage[];
  activePageId: string;
  orientation?: PdfOrientation;
  onOrientationChange?: (orientation: PdfOrientation) => void;
  onSelectPage: (id: string) => void;
  onUpdatePages: (
    pages: CanvasPage[],
    nextActiveId?: string,
    options?: { skipHistory?: boolean; historyBase?: CanvasPage[] }
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  mobileSheetOpen?: boolean;
  onOpenMobileSheet?: () => void;
  onCloseMobileSheet?: () => void;
}

type DragState =
  | {
      mode: 'move';
      elementId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      preDragPages: CanvasPage[];
      didDrag: boolean;
    }
  | {
      mode: 'resize';
      handle: 'nw' | 'ne' | 'sw' | 'se';
      elementId: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
      preDragPages: CanvasPage[];
      didDrag: boolean;
    };

function formatCanvasText(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if ('title' in obj || 'author' in obj || 'publisher' in obj || 'year' in obj) {
      const parts = [
        typeof obj.author === 'string' ? obj.author.trim() : '',
        typeof obj.title === 'string' ? obj.title.trim() : '',
        typeof obj.publisher === 'string' ? obj.publisher.trim() : '',
        obj.year ? String(obj.year).trim() : '',
      ].filter(Boolean);
      if (parts.length > 0) return parts.join('. ');
    }
    return Object.values(obj)
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(' — ');
  }
  return '';
}

const ScaledThumb: React.FC<{
  page: CanvasPage;
  dims: { width: number; height: number };
  fallbackWidth: number;
}> = ({ page, dims, fallbackWidth }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(fallbackWidth);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const nextW = el.clientWidth;
      if (nextW > 0) setWidth(nextW);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const scale = width / dims.width;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: `${dims.width} / ${dims.height}`,
        backgroundColor: page.background,
      }}
    >
      <div
        style={{
          width: dims.width,
          height: dims.height,
          backgroundColor: page.background,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      >
        {page.backgroundImage && (
          <img
            src={page.backgroundImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        )}
        {page.elements.map((el) => (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.width,
              height: el.height,
            }}
          >
            {el.type === 'text' && (
              <div
                style={{
                  fontFamily: el.fontFamily,
                  fontSize: el.fontSize,
                  fontWeight: el.fontWeight,
                  fontStyle: el.fontStyle,
                  textDecoration: el.textDecoration,
                  textAlign: el.textAlign,
                  color: el.color,
                  whiteSpace: 'pre-wrap',
                  lineHeight: el.lineHeight || 1.35,
                  padding: el.padding !== undefined ? `${el.padding}px ${el.padding + 2}px` : '4px 6px',
                }}
              >
                {el.text ? formatCanvasText(el.text) : ''}
              </div>
            )}
            {el.type === 'rect' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: el.gradient || el.fill,
                  borderRadius: el.borderRadius,
                  boxShadow: el.shadow ? '0 4px 14px rgba(15, 23, 42, 0.08)' : undefined,
                  border:
                    el.stroke && el.stroke !== 'transparent'
                      ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                      : undefined,
                }}
              />
            )}
            {el.type === 'circle' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: el.gradient || el.fill,
                  borderRadius: '9999px',
                  boxShadow: el.shadow ? '0 4px 12px rgba(15, 23, 42, 0.1)' : undefined,
                  border:
                    el.stroke && el.stroke !== 'transparent'
                      ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                      : undefined,
                }}
              />
            )}
            {el.type === 'image' && el.src && (
              <img
                src={el.src}
                alt=""
                className={`w-full h-full ${el.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                style={{
                  borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                  boxShadow: el.shadow ? '0 8px 20px rgba(15, 23, 42, 0.14)' : undefined,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  kind,
  onModeChange,
  pages,
  activePageId,
  orientation = 'portrait',
  onOrientationChange,
  onSelectPage,
  onUpdatePages,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  mobileSheetOpen = false,
  onOpenMobileSheet,
  onCloseMobileSheet,
}) => {
  const dims = kind === 'pptx' ? PPTX_CANVAS : getPdfDimensions(orientation);
  const activePage = pages.find((p) => p.id === activePageId) || pages[0];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(kind === 'pptx' ? 0.85 : 0.65);
  const [showBgPalette, setShowBgPalette] = useState(false);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showAiDrawModal, setShowAiDrawModal] = useState(false);

  const dragRef = useRef<DragState | null>(null);
  const livePagesRef = useRef<CanvasPage[]>(pages);
  livePagesRef.current = pages;
  const onUpdatePagesRef = useRef(onUpdatePages);
  onUpdatePagesRef.current = onUpdatePages;

  const imageInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Reset zoom gracefully when switching between PPTX and PDF or changing orientation
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) {
      setZoom(kind === 'pptx' ? 0.85 : 0.62);
      return;
    }
    const availW = el.clientWidth - 72;
    const availH = el.clientHeight - 72;
    const fit = Math.min(availW / dims.width, availH / dims.height, 1.05);
    setZoom(Math.max(0.35, Math.round(fit * 20) / 20));
    setSelectedId(null);
    setEditingTextId(null);
  }, [kind, orientation, dims.width, dims.height]);

  // Deselect if active page changes
  useEffect(() => {
    setSelectedId(null);
    setEditingTextId(null);
    setShowBgPalette(false);
    setShowColorPalette(false);
  }, [activePageId]);

  const selectedElement =
    activePage?.elements.find((el) => el.id === selectedId) || null;

  const updateActivePage = (updater: (page: CanvasPage) => CanvasPage) => {
    const next = pages.map((p) => (p.id === activePage.id ? updater(p) : p));
    onUpdatePages(next);
  };

  const updateSelectedElement = (patch: Partial<CanvasElement>) => {
    if (!selectedId) return;
    updateActivePage((page) => ({
      ...page,
      elements: page.elements.map((el) =>
        el.id === selectedId ? { ...el, ...patch } : el
      ),
    }));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) {
        if (e.key === 'Escape') {
          setEditingTextId(null);
        }
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        updateActivePage((page) => ({
          ...page,
          elements: page.elements.filter((el) => el.id !== selectedId),
        }));
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Mouse & Touch drag / resize handlers
  useEffect(() => {
    const applyDragMove = (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const rawDx = clientX - drag.startX;
      const rawDy = clientY - drag.startY;
      if (Math.abs(rawDx) < 2 && Math.abs(rawDy) < 2 && !drag.didDrag) {
        return;
      }
      drag.didDrag = true;

      const dx = rawDx / zoom;
      const dy = rawDy / zoom;

      const currentPages = livePagesRef.current;
      const nextPages = currentPages.map((p) => {
        if (p.id !== activePage.id) return p;
        return {
          ...p,
          elements: p.elements.map((el) => {
            if (el.id !== drag.elementId) return el;
            if (drag.mode === 'move') {
              return {
                ...el,
                x: Math.round(drag.origX + dx),
                y: Math.round(drag.origY + dy),
              };
            }
            // Resize
            let x = drag.origX;
            let y = drag.origY;
            let w = drag.origW;
            let h = drag.origH;
            const minSize = 24;

            if (drag.handle.includes('e')) {
              w = Math.max(minSize, Math.round(drag.origW + dx));
            }
            if (drag.handle.includes('s')) {
              h = Math.max(minSize, Math.round(drag.origH + dy));
            }
            if (drag.handle.includes('w')) {
              const newW = Math.max(minSize, Math.round(drag.origW - dx));
              x = Math.round(drag.origX + (drag.origW - newW));
              w = newW;
            }
            if (drag.handle.includes('n')) {
              const newH = Math.max(minSize, Math.round(drag.origH - dy));
              y = Math.round(drag.origY + (drag.origH - newH));
              h = newH;
            }
            return { ...el, x, y, width: w, height: h };
          }),
        };
      });

      onUpdatePagesRef.current(nextPages, undefined, { skipHistory: true });
    };

    const handleMouseMove = (e: MouseEvent) => applyDragMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (!dragRef.current || e.touches.length === 0) return;
      e.preventDefault();
      applyDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleDragEnd = () => {
      const drag = dragRef.current;
      if (drag && drag.didDrag) {
        onUpdatePagesRef.current(livePagesRef.current, undefined, {
          historyBase: drag.preDragPages,
        });
      }
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [zoom, activePage.id]);

  const addTextElement = () => {
    const newEl: CanvasElement = {
      id: uid('txt'),
      type: 'text',
      x: Math.round(dims.width * 0.12),
      y: Math.round(dims.height * 0.25),
      width: 360,
      height: 80,
      text: 'Yangi matn',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 22,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      textAlign: 'left',
      color: '#0F172A',
    };
    updateActivePage((p) => ({ ...p, elements: [...p.elements, newEl] }));
    setSelectedId(newEl.id);
    setEditingTextId(newEl.id);
  };

  const addShapeElement = (shape: 'rect' | 'circle') => {
    const newEl: CanvasElement = {
      id: uid(shape),
      type: shape,
      x: Math.round(dims.width / 2 - 90),
      y: Math.round(dims.height / 2 - 60),
      width: shape === 'circle' ? 140 : 200,
      height: shape === 'circle' ? 140 : 120,
      fill: shape === 'circle' ? '#DBEAFE' : '#F1F5F9',
      stroke: shape === 'circle' ? '#2563EB' : '#CBD5E1',
      strokeWidth: 1,
      borderRadius: shape === 'rect' ? 8 : 0,
    };
    updateActivePage((p) => ({ ...p, elements: [...p.elements, newEl] }));
    setSelectedId(newEl.id);
    setEditingTextId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = dims.width * 0.5;
        const maxH = dims.height * 0.5;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = Math.max(80, Math.round(img.width * scale));
        const h = Math.max(80, Math.round(img.height * scale));
        const newEl: CanvasElement = {
          id: uid('img'),
          type: 'image',
          x: Math.round((dims.width - w) / 2),
          y: Math.round((dims.height - h) / 2),
          width: w,
          height: h,
          src: dataUrl,
        };
        updateActivePage((p) => ({ ...p, elements: [...p.elements, newEl] }));
        setSelectedId(newEl.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const moveLayer = (dir: 'up' | 'down') => {
    if (!selectedId) return;
    updateActivePage((p) => {
      const idx = p.elements.findIndex((el) => el.id === selectedId);
      if (idx === -1) return p;
      const next = [...p.elements];
      if (dir === 'up' && idx < next.length - 1) {
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      } else if (dir === 'down' && idx > 0) {
        [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      }
      return { ...p, elements: next };
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateActivePage((p) => ({
      ...p,
      elements: p.elements.filter((el) => el.id !== selectedId),
    }));
    setSelectedId(null);
    setEditingTextId(null);
  };

  // Page management
  const addPage = () => {
    const newPage: CanvasPage = {
      id: uid(kind === 'pptx' ? 'slide' : 'pdf'),
      background: '#FFFFFF',
      elements: [
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 64,
          width: dims.width - 128,
          height: 64,
          text: kind === 'pptx' ? 'Slayd sarlavhasi' : 'Sahifa sarlavhasi',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 32,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#0F172A',
        },
      ],
    };
    onUpdatePages([...pages, newPage], newPage.id);
  };

  const duplicatePage = (page: CanvasPage) => {
    const copy: CanvasPage = {
      ...page,
      id: uid(kind === 'pptx' ? 'slide' : 'pdf'),
      elements: page.elements.map((el) => ({ ...el, id: uid(el.type) })),
    };
    const idx = pages.findIndex((p) => p.id === page.id);
    const next = [...pages];
    next.splice(idx + 1, 0, copy);
    onUpdatePages(next, copy.id);
  };

  const deletePage = (id: string) => {
    if (pages.length <= 1) return;
    const idx = pages.findIndex((p) => p.id === id);
    const next = pages.filter((p) => p.id !== id);
    const nextActive = id === activePage.id ? next[Math.max(0, idx - 1)].id : activePage.id;
    onUpdatePages(next, nextActive);
  };

  const movePageOrder = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[idx], next[target]] = [next[target], next[idx]];
    onUpdatePages(next);
  };

  const fitZoom = () => {
    const el = viewportRef.current;
    if (!el) return;
    const availW = el.clientWidth - 72;
    const availH = el.clientHeight - 72;
    const fit = Math.min(availW / dims.width, availH / dims.height, 1.05);
    setZoom(Math.max(0.35, Math.round(fit * 20) / 20));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Contextual Toolbar */}
      <div className="h-[46px] shrink-0 bg-white border-b border-slate-200 px-3 md:px-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Format Switcher & Pages Drawer Button */}
          {onModeChange && (
            <select
              aria-label="Muhit"
              value={kind}
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
              <span className="font-mono tabular-nums">{pages.length}</span>
            </button>
          )}

          {/* Undo / Redo */}
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Bekor qilish (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Qaytarish"
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-35 transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

          {/* Insert Actions */}
          <button
            type="button"
            onClick={addTextElement}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
          >
            <Type className="w-3.5 h-3.5 text-red-600" />
            <span>Matn</span>
          </button>
          <button
            type="button"
            onClick={() => addShapeElement('rect')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
          >
            <Square className="w-3.5 h-3.5 text-slate-600" />
            <span>To'rtburchak</span>
          </button>
          <button
            type="button"
            onClick={() => addShapeElement('circle')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
          >
            <Circle className="w-3.5 h-3.5 text-slate-600" />
            <span>Doira</span>
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
          >
            <ImagePlus className="w-3.5 h-3.5 text-slate-600" />
            <span>Rasm</span>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {kind === 'pptx' && (
            <button
              type="button"
              onClick={() => setShowAiDrawModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200/80 rounded-md transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>AI Dizayn</span>
            </button>
          )}

          {/* Selection Formatting */}
          {selectedElement && (
            <>
              <span className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

              {selectedElement.type === 'text' && (
                <>
                  <select
                    aria-label="Shrift"
                    value={selectedElement.fontFamily || 'DM Sans, sans-serif'}
                    onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
                    className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-red-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="O'lcham"
                    value={selectedElement.fontSize || 18}
                    onChange={(e) =>
                      updateSelectedElement({ fontSize: Number(e.target.value) })
                    }
                    className="text-xs font-mono tabular-nums text-slate-700 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-red-500"
                  >
                    {[12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 54, 64].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedElement({
                        fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold',
                      })
                    }
                    title="Qalin"
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedElement.fontWeight === 'bold'
                        ? 'bg-red-50 text-red-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedElement({
                        fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic',
                      })
                    }
                    title="Kursiv"
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedElement.fontStyle === 'italic'
                        ? 'bg-red-50 text-red-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSelectedElement({
                        textDecoration:
                          selectedElement.textDecoration === 'underline' ? 'none' : 'underline',
                      })
                    }
                    title="Tagiga chizish"
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedElement.textDecoration === 'underline'
                        ? 'bg-red-50 text-red-700'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>

                  <span className="h-4 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

                  <button
                    type="button"
                    onClick={() => updateSelectedElement({ textAlign: 'left' })}
                    title="Chapga"
                    className={`p-1.5 rounded-md transition-colors ${
                      (selectedElement.textAlign || 'left') === 'left'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedElement({ textAlign: 'center' })}
                    title="Markazga"
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedElement.textAlign === 'center'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSelectedElement({ textAlign: 'right' })}
                    title="O'ngga"
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedElement.textAlign === 'right'
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {(selectedElement.type === 'text' ||
                selectedElement.type === 'rect' ||
                selectedElement.type === 'circle') && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColorPalette((v) => !v);
                      setShowBgPalette(false);
                    }}
                    title="Rang"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-xs border border-slate-300"
                      style={{
                        backgroundColor:
                          selectedElement.type === 'text'
                            ? selectedElement.color || '#0F172A'
                            : selectedElement.fill || '#F1F5F9',
                      }}
                    />
                    <span>Rang</span>
                  </button>
                  {showColorPalette && (
                    <div className="absolute left-0 top-9 bg-white border border-slate-200 rounded-lg shadow-md p-2 flex items-center gap-1.5 z-30">
                      {ELEMENT_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            if (selectedElement.type === 'text') {
                              updateSelectedElement({ color: hex });
                            } else {
                              updateSelectedElement({ fill: hex });
                            }
                            setShowColorPalette(false);
                          }}
                          className="w-5 h-5 rounded-sm border border-slate-300 hover:scale-110 transition-transform"
                          style={{ backgroundColor: hex }}
                          aria-label={`Rang ${hex}`}
                        />
                      ))}
                      <input
                        type="color"
                        value={
                          selectedElement.type === 'text'
                            ? selectedElement.color || '#0F172A'
                            : selectedElement.fill || '#F1F5F9'
                        }
                        onChange={(e) => {
                          if (selectedElement.type === 'text') {
                            updateSelectedElement({ color: e.target.value });
                          } else {
                            updateSelectedElement({ fill: e.target.value });
                          }
                        }}
                        className="w-6 h-5 cursor-pointer border-0 bg-transparent p-0"
                        title="Boshqa rang"
                      />
                    </div>
                  )}
                </div>
              )}

              <span className="h-4 w-px bg-slate-200 mx-0.5" aria-hidden="true" />

              <button
                type="button"
                onClick={() => moveLayer('up')}
                title="Oldinga chiqarish"
                className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveLayer('down')}
                title="Orqaga tushirish"
                className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                title="Elementni o'chirish"
                className="p-1.5 rounded-md text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Right Toolbar Group: Page Background + PDF Orientation */}
        <div className="flex items-center gap-2 shrink-0">
          {kind === 'pdf' && onOrientationChange && (
            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => onOrientationChange('portrait')}
                className={`px-2 py-1 text-[11px] font-medium rounded-xs transition-colors whitespace-nowrap ${
                  orientation === 'portrait'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tik · A4
              </button>
              <button
                type="button"
                onClick={() => onOrientationChange('landscape')}
                className={`px-2 py-1 text-[11px] font-medium rounded-xs transition-colors whitespace-nowrap ${
                  orientation === 'landscape'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yotiq · A4
              </button>
            </div>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowBgPalette((v) => !v);
                setShowColorPalette(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5 text-slate-600" />
              <span>Fon</span>
              <span
                className="w-3 h-3 rounded-xs border border-slate-300"
                style={{ backgroundColor: activePage.background }}
              />
            </button>

            {showBgPalette && (
              <div className="absolute right-0 top-9 bg-white border border-slate-200 rounded-lg shadow-md p-2 flex items-center gap-1.5 z-30">
                {PAGE_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => {
                      updateActivePage((p) => ({ ...p, background: hex, backgroundImage: undefined }));
                      setShowBgPalette(false);
                    }}
                    className="w-5 h-5 rounded-sm border border-slate-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: hex }}
                    aria-label={`Fon ${hex}`}
                  />
                ))}
                <input
                  type="color"
                  value={activePage.background}
                  onChange={(e) =>
                    updateActivePage((p) => ({
                      ...p,
                      background: e.target.value,
                      backgroundImage: undefined,
                    }))
                  }
                  className="w-6 h-5 cursor-pointer border-0 bg-transparent p-0"
                  title="Boshqa fon rangi"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Slide/Page Rail (Desktop) */}
        <aside className="hidden md:flex w-[224px] shrink-0 bg-white border-r border-slate-200 flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              {kind === 'pptx' ? 'Slaydlar' : 'Sahifalar'}{' '}
              <span className="font-mono tabular-nums text-slate-400 font-normal">
                ({pages.length})
              </span>
            </span>
            <button
              type="button"
              onClick={addPage}
              className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {pages.map((page, index) => {
              const isActive = page.id === activePage.id;

              return (
                <div
                  key={page.id}
                  className={`group rounded-lg p-1.5 transition-colors border ${
                    isActive
                      ? 'border-red-600 bg-red-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 px-0.5">
                    <span className="text-[11px] font-mono tabular-nums font-medium text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => movePageOrder(index, -1)}
                        disabled={index === 0}
                        title="Yuqoriga"
                        className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePageOrder(index, 1)}
                        disabled={index === pages.length - 1}
                        title="Pastga"
                        className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicatePage(page)}
                        title="Nusxalash"
                        className="p-0.5 text-slate-500 hover:text-slate-900"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePage(page.id)}
                        disabled={pages.length <= 1}
                        title="O'chirish"
                        className="p-0.5 text-slate-500 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scaled live thumbnail */}
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    className="block w-full overflow-hidden rounded-sm border border-slate-200/90 text-left focus:outline-none"
                  >
                    <ScaledThumb page={page} dims={dims} fallbackWidth={184} />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Interactive Stage */}
        <main
          ref={viewportRef}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
              setEditingTextId(null);
              setShowBgPalette(false);
              setShowColorPalette(false);
            }
          }}
          className="flex-1 relative overflow-auto bg-[#F1F3F5] flex items-center justify-center p-4 md:p-8"
        >
          {/* Scaled Canvas Frame */}
          <div
            style={{
              width: Math.round(dims.width * zoom),
              height: Math.round(dims.height * zoom),
            }}
            className="shrink-0 relative"
          >
            <div
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                  setEditingTextId(null);
                  setShowBgPalette(false);
                  setShowColorPalette(false);
                }
              }}
              style={{
                width: dims.width,
                height: dims.height,
                backgroundColor: activePage.background,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
              className="relative shadow-sm border border-slate-200/90 overflow-hidden select-none"
            >
              {activePage.backgroundImage && (
                <img
                  src={activePage.backgroundImage}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              )}
              {activePage.elements.map((el) => {
                const isSelected = el.id === selectedId;
                const isEditing = el.id === editingTextId;

                return (
                  <div
                    key={el.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setShowBgPalette(false);
                      setShowColorPalette(false);
                      setSelectedId(el.id);
                      if (editingTextId && editingTextId !== el.id) {
                        setEditingTextId(null);
                      }
                      if (!isEditing) {
                        dragRef.current = {
                          mode: 'move',
                          elementId: el.id,
                          startX: e.clientX,
                          startY: e.clientY,
                          origX: el.x,
                          origY: el.y,
                          preDragPages: livePagesRef.current,
                          didDrag: false,
                        };
                      }
                    }}
                    onTouchStart={(e) => {
                      if (e.touches.length === 0) return;
                      e.stopPropagation();
                      setShowBgPalette(false);
                      setShowColorPalette(false);
                      setSelectedId(el.id);
                      if (editingTextId && editingTextId !== el.id) {
                        setEditingTextId(null);
                      }
                      if (!isEditing) {
                        dragRef.current = {
                          mode: 'move',
                          elementId: el.id,
                          startX: e.touches[0].clientX,
                          startY: e.touches[0].clientY,
                          origX: el.x,
                          origY: el.y,
                          preDragPages: livePagesRef.current,
                          didDrag: false,
                        };
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (el.type === 'text') {
                        setSelectedId(el.id);
                        setEditingTextId(el.id);
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: el.x,
                      top: el.y,
                      width: el.width,
                      height: el.height,
                      cursor: isEditing ? 'text' : 'move',
                    }}
                    className={
                      isSelected
                        ? 'outline-2 outline-red-600 outline-offset-1'
                        : 'hover:outline-1 hover:outline-red-400/70'
                    }
                  >
                    {/* Element Content */}
                    {el.type === 'text' &&
                      (isEditing ? (
                        <textarea
                          autoFocus
                          value={formatCanvasText(el.text)}
                          onChange={(e) =>
                            updateActivePage((p) => ({
                              ...p,
                              elements: p.elements.map((item) =>
                                item.id === el.id ? { ...item, text: e.target.value } : item
                              ),
                            }))
                          }
                          onMouseDown={(e) => e.stopPropagation()}
                          style={{
                            width: '100%',
                            height: '100%',
                            fontFamily: el.fontFamily || 'DM Sans, sans-serif',
                            fontSize: `${el.fontSize || 18}px`,
                            fontWeight: el.fontWeight || 'normal',
                            fontStyle: el.fontStyle || 'normal',
                            textDecoration: el.textDecoration || 'none',
                            textAlign: el.textAlign || 'left',
                            color: el.color || '#0F172A',
                            lineHeight: el.lineHeight || 1.35,
                            padding: el.padding !== undefined ? `${el.padding}px ${el.padding + 2}px` : '4px 6px',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            fontFamily: el.fontFamily || 'DM Sans, sans-serif',
                            fontSize: `${el.fontSize || 18}px`,
                            fontWeight: el.fontWeight || 'normal',
                            fontStyle: el.fontStyle || 'normal',
                            textDecoration: el.textDecoration || 'none',
                            textAlign: el.textAlign || 'left',
                            color: el.color || '#0F172A',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: el.lineHeight || 1.35,
                            padding: el.padding !== undefined ? `${el.padding}px ${el.padding + 2}px` : '4px 6px',
                          }}
                        >
                          {formatCanvasText(el.text)}
                        </div>
                      ))}

                    {el.type === 'rect' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: el.gradient || el.fill || '#F1F5F9',
                          borderRadius: `${el.borderRadius || 0}px`,
                          boxShadow: el.shadow ? '0 4px 14px rgba(15, 23, 42, 0.08)' : undefined,
                          border:
                            el.stroke && el.stroke !== 'transparent'
                              ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                              : undefined,
                        }}
                      />
                    )}

                    {el.type === 'circle' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          background: el.gradient || el.fill || '#DBEAFE',
                          borderRadius: '9999px',
                          boxShadow: el.shadow ? '0 4px 12px rgba(15, 23, 42, 0.1)' : undefined,
                          border:
                            el.stroke && el.stroke !== 'transparent'
                              ? `${el.strokeWidth || 1}px solid ${el.stroke}`
                              : undefined,
                        }}
                      />
                    )}

                    {el.type === 'image' && el.src && (
                      <img
                        src={el.src}
                        alt=""
                        draggable={false}
                        className={`w-full h-full pointer-events-none ${el.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                        style={{
                          borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                          boxShadow: el.shadow ? '0 10px 26px rgba(15, 23, 42, 0.14)' : undefined,
                        }}
                      />
                    )}

                    {/* Corner Resize Handles */}
                    {isSelected && !isEditing && (
                      <>
                        {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => {
                          const posClass =
                            handle === 'nw'
                              ? '-top-1.5 -left-1.5 cursor-nwse-resize'
                              : handle === 'ne'
                                ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                                : handle === 'sw'
                                  ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                                  : '-bottom-1.5 -right-1.5 cursor-nwse-resize';
                          return (
                            <div
                              key={handle}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                dragRef.current = {
                                  mode: 'resize',
                                  handle,
                                  elementId: el.id,
                                  startX: e.clientX,
                                  startY: e.clientY,
                                  origX: el.x,
                                  origY: el.y,
                                  origW: el.width,
                                  origH: el.height,
                                  preDragPages: livePagesRef.current,
                                  didDrag: false,
                                };
                              }}
                              onTouchStart={(e) => {
                                if (e.touches.length === 0) return;
                                e.stopPropagation();
                                dragRef.current = {
                                  mode: 'resize',
                                  handle,
                                  elementId: el.id,
                                  startX: e.touches[0].clientX,
                                  startY: e.touches[0].clientY,
                                  origX: el.x,
                                  origY: el.y,
                                  origW: el.width,
                                  origH: el.height,
                                  preDragPages: livePagesRef.current,
                                  didDrag: false,
                                };
                              }}
                              className={`absolute w-3.5 h-3.5 md:w-3 md:h-3 bg-white border-2 border-red-600 rounded-xs ${posClass}`}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quiet Bottom-Right Zoom Bar */}
          <div className="fixed bottom-[82px] right-3 md:bottom-4 md:right-5 bg-white border border-slate-200 rounded-lg shadow-xs px-2 py-1 flex items-center gap-1.5 z-20">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
              aria-label="Kichiklashtirish"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={fitZoom}
              title="Ekranga moslash"
              className="text-xs font-mono tabular-nums text-slate-700 px-1.5 py-0.5 hover:bg-slate-100 rounded-sm"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
              aria-label="Kattalashtirish"
              className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Sheet for Slides / Pages */}
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
                {kind === 'pptx' ? 'Slaydlar' : 'Sahifalar'}{' '}
                <span className="font-mono tabular-nums text-slate-400 font-normal">
                  ({pages.length})
                </span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addPage}
                  className="flex items-center gap-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yangi</span>
                </button>
                <button
                  type="button"
                  onClick={onCloseMobileSheet}
                  aria-label="Yopish"
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3">
              {pages.map((page, index) => {
                const isActive = page.id === activePage.id;

                return (
                  <div
                    key={page.id}
                    className={`rounded-xl p-2 border transition-colors ${
                      isActive
                        ? 'border-red-600 bg-red-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono tabular-nums font-medium text-slate-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicatePage(page)}
                          title="Nusxalash"
                          className="p-1 text-slate-500 hover:text-slate-900"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePage(page.id)}
                          disabled={pages.length <= 1}
                          title="O'chirish"
                          className="p-1 text-slate-500 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectPage(page.id);
                        onCloseMobileSheet?.();
                      }}
                      className="block w-full overflow-hidden rounded-md border border-slate-200 text-left"
                    >
                      <ScaledThumb page={page} dims={dims} fallbackWidth={160} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {kind === 'pptx' && (
        <AiCanvasDrawModal
          open={showAiDrawModal}
          onClose={() => setShowAiDrawModal(false)}
          onApplyPage={(drawnPage, applyMode) => {
            if (applyMode === 'replace') {
              const nextPages = pages.map((p) =>
                p.id === activePage.id ? { ...drawnPage, id: activePage.id } : p
              );
              onUpdatePages(nextPages, activePage.id);
            } else {
              const activeIdx = pages.findIndex((p) => p.id === activePage.id);
              const nextPages = [...pages];
              nextPages.splice(activeIdx >= 0 ? activeIdx + 1 : pages.length, 0, drawnPage);
              onUpdatePages(nextPages, drawnPage.id);
            }
          }}
        />
      )}
    </div>
  );
};
