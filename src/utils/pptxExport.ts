import PptxGenJS from 'pptxgenjs';
import { Deck, Slide, ThemeConfig } from '../types/deck';
import { PRESENTATION_THEMES } from '../constants/themes';

function hex(color: string): string {
  return color.replace('#', '').toUpperCase();
}

async function resolveImageDataUri(url?: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportDeckToPptx(deck: Deck): Promise<void> {
  const pptx = new PptxGenJS();
  const theme: ThemeConfig = PRESENTATION_THEMES[deck.themeId] ?? PRESENTATION_THEMES['swiss-ivory'];

  pptx.layout = 'LAYOUT_16x9';
  pptx.title = deck.title;
  pptx.subject = deck.subtitle || 'Generated with Folio';

  const bg = hex(theme.bgHex);
  const surface = hex(theme.surfaceHex);
  const border = hex(theme.borderHex);
  const ink = hex(theme.inkHex);
  const muted = hex(theme.mutedHex);
  const accent = hex(theme.accentHex);
  const titleFace = theme.titleFont === 'serif' ? 'Georgia' : 'Arial';
  const bodyFace = 'Arial';

  for (let i = 0; i < deck.slides.length; i++) {
    const s: Slide = deck.slides[i];
    const slide = pptx.addSlide();
    slide.background = { color: bg };

    if (s.speakerNotes) {
      slide.addNotes(s.speakerNotes);
    }

    const slideNum = String(i + 1).padStart(2, '0');

    // Subtle footer page index on non-title slides
    if (s.layout !== 'title') {
      slide.addText(`${deck.title}  ·  ${slideNum}`, {
        x: 0.65,
        y: 5.2,
        w: 8.7,
        h: 0.28,
        fontSize: 9,
        fontFace: bodyFace,
        color: muted,
        align: 'right',
      });
    }

    if (s.layout === 'title') {
      const imgData = await resolveImageDataUri(s.imageUrl);
      if (imgData) {
        slide.addImage({
          data: imgData,
          x: 5.55,
          y: 0.55,
          w: 3.9,
          h: 4.5,
          sizing: { type: 'cover', w: 3.9, h: 4.5 },
        });
      }

      const textW = imgData ? 4.65 : 8.6;
      if (s.kicker) {
        slide.addText(s.kicker, {
          x: 0.65,
          y: 1.05,
          w: textW,
          h: 0.35,
          fontSize: 11,
          bold: true,
          fontFace: bodyFace,
          color: accent,
        });
      }
      slide.addText(s.title, {
        x: 0.65,
        y: 1.5,
        w: textW,
        h: 1.65,
        fontSize: 34,
        bold: true,
        fontFace: titleFace,
        color: ink,
        valign: 'top',
      });
      if (s.subtitle) {
        slide.addText(s.subtitle, {
          x: 0.65,
          y: 3.25,
          w: textW,
          h: 1.0,
          fontSize: 14,
          fontFace: bodyFace,
          color: muted,
          valign: 'top',
        });
      }
      if (s.callout) {
        slide.addText(s.callout, {
          x: 0.65,
          y: 4.55,
          w: textW,
          h: 0.4,
          fontSize: 10,
          fontFace: bodyFace,
          color: muted,
        });
      }
      continue;
    }

    // Standard header for content layouts
    if (s.kicker) {
      slide.addText(s.kicker, {
        x: 0.65,
        y: 0.42,
        w: 8.7,
        h: 0.28,
        fontSize: 10,
        bold: true,
        fontFace: bodyFace,
        color: accent,
      });
    }
    slide.addText(s.title, {
      x: 0.65,
      y: 0.7,
      w: 8.7,
      h: 0.55,
      fontSize: 23,
      bold: true,
      fontFace: titleFace,
      color: ink,
    });
    if (s.subtitle && s.layout !== 'quote') {
      slide.addText(s.subtitle, {
        x: 0.65,
        y: 1.24,
        w: 8.7,
        h: 0.38,
        fontSize: 12,
        fontFace: bodyFace,
        color: muted,
      });
    }

    const contentTop = s.subtitle ? 1.75 : 1.42;

    if (s.layout === 'bullets') {
      const items = (s.bullets ?? []).map((b) => ({
        text: b,
        options: { bullet: { indent: 14 }, paraSpaceAfter: 10 },
      }));
      if (items.length > 0) {
        slide.addText(items, {
          x: 0.65,
          y: contentTop,
          w: 8.7,
          h: 2.8,
          fontSize: 14,
          fontFace: bodyFace,
          color: ink,
          valign: 'top',
        });
      }
      if (s.callout) {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.65,
          y: 4.45,
          w: 8.7,
          h: 0.55,
          fill: { color: surface },
          line: { color: border, width: 1 },
        });
        slide.addText(s.callout, {
          x: 0.85,
          y: 4.53,
          w: 8.3,
          h: 0.4,
          fontSize: 11,
          bold: true,
          fontFace: bodyFace,
          color: ink,
        });
      }
    } else if (s.layout === 'two-column') {
      const cols = (s.columns ?? []).slice(0, 2);
      cols.forEach((col, colIdx) => {
        const x = colIdx === 0 ? 0.65 : 5.15;
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y: contentTop,
          w: 4.2,
          h: 3.15,
          fill: { color: surface },
          line: { color: border, width: 1 },
        });
        slide.addText(col.title, {
          x: x + 0.25,
          y: contentTop + 0.22,
          w: 3.7,
          h: 0.38,
          fontSize: 14,
          bold: true,
          fontFace: titleFace,
          color: ink,
        });
        const items = col.items.map((item) => ({
          text: item,
          options: { bullet: { indent: 12 }, paraSpaceAfter: 8 },
        }));
        if (items.length > 0) {
          slide.addText(items, {
            x: x + 0.25,
            y: contentTop + 0.68,
            w: 3.7,
            h: 2.25,
            fontSize: 11.5,
            fontFace: bodyFace,
            color: muted,
            valign: 'top',
          });
        }
      });
    } else if (s.layout === 'metrics') {
      const metrics = (s.metrics ?? []).slice(0, 4);
      const count = Math.max(metrics.length, 1);
      const gap = 0.22;
      const totalW = 8.7;
      const cardW = (totalW - gap * (count - 1)) / count;
      metrics.forEach((m, idx) => {
        const x = 0.65 + idx * (cardW + gap);
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y: contentTop + 0.1,
          w: cardW,
          h: 2.35,
          fill: { color: surface },
          line: { color: border, width: 1 },
        });
        slide.addText(m.value, {
          x: x + 0.2,
          y: contentTop + 0.35,
          w: cardW - 0.4,
          h: 0.7,
          fontSize: 26,
          bold: true,
          fontFace: titleFace,
          color: ink,
        });
        slide.addText(m.label, {
          x: x + 0.2,
          y: contentTop + 1.12,
          w: cardW - 0.4,
          h: 0.6,
          fontSize: 11,
          fontFace: bodyFace,
          color: muted,
          valign: 'top',
        });
        if (m.delta) {
          slide.addText(m.delta, {
            x: x + 0.2,
            y: contentTop + 1.85,
            w: cardW - 0.4,
            h: 0.35,
            fontSize: 10.5,
            bold: true,
            fontFace: bodyFace,
            color: accent,
          });
        }
      });
      if (s.callout) {
        slide.addText(s.callout, {
          x: 0.65,
          y: 4.5,
          w: 8.7,
          h: 0.45,
          fontSize: 11.5,
          fontFace: bodyFace,
          color: muted,
        });
      }
    } else if (s.layout === 'process') {
      const steps = (s.steps ?? []).slice(0, 4);
      const count = Math.max(steps.length, 1);
      const gap = 0.22;
      const cardW = (8.7 - gap * (count - 1)) / count;
      steps.forEach((st, idx) => {
        const x = 0.65 + idx * (cardW + gap);
        slide.addShape(pptx.ShapeType.rect, {
          x,
          y: contentTop + 0.15,
          w: cardW,
          h: 2.8,
          fill: { color: surface },
          line: { color: border, width: 1 },
        });
        slide.addText(st.number, {
          x: x + 0.2,
          y: contentTop + 0.35,
          w: cardW - 0.4,
          h: 0.35,
          fontSize: 13,
          bold: true,
          fontFace: bodyFace,
          color: accent,
        });
        slide.addText(st.title, {
          x: x + 0.2,
          y: contentTop + 0.78,
          w: cardW - 0.4,
          h: 0.55,
          fontSize: 13,
          bold: true,
          fontFace: titleFace,
          color: ink,
          valign: 'top',
        });
        slide.addText(st.description, {
          x: x + 0.2,
          y: contentTop + 1.4,
          w: cardW - 0.4,
          h: 1.35,
          fontSize: 10.5,
          fontFace: bodyFace,
          color: muted,
          valign: 'top',
        });
      });
    } else if (s.layout === 'table' && s.table) {
      const tableRows: PptxGenJS.TableRow[] = [
        s.table.headers.map((h) => ({
          text: h,
          options: {
            bold: true,
            fill: { color: surface },
            color: ink,
            fontSize: 11,
            fontFace: bodyFace,
          },
        })),
        ...s.table.rows.map((row) =>
          row.map((cell) => ({
            text: cell,
            options: {
              fill: { color: bg },
              color: muted,
              fontSize: 10.5,
              fontFace: bodyFace,
            },
          }))
        ),
      ];
      slide.addTable(tableRows, {
        x: 0.65,
        y: contentTop,
        w: 8.7,
        border: { type: 'solid', pt: 0.75, color: border },
        margin: [6, 8, 6, 8],
      });
      if (s.callout) {
        slide.addText(s.callout, {
          x: 0.65,
          y: 4.55,
          w: 8.7,
          h: 0.4,
          fontSize: 11,
          bold: true,
          fontFace: bodyFace,
          color: accent,
        });
      }
    } else if (s.layout === 'quote') {
      slide.addText(`“${s.quote || s.title}”`, {
        x: 0.9,
        y: 1.7,
        w: 8.2,
        h: 2.1,
        fontSize: 22,
        italic: true,
        fontFace: titleFace,
        color: ink,
        valign: 'middle',
      });
      if (s.attribution) {
        slide.addText(`— ${s.attribution}`, {
          x: 0.9,
          y: 4.0,
          w: 8.2,
          h: 0.45,
          fontSize: 12,
          fontFace: bodyFace,
          color: accent,
        });
      }
    } else if (s.layout === 'visual-split') {
      const bullets = (s.bullets ?? []).map((b) => ({
        text: b,
        options: { bullet: { indent: 12 }, paraSpaceAfter: 9 },
      }));
      if (bullets.length > 0) {
        slide.addText(bullets, {
          x: 0.65,
          y: contentTop,
          w: 4.15,
          h: 3.1,
          fontSize: 12.5,
          fontFace: bodyFace,
          color: ink,
          valign: 'top',
        });
      }

      if (s.chart && s.chart.points.length > 0) {
        const chartType =
          s.chart.type === 'line'
            ? pptx.ChartType.line
            : s.chart.type === 'donut'
              ? pptx.ChartType.doughnut
              : pptx.ChartType.bar;
        slide.addChart(
          chartType,
          [
            {
              name: s.chart.title,
              labels: s.chart.points.map((p) => p.label),
              values: s.chart.points.map((p) => p.value),
            },
          ],
          {
            x: 5.05,
            y: contentTop - 0.1,
            w: 4.3,
            h: 3.2,
            showTitle: true,
            title: s.chart.title,
            titleColor: ink,
            titleFontSize: 11,
            chartColors: theme.chartPalette.map(hex),
            valAxisLabelColor: muted,
            catAxisLabelColor: muted,
            showLegend: s.chart.type === 'donut',
          }
        );
      } else if (s.imageUrl) {
        const imgData = await resolveImageDataUri(s.imageUrl);
        if (imgData) {
          slide.addImage({
            data: imgData,
            x: 5.05,
            y: contentTop,
            w: 4.3,
            h: 3.05,
            sizing: { type: 'cover', w: 4.3, h: 3.05 },
          });
        }
      }
    }
  }

  const safeName = deck.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  await pptx.writeFile({ fileName: `${safeName || 'presentation'}.pptx` });
}
