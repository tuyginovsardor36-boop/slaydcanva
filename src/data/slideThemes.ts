import { uid } from './defaults';
import { AiTone, CanvasElement, CanvasPage, SlideDesignTheme } from '../types/editor';

export interface SlideThemeDefinition {
  id: SlideDesignTheme;
  name: string;
  tagline: string;
  isDark: boolean;
  titleBg: string;
  pageBg: string;
  altPageBg: string;
  surfaceFill: string;
  surfaceStroke: string;
  headingColor: string;
  bodyColor: string;
  mutedColor: string;
  primaryAccent: string;
  secondaryAccent: string;
  accents: string[];
  dividerColor: string;
  headingFont: string;
  bodyFont: string;
  getTitleBgSvg: () => string;
  getContentBgSvg: () => string;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeWaveSvg(
  bgStart: string,
  bgEnd: string,
  wave1: string,
  wave2: string,
  dotColor: string,
  circleTint: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="bgG" x1="0" y1="0" x2="1" y2="0.25">
      <stop offset="0%" stop-color="${bgStart}"/>
      <stop offset="100%" stop-color="${bgEnd}"/>
    </linearGradient>
    <linearGradient id="waveG" x1="0" y1="0" x2="1" y2="0.7">
      <stop offset="0%" stop-color="${wave1}"/>
      <stop offset="100%" stop-color="${wave2}"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#bgG)"/>
  <circle cx="32" cy="28" r="76" fill="${circleTint}" fill-opacity="0.16"/>
  <circle cx="90" cy="488" r="96" fill="${circleTint}" fill-opacity="0.12"/>
  <path d="M 790 0 C 858 88, 848 165, 792 238 C 728 320, 725 408, 828 540 L 960 540 L 960 0 Z" fill="url(#waveG)"/>
  <path d="M 856 0 C 826 88, 842 164, 882 234 C 918 298, 926 386, 864 468 L 832 540 L 960 540 L 960 0 Z" fill="${wave2}" fill-opacity="0.26"/>
  <circle cx="852" cy="62" r="11" fill="${dotColor}" fill-opacity="0.9"/>
</svg>`;
  return svgToDataUri(svg);
}

function makeSubtleCornerSvg(bg: string, accent: string, accent2: string, borderCol: string, isDark: boolean): string {
  const op1 = isDark ? '0.16' : '0.09';
  const op2 = isDark ? '0.12' : '0.06';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="${bg}"/>
  <path d="M 820 0 C 885 110, 870 245, 808 335 C 756 410, 770 482, 855 540 L 960 540 L 960 0 Z" fill="${accent}" fill-opacity="${op1}"/>
  <circle cx="870" cy="64" r="8" fill="${accent2}" fill-opacity="0.5"/>
  <circle cx="72" cy="496" r="110" fill="${accent2}" fill-opacity="${op2}"/>
  <line x1="40" y1="508" x2="920" y2="508" stroke="${borderCol}" stroke-width="1.2"/>
</svg>`;
  return svgToDataUri(svg);
}

export const SLIDE_THEMES: SlideThemeDefinition[] = [
  {
    id: 'academic_gold',
    name: 'Oltin Akademik',
    tagline: "Klassik o'quv va himoya uslubi",
    isDark: false,
    titleBg: '#FFD443',
    pageBg: '#FFFDF7',
    altPageBg: '#FFFFFF',
    surfaceFill: '#FAF6EE',
    surfaceStroke: '#E7DEC8',
    headingColor: '#0F172A',
    bodyColor: '#1E293B',
    mutedColor: '#475569',
    primaryAccent: '#1E40AF',
    secondaryAccent: '#D94E41',
    accents: ['#EB6A5B', '#F2A34C', '#2563EB', '#68B684', '#9B7EDE', '#D97706'],
    dividerColor: '#E2D6BA',
    headingFont: 'Georgia, serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#F7B12E', '#FFD84B', '#1E40AF', '#60A5FA', '#FDEFD2', '#D99B16'),
    getContentBgSvg: () => makeSubtleCornerSvg('#FFFDF7', '#F59E0B', '#2563EB', '#E7DEC8', false),
  },
  {
    id: 'royal_navy',
    name: "Qirollik Ko'k",
    tagline: 'Nufuzli boshqaruv va ilmiy kengash',
    isDark: true,
    titleBg: '#0B132B',
    pageBg: '#0F172A',
    altPageBg: '#131F38',
    surfaceFill: '#1E293B',
    surfaceStroke: '#334155',
    headingColor: '#F8FAFC',
    bodyColor: '#E2E8F0',
    mutedColor: '#94A3B8',
    primaryAccent: '#D4AF37',
    secondaryAccent: '#38BDF8',
    accents: ['#D4AF37', '#38BDF8', '#34D399', '#F472B6', '#A78BFA', '#FB923C'],
    dividerColor: '#334155',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#0B132B', '#1C2541', '#D4AF37', '#3B82F6', '#FDE68A', '#38BDF8'),
    getContentBgSvg: () => makeSubtleCornerSvg('#0F172A', '#3B82F6', '#D4AF37', '#334155', true),
  },
  {
    id: 'crimson_dark',
    name: 'Qora & Yoqut',
    tagline: 'Kuchli kontrastli taqdimot',
    isDark: true,
    titleBg: '#0F0F12',
    pageBg: '#111116',
    altPageBg: '#18181F',
    surfaceFill: '#1F1F27',
    surfaceStroke: '#32323E',
    headingColor: '#FFFFFF',
    bodyColor: '#E4E4E7',
    mutedColor: '#A1A1AA',
    primaryAccent: '#DC2626',
    secondaryAccent: '#F59E0B',
    accents: ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#A855F7', '#EC4899'],
    dividerColor: '#2E2E38',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#0F0F12', '#18181F', '#DC2626', '#991B1B', '#FFFFFF', '#DC2626'),
    getContentBgSvg: () => makeSubtleCornerSvg('#111116', '#DC2626', '#F59E0B', '#2E2E38', true),
  },
  {
    id: 'clean_white',
    name: 'Minimalist Oq',
    tagline: 'Toza va zamonaviy tahririy uslub',
    isDark: false,
    titleBg: '#FFFFFF',
    pageBg: '#FFFFFF',
    altPageBg: '#F8FAFC',
    surfaceFill: '#F6F7FA',
    surfaceStroke: '#E2E8F0',
    headingColor: '#0F172A',
    bodyColor: '#334155',
    mutedColor: '#64748B',
    primaryAccent: '#2563EB',
    secondaryAccent: '#EE6C5D',
    accents: ['#2563EB', '#EE6C5D', '#10B981', '#F59E0B', '#7C3AED', '#0EA5E9'],
    dividerColor: '#E2E8F0',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeSubtleCornerSvg('#FFFFFF', '#3B82F6', '#60A5FA', '#E2E8F0', false),
    getContentBgSvg: () => makeSubtleCornerSvg('#FFFFFF', '#2563EB', '#0EA5E9', '#E2E8F0', false),
  },
  {
    id: 'emerald_green',
    name: 'Zumrad Ilmiy',
    tagline: 'Tabiiy fanlar, tibbiyot va ekologiya',
    isDark: false,
    titleBg: '#F0FDF4',
    pageBg: '#F7FDF9',
    altPageBg: '#FFFFFF',
    surfaceFill: '#ECFDF5',
    surfaceStroke: '#BBF7D0',
    headingColor: '#064E3B',
    bodyColor: '#1E293B',
    mutedColor: '#475569',
    primaryAccent: '#059669',
    secondaryAccent: '#0D9488',
    accents: ['#059669', '#0D9488', '#D97706', '#2563EB', '#10B981', '#65A30D'],
    dividerColor: '#A7F3D0',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#F0FDF4', '#ECFDF5', '#064E3B', '#10B981', '#FDE68A', '#10B981'),
    getContentBgSvg: () => makeSubtleCornerSvg('#F7FDF9', '#059669', '#10B981', '#D1FAE5', false),
  },
  {
    id: 'terracotta_editorial',
    name: 'Tahririy Marjon',
    tagline: 'Madaniyat, tarix va gumanitar fanlar',
    isDark: false,
    titleBg: '#FDF8F2',
    pageBg: '#FFFBF7',
    altPageBg: '#FFFFFF',
    surfaceFill: '#F9F0E6',
    surfaceStroke: '#EAD7C3',
    headingColor: '#291D14',
    bodyColor: '#44352A',
    mutedColor: '#786252',
    primaryAccent: '#C2410C',
    secondaryAccent: '#B45309',
    accents: ['#C2410C', '#D97706', '#0F766E', '#BE123C', '#9333EA', '#4D7C0F'],
    dividerColor: '#EAD7C3',
    headingFont: 'Georgia, serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#FDF8F2', '#F7EBDD', '#C2410C', '#F59E0B', '#FFFBEB', '#D97706'),
    getContentBgSvg: () => makeSubtleCornerSvg('#FFFBF7', '#C2410C', '#F59E0B', '#EAD7C3', false),
  },
  {
    id: 'obsidian_minimal',
    name: 'Tun Pro (Kiber)',
    tagline: 'IT, sun’iy intellekt va analitika',
    isDark: true,
    titleBg: '#090D16',
    pageBg: '#0D131F',
    altPageBg: '#131C2E',
    surfaceFill: '#172236',
    surfaceStroke: '#283754',
    headingColor: '#F8FAFC',
    bodyColor: '#CBD5E1',
    mutedColor: '#94A3B8',
    primaryAccent: '#06B6D4',
    secondaryAccent: '#818CF8',
    accents: ['#06B6D4', '#818CF8', '#10B981', '#F43F5E', '#F59E0B', '#38BDF8'],
    dividerColor: '#283754',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#090D16', '#111827', '#0891B2', '#6366F1', '#CFFAFE', '#06B6D4'),
    getContentBgSvg: () => makeSubtleCornerSvg('#0D131F', '#06B6D4', '#818CF8', '#283754', true),
  },
  {
    id: 'violet_tech',
    name: 'Texno Binafsha',
    tagline: 'Startap pitch va innovatsiya loyihalari',
    isDark: false,
    titleBg: '#F5F3FF',
    pageBg: '#FAF9FF',
    altPageBg: '#FFFFFF',
    surfaceFill: '#F1EEFE',
    surfaceStroke: '#DDD6FE',
    headingColor: '#1E1B4B',
    bodyColor: '#312E81',
    mutedColor: '#6B7280',
    primaryAccent: '#6D28D9',
    secondaryAccent: '#EC4899',
    accents: ['#6D28D9', '#EC4899', '#2563EB', '#059669', '#F59E0B', '#0891B2'],
    dividerColor: '#DDD6FE',
    headingFont: 'Plus Jakarta Sans, sans-serif',
    bodyFont: 'DM Sans, sans-serif',
    getTitleBgSvg: () => makeWaveSvg('#F5F3FF', '#EDE9FE', '#5B21B6', '#EC4899', '#FDF2F8', '#7C3AED'),
    getContentBgSvg: () => makeSubtleCornerSvg('#FAF9FF', '#6D28D9', '#EC4899', '#DDD6FE', false),
  },
];

export function getSlideTheme(themeId?: string): SlideThemeDefinition {
  return SLIDE_THEMES.find((t) => t.id === themeId) || SLIDE_THEMES[0];
}

export interface AiToneDefinition {
  id: AiTone;
  label: string;
  description: string;
}

export const AI_TONE_OPTIONS: AiToneDefinition[] = [
  {
    id: 'academic',
    label: 'Akademik / Ilmiy',
    description: "Kurs ishi, diplom himoyasi, ilmiy faktlar va adabiyotlar bilan",
  },
  {
    id: 'business',
    label: 'Biznes / Pitch',
    description: "Qisqa, raqamli KPI, bozor tahlili va boshqaruv xulosalari",
  },
  {
    id: 'lesson',
    label: 'Dars / Pedagogika',
    description: "O'quvchiga tushunarli, misollar va bosqichma-bosqich tushuntirish",
  },
  {
    id: 'creative',
    label: 'Kreativ / Zamonaviy',
    description: "Ta'sirchan sarlavhalar, vizual hikoya va dinamik bloklar",
  },
];

export type SlideLayoutPresetId =
  | 'title_hero'
  | 'agenda_list'
  | 'two_columns'
  | 'three_cards'
  | 'four_steps'
  | 'timeline_roadmap'
  | 'kpi_metrics'
  | 'quote_highlight';

export interface SlideLayoutPresetMeta {
  id: SlideLayoutPresetId;
  title: string;
  subtitle: string;
}

export const SLIDE_LAYOUT_PRESETS: SlideLayoutPresetMeta[] = [
  { id: 'title_hero', title: 'Titul sahifa', subtitle: 'Asosiy sarlavha va muallif' },
  { id: 'agenda_list', title: 'Reja / Roʻyxat', subtitle: '4 ta raqamlangan band' },
  { id: 'two_columns', title: '2 ustunli taqqoslash', subtitle: 'Yonma-yon ikkita karta' },
  { id: 'three_cards', title: '3 kartali blok', subtitle: 'Uchta asosiy yoʻnalish' },
  { id: 'four_steps', title: '4 bosqichli jarayon', subtitle: 'Ketma-ket qadamlar' },
  { id: 'timeline_roadmap', title: 'Vaqt chizigʻi', subtitle: 'Xronologiya va rivojlanish' },
  { id: 'kpi_metrics', title: 'Raqamlar va KPI', subtitle: '3 ta katta koʻrsatkich' },
  { id: 'quote_highlight', title: 'Xulosa / Sitata', subtitle: 'Katta urgʻuli yakuniy fikr' },
];

export function createPresetSlidePage(
  layoutId: SlideLayoutPresetId,
  themeId: SlideDesignTheme = 'clean_white',
  dims: { width: number; height: number } = { width: 960, height: 540 }
): CanvasPage {
  const t = getSlideTheme(themeId);
  const w = dims.width;
  const h = dims.height;
  const sx = w / 960;
  const sy = h / 540;
  const rx = (v: number) => Math.round(v * sx);
  const ry = (v: number) => Math.round(v * sy);

  const elements: CanvasElement[] = [];

  if (layoutId === 'title_hero') {
    elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: rx(60),
        y: ry(68),
        width: rx(10),
        height: ry(390),
        fill: t.primaryAccent,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 5,
        shadow: true,
      },
      {
        id: uid('rect'),
        type: 'rect',
        x: rx(92),
        y: ry(74),
        width: rx(168),
        height: ry(32),
        fill: t.secondaryAccent,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 8,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(92),
        y: ry(79),
        width: rx(168),
        height: ry(24),
        text: 'TAQDIMOT MAVZUSI',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(92),
        y: ry(132),
        width: rx(680),
        height: ry(140),
        text: 'Asosiy Taqdimot Sarlavhasi',
        fontFamily: t.headingFont,
        fontSize: 40,
        fontWeight: 'bold',
        color: t.headingColor,
        textAlign: 'left',
        lineHeight: 1.18,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(92),
        y: ry(286),
        width: rx(640),
        height: ry(64),
        text: 'Qisqa kirish izohi, asosiy maqsad va muammoning dolzarbligi haqida umumiy tasavvur.',
        fontFamily: t.bodyFont,
        fontSize: 17,
        fontWeight: 'normal',
        color: t.mutedColor,
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(92),
        y: ry(420),
        width: rx(600),
        height: ry(32),
        text: 'Tayyorladi: Ism Familiya  •  Guruh / Tashkilot',
        fontFamily: t.bodyFont,
        fontSize: 14,
        fontWeight: 'bold',
        color: t.bodyColor,
        textAlign: 'left',
      }
    );
    return {
      id: uid('preset'),
      title: 'Titul sahifa',
      background: t.titleBg,
      backgroundImage: t.getTitleBgSvg(),
      elements,
    };
  }

  // Shared top header for content presets
  const badgeAndTitle = (badgeText: string, titleText: string, subText: string) => {
    elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: rx(44),
        y: ry(24),
        width: rx(148),
        height: ry(28),
        fill: t.primaryAccent,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 7,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(44),
        y: ry(28),
        width: rx(148),
        height: ry(22),
        text: badgeText,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(44),
        y: ry(62),
        width: rx(870),
        height: ry(44),
        text: titleText,
        fontFamily: t.headingFont,
        fontSize: 28,
        fontWeight: 'bold',
        color: t.headingColor,
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(44),
        y: ry(106),
        width: rx(840),
        height: ry(26),
        text: subText,
        fontFamily: t.bodyFont,
        fontSize: 13,
        color: t.mutedColor,
        textAlign: 'left',
      }
    );
  };

  if (layoutId === 'agenda_list') {
    badgeAndTitle('REJA', 'Taqdimotning asosiy boʻlimlari', 'Mavzuni mantiqiy ketma-ketlikda yorituvchi 4 ta yoʻnalish');
    const items = [
      "Mavzuning nazariy asoslari va tarixiy rivojlanish bosqichlari",
      "Asosiy ko'rsatkichlar, qiyosiy tahlil va empirik dalillar",
      "Amaliy qo'llanilishi va zamonaviy yechim mexanizmlari",
      "Yakuniy xulosalar, takliflar va istiqboldagi rejalar",
    ];
    items.forEach((label, idx) => {
      const y = ry(154 + idx * 80);
      const col = t.accents[idx % t.accents.length];
      elements.push(
        {
          id: uid('circle'),
          type: 'circle',
          x: rx(52),
          y: y + 4,
          width: rx(40),
          height: rx(40),
          fill: col,
          stroke: 'transparent',
          strokeWidth: 0,
          shadow: true,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: rx(52),
          y: y + 13,
          width: rx(40),
          height: 24,
          text: String(idx + 1).padStart(2, '0'),
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 13,
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'center',
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: rx(108),
          y,
          width: rx(800),
          height: ry(52),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 12,
          shadow: true,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: rx(128),
          y: y + ry(13),
          width: rx(760),
          height: ry(28),
          text: label,
          fontFamily: t.bodyFont,
          fontSize: 15,
          fontWeight: 'bold',
          color: t.headingColor,
          textAlign: 'left',
        }
      );
    });
  } else if (layoutId === 'two_columns') {
    badgeAndTitle('TAQQOSLASH', 'Ikki tomonlama qiyosiy tahlil', 'Muammo va yechim yoki avvalgi va yangi yondashuv farqlari');
    [
      {
        title: "1-yo'nalish: An'anaviy yondashuv",
        body: "• Asosiy cheklovlar va sarflanadigan resurslar\n• Jarayonning sekin kechishi va qo'lda nazorat\n• Kengaytirishdagi texnik to'siqlar",
        accent: t.accents[0],
      },
      {
        title: "2-yo'nalish: Zamonaviy yechim",
        body: "• Avtomatlashtirilgan tizim va tezkor natija\n• Aniq o'lchanadigan samaradorlik ko'rsatkichlari\n• Yuqori moslashuvchanlik va barqaror o'sish",
        accent: t.accents[2] || t.primaryAccent,
      },
    ].forEach((colData, idx) => {
      const cx = rx(44 + idx * 448);
      elements.push(
        {
          id: uid('rect'),
          type: 'rect',
          x: cx,
          y: ry(148),
          width: rx(424),
          height: ry(328),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 14,
          shadow: true,
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: cx,
          y: ry(148),
          width: rx(424),
          height: ry(8),
          fill: colData.accent,
          stroke: 'transparent',
          strokeWidth: 0,
          borderRadius: 4,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(24),
          y: ry(176),
          width: rx(376),
          height: ry(34),
          text: colData.title,
          fontFamily: t.headingFont,
          fontSize: 19,
          fontWeight: 'bold',
          color: t.headingColor,
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(24),
          y: ry(224),
          width: rx(376),
          height: ry(220),
          text: colData.body,
          fontFamily: t.bodyFont,
          fontSize: 15,
          color: t.bodyColor,
          textAlign: 'left',
          lineHeight: 1.5,
        }
      );
    });
  } else if (layoutId === 'three_cards') {
    badgeAndTitle("ASOSIY G'OYA", 'Uchta tayanch ustun', 'Mavzuni belgilovchi eng muhim omillar va natijalar');
    [
      {
        title: 'Nazariy poydevor',
        body: 'Ilmiy qarashlar, asosiy tushunchalar va metodologik tamoyillar jamlanmasi.',
      },
      {
        title: 'Amaliy mexanizm',
        body: 'Real loyiha va tajribalar asosida sinovdan o‘tgan samarali usullar.',
      },
      {
        title: 'Kutilayotgan samara',
        body: 'Sifat, tezlik va iqtisodiy samaradorlikning sezilarli o‘sishi.',
      },
    ].forEach((card, idx) => {
      const cx = rx(44 + idx * 298);
      const accent = t.accents[idx % t.accents.length];
      elements.push(
        {
          id: uid('rect'),
          type: 'rect',
          x: cx,
          y: ry(152),
          width: rx(276),
          height: ry(320),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 14,
          shadow: true,
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: cx,
          y: ry(152),
          width: rx(8),
          height: ry(320),
          fill: accent,
          stroke: 'transparent',
          strokeWidth: 0,
          borderRadius: 4,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(24),
          y: ry(176),
          width: rx(230),
          height: ry(34),
          text: card.title,
          fontFamily: t.headingFont,
          fontSize: 17,
          fontWeight: 'bold',
          color: t.headingColor,
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(24),
          y: ry(220),
          width: rx(230),
          height: ry(220),
          text: card.body,
          fontFamily: t.bodyFont,
          fontSize: 14,
          color: t.bodyColor,
          textAlign: 'left',
          lineHeight: 1.45,
        }
      );
    });
  } else if (layoutId === 'four_steps') {
    badgeAndTitle('JARAYON', "Amalga oshirishning 4 bosqichi", "Har bir qadam bo'yicha aniq vazifa va mas'uliyat");
    [
      { heading: 'Tahlil va reja', body: 'Boshlang‘ich holatni o‘rganish, maqsad va KPI mezonlarini belgilash.' },
      { heading: 'Loyihalash', body: 'Arxitektura, zarur vositalar va resurslar taqsimotini ishlab chiqish.' },
      { heading: 'Joriy etish', body: 'Sinov tariqasida ishga tushirish hamda dastlabki natijalarni tekshirish.' },
      { heading: 'Monitoring', body: 'Doimiy nazorat, tahlil asosida tizimni yanada takomillashtirish.' },
    ].forEach((step, idx) => {
      const syPos = ry(148 + idx * 82);
      const col = t.accents[idx % t.accents.length];
      elements.push(
        {
          id: uid('circle'),
          type: 'circle',
          x: rx(48),
          y: syPos + 4,
          width: rx(38),
          height: rx(38),
          fill: col,
          stroke: 'transparent',
          strokeWidth: 0,
          shadow: true,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: rx(48),
          y: syPos + 12,
          width: rx(38),
          height: 24,
          text: String(idx + 1),
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'center',
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: rx(102),
          y: syPos,
          width: rx(814),
          height: ry(62),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 10,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: rx(120),
          y: syPos + ry(16),
          width: rx(190),
          height: ry(30),
          text: step.heading,
          fontFamily: t.headingFont,
          fontSize: 15,
          fontWeight: 'bold',
          color: t.headingColor,
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: rx(324),
          y: syPos + ry(12),
          width: rx(572),
          height: ry(40),
          text: step.body,
          fontFamily: t.bodyFont,
          fontSize: 13,
          color: t.bodyColor,
          textAlign: 'left',
        }
      );
    });
  } else if (layoutId === 'timeline_roadmap') {
    badgeAndTitle('XRONOLOGIYA', "Rivojlanish va vaqt chizig'i", 'Asosiy tarixiy yoki loyihaviy bosqichlar ketma-ketligi');
    const nodes = [
      { year: '1-BOSQICH', desc: 'Tashabbus va dastlabki ilmiy asoslar yaratilishi.' },
      { year: '2-BOSQICH', desc: 'Birinchi tajriba namunalari va kengayish davri.' },
      { year: '3-BOSQICH', desc: 'Texnologik yangilanish va xalqaro standartlarga chiqish.' },
      { year: '4-BOSQICH', desc: 'Bugungi natijalar hamda kelajak strategiyasi.' },
    ];
    elements.push({
      id: uid('rect'),
      type: 'rect',
      x: rx(96),
      y: ry(224),
      width: rx(760),
      height: 5,
      fill: t.dividerColor,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 2,
    });
    nodes.forEach((n, idx) => {
      const cx = rx(92 + idx * 240);
      const col = t.accents[idx % t.accents.length];
      elements.push(
        {
          id: uid('circle'),
          type: 'circle',
          x: cx + rx(70),
          y: ry(208),
          width: rx(36),
          height: rx(36),
          fill: col,
          stroke: 'transparent',
          strokeWidth: 0,
          shadow: true,
        },
        {
          id: uid('rect'),
          type: 'rect',
          x: cx - rx(14),
          y: ry(264),
          width: rx(206),
          height: ry(176),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 12,
          shadow: true,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx - rx(2),
          y: ry(280),
          width: rx(182),
          height: ry(28),
          text: n.year,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          color: col,
          textAlign: 'center',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx - rx(2),
          y: ry(316),
          width: rx(182),
          height: ry(108),
          text: n.desc,
          fontFamily: t.bodyFont,
          fontSize: 13,
          color: t.bodyColor,
          textAlign: 'center',
        }
      );
    });
  } else if (layoutId === 'kpi_metrics') {
    badgeAndTitle('STATISTIKA', "Asosiy ko'rsatkichlar va faktlar", "Raqamlar bilan tasdiqlangan o'sish sur'ati");
    [
      { num: '85%', label: 'Samaradorlik o‘sishi', detail: "Yangi metodika qo'llanilgandan keyingi ijobiy o'zgarish" },
      { num: '3.2x', label: 'Tezkorlik', detail: 'Vazifalarni bajarish vaqtining qisqarish ko‘rsatkichi' },
      { num: '120+', label: 'Tadqiqot va misollar', detail: 'Amaliyotda sinovdan o‘tgan real keyslar bazasi' },
    ].forEach((kpi, idx) => {
      const cx = rx(44 + idx * 298);
      const col = t.accents[idx % t.accents.length];
      elements.push(
        {
          id: uid('rect'),
          type: 'rect',
          x: cx,
          y: ry(164),
          width: rx(276),
          height: ry(290),
          fill: t.surfaceFill,
          stroke: t.surfaceStroke,
          strokeWidth: 1,
          borderRadius: 16,
          shadow: true,
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(20),
          y: ry(198),
          width: rx(236),
          height: ry(74),
          text: kpi.num,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 44,
          fontWeight: 'bold',
          color: col,
          textAlign: 'center',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(20),
          y: ry(286),
          width: rx(236),
          height: ry(34),
          text: kpi.label,
          fontFamily: t.headingFont,
          fontSize: 17,
          fontWeight: 'bold',
          color: t.headingColor,
          textAlign: 'center',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: cx + rx(20),
          y: ry(328),
          width: rx(236),
          height: ry(96),
          text: kpi.detail,
          fontFamily: t.bodyFont,
          fontSize: 13,
          color: t.mutedColor,
          textAlign: 'center',
        }
      );
    });
  } else {
    // quote_highlight
    badgeAndTitle('XULOSA', 'Muhim xulosa va asosiy fikr', 'Taqdimotning yakuniy tezisi va amaliy tavsiya');
    elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: rx(72),
        y: ry(168),
        width: rx(816),
        height: ry(268),
        fill: t.surfaceFill,
        stroke: t.surfaceStroke,
        strokeWidth: 1,
        borderRadius: 18,
        shadow: true,
      },
      {
        id: uid('rect'),
        type: 'rect',
        x: rx(72),
        y: ry(168),
        width: rx(12),
        height: ry(268),
        fill: t.primaryAccent,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 6,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(118),
        y: ry(210),
        width: rx(730),
        height: ry(140),
        text: '“Tizimli yondashuv, aniq dalillar va zamonaviy metodlar uyg‘unligi har qanday loyiha va tadqiqotning yuqori sifatli natijasini kafolatlaydi.”',
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontStyle: 'italic',
        fontWeight: 'bold',
        color: t.headingColor,
        textAlign: 'left',
        lineHeight: 1.4,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: rx(118),
        y: ry(374),
        width: rx(730),
        height: ry(30),
        text: '— Asosiy xulosa va tavsiya qismi',
        fontFamily: t.bodyFont,
        fontSize: 14,
        fontWeight: 'bold',
        color: t.primaryAccent,
        textAlign: 'left',
      }
    );
  }

  return {
    id: uid('preset'),
    title: SLIDE_LAYOUT_PRESETS.find((p) => p.id === layoutId)?.title || 'Yangi slayd',
    background: t.pageBg,
    backgroundImage: t.getContentBgSvg(),
    elements,
  };
}

function isColorDarkHex(hex?: string): boolean {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.52;
}

export function applyThemeToCanvasPage(
  page: CanvasPage,
  themeId: SlideDesignTheme,
  isFirstPage = false
): CanvasPage {
  const t = getSlideTheme(themeId);
  const nextBg = isFirstPage ? t.titleBg : t.pageBg;
  const nextBgImage = isFirstPage ? t.getTitleBgSvg() : t.getContentBgSvg();

  let accentIdx = 0;
  const nextElements = page.elements.map((el) => {
    if (el.type === 'text') {
      // Keep white text on dark/colored badges or circle numbers
      const fs = el.fontSize || 16;
      const isBadgeOrNum = (el.color || '').toUpperCase() === '#FFFFFF' && fs <= 14 && el.textAlign === 'center';
      if (isBadgeOrNum) return el;

      const isLargeHeading = fs >= 22 || el.fontWeight === 'bold';
      const isMuted = fs <= 13 && el.fontWeight !== 'bold';
      return {
        ...el,
        color: isLargeHeading ? t.headingColor : isMuted ? t.mutedColor : t.bodyColor,
      };
    }

    if (el.type === 'rect') {
      // Hairline divider
      if (el.height <= 4 && el.width >= 300) {
        return { ...el, fill: t.dividerColor };
      }
      // Thin accent bar (left stripe / top stripe)
      if (el.width <= 14 || (el.height <= 12 && el.width >= 60)) {
        const col = t.accents[accentIdx++ % t.accents.length];
        return { ...el, fill: col };
      }
      // Small pill/badge rect
      if (el.width <= 210 && el.height <= 46) {
        const col = t.accents[accentIdx++ % t.accents.length];
        return { ...el, fill: col };
      }
      // Large surface card
      if (el.fill && el.fill !== 'transparent') {
        const wasDarkCard = isColorDarkHex(el.fill);
        if (el.width >= 180 && el.height >= 48) {
          return {
            ...el,
            fill: t.surfaceFill,
            stroke: t.surfaceStroke,
          };
        }
        if (wasDarkCard !== t.isDark) {
          return { ...el, fill: t.surfaceFill, stroke: t.surfaceStroke };
        }
      }
      return el;
    }

    if (el.type === 'circle') {
      if (el.width <= 64 && el.height <= 64) {
        const col = t.accents[accentIdx++ % t.accents.length];
        return { ...el, fill: col };
      }
      return el;
    }

    return el;
  });

  return {
    ...page,
    background: nextBg,
    backgroundImage: nextBgImage,
    elements: nextElements,
  };
}
