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

function dataUrlToUint8Array(dataUrl: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' } | null {
  try {
    const [meta, base64] = dataUrl.split(',');
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const type = meta.includes('png') ? 'png' : meta.includes('gif') ? 'gif' : 'jpg';
    return { data: bytes, type };
  } catch {
    return null;
  }
}

export async function exportToDocx(docData: WordDocumentData, title: string): Promise<void> {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${docData.html}</div>`, 'text/html');
  const root = parsed.body.firstElementChild as HTMLElement | null;

  const fontMeta = FONT_OPTIONS.find((f) => f.value === docData.fontFamily);
  const defaultFont = fontMeta ? fontMeta.exportFont : 'Arial';
  const baseSizePt = Math.max(10, Math.round(docData.fontSize * 0.75));

  const children: Array<Paragraph | Table> = [];

  const processElement = (el: HTMLElement) => {
    const tag = el.tagName.toLowerCase();

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      const headingMap = {
        h1: HeadingLevel.HEADING_1,
        h2: HeadingLevel.HEADING_2,
        h3: HeadingLevel.HEADING_3,
      } as const;
      const sizeMap = { h1: 20, h2: 16, h3: 13 } as const;
      const runs = collectRuns(
        el,
        { bold: true, size: sizeMap[tag], color: '0F172A' },
        defaultFont,
        sizeMap[tag]
      );
      children.push(
        new Paragraph({
          heading: headingMap[tag],
          alignment: getAlignment(el),
          spacing: { before: 200, after: 120 },
          children: runs.length ? runs : [new TextRun('')],
        })
      );
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(el.querySelectorAll(':scope > li'));
      items.forEach((li, index) => {
        const runs = collectRuns(li, {}, defaultFont, baseSizePt);
        if (tag === 'ul') {
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 80 },
              children: runs.length ? runs : [new TextRun('')],
            })
          );
        } else {
          children.push(
            new Paragraph({
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
      children.push(
        new Paragraph({
          border: {
            bottom: { color: 'CBD5E1', size: 6, space: 1, style: BorderStyle.SINGLE },
          },
          spacing: { before: 120, after: 120 },
        })
      );
      return;
    }

    if (tag === 'img') {
      const src = el.getAttribute('src');
      if (src && src.startsWith('data:image')) {
        const imgData = dataUrlToUint8Array(src);
        if (imgData) {
          children.push(
            new Paragraph({
              spacing: { before: 120, after: 120 },
              children: [
                new ImageRun({
                  data: imgData.data,
                  transformation: { width: 420, height: 260 },
                  type: imgData.type,
                }),
              ],
            })
          );
        }
      }
      return;
    }

    // Check for inline images inside paragraphs/divs
    const imgs = el.querySelectorAll('img');
    if (imgs.length > 0 && el.textContent?.trim() === '') {
      imgs.forEach((img) => processElement(img as HTMLElement));
      return;
    }

    const runs = collectRuns(el, {}, defaultFont, baseSizePt);
    children.push(
      new Paragraph({
        alignment: getAlignment(el),
        spacing: { after: 140 },
        children: runs.length ? runs : [new TextRun('')],
      })
    );
  };

  if (root) {
    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          children.push(
            new Paragraph({
              spacing: { after: 140 },
              children: [new TextRun({ text, font: defaultFont, size: baseSizePt * 2 })],
            })
          );
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        processElement(node as HTMLElement);
      }
    });
  }

  if (children.length === 0) {
    children.push(new Paragraph({ text: '' }));
  }

  const marginTwips =
    docData.marginPreset === 'narrow' ? 720 : docData.marginPreset === 'wide' ? 1800 : 1440;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginTwips,
              bottom: marginTwips,
              left: marginTwips,
              right: marginTwips,
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (title || 'SlaydCanva-hujjat').trim().replace(/[\\/:*?"<>|]/g, '_');
  a.href = url;
  a.download = `${safeName}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
