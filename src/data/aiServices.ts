import { AiServiceId, WorkspaceMode } from '../types/editor';

export interface AiServiceDefinition {
  id: AiServiceId;
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
    title: "Akademik to'lqin · PPTX",
    shortTitle: "Akademik to'lqin",
    subtitle: "Oltin-ko'k to'lqinli titul, reja, jadval va manbalar bilan to'liq taqdimot",
    formatLabel: 'PPTX · 16:9',
    price: 4000,
    targetMode: 'pptx',
    badgeColor: '#F59E0B',
  },
  {
    id: 'white_card_pptx',
    title: 'Oq kartochkali · PPTX',
    shortTitle: 'Oq kartochkali',
    subtitle: 'Toza oq fon, rangli teglar, soyali kartochkalar va zamonaviy jadvallar',
    formatLabel: 'PPTX · 16:9',
    price: 4000,
    targetMode: 'pptx',
    badgeColor: '#EE6C5D',
  },
  {
    id: 'stitched_notebook_pdf',
    title: 'Tikilgan daftar · PDF',
    shortTitle: 'Tikilgan daftar',
    subtitle: "Yashil O'ZDST muqova, katak daftar varaqlari va raqamlangan masala/kod bloklari",
    formatLabel: 'PDF · A4',
    price: 3000,
    targetMode: 'pdf',
    badgeColor: '#185C37',
  },
  {
    id: 'five_block_infographic',
    title: '5-blokli Infografika',
    shortTitle: 'Infografika 5-blok',
    subtitle: "Yuqori ko'k sarlavha, 5 ta rangli karta, belgi va vizual sxemalar",
    formatLabel: '16:9 · PNG / PDF',
    price: 3000,
    targetMode: 'pptx',
    badgeColor: '#1D72E8',
  },
  {
    id: 'ai_canvas_design',
    title: 'AI Dizayn Canvas · Erkin',
    shortTitle: 'AI Canvas',
    subtitle: "AI o'z kanvasida mavzuga mos vektor illyustratsiya, 1–3 rasm va noyob dizayn chizadi",
    formatLabel: '16:9 · AI Canvas',
    price: 3000,
    targetMode: 'pptx',
    badgeColor: '#DC2626',
  },
];

export function getAiServiceById(id: AiServiceId): AiServiceDefinition {
  return AI_SERVICES.find((s) => s.id === id) || AI_SERVICES[0];
}
