import { CanvasPage, PdfOrientation, SlaydCanvaState } from '../types/editor';

export const PPTX_CANVAS = {
  width: 960,
  height: 540,
} as const;

export function getPdfDimensions(orientation: PdfOrientation) {
  return orientation === 'portrait'
    ? { width: 794, height: 1123 }
    : { width: 1123, height: 794 };
}

export const FONT_OPTIONS = [
  { label: 'DM Sans', value: 'DM Sans, sans-serif', exportFont: 'Arial' },
  { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif', exportFont: 'Calibri' },
  { label: 'Georgia', value: 'Georgia, serif', exportFont: 'Georgia' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace', exportFont: 'Courier New' },
] as const;

export const PAGE_COLORS = [
  '#FFFFFF',
  '#F8FAFC',
  '#F1F5F9',
  '#0F172A',
  '#1E293B',
  '#EFF6FF',
  '#F0FDF4',
  '#FEFCE8',
] as const;

export const ELEMENT_COLORS = [
  '#0F172A',
  '#334155',
  '#64748B',
  '#FFFFFF',
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#E2E8F0',
  '#DBEAFE',
] as const;

export function uid(prefix = 'el'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-4)}`;
}

export function createInitialPptxPages(): CanvasPage[] {
  return [
    {
      id: 'slide_1',
      background: '#FFFFFF',
      elements: [
        {
          id: uid('rect'),
          type: 'rect',
          x: 64,
          y: 120,
          width: 72,
          height: 6,
          fill: '#2563EB',
          stroke: 'transparent',
          strokeWidth: 0,
          borderRadius: 3,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 148,
          width: 760,
          height: 110,
          text: 'Taqdimot sarlavhasi',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 44,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#0F172A',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 268,
          width: 680,
          height: 70,
          text: "Matnni tahrirlash uchun ikki marta bosing yoki yuqori paneldan yangi element qo'shing.",
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 20,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#475569',
        },
      ],
    },
    {
      id: 'slide_2',
      background: '#FFFFFF',
      elements: [
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 56,
          width: 820,
          height: 58,
          text: "Asosiy bo'lim",
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 32,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#0F172A',
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: 64,
          y: 138,
          width: 400,
          height: 310,
          fill: '#F8FAFC',
          stroke: '#E2E8F0',
          strokeWidth: 1,
          borderRadius: 8,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 88,
          y: 164,
          width: 350,
          height: 240,
          text: "1-qism ma'lumotlari.\nBu yerga asosiy fikrlar va raqamlarni yozing.",
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 18,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#334155',
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: 496,
          y: 138,
          width: 400,
          height: 310,
          fill: '#F8FAFC',
          stroke: '#E2E8F0',
          strokeWidth: 1,
          borderRadius: 8,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 520,
          y: 164,
          width: 350,
          height: 240,
          text: "2-qism ma'lumotlari.\nElementlarni sudrab joyini va o'lchamini o'zgartirishingiz mumkin.",
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 18,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#334155',
        },
      ],
    },
  ];
}

export function createInitialPdfPages(): CanvasPage[] {
  return [
    {
      id: 'pdf_1',
      background: '#FFFFFF',
      elements: [
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 68,
          width: 666,
          height: 60,
          text: 'PDF Hujjat Sarlavhasi',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 32,
          fontWeight: 'bold',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#0F172A',
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: 64,
          y: 136,
          width: 666,
          height: 2,
          fill: '#E2E8F0',
          stroke: 'transparent',
          strokeWidth: 0,
          borderRadius: 0,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 168,
          width: 666,
          height: 180,
          text: "Bu A4 PDF sahifa muhiti. Matn, shakl va rasmlarni joylashtirib, to'g'ridan-to'g'ri PDF formatida yuklab olishingiz mumkin.",
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 16,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign: 'left',
          color: '#334155',
        },
      ],
    },
  ];
}

export const INITIAL_WORD_HTML = `<h1>Hujjat sarlavhasi</h1>
<p>Bu Word (.docx) va PDF formatlariga eksport qilinadigan toza matn muhiti. Matnni to'g'ridan-to'g'ri yozishingiz, sarlavhalar, ro'yxatlar, jadval va rasmlar qo'shishingiz mumkin.</p>
<h2>Asosiy bo'lim</h2>
<p>Muhim bandlarni ajratib ko'rsatish uchun yuqoridagi formatlash panelidan foydalaning:</p>
<ul>
  <li>Sarlavha darajalari (H1, H2, H3)</li>
  <li>Qalin, kursiv, tagiga chizilgan matn va ranglar</li>
  <li>Jadvallar va rasmlar joylashtirish</li>
</ul>`;

export function formatSom(amount: number): string {
  return `${amount.toLocaleString('uz-UZ').replace(/,/g, ' ')} so'm`;
}

export function createInitialState(): SlaydCanvaState {
  const pptxPages = createInitialPptxPages();
  const pdfPages = createInitialPdfPages();
  return {
    mode: 'pptx',
    docTitle: 'Yangi loyiha',
    pptxPages,
    activePptxId: pptxPages[0].id,
    pdfPages,
    pdfOrientation: 'portrait',
    activePdfId: pdfPages[0].id,
    wordDoc: {
      html: INITIAL_WORD_HTML,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 15,
      marginPreset: 'normal',
    },
    balance: 50000,
    transactions: [
      {
        id: 'tx_init_1',
        title: "Boshlang'ich hisob",
        method: 'Tizim',
        amount: 50000,
        date: '25.11.2026',
      },
    ],
    profile: {
      fullName: 'Foydalanuvchi',
      contact: 'tuyginovsardor4@gmail.com',
    },
  };
}
