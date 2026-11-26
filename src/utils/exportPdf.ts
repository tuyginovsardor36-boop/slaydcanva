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
  orientation: PdfOrientation = 'portrait'
): Promise<void> {
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
    pdf.save(`${safeName}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}

export async function exportCanvasPageToPng(
  page: CanvasPage,
  title: string,
  kind: 'pptx' | 'pdf',
  orientation: PdfOrientation = 'portrait'
): Promise<void> {
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
    const a = document.createElement('a');
    const safeName = (title || 'SlaydCanva').trim().replace(/[\\/:*?"<>|]/g, '_');
    a.href = dataUrl;
    a.download = `${safeName}.png`;
    a.click();
  } finally {
    document.body.removeChild(host);
  }
}

export async function exportWordElementToPdf(
  element: HTMLElement,
  title: string
): Promise<void> {
  const pageW = 794;
  const pageH = 1123;

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

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [pageW, pageH],
    hotfixes: ['px_scaling'],
  });

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
  pdf.save(`${safeName}.pdf`);
}
