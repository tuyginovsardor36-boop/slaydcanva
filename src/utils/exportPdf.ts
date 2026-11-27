import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getPdfDimensions, PPTX_CANVAS } from '../data/defaults';
import { CanvasPage, PdfOrientation } from '../types/editor';

function buildOffscreenPageNode(page: CanvasPage, width: number, height: number): HTMLDivElement {
  const container = document.createElement('div');
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.backgroundColor = page.background || '#FFFFFF';

  if (page.backgroundImage) {
    const bgImg = document.createElement('img');
    bgImg.src = page.backgroundImage;
    bgImg.style.position = 'absolute';
    bgImg.style.left = '0';
    bgImg.style.top = '0';
    bgImg.style.width = '100%';
    bgImg.style.height = '100%';
    bgImg.style.objectFit = 'cover';
    container.appendChild(bgImg);
  }

  for (const el of page.elements) {
    const node = document.createElement('div');
    node.style.position = 'absolute';
    node.style.left = `${el.x}px`;
    node.style.top = `${el.y}px`;
    node.style.width = `${el.width}px`;
    node.style.height = `${el.height}px`;
    node.style.boxSizing = 'border-box';

    if (el.type === 'text') {
      node.style.fontFamily = el.fontFamily || 'DM Sans, sans-serif';
      node.style.fontSize = `${el.fontSize || 18}px`;
      node.style.fontWeight = el.fontWeight || 'normal';
      node.style.fontStyle = el.fontStyle || 'normal';
      node.style.textDecoration = el.textDecoration || 'none';
      node.style.textAlign = el.textAlign || 'left';
      node.style.color = el.color || '#0F172A';
      node.style.whiteSpace = 'pre-wrap';
      node.style.wordBreak = 'break-word';
      node.style.lineHeight = String(el.lineHeight || 1.35);
      const pad = el.padding !== undefined ? el.padding : 4;
      node.style.padding = `${pad}px ${pad + 2}px`;
      node.textContent = el.text || '';
    } else if (el.type === 'rect') {
      if (el.gradient) {
        node.style.background = el.gradient;
      } else {
        node.style.backgroundColor = el.fill || '#E2E8F0';
      }
      node.style.borderRadius = `${el.borderRadius || 0}px`;
      if (el.shadow) {
        node.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.08)';
      }
      if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0) {
        node.style.border = `${el.strokeWidth}px solid ${el.stroke}`;
      }
    } else if (el.type === 'circle') {
      if (el.gradient) {
        node.style.background = el.gradient;
      } else {
        node.style.backgroundColor = el.fill || '#DBEAFE';
      }
      node.style.borderRadius = '9999px';
      if (el.shadow) {
        node.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.1)';
      }
      if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0) {
        node.style.border = `${el.strokeWidth}px solid ${el.stroke}`;
      }
    } else if (el.type === 'image' && el.src) {
      if (el.borderRadius) {
        node.style.borderRadius = `${el.borderRadius}px`;
        node.style.overflow = 'hidden';
      }
      if (el.shadow) {
        node.style.boxShadow = '0 10px 26px rgba(15, 23, 42, 0.14)';
      }
      const img = document.createElement('img');
      img.src = el.src;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = el.imageFit === 'cover' ? 'cover' : 'contain';
      img.style.display = 'block';
      if (el.borderRadius) {
        img.style.borderRadius = `${el.borderRadius}px`;
      }
      node.appendChild(img);
    }

    container.appendChild(node);
  }

  return container;
}

export async function exportCanvasPagesToPdf(
  pages: CanvasPage[],
  title: string,
  kind: 'pptx' | 'pdf',
  orientation: PdfOrientation = 'portrait',
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const dims = kind === 'pptx' ? PPTX_CANVAS : getPdfDimensions(orientation);
  const isLandscape = dims.width > dims.height;

  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  try {
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [dims.width, dims.height],
      hotfixes: ['px_scaling'],
    });

    for (let i = 0; i < pages.length; i++) {
      const pageNode = buildOffscreenPageNode(pages[i], dims.width, dims.height);
      host.innerHTML = '';
      host.appendChild(pageNode);

      const dataUrl = await toPng(pageNode, {
        width: dims.width,
        height: dims.height,
        pixelRatio: 2,
        cacheBust: true,
      });

      if (i > 0) {
        pdf.addPage([dims.width, dims.height], isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(dataUrl, 'PNG', 0, 0, dims.width, dims.height);
    }

    const safeName = (title || 'SlaydCanva').trim().replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeName}.pdf`;
    const blob = pdf.output('blob');
    if (options?.download !== false) {
      pdf.save(fileName);
    }
    return { blob, fileName };
  } finally {
    document.body.removeChild(host);
  }
}

export async function exportCanvasPageToPng(
  page: CanvasPage,
  title: string,
  kind: 'pptx' | 'pdf',
  orientation: PdfOrientation = 'portrait',
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const dims = kind === 'pptx' ? PPTX_CANVAS : getPdfDimensions(orientation);
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  try {
    const pageNode = buildOffscreenPageNode(page, dims.width, dims.height);
    host.appendChild(pageNode);
    const dataUrl = await toPng(pageNode, {
      width: dims.width,
      height: dims.height,
      pixelRatio: 2,
      cacheBust: true,
    });
    const safeName = (title || 'SlaydCanva').trim().replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeName}.png`;
    if (options?.download !== false) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    }
    const blob = await (await fetch(dataUrl)).blob();
    return { blob, fileName };
  } finally {
    document.body.removeChild(host);
  }
}

export async function exportWordElementToPdf(
  element: HTMLElement,
  title: string,
  options?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const pageW = 794;
  const pageH = 1123;

  const contentRoot = element.querySelector('.word-editor-content') as HTMLElement | null;
  const computedPaper = window.getComputedStyle(element);
  const padTop = parseFloat(computedPaper.paddingTop) || 48;
  const padRight = parseFloat(computedPaper.paddingRight) || 48;
  const padBottom = parseFloat(computedPaper.paddingBottom) || 48;
  const padLeft = parseFloat(computedPaper.paddingLeft) || 72;
  const fontFamily = computedPaper.fontFamily || 'Times New Roman, Times, serif';
  const fontSize = computedPaper.fontSize || '16px';
  const maxInnerHeight = pageH - padTop - padBottom;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [pageW, pageH],
    hotfixes: ['px_scaling'],
  });

  if (contentRoot) {
    // Split document at explicit <hr class="doc-page-break" /> markers
    const sections: HTMLElement[][] = [[]];
    Array.from(contentRoot.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName.toLowerCase() === 'hr' && el.classList.contains('doc-page-break')) {
          if (sections[sections.length - 1].length > 0) {
            sections.push([]);
          }
          return;
        }
        sections[sections.length - 1].push(el.cloneNode(true) as HTMLElement);
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        const p = document.createElement('p');
        p.textContent = node.textContent;
        sections[sections.length - 1].push(p);
      }
    });

    const nonEmptySections = sections.filter((s) => s.length > 0);
    if (nonEmptySections.length > 0) {
      const host = document.createElement('div');
      host.style.position = 'fixed';
      host.style.left = '-99999px';
      host.style.top = '0';
      host.style.zIndex = '-1';
      document.body.appendChild(host);

      try {
        const createA4PageShell = () => {
          const shell = document.createElement('div');
          shell.style.width = `${pageW}px`;
          shell.style.height = `${pageH}px`;
          shell.style.backgroundColor = '#FFFFFF';
          shell.style.padding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;
          shell.style.boxSizing = 'border-box';
          shell.style.fontFamily = fontFamily;
          shell.style.fontSize = fontSize;
          shell.style.overflow = 'hidden';

          const inner = document.createElement('div');
          inner.className = 'word-editor-content';
          shell.appendChild(inner);
          return { shell, inner };
        };

        let pdfPageCount = 0;

        for (const secNodes of nonEmptySections) {
          let current = createA4PageShell();
          host.innerHTML = '';
          host.appendChild(current.shell);

          for (const node of secNodes) {
            const cloned = node.cloneNode(true) as HTMLElement;
            current.inner.appendChild(cloned);

            // Check if adding this node overflows printable A4 height
            if (current.inner.scrollHeight > maxInnerHeight && current.inner.children.length > 1) {
              current.inner.removeChild(cloned);
              const pagePng = await toPng(current.shell, {
                width: pageW,
                height: pageH,
                backgroundColor: '#FFFFFF',
                pixelRatio: 2,
                cacheBust: true,
              });
              if (pdfPageCount > 0) pdf.addPage([pageW, pageH], 'portrait');
              pdf.addImage(pagePng, 'PNG', 0, 0, pageW, pageH);
              pdfPageCount += 1;

              current = createA4PageShell();
              host.innerHTML = '';
              host.appendChild(current.shell);
              current.inner.appendChild(cloned);
            }
          }

          if (current.inner.children.length > 0) {
            const pagePng = await toPng(current.shell, {
              width: pageW,
              height: pageH,
              backgroundColor: '#FFFFFF',
              pixelRatio: 2,
              cacheBust: true,
            });
            if (pdfPageCount > 0) pdf.addPage([pageW, pageH], 'portrait');
            pdf.addImage(pagePng, 'PNG', 0, 0, pageW, pageH);
            pdfPageCount += 1;
          }
        }

        const safeName = (title || 'SlaydCanva-hujjat').trim().replace(/[\\/:*?"<>|]/g, '_');
        const fileName = `${safeName}.pdf`;
        const blob = pdf.output('blob');
        if (options?.download !== false) {
          pdf.save(fileName);
        }
        return { blob, fileName };
      } finally {
        document.body.removeChild(host);
      }
    }
  }

  // Fallback raw capture
  const dataUrl = await toPng(element, {
    backgroundColor: '#FFFFFF',
    pixelRatio: 2,
    cacheBust: true,
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const imgWidth = pageW;
  const imgHeight = (img.height * pageW) / img.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageH;

  while (heightLeft > 2) {
    position = heightLeft - imgHeight;
    pdf.addPage([pageW, pageH], 'portrait');
    pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageH;
  }

  const safeName = (title || 'SlaydCanva-hujjat').trim().replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${safeName}.pdf`;
  const blob = pdf.output('blob');
  if (options?.download !== false) {
    pdf.save(fileName);
  }
  return { blob, fileName };
}
