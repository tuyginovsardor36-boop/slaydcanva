import { AcademicWordStyle, AiServiceId, WorkspaceMode } from '../types/editor';

export interface AiServiceDefinition {
  id: AiServiceId;
  category: 'slides' | 'independent_work' | 'course_work' | 'essay_article' | 'tools';
  title: string;
  shortTitle: string;
  subtitle: string;
  formatLabel: string;
  price: number;
  targetMode: WorkspaceMode;
  badgeColor: string;
}

export const AI_SERVICES: AiServiceDefinition[] = [
  {
    id: 'academic_wave_pptx',
    category: 'slides',
    title: "Slayd · Akademik to'lqin",
    shortTitle: "Akademik to'lqin",
    subtitle: "To'lqinli titul, reja, tahlil va manbalar bilan prezentatsiya",
    formatLabel: 'PPTX · PDF',
    price: 4000,
    targetMode: 'pptx',
    badgeColor: '#F59E0B',
  },
  {
    id: 'white_card_pptx',
    category: 'slides',
    title: 'Slayd · Oq kartochkali',
    shortTitle: 'Oq kartochkali',
    subtitle: 'Toza kartochkalar, solishtirma jadvallar va zamonaviy bloklar',
    formatLabel: 'PPTX · PDF',
    price: 4000,
    targetMode: 'pptx',
    badgeColor: '#EE6C5D',
  },
  {
    id: 'ai_canvas_design',
    category: 'slides',
    title: 'Slayd · AI Canvas',
    shortTitle: 'AI Canvas',
    subtitle: 'Vektor illyustratsiyalar va mavzu rasmlari bilan erkin slayd dizayni',
    formatLabel: 'PPTX · 16:9',
    price: 3000,
    targetMode: 'pptx',
    badgeColor: '#DC2626',
  },
  {
    id: 'independent_work_word',
    category: 'independent_work',
    title: 'Mustaqil ish (Referat)',
    shortTitle: 'Mustaqil ish',
    subtitle: "O'zDST standarti: Titul varag'i, Reja, Kirish, 2-3 bob, Xulosa, Adabiyotlar",
    formatLabel: 'Word · PDF',
    price: 5000,
    targetMode: 'word',
    badgeColor: '#1E40AF',
  },
  {
    id: 'course_work_word',
    category: 'course_work',
    title: 'Kurs ishi',
    shortTitle: 'Kurs ishi',
    subtitle: "OTM talabi: Rasmiy Titul, metodologik Kirish, 3 bob, jadval va 12+ manba",
    formatLabel: 'Word · PDF',
    price: 9000,
    targetMode: 'word',
    badgeColor: '#0F766E',
  },
  {
    id: 'essay_article_word',
    category: 'essay_article',
    title: 'Esse va Ilmiy maqola',
    shortTitle: 'Esse / Maqola',
    subtitle: 'IMRAD ilmiy maqola, tahliliy esse yoki konferensiya tezisi',
    formatLabel: 'Word · PDF',
    price: 4000,
    targetMode: 'word',
    badgeColor: '#7C3AED',
  },
  {
    id: 'stitched_notebook_pdf',
    category: 'tools',
    title: 'Tikilgan daftar · PDF',
    shortTitle: 'Tikilgan daftar',
    subtitle: "Yashil O'ZDST muqova, katak daftar varaqlari va masala/kod bloklari",
    formatLabel: 'PDF · A4',
    price: 3000,
    targetMode: 'pdf',
    badgeColor: '#185C37',
  },
  {
    id: 'five_block_infographic',
    category: 'tools',
    title: '5-blokli Infografika',
    shortTitle: 'Infografika',
    subtitle: '5 ta rangli karta, belgi va vizual sxemalar',
    formatLabel: '16:9 · PDF',
    price: 4000,
    targetMode: 'pptx',
    badgeColor: '#1D72E8',
  },
];

export interface PrimaryServiceGroup {
  id: 'slides' | 'independent_work' | 'course_work' | 'essay_article';
  title: string;
  subtitle: string;
  formatLabel: string;
  defaultServiceId: AiServiceId;
  accentColor: string;
}

export const PRIMARY_SERVICE_GROUPS: PrimaryServiceGroup[] = [
  {
    id: 'slides',
    title: 'Slayd',
    subtitle: 'Prezentatsiya va taqdimot',
    formatLabel: 'PPTX · PDF',
    defaultServiceId: 'academic_wave_pptx',
    accentColor: '#DC2626',
  },
  {
    id: 'independent_work',
    title: 'Mustaqil ish',
    subtitle: 'Referat · OTM standarti',
    formatLabel: 'DOCX · PDF',
    defaultServiceId: 'independent_work_word',
    accentColor: '#1E40AF',
  },
  {
    id: 'course_work',
    title: 'Kurs ishi',
    subtitle: 'Chuqur ilmiy tadqiqot',
    formatLabel: 'DOCX · PDF',
    defaultServiceId: 'course_work_word',
    accentColor: '#0F766E',
  },
  {
    id: 'essay_article',
    title: 'Esse / Maqola',
    subtitle: 'IMRAD, esse va tezis',
    formatLabel: 'DOCX · PDF',
    defaultServiceId: 'essay_article_word',
    accentColor: '#7C3AED',
  },
];

export interface AcademicStyleOption {
  id: AcademicWordStyle;
  label: string;
  shortDesc: string;
}

export const ACADEMIC_WORK_STYLES: AcademicStyleOption[] = [
  {
    id: 'classic_otm',
    label: 'Klassik OTM standarti',
    shortDesc: 'Times New Roman 14pt, 1.5 interval, sof oq',
  },
  {
    id: 'framed_academic',
    label: 'Akademik ramkali titul',
    shortDesc: 'Titulda klassik qora chiziqli hoshiya va aniq shajara',
  },
  {
    id: 'modern_university',
    label: 'Zamonaviy universitet',
    shortDesc: "To'q ko'k urg'uli sarlavha va tartibli tahliliy jadval",
  },
];

export const ESSAY_ARTICLE_STYLES: AcademicStyleOption[] = [
  {
    id: 'imrad_journal',
    label: 'Ilmiy maqola (IMRAD)',
    shortDesc: 'Annotatsiya, kalit so‘zlar, metodologiya, natijalar, xulosa',
  },
  {
    id: 'analytical_essay',
    label: 'Tahliliy Esse',
    shortDesc: 'Tezisli kirish, kuchli dalillar zanjiri va sintez xulosa',
  },
  {
    id: 'conference_thesis',
    label: 'Konferensiya tezisi',
    shortDesc: "Lo'nda ilmiy muammo, natija va takliflar formati",
  },
];

export function getAiServiceById(id: AiServiceId): AiServiceDefinition {
  return AI_SERVICES.find((s) => s.id === id) || AI_SERVICES[0];
}
