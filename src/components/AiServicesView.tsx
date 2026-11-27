import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  GraduationCap,
  Loader2,
  Palette,
  PenTool,
  Presentation,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  ACADEMIC_WORK_STYLES,
  AI_SERVICES,
  ESSAY_ARTICLE_STYLES,
  getAiServiceById,
  PRIMARY_SERVICE_GROUPS,
} from '../data/aiServices';
import { computeServicePrice, DEFAULT_PRICING_SETTINGS, formatSom } from '../data/defaults';
import { AI_TONE_OPTIONS, SLIDE_THEMES } from '../data/slideThemes';
import {
  AcademicWordStyle,
  AiServiceId,
  AiTone,
  AppPricingSettings,
  CanvasPage,
  PdfOrientation,
  SlideDesignTheme,
  UserProfile,
  WordDocumentData,
  WorkspaceMode,
} from '../types/editor';
import {
  AcademicDocChapter,
  buildAcademicWordDocument,
  GeneratedAcademicDocData,
} from '../utils/academicWordBuilder';
import { getTelegramAuthHeaders } from '../utils/telegramClient';
import {
  buildAcademicWaveDeck,
  buildFiveBlockInfographic,
  buildStitchedNotebookPdf,
  buildWhiteCardDeck,
  GeneratedInfographicData,
  GeneratedNotebookData,
  GeneratedSlideDeckData,
  GeneratedSlideItem,
} from '../utils/templateBuilders';

export function calculateSlideDeckPrice(count: number): number {
  const safe = Math.max(5, count || 7);
  if (safe <= 7) return 4000;
  return 4000 + (safe - 7) * 500;
}

export function calculateAiCanvasPrice(count: number): number {
  const safe = Math.max(1, count || 3);
  if (safe <= 3) return 3000;
  return 3000 + (safe - 3) * 500;
}

export function calculateNotebookPrice(taskCount: number): number {
  const safe = Math.max(2, taskCount || 4);
  if (safe <= 4) return 3000;
  return 3000 + (safe - 4) * 500;
}

function distributeContentTopicPhotos(
  slides: GeneratedSlideItem[],
  realPhotos: string[]
): GeneratedSlideItem[] {
  const contentPhotoCount = Math.min(2, Math.max(0, realPhotos.length - 1));
  if (contentPhotoCount <= 0 || slides.length === 0) {
    return slides.map((s) => ({
      ...s,
      layout:
        s.layout === 'split_image_right' || s.layout === 'split_image_left'
          ? 'three_columns'
          : s.layout,
      imageUrl: undefined,
    }));
  }

  const preferredOrder = ['split_image_right', 'split_image_left', 'highlight_note', 'three_columns'];
  const picked: number[] = [];

  for (const layoutType of preferredOrder) {
    for (let i = 0; i < slides.length && picked.length < contentPhotoCount; i++) {
      if (slides[i]?.layout === layoutType && !picked.includes(i)) {
        if (picked.length === 1 && slides.length >= 3 && Math.abs(i - picked[0]) < 2) {
          continue;
        }
        picked.push(i);
      }
    }
  }

  for (let i = 0; i < slides.length && picked.length < contentPhotoCount; i++) {
    if (!picked.includes(i) && slides[i]?.layout !== 'table') {
      if (picked.length === 1 && slides.length >= 3 && Math.abs(i - picked[0]) < 2) {
        continue;
      }
      picked.push(i);
    }
  }

  for (let i = 0; i < slides.length && picked.length < contentPhotoCount; i++) {
    if (!picked.includes(i)) {
      picked.push(i);
    }
  }

  return slides.map((s, idx) => {
    const slotOrder = picked.indexOf(idx);
    if (slotOrder !== -1 && realPhotos[1 + slotOrder]) {
      const preferredLayout =
        s.layout === 'split_image_left' || s.layout === 'highlight_note'
          ? s.layout
          : slotOrder % 2 === 0
            ? 'split_image_right'
            : 'split_image_left';
      return {
        ...s,
        layout: preferredLayout,
        imageUrl: realPhotos[1 + slotOrder],
      };
    }
    return {
      ...s,
      layout:
        s.layout === 'split_image_right' || s.layout === 'split_image_left'
          ? 'three_columns'
          : s.layout,
      imageUrl: undefined,
    };
  });
}

export interface AiGeneratedPayload {
  serviceId: AiServiceId;
  serviceTitle: string;
  docTitle: string;
  pages: CanvasPage[];
  wordDoc?: WordDocumentData;
  targetMode: WorkspaceMode;
  pdfOrientation?: PdfOrientation;
  price: number;
  serverCharged?: boolean;
  newBalance?: number;
}

interface AiServicesViewProps {
  selectedService: AiServiceId;
  onSelectService: (id: AiServiceId) => void;
  balance: number;
  profile: UserProfile;
  pricingSettings?: AppPricingSettings;
  telegramSessionToken?: string | null;
  onRequestTopUp: () => void;
  onGenerated: (result: AiGeneratedPayload) => void;
}

export const ServiceThumbnail: React.FC<{ id: AiServiceId }> = ({ id }) => {
  if (id === 'independent_work_word' || id === 'course_work_word' || id === 'essay_article_word') {
    const badge = id === 'course_work_word' ? 'KURS ISHI' : id === 'essay_article_word' ? 'MAQOLA' : 'MUSTAQIL ISH';
    const accent = id === 'course_work_word' ? '#0F766E' : id === 'essay_article_word' ? '#7C3AED' : '#1E40AF';
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-200 bg-white p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-14 rounded-full bg-slate-200" />
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-xs text-white"
            style={{ backgroundColor: accent }}
          >
            {badge}
          </span>
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-xs bg-slate-800/80" />
          <div className="h-1 w-4/5 rounded-xs bg-slate-300" />
          <div className="h-1 w-3/5 rounded-xs bg-slate-300" />
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="h-1 w-10 rounded-xs bg-slate-300" />
          <span className="h-1 w-8 rounded-xs bg-slate-400" />
        </div>
      </div>
    );
  }

  if (id === 'academic_wave_pptx') {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden border border-amber-200/80 relative bg-gradient-to-br from-[#F7B12E] via-[#FFD443] to-[#FFCD38]">
        <div className="absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-b from-[#1E40AF] to-[#60A5FA] rounded-l-[24px] opacity-90" />
        <div className="absolute left-2.5 top-2.5 bottom-2.5 w-1 rounded-full bg-[#D94E41]" />
        <div className="pl-5 pr-8 pt-2.5 space-y-1.5">
          <div className="h-1.5 w-16 rounded-full bg-slate-800/80" />
          <div className="h-2 w-20 rounded-xs bg-slate-900" />
          <div className="pt-1.5 flex gap-1.5">
            <div className="h-4 w-10 rounded-xs bg-white/70" />
            <div className="h-4 w-10 rounded-xs bg-white/70" />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'white_card_pptx') {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-200 relative bg-white p-2">
        <div className="absolute -right-4 -top-4 w-9 h-9 rounded-full bg-[#FCD34D]" />
        <div className="h-2.5 w-12 rounded-xs bg-[#EE6C5D]" />
        <div className="mt-1.5 h-2 w-20 rounded-xs bg-slate-800" />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5 pr-4">
          <div className="h-6 rounded-sm bg-[#F6F5F0] border border-slate-200/80" />
          <div className="h-6 rounded-sm bg-[#F6F5F0] border border-slate-200/80" />
        </div>
      </div>
    );
  }

  if (id === 'stitched_notebook_pdf') {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden border border-emerald-900/20 relative flex bg-[#FAF8F3]">
        <div className="w-1/2 h-full bg-[#185C37] relative flex flex-col items-center justify-center p-2">
          <div className="h-1.5 w-10 rounded-full bg-white/90 mb-1" />
          <div className="w-12 h-8 bg-[#FAF9F4] rounded-[2px] p-1 space-y-1">
            <div className="h-0.5 w-full bg-slate-300" />
            <div className="h-0.5 w-3/4 bg-slate-300" />
          </div>
        </div>
        <div className="w-1/2 h-full p-2 relative bg-[#FAF8F3] border-l border-slate-200">
          <div className="rounded-sm border border-blue-600 bg-white p-1 space-y-1">
            <div className="h-1.5 bg-blue-600 rounded-xs" />
            <div className="h-1 w-full bg-slate-200" />
            <div className="h-1 w-3/5 bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'five_block_infographic') {
    return (
      <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-200 bg-white p-1.5 flex flex-col gap-1">
        <div className="h-3 rounded-sm bg-gradient-to-b from-[#1655A8] to-[#072A60]" />
        <div className="grid grid-cols-3 gap-1 flex-1">
          <div className="rounded-xs bg-[#1D72E8]/20 border border-[#1D72E8]" />
          <div className="rounded-xs bg-[#6D28D9]/20 border border-[#6D28D9]" />
          <div className="rounded-xs bg-[#15803D]/20 border border-[#15803D]" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-20 rounded-lg overflow-hidden border border-red-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-2 relative flex flex-col justify-between">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="h-1.5 w-14 rounded-full bg-white/80" />
      </div>
      <div className="space-y-1">
        <div className="h-2 w-20 rounded-xs bg-white" />
        <div className="h-1.5 w-14 rounded-xs bg-white/50" />
      </div>
    </div>
  );
};

export const AiServicesView: React.FC<AiServicesViewProps> = ({
  selectedService,
  onSelectService,
  balance,
  profile,
  pricingSettings,
  telegramSessionToken,
  onRequestTopUp,
  onGenerated,
}) => {
  const effectivePricing = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const service = getAiServiceById(selectedService);

  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [institution, setInstitution] = useState('');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [subject, setSubject] = useState('');
  const [course, setCourse] = useState('');
  const [groupName, setGroupName] = useState('');
  const [authorName, setAuthorName] = useState(profile.fullName || '');
  const [teacher, setTeacher] = useState('');
  const [city, setCity] = useState('Toshkent');
  const [notebookNumber, setNotebookNumber] = useState('1');
  const [academicYear, setAcademicYear] = useState('2025-2026');

  const [slideCount, setSlideCount] = useState<number>(7);
  const [slideCountInput, setSlideCountInput] = useState<string>('7');
  const [designTheme, setDesignTheme] = useState<SlideDesignTheme>('academic_gold');
  const [aiTone, setAiTone] = useState<AiTone>('academic');
  const [taskCount, setTaskCount] = useState<number>(4);
  const [canvasSlideCount, setCanvasSlideCount] = useState<number>(3);
  const [canvasSlideCountInput, setCanvasSlideCountInput] = useState<string>('3');
  const [includeTopicImages, setIncludeTopicImages] = useState<boolean>(true);
  const [academicChapters, setAcademicChapters] = useState<number>(2);
  const [courseChapters, setCourseChapters] = useState<number>(3);
  const [essayParts, setEssayParts] = useState<number>(1);
  const [academicStyle, setAcademicStyle] = useState<AcademicWordStyle>('classic_otm');
  const [essayStyle, setEssayStyle] = useState<AcademicWordStyle>('imrad_journal');

  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [isFourStageJob, setIsFourStageJob] = useState<boolean>(false);
  const [splitStatusText, setSplitStatusText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authorName && profile.fullName) {
      setAuthorName(profile.fullName);
    }
  }, [profile.fullName, authorName]);

  const isPptxService =
    selectedService === 'academic_wave_pptx' || selectedService === 'white_card_pptx';
  const isAiCanvasService = selectedService === 'ai_canvas_design';
  const isSlideGroup = isPptxService || isAiCanvasService;
  const isIndependentWork = selectedService === 'independent_work_word';
  const isCourseWork = selectedService === 'course_work_word';
  const isEssayArticle = selectedService === 'essay_article_word';
  const isAcademicWordService = isIndependentWork || isCourseWork || isEssayArticle;
  const isNotebookService = selectedService === 'stitched_notebook_pdf';

  const effectiveSlideCount = Math.min(30, Math.max(5, slideCount || 7));
  const effectiveCanvasCount = Math.min(20, Math.max(1, canvasSlideCount || 3));
  const activeSectionCount = isCourseWork
    ? courseChapters
    : isEssayArticle
      ? essayParts
      : academicChapters;

  const currentPrice = isPptxService
    ? computeServicePrice(selectedService, effectiveSlideCount, effectivePricing)
    : isAiCanvasService
      ? computeServicePrice('ai_canvas_design', effectiveCanvasCount, effectivePricing)
      : isAcademicWordService
        ? computeServicePrice(selectedService, activeSectionCount, effectivePricing)
        : isNotebookService
          ? computeServicePrice('stitched_notebook_pdf', taskCount, effectivePricing)
          : computeServicePrice('five_block_infographic', 1, effectivePricing);

  const pptxCfg =
    effectivePricing.services[
      selectedService === 'white_card_pptx' ? 'white_card_pptx' : 'academic_wave_pptx'
    ] || DEFAULT_PRICING_SETTINGS.services.academic_wave_pptx;
  const canvasCfg =
    effectivePricing.services.ai_canvas_design || DEFAULT_PRICING_SETTINGS.services.ai_canvas_design;
  const nbCfg =
    effectivePricing.services.stitched_notebook_pdf ||
    DEFAULT_PRICING_SETTINGS.services.stitched_notebook_pdf;
  const wordCfg =
    effectivePricing.services[
      isCourseWork
        ? 'course_work_word'
        : isEssayArticle
          ? 'essay_article_word'
          : 'independent_work_word'
    ] || DEFAULT_PRICING_SETTINGS.services.independent_work_word;

  const priceRuleHint = isPptxService
    ? `${pptxCfg.baseLimit} gacha ${formatSom(pptxCfg.basePrice)} · +1 slayd ${formatSom(pptxCfg.extraStepPrice)}`
    : isAiCanvasService
      ? `${canvasCfg.baseLimit} gacha ${formatSom(canvasCfg.basePrice)} · +1 slayd ${formatSom(canvasCfg.extraStepPrice)}`
      : isAcademicWordService
        ? isEssayArticle
          ? `Standart ${formatSom(wordCfg.basePrice)} · Kengaytirilgan +${formatSom(wordCfg.extraStepPrice)}`
          : `${wordCfg.baseLimit} bob gacha ${formatSom(wordCfg.basePrice)} · +1 bob ${formatSom(wordCfg.extraStepPrice)}`
        : isNotebookService
          ? `${nbCfg.baseLimit} blok gacha ${formatSom(nbCfg.basePrice)} · +1 blok ${formatSom(nbCfg.extraStepPrice)}`
          : null;

  const hasEnoughBalance = balance >= currentPrice;

  const activeCategory =
    isSlideGroup
      ? 'slides'
      : isIndependentWork
        ? 'independent_work'
        : isCourseWork
          ? 'course_work'
          : isEssayArticle
            ? 'essay_article'
            : 'tools';

  const getPrimaryGroupPrice = (groupId: string) => {
    if (groupId === 'slides') {
      return isSlideGroup
        ? currentPrice
        : effectivePricing.services.academic_wave_pptx.basePrice;
    }
    if (groupId === 'independent_work') {
      return (
        effectivePricing.services.independent_work_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.independent_work_word.basePrice
      );
    }
    if (groupId === 'course_work') {
      return (
        effectivePricing.services.course_work_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.course_work_word.basePrice
      );
    }
    if (groupId === 'essay_article') {
      return (
        effectivePricing.services.essay_article_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.essay_article_word.basePrice
      );
    }
    return 0;
  };

  const renderPrimaryIcon = (groupId: string) => {
    if (groupId === 'slides') return <Presentation className="w-4 h-4" />;
    if (groupId === 'independent_work') return <FileText className="w-4 h-4" />;
    if (groupId === 'course_work') return <GraduationCap className="w-4 h-4" />;
    return <PenTool className="w-4 h-4" />;
  };

  const quickSamples = isNotebookService
    ? [
        'Python: sikllar va funksiyalar',
        'Fizika: Nyuton qonunlari masalalari',
        'Matematika: Kvadrat tenglamalar',
      ]
    : isIndependentWork
      ? [
          'Raqamli iqtisodiyotda sun’iy intellekt texnologiyalari',
          'Jadidlar ma’rifatparvarlik harakati va ta’lim islohotlari',
          'Ekologik xavfsizlik va yashil energiya manbalari',
        ]
      : isCourseWork
        ? [
            'Korxonalarda moliyaviy risklarni boshqarish strategiyasi',
            'Ta’lim jarayonida zamonaviy axborot tizimlarini joriy etish',
            'Kichik biznes subyektlarining raqobatbardoshligini oshirish',
          ]
        : isEssayArticle
          ? [
              'Sun’iy intellekt davrida akademik halollik va ilmiy etika',
              'Markaziy Osiyoda suv resurslaridan barqaror foydalanish',
              'Zamonaviy ta’limda tanqidiy fikrlash metodologiyasi',
            ]
          : [
              'Sun’iy intellekt va kelajak kasblari',
              'Amir Temur davlatchilik siyosati',
              'Yashil iqtisodiyot va ekologiya',
              'Startap loyiha taqdimoti',
            ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTopic = topic.trim();
    if (!cleanTopic) {
      setErrorMsg('Iltimos, mavzu nomini kiriting.');
      return;
    }

    if (!hasEnoughBalance) {
      setErrorMsg(
        `Balans yetarli emas. Kerak: ${formatSom(currentPrice)}, mavjud: ${formatSom(balance)}.`
      );
      return;
    }

    setSlideCount(effectiveSlideCount);
    setSlideCountInput(String(effectiveSlideCount));
    setCanvasSlideCount(effectiveCanvasCount);
    setCanvasSlideCountInput(String(effectiveCanvasCount));

    setIsGenerating(true);
    setPipelineStep(1);
    setSplitStatusText(null);

    const isSplitPptx = isPptxService && effectiveSlideCount > 10;
    const isFourPartPptx = isPptxService && effectiveSlideCount > 16;
    const isSplitCanvas = isAiCanvasService && effectiveCanvasCount > 6;
    const isSplitWord = isAcademicWordService;
    const isSplitRequest = isSplitPptx || isSplitCanvas || isSplitWord;
    setIsFourStageJob(isSplitWord || isFourPartPptx);

    const stepTimer1 = window.setTimeout(() => {
      if (!isSplitRequest) setPipelineStep(2);
    }, 1600);
    const stepTimer2 = window.setTimeout(() => {
      if (!isSplitRequest) setPipelineStep(3);
    }, 4200);

    const activeControllerRef: { current: AbortController | null } = { current: null };
    let isCancelled = false;

    const postGenerate = async (bodyPayload: Record<string, unknown>, allowRetry = false) => {
      let lastError: unknown;
      const maxAttempts = allowRetry ? 2 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (isCancelled) throw new Error("So'rov bekor qilindi.");
        const ctrl = new AbortController();
        activeControllerRef.current = ctrl;
        const timer = window.setTimeout(() => ctrl.abort(), 52_000);
        try {
          const response = await fetch('/api/ai/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getTelegramAuthHeaders(telegramSessionToken),
            },
            signal: ctrl.signal,
            body: JSON.stringify(bodyPayload),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const errText = String(payload?.error || "Serverdan xatolik qaytdi.");
            const retryable =
              attempt < maxAttempts &&
              (response.status === 504 || response.status === 503 || response.status === 502 || response.status === 429);
            if (retryable) {
              await new Promise((r) => setTimeout(r, 1500));
              continue;
            }
            throw new Error(errText);
          }
          return payload as Record<string, unknown>;
        } catch (err) {
          lastError = err;
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
        } finally {
          window.clearTimeout(timer);
          if (activeControllerRef.current === ctrl) activeControllerRef.current = null;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Serverdan xatolik qaytdi.");
    };

    const normalizeChapterBucket = (code?: string, idx = 0): string => {
      const c = String(code || '').trim().toUpperCase();
      if (/^IV\b|^4\b|^4[-\s.]/.test(c)) return '4';
      if (/^III\b|^3\b|^3[-\s.]/.test(c)) return '3';
      if (/^II\b|^2\b|^2[-\s.]/.test(c)) return '2';
      if (/^I\b|^1\b|^1[-\s.]/.test(c)) return '1';
      return `idx_${idx}_${c}`;
    };

    const mergeAcademicChapters = (
      partA: AcademicDocChapter[],
      partB: AcademicDocChapter[]
    ): AcademicDocChapter[] => {
      const merged: AcademicDocChapter[] = [];
      const bucketIndex = new Map<string, number>();
      [...partA, ...partB].forEach((ch, idx) => {
        if (!ch) return;
        const key = normalizeChapterBucket(ch.code, idx);
        const existingIdx = bucketIndex.get(key);
        if (existingIdx !== undefined) {
          merged[existingIdx] = {
            ...merged[existingIdx],
            sections: [
              ...(merged[existingIdx].sections || []),
              ...(Array.isArray(ch.sections) ? ch.sections : []),
            ],
          };
        } else {
          bucketIndex.set(key, merged.length);
          merged.push({
            ...ch,
            sections: Array.isArray(ch.sections) ? [...ch.sections] : [],
          });
        }
      });
      return merged;
    };

    const summarizeChapters = (chapters: AcademicDocChapter[]) =>
      chapters.map((ch) => {
        const secs = Array.isArray(ch.sections) ? ch.sections : [];
        const lastSec = secs[secs.length - 1];
        const lastParas = Array.isArray(lastSec?.paragraphs) ? lastSec.paragraphs : [];
        return {
          code: ch.code,
          title: ch.title,
          sectionTitles: secs.map((s) => `${s.code || ''} ${s.title}`.trim()),
          lastParagraph: lastParas[lastParas.length - 1] || '',
        };
      });

    try {
      const chosenDocStyle = isEssayArticle ? essayStyle : academicStyle;
      const baseBody = {
        serviceId: selectedService,
        topic: cleanTopic,
        details: details.trim() || undefined,
        designTheme: isSlideGroup ? designTheme : undefined,
        aiTone,
        taskCount: isNotebookService ? taskCount : undefined,
        sectionCount: isAcademicWordService ? activeSectionCount : undefined,
        academicStyle: isAcademicWordService ? chosenDocStyle : undefined,
        includeTopicImages: isAiCanvasService ? includeTopicImages : undefined,
        institution: institution.trim() || undefined,
        faculty: faculty.trim() || undefined,
        department: department.trim() || undefined,
        course: course.trim() || undefined,
        authorName: authorName.trim() || undefined,
        groupName: groupName.trim() || undefined,
        subject: subject.trim() || undefined,
        teacher: teacher.trim() || undefined,
        city: city.trim() || undefined,
        notebookNumber: notebookNumber.trim() || undefined,
        academicYear: academicYear.trim() || undefined,
      };

      const meta = {
        institution: institution.trim() || undefined,
        faculty: faculty.trim() || undefined,
        department: department.trim() || undefined,
        course: course.trim() || undefined,
        authorName: authorName.trim() || undefined,
        groupName: groupName.trim() || undefined,
        subject: subject.trim() || undefined,
        teacher: teacher.trim() || undefined,
        city: city.trim() || undefined,
        notebookNumber: notebookNumber.trim() || undefined,
        academicYear: academicYear.trim() || undefined,
        designTheme: isSlideGroup ? designTheme : undefined,
      };

      let builtPages: CanvasPage[] = [];
      let builtWordDoc: WordDocumentData | undefined;
      let docTitle = cleanTopic;
      let serverCharged = false;
      let newBalance: number | undefined;
      let chargedPrice = currentPrice;

      if (isSplitWord) {
        setPipelineStep(1);
        setSplitStatusText('1/4-qism: Titul, mundarija rejasi va kirish shakllantirilmoqda...');
        const chunk1Res = await postGenerate({
          ...baseBody,
          wordChunk: 1,
        });
        if (chunk1Res.serverCharged) {
          serverCharged = true;
          if (typeof chunk1Res.newBalance === 'number') newBalance = chunk1Res.newBalance;
          if (typeof chunk1Res.chargedPrice === 'number' && chunk1Res.chargedPrice > 0) {
            chargedPrice = chunk1Res.chargedPrice;
          }
        }
        const splitJobToken =
          typeof chunk1Res.splitJobToken === 'string' ? chunk1Res.splitJobToken : undefined;
        const c1 = (chunk1Res.data || {}) as GeneratedAcademicDocData;

        setPipelineStep(2);
        setSplitStatusText('2/4-qism: Nazariy boblar va asosiy tushunchalar yozilmoqda...');
        const chunk2Res = await postGenerate(
          {
            ...baseBody,
            wordChunk: 2,
            splitJobToken,
            wordContext: {
              title: c1.title || cleanTopic,
              subtitle: c1.subtitle,
              planOutline: c1.planOutline || [],
              introGoal: c1.introduction?.goal || cleanTopic,
            },
          },
          true
        );
        const c2 = (chunk2Res.data || {}) as { chapters?: AcademicDocChapter[] };
        const chapters2 = Array.isArray(c2.chapters) ? c2.chapters : [];

        setPipelineStep(3);
        setSplitStatusText('3/4-qism: Davomiy boblar va amaliy tahlil ulanmoqda...');
        const chunk3Res = await postGenerate(
          {
            ...baseBody,
            wordChunk: 3,
            splitJobToken,
            wordContext: {
              title: c1.title || cleanTopic,
              subtitle: c1.subtitle,
              planOutline: c1.planOutline || [],
              introGoal: c1.introduction?.goal || cleanTopic,
              previousChaptersSummary: summarizeChapters(chapters2),
            },
          },
          true
        );
        const c3 = (chunk3Res.data || {}) as { chapters?: AcademicDocChapter[] };
        const chapters3 = Array.isArray(c3.chapters) ? c3.chapters : [];
        const allChapters = mergeAcademicChapters(chapters2, chapters3);

        setPipelineStep(4);
        setSplitStatusText('4/4-qism: Tahliliy jadval, xulosa va adabiyotlar jamlanmoqda...');
        const chunk4Res = await postGenerate(
          {
            ...baseBody,
            wordChunk: 4,
            splitJobToken,
            wordContext: {
              title: c1.title || cleanTopic,
              subtitle: c1.subtitle,
              planOutline: c1.planOutline || [],
              previousChaptersSummary: summarizeChapters(allChapters),
            },
          },
          true
        );
        const c4 = (chunk4Res.data || {}) as {
          comparisonTable?: GeneratedAcademicDocData['comparisonTable'];
          conclusion?: string[];
          references?: string[];
        };

        const mergedWordData: GeneratedAcademicDocData = {
          ...c1,
          chapters: allChapters,
          comparisonTable: c4.comparisonTable,
          conclusion: Array.isArray(c4.conclusion) ? c4.conclusion : [],
          references: Array.isArray(c4.references) ? c4.references : [],
        };

        const built = buildAcademicWordDocument(
          mergedWordData,
          meta,
          selectedService as 'independent_work_word' | 'course_work_word' | 'essay_article_word',
          chosenDocStyle
        );
        builtWordDoc = built.wordDoc;
        docTitle = built.docTitle;
      } else if (isSplitPptx) {
        const totalContentCount = Math.max(2, effectiveSlideCount - 3);
        const chunkCounts = isFourPartPptx
          ? (() => {
              const base = Math.floor(totalContentCount / 4);
              let rem = totalContentCount % 4;
              return [0, 1, 2, 3].map(() => {
                const extra = rem > 0 ? 1 : 0;
                if (rem > 0) rem -= 1;
                return base + extra;
              }).filter((c) => c > 0);
            })()
          : [Math.ceil(totalContentCount / 2), totalContentCount - Math.ceil(totalContentCount / 2)];

        const part1Count = chunkCounts[0];
        setPipelineStep(1);
        setSplitStatusText(
          isFourPartPptx
            ? `1/${chunkCounts.length}-qism: Titul, reja va dastlabki slaydlar tuzilmoqda...`
            : '1-bosqich: Asosiy reja va birinchi qism tuzilmoqda...'
        );
        const part1Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveSlideCount,
          splitMode: 'part1',
          part1Count,
        });
        if (part1Res.serverCharged) {
          serverCharged = true;
          if (typeof part1Res.newBalance === 'number') newBalance = part1Res.newBalance;
          if (typeof part1Res.chargedPrice === 'number' && part1Res.chargedPrice > 0) {
            chargedPrice = part1Res.chargedPrice;
          }
        }
        const splitJobToken =
          typeof part1Res.splitJobToken === 'string' ? part1Res.splitJobToken : undefined;
        const part1Data = part1Res.data as GeneratedSlideDeckData;
        let accumulatedSlides: GeneratedSlideItem[] = Array.isArray(part1Data.slides)
          ? part1Data.slides.slice(0, part1Count)
          : [];
        let finalRefs: string[] = part1Data.references || [];

        for (let idx = 1; idx < chunkCounts.length; idx += 1) {
          const need = chunkCounts[idx];
          const isFinal = idx === chunkCounts.length - 1;
          const modeName = (`part${idx + 1}`) as 'part2' | 'part3' | 'part4';
          setPipelineStep(Math.min(4, idx + 1));
          setSplitStatusText(
            `${idx + 1}/${chunkCounts.length}-qism: ${isFinal ? 'Yakuniy slaydlar va manbalar' : 'Davomiy slaydlar'} yaratilmoqda...`
          );
          const nextRes = await postGenerate(
            {
              ...baseBody,
              slideCount: effectiveSlideCount,
              splitMode: modeName,
              splitJobToken,
              part1Count: accumulatedSlides.length,
              part2Count: need,
              partStageLabel: `${idx + 1}/${chunkCounts.length}-QISM${isFinal ? ' (YAKUNIY)' : ' DAVOMI'}`,
              isFinalPart: isFinal,
              previousContext: {
                deckTitle: part1Data.deckTitle || cleanTopic,
                deckSubtitle: part1Data.deckSubtitle,
                institution: part1Data.institution,
                direction: part1Data.direction,
                footerTopic: part1Data.footerTopic,
                planItems: part1Data.planItems || [],
                previousSlides: accumulatedSlides.map((s) => ({
                  tag: s.tag,
                  title: s.title,
                })),
              },
            },
            true
          );
          const nextData = nextRes.data as {
            slides?: GeneratedSlideItem[];
            references?: string[];
          };
          if (Array.isArray(nextData.slides)) {
            accumulatedSlides = [...accumulatedSlides, ...nextData.slides.slice(0, need)];
          }
          if (isFinal && Array.isArray(nextData.references) && nextData.references.length > 0) {
            finalRefs = nextData.references;
          }
        }

        setPipelineStep(isFourPartPptx ? 4 : 3);
        setSplitStatusText('Dizayn va sahifalar jamlanmoqda...');

        const topicPhotos = Array.isArray(part1Data.topicImages) ? part1Data.topicImages : [];
        const mergedDeck: GeneratedSlideDeckData = {
          ...part1Data,
          slides: distributeContentTopicPhotos(accumulatedSlides, topicPhotos),
          references: finalRefs,
        };

        builtPages =
          selectedService === 'academic_wave_pptx'
            ? buildAcademicWaveDeck(mergedDeck, meta)
            : buildWhiteCardDeck(mergedDeck, meta);
        docTitle = mergedDeck.deckTitle || cleanTopic;
      } else if (isSplitCanvas) {
        const part1Count = Math.ceil(effectiveCanvasCount / 2);
        const part2Count = effectiveCanvasCount - part1Count;

        setSplitStatusText('1-bosqich: Vizual kompozitsiyalar chizilmoqda...');
        const part1Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveCanvasCount,
          splitMode: 'part1',
          part1Count,
        });
        if (part1Res.serverCharged) {
          serverCharged = true;
          if (typeof part1Res.newBalance === 'number') newBalance = part1Res.newBalance;
          if (typeof part1Res.chargedPrice === 'number' && part1Res.chargedPrice > 0) {
            chargedPrice = part1Res.chargedPrice;
          }
        }
        const splitJobToken =
          typeof part1Res.splitJobToken === 'string' ? part1Res.splitJobToken : undefined;
        const part1Data = part1Res.data as {
          deckTitle?: string;
          pages?: CanvasPage[];
          unusedTopicImages?: string[];
        };
        const pages1 = Array.isArray(part1Data?.pages) ? part1Data.pages : [];
        const unusedPhotos = Array.isArray(part1Data?.unusedTopicImages)
          ? part1Data.unusedTopicImages
          : [];

        setPipelineStep(2);
        setSplitStatusText('2-bosqich: Qolgan sahifalar dizayni yaratilmoqda...');
        const part2Res = await postGenerate(
          {
            ...baseBody,
            slideCount: effectiveCanvasCount,
            splitMode: 'part2',
            splitJobToken,
            part1Count,
            part2Count,
            pendingPhotoSlots: unusedPhotos.length,
            previousContext: {
              deckTitle: part1Data?.deckTitle || cleanTopic,
              previousSlides: pages1.map((p, idx) => ({
                tag: String(idx + 1).padStart(2, '0'),
                title: p.title || `Bo'lim ${idx + 1}`,
              })),
            },
          },
          true
        );
        const part2Data = part2Res.data as { pages?: CanvasPage[] };
        const rawPages2 = Array.isArray(part2Data?.pages) ? part2Data.pages : [];

        setPipelineStep(3);
        setSplitStatusText('Sahifalar yakuniy holatga keltirilmoqda...');

        const resolvedPages2 = rawPages2.map((p) => ({
          ...p,
          elements: p.elements
            .map((el) => {
              if (el.type === 'image' && typeof el.src === 'string' && el.src.startsWith('__PENDING_PHOTO_')) {
                const idx = Number(el.src.replace('__PENDING_PHOTO_', '').replace('__', '')) || 0;
                const realSrc = unusedPhotos[idx] || unusedPhotos[0];
                return realSrc ? { ...el, src: realSrc } : el;
              }
              return el;
            })
            .filter((el) => !(el.type === 'image' && typeof el.src === 'string' && el.src.startsWith('__PENDING_PHOTO_'))),
        }));

        builtPages = [...pages1, ...resolvedPages2].slice(0, effectiveCanvasCount);
        docTitle = part1Data?.deckTitle || cleanTopic;
      } else {
        const payload = await postGenerate({
          ...baseBody,
          slideCount: isPptxService
            ? effectiveSlideCount
            : isAiCanvasService
              ? effectiveCanvasCount
              : undefined,
        });
        if (payload.serverCharged) {
          serverCharged = true;
          if (typeof payload.newBalance === 'number') newBalance = payload.newBalance;
          if (typeof payload.chargedPrice === 'number' && payload.chargedPrice > 0) {
            chargedPrice = payload.chargedPrice;
          }
        }

        setPipelineStep(3);

        if (selectedService === 'academic_wave_pptx') {
          const deckData = payload.data as GeneratedSlideDeckData;
          builtPages = buildAcademicWaveDeck(deckData, meta);
          docTitle = deckData.deckTitle || cleanTopic;
        } else if (selectedService === 'white_card_pptx') {
          const deckData = payload.data as GeneratedSlideDeckData;
          builtPages = buildWhiteCardDeck(deckData, meta);
          docTitle = deckData.deckTitle || cleanTopic;
        } else if (selectedService === 'stitched_notebook_pdf') {
          const nbData = payload.data as GeneratedNotebookData;
          builtPages = buildStitchedNotebookPdf(nbData, meta);
          docTitle = nbData.coverTitle || cleanTopic;
        } else if (selectedService === 'five_block_infographic') {
          const infoData = payload.data as GeneratedInfographicData;
          builtPages = buildFiveBlockInfographic(infoData);
          docTitle = infoData.mainTitle || cleanTopic;
        } else if (selectedService === 'ai_canvas_design') {
          const canvasData = payload.data as { deckTitle?: string; pages?: CanvasPage[] };
          builtPages = Array.isArray(canvasData?.pages) ? canvasData.pages : [];
          docTitle = canvasData?.deckTitle || cleanTopic;
        }
      }

      if (service.targetMode === 'word') {
        if (!builtWordDoc || !builtWordDoc.html.trim()) {
          throw new Error("Hujjat matni shakllanmadi. Qaytadan urinib ko'ring.");
        }
      } else if (!builtPages.length) {
        throw new Error("Sahifalar tuzilmasi yaratilmadi. Qaytadan urinib ko'ring.");
      }

      onGenerated({
        serviceId: selectedService,
        serviceTitle: service.title,
        docTitle,
        pages: builtPages,
        wordDoc: builtWordDoc,
        targetMode: service.targetMode,
        pdfOrientation: isNotebookService ? 'portrait' : undefined,
        price: chargedPrice,
        serverCharged,
        newBalance,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg("So'rov vaqti tugadi. Iltimos, qaytadan urinib ko'ring.");
      } else {
        setErrorMsg(
          err instanceof Error ? err.message : "Yaratishda kutilmagan xatolik yuz berdi."
        );
      }
    } finally {
      isCancelled = true;
      activeControllerRef.current?.abort();
      window.clearTimeout(stepTimer1);
      window.clearTimeout(stepTimer2);
      setIsGenerating(false);
      setIsFourStageJob(false);
      setPipelineStep(0);
      setSplitStatusText(null);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-3.5 py-4 md:px-6 md:py-5">
      <div className="max-w-5xl mx-auto space-y-3.5">
        {/* Compact Header Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-600" />
              <h1 className="font-display text-base md:text-lg font-bold text-zinc-900">
                Akademik va Taqdimot Xizmatlari
              </h1>
            </div>
            <p className="text-xs text-zinc-500">
              Yo'nalishni tanlang, mavzuni kiriting va tayyor hujjatni yuklab oling.
            </p>
          </div>

          <div className="flex items-center gap-2.5 bg-[#111113] text-white border border-zinc-800 rounded-xl px-3 py-1.5 self-start sm:self-auto">
            <Wallet className="w-3.5 h-3.5 text-red-500" />
            <div className="text-xs">
              <span className="text-zinc-400">Balans: </span>
              <span className="font-mono tabular-nums font-bold text-white">
                {formatSom(balance)}
              </span>
            </div>
            {!hasEnoughBalance && (
              <button
                type="button"
                onClick={onRequestTopUp}
                className="ml-1 px-2.5 py-0.5 text-[11px] font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors whitespace-nowrap"
              >
                To'ldirish
              </button>
            )}
          </div>
        </section>

        {/* PRIMARY ROW: 4 Main Services (Slayd, Mustaqil ish, Kurs ishi, Esse / Maqola) */}
        <section className="space-y-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {PRIMARY_SERVICE_GROUPS.map((group) => {
              const active = activeCategory === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    onSelectService(group.defaultServiceId);
                    setErrorMsg(null);
                  }}
                  className={`text-left rounded-xl px-3 py-2.5 border transition-all flex flex-col justify-between gap-1.5 bg-white min-h-[44px] ${
                    active
                      ? 'border-red-600 ring-2 ring-red-600/15 bg-red-50/20'
                      : 'border-zinc-200 hover:border-zinc-300'
                  } disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: active ? '#DC2626' : group.accentColor }}
                      >
                        {renderPrimaryIcon(group.id)}
                      </span>
                      <span className="text-xs md:text-sm font-bold text-zinc-900 truncate">
                        {group.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0 whitespace-nowrap">
                      {group.formatLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-zinc-500 truncate">{group.subtitle}</span>
                    <span className="text-[11px] font-mono tabular-nums font-semibold text-red-600 shrink-0">
                      {formatSom(getPrimaryGroupPrice(group.id))}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Compact Secondary Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-zinc-500">Qo'shimcha:</span>
            {AI_SERVICES.filter((s) => s.category === 'tools').map((tool) => {
              const active = selectedService === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => {
                    onSelectService(tool.id);
                    setErrorMsg(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{tool.shortTitle}</span>
                  <span className={`font-mono tabular-nums text-[11px] ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    ({formatSom(effectivePricing.services[tool.id].basePrice)})
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* INPUTS FIRST: Main Form Card Immediately Visible */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 space-y-4"
        >
          {/* Form Header + Immediate Price & Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-zinc-900 truncate">
                {service.title}
              </h2>
              <p className="text-xs text-zinc-500 truncate">{service.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="text-xs font-mono tabular-nums font-bold text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                  {formatSom(currentPrice)}
                </div>
                {priceRuleHint && (
                  <div className="text-[10px] text-zinc-400 mt-0.5">{priceRuleHint}</div>
                )}
              </div>
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl text-xs md:text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Jarayonda...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Yaratish</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 1. CORE INPUTS AT TOP */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 space-y-1.5">
              <label htmlFor="ai-topic" className="block text-xs font-semibold text-slate-800">
                Mavzu nomi <span className="text-red-500">*</span>
              </label>
              <input
                id="ai-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  isIndependentWork
                    ? 'Masalan: Raqamli iqtisodiyotda sun’iy intellektning o‘rni'
                    : isCourseWork
                      ? 'Masalan: Korxona moliyaviy barqarorligini tahlil qilish usullari'
                      : isEssayArticle
                        ? 'Masalan: Zamonaviy ta’limda tanqidiy fikrlash metodologiyasi'
                        : isNotebookService
                          ? 'Masalan: C++ dasturlash: sikl va massivlar'
                          : 'Masalan: Amir Temur davlatchilik siyosati'
                }
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-slate-400">Namuna:</span>
                {quickSamples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setTopic(sample)}
                    className="px-2 py-0.5 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume / Slide Count Input Right Beside Topic */}
            <div className="md:col-span-4 space-y-1.5">
              {isPptxService && (
                <>
                  <label htmlFor="ai-slides" className="block text-xs font-semibold text-slate-800">
                    Slaydlar soni (5–30)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="ai-slides"
                      type="number"
                      min={5}
                      max={30}
                      inputMode="numeric"
                      value={slideCountInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setSlideCountInput(raw);
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          setSlideCount(Math.min(30, Math.max(5, Math.round(parsed))));
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number(slideCountInput);
                        const clamped =
                          Number.isFinite(parsed) && parsed > 0
                            ? Math.min(30, Math.max(5, Math.round(parsed)))
                            : 7;
                        setSlideCount(clamped);
                        setSlideCountInput(String(clamped));
                      }}
                      className="w-20 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                    />
                    <div className="flex items-center gap-1">
                      {[7, 10, 15, 20].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setSlideCount(n);
                            setSlideCountInput(String(n));
                          }}
                          className={`px-2 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors ${
                            effectiveSlideCount === n
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {isAiCanvasService && (
                <>
                  <label htmlFor="ai-canvas-slides" className="block text-xs font-semibold text-slate-800">
                    Slaydlar soni (1–20)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="ai-canvas-slides"
                      type="number"
                      min={1}
                      max={20}
                      inputMode="numeric"
                      value={canvasSlideCountInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCanvasSlideCountInput(raw);
                        const parsed = Number(raw);
                        if (Number.isFinite(parsed) && parsed > 0) {
                          setCanvasSlideCount(Math.min(20, Math.max(1, Math.round(parsed))));
                        }
                      }}
                      onBlur={() => {
                        const parsed = Number(canvasSlideCountInput);
                        const clamped =
                          Number.isFinite(parsed) && parsed > 0
                            ? Math.min(20, Math.max(1, Math.round(parsed)))
                            : 3;
                        setCanvasSlideCount(clamped);
                        setCanvasSlideCountInput(String(clamped));
                      }}
                      className="w-20 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                    />
                    <div className="flex items-center gap-1">
                      {[1, 3, 5, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setCanvasSlideCount(n);
                            setCanvasSlideCountInput(String(n));
                          }}
                          className={`px-2 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors ${
                            effectiveCanvasCount === n
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(isIndependentWork || isCourseWork) && (
                <>
                  <label htmlFor="ai-chapters" className="block text-xs font-semibold text-slate-800">
                    Boblar hajmi
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[2, 3, 4].map((ch) => {
                      const val = isCourseWork ? courseChapters : academicChapters;
                      return (
                        <button
                          key={ch}
                          type="button"
                          onClick={() =>
                            isCourseWork ? setCourseChapters(ch) : setAcademicChapters(ch)
                          }
                          className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                            val === ch
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ch} bob
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {isEssayArticle && (
                <>
                  <label className="block text-xs font-semibold text-slate-800">
                    Maqola / Esse hajmi
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { v: 1, label: 'Standart' },
                      { v: 2, label: 'Kengaytirilgan' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setEssayParts(opt.v)}
                        className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                          essayParts === opt.v
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {isNotebookService && (
                <>
                  <label htmlFor="ai-tasks" className="block text-xs font-semibold text-slate-800">
                    Topshiriqlar soni
                  </label>
                  <select
                    id="ai-tasks"
                    value={taskCount}
                    onChange={(e) => setTaskCount(Number(e.target.value))}
                    className="w-full text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 rounded-xl px-3 py-2 outline-none"
                  >
                    {[2, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} ta blok ({1 + Math.ceil(n / 2)} sahifa)
                      </option>
                    ))}
                  </select>
                </>
              )}

              {selectedService === 'five_block_infographic' && (
                <>
                  <label className="block text-xs font-semibold text-slate-800">Format</label>
                  <div className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5">
                    16:9 · 5 blokli poster
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 2. COMPACT DESIGN & STYLE SELECTORS */}
          <div className="pt-2 border-t border-zinc-100 space-y-3">
            {/* Slide Sub-template & Compact Theme Chips */}
            {isSlideGroup && (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Slayd andozasi:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_SERVICES.filter((s) => s.category === 'slides').map((sub) => {
                      const active = selectedService === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectService(sub.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                            active
                              ? 'bg-zinc-900 text-white border-zinc-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sub.shortTitle}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Compact Color Swatch Grid */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Palette className="w-3.5 h-3.5 text-red-600" />
                      <span>Dizayn rangi:</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {SLIDE_THEMES.find((t) => t.id === designTheme)?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {SLIDE_THEMES.map((theme) => {
                      const selected = designTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setDesignTheme(theme.id)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                            selected
                              ? 'border-red-600 bg-red-50/60 ring-1 ring-red-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-md border border-black/15 shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: theme.pageBg }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: theme.primaryAccent }}
                            />
                          </span>
                          <span className="text-xs font-medium text-slate-800 truncate flex-1">
                            {theme.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isAiCanvasService && (
                  <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTopicImages}
                      onChange={(e) => setIncludeTopicImages(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                    />
                    <span>Mavzuga mos real rasmlarni kanvasga joylashtirish</span>
                  </label>
                )}
              </div>
            )}

            {/* Academic Work / Essay Style Selector */}
            {isAcademicWordService && (
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Palette className="w-3.5 h-3.5 text-red-600" />
                  <span>
                    {isEssayArticle ? 'Maqola / Esse formati:' : "Hujjat dizayni (O'zDST standarti):"}
                  </span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {(isEssayArticle ? ESSAY_ARTICLE_STYLES : ACADEMIC_WORK_STYLES).map((st) => {
                    const currentStyle = isEssayArticle ? essayStyle : academicStyle;
                    const active = currentStyle === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() =>
                          isEssayArticle ? setEssayStyle(st.id) : setAcademicStyle(st.id)
                        }
                        className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                          active
                            ? 'border-red-600 bg-red-50/50 text-slate-900'
                            : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-semibold">{st.label}</div>
                        <div className="text-[11px] text-slate-500 truncate">{st.shortDesc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact 1-row AI Tone */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-700">Bayon uslubi:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {AI_TONE_OPTIONS.map((tone) => {
                  const active = aiTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setAiTone(tone.id)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-colors truncate ${
                        active
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. SEPARATED TITUL & AUTHOR METADATA */}
          <div className="pt-2 border-t border-zinc-100 space-y-2.5">
            <div className="text-xs font-semibold text-slate-700">
              Titul varag‘i va ijrochi ma’lumotlari (har bir band alohida)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label htmlFor="ai-inst" className="block text-[11px] font-medium text-slate-600">
                  Ta'lim muassasasi
                </label>
                <input
                  id="ai-inst"
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Masalan: O'zMU / TATU / SamDU"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-faculty" className="block text-[11px] font-medium text-slate-600">
                  Fakultet
                </label>
                <input
                  id="ai-faculty"
                  type="text"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  placeholder="Masalan: Iqtisodiyot fakulteti"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-department" className="block text-[11px] font-medium text-slate-600">
                  Kafedra
                </label>
                <input
                  id="ai-department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Masalan: Menejment kafedrasi"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-subject" className="block text-[11px] font-medium text-slate-600">
                  Fan nomi
                </label>
                <input
                  id="ai-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Masalan: Makroiqtisodiyot"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-course" className="block text-[11px] font-medium text-slate-600">
                  Kurs (alohida)
                </label>
                <input
                  id="ai-course"
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="Masalan: 3-kurs"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-group" className="block text-[11px] font-medium text-slate-600">
                  Guruh (alohida)
                </label>
                <input
                  id="ai-group"
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Masalan: 214-22 guruh"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-author" className="block text-[11px] font-medium text-slate-600">
                  Tayyorladi / Bajaruvchi (F.I.O.)
                </label>
                <input
                  id="ai-author"
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Masalan: Karimov Sardor"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="ai-teacher" className="block text-[11px] font-medium text-slate-600">
                  Tekshiruvchi / Ilmiy rahbar
                </label>
                <input
                  id="ai-teacher"
                  type="text"
                  value={teacher}
                  onChange={(e) => setTeacher(e.target.value)}
                  placeholder="Masalan: dots. A. Raximov"
                  className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="ai-city" className="block text-[11px] font-medium text-slate-600">
                    Shahar
                  </label>
                  <input
                    id="ai-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Toshkent"
                    className="w-full text-xs text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-2.5 py-2 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="ai-year" className="block text-[11px] font-medium text-slate-600">
                    {isNotebookService ? 'Daftar №' : "O'quv yili"}
                  </label>
                  {isNotebookService ? (
                    <input
                      id="ai-year"
                      type="text"
                      value={notebookNumber}
                      onChange={(e) => setNotebookNumber(e.target.value)}
                      className="w-full text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-2.5 py-2 outline-none"
                    />
                  ) : (
                    <input
                      id="ai-year"
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full text-xs font-mono text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-lg px-2.5 py-2 outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. ADDITIONAL NOTES */}
          <div className="space-y-1">
            <label htmlFor="ai-details" className="block text-[11px] font-medium text-slate-600">
              Qo'shimcha topshiriq yoki asosiy reja bandlari (ixtiyoriy)
            </label>
            <textarea
              id="ai-details"
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Reja bandlari, masala shartlari yoki kerakli faktlarni yozishingiz mumkin..."
              className="w-full text-xs md:text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2 outline-none resize-none"
            />
          </div>

          {/* Pipeline Progress Indicator */}
          {isGenerating && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                <span>{splitStatusText || 'Hujjat tuzilmasi shakllantirilmoqda...'}</span>
              </div>
              <div className={`grid grid-cols-1 ${isFourStageJob ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2 text-xs`}>
                {(isFourStageJob
                  ? [
                      { step: 1, label: '1. Titul va reja' },
                      { step: 2, label: '2. Nazariy qism' },
                      { step: 3, label: '3. Asosiy tahlil' },
                      { step: 4, label: '4. Xulosa va yakun' },
                    ]
                  : [
                      { step: 1, label: '1. Mavzu tahlili' },
                      { step: 2, label: '2. Boblar va mazmun' },
                      { step: 3, label: '3. Rasmiylashtirish' },
                    ]
                ).map((item) => {
                  const done = pipelineStep > item.step;
                  const active = pipelineStep === item.step;
                  return (
                    <div
                      key={item.step}
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                        done
                          ? 'bg-white border-emerald-200 text-emerald-700'
                          : active
                            ? 'bg-white border-red-300 text-red-700 font-medium'
                            : 'bg-white/50 border-zinc-200 text-zinc-400'
                      }`}
                    >
                      {done ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-current shrink-0" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
              {!hasEnoughBalance && (
                <button
                  type="button"
                  onClick={onRequestTopUp}
                  className="font-semibold underline shrink-0"
                >
                  To'ldirish
                </button>
              )}
            </div>
          )}

          {/* Bottom Submit Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <span className="text-xs text-zinc-500">
              Tayyor natija hujjat muhitida ochiladi va Telegram botga ham yuboriladi.
            </span>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Tayyorlanmoqda...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Yaratish ({formatSom(currentPrice)})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
