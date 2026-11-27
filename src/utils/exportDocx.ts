import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from 'docx';
import { FONT_OPTIONS } from '../data/defaults';
import { WordDocumentData } from '../types/editor';
import { triggerSafeFileDownload } from './safeDownload';

type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  font?: string;
  size?: number;
};

function rgbToHex(rgb: string): string | undefined {
  if (!rgb) return undefined;
  if (rgb.startsWith('#')) {
    return rgb.replace('#', '').toUpperCase().slice(0, 6);
  }
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return undefined;
  return match
    .slice(0, 3)
    .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function getAlignment(el: HTMLElement): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const align = el.style?.textAlign || el.getAttribute('align') || '';
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  if (align === 'justify') return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

function collectRuns(node: Node, style: TextStyle, defaultFont: string, defaultSizePt: number): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (!text) return [];
    return [
      new TextRun({
        text,
        bold: style.bold,
        italics: style.italic,
        underline: style.underline ? { type: UnderlineType.SINGLE } : undefined,
        color: style.color || '0F172A',
        font: style.font || defaultFont,
        size: (style.size || defaultSizePt) * 2,
      }),
    ];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    return [new TextRun({ break: 1 })];
  }

  const nextStyle: TextStyle = { ...style };
  if (tag === 'b' || tag === 'strong') nextStyle.bold = true;
  if (tag === 'i' || tag === 'em') nextStyle.italic = true;
  if (tag === 'u') nextStyle.underline = true;

  if (el.style) {
    if (el.style.fontWeight === 'bold' || Number(el.style.fontWeight) >= 600) {
      nextStyle.bold = true;
    }
    if (el.style.fontStyle === 'italic') {
      nextStyle.italic = true;
    }
    if (el.style.textDecoration?.includes('underline')) {
      nextStyle.underline = true;
    }
    if (el.style.color) {
      const hex = rgbToHex(el.style.color);
      if (hex) nextStyle.color = hex;
    }
  }

  if (tag === 'font') {
    const colorAttr = el.getAttribute('color');
    if (colorAttr) {
      const hex = rgbToHex(colorAttr);
      if (hex) nextStyle.color = hex;
    }
  }

  const runs: TextRun[] = [];
  el.childNodes.forEach((child) => {
    runs.push(...collectRuns(child, nextStyle, defaultFont, defaultSizePt));
  });
  return runs;
}

async function loadDocxImage(
  src: string
): Promise<{ data: Uint8Array; type: 'png' | 'jpg' | 'gif'; width: number; height: number } | null> {
  try {
    if (!src.startsWith('data:image')) return null;

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });

    const natW = img.naturalWidth || 800;
    const natH = img.naturalHeight || 500;
    const maxW = 460;
    const maxH = 300;
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const width = Math.max(120, Math.round(natW * scale));
    const height = Math.max(80, Math.round(natH * scale));

    const [meta, base64] = src.split(',');
    if (!base64) return null;

    const isSupportedDirect =
      meta.includes('image/png') || meta.includes('image/jpeg') || meta.includes('image/jpg') || meta.includes('image/gif');

    if (isSupportedDirect) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const type = meta.includes('png') ? 'png' : meta.includes('gif') ? 'gif' : 'jpg';
      return { data: bytes, type, width, height };
    }

    // Transcode webp / svg / etc. into PNG for Microsoft Word compatibility
    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, natW, natH);
    const pngDataUrl = canvas.toDataURL('image/png');
    const pngBase64 = pngDataUrl.split(',')[1] || '';
    const binary = atob(pngBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { data: bytes, type: 'png', width, height };
  } catch {
    return null;
  }
}

export async function exportToDocx(
  docData: WordDocumentData,
  title: string,
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${docData.html}</div>`, 'text/html');
  const root = parsed.body.firstElementChild as HTMLElement | null;

  const fontMeta = FONT_OPTIONS.find((f) => f.value === docData.fontFamily);
  const defaultFont = fontMeta ? fontMeta.exportFont : 'Arial';
  const baseSizePt = Math.max(10, Math.round(docData.fontSize * 0.75));

  const children: Array<Paragraph | Table> = [];
  let pendingPageBreak = false;

  const consumePageBreak = (): boolean => {
    const val = pendingPageBreak;
    pendingPageBreak = false;
    return val;
  };

  const processElement = async (el: HTMLElement, inTitul = false): Promise<void> => {
    const tag = el.tagName.toLowerCase();

    if (
      tag === 'div' ||
      tag === 'section' ||
      tag === 'article' ||
      tag === 'header' ||
      tag === 'main' ||
      tag === 'figure' ||
      tag === 'figcaption'
    ) {
      const nextInTitul = inTitul || el.classList.contains('doc-titul-page');
      const isTitulTop = el.classList.contains('doc-titul-top');
      const isTitulCenter = el.classList.contains('doc-titul-center');

      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            children.push(
              new Paragraph({
                pageBreakBefore: consumePageBreak(),
                spacing: { after: 140 },
                children: [new TextRun({ text, font: defaultFont, size: baseSizePt * 2 })],
              })
            );
          }
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          await processElement(child as HTMLElement, nextInTitul);
        }
      }

      if (isTitulTop) {
        children.push(new Paragraph({ text: '', spacing: { before: 1400, after: 400 } }));
      } else if (isTitulCenter) {
        children.push(new Paragraph({ text: '', spacing: { before: 1800, after: 400 } }));
      }
      return;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const headingMap = {
        h1: HeadingLevel.HEADING_1,
        h2: HeadingLevel.HEADING_2,
        h3: HeadingLevel.HEADING_3,
      } as const;
      const sizeMap = {
        h1: inTitul ? 24 : 20,
        h2: 16,
        h3: 13,
      } as const;
      const runs = collectRuns(
        el,
        { bold: true, size: sizeMap[tag], color: '0F172A' },
        defaultFont,
        sizeMap[tag]
      );
      children.push(
        new Paragraph({
          heading: headingMap[tag],
          pageBreakBefore: consumePageBreak(),
          alignment: getAlignment(el),
          spacing: { before: inTitul ? 120 : 200, after: inTitul ? 160 : 120 },
          children: runs.length ? runs : [new TextRun('')],
        })
      );
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li, index) => {
        const runs = collectRuns(li, {}, defaultFont, baseSizePt);
        const pageBreak = index === 0 ? consumePageBreak() : false;
        if (tag === 'ul') {
          children.push(
            new Paragraph({
              pageBreakBefore: pageBreak,
              bullet: { level: 0 },
              spacing: { after: 80 },
              children: runs.length ? runs : [new TextRun('')],
            })
          );
        } else {
          children.push(
            new Paragraph({
              pageBreakBefore: pageBreak,
              spacing: { after: 80 },
              indent: { left: 360 },
              children: [
                new TextRun({ text: `${index + 1}. `, bold: true, font: defaultFont, size: baseSizePt * 2 }),
                ...(runs.length ? runs : [new TextRun('')]),
              ],
            })
          );
        }
      });
      return;
    }

    if (tag === 'table') {
      const rows = Array.from(el.querySelectorAll('tr'));
      if (rows.length > 0) {
        if (consumePageBreak()) {
          children.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 }, children: [] }));
        }
        const tableRows = rows.map(
          (tr) =>
            new TableRow({
              children: Array.from(tr.children).map((cell) => {
                const isHeader = cell.tagName.toLowerCase() === 'th';
                const runs = collectRuns(cell, { bold: isHeader }, defaultFont, baseSizePt);
                return new TableCell({
                  shading: isHeader ? { fill: 'F8FAFC' } : undefined,
                  margins: { top: 100, bottom: 100, left: 120, right: 120 },
                  children: [
                    new Paragraph({
                      children: runs.length ? runs : [new TextRun('')],
                    }),
                  ],
                });
              }),
            })
        );
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          })
        );
        children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
      }
      return;
    }

    if (tag === 'hr') {
      if (el.classList.contains('doc-page-break')) {
        pendingPageBreak = true;
      } else {
        children.push(
          new Paragraph({
            pageBreakBefore: consumePageBreak(),
            border: {
              bottom: { color: 'CBD5E1', size: 6, space: 1, style: BorderStyle.SINGLE },
            },
            spacing: { before: 120, after: 120 },
          })
        );
      }
      return;
    }

    if (tag === 'img') {
      const src = el.getAttribute('src');
      if (src) {
        const imgData = await loadDocxImage(src);
        if (imgData) {
          children.push(
            new Paragraph({
              pageBreakBefore: consumePageBreak(),
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 100 },
              children: [
                new ImageRun({
                  data: imgData.data,
                  transformation: { width: imgData.width, height: imgData.height },
                  type: imgData.type,
                }),
              ],
            })
          );
        }
      }
      return;
    }

    // Check for inline images inside paragraphs
    const imgs = el.querySelectorAll('img');
    if (imgs.length > 0 && (el.textContent || '').trim() === '') {
      for (const img of Array.from(imgs)) {
        await processElement(img as HTMLElement, inTitul);
      }
      return;
    }

    const isAcademicDoc = docData.marginPreset === 'gost_academic';
    const hasIndent = Boolean(el.style?.textIndent && el.style.textIndent !== '0' && el.style.textIndent !== '0px');
    const runs = collectRuns(el, {}, defaultFont, baseSizePt);
    children.push(
      new Paragraph({
        pageBreakBefore: consumePageBreak(),
        alignment: getAlignment(el),
        indent: hasIndent ? { firstLine: 709 } : undefined,
        spacing: {
          after: isAcademicDoc ? (inTitul ? 80 : 100) : 140,
          line: isAcademicDoc ? (inTitul ? 300 : 360) : undefined,
        },
        children: runs.length ? runs : [new TextRun('')],
      })
    );
  };

  if (root) {
    for (const node of Array.from(root.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          children.push(
            new Paragraph({
              pageBreakBefore: consumePageBreak(),
              spacing: { after: 140 },
              children: [new TextRun({ text, font: defaultFont, size: baseSizePt * 2 })],
            })
          );
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        await processElement(node as HTMLElement, false);
      }
    }
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: '' }));
  }

  const pageMargin =
    docData.marginPreset === 'gost_academic'
      ? { top: 1134, bottom: 1134, left: 1701, right: 1134 } // O'zDST: 3cm left, 2cm top/right/bottom
      : docData.marginPreset === 'narrow'
        ? { top: 720, bottom: 720, left: 720, right: 720 }
        : docData.marginPreset === 'wide'
          ? { top: 1800, bottom: 1800, left: 1800, right: 1800 }
          : { top: 1440, bottom: 1440, left: 1440, right: 1440 };

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: pageMargin,
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (title || 'SlaydCanva-hujjat').trim().replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${safeName}.docx`;
  if (options?.download !== false) {
    await triggerSafeFileDownload({ blob, fileName });
  }
  return { blob, fileName };
}
