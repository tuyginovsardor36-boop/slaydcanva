import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { AI_SERVICES, getAiServiceById } from '../data/aiServices';
import { formatSom } from '../data/defaults';
import { AiServiceId, CanvasPage, PdfOrientation, UserProfile, WorkspaceMode } from '../types/editor';
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
  targetMode: WorkspaceMode;
  pdfOrientation?: PdfOrientation;
  price: number;
}

interface AiServicesViewProps {
  selectedService: AiServiceId;
  onSelectService: (id: AiServiceId) => void;
  balance: number;
  profile: UserProfile;
  onRequestTopUp: () => void;
  onGenerated: (result: AiGeneratedPayload) => void;
}

export const ServiceThumbnail: React.FC<{ id: AiServiceId }> = ({ id }) => {
  if (id === 'academic_wave_pptx') {
    return (
      <div className="w-full h-24 rounded-lg overflow-hidden border border-amber-200/80 relative bg-gradient-to-br from-[#F7B12E] via-[#FFD443] to-[#FFCD38]">
        <div className="absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-b from-[#1E40AF] to-[#60A5FA] rounded-l-[24px] opacity-90" />
        <div className="absolute left-2.5 top-2.5 bottom-2.5 w-1 rounded-full bg-[#D94E41]" />
        <div className="pl-5 pr-8 pt-3 space-y-1.5">
          <div className="h-1.5 w-16 rounded-full bg-slate-800/80" />
          <div className="h-2.5 w-24 rounded-xs bg-slate-900" />
          <div className="h-1.5 w-20 rounded-full bg-slate-700/60" />
          <div className="pt-2 flex gap-1.5">
            <div className="h-5 w-10 rounded-xs bg-white/60 border-l-2 border-[#EB6A5B]" />
            <div className="h-5 w-10 rounded-xs bg-white/60 border-l-2 border-[#68B684]" />
          </div>
        </div>
      </div>
    );
  }

  if (id === 'white_card_pptx') {
    return (
      <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 relative bg-white p-2.5">
        <div className="absolute -right-4 -top-4 w-10 h-10 rounded-full bg-[#FCD34D]" />
        <div className="absolute -right-3 -bottom-3 w-8 h-8 rounded-full bg-[#F48FB1]" />
        <div className="h-3 w-12 rounded-xs bg-[#EE6C5D]" />
        <div className="mt-2 h-2.5 w-24 rounded-xs bg-slate-800" />
        <div className="mt-2 grid grid-cols-2 gap-1.5 pr-4">
          <div className="h-8 rounded-sm bg-[#F6F5F0] border border-slate-200/80 border-l-2 border-l-[#EE6C5D]" />
          <div className="h-8 rounded-sm bg-[#F6F5F0] border border-slate-200/80 border-l-2 border-l-[#6BB17E]" />
        </div>
      </div>
    );
  }

  if (id === 'stitched_notebook_pdf') {
    return (
      <div className="w-full h-24 rounded-lg overflow-hidden border border-emerald-900/20 relative flex bg-[#FAF8F3]">
        <div className="w-1/2 h-full bg-[#185C37] relative flex flex-col items-center justify-center p-2">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#0E3F24]" />
          <div className="h-1.5 w-10 rounded-full bg-white/90 mb-1.5" />
          <div className="w-14 h-11 bg-[#FAF9F4] rounded-[2px] p-1 space-y-1">
            <div className="h-0.5 w-full bg-slate-300" />
            <div className="h-0.5 w-full bg-slate-300" />
            <div className="h-0.5 w-3/4 bg-slate-300" />
          </div>
        </div>
        <div className="w-1/2 h-full p-2 relative bg-[#FAF8F3] border-l border-slate-200">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-rose-300" />
          <div className="ml-2 mt-1 rounded-sm border border-blue-600 bg-white overflow-hidden">
            <div className="h-2.5 bg-blue-600 flex items-center gap-0.5 px-1">
              <span className="w-1 h-1 rounded-full bg-rose-400" />
              <span className="w-1 h-1 rounded-full bg-amber-300" />
              <span className="w-1 h-1 rounded-full bg-emerald-400" />
            </div>
            <div className="p-1 space-y-1">
              <div className="h-1 w-full bg-slate-200" />
              <div className="h-1 w-4/5 bg-slate-200" />
              <div className="h-1 w-3/5 bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (id === 'five_block_infographic') {
    return (
      <div className="w-full h-24 rounded-lg overflow-hidden border border-slate-200 bg-white p-1.5 flex flex-col gap-1">
        <div className="h-3.5 rounded-sm bg-gradient-to-b from-[#1655A8] to-[#072A60] flex items-center justify-center">
          <div className="h-1 w-16 rounded-full bg-[#FACC15]" />
        </div>
        <div className="grid grid-cols-3 gap-1 flex-1">
          <div className="rounded-xs border border-[#1D72E8] overflow-hidden">
            <div className="h-2 bg-[#1D72E8]" />
          </div>
          <div className="rounded-xs border border-[#6D28D9] overflow-hidden">
            <div className="h-2 bg-[#6D28D9]" />
          </div>
          <div className="rounded-xs border border-[#15803D] overflow-hidden">
            <div className="h-2 bg-[#15803D]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1 flex-1">
          <div className="rounded-xs border border-[#EA580C] overflow-hidden">
            <div className="h-2 bg-[#EA580C]" />
          </div>
          <div className="rounded-xs border border-[#DB2777] overflow-hidden">
            <div className="h-2 bg-[#DB2777]" />
          </div>
        </div>
      </div>
    );
  }

  // ai_canvas_design
  return (
    <div className="w-full h-24 rounded-lg overflow-hidden border border-red-200/70 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-2 relative flex flex-col justify-between">
      <div className="absolute -right-3 -top-3 w-12 h-12 rounded-full bg-red-500/30" />
      <div className="absolute right-4 bottom-2 w-10 h-10 rounded-lg border border-white/25 bg-white/10" />
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="h-1.5 w-14 rounded-full bg-white/80" />
      </div>
      <div className="space-y-1 pr-10">
        <div className="h-2 w-24 rounded-xs bg-white" />
        <div className="h-1.5 w-16 rounded-xs bg-white/50" />
      </div>
      <div className="flex gap-1 pr-10">
        <div className="h-3 w-10 rounded-xs bg-red-500/80" />
        <div className="h-3 w-10 rounded-xs bg-white/15" />
      </div>
    </div>
  );
};

export const AiServicesView: React.FC<AiServicesViewProps> = ({
  selectedService,
  onSelectService,
  balance,
  profile,
  onRequestTopUp,
  onGenerated,
}) => {
  const service = getAiServiceById(selectedService);

  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [subject, setSubject] = useState('');
  const [institution, setInstitution] = useState('');
  const [authorName, setAuthorName] = useState(profile.fullName || '');
  const [groupName, setGroupName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [city, setCity] = useState('');
  const [notebookNumber, setNotebookNumber] = useState('1');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [slideCount, setSlideCount] = useState<number>(7);
  const [slideCountInput, setSlideCountInput] = useState<string>('7');
  const [designTheme, setDesignTheme] = useState<
    'academic_gold' | 'crimson_dark' | 'clean_white' | 'emerald_green'
  >('academic_gold');
  const [taskCount, setTaskCount] = useState<number>(4);
  const [canvasSlideCount, setCanvasSlideCount] = useState<number>(3);
  const [canvasSlideCountInput, setCanvasSlideCountInput] = useState<string>('3');
  const [includeTopicImages, setIncludeTopicImages] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [splitStatusText, setSplitStatusText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authorName && profile.fullName) {
      setAuthorName(profile.fullName);
    }
  }, [profile.fullName, authorName]);

  const isPptxService =
    selectedService === 'academic_wave_pptx' || selectedService === 'white_card_pptx';
  const isNotebookService = selectedService === 'stitched_notebook_pdf';
  const isAiCanvasService = selectedService === 'ai_canvas_design';
  const effectiveSlideCount = Math.min(30, Math.max(5, slideCount || 7));
  const effectiveCanvasCount = Math.min(20, Math.max(1, canvasSlideCount || 3));
  const currentPrice = isPptxService
    ? calculateSlideDeckPrice(effectiveSlideCount)
    : isAiCanvasService
      ? calculateAiCanvasPrice(effectiveCanvasCount)
      : isNotebookService
        ? calculateNotebookPrice(taskCount)
        : service.price;
  const priceRuleHint = isPptxService
    ? "7 ta gacha 4 000 so'm, keyingi har bir slayd +500 so'm"
    : isAiCanvasService
      ? "3 ta gacha 3 000 so'm, keyingi har bir slayd +500 so'm"
      : isNotebookService
        ? "4 blok (3 sahifa) gacha 3 000 so'm, keyingi har bir blok +500 so'm"
        : null;
  const hasEnoughBalance = balance >= currentPrice;

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
    const isSplitCanvas = isAiCanvasService && effectiveCanvasCount > 6;
    const isSplitRequest = isSplitPptx || isSplitCanvas;

    const stepTimer1 = window.setTimeout(() => {
      if (!isSplitRequest) setPipelineStep(2);
    }, 1600);
    const stepTimer2 = window.setTimeout(() => {
      if (!isSplitRequest) setPipelineStep(3);
    }, 4200);

    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), isSplitRequest ? 150_000 : 85_000);

    const postGenerate = async (bodyPayload: Record<string, unknown>) => {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(bodyPayload),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Serverdan xatolik qaytdi.");
      }
      return payload;
    };

    try {
      const baseBody = {
        serviceId: selectedService,
        topic: cleanTopic,
        details: details.trim() || undefined,
        designTheme: isPptxService ? designTheme : undefined,
        taskCount: isNotebookService ? taskCount : undefined,
        includeTopicImages: isAiCanvasService ? includeTopicImages : undefined,
        institution: institution.trim() || undefined,
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
        authorName: authorName.trim() || undefined,
        groupName: groupName.trim() || undefined,
        subject: subject.trim() || undefined,
        teacher: teacher.trim() || undefined,
        city: city.trim() || undefined,
        notebookNumber: notebookNumber.trim() || undefined,
        academicYear: academicYear.trim() || undefined,
        designTheme: isPptxService ? designTheme : undefined,
      };

      let builtPages: CanvasPage[] = [];
      let docTitle = cleanTopic;

      if (isSplitPptx) {
        const totalContentCount = Math.max(2, effectiveSlideCount - 3);
        const part1Count = Math.ceil(totalContentCount / 2);
        const part2Count = totalContentCount - part1Count;

        setSplitStatusText(`1/2-qism: Reja va dastlabki ${part1Count} ta bo'lim yaratilmoqda...`);
        const part1Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveSlideCount,
          splitMode: 'part1',
          part1Count,
        });
        const part1Data = part1Res.data as GeneratedSlideDeckData;

        setPipelineStep(2);
        setSplitStatusText(`2/2-qism: Davomidan ${part2Count} ta bo'lim va manbalar ulanmoqda...`);
        const part2Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveSlideCount,
          splitMode: 'part2',
          part1Count,
          part2Count,
          previousContext: {
            deckTitle: part1Data.deckTitle || cleanTopic,
            deckSubtitle: part1Data.deckSubtitle,
            institution: part1Data.institution,
            direction: part1Data.direction,
            footerTopic: part1Data.footerTopic,
            planItems: part1Data.planItems || [],
            previousSlides: (part1Data.slides || []).map((s) => ({
              tag: s.tag,
              title: s.title,
            })),
          },
        });
        const part2Data = part2Res.data as {
          slides?: GeneratedSlideItem[];
          references?: string[];
        };

        setPipelineStep(3);
        setSplitStatusText('Barcha slaydlar birlashtirilmoqda va dizaynga solinmoqda...');

        const combinedSlidesRaw = [
          ...(Array.isArray(part1Data.slides) ? part1Data.slides.slice(0, part1Count) : []),
          ...(Array.isArray(part2Data.slides) ? part2Data.slides.slice(0, part2Count) : []),
        ];
        const topicPhotos = Array.isArray(part1Data.topicImages) ? part1Data.topicImages : [];
        const mergedDeck: GeneratedSlideDeckData = {
          ...part1Data,
          slides: distributeContentTopicPhotos(combinedSlidesRaw, topicPhotos),
          references:
            Array.isArray(part2Data.references) && part2Data.references.length > 0
              ? part2Data.references
              : part1Data.references || [],
        };

        builtPages =
          selectedService === 'academic_wave_pptx'
            ? buildAcademicWaveDeck(mergedDeck, meta)
            : buildWhiteCardDeck(mergedDeck, meta);
        docTitle = mergedDeck.deckTitle || cleanTopic;
      } else if (isSplitCanvas) {
        const part1Count = Math.ceil(effectiveCanvasCount / 2);
        const part2Count = effectiveCanvasCount - part1Count;

        setSplitStatusText(`1/2-qism: Dastlabki ${part1Count} ta AI Canvas slayd chizilmoqda...`);
        const part1Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveCanvasCount,
          splitMode: 'part1',
          part1Count,
        });
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
        setSplitStatusText(`2/2-qism: Davomidan ${part2Count} ta AI Canvas slayd chizilmoqda...`);
        const part2Res = await postGenerate({
          ...baseBody,
          slideCount: effectiveCanvasCount,
          splitMode: 'part2',
          part1Count,
          part2Count,
          pendingPhotoSlots: unusedPhotos.length,
          previousContext: {
            deckTitle: part1Data?.deckTitle || cleanTopic,
            previousSlides: pages1.map((p, idx) => ({
              tag: String(idx + 1).padStart(2, '0'),
              title: p.title || `Dizayn ${idx + 1}`,
            })),
          },
        });
        const part2Data = part2Res.data as { pages?: CanvasPage[] };
        const rawPages2 = Array.isArray(part2Data?.pages) ? part2Data.pages : [];

        setPipelineStep(3);
        setSplitStatusText('AI Canvas sahifalari birlashtirilmoqda...');

        const resolvedPages2 = rawPages2.map((p) => ({
          ...p,
          elements: p.elements.map((el) => {
            if (el.type === 'image' && typeof el.src === 'string' && el.src.startsWith('__PENDING_PHOTO_')) {
              const idx = Number(el.src.replace('__PENDING_PHOTO_', '').replace('__', '')) || 0;
              const realSrc = unusedPhotos[idx] || unusedPhotos[0];
              return realSrc ? { ...el, src: realSrc } : el;
            }
            return el;
          }).filter((el) => !(el.type === 'image' && typeof el.src === 'string' && el.src.startsWith('__PENDING_PHOTO_'))),
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

      if (!builtPages.length) {
        throw new Error("Sahifalar tuzilmasi yaratilmadi. Qaytadan urinib ko'ring.");
      }

      onGenerated({
        serviceId: selectedService,
        serviceTitle: service.title,
        docTitle,
        pages: builtPages,
        targetMode: service.targetMode,
        pdfOrientation: isNotebookService ? 'portrait' : undefined,
        price: currentPrice,
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
      window.clearTimeout(requestTimeout);
      window.clearTimeout(stepTimer1);
      window.clearTimeout(stepTimer2);
      setIsGenerating(false);
      setPipelineStep(0);
      setSplitStatusText(null);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-4 py-5 md:px-6 md:py-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header Bar */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-600" />
              <h1 className="font-display text-lg md:text-xl font-bold text-zinc-900">
                Sun'iy intellekt xizmatlari
              </h1>
            </div>
            <p className="text-xs md:text-sm text-zinc-500 mt-0.5">
              Shablonni tanlang, mavzuni kiriting — tayyor dizayn muhitda ochiladi.
            </p>
          </div>

          <div className="flex items-center gap-2.5 bg-[#111113] text-white border border-zinc-800 rounded-xl px-3.5 py-2 self-start sm:self-auto">
            <Wallet className="w-4 h-4 text-red-500" />
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
                className="ml-1 px-2.5 py-1 text-[11px] font-medium text-white bg-red-600 hover:bg-red-500 rounded-full transition-colors"
              >
                To'ldirish
              </button>
            )}
          </div>
        </section>

        {/* 5 Service Cards Selector */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {AI_SERVICES.map((item) => {
            const active = item.id === selectedService;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  onSelectService(item.id);
                  setErrorMsg(null);
                }}
                className={`text-left rounded-2xl p-3 border transition-all flex flex-col gap-2.5 bg-white ${
                  active
                    ? 'border-red-600 ring-2 ring-red-600/15'
                    : 'border-zinc-200 hover:border-zinc-300'
                } disabled:opacity-60`}
              >
                <ServiceThumbnail id={item.id} />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-900 leading-tight">
                      {item.shortTitle}
                    </span>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-zinc-100 text-zinc-600 shrink-0">
                      {item.formatLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                    {item.subtitle}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-xs font-mono tabular-nums font-semibold text-zinc-900">
                    {active ? formatSom(currentPrice) : `${formatSom(item.price)}${item.id !== 'five_block_infographic' ? '+' : ''}`}
                  </span>
                  {active && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
                      <Check className="w-3.5 h-3.5" />
                      Tanlandi
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </section>

        {/* Generation Configuration Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-zinc-900">
                {service.title}
              </h2>
              <p className="text-xs text-zinc-500">{service.subtitle}</p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-0.5 self-start sm:self-auto">
              <div className="text-xs font-mono tabular-nums font-semibold text-red-700 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                Xizmat narxi: {formatSom(currentPrice)}
              </div>
              {priceRuleHint && (
                <span className="text-[10px] text-zinc-400 px-1">{priceRuleHint}</span>
              )}
            </div>
          </div>

          {/* Core Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="ai-topic" className="block text-xs font-medium text-slate-700">
                Mavzu nomi <span className="text-red-500">*</span>
              </label>
              <input
                id="ai-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  isNotebookService
                    ? "Masalan: C++ dasturlash asoslari: tarmoqlanish va sikl operatorlari"
                    : selectedService === 'five_block_infographic'
                      ? "Masalan: So'lak reaksiyasi fiziologik konstanta sifatida"
                      : "Masalan: Bolalarni sahnalashtirish va ijodiy faoliyatga o'rgatish"
                }
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-subject" className="block text-xs font-medium text-slate-700">
                Fan / Yo'nalish
              </label>
              <input
                id="ai-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Masalan: Pedagogika / Dasturlash / Fiziologiya"
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />
            </div>

            {isPptxService && (
              <div className="space-y-1.5">
                <label htmlFor="ai-slides" className="block text-xs font-medium text-slate-700">
                  Slaydlar soni (qo'lda kiriting: 5–30)
                </label>
                <div className="flex items-center gap-2">
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
                      const clamped = Number.isFinite(parsed) && parsed > 0
                        ? Math.min(30, Math.max(5, Math.round(parsed)))
                        : 7;
                      setSlideCount(clamped);
                      setSlideCountInput(String(clamped));
                    }}
                    placeholder="Masalan: 20"
                    className="w-28 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                  <div className="flex flex-wrap items-center gap-1">
                    {[7, 10, 15, 20].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setSlideCount(n);
                          setSlideCountInput(String(n));
                        }}
                        className={`px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors ${
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
                {effectiveSlideCount > 10 && (
                  <p className="text-[11px] text-slate-500">
                    Katta hajmli ({effectiveSlideCount} sahifa) so'rov avtomatik 2 qismga bo'linib uzluksiz yaratiladi.
                  </p>
                )}
              </div>
            )}

            {isNotebookService && (
              <div className="space-y-1.5">
                <label htmlFor="ai-tasks" className="block text-xs font-medium text-slate-700">
                  Topshiriq / masala bloklari soni
                </label>
                <select
                  id="ai-tasks"
                  value={taskCount}
                  onChange={(e) => setTaskCount(Number(e.target.value))}
                  className="w-full text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                >
                  {[2, 4, 6, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} ta blok ({1 + Math.ceil(n / 2)} sahifa)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedService === 'five_block_infographic' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">Format</label>
                <div className="w-full text-sm font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  16:9 (960×540) · 5 ta rangli blok
                </div>
              </div>
            )}

            {isAiCanvasService && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="ai-canvas-slides" className="block text-xs font-medium text-slate-700">
                    Slaydlar soni (qo'lda kiriting: 1–20)
                  </label>
                  <div className="flex items-center gap-2">
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
                        const clamped = Number.isFinite(parsed) && parsed > 0
                          ? Math.min(20, Math.max(1, Math.round(parsed)))
                          : 3;
                        setCanvasSlideCount(clamped);
                        setCanvasSlideCountInput(String(clamped));
                      }}
                      placeholder="Masalan: 10"
                      className="w-24 text-sm font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      {[1, 3, 5, 10, 20].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            setCanvasSlideCount(n);
                            setCanvasSlideCountInput(String(n));
                          }}
                          className={`px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border transition-colors ${
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
                  {effectiveCanvasCount > 6 && (
                    <p className="text-[11px] text-slate-500">
                      Katta hajmli ({effectiveCanvasCount} sahifa) so'rov 2 qismga bo'linib uzluksiz chiziladi.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2 flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <input
                    id="ai-canvas-photos"
                    type="checkbox"
                    checked={includeTopicImages}
                    onChange={(e) => setIncludeTopicImages(e.target.checked)}
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="ai-canvas-photos" className="text-xs text-slate-700 cursor-pointer">
                    Mavzuga mos haqiqiy rasmlardan (1–3 ta) kanvasga joylashtirish
                  </label>
                </div>
              </>
            )}

            {/* Metadata for PPTX & Notebook */}
            {(isPptxService || isNotebookService) && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="ai-author" className="block text-xs font-medium text-slate-700">
                    {isNotebookService ? "O'quvchi / Talaba F.I.O." : 'Tayyorladi'}
                  </label>
                  <input
                    id="ai-author"
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Masalan: Sardor Tuyg'inov"
                    className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-group" className="block text-xs font-medium text-slate-700">
                    {isNotebookService ? 'Sinf / Guruh' : 'Guruh / Kurs'}
                  </label>
                  <input
                    id="ai-group"
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Masalan: 123-guruh"
                    className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="ai-inst" className="block text-xs font-medium text-slate-700">
                    Ta'lim muassasasi
                  </label>
                  <input
                    id="ai-inst"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Masalan: SamDU / Pedagogika instituti"
                    className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                </div>
              </>
            )}

            {isNotebookService && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="ai-teacher" className="block text-xs font-medium text-slate-700">
                    O'qituvchi / Rahbar
                  </label>
                  <input
                    id="ai-teacher"
                    type="text"
                    value={teacher}
                    onChange={(e) => setTeacher(e.target.value)}
                    placeholder="Masalan: O'qituvchi izohi bo'yicha"
                    className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5 col-span-1">
                    <label htmlFor="ai-nbnum" className="block text-xs font-medium text-slate-700">
                      Daftar №
                    </label>
                    <input
                      id="ai-nbnum"
                      type="text"
                      value={notebookNumber}
                      onChange={(e) => setNotebookNumber(e.target.value)}
                      className="w-full text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3 py-2.5 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label htmlFor="ai-city" className="block text-xs font-medium text-slate-700">
                      Shahar
                    </label>
                    <input
                      id="ai-city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Samarqand"
                      className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3 py-2.5 outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-1">
                    <label htmlFor="ai-year" className="block text-xs font-medium text-slate-700">
                      O'quv yili
                    </label>
                    <input
                      id="ai-year"
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3 py-2.5 outline-none transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <label htmlFor="ai-details" className="block text-xs font-medium text-slate-700">
                Qo'shimcha topshiriq yoki asosiy bandlar (ixtiyoriy)
              </label>
              <textarea
                id="ai-details"
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Reja bandlari, masala shartlari yoki kerakli faktlarni yozishingiz mumkin..."
                className="w-full text-sm text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors resize-none"
              />
            </div>
          </div>

          {/* Pipeline Progress Indicator */}
          {isGenerating && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                <span>{splitStatusText || 'Tayyorlash jarayoni ketmoqda...'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {[
                  { step: 1, label: splitStatusText ? '1. 1/2-qism yaratish' : '1. Mavzu tahlili' },
                  { step: 2, label: splitStatusText ? '2. 2/2-qism davomi' : '2. Tuzilma va kontent' },
                  { step: 3, label: '3. Dizayn va sahifalash' },
                ].map((item) => {
                  const done = pipelineStep > item.step;
                  const active = pipelineStep === item.step;
                  return (
                    <div
                      key={item.step}
                      className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <span className="text-xs text-zinc-500">
              Yaratilgan loyiha SlaydCanva muhitida ochiladi va barcha matnlarni tahrirlashingiz mumkin.
            </span>

            <button
              type="submit"
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shrink-0"
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
