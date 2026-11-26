import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Image as ImageIcon, Loader2, Paintbrush, Sparkles, X } from 'lucide-react';
import { CanvasPage } from '../types/editor';

interface AiCanvasDrawModalProps {
  open: boolean;
  onClose: () => void;
  onApplyPage: (page: CanvasPage, mode: 'replace' | 'add') => void;
}

export const AiCanvasDrawModal: React.FC<AiCanvasDrawModalProps> = ({
  open,
  onClose,
  onApplyPage,
}) => {
  const [prompt, setPrompt] = useState('');
  const [styleHint, setStyleHint] = useState('');
  const [includeTopicImages, setIncludeTopicImages] = useState(true);
  const [applyMode, setApplyMode] = useState<'replace' | 'add'>('add');
  const [isDrawing, setIsDrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<CanvasPage | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live HTML5 canvas animation while AI is drawing or previewing
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let cancelled = false;

    if (previewPage && !isDrawing) {
      // Paint finished AI-drawn canvas onto real HTML5 <canvas> preview
      const renderFinished = async () => {
        ctx.clearRect(0, 0, 960, 540);
        ctx.fillStyle = previewPage.background || '#FFFFFF';
        ctx.fillRect(0, 0, 960, 540);

        const loadImg = (src: string) =>
          new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = src;
          });

        if (previewPage.backgroundImage) {
          const bgImg = await loadImg(previewPage.backgroundImage);
          if (bgImg && !cancelled) {
            ctx.drawImage(bgImg, 0, 0, 960, 540);
          }
        }

        for (const el of previewPage.elements) {
          if (cancelled) return;
          if (el.type === 'rect') {
            ctx.save();
            ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : 'transparent';
            const r = el.borderRadius || 0;
            ctx.beginPath();
            ctx.roundRect(el.x, el.y, el.width, el.height, r);
            if (el.fill && el.fill !== 'transparent') ctx.fill();
            if (el.stroke && el.stroke !== 'transparent') {
              ctx.strokeStyle = el.stroke;
              ctx.lineWidth = el.strokeWidth || 1;
              ctx.stroke();
            }
            ctx.restore();
          } else if (el.type === 'circle') {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(
              el.x + el.width / 2,
              el.y + el.height / 2,
              el.width / 2,
              el.height / 2,
              0,
              0,
              Math.PI * 2
            );
            if (el.fill && el.fill !== 'transparent') {
              ctx.fillStyle = el.fill;
              ctx.fill();
            }
            ctx.restore();
          } else if (el.type === 'image' && el.src) {
            const img = await loadImg(el.src);
            if (img && !cancelled) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(el.x, el.y, el.width, el.height, el.borderRadius || 0);
              ctx.clip();
              if (el.imageFit === 'cover') {
                const sr = img.naturalWidth / Math.max(1, img.naturalHeight);
                const dr = el.width / Math.max(1, el.height);
                let sx = 0;
                let sy = 0;
                let sw = img.naturalWidth;
                let sh = img.naturalHeight;
                if (sr > dr) {
                  sw = img.naturalHeight * dr;
                  sx = (img.naturalWidth - sw) / 2;
                } else {
                  sh = img.naturalWidth / dr;
                  sy = (img.naturalHeight - sh) / 2;
                }
                ctx.drawImage(img, sx, sy, sw, sh, el.x, el.y, el.width, el.height);
              } else {
                ctx.drawImage(img, el.x, el.y, el.width, el.height);
              }
              ctx.restore();
            }
          } else if (el.type === 'text' && el.text) {
            ctx.save();
            const fs = el.fontSize || 16;
            ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}${fs}px sans-serif`;
            ctx.fillStyle = el.color || '#0F172A';
            ctx.textBaseline = 'top';
            const words = el.text.split(/\s+/);
            let line = '';
            let ly = el.y + 4;
            const maxW = Math.max(40, el.width - 10);
            for (const w of words) {
              const test = line ? `${line} ${w}` : w;
              if (ctx.measureText(test).width > maxW && line) {
                const tx =
                  el.textAlign === 'center'
                    ? el.x + el.width / 2
                    : el.textAlign === 'right'
                      ? el.x + el.width - 4
                      : el.x + 4;
                ctx.textAlign = el.textAlign || 'left';
                ctx.fillText(line, tx, ly);
                ly += fs * 1.3;
                line = w;
              } else {
                line = test;
              }
            }
            if (line) {
              const tx =
                el.textAlign === 'center'
                  ? el.x + el.width / 2
                  : el.textAlign === 'right'
                    ? el.x + el.width - 4
                    : el.x + 4;
              ctx.textAlign = el.textAlign || 'left';
              ctx.fillText(line, tx, ly);
            }
            ctx.restore();
          }
        }
      };
      renderFinished();
      return () => {
        cancelled = true;
      };
    }

    // Idle or active live sketching animation on the canvas
    let tick = 0;
    const drawFrame = () => {
      tick += 0.04;
      ctx.clearRect(0, 0, 960, 540);
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, 960, 540);

      // Subtle drafting grid
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      for (let x = 0; x <= 960; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 540);
        ctx.stroke();
      }
      for (let y = 0; y <= 540; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(960, y);
        ctx.stroke();
      }

      if (isDrawing) {
        // Animated AI vector strokes on canvas
        ctx.save();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 60; x <= 900; x += 12) {
          const y = 270 + Math.sin(x * 0.015 + tick * 2.5) * 70 + Math.cos(x * 0.03 - tick) * 28;
          if (x === 60) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(72, 72, 390, 120, 16);
        ctx.roundRect(530, 110, 356, 268, 18);
        ctx.stroke();

        ctx.fillStyle = 'rgba(220, 38, 38, 0.12)';
        ctx.beginPath();
        ctx.arc(480 + Math.cos(tick * 2) * 160, 270 + Math.sin(tick * 2) * 90, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Clean empty artboard invitation
        ctx.strokeStyle = '#CBD5E1';
        ctx.setLineDash([8, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(48, 48, 864, 444);
        ctx.setLineDash([]);
      }

      if (isDrawing) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [open, isDrawing, previewPage]);

  if (!open) return null;

  const handleDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = prompt.trim();
    if (!clean) {
      setErrorMsg("Iltimos, AI chizishi kerak bo'lgan mavzuni yozing.");
      return;
    }

    setErrorMsg(null);
    setIsDrawing(true);
    setPreviewPage(null);

    try {
      const res = await fetch('/api/ai/canvas-draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: clean,
          styleHint: styleHint.trim() || undefined,
          includeTopicImages,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.page) {
        throw new Error(payload?.error || "AI dizayn chizishda xatolik yuz berdi.");
      }
      setPreviewPage(payload.page as CanvasPage);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Xatolik yuz berdi.");
    } finally {
      setIsDrawing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-[#111113] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold">AI Dizayn Canvas · Chizish oynasi</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="p-1 text-zinc-400 hover:text-white rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 md:p-5 overflow-y-auto space-y-4">
          {/* Live HTML5 Canvas Artboard */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="w-full h-full block"
            />
            {!previewPage && !isDrawing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none">
                <Sparkles className="w-7 h-7 text-red-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  AI kanvasiga chizish uchun mavzuni yozing
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  AI fon gradienti, vektor illyustratsiya, kartalar va mavzuga mos rasmni o&apos;zi chizib beradi.
                </p>
              </div>
            )}
            {isDrawing && (
              <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px] flex items-center justify-center">
                <div className="bg-[#111113] text-white px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 shadow-md">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                  <span>AI kanvasga dizayn chizmoqda...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleDraw} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="ai-canvas-prompt" className="block text-xs font-medium text-slate-700">
                Nima chizish kerak? (Mavzu va kontent)
              </label>
              <textarea
                id="ai-canvas-prompt"
                rows={2}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Masalan: Quyosh tizimi sayyoralari — o'ng tomonda illyustratsiya va 3 ta asosiy fakt kartasi bilan chiz"
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="ai-canvas-style" className="block text-xs font-medium text-slate-700">
                  Dizayn uslubi / ranglar (ixtiyoriy)
                </label>
                <input
                  id="ai-canvas-style"
                  type="text"
                  value={styleHint}
                  onChange={(e) => setStyleHint(e.target.value)}
                  placeholder="Masalan: To'q ko'k va oltin, minimalist"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTopicImages}
                    onChange={(e) => setIncludeTopicImages(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mavzuga mos haqiqiy rasm qo&apos;shish</span>
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setApplyMode('add')}
                    className={`px-2.5 py-1 rounded-full border transition-colors ${
                      applyMode === 'add'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Yangi slaydga
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyMode('replace')}
                    className={`px-2.5 py-1 rounded-full border transition-colors ${
                      applyMode === 'replace'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Joriy slaydga
                  </button>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 flex items-center gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isDrawing}
                className="px-4 py-2 rounded-full text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5 transition-colors"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Chizilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{previewPage ? 'Qayta chizish' : 'AI chizsin'}</span>
                  </>
                )}
              </button>

              {previewPage && (
                <button
                  type="button"
                  onClick={() => {
                    onApplyPage(previewPage, applyMode);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-full text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Kanvasga joylash</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
