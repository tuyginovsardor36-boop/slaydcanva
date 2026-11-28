import PptxGenJS from 'pptxgenjs';
import { FONT_OPTIONS, PPTX_CANVAS } from '../data/defaults';
import { CanvasPage } from '../types/editor';
import { triggerSafeFileDownload } from './safeDownload';
import { getTelegramAuthHeaders } from './telegramClient';

function cleanHex(color?: string, fallback = '0F172A'): string {
  if (!color || color === 'transparent') return fallback;
  return color.replace('#', '').toUpperCase().slice(0, 6);
}

function mapFontFamily(cssFont?: string): string {
  const match = FONT_OPTIONS.find((f) => f.value === cssFont);
  return match ? match.exportFont : 'Arial';
}

function isValidRasterDataUri(value: string): boolean {
  return value.startsWith('data:image/') && !value.startsWith('data:image/svg+xml');
}

async function fetchUrlAsDataUri(
  url: string,
  sessionToken?: string | null,
  rawCache?: Map<string, string>
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (rawCache?.has(url)) {
    const cached = rawCache.get(url)!;
    return cached || null;
  }

  const blobToDataUri = (blob: Blob): Promise<string | null> =>
    new Promise((resolve) => {
      if (!blob || blob.size === 0) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = typeof reader.result === 'string' ? reader.result : '';
        resolve(res.startsWith('data:image/') ? res : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

  const tryFetch = async (target: string, useAuth: boolean): Promise<string | null> => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 5500);
    try {
      const res = await fetch(target, {
        method: 'GET',
        credentials: useAuth ? 'same-origin' : 'omit',
        headers: useAuth ? getTelegramAuthHeaders(sessionToken) : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && blob.type !== '') {
        // Still try reading if server returned octet-stream; blobToDataUri validates prefix
      }
      return await blobToDataUri(blob);
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  };

  let resolved: string | null = null;
  if (url.startsWith('https://')) {
    resolved = await tryFetch(`/api/media/image-proxy?url=${encodeURIComponent(url)}`, true);
    if (!resolved) {
      resolved = await tryFetch(url, false);
    }
  } else if (url.startsWith('/') || url.startsWith('blob:')) {
    resolved = await tryFetch(url, false);
  } else if (url.startsWith('http://')) {
    resolved = await tryFetch(url, false);
  }

  if (rawCache) {
    rawCache.set(url, resolved || '');
  }
  return resolved;
}

async function prepareImageForPptx(
  rawSrc: string,
  width: number,
  height: number,
  imageFit?: 'contain' | 'cover',
  borderRadius?: number,
  renderScale = 1.6,
  cache?: Map<string, string>,
  preferJpeg = false,
  sessionToken?: string | null,
  rawUrlCache?: Map<string, string>
): Promise<string | null> {
  const dataUrl = rawSrc.startsWith('data:')
    ? rawSrc
    : await fetchUrlAsDataUri(rawSrc, sessionToken, rawUrlCache);
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return null;
  }

  const isSvg = dataUrl.startsWith('data:image/svg+xml');
  const needsCanvasProcessing = isSvg || imageFit === 'cover' || (borderRadius && borderRadius > 0);
  if (!needsCanvasProcessing) {
    return isValidRasterDataUri(dataUrl) ? dataUrl : null;
  }

  const cacheKey = `${width}x${height}|${imageFit || ''}|${borderRadius || 0}|${renderScale}|${preferJpeg ? 'jpg' : 'png'}|${dataUrl}`;
  if (cache?.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    return cached || null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(val && isValidRasterDataUri(val) ? val : null);
    };

    const fallbackValue = isValidRasterDataUri(dataUrl) ? dataUrl : null;
    const timeoutId = window.setTimeout(() => finish(fallbackValue), 6000);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const targetW = Math.max(40, Math.round(width * renderScale));
        const targetH = Math.max(40, Math.round(height * renderScale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(fallbackValue);
          return;
        }

        if (preferJpeg && !(borderRadius && borderRadius > 0)) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
        }

        if (borderRadius && borderRadius > 0) {
          const r = Math.min(borderRadius * renderScale, targetW / 2, targetH / 2);
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(targetW - r, 0);
          ctx.quadraticCurveTo(targetW, 0, targetW, r);
          ctx.lineTo(targetW, targetH - r);
          ctx.quadraticCurveTo(targetW, targetH, targetW - r, targetH);
          ctx.lineTo(r, targetH);
          ctx.quadraticCurveTo(0, targetH, 0, targetH - r);
          ctx.lineTo(0, r);
          ctx.quadraticCurveTo(0, 0, r, 0);
          ctx.closePath();
          ctx.clip();
        }

        if (imageFit === 'cover' && img.naturalWidth > 0 && img.naturalHeight > 0) {
          const srcRatio = img.naturalWidth / img.naturalHeight;
          const dstRatio = targetW / targetH;
          let sx = 0;
          let sy = 0;
          let sw = img.naturalWidth;
          let sh = img.naturalHeight;
          if (srcRatio > dstRatio) {
            sw = img.naturalHeight * dstRatio;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / dstRatio;
            sy = (img.naturalHeight - sh) / 2;
          }
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        } else {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        const encoded =
          preferJpeg && !(borderRadius && borderRadius > 0)
            ? canvas.toDataURL('image/jpeg', 0.86)
            : canvas.toDataURL('image/png');
        if (cache && isValidRasterDataUri(encoded)) {
          cache.set(cacheKey, encoded);
        }
        finish(encoded);
      } catch {
        finish(fallbackValue);
      }
    };
    img.onerror = () => finish(fallbackValue);
    img.src = dataUrl;
  });
}

export interface ExportedFileResult {
  blob: Blob;
  fileName: string;
}

export async function exportToPptx(
  pages: CanvasPage[],
  title: string,
  options?: { download?: boolean; sessionToken?: string | null }
): Promise<ExportedFileResult> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
  pptx.title = title || 'SlaydCanva Taqdimot';

  const scaleX = 10 / PPTX_CANVAS.width;
  const scaleY = 5.625 / PPTX_CANVAS.height;
  const isLargeOrMobile =
    pages.length > 10 || (typeof window !== 'undefined' && window.innerWidth < 768);
  const bgRenderScale = isLargeOrMobile ? 1.35 : 1.75;
  const imgRenderScale = isLargeOrMobile ? 1.4 : 1.8;
  const imageCache = new Map<string, string>();
  const rawUrlCache = new Map<string, string>();

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    const slide = pptx.addSlide();
    if (page.backgroundImage) {
      const bgData = await prepareImageForPptx(
        page.backgroundImage,
        PPTX_CANVAS.width,
        PPTX_CANVAS.height,
        undefined,
        undefined,
        bgRenderScale,
        imageCache,
        true,
        options?.sessionToken,
        rawUrlCache
      );
      if (bgData) {
        slide.background = { data: bgData };
      } else {
        slide.background = { color: cleanHex(page.background, 'FFFFFF') };
      }
    } else {
      slide.background = { color: cleanHex(page.background, 'FFFFFF') };
    }

    for (const el of page.elements) {
      const x = Number((el.x * scaleX).toFixed(3));
      const y = Number((el.y * scaleY).toFixed(3));
      const w = Math.max(0.05, Number((el.width * scaleX).toFixed(3)));
      const h = Math.max(0.03, Number((el.height * scaleY).toFixed(3)));

      if (el.type === 'text') {
        const fontPt = Math.max(7, Math.round((el.fontSize || 18) * 0.75));
        slide.addText(el.text || '', {
          x,
          y,
          w,
          h,
          fontFace: mapFontFamily(el.fontFamily),
          fontSize: fontPt,
          bold: el.fontWeight === 'bold',
          italic: el.fontStyle === 'italic',
          underline: el.textDecoration === 'underline' ? { style: 'sng' } : undefined,
          align: el.textAlign || 'left',
          valign: 'top',
          color: cleanHex(el.color, '0F172A'),
          margin: el.padding !== undefined ? el.padding * 0.01 : 0.04,
          wrap: true,
        });
      } else if (el.type === 'rect') {
        const hasRadius = (el.borderRadius || 0) > 0;
        const shapeType = hasRadius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
        const hasStroke = el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0;
        slide.addShape(shapeType, {
          x,
          y,
          w,
          h,
          fill: el.fill && el.fill !== 'transparent' ? { color: cleanHex(el.fill, 'E2E8F0') } : undefined,
          line: hasStroke
            ? { color: cleanHex(el.stroke, 'CBD5E1'), pt: Math.max(0.5, el.strokeWidth || 1) }
            : { color: cleanHex(el.fill, 'E2E8F0'), width: 0 },
          rectRadius: hasRadius ? Math.min(0.4, (el.borderRadius || 0) / 40) : undefined,
        });
      } else if (el.type === 'circle') {
        const hasStroke = el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0;
        slide.addShape(pptx.ShapeType.ellipse, {
          x,
          y,
          w,
          h,
          fill: el.fill && el.fill !== 'transparent' ? { color: cleanHex(el.fill, 'DBEAFE') } : undefined,
          line: hasStroke
            ? { color: cleanHex(el.stroke, '2563EB'), pt: Math.max(0.5, el.strokeWidth || 1) }
            : { color: cleanHex(el.fill, 'DBEAFE'), width: 0 },
        });
      } else if (el.type === 'image' && el.src) {
        const imgData = await prepareImageForPptx(
          el.src,
          Math.round(el.width),
          Math.round(el.height),
          el.imageFit,
          el.borderRadius,
          imgRenderScale,
          imageCache,
          el.imageFit === 'cover' && !(el.borderRadius && el.borderRadius > 0),
          options?.sessionToken,
          rawUrlCache
        );
        if (imgData) {
          slide.addImage({
            data: imgData,
            x,
            y,
            w,
            h,
          });
        }
      }
    }

    if (pIdx > 0 && pIdx % 6 === 0) {
      await new Promise((r) => window.setTimeout(r, 10));
    }
  }

  const safeName = (title || 'SlaydCanva-taqdimot').trim().replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${safeName}.pptx`;
  const rawBlob = (await pptx.write({ outputType: 'blob' })) as Blob;
  if (options?.download !== false) {
    await triggerSafeFileDownload({ blob: rawBlob, fileName });
  }
  return { blob: rawBlob, fileName };
}
