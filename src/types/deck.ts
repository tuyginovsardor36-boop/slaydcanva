export type SlideLayout =
  | 'title'
  | 'bullets'
  | 'two-column'
  | 'metrics'
  | 'process'
  | 'quote'
  | 'table'
  | 'visual-split'
  | 'ai-canvas';

export type ThemeId =
  | 'swiss-ivory'
  | 'obsidian-slate'
  | 'editorial-ink'
  | 'forest-monograph'
  | 'cobalt-blueprint'
  | 'sandstone-warmth';

export type ChartType = 'bar' | 'line' | 'donut';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface ChartData {
  type: ChartType;
  title: string;
  unit?: string;
  points: ChartPoint[];
}

export interface SlideColumn {
  title: string;
  items: string[];
}

export interface SlideMetric {
  value: string;
  label: string;
  delta?: string;
}

export interface SlideStep {
  number: string;
  title: string;
  description: string;
}

export interface SlideTable {
  headers: string[];
  rows: string[][];
}

export interface SlideImage {
  url: string;
  caption?: string;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  kicker?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  columns?: SlideColumn[];
  metrics?: SlideMetric[];
  steps?: SlideStep[];
  quote?: string;
  attribution?: string;
  table?: SlideTable;
  chart?: ChartData;
  imageUrl?: string;
  imageCaption?: string;
  images?: SlideImage[];
  imageSearchQuery?: string;
  aiCanvasSvg?: string;
  callout?: string;
  speakerNotes?: string;
}

export interface TopicImageCandidate {
  url: string;
  caption: string;
  query: string;
}

export interface Deck {
  id: string;
  title: string;
  subtitle?: string;
  themeId: ThemeId;
  slides: Slide[];
  updatedAt: string;
  createdAt: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  bgHex: string;
  surfaceHex: string;
  borderHex: string;
  inkHex: string;
  mutedHex: string;
  accentHex: string;
  accentSoftHex: string;
  accentInkHex: string;
  titleFont: 'display' | 'serif';
  chartPalette: string[];
}

export interface GenerateOutlineSlide {
  layout: SlideLayout;
  title: string;
  summary: string;
}

export interface GenerateDeckPayload {
  topic: string;
  audience: string;
  tone: string;
  slideCount: number;
  themeId: ThemeId;
  sourceNotes?: string;
  outline?: GenerateOutlineSlide[];
}
