import PptxGenJS from 'pptxgenjs';
import { FONT_OPTIONS, PPTX_CANVAS } from '../data/defaults';
import { CanvasPage } from '../types/editor';

function cleanHex(color?: string, fallback = '0F172A'): string {
  if (!color || color === 'transparent') return fallback;
  return color.replace('#', '').toUpperCase().slice(0, 6);
}

function mapFontFamily(cssFont?: string): string {
  const match = FONT_OPTIONS.find((f) => f.value === cssFont);
  return match ? match.exportFont : 'Arial';
}

async function prepareImageForPptx(
  dataUrl: string,
  width: number,
  height: number,
  imageFit?: 'contain' | 'cover',
  borderRadius?: number
): Promise<string> {
  const needsCanvasProcessing =
    dataUrl.startsWith('data:image/svg+xml') || imageFit === 'cover' || (borderRadius && borderRadius > 0);
  if (!needsCanvasProcessing) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const targetW = Math.max(40, width * 2);
      const targetH = Math.max(40, height * 2);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      if (borderRadius && borderRadius > 0) {
        const r = Math.min(borderRadius * 2, targetW / 2, targetH / 2);
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

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
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
  options?: { download?: boolean }
): Promise<ExportedFileResult> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
  pptx.title = title || 'SlaydCanva Taqdimot';

  const scaleX = 10 / PPTX_CANVAS.width;
  const scaleY = 5.625 / PPTX_CANVAS.height;

  for (const page of pages) {
    const slide = pptx.addSlide();
    if (page.backgroundImage) {
      const pngBg = await prepareImageForPptx(
        page.backgroundImage,
        PPTX_CANVAS.width,
        PPTX_CANVAS.height
      );
      slide.background = { data: pngBg };
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
        const pngData = await prepareImageForPptx(
          el.src,
          Math.round(el.width),
          Math.round(el.height),
          el.imageFit,
          el.borderRadius
        );
        slide.addImage({
          data: pngData,
          x,
          y,
          w,
          h,
        });
      }
    }
  }

  const safeName = (title || 'SlaydCanva-taqdimot').trim().replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${safeName}.pptx`;
  const rawBlob = (await pptx.write({ outputType: 'blob' })) as Blob;
  if (options?.download !== false) {
    const url = URL.createObjectURL(rawBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return { blob: rawBlob, fileName };
}
