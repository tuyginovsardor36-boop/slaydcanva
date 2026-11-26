import { uid } from '../data/defaults';
import { CanvasElement, CanvasPage } from '../types/editor';

export interface SlideDeckBlock {
  heading: string;
  body: string;
  badge?: string;
}

export interface GeneratedSlideItem {
  tag: string;
  title: string;
  subtitle?: string;
  imageKeyword?: string;
  imageUrl?: string;
  layout:
    | 'three_columns'
    | 'timeline'
    | 'table'
    | 'grid_2x2'
    | 'steps'
    | 'case_analysis'
    | 'schedule'
    | 'highlight_note'
    | 'split_image_right'
    | 'split_image_left';
  blocks: SlideDeckBlock[];
  tableHeaders?: string[];
  tableRows?: string[][];
  footerCallout?: string;
}

export interface GeneratedSlideDeckData {
  deckTitle: string;
  deckSubtitle: string;
  institution?: string;
  direction?: string;
  footerTopic: string;
  planItems: { tag: string; title: string }[];
  slides: GeneratedSlideItem[];
  references: string[];
  topicImages?: string[];
}

export interface GeneratedNotebookTask {
  sectionLabel: string;
  title: string;
  lines: string[];
}

export interface GeneratedNotebookData {
  coverTitle: string;
  coverSubtitle: string;
  sectionTitle: string;
  tasks: GeneratedNotebookTask[];
}

export interface InfographicBullet {
  lead: string;
  text: string;
}

export interface InfographicBlock {
  number: number;
  title: string;
  bullets: InfographicBullet[];
  calloutLabels: string[];
}

export interface GeneratedInfographicData {
  mainTitle: string;
  subTitle: string;
  iconTheme: 'science' | 'medicine' | 'education' | 'tech' | 'business';
  blocks: InfographicBlock[];
}

export interface TemplateMetadata {
  institution?: string;
  authorName?: string;
  groupName?: string;
  subject?: string;
  teacher?: string;
  city?: string;
  notebookNumber?: string;
  academicYear?: string;
  designTheme?: 'academic_gold' | 'crimson_dark' | 'clean_white' | 'emerald_green';
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function toPlainText(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if ('title' in obj || 'author' in obj || 'publisher' in obj || 'year' in obj) {
      const parts = [
        typeof obj.author === 'string' ? obj.author.trim() : '',
        typeof obj.title === 'string' ? obj.title.trim() : '',
        typeof obj.publisher === 'string' ? obj.publisher.trim() : '',
        obj.year ? String(obj.year).trim() : '',
      ].filter(Boolean);
      if (parts.length > 0) return parts.join('. ');
    }
    const vals = Object.values(obj)
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (vals.length > 0) return vals.join(' — ');
  }
  return fallback;
}

function truncateText(str: unknown, max: number): string {
  const s = toPlainText(str).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// ============================================================================
// 1. ACADEMIC GOLDEN WAVE SVG BACKGROUND & VECTOR SCENES
// ============================================================================

const WAVE_ACCENT_COLORS = ['#EB6A5B', '#F2A34C', '#68B684', '#9B7EDE', '#EC8FB5', '#F6D365'];

function createAcademicWaveBgSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="goldBg" x1="0" y1="0" x2="1" y2="0.2">
      <stop offset="0%" stop-color="#F7B12E"/>
      <stop offset="18%" stop-color="#FFD443"/>
      <stop offset="68%" stop-color="#FFD84B"/>
      <stop offset="100%" stop-color="#FFCD38"/>
    </linearGradient>
    <linearGradient id="rightBlue" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0%" stop-color="#1E40AF"/>
      <stop offset="45%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#60A5FA"/>
    </linearGradient>
    <linearGradient id="greyWave" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#94A3B8" stop-opacity="0.55"/>
      <stop offset="50%" stop-color="#64748B" stop-opacity="0.68"/>
      <stop offset="100%" stop-color="#475569" stop-opacity="0.72"/>
    </linearGradient>
    <radialGradient id="softGoldCircle" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#D99B16" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#F7B12E" stop-opacity="0.06"/>
    </radialGradient>
  </defs>
  <rect width="960" height="540" fill="url(#goldBg)"/>
  <circle cx="28" cy="24" r="78" fill="url(#softGoldCircle)"/>
  <circle cx="88" cy="482" r="96" fill="url(#softGoldCircle)"/>
  <!-- Right organic blue backdrop -->
  <path d="M 790 0 C 858 88, 848 165, 792 238 C 728 320, 725 408, 828 540 L 960 540 L 960 0 Z" fill="url(#rightBlue)"/>
  <!-- Overlapping translucent slate/sage wave -->
  <path d="M 906 0 C 895 95, 818 165, 764 252 C 712 335, 750 438, 828 540 L 842 540 C 890 462, 922 396, 895 316 C 868 238, 858 148, 916 42 L 940 0 Z" fill="url(#greyWave)"/>
  <path d="M 852 0 C 826 84, 838 162, 878 232 C 916 298, 928 386, 864 468 L 832 540 L 960 540 L 960 0 Z" fill="#60A5FA" fill-opacity="0.28"/>
  <!-- Small cream dot near top-right -->
  <circle cx="850" cy="60" r="11" fill="#FDEFD2" fill-opacity="0.92"/>
</svg>`;
  return svgToDataUri(svg);
}

function createCrimsonDarkBgSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="cDark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F0F12"/>
      <stop offset="60%" stop-color="#141418"/>
      <stop offset="100%" stop-color="#1A1A22"/>
    </linearGradient>
    <linearGradient id="redAccent" x1="0" y1="0" x2="1" y2="0.8">
      <stop offset="0%" stop-color="#DC2626"/>
      <stop offset="100%" stop-color="#991B1B"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#cDark)"/>
  <path d="M 820 0 C 890 120, 860 260, 800 340 C 740 420, 770 490, 860 540 L 960 540 L 960 0 Z" fill="url(#redAccent)" fill-opacity="0.85"/>
  <path d="M 870 0 C 930 140, 910 280, 850 360 C 800 430, 820 500, 900 540 L 960 540 L 960 0 Z" fill="#EF4444" fill-opacity="0.25"/>
  <circle cx="860" cy="70" r="12" fill="#FFFFFF" fill-opacity="0.9"/>
  <circle cx="80" cy="500" r="140" fill="#DC2626" fill-opacity="0.04"/>
</svg>`;
  return svgToDataUri(svg);
}

function createCleanWhiteBgSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F8FAFC"/>
    </linearGradient>
    <linearGradient id="softBlueWave" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#60A5FA" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#wGrad)"/>
  <path d="M 820 0 C 880 110, 870 240, 810 330 C 760 410, 770 480, 850 540 L 960 540 L 960 0 Z" fill="url(#softBlueWave)"/>
  <circle cx="870" cy="65" r="9" fill="#3B82F6" fill-opacity="0.2"/>
  <line x1="40" y1="510" x2="920" y2="510" stroke="#E2E8F0" stroke-width="1.5"/>
</svg>`;
  return svgToDataUri(svg);
}

function createEmeraldBgSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="emBg" x1="0" y1="0" x2="1" y2="0.3">
      <stop offset="0%" stop-color="#F0FDF4"/>
      <stop offset="70%" stop-color="#ECFDF5"/>
      <stop offset="100%" stop-color="#E6F9EF"/>
    </linearGradient>
    <linearGradient id="forestRight" x1="0" y1="0" x2="1" y2="0.7">
      <stop offset="0%" stop-color="#064E3B"/>
      <stop offset="60%" stop-color="#047857"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#emBg)"/>
  <circle cx="70" cy="490" r="120" fill="#10B981" fill-opacity="0.06"/>
  <path d="M 810 0 C 870 100, 860 220, 810 320 C 760 410, 770 480, 840 540 L 960 540 L 960 0 Z" fill="url(#forestRight)"/>
  <circle cx="860" cy="60" r="10" fill="#FDE68A" fill-opacity="0.9"/>
</svg>`;
  return svgToDataUri(svg);
}

function resolveHeroPhotoUrl(topicImages: string[] | undefined): string {
  const first = topicImages?.[0];
  if (first && (first.startsWith('data:') || first.startsWith('http://') || first.startsWith('https://'))) {
    return first;
  }
  return '';
}

function resolveSlidePhotoUrl(slide: GeneratedSlideItem | undefined): string {
  if (
    slide?.imageUrl &&
    (slide.imageUrl.startsWith('data:') ||
      slide.imageUrl.startsWith('http://') ||
      slide.imageUrl.startsWith('https://'))
  ) {
    return slide.imageUrl;
  }
  return '';
}

function createSlideIllustrationSvg(variant: number, accent = '#2563EB'): string {
  const v = variant % 3;
  if (v === 0) {
    // Stage / Academic Knowledge Scene
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFF7ED"/>
          <stop offset="100%" stop-color="#DBEAFE"/>
        </linearGradient>
      </defs>
      <rect width="320" height="190" rx="14" fill="url(#sky)"/>
      <circle cx="265" cy="42" r="22" fill="#FCD34D" fill-opacity="0.85"/>
      <rect x="28" y="34" width="264" height="122" rx="10" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <rect x="44" y="50" width="96" height="14" rx="7" fill="${accent}"/>
      <rect x="44" y="74" width="138" height="8" rx="4" fill="#CBD5E1"/>
      <rect x="44" y="90" width="118" height="8" rx="4" fill="#E2E8F0"/>
      <rect x="44" y="106" width="84" height="8" rx="4" fill="#E2E8F0"/>
      <rect x="200" y="52" width="76" height="86" rx="10" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1.5"/>
      <circle cx="238" cy="82" r="16" fill="${accent}" fill-opacity="0.18"/>
      <path d="M230 82 L236 88 L248 74" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="214" y="110" width="48" height="7" rx="3.5" fill="#93C5FD"/>
      <rect x="220" y="123" width="36" height="6" rx="3" fill="#CBD5E1"/>
    </svg>`;
    return svgToDataUri(svg);
  }
  if (v === 1) {
    // Analytics / Structured Learning Scene
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">
      <rect width="320" height="190" rx="14" fill="#F8FAFC"/>
      <rect x="18" y="20" width="284" height="150" rx="12" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
      <rect x="38" y="114" width="32" height="36" rx="6" fill="#93C5FD"/>
      <rect x="84" y="90" width="32" height="60" rx="6" fill="#60A5FA"/>
      <rect x="130" y="64" width="32" height="86" rx="6" fill="${accent}"/>
      <rect x="176" y="78" width="32" height="72" rx="6" fill="#34D399"/>
      <rect x="222" y="48" width="32" height="102" rx="6" fill="#F59E0B"/>
      <circle cx="272" cy="48" r="14" fill="#FEF3C7"/>
      <path d="M40 76 L98 58 L146 42 L194 52 L240 30" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="146" cy="42" r="4.5" fill="${accent}"/>
      <circle cx="240" cy="30" r="4.5" fill="#F59E0B"/>
    </svg>`;
    return svgToDataUri(svg);
  }
  // Collaborative / Creative Process Scene
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="190" viewBox="0 0 320 190">
    <rect width="320" height="190" rx="14" fill="#FEFCE8"/>
    <circle cx="96" cy="94" r="48" fill="#FDE68A"/>
    <circle cx="212" cy="86" r="40" fill="#BFDBFE"/>
    <rect x="52" y="46" width="216" height="104" rx="12" fill="#FFFFFF" fill-opacity="0.92" stroke="#E2E8F0" stroke-width="2"/>
    <circle cx="102" cy="88" r="22" fill="#FB7185" fill-opacity="0.2"/>
    <circle cx="102" cy="88" r="10" fill="#FB7185"/>
    <circle cx="160" cy="88" r="22" fill="#3B82F6" fill-opacity="0.2"/>
    <circle cx="160" cy="88" r="10" fill="#3B82F6"/>
    <circle cx="218" cy="88" r="22" fill="#10B981" fill-opacity="0.2"/>
    <circle cx="218" cy="88" r="10" fill="#10B981"/>
    <rect x="78" y="122" width="164" height="8" rx="4" fill="#CBD5E1"/>
  </svg>`;
  return svgToDataUri(svg);
}

// ============================================================================
// BUILDER 1: ACADEMIC WAVE PPTX (Matches Yarasheva_Fotima_titul_orqa_fon_bir_xil.pdf)
// ============================================================================

export function buildAcademicWaveDeck(
  data: GeneratedSlideDeckData,
  meta: TemplateMetadata
): CanvasPage[] {
  const theme = meta.designTheme || 'academic_gold';
  let titleBgUri = createAcademicWaveBgSvg();
  let titleBgColor = '#FFD443';
  let titleAccentColor = '#D94E41';

  if (theme === 'crimson_dark') {
    titleBgUri = createCrimsonDarkBgSvg();
    titleBgColor = '#0F0F12';
    titleAccentColor = '#DC2626';
  } else if (theme === 'clean_white') {
    titleBgUri = createCleanWhiteBgSvg();
    titleBgColor = '#FFFFFF';
    titleAccentColor = '#2563EB';
  } else if (theme === 'emerald_green') {
    titleBgUri = createEmeraldBgSvg();
    titleBgColor = '#F0FDF4';
    titleAccentColor = '#059669';
  }

  const pages: CanvasPage[] = [];
  const totalContentSlides = data.slides || [];
  const footerLabel = (data.footerTopic || data.deckTitle || 'TAQDIMOT').toUpperCase();

  const heroPhoto = resolveHeroPhotoUrl(data.topicImages);
  const hasHeroPhoto = Boolean(heroPhoto);
  const titleWidth = hasHeroPhoto ? 468 : 660;

  // SLIDE 1: Title slide
  const titleElements: CanvasElement[] = [
    {
      id: uid('rect'),
      type: 'rect',
      x: 60,
      y: 52,
      width: 8,
      height: 426,
      fill: titleAccentColor,
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 4,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 88,
      y: 54,
      width: hasHeroPhoto ? 480 : 700,
      height: 44,
      text: (meta.institution || data.institution || "OLIY TA'LIM MUASSASASI").toUpperCase(),
      fontFamily: 'Georgia, serif',
      fontSize: 20,
      fontWeight: 'bold',
      color: theme === 'crimson_dark' ? '#F4F4F5' : '#1E293B',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 88,
      y: 112,
      width: hasHeroPhoto ? 480 : 600,
      height: 52,
      text: `${meta.subject || data.direction || "Asosiy yo'nalish"}\n${meta.groupName ? `${meta.groupName}` : "Akademik guruh"}`,
      fontFamily: 'Georgia, serif',
      fontSize: 15,
      fontWeight: 'normal',
      color: theme === 'crimson_dark' ? '#A1A1AA' : '#57534E',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 88,
      y: 196,
      width: 240,
      height: 24,
      text: 'TAQDIMOT',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 12,
      fontWeight: 'bold',
      color: theme === 'crimson_dark' ? '#EF4444' : '#B45309',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 88,
      y: 226,
      width: titleWidth,
      height: 114,
      text: data.deckTitle || 'Taqdimot mavzusi',
      fontFamily: 'Georgia, serif',
      fontSize: hasHeroPhoto ? 30 : 34,
      fontWeight: 'bold',
      color: theme === 'crimson_dark' ? '#FFFFFF' : '#1E293B',
      textAlign: 'left',
      lineHeight: 1.2,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 88,
      y: 344,
      width: titleWidth,
      height: 48,
      text: data.deckSubtitle || "Fan bo'yicha taqdimot materiallari",
      fontFamily: 'Georgia, serif',
      fontSize: 15,
      fontWeight: 'normal',
      color: theme === 'crimson_dark' ? '#D4D4D8' : '#57534E',
      textAlign: 'left',
    },
  ];

  if (hasHeroPhoto) {
    titleElements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: 558,
        y: 112,
        width: 368,
        height: 278,
        fill: '#FFFFFF',
        stroke: '#E2E8F0',
        strokeWidth: 1,
        borderRadius: 20,
        shadow: true,
      },
      {
        id: uid('img'),
        type: 'image',
        x: 564,
        y: 118,
        width: 356,
        height: 266,
        src: heroPhoto,
        imageFit: 'cover',
        borderRadius: 16,
        shadow: true,
      }
    );
  }

  titleElements.push(
    {
      id: uid('txt'),
      type: 'text',
      x: 480,
      y: 416,
      width: 380,
      height: 30,
      text: `Tayyorladi: ${meta.authorName || 'Talaba'}`,
      fontFamily: 'Georgia, serif',
      fontSize: 15,
      fontWeight: 'bold',
      color: theme === 'crimson_dark' ? '#FFFFFF' : '#1E293B',
      textAlign: 'right',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 480,
      y: 446,
      width: 380,
      height: 26,
      text: `${meta.subject || data.direction || 'Yoʻnalish'} • ${meta.groupName || 'Guruh'}`,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 12,
      fontWeight: 'normal',
      color: theme === 'crimson_dark' ? '#A1A1AA' : '#475569',
      textAlign: 'right',
    }
  );

  pages.push({
    id: uid('wave_s1'),
    title: 'Titul',
    background: titleBgColor,
    backgroundImage: titleBgUri,
    elements: titleElements,
  });

  // SLIDE 2: Plan / Tasks overview
  const planItems = (data.planItems || []).slice(0, 4);
  const slide2Elements: CanvasElement[] = [
    {
      id: uid('txt'),
      type: 'text',
      x: 52,
      y: 48,
      width: 720,
      height: 44,
      text: 'TAQDIMOT REJASI VA ASOSIY BOʻLIMLAR',
      fontFamily: 'Georgia, serif',
      fontSize: 22,
      fontWeight: 'bold',
      color: '#1E293B',
      textAlign: 'left',
    },
  ];

  planItems.forEach((item, idx) => {
    const y = 114 + idx * 78;
    const pillColor = WAVE_ACCENT_COLORS[idx % WAVE_ACCENT_COLORS.length];
    slide2Elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: 52,
        y,
        width: 126,
        height: 30,
        fill: pillColor,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 15,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 52,
        y: y + 4,
        width: 126,
        height: 24,
        text: (item.tag || `${idx + 1}-BO'LIM`).toUpperCase(),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 198,
        y: y - 2,
        width: 590,
        height: 58,
        text: item.title,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 15,
        fontWeight: 'normal',
        color: '#1E293B',
        textAlign: 'left',
      }
    );
  });

  slide2Elements.push({
    id: uid('txt'),
    type: 'text',
    x: 64,
    y: 462,
    width: 680,
    height: 30,
    text: "Quyidagi slaydlarda har bir bo'lim alohida ko'rsatilgan va izchil yoritilgan.",
    fontFamily: 'Georgia, serif',
    fontSize: 13,
    fontWeight: 'normal',
    color: theme === 'crimson_dark' ? '#D4D4D8' : '#475569',
    textAlign: 'left',
  });

  const rejaBgColor =
    theme === 'crimson_dark'
      ? '#141418'
      : theme === 'clean_white'
        ? '#FAFAFA'
        : theme === 'emerald_green'
          ? '#F7FDF9'
          : '#FFFDF7';

  pages.push({
    id: uid('wave_s2'),
    title: 'Reja',
    background: rejaBgColor,
    elements: slide2Elements,
  });

  // SLIDES 3 .. N-1: Dynamic Layout Slides
  totalContentSlides.forEach((s, index) => {
    const slideNum = index + 3;
    const pillColor = WAVE_ACCENT_COLORS[index % WAVE_ACCENT_COLORS.length];
    const photoUrl = resolveSlidePhotoUrl(s);
    const elements: CanvasElement[] = [
      // Top-left colored pill
      {
        id: uid('rect'),
        type: 'rect',
        x: 32,
        y: 18,
        width: 168,
        height: 30,
        fill: pillColor,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 8,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 32,
        y: 22,
        width: 168,
        height: 24,
        text: truncateText((s.tag || `${index + 1}-BO'LIM`).toUpperCase(), 20),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      // Slide Heading
      {
        id: uid('txt'),
        type: 'text',
        x: 42,
        y: 62,
        width: 750,
        height: 44,
        text: s.title || 'Mavzu qismi',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 26,
        fontWeight: 'bold',
        color: '#0F172A',
        textAlign: 'left',
      },
    ];

    let bodyStartY = 112;
    if (s.subtitle) {
      elements.push({
        id: uid('txt'),
        type: 'text',
        x: 42,
        y: 104,
        width: 740,
        height: 28,
        text: s.subtitle,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'left',
      });
      bodyStartY = 138;
    }

    const blocks = s.blocks || [];

    if (s.layout === 'timeline') {
      const nodes = blocks.slice(0, 5);
      const count = Math.max(nodes.length, 3);
      const startX = 72;
      const endX = 784;
      const stepX = count > 1 ? (endX - startX) / (count - 1) : 0;

      elements.push({
        id: uid('rect'),
        type: 'rect',
        x: startX + 12,
        y: bodyStartY + 42,
        width: endX - startX,
        height: 5,
        fill: '#E2E8F0',
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 2,
      });

      nodes.forEach((b, i) => {
        const cx = startX + i * stepX;
        const colW = Math.min(156, Math.floor(740 / count) - 8);
        elements.push(
          {
            id: uid('circle'),
            type: 'circle',
            x: cx,
            y: bodyStartY + 26,
            width: 36,
            height: 36,
            fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: Math.max(36, cx - colW / 2 + 18),
            y: bodyStartY + 76,
            width: colW,
            height: 34,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'center',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: Math.max(36, cx - colW / 2 + 18),
            y: bodyStartY + 114,
            width: colW,
            height: 150,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            fontWeight: 'normal',
            color: '#334155',
            textAlign: 'center',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: 64,
          y: 430,
          width: 740,
          height: 54,
          text: s.footerCallout,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 15,
          fontWeight: 'bold',
          color: '#1E293B',
          textAlign: 'center',
        });
      }
    } else if (s.layout === 'table' && s.tableHeaders?.length && s.tableRows?.length) {
      const headers = s.tableHeaders.slice(0, 3);
      const rows = s.tableRows.slice(0, 6);
      const colWidths = [220, 310, 290];
      const colXs = [52, 276, 590];

      headers.forEach((h, cIdx) => {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: colXs[cIdx],
          y: bodyStartY,
          width: colWidths[cIdx],
          height: 32,
          text: h,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: cIdx === 0 ? 'left' : 'left',
        });
      });

      rows.forEach((row, rIdx) => {
        const ry = bodyStartY + 38 + rIdx * 52;
        elements.push({
          id: uid('rect'),
          type: 'rect',
          x: 52,
          y: ry,
          width: 828,
          height: 1,
          fill: '#B48B22',
          stroke: 'transparent',
          strokeWidth: 0,
        });
        row.slice(0, 3).forEach((cell, cIdx) => {
          elements.push({
            id: uid('txt'),
            type: 'text',
            x: colXs[cIdx],
            y: ry + 8,
            width: colWidths[cIdx],
            height: 40,
            text: cell,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: cIdx === 0 ? 'bold' : 'normal',
            color: '#0F172A',
            textAlign: 'left',
          });
        });
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: 52,
          y: 468,
          width: 780,
          height: 28,
          text: s.footerCallout,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontStyle: 'italic',
          color: '#475569',
          textAlign: 'left',
        });
      }
    } else if (s.layout === 'steps') {
      blocks.slice(0, 5).forEach((b, i) => {
        const sy = bodyStartY + 8 + i * 64;
        elements.push(
          {
            id: uid('circle'),
            type: 'circle',
            x: 62,
            y: sy,
            width: 34,
            height: 34,
            fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 62,
            y: sy + 5,
            width: 34,
            height: 26,
            text: String(i + 1),
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'center',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 112,
            y: sy + 2,
            width: 170,
            height: 34,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 15,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 290,
            y: sy + 2,
            width: 530,
            height: 54,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });
    } else if (
      Boolean(photoUrl) &&
      (s.layout === 'split_image_right' || s.layout === 'split_image_left')
    ) {
      // DEDICATED SPLIT IMAGE LAYOUT: High-res authentic topic photo in 4:3 mat frame + structured cards
      const isRight = s.layout === 'split_image_right';
      const imgX = isRight ? 542 : 48;
      const imgY = bodyStartY + 26;
      const textX = isRight ? 48 : 444;
      const textW = 470;

      elements.push(
        {
          id: uid('rect'),
          type: 'rect',
          x: imgX - 6,
          y: imgY - 6,
          width: 384,
          height: 290,
          fill: '#FFFFFF',
          stroke: '#E2E8F0',
          strokeWidth: 1,
          borderRadius: 18,
          shadow: true,
        },
        {
          id: uid('img'),
          type: 'image',
          x: imgX,
          y: imgY,
          width: 372,
          height: 278,
          src: photoUrl,
          imageFit: 'cover',
          borderRadius: 14,
          shadow: true,
        }
      );

      blocks.slice(0, 3).forEach((b, i) => {
        const cy = bodyStartY + 6 + i * 112;
        const pillColor = WAVE_ACCENT_COLORS[(index + i) % WAVE_ACCENT_COLORS.length];
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: textX,
            y: cy,
            width: 6,
            height: 98,
            fill: pillColor,
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 3,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: textX + 16,
            y: cy,
            width: textW - 20,
            height: 28,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: textX + 16,
            y: cy + 30,
            width: textW - 20,
            height: 70,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: textX + 16,
          y: bodyStartY + 330,
          width: textW - 20,
          height: 24,
          text: s.footerCallout,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontStyle: 'italic',
          color: '#64748B',
          textAlign: 'left',
        });
      }
    } else if (s.layout === 'grid_2x2') {
      const cells = blocks.slice(0, 4);
      cells.forEach((b, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = 52 + col * 426;
        const cy = bodyStartY + 8 + row * 156;
        const cw = 398;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: cy,
            width: 7,
            height: 138,
            fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 3,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: cy + 4,
            width: cw,
            height: 30,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: cy + 38,
            width: cw,
            height: 96,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: 52,
          y: 432,
          width: 780,
          height: 54,
          text: s.footerCallout,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#0F172A',
          textAlign: 'left',
        });
      }
    } else if (s.layout === 'schedule') {
      blocks.slice(0, 6).forEach((b, i) => {
        const sy = bodyStartY + 8 + i * 56;
        elements.push(
          {
            id: uid('txt'),
            type: 'text',
            x: 82,
            y: sy + 6,
            width: 118,
            height: 30,
            text: b.badge || b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 218,
            y: sy + 4,
            width: 600,
            height: 44,
            text: b.badge ? `${b.heading} — ${b.body}` : b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'normal',
            color: '#0F172A',
            textAlign: 'left',
          }
        );
      });
    } else if (s.layout === 'case_analysis') {
      // 3 columns top + 4 cream shadowed algorithm bars bottom
      blocks.slice(0, 3).forEach((b, i) => {
        const cx = 52 + i * 282;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: bodyStartY + 8,
            width: 7,
            height: 128,
            fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 3,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: bodyStartY + 10,
            width: 242,
            height: 28,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 15,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: bodyStartY + 42,
            width: 242,
            height: 102,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });

      const algoLines = (s.footerCallout || '')
        .split(/[.;]\s+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 4);
      const bars = algoLines.length
        ? algoLines
        : blocks.slice(0, 4).map((b, i) => `${i + 1}. ${b.heading}`);

      bars.forEach((line, i) => {
        const by = 326 + i * 36;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: 68,
            y: by,
            width: 800,
            height: 26,
            fill: '#FAF6EE',
            stroke: '#E2D6BA',
            strokeWidth: 1,
            borderRadius: 6,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 82,
            y: by + 2,
            width: 772,
            height: 22,
            text: `${i + 1}. ${line.replace(/^\d+\.\s*/, '')}`,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });
    } else if (s.layout === 'highlight_note') {
      const isRight = index % 2 === 0;
      const imgX = isRight ? 542 : 48;
      const imgY = bodyStartY + 24;
      const textX = isRight ? 48 : 444;
      const textW = 470;

      if (photoUrl) {
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: imgX - 6,
            y: imgY - 6,
            width: 384,
            height: 290,
            fill: '#FFFFFF',
            stroke: '#E2E8F0',
            strokeWidth: 1,
            borderRadius: 18,
            shadow: true,
          },
          {
            id: uid('img'),
            type: 'image',
            x: imgX,
            y: imgY,
            width: 372,
            height: 278,
            src: photoUrl,
            imageFit: 'cover',
            borderRadius: 14,
            shadow: true,
          }
        );
      }

      blocks.slice(0, 2).forEach((b, i) => {
        const by = bodyStartY + 8 + i * 114;
        elements.push(
          {
            id: uid('txt'),
            type: 'text',
            x: photoUrl ? textX : 52,
            y: by,
            width: photoUrl ? textW - 20 : 800,
            height: 28,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: i === 0 ? '#EB6A5B' : '#B45309',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: photoUrl ? textX : 52,
            y: by + 30,
            width: photoUrl ? textW - 20 : 800,
            height: 76,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: photoUrl ? textX : 72,
          y: 416,
          width: photoUrl ? textW - 20 : 750,
          height: 54,
          text: s.footerCallout,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 14,
          fontWeight: 'bold',
          color: '#0F172A',
          textAlign: 'left',
        });
      }
    } else {
      // Default: three_columns (Spacious, full height, no jammed image!)
      blocks.slice(0, 3).forEach((b, i) => {
        const cx = 52 + i * 286;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: bodyStartY + 8,
            width: 7,
            height: 290,
            fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 3,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: bodyStartY + 10,
            width: 250,
            height: 32,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#0F172A',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 18,
            y: bodyStartY + 46,
            width: 250,
            height: 248,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'normal',
            color: '#1E293B',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: 52,
          y: 432,
          width: 780,
          height: 48,
          text: s.footerCallout,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          fontStyle: 'italic',
          color: '#475569',
          textAlign: 'left',
        });
      }
    }

    // Footer bar on slide
    elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: 40,
        y: 510,
        width: 878,
        height: 2,
        fill: '#FFFFFF',
        stroke: 'transparent',
        strokeWidth: 0,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 40,
        y: 514,
        width: 720,
        height: 20,
        text: footerLabel,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 10,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 840,
        y: 514,
        width: 78,
        height: 20,
        text: String(slideNum).padStart(2, '0'),
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        color: '#1E293B',
        textAlign: 'right',
      }
    );

    const pageBg =
      theme === 'crimson_dark'
        ? '#0F0F12'
        : theme === 'clean_white'
          ? '#FFFFFF'
          : theme === 'emerald_green'
            ? '#F7FDF9'
            : index % 2 === 0
              ? '#FFFDF5'
              : '#FFFFFF';
    pages.push({
      id: uid('wave_s'),
      title: s.title,
      background: pageBg,
      elements,
    });
  });

  // LAST SLIDE: References
  const refs = (data.references || [])
    .slice(0, 6)
    .map((r) => toPlainText(r).trim())
    .filter(Boolean);
  const lastNum = totalContentSlides.length + 3;
  const refElements: CanvasElement[] = [
    {
      id: uid('rect'),
      type: 'rect',
      x: 32,
      y: 18,
      width: 152,
      height: 30,
      fill: '#9B7EDE',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 8,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 32,
      y: 22,
      width: 152,
      height: 24,
      text: 'MANBALAR',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 42,
      y: 62,
      width: 700,
      height: 44,
      text: 'Foydalanilgan manbalar',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      color: '#0F172A',
      textAlign: 'left',
    },
  ];

  refs.forEach((refText, i) => {
    const ry = 136 + i * 54;
    refElements.push(
      {
        id: uid('circle'),
        type: 'circle',
        x: 64,
        y: ry,
        width: 28,
        height: 28,
        fill: WAVE_ACCENT_COLORS[i % WAVE_ACCENT_COLORS.length],
        stroke: 'transparent',
        strokeWidth: 0,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 64,
        y: ry + 4,
        width: 28,
        height: 22,
        text: String(i + 1),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 108,
        y: ry,
        width: 750,
        height: 44,
        text: refText,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 'normal',
        color: '#1E293B',
        textAlign: 'left',
      }
    );
  });

  refElements.push(
    {
      id: uid('rect'),
      type: 'rect',
      x: 40,
      y: 510,
      width: 878,
      height: 2,
      fill: '#FFFFFF',
      stroke: 'transparent',
      strokeWidth: 0,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 40,
      y: 514,
      width: 720,
      height: 20,
      text: footerLabel,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 10,
      color: '#475569',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 840,
      y: 514,
      width: 78,
      height: 20,
      text: String(lastNum).padStart(2, '0'),
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
      fontWeight: 'bold',
      color: '#1E293B',
      textAlign: 'right',
    }
  );

  const refBgColor =
    theme === 'crimson_dark'
      ? '#0F0F12'
      : theme === 'clean_white'
        ? '#FFFFFF'
        : theme === 'emerald_green'
          ? '#F7FDF9'
          : '#FFFDF7';

  pages.push({
    id: uid('wave_refs'),
    title: 'Manbalar',
    background: refBgColor,
    elements: refElements,
  });

  return pages;
}

// ============================================================================
// BUILDER 2: WHITE CARD PPTX (Matches Mustaqil_ish_Sahnalashtirish_20_slayd.pdf)
// ============================================================================

const CARD_ACCENTS = ['#EE6C5D', '#F5A642', '#6BB17E', '#9B7EDE', '#EC8FB5', '#F7D060'];

export function buildWhiteCardDeck(
  data: GeneratedSlideDeckData,
  meta: TemplateMetadata
): CanvasPage[] {
  const pages: CanvasPage[] = [];
  const totalContentSlides = data.slides || [];
  const footerLabel = (data.footerTopic || data.deckTitle || 'TAQDIMOT').toUpperCase();

  const wcHeroPhoto = resolveHeroPhotoUrl(data.topicImages);
  const wcTitleElems: CanvasElement[] = [
    {
      id: uid('circle'),
      type: 'circle',
      x: 760,
      y: -74,
      width: 245,
      height: 245,
      fill: '#FCD34D',
      stroke: 'transparent',
      strokeWidth: 0,
      shadow: true,
    },
    {
      id: uid('circle'),
      type: 'circle',
      x: 836,
      y: 396,
      width: 170,
      height: 170,
      fill: '#F48FB1',
      stroke: 'transparent',
      strokeWidth: 0,
      shadow: true,
    },
    {
      id: uid('rect'),
      type: 'rect',
      x: 38,
      y: 38,
      width: 172,
      height: 36,
      fill: '#EE6C5D',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 8,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 38,
      y: 42,
      width: 172,
      height: 28,
      text: truncateText((meta.subject || 'TAQDIMOT').toUpperCase(), 20),
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 52,
      y: 112,
      width: wcHeroPhoto ? 470 : 700,
      height: 156,
      text: data.deckTitle || 'Taqdimot mavzusi',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      color: '#1F2937',
      textAlign: 'left',
      lineHeight: 1.18,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 52,
      y: 278,
      width: wcHeroPhoto ? 456 : 660,
      height: 60,
      text: data.deckSubtitle || 'Asosiy mazmun va tahlil',
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 16,
      fontWeight: 'normal',
      color: '#6B7280',
      textAlign: 'left',
    },
    {
      id: uid('rect'),
      type: 'rect',
      x: 52,
      y: 368,
      width: 320,
      height: 54,
      fill: '#FDFBF2',
      stroke: '#EFECE2',
      strokeWidth: 1,
      borderRadius: 14,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 64,
      y: 378,
      width: 296,
      height: 36,
      text: `${totalContentSlides.length + 3} ta slayd asosida tayyorlangan taqdimot`,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      color: '#1F2937',
      textAlign: 'center',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 52,
      y: 486,
      width: 460,
      height: 28,
      text: `Tayyorladi: ${meta.authorName || '__________________'}   Guruh: ${meta.groupName || '________'}`,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 12,
      color: '#6B7280',
      textAlign: 'left',
    },
  ];

  if (wcHeroPhoto) {
    wcTitleElems.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: 542,
        y: 112,
        width: 376,
        height: 286,
        fill: '#FFFFFF',
        stroke: '#ECEAE2',
        strokeWidth: 1,
        borderRadius: 22,
        shadow: true,
      },
      {
        id: uid('img'),
        type: 'image',
        x: 548,
        y: 118,
        width: 364,
        height: 274,
        src: wcHeroPhoto,
        imageFit: 'cover',
        borderRadius: 18,
        shadow: true,
      }
    );
  }

  // SLIDE 1: White Title Slide with decorative right circles + optional topic photo
  pages.push({
    id: uid('wc_s1'),
    title: 'Titul',
    background: '#FFFFFF',
    elements: wcTitleElems,
  });

  // SLIDE 2: KIRISH / Taqdimot tuzilishi
  const planItems = (data.planItems || []).slice(0, 4);
  const s2Elems: CanvasElement[] = [
    {
      id: uid('rect'),
      type: 'rect',
      x: 32,
      y: 18,
      width: 112,
      height: 28,
      fill: '#F5A642',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 8,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 32,
      y: 22,
      width: 112,
      height: 22,
      text: 'KIRISH',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 42,
      y: 62,
      width: 680,
      height: 44,
      text: 'Taqdimot tuzilishi',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      color: '#1F2937',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 42,
      y: 106,
      width: 720,
      height: 26,
      text: "Bo'limlar mantiqiy ketma-ketlikda va amaliy misollar bilan yoritildi.",
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 13,
      color: '#6B7280',
      textAlign: 'left',
    },
  ];

  planItems.forEach((item, idx) => {
    const ry = 148 + idx * 78;
    s2Elems.push(
      {
        id: uid('circle'),
        type: 'circle',
        x: 56,
        y: ry + 4,
        width: 42,
        height: 42,
        fill: CARD_ACCENTS[idx % CARD_ACCENTS.length],
        stroke: 'transparent',
        strokeWidth: 0,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 56,
        y: ry + 13,
        width: 42,
        height: 24,
        text: String(idx + 1).padStart(2, '0'),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('rect'),
        type: 'rect',
        x: 112,
        y: ry,
        width: 786,
        height: 50,
        fill: '#F6F5F0',
        stroke: '#ECEAE2',
        strokeWidth: 1,
        borderRadius: 12,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 132,
        y: ry + 11,
        width: 746,
        height: 30,
        text: item.title,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'left',
      }
    );
  });

  s2Elems.push(
    {
      id: uid('rect'),
      type: 'rect',
      x: 40,
      y: 508,
      width: 880,
      height: 2,
      fill: '#E5E7EB',
      stroke: 'transparent',
      strokeWidth: 0,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 40,
      y: 514,
      width: 720,
      height: 20,
      text: footerLabel,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 10,
      color: '#6B7280',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 840,
      y: 514,
      width: 78,
      height: 20,
      text: '02',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
      fontWeight: 'bold',
      color: '#374151',
      textAlign: 'right',
    }
  );

  pages.push({
    id: uid('wc_s2'),
    title: 'Taqdimot tuzilishi',
    background: '#FFFFFF',
    elements: s2Elems,
  });

  // SLIDES 3 .. N-1
  totalContentSlides.forEach((s, index) => {
    const slideNum = index + 3;
    const pillColor = CARD_ACCENTS[index % CARD_ACCENTS.length];
    const photoUrl = resolveSlidePhotoUrl(s);
    const elements: CanvasElement[] = [
      {
        id: uid('rect'),
        type: 'rect',
        x: 32,
        y: 18,
        width: 146,
        height: 28,
        fill: pillColor,
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 8,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 32,
        y: 22,
        width: 146,
        height: 22,
        text: truncateText((s.tag || `${index + 1}-BO'LIM`).toUpperCase(), 18),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 42,
        y: 58,
        width: 876,
        height: 44,
        text: s.title || 'Boʻlim',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 26,
        fontWeight: 'bold',
        color: '#1F2937',
        textAlign: 'left',
      },
    ];

    let bodyStartY = 112;
    if (s.subtitle) {
      elements.push({
        id: uid('txt'),
        type: 'text',
        x: 42,
        y: 102,
        width: 870,
        height: 26,
        text: s.subtitle,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'left',
      });
      bodyStartY = 138;
    }

    const blocks = s.blocks || [];

    if (s.layout === 'table' && s.tableHeaders?.length && s.tableRows?.length) {
      const headers = s.tableHeaders.slice(0, 3);
      const rows = s.tableRows.slice(0, 6);
      const colWidths = [180, 326, 356];
      const colXs = [46, 232, 564];
      const headerColors = ['#EE6C5D', '#F5A642', '#6BB17E'];

      headers.forEach((h, cIdx) => {
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: colXs[cIdx],
            y: bodyStartY,
            width: colWidths[cIdx],
            height: 38,
            fill: headerColors[cIdx % 3],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 8,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: colXs[cIdx] + 8,
            y: bodyStartY + 8,
            width: colWidths[cIdx] - 16,
            height: 24,
            text: h,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'center',
          }
        );
      });

      rows.forEach((row, rIdx) => {
        const ry = bodyStartY + 46 + rIdx * 46;
        row.slice(0, 3).forEach((cell, cIdx) => {
          elements.push(
            {
              id: uid('rect'),
              type: 'rect',
              x: colXs[cIdx],
              y: ry,
              width: colWidths[cIdx],
              height: 40,
              fill: '#F6F5F0',
              stroke: '#ECEAE2',
              strokeWidth: 1,
              borderRadius: 6,
              shadow: true,
            },
            {
              id: uid('txt'),
              type: 'text',
              x: colXs[cIdx] + 10,
              y: ry + 8,
              width: colWidths[cIdx] - 20,
              height: 28,
              text: cell,
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 12,
              fontWeight: cIdx === 0 ? 'bold' : 'normal',
              color: '#1F2937',
              textAlign: 'left',
            }
          );
        });
      });
    } else if (s.layout === 'timeline') {
      const nodes = blocks.slice(0, 5);
      const count = Math.max(nodes.length, 3);
      const startX = 68;
      const endX = 788;
      const stepX = count > 1 ? (endX - startX) / (count - 1) : 0;

      elements.push({
        id: uid('rect'),
        type: 'rect',
        x: startX + 12,
        y: bodyStartY + 42,
        width: endX - startX,
        height: 5,
        fill: '#E5E7EB',
        stroke: 'transparent',
        strokeWidth: 0,
        borderRadius: 2,
      });

      nodes.forEach((b, i) => {
        const cx = startX + i * stepX;
        const colW = Math.min(160, Math.floor(780 / count) - 8);
        elements.push(
          {
            id: uid('circle'),
            type: 'circle',
            x: cx,
            y: bodyStartY + 26,
            width: 36,
            height: 36,
            fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: Math.max(32, cx - colW / 2 + 18),
            y: bodyStartY + 76,
            width: colW,
            height: 34,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'center',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: Math.max(32, cx - colW / 2 + 18),
            y: bodyStartY + 114,
            width: colW,
            height: 136,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 12,
            color: '#4B5563',
            textAlign: 'center',
          }
        );
      });

      if (s.footerCallout) {
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: 72,
            y: 410,
            width: 816,
            height: 58,
            fill: '#FDFBF2',
            stroke: '#EFECE2',
            strokeWidth: 1,
            borderRadius: 12,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 92,
            y: 418,
            width: 776,
            height: 44,
            text: s.footerCallout,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 14,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'center',
          }
        );
      }
    } else if (s.layout === 'schedule') {
      blocks.slice(0, 6).forEach((b, i) => {
        const sy = bodyStartY + 8 + i * 56;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: 60,
            y: sy,
            width: 146,
            height: 36,
            fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 8,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 64,
            y: sy + 7,
            width: 138,
            height: 24,
            text: b.badge || b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 12,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'center',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 230,
            y: sy + 5,
            width: 660,
            height: 42,
            text: b.badge ? `${b.heading} — ${b.body}` : b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 14,
            color: '#1F2937',
            textAlign: 'left',
          }
        );
      });
    } else if (s.layout === 'steps') {
      blocks.slice(0, 5).forEach((b, i) => {
        const sy = bodyStartY + 8 + i * 64;
        elements.push(
          {
            id: uid('circle'),
            type: 'circle',
            x: 62,
            y: sy,
            width: 34,
            height: 34,
            fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 62,
            y: sy + 5,
            width: 34,
            height: 24,
            text: String(i + 1),
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'bold',
            color: '#FFFFFF',
            textAlign: 'center',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 112,
            y: sy + 2,
            width: 170,
            height: 34,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 15,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 290,
            y: sy + 2,
            width: 590,
            height: 52,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: '#4B5563',
            textAlign: 'left',
          }
        );
      });
    } else if (s.layout === 'grid_2x2') {
      blocks.slice(0, 4).forEach((b, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cx = 54 + col * 432;
        const cy = bodyStartY + 8 + row * 134;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: cy,
            width: 412,
            height: 116,
            fill: '#F6F5F0',
            stroke: '#ECEAE2',
            strokeWidth: 1,
            borderRadius: 12,
            shadow: true,
          },
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: cy,
            width: 8,
            height: 116,
            fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 4,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 22,
            y: cy + 14,
            width: 374,
            height: 28,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 22,
            y: cy + 44,
            width: 374,
            height: 64,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: '#374151',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: 72,
            y: 426,
            width: 816,
            height: 52,
            fill: '#FDFBF2',
            stroke: '#EFECE2',
            strokeWidth: 1,
            borderRadius: 12,
            shadow: true,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: 92,
            y: 435,
            width: 776,
            height: 36,
            text: s.footerCallout,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 'bold',
            color: '#6B4E9B',
            textAlign: 'center',
          }
        );
      }
    } else if (
      Boolean(photoUrl) &&
      (s.layout === 'split_image_right' || s.layout === 'split_image_left')
    ) {
      const isRight = s.layout === 'split_image_right';
      const imgX = isRight ? 542 : 48;
      const imgY = bodyStartY + 26;
      const textX = isRight ? 48 : 444;
      const textW = 470;

      elements.push(
        {
          id: uid('rect'),
          type: 'rect',
          x: imgX - 6,
          y: imgY - 6,
          width: 384,
          height: 290,
          fill: '#FFFFFF',
          stroke: '#ECEAE2',
          strokeWidth: 1,
          borderRadius: 18,
          shadow: true,
        },
        {
          id: uid('img'),
          type: 'image',
          x: imgX,
          y: imgY,
          width: 372,
          height: 278,
          src: photoUrl,
          imageFit: 'cover',
          borderRadius: 14,
          shadow: true,
        }
      );

      blocks.slice(0, 3).forEach((b, i) => {
        const cy = bodyStartY + 6 + i * 112;
        const pillColor = CARD_ACCENTS[(index + i) % CARD_ACCENTS.length];
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: textX,
            y: cy,
            width: textW,
            height: 98,
            fill: '#F6F5F0',
            stroke: '#ECEAE2',
            strokeWidth: 1,
            borderRadius: 12,
            shadow: true,
          },
          {
            id: uid('rect'),
            type: 'rect',
            x: textX,
            y: cy,
            width: 8,
            height: 98,
            fill: pillColor,
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 4,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: textX + 20,
            y: cy + 12,
            width: textW - 32,
            height: 26,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: textX + 20,
            y: cy + 40,
            width: textW - 32,
            height: 52,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: '#374151',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: textX + 16,
          y: bodyStartY + 334,
          width: textW - 20,
          height: 24,
          text: s.footerCallout,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 12,
          fontStyle: 'italic',
          color: '#6B7280',
          textAlign: 'left',
        });
      }
    } else {
      // three_columns: 3 full height, elegant white cards (NO jammed image at bottom!)
      const cards = blocks.slice(0, 3);
      cards.forEach((b, i) => {
        const cx = 52 + i * 290;
        elements.push(
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: bodyStartY + 8,
            width: 274,
            height: 290,
            fill: '#F6F5F0',
            stroke: '#ECEAE2',
            strokeWidth: 1,
            borderRadius: 12,
            shadow: true,
          },
          {
            id: uid('rect'),
            type: 'rect',
            x: cx,
            y: bodyStartY + 8,
            width: 8,
            height: 290,
            fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 4,
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 22,
            y: bodyStartY + 20,
            width: 240,
            height: 30,
            text: b.heading,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 16,
            fontWeight: 'bold',
            color: '#1F2937',
            textAlign: 'left',
          },
          {
            id: uid('txt'),
            type: 'text',
            x: cx + 22,
            y: bodyStartY + 56,
            width: 240,
            height: 230,
            text: b.body,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 13,
            color: '#374151',
            textAlign: 'left',
          }
        );
      });

      if (s.footerCallout) {
        elements.push({
          id: uid('txt'),
          type: 'text',
          x: 52,
          y: 432,
          width: 780,
          height: 48,
          text: s.footerCallout,
          fontFamily: 'DM Sans, sans-serif',
          fontSize: 13,
          fontStyle: 'italic',
          color: '#6B7280',
          textAlign: 'left',
        });
      }
    }

    // Footer hairline + label + number
    elements.push(
      {
        id: uid('rect'),
        type: 'rect',
        x: 40,
        y: 508,
        width: 880,
        height: 2,
        fill: '#E5E7EB',
        stroke: 'transparent',
        strokeWidth: 0,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 40,
        y: 514,
        width: 720,
        height: 20,
        text: footerLabel,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 10,
        color: '#6B7280',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 840,
        y: 514,
        width: 78,
        height: 20,
        text: String(slideNum).padStart(2, '0'),
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        fontWeight: 'bold',
        color: '#374151',
        textAlign: 'right',
      }
    );

    pages.push({
      id: uid('wc_s'),
      title: s.title,
      background: '#FFFFFF',
      elements,
    });
  });

  // LAST SLIDE: References
  const refs = (data.references || [])
    .slice(0, 6)
    .map((r) => toPlainText(r).trim())
    .filter(Boolean);
  const lastNum = totalContentSlides.length + 3;
  const refElements: CanvasElement[] = [
    {
      id: uid('rect'),
      type: 'rect',
      x: 32,
      y: 18,
      width: 146,
      height: 28,
      fill: '#9B7EDE',
      stroke: 'transparent',
      strokeWidth: 0,
      borderRadius: 8,
      shadow: true,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 32,
      y: 22,
      width: 146,
      height: 22,
      text: 'MANBALAR',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 11,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 42,
      y: 62,
      width: 720,
      height: 44,
      text: 'Foydalanilgan manbalar',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 28,
      fontWeight: 'bold',
      color: '#1F2937',
      textAlign: 'left',
    },
  ];

  refs.forEach((refText, i) => {
    const ry = 136 + i * 54;
    refElements.push(
      {
        id: uid('circle'),
        type: 'circle',
        x: 64,
        y: ry,
        width: 28,
        height: 28,
        fill: CARD_ACCENTS[i % CARD_ACCENTS.length],
        stroke: 'transparent',
        strokeWidth: 0,
        shadow: true,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 64,
        y: ry + 4,
        width: 28,
        height: 22,
        text: String(i + 1),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 108,
        y: ry,
        width: 780,
        height: 44,
        text: refText,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        color: '#374151',
        textAlign: 'left',
      }
    );
  });

  refElements.push(
    {
      id: uid('rect'),
      type: 'rect',
      x: 40,
      y: 508,
      width: 880,
      height: 2,
      fill: '#E5E7EB',
      stroke: 'transparent',
      strokeWidth: 0,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 40,
      y: 514,
      width: 720,
      height: 20,
      text: footerLabel,
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 10,
      color: '#6B7280',
      textAlign: 'left',
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 840,
      y: 514,
      width: 78,
      height: 20,
      text: String(lastNum).padStart(2, '0'),
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 10,
      fontWeight: 'bold',
      color: '#374151',
      textAlign: 'right',
    }
  );

  pages.push({
    id: uid('wc_refs'),
    title: 'Manbalar',
    background: '#FFFFFF',
    elements: refElements,
  });

  return pages;
}

// ============================================================================
// BUILDER 3: STITCHED STANDARD NOTEBOOK PDF (Matches 2-Topshiriq_C_Dasturlash.pdf)
// ============================================================================

function createGreenNotebookCoverSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <rect width="794" height="1123" fill="#185C37"/>
  <!-- Left dark spine -->
  <rect x="0" y="0" width="38" height="1123" fill="#0E3F24"/>
  <rect x="38" y="0" width="2" height="1123" fill="#0A2D1A"/>
  <!-- Two vertical metal staples -->
  <rect x="16" y="294" width="6" height="44" rx="3" fill="#E5E7EB"/>
  <rect x="16" y="784" width="6" height="44" rx="3" fill="#E5E7EB"/>
  <!-- Subtle inner border frame -->
  <rect x="64" y="34" width="698" height="1055" fill="none" stroke="#4D8A67" stroke-width="1.2"/>
  <rect x="70" y="40" width="686" height="1043" fill="none" stroke="#3B7453" stroke-width="0.8"/>
  <!-- Top standard header -->
  <text x="415" y="72" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" letter-spacing="2" fill="#E5EFE8">O&#39;ZDST &#8226; DAVLAT STANDARTI ASOSIDA</text>
  <!-- Book circle emblem -->
  <circle cx="415" cy="122" r="24" fill="none" stroke="#85B89B" stroke-width="1.5"/>
  <path d="M402 114 C408 111, 413 113, 415 117 C417 113, 422 111, 428 114 L428 131 C422 128, 417 130, 415 133 C413 130, 408 128, 402 131 Z" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/>
  <line x1="415" y1="117" x2="415" y2="133" stroke="#FFFFFF" stroke-width="1.4"/>
  <!-- White paper label card with drop shadow -->
  <rect x="150" y="302" width="530" height="446" rx="2" fill="#0D3A21" fill-opacity="0.35"/>
  <rect x="146" y="298" width="530" height="446" rx="2" fill="#FAF9F4" stroke="#DCE5DE" stroke-width="1"/>
  <!-- Ruled field labels & lines inside white box -->
  <text x="176" y="334" font-family="sans-serif" font-size="10.5" fill="#64748B">Fan / Yo&#39;nalish:</text>
  <line x1="176" y1="368" x2="646" y2="368" stroke="#CBD5E1" stroke-width="1"/>

  <text x="176" y="404" font-family="sans-serif" font-size="10.5" fill="#64748B">O&#39;quvchi / Egasi:</text>
  <line x1="176" y1="438" x2="646" y2="438" stroke="#CBD5E1" stroke-width="1"/>

  <text x="176" y="474" font-family="sans-serif" font-size="10.5" fill="#64748B">Sinf / Guruh:</text>
  <line x1="176" y1="508" x2="410" y2="508" stroke="#CBD5E1" stroke-width="1"/>

  <text x="436" y="474" font-family="sans-serif" font-size="10.5" fill="#64748B">Daftar &#8470;:</text>
  <line x1="436" y1="508" x2="646" y2="508" stroke="#CBD5E1" stroke-width="1"/>

  <text x="176" y="544" font-family="sans-serif" font-size="10.5" fill="#64748B">Muassasa:</text>
  <line x1="176" y1="578" x2="646" y2="578" stroke="#CBD5E1" stroke-width="1"/>

  <text x="176" y="614" font-family="sans-serif" font-size="10.5" fill="#64748B">O&#39;qituvchi / Rahbar:</text>
  <line x1="176" y1="648" x2="646" y2="648" stroke="#CBD5E1" stroke-width="1"/>

  <text x="176" y="684" font-family="sans-serif" font-size="10.5" fill="#64748B">Shahar / Tuman:</text>
  <line x1="176" y1="718" x2="410" y2="718" stroke="#CBD5E1" stroke-width="1"/>

  <text x="436" y="684" font-family="sans-serif" font-size="10.5" fill="#64748B">O&#39;quv yili / Sana:</text>
  <line x1="436" y1="718" x2="646" y2="718" stroke="#CBD5E1" stroke-width="1"/>

  <!-- Bottom standard label -->
  <text x="415" y="1038" text-anchor="middle" font-family="sans-serif" font-size="11.5" font-weight="bold" letter-spacing="1.8" fill="#E5EFE8">24 VARAQ &#8226; TIKILGAN STANDART</text>
</svg>`;
  return svgToDataUri(svg);
}

function createGridPaperSvg(): string {
  const step = 18;
  const gridLeft = 42;
  const gridTop = 84;
  const gridRight = 752;
  const gridBottom = 1054;
  let lines = '';
  for (let x = gridLeft; x <= gridRight; x += step) {
    lines += `<line x1="${x}" y1="${gridTop}" x2="${x}" y2="${gridBottom}" stroke="#D8E1EC" stroke-width="0.7"/>`;
  }
  for (let y = gridTop; y <= gridBottom; y += step) {
    lines += `<line x1="${gridLeft}" y1="${y}" x2="${gridRight}" y2="${gridBottom === y ? gridBottom : y}" stroke="#D8E1EC" stroke-width="0.7"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">
  <rect width="794" height="1123" fill="#FAF8F3"/>
  ${lines}
  <!-- Outer notebook box & pink margin line -->
  <rect x="${gridLeft}" y="${gridTop}" width="${gridRight - gridLeft}" height="${gridBottom - gridTop}" fill="none" stroke="#E4BCC5" stroke-width="1.2"/>
  <line x1="92" y1="${gridTop}" x2="92" y2="${gridBottom}" stroke="#F09FB2" stroke-width="1.6"/>
  <!-- Bottom fold / header divider -->
  <line x1="${gridLeft}" y1="72" x2="${gridRight}" y2="72" stroke="#E2DFD7" stroke-width="0.8"/>
</svg>`;
  return svgToDataUri(svg);
}

const NOTEBOOK_WINDOW_THEMES = [
  '#1F2937',
  '#1D63DC',
  '#0F766E',
  '#B45309',
  '#7C3AED',
  '#DC2626',
  '#059669',
];

export function buildStitchedNotebookPdf(
  data: GeneratedNotebookData,
  meta: TemplateMetadata
): CanvasPage[] {
  const coverBg = createGreenNotebookCoverSvg();
  const gridBg = createGridPaperSvg();
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
  const pages: CanvasPage[] = [];

  // PAGE 1: Stitched Green Cover
  pages.push({
    id: uid('nb_cover'),
    title: 'Muqova',
    background: '#185C37',
    backgroundImage: coverBg,
    elements: [
      {
        id: uid('txt'),
        type: 'text',
        x: 94,
        y: 174,
        width: 642,
        height: 52,
        text: (data.coverTitle || 'DAFTAR').toUpperCase(),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 112,
        y: 230,
        width: 606,
        height: 36,
        text: data.coverSubtitle || "Fan bo'yicha topshiriqlar daftari",
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 14,
        color: '#E5EFE8',
        textAlign: 'center',
      },
      // White box editable handwritten-style fields
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 338,
        width: 470,
        height: 30,
        text: meta.subject || 'Matematika / Dasturlash',
        fontFamily: 'Georgia, serif',
        fontSize: 17,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 408,
        width: 470,
        height: 30,
        text: meta.authorName || 'Talaba Ismi',
        fontFamily: 'Georgia, serif',
        fontSize: 17,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 478,
        width: 232,
        height: 30,
        text: meta.groupName || '1-guruh',
        fontFamily: 'Georgia, serif',
        fontSize: 17,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 434,
        y: 478,
        width: 210,
        height: 30,
        text: meta.notebookNumber || '1',
        fontFamily: 'Georgia, serif',
        fontSize: 17,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 548,
        width: 470,
        height: 30,
        text: meta.institution || "Oliy ta'lim muassasasi",
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 618,
        width: 470,
        height: 30,
        text: meta.teacher || "O'qituvchi ko'rsatmasi bo'yicha",
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 174,
        y: 688,
        width: 232,
        height: 30,
        text: meta.city || "O'zbekiston",
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 434,
        y: 688,
        width: 210,
        height: 30,
        text: meta.academicYear || '2026-2027',
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontStyle: 'italic',
        color: '#0F172A',
        textAlign: 'left',
      },
    ],
  });

  // PAGES 2+: Split tasks up to 2 per grid page
  const tasks = data.tasks || [];
  const totalGridPages = Math.max(1, Math.ceil(tasks.length / 2));

  for (let pIdx = 0; pIdx < totalGridPages; pIdx++) {
    const pageTasks = tasks.slice(pIdx * 2, pIdx * 2 + 2);
    const pageSection = pageTasks[0]?.sectionLabel || data.sectionTitle || data.coverTitle;
    const elems: CanvasElement[] = [
      {
        id: uid('txt'),
        type: 'text',
        x: 98,
        y: 38,
        width: 480,
        height: 26,
        text: pageSection,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'left',
      },
      {
        id: uid('txt'),
        type: 'text',
        x: 600,
        y: 38,
        width: 150,
        height: 26,
        text: todayStr,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 12,
        color: '#64748B',
        textAlign: 'right',
      },
    ];

    let cursorY = 104;

    // On first grid page, add italic handwritten-style student heading
    if (pIdx === 0) {
      elems.push(
        {
          id: uid('txt'),
          type: 'text',
          x: 102,
          y: 102,
          width: 630,
          height: 30,
          text: `Talaba: ${meta.authorName || 'Talaba Ismi'}`,
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontStyle: 'italic',
          color: '#0F172A',
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 102,
          y: 140,
          width: 630,
          height: 30,
          text: `Guruh: ${meta.groupName || '1-guruh'}`,
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontStyle: 'italic',
          color: '#0F172A',
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 102,
          y: 178,
          width: 630,
          height: 30,
          text: `Fan: ${meta.subject || 'Asosiy fan'}`,
          fontFamily: 'Georgia, serif',
          fontSize: 16,
          fontStyle: 'italic',
          color: '#0F172A',
          textAlign: 'left',
        },
        {
          id: uid('txt'),
          type: 'text',
          x: 102,
          y: 216,
          width: 630,
          height: 32,
          text: data.coverSubtitle || 'Amaliy mashgʻulot topshiriqlari.',
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          fontStyle: 'italic',
          color: '#334155',
          textAlign: 'left',
        }
      );
      cursorY = 278;
    }

    pageTasks.forEach((task, localIdx) => {
      const globalTaskIdx = pIdx * 2 + localIdx;
      const accent = NOTEBOOK_WINDOW_THEMES[globalTaskIdx % NOTEBOOK_WINDOW_THEMES.length];
      const lines = (task.lines || []).slice(0, 12);
      const lineCount = Math.max(lines.length, 4);
      const cardH = Math.min(340, 56 + lineCount * 22);
      const cardX = 104;
      const cardW = 632;

      const numberedText = lines
        .map((line, lIdx) => `${String(lIdx + 1).padStart(2, '0')}   ${line}`)
        .join('\n');

      elems.push(
        // Card white body with colored border
        {
          id: uid('rect'),
          type: 'rect',
          x: cardX,
          y: cursorY,
          width: cardW,
          height: cardH,
          fill: '#FFFFFF',
          stroke: accent,
          strokeWidth: 1.5,
          borderRadius: 8,
          shadow: true,
        },
        // Colored top title bar
        {
          id: uid('rect'),
          type: 'rect',
          x: cardX,
          y: cursorY,
          width: cardW,
          height: 30,
          fill: accent,
          stroke: accent,
          strokeWidth: 1,
          borderRadius: 6,
        },
        // 3 macOS dots (red, yellow, green)
        {
          id: uid('circle'),
          type: 'circle',
          x: cardX + 12,
          y: cursorY + 10,
          width: 9,
          height: 9,
          fill: '#FF5F56',
          stroke: 'transparent',
          strokeWidth: 0,
        },
        {
          id: uid('circle'),
          type: 'circle',
          x: cardX + 26,
          y: cursorY + 10,
          width: 9,
          height: 9,
          fill: '#FFBD2E',
          stroke: 'transparent',
          strokeWidth: 0,
        },
        {
          id: uid('circle'),
          type: 'circle',
          x: cardX + 40,
          y: cursorY + 10,
          width: 9,
          height: 9,
          fill: '#27C93F',
          stroke: 'transparent',
          strokeWidth: 0,
        },
        // Card title in top bar
        {
          id: uid('txt'),
          type: 'text',
          x: cardX + 58,
          y: cursorY + 4,
          width: cardW - 72,
          height: 22,
          text: task.title || `${globalTaskIdx + 1}-masala`,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: 12,
          fontWeight: 'bold',
          color: '#FFFFFF',
          textAlign: 'left',
        },
        // Numbered monospace body lines
        {
          id: uid('txt'),
          type: 'text',
          x: cardX + 14,
          y: cursorY + 38,
          width: cardW - 28,
          height: cardH - 46,
          text: numberedText,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          color: '#1E293B',
          textAlign: 'left',
          lineHeight: 1.75,
        }
      );

      cursorY += cardH + 34;
    });

    // Bottom page counter (01 / 04)
    elems.push({
      id: uid('txt'),
      type: 'text',
      x: 620,
      y: 1072,
      width: 132,
      height: 24,
      text: `${String(pIdx + 1).padStart(2, '0')} / ${String(totalGridPages).padStart(2, '0')}`,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      color: '#64748B',
      textAlign: 'right',
    });

    pages.push({
      id: uid('nb_page'),
      title: `${pIdx + 1}-varaq`,
      background: '#FAF8F3',
      backgroundImage: gridBg,
      elements: elems,
    });
  }

  return pages;
}

// ============================================================================
// BUILDER 4: 5-BLOCK INFOGRAPHIC (Matches So'lak_Fiziologik_Muvozanat_Infografikasi.png)
// ============================================================================

function createHeaderEmblemSvg(theme: string): string {
  const accent = '#FFFFFF';
  const sub = '#93C5FD';
  let inner = '';
  if (theme === 'medicine') {
    inner = `<path d="M22 10 C15 10 11 16 12 24 C13 33 16 40 20 40 C22 40 23 32 25 32 C27 32 28 40 30 40 C34 40 37 33 38 24 C39 16 35 10 28 10 C26 10 25 12 25 12 C25 12 24 10 22 10 Z" fill="${accent}"/>`;
  } else if (theme === 'tech') {
    inner = `<rect x="12" y="12" width="26" height="26" rx="5" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="25" cy="25" r="5" fill="${sub}"/><path d="M25 6 V12 M25 38 V44 M6 25 H12 M38 25 H44" stroke="${accent}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else if (theme === 'business') {
    inner = `<rect x="11" y="28" width="6" height="12" rx="2" fill="${sub}"/><rect x="22" y="20" width="6" height="20" rx="2" fill="${accent}"/><rect x="33" y="11" width="6" height="29" rx="2" fill="#FACC15"/>`;
  } else if (theme === 'education') {
    inner = `<path d="M10 15 C16 12 22 13 25 17 C28 13 34 12 40 15 V37 C34 34 28 35 25 39 C22 35 16 34 10 37 Z" fill="${accent}" fill-opacity="0.92"/><line x1="25" y1="17" x2="25" y2="39" stroke="#1D4ED8" stroke-width="2"/>`;
  } else {
    // science
    inner = `<circle cx="25" cy="25" r="4" fill="#FACC15"/><ellipse cx="25" cy="25" rx="17" ry="7" fill="none" stroke="${accent}" stroke-width="2" transform="rotate(30 25 25)"/><ellipse cx="25" cy="25" rx="17" ry="7" fill="none" stroke="${sub}" stroke-width="2" transform="rotate(-30 25 25)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50">${inner}</svg>`;
  return svgToDataUri(svg);
}

function createInfographicBlockDiagramSvg(
  blockIdx: number,
  color: string,
  calloutLabels: string[]
): string {
  const c1 = escapeXml(truncateText(calloutLabels[0] || "Asosiy qism", 20));
  const c2 = escapeXml(truncateText(calloutLabels[1] || "Tahlil nuqtasi", 20));
  const c3 = escapeXml(truncateText(calloutLabels[2] || "Natija", 20));

  if (blockIdx === 0) {
    // Blue Block 1 diagram (structured node + 3 rounded callout pills)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="172" viewBox="0 0 160 172">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#EFF6FF"/>
          <stop offset="100%" stop-color="#DBEAFE"/>
        </linearGradient>
      </defs>
      <rect width="160" height="172" rx="10" fill="url(#g1)"/>
      <circle cx="46" cy="86" r="28" fill="#FFFFFF" stroke="${color}" stroke-width="2.5"/>
      <circle cx="46" cy="86" r="15" fill="${color}" fill-opacity="0.16"/>
      <circle cx="46" cy="86" r="7" fill="${color}"/>
      <path d="M68 68 L84 34 M74 86 L84 86 M68 104 L84 138" stroke="${color}" stroke-width="1.8" stroke-dasharray="3 2"/>
      <rect x="82" y="18" width="72" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="118" y="36" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c1}</text>
      <rect x="82" y="72" width="72" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="118" y="90" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c2}</text>
      <rect x="82" y="126" width="72" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="118" y="144" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c3}</text>
    </svg>`;
    return svgToDataUri(svg);
  }
  if (blockIdx === 1) {
    // Purple Block 2 diagram (balance / interconnected nodes)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="172" viewBox="0 0 132 172">
      <rect width="132" height="172" rx="10" fill="#F5F3FF"/>
      <circle cx="66" cy="54" r="28" fill="#EDE9FE" stroke="${color}" stroke-width="2"/>
      <circle cx="46" cy="112" r="20" fill="#DDD6FE" stroke="${color}" stroke-width="2"/>
      <circle cx="90" cy="116" r="18" fill="#C4B5FD" stroke="${color}" stroke-width="2"/>
      <line x1="58" y1="80" x2="50" y2="94" stroke="${color}" stroke-width="2.5"/>
      <line x1="74" y1="80" x2="84" y2="98" stroke="${color}" stroke-width="2.5"/>
      <rect x="14" y="142" width="104" height="22" rx="11" fill="${color}"/>
      <text x="66" y="156" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c1}</text>
    </svg>`;
    return svgToDataUri(svg);
  }
  if (blockIdx === 2) {
    // Green Block 3 diagram (clean droplet / composition ring)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="126" height="172" viewBox="0 0 126 172">
      <rect width="126" height="172" rx="10" fill="#ECFDF5"/>
      <circle cx="63" cy="72" r="40" fill="#D1FAE5" stroke="#15803D" stroke-width="2"/>
      <circle cx="63" cy="72" r="24" fill="#FFFFFF" stroke="#16A34A" stroke-width="2.5"/>
      <path d="M54 72 L61 79 L74 64" stroke="#15803D" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="12" y="128" width="102" height="24" rx="12" fill="#15803D"/>
      <text x="63" y="143" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c1}</text>
    </svg>`;
    return svgToDataUri(svg);
  }
  if (blockIdx === 3) {
    // Orange Block 4 diagram (wider card: flow & signal paths + 3 blue pills)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="218" height="162" viewBox="0 0 218 162">
      <rect width="218" height="162" rx="10" fill="#FFF7ED"/>
      <circle cx="52" cy="54" r="24" fill="#FDBA74" stroke="#EA580C" stroke-width="2"/>
      <circle cx="52" cy="116" r="22" fill="#FED7AA" stroke="#EA580C" stroke-width="2"/>
      <path d="M76 54 C104 54, 96 86, 118 86" stroke="#EA580C" stroke-width="2.5" fill="none"/>
      <path d="M74 116 C98 116, 98 86, 118 86" stroke="#EA580C" stroke-width="2.5" fill="none"/>
      <rect x="116" y="16" width="92" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="162" y="34" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#FFFFFF">${c1}</text>
      <rect x="116" y="68" width="92" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="162" y="86" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#FFFFFF">${c2}</text>
      <rect x="116" y="120" width="92" height="28" rx="14" fill="#1D72E8" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="162" y="138" text-anchor="middle" font-family="sans-serif" font-size="9" font-weight="bold" fill="#FFFFFF">${c3}</text>
    </svg>`;
    return svgToDataUri(svg);
  }
  // Pink Block 5 diagram (Shield / Summary badge)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="184" height="162" viewBox="0 0 184 162">
    <defs>
      <linearGradient id="shieldG" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3B82F6"/>
        <stop offset="100%" stop-color="#1D4ED8"/>
      </linearGradient>
    </defs>
    <rect width="184" height="162" rx="10" fill="#FDF2F8"/>
    <path d="M92 22 L134 38 V76 C134 106 114 128 92 138 C70 128 50 106 50 76 V38 Z" fill="url(#shieldG)" stroke="#FFFFFF" stroke-width="3"/>
    <circle cx="92" cy="76" r="20" fill="#FFFFFF"/>
    <path d="M82 76 L89 83 L103 68" stroke="#1D4ED8" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="30" y="132" width="124" height="22" rx="11" fill="#DB2777"/>
    <text x="92" y="146" text-anchor="middle" font-family="sans-serif" font-size="8.5" font-weight="bold" fill="#FFFFFF">${c1}</text>
  </svg>`;
  return svgToDataUri(svg);
}

const INFO_CARD_COLORS = ['#1D72E8', '#6D28D9', '#15803D', '#EA580C', '#DB2777'];

export function buildFiveBlockInfographic(data: GeneratedInfographicData): CanvasPage[] {
  const elements: CanvasElement[] = [
    // Top Navy Gradient Header Banner
    {
      id: uid('rect'),
      type: 'rect',
      x: 10,
      y: 8,
      width: 940,
      height: 62,
      gradient: 'linear-gradient(180deg, #1655A8 0%, #072A60 100%)',
      stroke: '#06204A',
      strokeWidth: 1,
      borderRadius: 12,
      shadow: true,
    },
    {
      id: uid('img'),
      type: 'image',
      x: 36,
      y: 14,
      width: 48,
      height: 48,
      src: createHeaderEmblemSvg(data.iconTheme || 'science'),
    },
    {
      id: uid('img'),
      type: 'image',
      x: 876,
      y: 14,
      width: 48,
      height: 48,
      src: createHeaderEmblemSvg(data.iconTheme || 'science'),
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 100,
      y: 12,
      width: 760,
      height: 28,
      text: (data.mainTitle || 'INFOGRAFIKA MAVZUSI').toUpperCase(),
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 19,
      fontWeight: 'bold',
      color: '#FFFFFF',
      textAlign: 'center',
      padding: 2,
    },
    {
      id: uid('txt'),
      type: 'text',
      x: 100,
      y: 39,
      width: 760,
      height: 26,
      text: (data.subTitle || 'ASOSIY JARAYONLAR VA MUHIM XULOSALAR').toUpperCase(),
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 16,
      fontWeight: 'bold',
      color: '#FACC15',
      textAlign: 'center',
      padding: 2,
    },
  ];

  const blocks = (data.blocks || []).slice(0, 5);

  blocks.forEach((b, idx) => {
    const isTop = idx < 3;
    const color = INFO_CARD_COLORS[idx % 5];
    const x = isTop ? 10 + idx * 318 : 10 + (idx - 3) * 477;
    const y = isTop ? 80 : 314;
    const w = isTop ? 304 : 463;
    const h = isTop ? 224 : 216;
    const headerH = 38;

    const bulletLines = (b.bullets || [])
      .slice(0, isTop ? 4 : 4)
      .map((item) => `✓  ${item.lead}: ${item.text}`)
      .join('\n');

    const diagramW = isTop ? (idx === 0 ? 136 : 114) : idx === 3 ? 204 : 172;
    const textW = w - diagramW - 22;

    elements.push(
      // Card outer box
      {
        id: uid('rect'),
        type: 'rect',
        x,
        y,
        width: w,
        height: h,
        fill: '#FFFFFF',
        stroke: color,
        strokeWidth: 2,
        borderRadius: 12,
        shadow: true,
      },
      // Colored card header bar
      {
        id: uid('rect'),
        type: 'rect',
        x,
        y,
        width: w,
        height: headerH,
        fill: color,
        stroke: color,
        strokeWidth: 1,
        borderRadius: 10,
      },
      // White numbered circle
      {
        id: uid('circle'),
        type: 'circle',
        x: x + 10,
        y: y + 6,
        width: 26,
        height: 26,
        fill: '#FFFFFF',
        stroke: 'transparent',
        strokeWidth: 0,
      },
      {
        id: uid('txt'),
        type: 'text',
        x: x + 10,
        y: y + 7,
        width: 26,
        height: 24,
        text: String(b.number || idx + 1),
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 15,
        fontWeight: 'bold',
        color,
        textAlign: 'center',
        padding: 1,
      },
      // Block header title
      {
        id: uid('txt'),
        type: 'text',
        x: x + 42,
        y: y + 7,
        width: w - 52,
        height: 26,
        text: b.title || `${idx + 1}-bo'lim`,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'left',
        padding: 2,
      },
      // Bullet points text
      {
        id: uid('txt'),
        type: 'text',
        x: x + 8,
        y: y + headerH + 6,
        width: textW,
        height: h - headerH - 12,
        text: bulletLines,
        fontFamily: 'DM Sans, sans-serif',
        fontSize: isTop ? 10.5 : 11.5,
        fontWeight: 'normal',
        color: '#0F172A',
        textAlign: 'left',
        lineHeight: 1.38,
        padding: 3,
      },
      // Custom diagram SVG with callout pills
      {
        id: uid('img'),
        type: 'image',
        x: x + w - diagramW - 8,
        y: y + headerH + 8,
        width: diagramW,
        height: h - headerH - 16,
        src: createInfographicBlockDiagramSvg(idx, color, b.calloutLabels || []),
        borderRadius: 8,
      }
    );
  });

  return [
    {
      id: uid('infographic_1'),
      title: data.mainTitle || 'Infografika',
      background: '#FFFFFF',
      elements,
    },
  ];
}
