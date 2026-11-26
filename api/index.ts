import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  AppPricingSettings,
  DEFAULT_PRICING_SETTINGS,
  DbBroadcastLog,
  DbCrmEvent,
  DbManagerPermission,
  DbManagerRecord,
  DbPromoCode,
  dbAdminAdjustBalance,
  dbAppendAuditLog,
  dbAppendCrmEvent,
  dbApplyReferralBonus,
  dbChargeAiService,
  dbClaimAdminPasswordIfUnset,
  dbCreditTolovgoOrder,
  dbDeleteManager,
  dbDeletePromoCode,
  dbDeleteProject,
  dbGetAdminAnalytics,
  dbGetAdminOverview,
  dbGetAuthNonce,
  dbGetDbStatus,
  dbGetManagerById,
  dbGetOrCreateUser,
  dbGetPaymentOrder,
  dbGetProjectById,
  dbGetSetting,
  dbGetUserDetailAdmin,
  dbListAuditLogs,
  dbListBroadcastLogs,
  dbListBroadcastTargets,
  dbListCrmEvents,
  dbListManagers,
  dbListOrdersAdmin,
  dbListProjects,
  dbListPromoCodes,
  dbListUsersAdmin,
  dbLogActivity,
  dbLogBroadcast,
  dbMarkCrmEventsRead,
  dbRedeemPromoCode,
  dbRefundAiCharge,
  dbSaveAuthNonce,
  dbSaveProject,
  dbSetSetting,
  dbSetUserBanned,
  dbUpdateUserCrm,
  dbUpdateUserPreferences,
  dbUpdateUserProfile,
  dbUpsertManager,
  dbUpsertPaymentOrder,
  dbUpsertPromoCode,
  isNeonConfigured,
} from '../lib/db.ts';

type AiServiceId =
  | 'academic_wave_pptx'
  | 'white_card_pptx'
  | 'stitched_notebook_pdf'
  | 'five_block_infographic'
  | 'ai_canvas_design';

interface PreviousSlideSummary {
  tag?: string;
  title?: string;
}

interface GeneratePreviousContext {
  deckTitle?: string;
  deckSubtitle?: string;
  institution?: string;
  direction?: string;
  footerTopic?: string;
  planItems?: Array<{ tag?: string; title?: string }>;
  previousSlides?: PreviousSlideSummary[];
}

interface GenerateRequestBody {
  serviceId: AiServiceId;
  topic: string;
  details?: string;
  slideCount?: number;
  institution?: string;
  authorName?: string;
  groupName?: string;
  subject?: string;
  teacher?: string;
  city?: string;
  notebookNumber?: string;
  academicYear?: string;
  taskCount?: number;
  designTheme?: 'academic_gold' | 'crimson_dark' | 'clean_white' | 'emerald_green';
  includeTopicImages?: boolean;
  splitMode?: 'single' | 'part1' | 'part2';
  part1Count?: number;
  part2Count?: number;
  skipPhotoFetch?: boolean;
  pendingPhotoSlots?: number;
  previousContext?: GeneratePreviousContext;
}

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

class ProviderHttpError extends Error {
  status: number;
  provider: 'openrouter' | 'gemini';
  constructor(provider: 'openrouter' | 'gemini', status: number, message: string) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJsonResponse(text: string | undefined): unknown {
  const cleaned = (text || '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI_INVALID_JSON');
  }
}

function extractOpenRouterContent(payload: unknown): string {
  const data = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return '';
}

const COMPACT_SCHEMA_GUIDES: Record<string, string> = {
  slaydcanva_deck:
    '{"deckTitle":"...","deckSubtitle":"...","institution":"...","direction":"...","footerTopic":"...","topicImageQueries":["english concrete visual query 1","english concrete visual query 2"],"planItems":[{"tag":"01","title":"..."}],"slides":[{"tag":"01-BO\'LIM","title":"...","subtitle":"","imageKeyword":"english concrete photo query","layout":"split_image_right|split_image_left|three_columns|timeline|table|grid_2x2|steps|case_analysis|schedule|highlight_note","blocks":[{"heading":"...","body":"...","badge":""}],"tableHeaders":[],"tableRows":[],"footerCallout":""}],"references":["..."]}',
  slaydcanva_deck_part2:
    '{"slides":[{"tag":"10-BO\'LIM","title":"...","subtitle":"","imageKeyword":"english concrete photo query","layout":"three_columns|timeline|table|grid_2x2|steps|case_analysis|schedule|highlight_note|split_image_right|split_image_left","blocks":[{"heading":"...","body":"...","badge":""}],"tableHeaders":[],"tableRows":[],"footerCallout":""}],"references":["..."]}',
  slaydcanva_notebook:
    '{"coverTitle":"...","coverSubtitle":"...","sectionTitle":"...","tasks":[{"sectionLabel":"A. Asosiy qism","title":"...","lines":["qator 1","qator 2"]}]}',
  slaydcanva_infographic:
    '{"mainTitle":"...","subTitle":"...","iconTheme":"science|medicine|education|tech|business","blocks":[{"number":1,"title":"...","bullets":[{"lead":"...","text":"..."}],"calloutLabels":["..."]}]}',
  slaydcanva_canvas_design:
    '{"deckTitle":"...","topicImageQueries":["english photo query 1","english photo query 2"],"slides":[{"title":"...","background":"#FFFFFF","primaryColor":"#1D4ED8","accentColor":"#DC2626","svgArtwork":"<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"960\\" height=\\"540\\" viewBox=\\"0 0 960 540\\">...</svg>","photoSlot":{"enabled":true,"x":550,"y":110,"width":356,"height":268,"borderRadius":16},"elements":[{"type":"rect|circle|text","x":56,"y":64,"width":450,"height":72,"text":"...","fontSize":32,"fontWeight":"bold","textAlign":"left","color":"#0F172A","fill":"#F8FAFC","stroke":"transparent","borderRadius":12,"shadow":true}]}]}',
};

async function readSseContent(
  response: Response,
  onFirstContent: () => void
): Promise<string> {
  if (!response.body) {
    return '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let content = '';
  let sawContent = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line.startsWith('data:')) {
        const dataStr = line.slice(5).trim();
        if (dataStr === '[DONE]') {
          return content;
        }
        if (dataStr) {
          try {
            const chunk = JSON.parse(dataStr) as {
              error?: { code?: number; message?: string };
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
            };
            if (chunk.error) {
              throw new ProviderHttpError(
                'openrouter',
                typeof chunk.error.code === 'number' ? chunk.error.code : 502,
                chunk.error.message || 'OpenRouter stream error'
              );
            }
            const deltaText =
              chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content;
            if (typeof deltaText === 'string' && deltaText.length > 0) {
              if (!sawContent) {
                sawContent = true;
                onFirstContent();
              }
              content += deltaText;
            }
          } catch (e) {
            if (e instanceof ProviderHttpError) throw e;
          }
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  }
  return content;
}

async function callOpenRouterOnce(
  apiKey: string,
  body: Record<string, unknown>,
  totalTimeoutMs: number,
  firstTokenTimeoutMs = 10_000
): Promise<unknown> {
  const controller = new AbortController();
  const totalTimer = setTimeout(() => controller.abort(), totalTimeoutMs);
  let firstTokenTimer: ReturnType<typeof setTimeout> | null = setTimeout(
    () => controller.abort(),
    firstTokenTimeoutMs
  );
  const startedAt = Date.now();
  let stage = 'connecting';

  const clearFirstTokenTimer = () => {
    if (firstTokenTimer) {
      clearTimeout(firstTokenTimer);
      firstTokenTimer = null;
    }
  };

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://slaydcanva.app',
        'X-OpenRouter-Title': 'SlaydCanva',
        'X-Title': 'SlaydCanva',
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    stage = `headers_${response.status}_${Date.now() - startedAt}ms_${contentType.split(';')[0]}`;

    if (!response.ok) {
      clearFirstTokenTimer();
      const rawText = await response.text();
      let parsedBody: Record<string, unknown> = {};
      try {
        parsedBody = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        parsedBody = {};
      }
      const errObj = parsedBody.error as { message?: string } | undefined;
      const message = errObj?.message || rawText.slice(0, 200) || `HTTP ${response.status}`;
      throw new ProviderHttpError('openrouter', response.status, message);
    }

    let content = '';
    if (contentType.includes('text/event-stream')) {
      stage = `streaming_${Date.now() - startedAt}ms`;
      content = await readSseContent(response, clearFirstTokenTimer);
    } else {
      clearFirstTokenTimer();
      const rawText = await response.text();
      const parsedBody = JSON.parse(rawText) as Record<string, unknown>;
      content = extractOpenRouterContent(parsedBody);
    }

    if (!content.trim()) {
      throw new ProviderHttpError('openrouter', 502, 'Empty response content from OpenRouter');
    }

    return parseJsonResponse(content);
  } catch (err) {
    if (err instanceof ProviderHttpError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' ||
        err.name === 'AbortError' ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('aborted'))
    ) {
      throw new ProviderHttpError('openrouter', 504, `OpenRouter timeout at ${stage}`);
    }
    throw err;
  } finally {
    clearFirstTokenTimer();
    clearTimeout(totalTimer);
  }
}

async function generateViaOpenRouter(
  apiKey: string,
  params: {
    schemaName: string;
    prompt: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
    trace?: string[];
  }
): Promise<unknown> {
  const customModel = process.env.OPENROUTER_MODEL?.trim();
  const compactGuide = COMPACT_SCHEMA_GUIDES[params.schemaName] || '{}';

  const jsonPromptMessages = [
    {
      role: 'system',
      content: `${params.systemInstruction} Faqat yaroqli JSON obyekt qaytar (izohsiz va markdown belgilarsiz).`,
    },
    {
      role: 'user',
      content: `${params.prompt}\n\nJSON namunasi (barcha maydonlarni to'ldir):\n${compactGuide}`,
    },
  ];

  const primaryModels = customModel
    ? [customModel, 'openai/gpt-4o-mini', 'openrouter/free']
    : ['openai/gpt-4o-mini', 'google/gemini-2.5-flash-lite', 'openrouter/free'];

  const t1 = Date.now();
  try {
    const out = await callOpenRouterOnce(
      apiKey,
      {
        model: primaryModels[0],
        models: primaryModels,
        messages: jsonPromptMessages,
        temperature: 0.4,
        max_tokens: 4500,
        provider: { sort: 'throughput' },
        response_format: { type: 'json_object' },
      },
      26_000,
      12_000
    );
    params.trace?.push(`or1:ok:${Date.now() - t1}ms`);
    return out;
  } catch (err1) {
    const m1 = err1 instanceof Error ? err1.message.slice(0, 60) : String(err1);
    params.trace?.push(`or1:err(${m1}):${Date.now() - t1}ms`);
    if (err1 instanceof ProviderHttpError && err1.status === 401) {
      throw err1;
    }
  }

  const t2 = Date.now();
  try {
    const out = await callOpenRouterOnce(
      apiKey,
      {
        model: 'openrouter/free',
        messages: jsonPromptMessages,
        temperature: 0.4,
        max_tokens: 4500,
        provider: { sort: 'throughput' },
      },
      30_000,
      18_000
    );
    params.trace?.push(`or2:ok:${Date.now() - t2}ms`);
    return out;
  } catch (e) {
    const m2 = e instanceof Error ? e.message.slice(0, 60) : String(e);
    params.trace?.push(`or2:err(${m2}):${Date.now() - t2}ms`);
    throw e;
  }
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('INTERNAL')
  );
}

async function generateViaGemini(
  ai: GoogleGenAI,
  params: {
    prompt: string;
    systemInstruction: string;
    responseSchema: Record<string, unknown>;
    trace?: string[];
  }
): Promise<unknown> {
  const attempts: Array<{ model: string; delayMs: number }> = [
    { model: 'gemini-4-hydrogen', delayMs: 0 },
    { model: 'gemini-3.1-flash-lite', delayMs: 500 },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      await new Promise((r) => setTimeout(r, attempt.delayMs));
    }
    const tg = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: params.prompt,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      params.trace?.push(`gem(${attempt.model}):ok:${Date.now() - tg}ms`);
      return parseJsonResponse(response.text);
    } catch (err) {
      lastErr = err;
      params.trace?.push(`gem(${attempt.model}):err:${Date.now() - tg}ms`);
      if (!isTransientGeminiError(err)) {
        throw err;
      }
    }
  }
  throw lastErr;
}

async function generateStructuredJson(params: {
  schemaName: string;
  prompt: string;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  trace?: string[];
}): Promise<unknown> {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const geminiClient = getGeminiClient();

  if (openRouterKey) {
    try {
      return await generateViaOpenRouter(openRouterKey, params);
    } catch (openRouterErr) {
      if (openRouterErr instanceof ProviderHttpError && openRouterErr.status >= 400 && openRouterErr.status < 500) {
        throw openRouterErr;
      }
      if (geminiClient) {
        try {
          return await generateViaGemini(geminiClient, params);
        } catch {
          throw openRouterErr;
        }
      }
      throw openRouterErr;
    }
  }

  if (geminiClient) {
    return await generateViaGemini(geminiClient, params);
  }

  throw new Error('AI_API_KEY_MISSING');
}

const SLIDE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    deckTitle: { type: Type.STRING },
    deckSubtitle: { type: Type.STRING },
    institution: { type: Type.STRING },
    direction: { type: Type.STRING },
    footerTopic: { type: Type.STRING },
    topicImageQueries: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 specific English photographic search queries directly about the topic',
    },
    planItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
          title: { type: Type.STRING },
        },
        required: ['tag', 'title'],
      },
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: { type: Type.STRING },
          title: { type: Type.STRING },
          subtitle: { type: Type.STRING },
          imageKeyword: {
            type: Type.STRING,
            description: 'Topic-relevant English keyword for high-res photograph',
          },
          layout: {
            type: Type.STRING,
            description:
              'One of: split_image_right, split_image_left, three_columns, timeline, table, grid_2x2, steps, case_analysis, schedule, highlight_note',
          },
          blocks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                heading: { type: Type.STRING },
                body: { type: Type.STRING },
                badge: { type: Type.STRING },
              },
              required: ['heading', 'body'],
            },
          },
          tableHeaders: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          tableRows: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          footerCallout: { type: Type.STRING },
        },
        required: ['tag', 'title', 'layout', 'blocks'],
      },
    },
    references: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['deckTitle', 'deckSubtitle', 'footerTopic', 'planItems', 'slides', 'references'],
};

const SLIDE_PART2_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slides: SLIDE_RESPONSE_SCHEMA.properties.slides,
    references: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['slides', 'references'],
};

const NOTEBOOK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    coverTitle: { type: Type.STRING },
    coverSubtitle: { type: Type.STRING },
    sectionTitle: { type: Type.STRING },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sectionLabel: { type: Type.STRING },
          title: { type: Type.STRING },
          lines: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['sectionLabel', 'title', 'lines'],
      },
    },
  },
  required: ['coverTitle', 'coverSubtitle', 'sectionTitle', 'tasks'],
};

const INFOGRAPHIC_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    mainTitle: { type: Type.STRING },
    subTitle: { type: Type.STRING },
    iconTheme: {
      type: Type.STRING,
      description: 'One of: science, medicine, education, tech, business',
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          number: { type: Type.INTEGER },
          title: { type: Type.STRING },
          bullets: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                lead: { type: Type.STRING },
                text: { type: Type.STRING },
              },
              required: ['lead', 'text'],
            },
          },
          calloutLabels: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['number', 'title', 'bullets', 'calloutLabels'],
      },
    },
  },
  required: ['mainTitle', 'subTitle', 'iconTheme', 'blocks'],
};

const CANVAS_DESIGN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    deckTitle: { type: Type.STRING },
    topicImageQueries: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 specific English photo search terms matching the topic',
    },
    slides: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          background: { type: Type.STRING },
          primaryColor: { type: Type.STRING },
          accentColor: { type: Type.STRING },
          svgArtwork: {
            type: Type.STRING,
            description:
              'Complete 960x540 SVG illustration/background/diagram scene with gradients and shapes (no body paragraphs inside SVG)',
          },
          photoSlot: {
            type: Type.OBJECT,
            properties: {
              enabled: { type: Type.BOOLEAN },
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
              width: { type: Type.INTEGER },
              height: { type: Type.INTEGER },
              borderRadius: { type: Type.INTEGER },
            },
            required: ['enabled', 'x', 'y', 'width', 'height'],
          },
          elements: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'rect, circle, or text' },
                x: { type: Type.INTEGER },
                y: { type: Type.INTEGER },
                width: { type: Type.INTEGER },
                height: { type: Type.INTEGER },
                text: { type: Type.STRING },
                fontSize: { type: Type.INTEGER },
                fontWeight: { type: Type.STRING },
                textAlign: { type: Type.STRING },
                color: { type: Type.STRING },
                fill: { type: Type.STRING },
                stroke: { type: Type.STRING },
                borderRadius: { type: Type.INTEGER },
                shadow: { type: Type.BOOLEAN },
              },
              required: ['type', 'x', 'y', 'width', 'height'],
            },
          },
        },
        required: ['title', 'background', 'primaryColor', 'accentColor', 'svgArtwork', 'elements'],
      },
    },
  },
  required: ['deckTitle', 'slides'],
};

const WIKIMEDIA_USER_AGENT = 'SlaydCanva/1.0 (https://slaydcanva.app; support@slaydcanva.app)';

const REJECTED_IMAGE_PATTERN =
  /(flag[_-]|_flag|coat[_-]?of[_-]?arms|emblem|seal_of|locator|location[_-]?map|map[_-]?of|diagram|schematic|logo|icon|signature|symbol|blank|placeholder|stub|arrow|button|commons-logo|wikipedia-logo|wikisource|wiktionary|silhouette|crest|badge|stamp|favicon|no_image)/i;

const REJECTED_EXT_PATTERN = /\.(svg|ogg|ogv|webm|tif|tiff|pdf|djvu|mid|midi)(\?|$)/i;

interface PhotoCandidate {
  url: string;
  key: string;
  score: number;
}

function normalizeImageKey(url: string, title = ''): string {
  const cleanTitle = title.replace(/^File:/i, '').trim().toLowerCase();
  if (cleanTitle) return cleanTitle;
  const last = url.split('/').pop() || url;
  return last.replace(/^\d+px-/, '').split('?')[0].toLowerCase();
}

function isSuitablePhotoCandidate(
  url: string,
  title = '',
  width?: number,
  height?: number,
  mime?: string
): boolean {
  if (!url || !url.startsWith('http')) return false;
  const filename = (url.split('/').pop() || '').split('?')[0];
  if (REJECTED_EXT_PATTERN.test(filename) || REJECTED_EXT_PATTERN.test(title)) return false;
  if (REJECTED_IMAGE_PATTERN.test(filename) || REJECTED_IMAGE_PATTERN.test(title)) return false;
  if (mime && !/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) return false;
  if (typeof width === 'number' && typeof height === 'number') {
    if (width < 420 || height < 260) return false;
    const ratio = width / Math.max(1, height);
    if (ratio < 0.55 || ratio > 2.6) return false;
  }
  return true;
}

function scorePhotoCandidate(width = 800, height = 600, sourceBonus = 0): number {
  const ratio = width / Math.max(1, height);
  const landscapeBonus = ratio >= 1.05 && ratio <= 2.1 ? 35 : ratio >= 0.8 ? 15 : 0;
  const resBonus = Math.min(30, Math.round(Math.min(width, 1600) / 50));
  return sourceBonus + landscapeBonus + resBonus;
}

async function fetchImageAsDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': WIKIMEDIA_USER_AGENT,
        Accept: 'image/jpeg,image/png,image/webp,image/*;q=0.8',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ct.startsWith('image/') || ct.includes('svg')) return null;
    const arr = await res.arrayBuffer();
    if (arr.byteLength < 4000 || arr.byteLength > 2_500_000) return null;
    const b64 = Buffer.from(arr).toString('base64');
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function translateTopicToEnglishQueries(topic: string): Promise<string[]> {
  try {
    const out = (await generateStructuredJson({
      schemaName: 'topic_queries',
      prompt: `Mavzu: "${topic}". Ushbu mavzu uchun Wikipedia va Wikimedia Commons'dan haqiqiy, chiroyli mavzuga mos fotosuratlar topish uchun ingliz tilida 3 ta aniq qidiruv iborasini JSON {"queries":["...","...","..."]} shaklida yoz.`,
      systemInstruction: 'Return only valid JSON: {"queries":["..."]}. Use concrete photographic English nouns.',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          queries: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['queries'],
      },
    })) as { queries?: string[] };
    return Array.isArray(out?.queries)
      ? out.queries.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

async function searchRealTopicImages(
  topic: string,
  keywords: string[] = [],
  limit = 3
): Promise<string[]> {
  const targetCount = Math.min(3, Math.max(1, limit));
  const cleanKeywords = keywords.map((k) => k.trim()).filter(Boolean);
  const queries = Array.from(new Set([...cleanKeywords, topic.trim()].filter(Boolean))).slice(0, 4);

  const candidates: PhotoCandidate[] = [];
  const seenKeys = new Set<string>();

  const pushCandidate = (
    url: string | undefined,
    title: string,
    width: number | undefined,
    height: number | undefined,
    mime: string | undefined,
    sourceBonus: number
  ) => {
    if (!url || !isSuitablePhotoCandidate(url, title, width, height, mime)) return;
    const key = normalizeImageKey(url, title);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    candidates.push({
      url,
      key,
      score: scorePhotoCandidate(width, height, sourceBonus),
    });
  };

  const fetchEnWiki = async (q: string) => {
    try {
      const enUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=1000&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=5`;
      const enRes = await fetch(enUrl, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } });
      if (!enRes.ok) return;
      const text = await enRes.text();
      if (!text.trim().startsWith('{')) return;
      const enData = JSON.parse(text) as {
        query?: {
          pages?: Record<
            string,
            { title?: string; index?: number; thumbnail?: { source?: string; width?: number; height?: number } }
          >;
        };
      };
      const pages = Object.values(enData?.query?.pages || {}).sort(
        (a, b) => (a.index ?? 99) - (b.index ?? 99)
      );
      for (const p of pages) {
        pushCandidate(
          p.thumbnail?.source,
          p.title || '',
          p.thumbnail?.width,
          p.thumbnail?.height,
          undefined,
          44 - (p.index ?? 0) * 3
        );
      }
    } catch {}
  };

  const fetchCommons = async (q: string) => {
    try {
      const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&gsrlimit=6&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1000`;
      const cRes = await fetch(commonsUrl, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } });
      if (!cRes.ok) return;
      const text = await cRes.text();
      if (!text.trim().startsWith('{')) return;
      const cData = JSON.parse(text) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              index?: number;
              imageinfo?: Array<{
                url?: string;
                thumburl?: string;
                mime?: string;
                width?: number;
                height?: number;
                thumbwidth?: number;
                thumbheight?: number;
              }>;
            }
          >;
        };
      };
      const pages = Object.values(cData?.query?.pages || {}).sort(
        (a, b) => (a.index ?? 99) - (b.index ?? 99)
      );
      for (const p of pages) {
        const info = p.imageinfo?.[0];
        if (!info) continue;
        const imgUrl = info.thumburl || info.url;
        const w = info.thumbwidth || info.width;
        const h = info.thumbheight || info.height;
        pushCandidate(imgUrl, p.title || '', w, h, info.mime, 32 - (p.index ?? 0) * 2);
      }
    } catch {}
  };

  const fetchUzWiki = async (q: string) => {
    try {
      const uzUrl = `https://uz.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=1000&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=4`;
      const uzRes = await fetch(uzUrl, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } });
      if (!uzRes.ok) return;
      const text = await uzRes.text();
      if (!text.trim().startsWith('{')) return;
      const uzData = JSON.parse(text) as {
        query?: {
          pages?: Record<
            string,
            { title?: string; index?: number; thumbnail?: { source?: string; width?: number; height?: number } }
          >;
        };
      };
      const pages = Object.values(uzData?.query?.pages || {}).sort(
        (a, b) => (a.index ?? 99) - (b.index ?? 99)
      );
      for (const p of pages) {
        pushCandidate(
          p.thumbnail?.source,
          p.title || '',
          p.thumbnail?.width,
          p.thumbnail?.height,
          undefined,
          36 - (p.index ?? 0) * 3
        );
      }
    } catch {}
  };

  const fetchOpenverse = async (q: string) => {
    try {
      const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=6`;
      const ovRes = await fetch(ovUrl, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } });
      if (!ovRes.ok) return;
      const ovData = (await ovRes.json()) as {
        results?: Array<{
          url?: string;
          thumbnail?: string;
          title?: string;
          width?: number;
          height?: number;
          filetype?: string;
        }>;
      };
      const items = ovData?.results || [];
      items.forEach((item, idx) => {
        const mime = item.filetype ? `image/${item.filetype}` : undefined;
        pushCandidate(
          item.thumbnail || item.url,
          item.title || '',
          item.width,
          item.height,
          mime,
          26 - idx * 2
        );
      });
    } catch {}
  };

  for (let i = 0; i < queries.length && candidates.length < targetCount * 3; i++) {
    const q = queries[i];
    if (i === 0) {
      await Promise.allSettled([fetchEnWiki(q), fetchCommons(q), fetchOpenverse(q)]);
    } else {
      await new Promise((r) => setTimeout(r, 150));
      await Promise.allSettled([fetchEnWiki(q), fetchUzWiki(q)]);
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selectedDataUris: string[] = [];
  for (let i = 0; i < Math.min(candidates.length, 9) && selectedDataUris.length < targetCount; i += 3) {
    const batch = candidates.slice(i, i + 3);
    const results = await Promise.all(batch.map((c) => fetchImageAsDataUri(c.url)));
    for (const uri of results) {
      if (uri && selectedDataUris.length < targetCount) {
        selectedDataUris.push(uri);
      }
    }
  }

  return selectedDataUris;
}

function pickContentImageSlots(slides: Array<Record<string, unknown>>, photoSlotsCount: number): number[] {
  if (photoSlotsCount <= 0 || slides.length === 0) return [];
  const preferredOrder = ['split_image_right', 'split_image_left', 'highlight_note', 'three_columns'];
  const picked: number[] = [];

  for (const layoutType of preferredOrder) {
    for (let i = 0; i < slides.length && picked.length < photoSlotsCount; i++) {
      if (slides[i]?.layout === layoutType && !picked.includes(i)) {
        if (picked.length === 1 && slides.length >= 3 && Math.abs(i - picked[0]) < 2) {
          continue;
        }
        picked.push(i);
      }
    }
  }

  for (let i = 0; i < slides.length && picked.length < photoSlotsCount; i++) {
    if (!picked.includes(i) && slides[i]?.layout !== 'table') {
      picked.push(i);
    }
  }

  return picked.slice(0, photoSlotsCount);
}

function isValidHex(color: unknown, fallback: string): string {
  if (typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color.trim())) {
    return color.trim().toUpperCase();
  }
  return fallback;
}

function buildFallbackCanvasSvg(bg: string, primary: string, accent: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="aiBgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="aiWaveGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.16"/>
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#aiBgGrad)"/>
  <circle cx="840" cy="90" r="160" fill="${primary}" fill-opacity="0.12"/>
  <circle cx="110" cy="480" r="140" fill="${accent}" fill-opacity="0.1"/>
  <path d="M0 430 C 220 390, 420 490, 960 410 L 960 540 L 0 540 Z" fill="url(#aiWaveGrad)"/>
  <rect x="36" y="36" width="888" height="468" rx="18" fill="none" stroke="${primary}" stroke-opacity="0.18" stroke-width="1.5"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function sanitizeCanvasSvg(rawSvg: unknown, bg: string, primary: string, accent: string): string {
  if (typeof rawSvg !== 'string' || !rawSvg.trim()) {
    return buildFallbackCanvasSvg(bg, primary, accent);
  }
  let svg = rawSvg.trim();
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start === -1 || end === -1 || end <= start) {
    return buildFallbackCanvasSvg(bg, primary, accent);
  }
  svg = svg.slice(start, end + 6);

  svg = svg
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|animate|set)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|animate|set)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript:|https?:|data:text)[^"]*"|'\s*(?:javascript:|https?:|data:text)[^']*')/gi, '')
    .replace(/url\(\s*['"]?https?:[^)]+\)/gi, 'none');

  svg = svg.replace(/^<svg\b[^>]*>/i, (openTag) => {
    const hasXmlns = /xmlns=/.test(openTag);
    let next = openTag;
    if (!hasXmlns) {
      next = next.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/viewBox=/i.test(next)) {
      next = next.replace('<svg', '<svg viewBox="0 0 960 540"');
    }
    if (!/width=/i.test(next)) {
      next = next.replace('<svg', '<svg width="960"');
    }
    if (!/height=/i.test(next)) {
      next = next.replace('<svg', '<svg height="540"');
    }
    return next;
  });

  if (!/<(path|circle|rect|ellipse|polygon|polyline|line)\b/i.test(svg)) {
    return buildFallbackCanvasSvg(bg, primary, accent);
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function makeElementId(prefix: string, idx: number): string {
  return `${prefix}_${Date.now().toString(36)}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
}

function coercePlainText(val: unknown, fallback = ''): string {
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

function normalizeReferenceList(refs: unknown): string[] {
  if (!Array.isArray(refs)) return [];
  return refs.map((r) => coercePlainText(r).trim()).filter(Boolean);
}

function sanitizeSlideItems(slides: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return slides.map((s, idx) => ({
    ...s,
    tag: coercePlainText(s.tag, `${String(idx + 1).padStart(2, '0')}-BO'LIM`),
    title: coercePlainText(s.title, `Bo'lim ${idx + 1}`),
    subtitle: s.subtitle ? coercePlainText(s.subtitle) : '',
    footerCallout: s.footerCallout ? coercePlainText(s.footerCallout) : '',
    blocks: Array.isArray(s.blocks)
      ? (s.blocks as Array<Record<string, unknown>>).map((b) => ({
          heading: coercePlainText(b?.heading),
          body: coercePlainText(b?.body),
          badge: b?.badge ? coercePlainText(b.badge) : '',
        }))
      : [],
    tableHeaders: Array.isArray(s.tableHeaders)
      ? s.tableHeaders.map((h) => coercePlainText(h))
      : [],
    tableRows: Array.isArray(s.tableRows)
      ? s.tableRows.map((row) =>
          Array.isArray(row) ? row.map((cell) => coercePlainText(cell)) : []
        )
      : [],
  }));
}

function normalizeAiCanvasPages(
  rawData: Record<string, unknown>,
  realPhotos: string[],
  includePhotos: boolean,
  pendingPhotoSlots = 0
): Array<{
  id: string;
  title: string;
  background: string;
  backgroundImage: string;
  elements: Array<Record<string, unknown>>;
}> {
  const rawSlides = Array.isArray(rawData.slides)
    ? (rawData.slides as Array<Record<string, unknown>>)
    : [];

  let photoCursor = 0;
  let pendingCursor = 0;

  return rawSlides.slice(0, 20).map((slide, sIdx) => {
    const bg = isValidHex(slide.background, '#FFFFFF');
    const primary = isValidHex(slide.primaryColor, '#1D4ED8');
    const accent = isValidHex(slide.accentColor, '#DC2626');
    const backgroundImage = sanitizeCanvasSvg(slide.svgArtwork, bg, primary, accent);

    const rawElements = Array.isArray(slide.elements)
      ? (slide.elements as Array<Record<string, unknown>>)
      : [];

    const normalizedElements: Array<Record<string, unknown>> = [];

    rawElements.slice(0, 28).forEach((el, eIdx) => {
      const elType = el.type === 'rect' || el.type === 'circle' || el.type === 'text' ? el.type : null;
      if (!elType) return;

      const x = Math.max(0, Math.min(920, Math.round(Number(el.x) || 0)));
      const y = Math.max(0, Math.min(500, Math.round(Number(el.y) || 0)));
      const width = Math.max(12, Math.min(960 - x, Math.round(Number(el.width) || 180)));
      const height = Math.max(10, Math.min(540 - y, Math.round(Number(el.height) || 40)));

      if (elType === 'text') {
        const txt = typeof el.text === 'string' ? el.text.trim() : '';
        if (!txt) return;
        const fontSize = Math.max(11, Math.min(46, Math.round(Number(el.fontSize) || 16)));
        normalizedElements.push({
          id: makeElementId('ai_txt', sIdx * 100 + eIdx),
          type: 'text',
          x,
          y,
          width,
          height,
          text: txt,
          fontFamily: fontSize >= 24 ? 'Plus Jakarta Sans, sans-serif' : 'DM Sans, sans-serif',
          fontSize,
          fontWeight: el.fontWeight === 'bold' ? 'bold' : 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          textAlign:
            el.textAlign === 'center' || el.textAlign === 'right' ? el.textAlign : 'left',
          color: isValidHex(el.color, '#0F172A'),
          lineHeight: 1.3,
        });
      } else {
        normalizedElements.push({
          id: makeElementId(`ai_${elType}`, sIdx * 100 + eIdx),
          type: elType,
          x,
          y,
          width,
          height,
          fill: el.fill === 'transparent' ? 'transparent' : isValidHex(el.fill, '#F8FAFC'),
          stroke: el.stroke === 'transparent' ? 'transparent' : isValidHex(el.stroke, 'transparent'),
          strokeWidth: el.stroke && el.stroke !== 'transparent' ? 1 : 0,
          borderRadius: elType === 'rect' ? Math.max(0, Math.min(32, Math.round(Number(el.borderRadius) || 10))) : 0,
          shadow: Boolean(el.shadow),
        });
      }
    });

    const slot = slide.photoSlot as Record<string, unknown> | undefined;
    let photoSrc: string | null = null;
    if (includePhotos && slot && slot.enabled !== false) {
      if (photoCursor < realPhotos.length) {
        photoSrc = realPhotos[photoCursor++];
      } else if (pendingCursor < pendingPhotoSlots) {
        photoSrc = `__PENDING_PHOTO_${pendingCursor++}__`;
      }
    }

    if (photoSrc) {
      const px = Math.max(24, Math.min(680, Math.round(Number(slot?.x) || 548)));
      const py = Math.max(48, Math.min(360, Math.round(Number(slot?.y) || 112)));
      const pw = Math.max(180, Math.min(936 - px, Math.round(Number(slot?.width) || 364)));
      const ph = Math.max(140, Math.min(504 - py, Math.round(Number(slot?.height) || 268)));
      const pr = Math.max(8, Math.min(28, Math.round(Number(slot?.borderRadius) || 16)));

      normalizedElements.push(
        {
          id: makeElementId('ai_frame', sIdx),
          type: 'rect',
          x: Math.max(0, px - 6),
          y: Math.max(0, py - 6),
          width: Math.min(960, pw + 12),
          height: Math.min(540, ph + 12),
          fill: '#FFFFFF',
          stroke: '#E2E8F0',
          strokeWidth: 1,
          borderRadius: pr + 4,
          shadow: true,
        },
        {
          id: makeElementId('ai_img', sIdx),
          type: 'image',
          x: px,
          y: py,
          width: pw,
          height: ph,
          src: photoSrc,
          imageFit: 'cover',
          borderRadius: pr,
          shadow: true,
        }
      );
    }

    return {
      id: makeElementId('ai_canvas', sIdx),
      title: typeof slide.title === 'string' && slide.title.trim() ? slide.title.trim() : `Dizayn ${sIdx + 1}`,
      background: bg,
      backgroundImage,
      elements: normalizedElements,
    };
  });
}

// =========================================================================
// TolovGo (tolovgo.uz) UZS Payment Gateway Helpers
// =========================================================================
const TOLOVGO_DEFAULT_BASE = 'https://pay.tolovgo.uz/api';
type TolovgoOrderStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';

interface TolovgoOrderRecord {
  orderId: string;
  amount: number;
  payUrl: string;
  status: TolovgoOrderStatus;
  isTest: boolean;
  credited: boolean;
  createdAt: number;
  telegramId?: string;
  chatId?: string;
  method?: string;
}

const tolovgoOrders = new Map<string, TolovgoOrderRecord>();

function getCleanEnvKey(value: string | undefined, placeholder: string): string | null {
  const raw = value?.trim();
  if (!raw || raw === placeholder) return null;
  return raw;
}

function resolveTolovgoCredential(requestedMode?: 'live' | 'test'): {
  apiKey: string;
  isTest: boolean;
  hasLiveKey: boolean;
  hasTestKey: boolean;
} | null {
  const liveKey =
    getCleanEnvKey(process.env.TOLOVGO_API_KEY, 'MY_TOLOVGO_API_KEY') ||
    getCleanEnvKey(process.env.TOLOVGO_KEY, 'MY_TOLOVGO_API_KEY');
  const testKey = getCleanEnvKey(process.env.TOLOVGO_TEST_API, 'MY_TOLOVGO_TEST_API');
  const envMode = process.env.TOLOVGO_MODE?.trim().toLowerCase();
  const effectiveMode =
    requestedMode === 'test' || requestedMode === 'live'
      ? requestedMode
      : envMode === 'test' || envMode === 'live'
        ? envMode
        : undefined;

  const hasLiveKey = Boolean(liveKey);
  const hasTestKey = Boolean(testKey);

  if (effectiveMode === 'test') {
    if (testKey) return { apiKey: testKey, isTest: true, hasLiveKey, hasTestKey };
    if (liveKey && liveKey.startsWith('test_')) {
      return { apiKey: liveKey, isTest: true, hasLiveKey, hasTestKey };
    }
    return null;
  }

  if (effectiveMode === 'live') {
    if (liveKey) {
      return {
        apiKey: liveKey,
        isTest: liveKey.startsWith('test_'),
        hasLiveKey,
        hasTestKey,
      };
    }
    return null;
  }

  if (liveKey) {
    return {
      apiKey: liveKey,
      isTest: liveKey.startsWith('test_'),
      hasLiveKey,
      hasTestKey,
    };
  }

  if (testKey) {
    return { apiKey: testKey, isTest: true, hasLiveKey, hasTestKey };
  }

  return null;
}

function getTolovgoBaseUrl(): string {
  const raw = (
    process.env.TOLOVGO_API_BASE ||
    process.env.TOLOVGO_API_URL ||
    process.env.TOLOVGO_URL
  )?.trim();
  if (!raw) return TOLOVGO_DEFAULT_BASE;
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      host !== 'localhost' &&
      host !== '127.0.0.1' &&
      host !== '::1' &&
      !host.startsWith('10.') &&
      !host.startsWith('192.168.') &&
      !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return parsed.toString().replace(/\/+$/, '');
    }
  } catch {
    // Fallback to official endpoint if custom URL is malformed
  }
  return TOLOVGO_DEFAULT_BASE;
}

function validateTolovgoPayUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      (host === 'tolovgo.uz' || host.endsWith('.tolovgo.uz'))
    ) {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function getPublicBaseOrigin(req: express.Request): string | undefined {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && envAppUrl !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envAppUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        return parsed.origin;
      }
    } catch {
      // Ignore invalid APP_URL
    }
  }
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `https://${host}`;
  }
  return undefined;
}

function normalizeTolovgoStatus(raw: unknown): TolovgoOrderStatus {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (s === 'paid' || s === 'expired' || s === 'cancelled' || s === 'refunded') {
    return s;
  }
  return 'pending';
}

function mapTolovgoErrorMessage(status: number, data: Record<string, unknown>, fallback: string): string {
  const code = typeof data.code === 'string' ? data.code : '';
  if (code === 'missing_credentials' || code === 'invalid_credentials' || code === 'key_revoked') {
    return "TolovGo API kaliti noto'g'ri yoki bekor qilingan. Kabinetdagi kalitni tekshiring.";
  }
  if (code === 'ip_not_allowed') {
    return "TolovGo API kalitida IP cheklovi yoqilgan — bu server IP manziliga ruxsat berilmagan.";
  }
  if (code === 'merchant_inactive') {
    return "TolovGo kassangiz hali faol emas (admin tasdig'ini kuting yoki test_ sinov kalitidan foydalaning).";
  }
  if (status === 429) {
    return "TolovGo so'rovlar limiti to'ldi (daqiqasiga 120 so'rov). Birozdan so'ng urinib ko'ring.";
  }
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  return fallback;
}

function pruneOldTolovgoOrders() {
  if (tolovgoOrders.size <= 300) return;
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, rec] of tolovgoOrders.entries()) {
    if (rec.createdAt < cutoff || tolovgoOrders.size > 400) {
      tolovgoOrders.delete(key);
    }
  }
}

async function fetchRemoteTolovgoStatus(
  orderId: string,
  apiKey: string
): Promise<{ status: TolovgoOrderStatus; amount?: number; raw: Record<string, unknown> }> {
  const baseUrl = getTolovgoBaseUrl();
  const res = await fetch(`${baseUrl}/status/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    throw new Error(mapTolovgoErrorMessage(res.status, parsed, `TolovGo HTTP ${res.status}`));
  }

  const nestedOrder = parsed.order as Record<string, unknown> | undefined;
  const status = normalizeTolovgoStatus(parsed.status ?? nestedOrder?.status);
  const rawAmount = parsed.amount ?? nestedOrder?.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);

  return {
    status,
    amount: Number.isFinite(numAmount) && numAmount >= 1000 ? Math.round(numAmount) : undefined,
    raw: parsed,
  };
}

interface RawBodyRequest extends express.Request {
  rawBody?: string;
}

const app = express();
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString('utf8');
    },
  })
);
app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as RawBodyRequest).rawBody = buf.toString('utf8');
    },
  })
);

// Restore original /api/* path when invoked via Vercel rewrite
app.use((req, _res, next) => {
  const vp = req.query.__vercel_path;
  const rawSegments = Array.isArray(vp)
    ? vp.map((s) => String(s))
    : typeof vp === 'string' && vp.length > 0
      ? [vp]
      : [];

  if (rawSegments.length > 0) {
    const cleanPath = rawSegments
      .join('/')
      .replace(/^\/+/, '')
      .replace(/\.\.+/g, '');
    const restParams = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (k === '__vercel_path') continue;
      if (Array.isArray(v)) {
        v.forEach((item) => restParams.append(k, String(item)));
      } else if (v !== undefined) {
        restParams.append(k, String(v));
      }
    }
    const qs = restParams.toString();
    req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
  }
  next();
});

app.get('/api/images/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const count = Math.min(3, Math.max(1, Number(req.query.count) || 3));
  if (!q) {
    res.json({ images: [] });
    return;
  }
  const enQueries = await translateTopicToEnglishQueries(q);
  const images = await searchRealTopicImages(q, enQueries, count);
  res.json({ query: q, queries: enQueries, images });
});

app.post('/api/ai/canvas-draw', async (req, res) => {
  const trace: string[] = [];
  try {
    const tgUser = getAuthenticatedTelegramUser(req);
    if (!tgUser) {
      res.status(401).json({ error: 'Avval Telegram orqali tizimga kiring.' });
      return;
    }
    const body = (req.body || {}) as {
      prompt?: string;
      styleHint?: string;
      includeTopicImages?: boolean;
    };
    const rawPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!rawPrompt) {
      res.status(400).json({ error: "Dizayn uchun mavzu yoki ko'rsatma kiriting." });
      return;
    }
    const userPrompt = rawPrompt.slice(0, 600);
    const styleHint = typeof body.styleHint === 'string' ? body.styleHint.trim().slice(0, 240) : '';
    const includePhotos = body.includeTopicImages !== false;

    const prompt = `
Foydalanuvchi so'rovi: "${userPrompt}"
Uslub ishorasi: "${styleHint || "Zamonaviy tahririy (editorial) dizayn, aniq ierarxiya, chiroyli vektor illyustratsiya"}"
Real mavzu rasmi qo'shilsinmi: ${includePhotos ? "HA (photoSlot ajratilsin)" : "YO'Q (faqat AI vektor illyustratsiya va grafik elementlar)"}

Vazifa: 960x540 o'lchamdagi 16:9 Canvas uchun aynan 1 ta noyob, professional slayd dizaynini O'ZING CHIZ.
Qoidalar:
1. svgArtwork maydonida to'liq 960x540 o'lchamli chiroyli <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">...</svg> vektor kompozitsiya chiz: fon gradientlari, yumshoq geometrik to'lqinlar/shakllar va mavzuga mos maxsus vektor illyustratsiya yoki sxema. (SVG ichiga uzun matn yozma — matnlar elements massivida bo'lsin!).
2. elements massivida o'zbek tilida (lotin yozuvida) tahrirlanadigan UI kartochkalar, badge, sarlavha (fontSize: 28-36), qisqa izoh va 2-4 ta asosiy blok (rect + text) joylashtir. Matnlar bir-birining ustiga chiqmasin!
3. Kontrast mukammal bo'lsin: och fonda to'q matn (#0F172A), to'q fonda oq matn (#FFFFFF).
4. ${includePhotos ? "photoSlot (enabled: true) uchun matn bilan to'qnashmaydigan alohida toza joy (masalan x:556, y:108, width:356, height:268) ajrat va topicImageQueries ga mavzuga aynan mos inglizcha 2-3 ta aniq fotosurat qidiruv so'zini yoz." : "photoSlot.enabled = false qil va bo'sh joyni SVG illyustratsiya bilan to'ldir."}
`;

    const rawData = (await generateStructuredJson({
      schemaName: 'slaydcanva_canvas_design',
      prompt,
      systemInstruction:
        "Siz professional grafik dizayner va SVG illyustratorsiz. 960x540 slayd kanvasiga chiroyli, bir-birini to'smaydigan, kontrastli dizayn chizib JSON qaytaring.",
      responseSchema: CANVAS_DESIGN_SCHEMA,
      trace,
    })) as Record<string, unknown>;

    const aiQueries = Array.isArray(rawData.topicImageQueries)
      ? (rawData.topicImageQueries as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
      : [];
    const realPhotos = includePhotos ? await searchRealTopicImages(userPrompt, aiQueries, 2) : [];

    const pages = normalizeAiCanvasPages(rawData, realPhotos, includePhotos);
    if (!pages.length) {
      res.status(500).json({ error: "AI kanvas dizayni yaratilmadi. Qaytadan urinib ko'ring." });
      return;
    }

    res.setHeader('X-AI-Trace', trace.join(' | '));
    res.json({ page: pages[0], photoCount: realPhotos.length });
  } catch (err) {
    if (trace.length > 0) res.setHeader('X-AI-Trace', trace.join(' | '));
    console.error('[SlaydCanva AI Canvas Draw Error]', err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('AI_API_KEY_MISSING') || msg.includes('GEMINI_API_KEY_MISSING')) {
      res.status(503).json({
        error:
          "AI kaliti sozlanmagan. Settings > Secrets bo'limidan GEMINI_API_KEY yoki OPENROUTER_API_KEY qo'shing.",
      });
      return;
    }
    res.status(500).json({
      error: "AI dizayn chizishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
    });
  }
});

app.post('/api/ai/generate', async (req, res) => {
  const trace: string[] = [];
  let pendingCharge: { tgUser: TgUserProfile; txId: string; price: number } | null = null;
  let chargedBalance: number | undefined;

  const sendAiJson = (payload: Record<string, unknown>) => {
    res.setHeader('X-AI-Trace', trace.join(' | '));
    res.json({
      ...payload,
      chargedPrice: pendingCharge?.price ?? 0,
      newBalance: chargedBalance,
      serverCharged: Boolean(pendingCharge),
    });
  };

  try {
    const body = (req.body || {}) as GenerateRequestBody;
    const rawTopic = typeof body.topic === 'string' ? body.topic.trim() : '';
    if (!rawTopic) {
      res.status(400).json({ error: 'Mavzuni kiriting.' });
      return;
    }
    const topic = rawTopic.slice(0, 300);
    const details = typeof body.details === 'string' ? body.details.trim().slice(0, 1200) : '';
    const institution =
      typeof body.institution === 'string' ? body.institution.trim().slice(0, 160) : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 160) : '';

    const [pricing, siteConfig] = await Promise.all([
      getEffectivePricingSettings(),
      getEffectiveSiteConfig(),
    ]);
    const tgUser = getAuthenticatedTelegramUser(req);
    const staff = tgUser ? await resolveStaffAccess(tgUser.telegramId) : null;

    if (siteConfig.maintenanceMode && !staff?.isStaff) {
      res.status(503).json({
        error:
          siteConfig.maintenanceMessage ||
          "Tizimda vaqtincha texnik ishlar olib borilmoqda. Birozdan so'ng urinib ko'ring.",
      });
      return;
    }

    const serverPrice = calculateServerServicePrice(body, pricing);

    if (serverPrice > 0 && !tgUser) {
      res.status(401).json({
        error: 'Xizmatdan foydalanish uchun avval Telegram orqali tizimga kiring.',
      });
      return;
    }

    if (tgUser && serverPrice > 0) {
      const txId = `ai_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
      const chargeRes = await chargeUserForAi(
        tgUser,
        txId,
        `${body.serviceId}: ${topic.slice(0, 60)}`,
        serverPrice
      );
      if (!chargeRes.ok) {
        if (chargeRes.reason === 'banned') {
          res.status(403).json({ error: 'Hisobingiz administrator tomonidan bloklangan.' });
          return;
        }
        res.status(402).json({
          error: `Balans yetarli emas. Kerak: ${formatSomServer(serverPrice)}, mavjud: ${formatSomServer(chargeRes.balance ?? 0)}.`,
          balance: chargeRes.balance,
          required: serverPrice,
        });
        return;
      }
      pendingCharge = { tgUser, txId, price: serverPrice };
      chargedBalance = chargeRes.balance;
    }

    if (body.serviceId === 'ai_canvas_design') {
      const requestedSlides = Math.min(20, Math.max(1, Number(body.slideCount) || 3));
      const includePhotos = body.includeTopicImages !== false;
      const splitMode = body.splitMode || 'single';

      const runCanvasChunk = async (
        chunkCount: number,
        isPart2: boolean,
        prevSlides: PreviousSlideSummary[],
        deckTitleHint?: string
      ) => {
        const prevSummary = prevSlides
          .map((s, idx) => `${idx + 1}. ${s.title || `Dizayn ${idx + 1}`}`)
          .join('\n');

        const prompt = isPart2
          ? `
Mavzu: "${topic}"
Taqdimot sarlavhasi: "${deckTitleHint || topic}"
Soha: "${subject || "Umumiy / Ta'lim"}"
Qo'shimcha ko'rsatma: "${details || "Mavzuga mos o'ziga xos vektor illyustratsiyali zamonaviy slaydlar chiz"}"
1-QISMDA CHIZILGAN SLAYDLAR (takrorlama!):
${prevSummary}

VAZIFA (2/2-QISM DAVOMI): Yuqoridagi slaydlarning mantiqiy davomi sifatida, ${prevSlides.length + 1}-slayddan boshlab aniq ${chunkCount} ta YANGI, takrorlanmas 960x540 Canvas slayd dizaynini chiz.
Real mavzu rasmlari: ${includePhotos && Number(body.pendingPhotoSlots || 0) > 0 ? `Faqat ${Math.min(2, Number(body.pendingPhotoSlots || 1))} ta slaydda photoSlot.enabled=true qil, qolganlarida photoSlot.enabled=false qil.` : "photoSlot.enabled=false qil, faqat vektor illyustratsiya chiz."}
Qoidalar:
- svgArtwork: har bir slayd uchun to'liq <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">...</svg> vektor grafika.
- elements: sarlavha, badge va 2-4 ta karta (rect + text). Elementlar bir-birining ustiga chiqmasin!
`
          : `
Mavzu: "${topic}"
Soha: "${subject || "Umumiy / Ta'lim"}"
Qo'shimcha ko'rsatma: "${details || "Mavzuga mos o'ziga xos vektor illyustratsiyali zamonaviy slaydlar chiz"}"
Slaydlar soni: Aniq ${chunkCount} ta mustaqil, bir-birini takrorlamaydigan maxsus dizaynlangan slayd.
Real mavzu rasmlari: ${includePhotos ? "Jami 1-3 ta mavzuga aynan mos fotosurat joylashtirish uchun mos slaydlarga (ko'pi bilan 2 ta slaydda) photoSlot.enabled=true ajrat." : "photoSlot.enabled=false qil, faqat vektor illyustratsiya chiz."}

Vazifa: 960x540 Canvas ustida har bir slayd uchun alohida vizual kompozitsiya, maxsus SVG illyustratsiya (svgArtwork) va tahrirlanadigan o'zbek tilidagi elementlar (elements) chiz.
Qoidalar:
- topicImageQueries ga mavzuga aynan tegishli ingliz tilida 3 ta aniq fotosurat qidiruv so'zi yoz.
- svgArtwork: har bir slayd uchun to'liq <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">...</svg> vektor grafika (gradientlar, egri chiziqlar, mavzuviy ikon/diagramma/sahna). SVG ichida uzun matn bo'lmasin.
- elements: har bir slaydda chiroyli sarlavha (fontSize: 26-36, bold), badge/teg va 2-4 ta mazmunli karta (rect + text). Elementlar bir-birining va photoSlot ning ustiga chiqmasin!
`;

        return (await generateStructuredJson({
          schemaName: 'slaydcanva_canvas_design',
          prompt,
          systemInstruction:
            "Siz professional grafik dizayner va SVG illyustratorsiz. 960x540 slayd kanvaslarida chiroyli, kontrastli, bir-birini to'smaydigan dizayn chizib faqat JSON qaytaring.",
          responseSchema: CANVAS_DESIGN_SCHEMA,
          trace,
        })) as Record<string, unknown>;
      };

      if (splitMode === 'part1') {
        const part1Count = Math.min(12, Math.max(1, Number(body.part1Count) || Math.ceil(requestedSlides / 2)));
        const rawData = await runCanvasChunk(part1Count, false, []);
        const aiQueries = Array.isArray(rawData.topicImageQueries)
          ? (rawData.topicImageQueries as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
          : [];
        const realPhotos = includePhotos ? await searchRealTopicImages(topic, aiQueries, 3) : [];
        const part1PhotoBudget = realPhotos.length > 2 ? realPhotos.slice(0, 2) : realPhotos;
        const unusedTopicImages = realPhotos.slice(part1PhotoBudget.length);
        const pages = normalizeAiCanvasPages(rawData, part1PhotoBudget, includePhotos);

        sendAiJson({
          serviceId: body.serviceId,
          splitMode: 'part1',
          data: {
            deckTitle: typeof rawData.deckTitle === 'string' ? rawData.deckTitle : topic,
            pages,
            topicImages: part1PhotoBudget,
            unusedTopicImages,
          },
        });
        return;
      }

      if (splitMode === 'part2') {
        const part2Count = Math.min(12, Math.max(1, Number(body.part2Count) || Math.floor(requestedSlides / 2)));
        const prev = body.previousContext || {};
        const prevSlides = Array.isArray(prev.previousSlides) ? prev.previousSlides : [];
        const rawData = await runCanvasChunk(part2Count, true, prevSlides, prev.deckTitle);
        const pendingSlots = Math.min(2, Math.max(0, Number(body.pendingPhotoSlots) || 0));
        const pages = normalizeAiCanvasPages(rawData, [], includePhotos && pendingSlots > 0, pendingSlots);

        sendAiJson({
          serviceId: body.serviceId,
          splitMode: 'part2',
          data: { pages },
        });
        return;
      }

      if (requestedSlides > 6) {
        const part1Count = Math.ceil(requestedSlides / 2);
        const part2Count = requestedSlides - part1Count;
        const raw1 = await runCanvasChunk(part1Count, false, []);
        const aiQueries = Array.isArray(raw1.topicImageQueries)
          ? (raw1.topicImageQueries as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
          : [];
        const realPhotos = includePhotos ? await searchRealTopicImages(topic, aiQueries, 3) : [];
        const part1Photos = realPhotos.length > 2 ? realPhotos.slice(0, 2) : realPhotos;
        const part2Photos = realPhotos.slice(part1Photos.length);

        const slides1 = Array.isArray(raw1.slides) ? (raw1.slides as Array<Record<string, unknown>>) : [];
        const prevSummary = slides1.map((s) => ({
          title: typeof s.title === 'string' ? s.title : '',
        }));
        const raw2 = await runCanvasChunk(
          part2Count,
          true,
          prevSummary,
          typeof raw1.deckTitle === 'string' ? raw1.deckTitle : topic
        );

        const pages1 = normalizeAiCanvasPages(raw1, part1Photos, includePhotos);
        const pages2 = normalizeAiCanvasPages(raw2, part2Photos, includePhotos && part2Photos.length > 0);
        const pages = [...pages1, ...pages2].slice(0, requestedSlides);

        sendAiJson({
          serviceId: body.serviceId,
          data: {
            deckTitle: typeof raw1.deckTitle === 'string' ? raw1.deckTitle : topic,
            pages,
            topicImages: realPhotos,
          },
        });
        return;
      }

      const rawData = await runCanvasChunk(requestedSlides, false, []);
      const aiQueries = Array.isArray(rawData.topicImageQueries)
        ? (rawData.topicImageQueries as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const realPhotos = includePhotos ? await searchRealTopicImages(topic, aiQueries, 3) : [];
      const pages = normalizeAiCanvasPages(rawData, realPhotos, includePhotos);

      sendAiJson({
        serviceId: body.serviceId,
        data: {
          deckTitle: typeof rawData.deckTitle === 'string' ? rawData.deckTitle : topic,
          pages,
          topicImages: realPhotos,
        },
      });
      return;
    }

    if (body.serviceId === 'academic_wave_pptx' || body.serviceId === 'white_card_pptx') {
      const totalSlides = Math.min(30, Math.max(5, Number(body.slideCount) || 7));
      const totalContentCount = Math.max(2, totalSlides - 3);
      const splitMode = body.splitMode || 'single';

      const applyTopicPhotosToDeck = (
        slidesList: Array<Record<string, unknown>>,
        realPhotos: string[]
      ) => {
        const contentPhotoCount = Math.min(2, Math.max(0, realPhotos.length - 1));
        const selectedSlotIndices = pickContentImageSlots(slidesList, contentPhotoCount);
        return slidesList.map((s, idx) => {
          const slotOrder = selectedSlotIndices.indexOf(idx);
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
          const cleanLayout =
            s.layout === 'split_image_right' || s.layout === 'split_image_left'
              ? 'three_columns'
              : s.layout;
          return {
            ...s,
            layout: cleanLayout,
            imageUrl: undefined,
          };
        });
      };

      const buildPart1Prompt = (chunkCount: number, isSplit: boolean) => `
Mavzu: "${topic}"
Qo'shimcha ko'rsatma: "${details || "To'liq va ilmiy asoslangan taqdimot tayyorla"}"
Muassasa: "${institution || "Oliy ta'lim muassasasi"}"
Yo'nalish: "${subject || "Asosiy fan"}"
${
  isSplit
    ? `Bu ${totalSlides} sahifalik katta taqdimotning 1/2-QISMI. Dastlabki ${chunkCount} ta kontent slaydni yarat (qolgan slaydlar keyingi so'rovda davomidan ulanadi).`
    : `Jami kontent slaydlar soni: Aniq ${chunkCount} ta kontent slayd bo'lishi shart (Titul, Reja va Manbalar slaydlaridan tashqari, jami ${totalSlides} ta slayd hosil qilinsin).`
}

Vazifa: Mavzuni chuqur tahlil qilgan holda, har bir slayd uchun o'ziga xos, bir-birini takrorlamaydigan, real ilmiy dalillar, faktlar va ma'lumotlarga boy o'zbek tilidagi (lotin yozuvida) taqdimot tuzilmasini JSON ko'rinishida yarat.
Qoidalar:
- slides massivida ANIQ ${chunkCount} ta kontent slayd bo'lsin (1-bo'limdan ${chunkCount}-bo'limgacha).
${isSplit ? `- MUHIM: Bu faqat 1/2-qism bo'lgani uchun "Xulosa" yoki "Yakun" slaydini qo'shma — xulosa 2-qism oxirida bo'ladi.` : ''}
- Har bir slayd mazmuni mavzuning aniq qismini yoritsin (takroriy gaplar yozish qat'iyan taqiqlanadi).
- topicImageQueries massiviga aynan ushbu mavzu bo'yicha Wikipedia va Wikimedia Commons'dan real fotosuratlar topish uchun ingliz tilida 3 ta aniq vizual qidiruv iborasini yoz.
- Har bir slayd uchun ushbu slayd mazmuniga aynan mos keladigan inglizcha aniq "imageKeyword" yoz.
- Har bir slaydning layout turi turlicha bo'lsin: "split_image_right", "split_image_left", "three_columns", "timeline", "table", "grid_2x2", "steps", "case_analysis", "schedule", "highlight_note".
- Kamida 1-2 ta kontent slayd "split_image_right" yoki "split_image_left" bo'lsin.
- "table" layoutida albatta tableHeaders (3 ta) va tableRows (kamida 4 ta qator, har qatorda 3 ta katak) to'ldirilsin. Boshqa layoutlarda tableHeaders va tableRows ni bo'sh massiv [] qilib ber.
- "table" layoutidan tashqari BARCHA layoutlarda "blocks" massivi ALBATTA 2-4 ta to'ldirilgan elementdan iborat bo'lsin.
- planItems 4 ta asosiy bo'limdan iborat bo'lsin (butun mavzuni qamrab olsin).
- references ${isSplit ? '1-2 ta boshlang‘ich manba yoki bo‘sh massiv []' : '5 ta haqiqiy ilmiy adabiyot, monografiya va internet manbalaridan (muallif, asar nomi, yil, nashriyot)'} iborat bo'lsin.
`;

      const buildPart2Prompt = (
        part1DoneCount: number,
        part2NeedCount: number,
        prev: GeneratePreviousContext
      ) => {
        const prevSlideLines = (prev.previousSlides || [])
          .map((s, idx) => `${idx + 1}. ${s.tag || `${idx + 1}-BO'LIM`} — ${s.title || ''}`)
          .join('\n');
        const planLines = (prev.planItems || [])
          .map((p, idx) => `${p.tag || `0${idx + 1}`}: ${p.title || ''}`)
          .join(' | ');

        return `
Mavzu: "${topic}"
Taqdimot sarlavhasi: "${prev.deckTitle || topic}"
Umumiy reja bandlari: ${planLines || 'Asosiy ilmiy reja'}
1-QISMDA YARATILGAN SLAYDLAR (bularni TAKRORLAMA!):
${prevSlideLines}

VAZIFA (2/2-QISM DAVOMI):
Yuqoridagi 1-qismning bevosita DAVOMI sifatida, ${part1DoneCount + 1}-bo'limdan ${part1DoneCount + part2NeedCount}-bo'limgacha ANIQ ${part2NeedCount} ta YANGI, chuqur mazmunli va takrorlanmas kontent slayd yarat hamda oxirgi slayd uchun 5 ta haqiqiy ilmiy adabiyot/manba (references) tuz.
Qoidalar:
- slides massivida ANIQ ${part2NeedCount} ta kontent slayd bo'lsin (teg: "${String(part1DoneCount + 1).padStart(2, '0')}-BO'LIM" dan boshlab ketma-ket).
- Faqat oxirgi (${part1DoneCount + part2NeedCount}-bo'lim) slaydni yakuniy xulosa va tavsiyalarga bag'ishla.
- Layoutlarni rang-barang tanla: "split_image_right", "split_image_left", "three_columns", "timeline", "table", "grid_2x2", "steps", "case_analysis", "schedule", "highlight_note".
- Kamida 1-2 ta slayd "split_image_right" yoki "split_image_left" bo'lsin.
- "table" layoutida albatta tableHeaders (3 ta) va tableRows (kamida 4 ta qator, har qatorda 3 ta katak) bo'lsin, boshqalarida [].
- "table" dan tashqari barcha layoutlarda "blocks" 2-4 ta to'ldirilgan banddan iborat bo'lsin.
- references massivida 5 ta haqiqiy ilmiy adabiyot va manba (muallif, asar nomi, yil, nashriyot) yoz.
`;
      };

      if (splitMode === 'part1') {
        const part1Count = Math.min(18, Math.max(2, Number(body.part1Count) || Math.ceil(totalContentCount / 2)));
        const data = (await generateStructuredJson({
          schemaName: 'slaydcanva_deck',
          prompt: buildPart1Prompt(part1Count, true),
          systemInstruction:
            "Siz professional o'zbek akademik taqdimot dizayneri va muharririsiz. Faqat so'ralgan JSON sxemasida aniq, toza, lo'nda o'zbekcha matn qaytaring.",
          responseSchema: SLIDE_RESPONSE_SCHEMA,
          trace,
        })) as Record<string, unknown>;

        const rawSlides = Array.isArray(data.slides)
          ? (data.slides as Array<Record<string, unknown>>).slice(0, part1Count)
          : [];
        const topicQueries = Array.isArray(data.topicImageQueries)
          ? (data.topicImageQueries as unknown[]).map((q) => String(q || '').trim()).filter(Boolean)
          : [];
        const slideKeywords = rawSlides
          .map((s) => (typeof s.imageKeyword === 'string' ? s.imageKeyword.trim() : ''))
          .filter(Boolean);

        const realPhotos = await searchRealTopicImages(topic, [...topicQueries, ...slideKeywords], 3);
        data.slides = sanitizeSlideItems(rawSlides);
        data.references = normalizeReferenceList(data.references);
        data.topicImages = realPhotos;

        sendAiJson({ serviceId: body.serviceId, splitMode: 'part1', data });
        return;
      }

      if (splitMode === 'part2') {
        const part1Count = Math.max(1, Number(body.part1Count) || Math.ceil(totalContentCount / 2));
        const part2Count = Math.min(18, Math.max(1, Number(body.part2Count) || (totalContentCount - part1Count)));
        const prev = body.previousContext || {};

        const part2Data = (await generateStructuredJson({
          schemaName: 'slaydcanva_deck_part2',
          prompt: buildPart2Prompt(part1Count, part2Count, prev),
          systemInstruction:
            "Siz professional o'zbek akademik taqdimot muharririsiz. 1-qismning mantiqiy davomi sifatida faqat yangi slaydlar va manbalarni JSON shaklida qaytaring.",
          responseSchema: SLIDE_PART2_SCHEMA,
          trace,
        })) as Record<string, unknown>;

        const rawPart2Slides = Array.isArray(part2Data.slides)
          ? (part2Data.slides as Array<Record<string, unknown>>).slice(0, part2Count)
          : [];
        part2Data.slides = sanitizeSlideItems(rawPart2Slides);
        part2Data.references = normalizeReferenceList(part2Data.references);

        sendAiJson({ serviceId: body.serviceId, splitMode: 'part2', data: part2Data });
        return;
      }

      if (totalSlides > 11) {
        const part1Count = Math.ceil(totalContentCount / 2);
        const part2Count = totalContentCount - part1Count;

        const data1 = (await generateStructuredJson({
          schemaName: 'slaydcanva_deck',
          prompt: buildPart1Prompt(part1Count, true),
          systemInstruction:
            "Siz professional o'zbek akademik taqdimot dizayneri va muharririsiz. Faqat so'ralgan JSON sxemasida aniq, toza, lo'nda o'zbekcha matn qaytaring.",
          responseSchema: SLIDE_RESPONSE_SCHEMA,
          trace,
        })) as Record<string, unknown>;

        const slides1 = Array.isArray(data1.slides)
          ? (data1.slides as Array<Record<string, unknown>>).slice(0, part1Count)
          : [];

        const topicQueries = Array.isArray(data1.topicImageQueries)
          ? (data1.topicImageQueries as unknown[]).map((q) => String(q || '').trim()).filter(Boolean)
          : [];
        const slideKeywords = slides1
          .map((s) => (typeof s.imageKeyword === 'string' ? s.imageKeyword.trim() : ''))
          .filter(Boolean);

        const [realPhotos, part2Data] = await Promise.all([
          searchRealTopicImages(topic, [...topicQueries, ...slideKeywords], 3),
          generateStructuredJson({
            schemaName: 'slaydcanva_deck_part2',
            prompt: buildPart2Prompt(part1Count, part2Count, {
              deckTitle: typeof data1.deckTitle === 'string' ? data1.deckTitle : topic,
              planItems: Array.isArray(data1.planItems)
                ? (data1.planItems as Array<{ tag?: string; title?: string }>)
                : [],
              previousSlides: slides1.map((s) => ({
                tag: typeof s.tag === 'string' ? s.tag : '',
                title: typeof s.title === 'string' ? s.title : '',
              })),
            }),
            systemInstruction:
              "Siz professional o'zbek akademik taqdimot muharririsiz. 1-qismning mantiqiy davomi sifatida faqat yangi slaydlar va manbalarni JSON shaklida qaytaring.",
            responseSchema: SLIDE_PART2_SCHEMA,
            trace,
          }) as Promise<Record<string, unknown>>,
        ]);

        const slides2 = Array.isArray(part2Data.slides)
          ? (part2Data.slides as Array<Record<string, unknown>>).slice(0, part2Count)
          : [];
        const combinedSlides = sanitizeSlideItems([...slides1, ...slides2]);

        data1.slides = applyTopicPhotosToDeck(combinedSlides, realPhotos);
        data1.topicImages = realPhotos;
        const refs2 = normalizeReferenceList(part2Data.references);
        data1.references = refs2.length > 0 ? refs2 : normalizeReferenceList(data1.references);

        sendAiJson({ serviceId: body.serviceId, data: data1 });
        return;
      }

      const data = (await generateStructuredJson({
        schemaName: 'slaydcanva_deck',
        prompt: buildPart1Prompt(totalContentCount, false),
        systemInstruction:
          "Siz professional o'zbek akademik taqdimot dizayneri va muharririsiz. Faqat so'ralgan JSON sxemasida aniq, toza, lo'nda o'zbekcha matn qaytaring.",
        responseSchema: SLIDE_RESPONSE_SCHEMA,
        trace,
      })) as Record<string, unknown>;

      const rawSlides = Array.isArray(data.slides)
        ? (data.slides as Array<Record<string, unknown>>).slice(0, totalContentCount)
        : [];
      const topicQueries = Array.isArray(data.topicImageQueries)
        ? (data.topicImageQueries as unknown[]).map((q) => String(q || '').trim()).filter(Boolean)
        : [];
      const slideKeywords = rawSlides
        .map((s) => (typeof s.imageKeyword === 'string' ? s.imageKeyword.trim() : ''))
        .filter(Boolean);

      const realPhotos = await searchRealTopicImages(topic, [...topicQueries, ...slideKeywords], 3);
      data.slides = applyTopicPhotosToDeck(sanitizeSlideItems(rawSlides), realPhotos);
      data.references = normalizeReferenceList(data.references);
      data.topicImages = realPhotos;

      sendAiJson({ serviceId: body.serviceId, data });
      return;
    }

    if (body.serviceId === 'stitched_notebook_pdf') {
      const taskCount = Math.min(8, Math.max(2, Number(body.taskCount) || 4));
      const prompt = `
Mavzu: "${topic}"
Fan / Yo'nalish: "${subject || 'Dasturlash / Fan'}"
Qo'shimcha ko'rsatma: "${details || 'Aniq masalalar va ularning yechimlarini daftar uslubida yoz'}"
Masalalar / Topsiriqlar soni: ${taskCount} ta.

Vazifa: Tikilgan standart daftar (katak daftar) sahifalariga joylashadigan ${taskCount} ta topshiriq / masala / kod blokini JSON ko'rinishida tayyorla.
Qoidalar:
- Agar mavzu dasturlash (C++, Python, JS, Java va h.k.) bo'lsa, lines ichida toza, to'liq ishlaydigan kod qatorlarini ber (har bir qator 58 belgidan oshmasin).
- Agar mavzu matematika, fizika yoki nazariy fan bo'lsa, lines ichida bosqichma-bosqich formula va aniq yechim qatorlarini ber (har bir qator 58 belgidan oshmasin).
- Har bir topshiriqda 6 dan 10 tagacha qisqa qator bo'lsin.
- sectionLabel misol: "A. Asosiy qism", "B. Amaliy masalalar".
- title misol: "1-masala: Arifmetik amallar".
`;

      const data = await generateStructuredJson({
        schemaName: 'slaydcanva_notebook',
        prompt,
        systemInstruction:
          "Siz standart o'quv daftari uchun aniq masala, kod va yechimlar tuzuvchi mutaxassissiz. Faqat JSON qaytaring.",
        responseSchema: NOTEBOOK_RESPONSE_SCHEMA,
        trace,
      });
      sendAiJson({ serviceId: body.serviceId, data });
      return;
    }

    if (body.serviceId === 'five_block_infographic') {
      const prompt = `
Mavzu: "${topic}"
Soha: "${subject || "Ilmiy / Ta'limiy"}"
Qo'shimcha ko'rsatma: "${details || '5 ta aniq blokli infografika tayyorla'}"

Vazifa: 16:9 formatdagi 5-blokli infografika posteri uchun tuzilmani JSON ko'rinishida yarat.
Qoidalar:
- mainTitle: Qisqa, katta harfli asosiy sarlavha (4-7 so'z).
- subTitle: Ikkinchi qator sariq sarlavha (3-6 so'z).
- blocks: Aynan 5 ta blok (number: 1, 2, 3, 4, 5):
  - 1, 2, 3-bloklar yuqori qatorda joylashadi (har birida 3-4 ta qisqa bullet: lead = qalin kalit so'z, text = qisqa izoh).
  - 4, 5-bloklar pastki qatorda joylashadi (har birida 3-4 ta bullet).
  - calloutLabels: har bir blokning diagramma/rasm qismida ko'rinadigan 2-3 ta qisqa yorliq (2-3 so'zdan).
- Matnlar infografika kartochkasiga sig'ishi uchun ixcham va aniq bo'lsin.
`;

      const data = await generateStructuredJson({
        schemaName: 'slaydcanva_infographic',
        prompt,
        systemInstruction:
          "Siz ilmiy va ta'limiy infografika muharririsiz. O'zbek tilida 5-blokli ixcham, tushunarli infografika JSON tuzilmasini qaytaring.",
        responseSchema: INFOGRAPHIC_RESPONSE_SCHEMA,
        trace,
      });
      sendAiJson({ serviceId: body.serviceId, data });
      return;
    }

    if (pendingCharge) {
      await refundUserForAi(pendingCharge.tgUser, pendingCharge.txId, pendingCharge.price);
    }
    res.status(400).json({ error: "Noto'g'ri xizmat turi." });
  } catch (err) {
    if (pendingCharge) {
      await refundUserForAi(pendingCharge.tgUser, pendingCharge.txId, pendingCharge.price);
    }
    if (trace.length > 0) {
      res.setHeader('X-AI-Trace', trace.join(' | '));
    }
    console.error('[SlaydCanva AI Error]', err);
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('AI_API_KEY_MISSING') || msg.includes('GEMINI_API_KEY_MISSING')) {
      res.status(503).json({
        error:
          "OPENROUTER_API_KEY sozlanmagan. Settings > Secrets bo'limidan OpenRouter API kalitingizni qo'shing.",
      });
      return;
    }

    if (err instanceof ProviderHttpError && err.provider === 'openrouter') {
      if (err.status === 401) {
        res.status(401).json({
          error:
            "OpenRouter API kaliti yaroqsiz. Settings > Secrets bo'limida OPENROUTER_API_KEY ni tekshiring.",
        });
        return;
      }
      if (err.status === 402) {
        res.status(402).json({
          error:
            "OpenRouter hisobida kredit yetarli emas. OpenRouter balansingizni yoki bepul modellar limitini tekshiring.",
        });
        return;
      }
      if (err.status === 429) {
        res.status(429).json({
          error: "OpenRouter so'rovlar limiti to'ldi. Biroz kutib qaytadan urinib ko'ring.",
        });
        return;
      }
      if (err.status === 504) {
        res.status(504).json({
          error:
            "Sun'iy intellekt javobi kutilganidan uzoq davom etdi (timeout). Qaytadan urinib ko'ring.",
        });
        return;
      }
    }

    if (
      msg.includes('403') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('API_KEY_INVALID') ||
      msg.includes('API key not valid') ||
      msg.includes('API key should be set')
    ) {
      res.status(403).json({
        error:
          "API kalit yaroqsiz yoki ruxsat berilmagan. Settings > Secrets panelida tekshiring.",
      });
      return;
    }
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      res.status(503).json({
        error:
          "Sun'iy intellekt serverida vaqtincha yuklama yuqori (503). Iltimos, 5-10 soniyadan keyin qaytadan urinib ko'ring.",
      });
      return;
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      res.status(429).json({
        error: "So'rovlar limiti to'ldi. Biroz kutib qaytadan urinib ko'ring.",
      });
      return;
    }
    res.status(500).json({
      error: "Sun'iy intellekt bilan bog'lanishda xatolik yuz berdi. Qaytadan urinib ko'ring.",
    });
  }
});

// =========================================================================
// Telegram Bot, Auth, Notifications, History & Document Delivery Helpers
// =========================================================================
const DEFAULT_PUBLIC_ORIGIN = 'https://slaydcanva.vercel.app';
const SESSION_COOKIE_NAME = 'slaydcanva_session';
const ADMIN_COOKIE_NAME = 'slaydcanva_admin_session';
const FIFTEEN_DAYS_SEC = 15 * 24 * 60 * 60;
const FIFTEEN_DAYS_MS = FIFTEEN_DAYS_SEC * 1000;
const MAX_TG_DOCUMENT_BYTES = 3_200_000; // Fits safely under Vercel 4.5MB request limit after base64
const MODULE_EPHEMERAL_SECRET = crypto.randomBytes(32);

interface TgUserProfile {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
}

interface TgTransaction {
  id: string;
  title: string;
  method: string;
  amount: number;
  date: string;
}

interface TgUserAccount {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  fullName?: string;
  contact?: string;
  balance: number;
  referralCount: number;
  referredBy?: string;
  isBanned: boolean;
  isNewUser?: boolean;
  transactions: TgTransaction[];
  notifyOnActivity: boolean;
  autoSendFiles: boolean;
  updatedAt: number;
}

interface MemoryKvEntry {
  value: string;
  expiresAt?: number;
}

const memoryKvStore = new Map<string, MemoryKvEntry>();
let cachedBotUsername: string | null = null;

function getKvCredentials(): { url: string; token: string } | null {
  const url =
    getCleanEnvKey(process.env.KV_REST_API_URL, 'MY_KV_REST_API_URL') ||
    getCleanEnvKey(process.env.UPSTASH_REDIS_REST_URL, 'MY_KV_REST_API_URL');
  const token =
    getCleanEnvKey(process.env.KV_REST_API_TOKEN, 'MY_KV_REST_API_TOKEN') ||
    getCleanEnvKey(process.env.UPSTASH_REDIS_REST_TOKEN, 'MY_KV_REST_API_TOKEN');
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    return { url: parsed.toString().replace(/\/+$/, ''), token };
  } catch {
    return null;
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  const creds = getKvCredentials();
  if (creds) {
    try {
      const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${creds.token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as { result?: unknown };
        if (typeof data.result === 'string' && data.result) {
          return JSON.parse(data.result) as T;
        }
        return null;
      }
    } catch {
      // Fallback to in-memory store
    }
  }
  const entry = memoryKvStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryKvStore.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  memoryKvStore.set(key, {
    value: serialized,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
  });
  if (memoryKvStore.size > 1500) {
    const firstKey = memoryKvStore.keys().next().value;
    if (firstKey) memoryKvStore.delete(firstKey);
  }

  const creds = getKvCredentials();
  if (creds) {
    try {
      const endpoint =
        ttlSeconds && ttlSeconds > 0
          ? `${creds.url}/set/${encodeURIComponent(key)}?EX=${Math.floor(ttlSeconds)}`
          : `${creds.url}/set/${encodeURIComponent(key)}`;
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'text/plain; charset=utf-8',
        },
        body: serialized,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Ignore transient KV write failures; memory fallback still holds it
    }
  }
}

function getTelegramBotToken(): string | null {
  return getCleanEnvKey(process.env.TELEGRAM_BOT_TOKEN, 'MY_TELEGRAM_BOT_TOKEN');
}

function getTelegramWebhookSecret(): string | null {
  return getCleanEnvKey(process.env.TELEGRAM_WEBHOOK_SECRET, 'MY_TELEGRAM_WEBHOOK_SECRET');
}

function getSigningKey(): Buffer {
  const explicit = getCleanEnvKey(process.env.TELEGRAM_SESSION_SECRET, 'MY_TELEGRAM_SESSION_SECRET');
  if (explicit) {
    return crypto.createHash('sha256').update(explicit).digest();
  }
  const botToken = getTelegramBotToken();
  if (botToken) {
    return crypto.createHmac('sha256', 'slaydcanva-session-v1').update(botToken).digest();
  }
  return MODULE_EPHEMERAL_SECRET;
}

function signToken(payload: Record<string, unknown>, ttlMs: number): string {
  const body = { ...payload, exp: Date.now() + ttlMs };
  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSigningKey()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedToken(token: unknown): Record<string, unknown> | null {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  const dotIdx = trimmed.indexOf('.');
  if (dotIdx <= 0 || dotIdx === trimmed.length - 1) return null;
  const encoded = trimmed.slice(0, dotIdx);
  const sig = trimmed.slice(dotIdx + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(sig)) return null;

  const expectedSig = crypto.createHmac('sha256', getSigningKey()).update(encoded).digest();
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function safeTimingEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyTelegramWebAppInitData(initData: string, botToken: string): TgUserProfile | null {
  if (!initData || typeof initData !== 'string' || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;

  const authDate = Number(params.get('auth_date'));
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > nowSec + 300 || nowSec - authDate > 86400) {
    return null;
  }

  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (!safeTimingEqual(computedHash.toLowerCase(), hash.toLowerCase())) {
    return null;
  }

  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    const u = JSON.parse(rawUser) as Record<string, unknown>;
    const id = u.id !== undefined && u.id !== null ? String(u.id).trim() : '';
    if (!/^\d{3,20}$/.test(id)) return null;
    return {
      telegramId: id,
      chatId: id,
      firstName: typeof u.first_name === 'string' && u.first_name.trim() ? u.first_name.trim().slice(0, 80) : 'Telegram',
      lastName: typeof u.last_name === 'string' && u.last_name.trim() ? u.last_name.trim().slice(0, 80) : undefined,
      username: typeof u.username === 'string' && u.username.trim() ? u.username.trim().slice(0, 64) : undefined,
    };
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function hasValidCookieCsrf(req: express.Request): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.get('origin');
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (host && originHost !== host) return false;
      return true;
    } catch {
      return false;
    }
  }
  return req.get('x-requested-with') === 'SlaydCanva';
}

function appendHttpCookie(
  req: express.Request,
  res: express.Response,
  name: string,
  value: string,
  maxAgeSec: number
): void {
  const isHttps =
    req.secure ||
    req.get('x-forwarded-proto') === 'https' ||
    Boolean(process.env.VERCEL);

  const cookieParts = [
    `${name}=${value ? encodeURIComponent(value) : ''}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSec))}`,
    isHttps ? 'SameSite=None' : 'SameSite=Lax',
    ...(isHttps ? ['Secure', 'Partitioned'] : []),
  ];
  res.append('Set-Cookie', cookieParts.join('; '));
}

function getAuthenticatedTelegramUser(req: express.Request): TgUserProfile | null {
  const authHeader = req.get('authorization');
  let rawToken: string | undefined;
  let usedCookie = false;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    rawToken = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.get('cookie'));
    rawToken = cookies[SESSION_COOKIE_NAME];
    usedCookie = Boolean(rawToken);
  }

  if (!rawToken) return null;

  if (usedCookie && !hasValidCookieCsrf(req)) {
    return null;
  }

  const payload = verifySignedToken(rawToken);
  if (!payload || payload.kind !== 'session') return null;
  const tid = typeof payload.tid === 'string' ? payload.tid : '';
  const cid = typeof payload.cid === 'string' ? payload.cid : tid;
  if (!/^\d{3,20}$/.test(tid) || !/^-?\d{3,24}$/.test(cid)) return null;

  return {
    telegramId: tid,
    chatId: cid,
    firstName: typeof payload.fn === 'string' && payload.fn ? payload.fn : 'Foydalanuvchi',
    lastName: typeof payload.ln === 'string' && payload.ln ? payload.ln : undefined,
    username: typeof payload.un === 'string' && payload.un ? payload.un : undefined,
  };
}

function issueSessionCookieAndToken(
  req: express.Request,
  res: express.Response,
  user: TgUserProfile
): string {
  const token = signToken(
    {
      kind: 'session',
      tid: user.telegramId,
      cid: user.chatId,
      fn: user.firstName,
      ln: user.lastName || '',
      un: user.username || '',
    },
    FIFTEEN_DAYS_MS
  );
  appendHttpCookie(req, res, SESSION_COOKIE_NAME, token, FIFTEEN_DAYS_SEC);
  return token;
}

function issueAdminCookieAndToken(
  req: express.Request,
  res: express.Response,
  telegramId: string,
  role: 'super_admin' | 'manager'
): string {
  const token = signToken(
    { kind: 'admin_session', tid: telegramId, role },
    FIFTEEN_DAYS_MS
  );
  appendHttpCookie(req, res, ADMIN_COOKIE_NAME, token, FIFTEEN_DAYS_SEC);
  return token;
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  appendHttpCookie(req, res, SESSION_COOKIE_NAME, '', 0);
  appendHttpCookie(req, res, ADMIN_COOKIE_NAME, '', 0);
}

function clearAdminCookie(req: express.Request, res: express.Response): void {
  appendHttpCookie(req, res, ADMIN_COOKIE_NAME, '', 0);
}

function formatUzDate(d = new Date()): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function formatSomServer(amount: number): string {
  return `${Math.round(amount).toLocaleString('uz-UZ').replace(/,/g, ' ')} so'm`;
}

function escapeTgHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hasPersistentStorage(): boolean {
  return isNeonConfigured() || Boolean(getKvCredentials());
}

function getStorageDriver(): 'neon' | 'kv' | 'memory' {
  if (isNeonConfigured()) return 'neon';
  if (getKvCredentials()) return 'kv';
  return 'memory';
}

async function saveOrderRecord(rec: TolovgoOrderRecord): Promise<void> {
  tolovgoOrders.set(rec.orderId, rec);
  await Promise.all([
    kvSet(`tolovgo_order:${rec.orderId}`, rec, 86400),
    dbUpsertPaymentOrder(rec),
  ]);
}

async function loadOrderRecord(orderId: string): Promise<TolovgoOrderRecord | undefined> {
  const fromDb = await dbGetPaymentOrder(orderId);
  if (fromDb) {
    tolovgoOrders.set(orderId, fromDb);
    return fromDb;
  }
  const fromMem = tolovgoOrders.get(orderId);
  if (fromMem) return fromMem;
  return (await kvGet<TolovgoOrderRecord>(`tolovgo_order:${orderId}`)) || undefined;
}

async function saveLoginNonce(nonce: string, loginToken: string): Promise<void> {
  await Promise.all([
    kvSet(`tg_nonce:${nonce}`, { loginToken }, 600),
    dbSaveAuthNonce(nonce, loginToken, 600),
  ]);
}

async function loadLoginNonce(nonce: string): Promise<string | null> {
  const fromDb = await dbGetAuthNonce(nonce);
  if (fromDb) return fromDb;
  const record = await kvGet<{ loginToken: string }>(`tg_nonce:${nonce}`);
  return record?.loginToken || null;
}

function sanitizePricingSettings(raw: unknown): AppPricingSettings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppPricingSettings>;
  const rawSrv = (src.services && typeof src.services === 'object' ? src.services : {}) as Record<
    string,
    Record<string, unknown>
  >;
  const clampInt = (v: unknown, def: number, min = 0, max = 500_000) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };
  const d = DEFAULT_PRICING_SETTINGS.services;
  return {
    services: {
      academic_wave_pptx: {
        basePrice: clampInt(rawSrv.academic_wave_pptx?.basePrice, d.academic_wave_pptx.basePrice),
        baseLimit: clampInt(rawSrv.academic_wave_pptx?.baseLimit, d.academic_wave_pptx.baseLimit, 3, 20),
        extraStepPrice: clampInt(rawSrv.academic_wave_pptx?.extraStepPrice, d.academic_wave_pptx.extraStepPrice),
      },
      white_card_pptx: {
        basePrice: clampInt(rawSrv.white_card_pptx?.basePrice, d.white_card_pptx.basePrice),
        baseLimit: clampInt(rawSrv.white_card_pptx?.baseLimit, d.white_card_pptx.baseLimit, 3, 20),
        extraStepPrice: clampInt(rawSrv.white_card_pptx?.extraStepPrice, d.white_card_pptx.extraStepPrice),
      },
      stitched_notebook_pdf: {
        basePrice: clampInt(rawSrv.stitched_notebook_pdf?.basePrice, d.stitched_notebook_pdf.basePrice),
        baseLimit: clampInt(rawSrv.stitched_notebook_pdf?.baseLimit, d.stitched_notebook_pdf.baseLimit, 2, 12),
        extraStepPrice: clampInt(rawSrv.stitched_notebook_pdf?.extraStepPrice, d.stitched_notebook_pdf.extraStepPrice),
      },
      five_block_infographic: {
        basePrice: clampInt(rawSrv.five_block_infographic?.basePrice, d.five_block_infographic.basePrice),
      },
      ai_canvas_design: {
        basePrice: clampInt(rawSrv.ai_canvas_design?.basePrice, d.ai_canvas_design.basePrice),
        baseLimit: clampInt(rawSrv.ai_canvas_design?.baseLimit, d.ai_canvas_design.baseLimit, 1, 15),
        extraStepPrice: clampInt(rawSrv.ai_canvas_design?.extraStepPrice, d.ai_canvas_design.extraStepPrice),
      },
    },
    welcomeBonus: clampInt(src.welcomeBonus, DEFAULT_PRICING_SETTINGS.welcomeBonus, 0, 50_000),
    referralInviterBonus: clampInt(src.referralInviterBonus, DEFAULT_PRICING_SETTINGS.referralInviterBonus, 0, 50_000),
    referralInviteeBonus: clampInt(src.referralInviteeBonus, DEFAULT_PRICING_SETTINGS.referralInviteeBonus, 0, 50_000),
    dailyReferralLimit: clampInt(src.dailyReferralLimit, DEFAULT_PRICING_SETTINGS.dailyReferralLimit, 1, 200),
  };
}

async function getEffectivePricingSettings(): Promise<AppPricingSettings> {
  const fromDb = await dbGetSetting<AppPricingSettings>('pricing');
  if (fromDb) return sanitizePricingSettings(fromDb);
  const fromKv = await kvGet<AppPricingSettings>('app_settings:pricing');
  if (fromKv) return sanitizePricingSettings(fromKv);
  return DEFAULT_PRICING_SETTINGS;
}

async function savePricingSettings(next: AppPricingSettings): Promise<AppPricingSettings> {
  const clean = sanitizePricingSettings(next);
  await Promise.all([
    dbSetSetting('pricing', clean),
    kvSet('app_settings:pricing', clean),
  ]);
  return clean;
}

function calculateServerServicePrice(body: GenerateRequestBody, pricing: AppPricingSettings): number {
  if (body.splitMode === 'part2') return 0;
  const s = pricing.services;
  if (body.serviceId === 'academic_wave_pptx' || body.serviceId === 'white_card_pptx') {
    const cfg = s[body.serviceId];
    const count = Math.min(30, Math.max(5, Number(body.slideCount) || 7));
    if (count <= cfg.baseLimit) return cfg.basePrice;
    return cfg.basePrice + (count - cfg.baseLimit) * cfg.extraStepPrice;
  }
  if (body.serviceId === 'ai_canvas_design') {
    const cfg = s.ai_canvas_design;
    const count = Math.min(20, Math.max(1, Number(body.slideCount) || 3));
    if (count <= cfg.baseLimit) return cfg.basePrice;
    return cfg.basePrice + (count - cfg.baseLimit) * cfg.extraStepPrice;
  }
  if (body.serviceId === 'stitched_notebook_pdf') {
    const cfg = s.stitched_notebook_pdf;
    const count = Math.min(8, Math.max(2, Number(body.taskCount) || 4));
    if (count <= cfg.baseLimit) return cfg.basePrice;
    return cfg.basePrice + (count - cfg.baseLimit) * cfg.extraStepPrice;
  }
  if (body.serviceId === 'five_block_infographic') {
    return s.five_block_infographic.basePrice;
  }
  return 0;
}

async function getEffectiveTolovgoMode(): Promise<'live' | 'test'> {
  const fromDb = await dbGetSetting<{ tolovgoMode?: string }>('payment_config');
  if (fromDb?.tolovgoMode === 'test' || fromDb?.tolovgoMode === 'live') {
    return fromDb.tolovgoMode;
  }
  const fromKv = await kvGet<{ tolovgoMode?: string }>('app_settings:payment_config');
  if (fromKv?.tolovgoMode === 'test' || fromKv?.tolovgoMode === 'live') {
    return fromKv.tolovgoMode;
  }
  const envMode = process.env.TOLOVGO_MODE?.trim().toLowerCase();
  if (envMode === 'test') return 'test';
  if (envMode === 'live') return 'live';
  const hasLive = Boolean(
    getCleanEnvKey(process.env.TOLOVGO_API_KEY, 'MY_TOLOVGO_API_KEY') ||
      getCleanEnvKey(process.env.TOLOVGO_KEY, 'MY_TOLOVGO_API_KEY')
  );
  if (!hasLive && getCleanEnvKey(process.env.TOLOVGO_TEST_API, 'MY_TOLOVGO_TEST_API')) {
    return 'test';
  }
  return 'live';
}

async function savePaymentConfigSettings(tolovgoMode: 'live' | 'test'): Promise<void> {
  await Promise.all([
    dbSetSetting('payment_config', { tolovgoMode }),
    kvSet('app_settings:payment_config', { tolovgoMode }),
  ]);
}

const ALL_MANAGER_PERMISSIONS: DbManagerPermission[] = [
  'overview',
  'crm_events',
  'users',
  'balance',
  'orders',
  'pricing',
  'promos',
  'broadcast',
  'settings',
];

interface SiteConfigSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementBanner: string;
  notifyNewUsersToStaff: boolean;
  notifyPaymentsToStaff: boolean;
  defaultAiModel: string;
}

const DEFAULT_SITE_CONFIG: SiteConfigSettings = {
  maintenanceMode: false,
  maintenanceMessage: "Texnik yangilanishlar olib borilmoqda. Birozdan so'ng urinib ko'ring.",
  announcementBanner: '',
  notifyNewUsersToStaff: true,
  notifyPaymentsToStaff: true,
  defaultAiModel: 'google/gemini-2.5-flash',
};

async function getEffectiveSiteConfig(): Promise<SiteConfigSettings> {
  const fromDb = await dbGetSetting<Partial<SiteConfigSettings>>('site_config');
  const fromKv = !fromDb ? await kvGet<Partial<SiteConfigSettings>>('app_settings:site_config') : null;
  const raw = fromDb || fromKv || {};
  return {
    maintenanceMode: Boolean(raw.maintenanceMode),
    maintenanceMessage:
      typeof raw.maintenanceMessage === 'string' && raw.maintenanceMessage.trim()
        ? raw.maintenanceMessage.trim().slice(0, 300)
        : DEFAULT_SITE_CONFIG.maintenanceMessage,
    announcementBanner:
      typeof raw.announcementBanner === 'string'
        ? raw.announcementBanner.trim().slice(0, 240)
        : '',
    notifyNewUsersToStaff: raw.notifyNewUsersToStaff !== false,
    notifyPaymentsToStaff: raw.notifyPaymentsToStaff !== false,
    defaultAiModel:
      typeof raw.defaultAiModel === 'string' && raw.defaultAiModel.trim()
        ? raw.defaultAiModel.trim().slice(0, 100)
        : DEFAULT_SITE_CONFIG.defaultAiModel,
  };
}

async function saveSiteConfig(next: Partial<SiteConfigSettings>): Promise<SiteConfigSettings> {
  const curr = await getEffectiveSiteConfig();
  const clean: SiteConfigSettings = {
    maintenanceMode: typeof next.maintenanceMode === 'boolean' ? next.maintenanceMode : curr.maintenanceMode,
    maintenanceMessage:
      typeof next.maintenanceMessage === 'string'
        ? next.maintenanceMessage.trim().slice(0, 300)
        : curr.maintenanceMessage,
    announcementBanner:
      typeof next.announcementBanner === 'string'
        ? next.announcementBanner.trim().slice(0, 240)
        : curr.announcementBanner,
    notifyNewUsersToStaff:
      typeof next.notifyNewUsersToStaff === 'boolean'
        ? next.notifyNewUsersToStaff
        : curr.notifyNewUsersToStaff,
    notifyPaymentsToStaff:
      typeof next.notifyPaymentsToStaff === 'boolean'
        ? next.notifyPaymentsToStaff
        : curr.notifyPaymentsToStaff,
    defaultAiModel:
      typeof next.defaultAiModel === 'string' && next.defaultAiModel.trim()
        ? next.defaultAiModel.trim().slice(0, 100)
        : curr.defaultAiModel,
  };
  await Promise.all([
    dbSetSetting('site_config', clean),
    kvSet('app_settings:site_config', clean),
  ]);
  return clean;
}

function getTolovgoWebhookSecret(): string | null {
  return (
    getCleanEnvKey(process.env.TOLOVGO_WEBHOOK_SECRET, 'MY_TOLOVGO_WEBHOOK_SECRET') ||
    getCleanEnvKey(process.env.TOLOVGO_SIGNATURE_SECRET, 'MY_TOLOVGO_WEBHOOK_SECRET')
  );
}

function verifyTolovgoWebhookSignature(
  req: express.Request,
  orderId: string,
  rawBodyObj: Record<string, unknown>
): { valid: boolean; configured: boolean; provided: boolean } {
  const secret = getTolovgoWebhookSecret();
  if (!secret) return { valid: true, configured: false, provided: false };

  const headerSig =
    req.get('x-tolovgo-signature') ||
    req.get('x-signature') ||
    req.get('x-webhook-signature') ||
    req.get('x-hub-signature-256') ||
    req.get('x-tolovgo-secret') ||
    '';
  const bodySig =
    typeof rawBodyObj.signature === 'string'
      ? rawBodyObj.signature
      : typeof rawBodyObj.sign === 'string'
        ? rawBodyObj.sign
        : typeof req.query.signature === 'string'
          ? req.query.signature
          : typeof req.query.sign === 'string'
            ? req.query.sign
            : '';

  const providedRaw = (headerSig || bodySig).trim().replace(/^sha256=/i, '');
  if (!providedRaw) {
    return { valid: false, configured: true, provided: false };
  }

  const rawBody = (req as RawBodyRequest).rawBody || JSON.stringify(rawBodyObj);
  const amountStr = rawBodyObj.amount !== undefined ? String(rawBodyObj.amount) : '';
  const statusStr = rawBodyObj.status !== undefined ? String(rawBodyObj.status) : '';

  const candidates = new Set<string>();
  candidates.add(secret);
  const digestPayloads = [
    rawBody,
    orderId,
    `${orderId}:${amountStr}`,
    `${orderId}:${statusStr}:${amountStr}`,
    `${orderId}${secret}`,
  ];
  for (const payload of digestPayloads) {
    candidates.add(crypto.createHmac('sha256', secret).update(payload).digest('hex'));
    candidates.add(crypto.createHmac('sha256', secret).update(payload).digest('base64'));
    candidates.add(crypto.createHmac('sha256', secret).update(payload).digest('base64url'));
    candidates.add(crypto.createHash('sha256').update(payload).digest('hex'));
  }

  for (const cand of candidates) {
    if (safeTimingEqual(providedRaw.toLowerCase(), cand.toLowerCase())) {
      return { valid: true, configured: true, provided: true };
    }
  }
  return { valid: false, configured: true, provided: true };
}

function getAdminTelegramIds(): string[] {
  const raw = process.env.ADMIN_TELEGRAM_ID?.trim() || '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d{3,20}$/.test(s));
}

function isTelegramAdmin(telegramId: string): boolean {
  const ids = getAdminTelegramIds();
  if (!ids.length) return false;
  return ids.some((id) => safeTimingEqual(id, telegramId));
}

async function listManagersAll(): Promise<DbManagerRecord[]> {
  const dbRows = await dbListManagers();
  if (dbRows) return dbRows;
  const kvRows = await kvGet<DbManagerRecord[]>('app_managers_list');
  return Array.isArray(kvRows) ? kvRows : [];
}

async function getManagerRecord(telegramId: string): Promise<DbManagerRecord | null> {
  const fromDb = await dbGetManagerById(telegramId);
  if (fromDb) return fromDb;
  const kvRows = await kvGet<DbManagerRecord[]>('app_managers_list');
  if (!Array.isArray(kvRows)) return null;
  return kvRows.find((m) => m.telegramId === telegramId) || null;
}

interface StaffAccessInfo {
  isStaff: boolean;
  role: 'super_admin' | 'manager' | 'user';
  permissions: DbManagerPermission[];
  managerRecord?: DbManagerRecord | null;
}

async function resolveStaffAccess(telegramId: string): Promise<StaffAccessInfo> {
  if (isTelegramAdmin(telegramId)) {
    return {
      isStaff: true,
      role: 'super_admin',
      permissions: ALL_MANAGER_PERMISSIONS,
      managerRecord: null,
    };
  }
  const mgr = await getManagerRecord(telegramId);
  if (mgr && mgr.isActive) {
    return {
      isStaff: true,
      role: 'manager',
      permissions: mgr.permissions.length > 0 ? mgr.permissions : ALL_MANAGER_PERMISSIONS,
      managerRecord: mgr,
    };
  }
  return { isStaff: false, role: 'user', permissions: [] };
}

function hashAdminPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyAdminPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

async function getAdminPasswordHash(): Promise<string | null> {
  const fromDb = await dbGetSetting<{ passwordHash?: string }>('admin_auth');
  if (fromDb?.passwordHash) return fromDb.passwordHash;
  const fromKv = await kvGet<{ passwordHash?: string }>('app_settings:admin_auth');
  return fromKv?.passwordHash || null;
}

const adminLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function checkAdminLoginAllowed(telegramId: string): boolean {
  const rec = adminLoginAttempts.get(telegramId);
  if (!rec) return true;
  if (rec.lockedUntil > Date.now()) return false;
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
    adminLoginAttempts.delete(telegramId);
  }
  return true;
}

function recordAdminLoginFailure(telegramId: string): void {
  const curr = adminLoginAttempts.get(telegramId) || { count: 0, lockedUntil: 0 };
  const nextCount = curr.count + 1;
  adminLoginAttempts.set(telegramId, {
    count: nextCount,
    lockedUntil: nextCount >= 5 ? Date.now() + 15 * 60 * 1000 : 0,
  });
}

function clearAdminLoginFailures(telegramId: string): void {
  adminLoginAttempts.delete(telegramId);
}

interface AuthenticatedStaffContext {
  user: TgUserProfile;
  staff: StaffAccessInfo;
}

async function requireStaffTelegram(
  req: express.Request,
  res: express.Response
): Promise<AuthenticatedStaffContext | null> {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Avval Telegram orqali tizimga kiring.' });
    return null;
  }
  const staff = await resolveStaffAccess(user.telegramId);
  if (!staff.isStaff) {
    res.status(403).json({ error: 'Sizda admin yoki menejer huquqi mavjud emas.' });
    return null;
  }
  return { user, staff };
}

function extractAdminTokenFromRequest(req: express.Request): {
  token: string;
  usedCookie: boolean;
} {
  const headerToken = (req.get('x-admin-token') || '').trim();
  if (headerToken) return { token: headerToken, usedCookie: false };
  const cookies = parseCookies(req.get('cookie'));
  const cookieToken = (cookies[ADMIN_COOKIE_NAME] || '').trim();
  return { token: cookieToken, usedCookie: Boolean(cookieToken) };
}

async function requireStaffSession(
  req: express.Request,
  res: express.Response,
  requiredPerm?: DbManagerPermission | 'super_admin'
): Promise<AuthenticatedStaffContext | null> {
  const ctx = await requireStaffTelegram(req, res);
  if (!ctx) return null;

  const { token, usedCookie } = extractAdminTokenFromRequest(req);
  if (usedCookie && !hasValidCookieCsrf(req)) {
    res.status(403).json({ error: 'Xavfsizlik tekshiruvidan o‘tmadi.' });
    return null;
  }

  const payload = verifySignedToken(token);
  if (
    !payload ||
    payload.kind !== 'admin_session' ||
    typeof payload.tid !== 'string' ||
    !safeTimingEqual(payload.tid, ctx.user.telegramId)
  ) {
    res.status(401).json({
      error: 'Admin/Menejer maxfiy paroli bilan tasdiqlash talab qilinadi.',
      code: 'admin_password_required',
    });
    return null;
  }

  if (requiredPerm === 'super_admin' && ctx.staff.role !== 'super_admin') {
    res.status(403).json({ error: 'Bu amal faqat Super Admin uchun ruxsat etilgan.' });
    return null;
  }
  if (
    requiredPerm &&
    requiredPerm !== 'super_admin' &&
    ctx.staff.role !== 'super_admin' &&
    !ctx.staff.permissions.includes(requiredPerm)
  ) {
    res.status(403).json({ error: `Sizda "${requiredPerm}" bo'limiga ruxsat yo'q.` });
    return null;
  }

  return ctx;
}

async function recordCrmEventSafe(entry: Omit<DbCrmEvent, 'id' | 'isRead' | 'createdAt'> & { id?: string }): Promise<void> {
  const id = entry.id || `crm_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const full: DbCrmEvent = {
    id,
    eventType: entry.eventType,
    title: entry.title,
    message: entry.message,
    userId: entry.userId,
    amount: entry.amount,
    isRead: false,
    createdAt: Date.now(),
  };
  await dbAppendCrmEvent(full);
  const existingKv = (await kvGet<DbCrmEvent[]>('app_crm_events')) || [];
  const nextKv = [full, ...existingKv.filter((e) => e.id !== id)].slice(0, 80);
  await kvSet('app_crm_events', nextKv);
}

async function notifyStaffTelegram(htmlMessage: string): Promise<void> {
  if (!getTelegramBotToken()) return;
  const adminIds = getAdminTelegramIds();
  const managers = await listManagersAll();
  const mgrIds = managers
    .filter((m) => m.isActive && m.notifyTelegram)
    .map((m) => m.telegramId);
  const recipients = Array.from(new Set([...adminIds, ...mgrIds])).filter((id) => /^\d{3,20}$/.test(id));
  if (!recipients.length) return;

  await Promise.allSettled(
    recipients.map((chatId) =>
      telegramApi('sendMessage', {
        chat_id: chatId,
        text: htmlMessage,
        parse_mode: 'HTML',
      })
    )
  );
}

async function notifyNewUserToCrmAndStaff(
  account: TgUserAccount,
  inviterId?: string
): Promise<void> {
  if (!account.isNewUser) return;
  const dedupeKey = `crm_newuser_notified:${account.telegramId}`;
  const already = await kvGet<boolean>(dedupeKey);
  if (already) return;
  await kvSet(dedupeKey, true, 7 * 86400);

  const display = [account.firstName, account.lastName].filter(Boolean).join(' ').trim();
  const uname = account.username ? `@${account.username}` : 'usernamesiz';
  const refText = inviterId ? ` · Referal: ID ${inviterId}` : '';

  await recordCrmEventSafe({
    id: `crm_newu_${account.telegramId}`,
    eventType: 'new_user',
    title: `Yangi foydalanuvchi: ${display}`,
    message: `${display} (${uname}, ID: ${account.telegramId})${refText}`,
    userId: account.telegramId,
    amount: account.balance,
  });

  const siteCfg = await getEffectiveSiteConfig();
  if (siteCfg.notifyNewUsersToStaff) {
    await notifyStaffTelegram(
      `🆕 <b>Yangi foydalanuvchi qo'shildi!</b>\n\n` +
        `👤 Ism: <b>${escapeTgHtml(display)}</b> (${escapeTgHtml(uname)})\n` +
        `🆔 ID: <code>${escapeTgHtml(account.telegramId)}</code>\n` +
        `💰 Boshlang'ich balans: <b>${escapeTgHtml(formatSomServer(account.balance))}</b>` +
        (inviterId ? `\n🤝 Taklif qildi: <code>${escapeTgHtml(inviterId)}</code>` : '')
    );
  }
}

async function notifyPaymentToCrmAndStaff(params: {
  orderId: string;
  telegramId: string;
  amount: number;
  method: string;
  isTest: boolean;
  source: string;
}): Promise<void> {
  const modeTag = params.isTest ? 'Sinov' : 'Haqiqiy';
  await recordCrmEventSafe({
    id: `crm_pay_${params.orderId}`,
    eventType: 'payment_paid',
    title: `To'lov tasdiqlandi: +${formatSomServer(params.amount)}`,
    message: `Buyurtma #${params.orderId} · ID ${params.telegramId} · ${params.method} (${modeTag}) · ${params.source}`,
    userId: params.telegramId,
    amount: params.amount,
  });

  const siteCfg = await getEffectiveSiteConfig();
  if (siteCfg.notifyPaymentsToStaff) {
    await notifyStaffTelegram(
      `💳 <b>Yangi TolovGo to'lovi qabul qilindi!</b>\n\n` +
        `💵 Summa: <b>+${escapeTgHtml(formatSomServer(params.amount))}</b>\n` +
        `🧾 Buyurtma: <code>#${escapeTgHtml(params.orderId)}</code>\n` +
        `🆔 Foydalanuvchi: <code>${escapeTgHtml(params.telegramId)}</code>\n` +
        `🏦 Usul: <b>${escapeTgHtml(params.method)}</b> (${modeTag})`
    );
  }
}

async function getTgUserAccount(
  profile: TgUserProfile,
  welcomeBonusOverride?: number
): Promise<TgUserAccount> {
  const welcomeBonus =
    typeof welcomeBonusOverride === 'number'
      ? welcomeBonusOverride
      : (await getEffectivePricingSettings()).welcomeBonus;

  const dbAccount = await dbGetOrCreateUser(profile, formatUzDate(), welcomeBonus);
  if (dbAccount) {
    return dbAccount;
  }

  const key = `tg_user:${profile.telegramId}`;
  const existing = await kvGet<TgUserAccount>(key);
  if (existing) {
    const updated: TgUserAccount = {
      ...existing,
      chatId: profile.chatId || existing.chatId,
      firstName: profile.firstName || existing.firstName,
      lastName: profile.lastName ?? existing.lastName,
      username: profile.username ?? existing.username,
      referralCount: typeof existing.referralCount === 'number' ? existing.referralCount : 0,
      isBanned: Boolean(existing.isBanned),
      isNewUser: false,
      notifyOnActivity: existing.notifyOnActivity !== false,
      autoSendFiles: existing.autoSendFiles !== false,
    };
    if (
      updated.chatId !== existing.chatId ||
      updated.firstName !== existing.firstName ||
      updated.username !== existing.username
    ) {
      updated.updatedAt = Date.now();
      await kvSet(key, updated);
    }
    return updated;
  }

  const safeWelcome = Math.max(0, Math.round(welcomeBonus));
  const fresh: TgUserAccount = {
    telegramId: profile.telegramId,
    chatId: profile.chatId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    balance: safeWelcome,
    referralCount: 0,
    isBanned: false,
    isNewUser: true,
    transactions:
      safeWelcome > 0
        ? [
            {
              id: `init_${profile.telegramId}`,
              title: 'Xush kelibsiz bonusi',
              method: 'Bonus',
              amount: safeWelcome,
              date: formatUzDate(),
            },
          ]
        : [],
    notifyOnActivity: true,
    autoSendFiles: true,
    updatedAt: Date.now(),
  };
  await kvSet(key, fresh);
  return fresh;
}

async function saveTgUserAccount(account: TgUserAccount): Promise<void> {
  account.updatedAt = Date.now();
  account.transactions = account.transactions.slice(0, 40);
  await kvSet(`tg_user:${account.telegramId}`, account);
}

async function chargeUserForAi(
  profile: TgUserProfile,
  txId: string,
  title: string,
  price: number
): Promise<{ ok: boolean; reason?: 'insufficient' | 'banned'; balance?: number }> {
  await getTgUserAccount(profile);
  const dbRes = await dbChargeAiService({
    telegramId: profile.telegramId,
    txId,
    title,
    price,
    dateLabel: formatUzDate(),
  });
  if (dbRes) {
    return {
      ok: dbRes.ok,
      reason: dbRes.reason === 'banned' ? 'banned' : 'insufficient',
      balance: dbRes.balance,
    };
  }

  const account = await getTgUserAccount(profile);
  if (account.isBanned) return { ok: false, reason: 'banned', balance: account.balance };
  if (account.balance < price) return { ok: false, reason: 'insufficient', balance: account.balance };
  account.balance = Math.max(0, account.balance - price);
  account.transactions.unshift({
    id: txId,
    title,
    method: 'AI Xizmat',
    amount: -price,
    date: formatUzDate(),
  });
  await saveTgUserAccount(account);
  return { ok: true, balance: account.balance };
}

async function refundUserForAi(
  profile: TgUserProfile,
  txId: string,
  price: number
): Promise<void> {
  if (price <= 0) return;
  if (isNeonConfigured()) {
    await dbRefundAiCharge({ telegramId: profile.telegramId, txId, price });
    return;
  }
  const key = `tg_user:${profile.telegramId}`;
  const account = await kvGet<TgUserAccount>(key);
  if (!account) return;
  const idx = account.transactions.findIndex((t) => t.id === txId);
  if (idx !== -1) {
    account.transactions.splice(idx, 1);
    account.balance += price;
    await saveTgUserAccount(account);
  }
}

async function applyReferralReward(
  inviteeId: string,
  inviterId: string,
  pricing: AppPricingSettings
): Promise<{ applied: boolean; inviterChatId?: string }> {
  const dbRes = await dbApplyReferralBonus({
    inviteeId,
    inviterId,
    inviterBonus: pricing.referralInviterBonus,
    inviteeBonus: pricing.referralInviteeBonus,
    dailyLimit: pricing.dailyReferralLimit,
    dateLabel: formatUzDate(),
  });
  if (dbRes !== null) {
    return { applied: dbRes.applied, inviterChatId: dbRes.inviterChatId };
  }

  if (!/^\d{3,20}$/.test(inviteeId) || !/^\d{3,20}$/.test(inviterId) || inviteeId === inviterId) {
    return { applied: false };
  }
  const refKey = `tg_ref_used:${inviteeId}`;
  const already = await kvGet<{ inviterId: string }>(refKey);
  if (already) return { applied: false };

  const inviter = await kvGet<TgUserAccount>(`tg_user:${inviterId}`);
  const invitee = await kvGet<TgUserAccount>(`tg_user:${inviteeId}`);
  if (!inviter || !invitee || inviter.isBanned || invitee.referredBy) {
    return { applied: false };
  }

  await kvSet(refKey, { inviterId });
  invitee.referredBy = inviterId;
  if (pricing.referralInviteeBonus > 0) {
    invitee.balance += pricing.referralInviteeBonus;
    invitee.transactions.unshift({
      id: `ref_out_${inviteeId}`,
      title: 'Referal taklif bonusi',
      method: 'Referal',
      amount: pricing.referralInviteeBonus,
      date: formatUzDate(),
    });
  }
  await saveTgUserAccount(invitee);

  if (pricing.referralInviterBonus > 0) {
    inviter.balance += pricing.referralInviterBonus;
    inviter.referralCount = (inviter.referralCount || 0) + 1;
    inviter.transactions.unshift({
      id: `ref_in_${inviteeId}`,
      title: `Referal bonusi (ID ${inviteeId})`,
      method: 'Referal',
      amount: pricing.referralInviterBonus,
      date: formatUzDate(),
    });
    await saveTgUserAccount(inviter);
  }
  return { applied: true, inviterChatId: inviter.chatId };
}

async function creditTgUserTopUp(
  telegramId: string,
  chatId: string,
  amount: number,
  orderId: string,
  methodLabel: string,
  isTest = false
): Promise<boolean> {
  const dbClaimed = await dbCreditTolovgoOrder(
    orderId,
    telegramId,
    chatId,
    amount,
    methodLabel,
    formatUzDate(),
    isTest
  );
  if (dbClaimed !== null) {
    return dbClaimed;
  }

  const key = `tg_user:${telegramId}`;
  const existing = await kvGet<TgUserAccount>(key);
  const txId = `tolovgo_${orderId}`;
  if (existing && existing.transactions.some((t) => t.id === txId)) {
    return false;
  }
  const account: TgUserAccount = existing || {
    telegramId,
    chatId,
    firstName: 'Foydalanuvchi',
    balance: 1000,
    referralCount: 0,
    isBanned: false,
    transactions: [],
    notifyOnActivity: true,
    autoSendFiles: true,
    updatedAt: Date.now(),
  };
  account.balance = Math.max(0, account.balance + amount);
  account.transactions.unshift({
    id: txId,
    title: `Balans to'ldirish (#${orderId})`,
    method: methodLabel,
    amount,
    date: formatUzDate(),
  });
  await saveTgUserAccount(account);
  return true;
}

async function telegramApi(
  method: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000),
  });
  const data = (await res.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    result?: unknown;
    description?: string;
  };
  return data;
}

async function telegramSendDocument(
  chatId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  caption?: string
): Promise<{ ok: boolean; description?: string }> {
  const token = getTelegramBotToken();
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };

  const form = new FormData();
  form.append('chat_id', chatId);
  if (caption) {
    form.append('caption', caption.slice(0, 900));
  }
  const uint8 = new Uint8Array(buffer);
  const blob = new Blob([uint8], { type: mimeType });
  form.append('document', blob, fileName);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  return (await res.json().catch(() => ({ ok: false }))) as {
    ok: boolean;
    description?: string;
  };
}

async function resolveTelegramBotUsername(): Promise<string | null> {
  const envName = getCleanEnvKey(process.env.TELEGRAM_BOT_USERNAME, 'MY_TELEGRAM_BOT_USERNAME');
  if (envName) {
    return envName.replace(/^@+/, '');
  }
  if (cachedBotUsername) return cachedBotUsername;
  const me = await telegramApi('getMe', {});
  const result = me.result as Record<string, unknown> | undefined;
  if (me.ok && result && typeof result.username === 'string' && result.username) {
    cachedBotUsername = result.username.replace(/^@+/, '');
    return cachedBotUsername;
  }
  return null;
}

function getPreferredPublicOrigin(req: express.Request): string {
  return getPublicBaseOrigin(req) || DEFAULT_PUBLIC_ORIGIN;
}

async function createTolovgoOrderForBot(
  req: express.Request,
  amount: number,
  telegramId: string,
  chatId: string,
  providerHint = 'Telegram Bot'
): Promise<{ orderId: string; payUrl: string; amount: number; isTest: boolean } | { error: string }> {
  const activeMode = await getEffectiveTolovgoMode();
  const cred = resolveTolovgoCredential(activeMode);
  if (!cred) {
    return { error: "TolovGo API kaliti sozlanmagan (TOLOVGO_API_KEY yoki TOLOVGO_TEST_API)." };
  }

  const origin = getPreferredPublicOrigin(req);
  const callbackUrl = `${origin}/api/payments/tolovgo/callback`;
  const returnUrl = `${origin}/`;
  const baseUrl = getTolovgoBaseUrl();

  const formParams = new URLSearchParams();
  formParams.set('amount', String(amount));
  formParams.set('note', `SlaydCanva balans (${providerHint})`);
  formParams.set('callback_url', callbackUrl);
  formParams.set('return_url', returnUrl);

  let upstreamRes = await fetch(`${baseUrl}/create`, {
    method: 'POST',
    headers: {
      'X-Api-Key': cred.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formParams.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (upstreamRes.status === 415) {
    upstreamRes = await fetch(`${baseUrl}/create`, {
      method: 'POST',
      headers: {
        'X-Api-Key': cred.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        amount,
        note: `SlaydCanva balans (${providerHint})`,
        callback_url: callbackUrl,
        return_url: returnUrl,
      }),
      signal: AbortSignal.timeout(15000),
    });
  }

  const rawText = await upstreamRes.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!upstreamRes.ok || data.ok === false) {
    return {
      error: mapTolovgoErrorMessage(
        upstreamRes.status,
        data,
        "TolovGo bilan hisob-faktura yaratib bo'lmadi."
      ),
    };
  }

  const orderId = String(data.order_id ?? data.orderId ?? data.id ?? '').trim();
  const payUrl = validateTolovgoPayUrl(data.pay_url ?? data.payUrl);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(orderId) || !payUrl) {
    return { error: "TolovGo noto'g'ri to'lov javobini qaytardi." };
  }

  const verifiedAmount = Number(data.amount);
  const finalAmount =
    Number.isFinite(verifiedAmount) && verifiedAmount >= 1000 ? Math.round(verifiedAmount) : amount;
  const isTest = Boolean(data.test) || cred.isTest;

  const rec: TolovgoOrderRecord = {
    orderId,
    amount: finalAmount,
    payUrl,
    status: normalizeTolovgoStatus(data.status),
    isTest,
    credited: false,
    createdAt: Date.now(),
    telegramId,
    chatId,
    method: providerHint,
  };
  await saveOrderRecord(rec);

  return { orderId, payUrl, amount: finalAmount, isTest };
}

async function notifyTelegramPaymentPaid(
  chatId: string,
  amount: number,
  orderId: string,
  isTest: boolean
): Promise<void> {
  if (!chatId || !getTelegramBotToken()) return;
  const text =
    `✅ <b>Balans to'ldirildi${isTest ? ' (Sinov)' : ''}!</b>\n\n` +
    `💵 Summa: <b>+${escapeTgHtml(formatSomServer(amount))}</b>\n` +
    `🧾 Buyurtma: <code>#${escapeTgHtml(orderId)}</code>`;
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }).catch(() => {});
}

// =========================================================================
// TolovGo (tolovgo.uz) UZS Payment Gateway Proxy Routes
// =========================================================================
app.get('/api/payments/tolovgo/config', async (_req, res) => {
  const activeMode = await getEffectiveTolovgoMode();
  const cred = resolveTolovgoCredential(activeMode);
  const hasLiveKey = Boolean(
    getCleanEnvKey(process.env.TOLOVGO_API_KEY, 'MY_TOLOVGO_API_KEY') ||
      getCleanEnvKey(process.env.TOLOVGO_KEY, 'MY_TOLOVGO_API_KEY')
  );
  const hasTestKey = Boolean(getCleanEnvKey(process.env.TOLOVGO_TEST_API, 'MY_TOLOVGO_TEST_API'));
  res.json({
    configured: Boolean(cred),
    isTestMode: Boolean(cred?.isTest),
    defaultMode: activeMode,
    hasLiveKey,
    hasTestKey,
    hasWebhookSecret: Boolean(getTolovgoWebhookSecret()),
    provider: 'TolovGo',
    currency: 'UZS',
  });
});

app.post('/api/payments/tolovgo/create', async (req, res) => {
  try {
    const body = (req.body || {}) as {
      amount?: unknown;
      providerHint?: unknown;
    };
    const activeMode = await getEffectiveTolovgoMode();
    const cred = resolveTolovgoCredential(activeMode);
    if (!cred) {
      res.status(503).json({
        error:
          activeMode === 'test'
            ? "TOLOVGO_TEST_API sozlanmagan. Admin yoki Vercel sozlamalarini tekshiring."
            : "TOLOVGO_API_KEY sozlanmagan. Vercel Environment Variables bo'limidan tolovgo.uz kalitingizni qo'shing.",
      });
      return;
    }
    const apiKey = cred.apiKey;
    const rawAmount = Number(body.amount);
    if (
      !Number.isFinite(rawAmount) ||
      !Number.isInteger(rawAmount) ||
      rawAmount < 1000 ||
      rawAmount > 99_999_999
    ) {
      res.status(400).json({
        error: "To'lov summasi 1 000 so'mdan 99 999 999 so'mgacha butun son bo'lishi kerak.",
      });
      return;
    }

    const tgUser = getAuthenticatedTelegramUser(req);
    if (tgUser) {
      const account = await getTgUserAccount(tgUser);
      if (account.isBanned) {
        res.status(403).json({ error: 'Hisobingiz administrator tomonidan bloklangan.' });
        return;
      }
    }

    const hint =
      typeof body.providerHint === 'string'
        ? body.providerHint.replace(/[^\w\s/()-]/g, '').trim().slice(0, 40)
        : '';
    const note = hint
      ? `SlaydCanva balans to'ldirish (${hint})`
      : "SlaydCanva balans to'ldirish";

    const origin = getPublicBaseOrigin(req);
    const callbackUrl = origin ? `${origin}/api/payments/tolovgo/callback` : undefined;
    const returnUrl = origin ? `${origin}/` : undefined;
    const baseUrl = getTolovgoBaseUrl();

    const formParams = new URLSearchParams();
    formParams.set('amount', String(rawAmount));
    formParams.set('note', note);
    if (callbackUrl) formParams.set('callback_url', callbackUrl);
    if (returnUrl) formParams.set('return_url', returnUrl);

    let upstreamRes = await fetch(`${baseUrl}/create`, {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (upstreamRes.status === 415) {
      upstreamRes = await fetch(`${baseUrl}/create`, {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          amount: rawAmount,
          note,
          ...(callbackUrl ? { callback_url: callbackUrl } : {}),
          ...(returnUrl ? { return_url: returnUrl } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });
    }

    const rawText = await upstreamRes.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      data = {};
    }

    if (!upstreamRes.ok || data.ok === false) {
      const msg = mapTolovgoErrorMessage(
        upstreamRes.status,
        data,
        "TolovGo bilan hisob-faktura yaratib bo'lmadi."
      );
      res.status(upstreamRes.status >= 400 && upstreamRes.status < 500 ? upstreamRes.status : 502).json({
        error: msg,
      });
      return;
    }

    const orderIdRaw = data.order_id ?? data.orderId ?? data.id;
    const orderId = orderIdRaw !== undefined && orderIdRaw !== null ? String(orderIdRaw).trim() : '';
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(orderId)) {
      res.status(502).json({ error: "TolovGo noto'g'ri buyurtma raqamini qaytardi." });
      return;
    }

    const payUrl = validateTolovgoPayUrl(data.pay_url ?? data.payUrl);
    if (!payUrl) {
      res.status(502).json({ error: "TolovGo xavfsiz to'lov havolasini qaytarmadi." });
      return;
    }

    const verifiedAmount = Number(data.amount);
    const finalAmount =
      Number.isFinite(verifiedAmount) && verifiedAmount >= 1000
        ? Math.round(verifiedAmount)
        : rawAmount;

    pruneOldTolovgoOrders();
    const rec: TolovgoOrderRecord = {
      orderId,
      amount: finalAmount,
      payUrl,
      status: normalizeTolovgoStatus(data.status),
      isTest: Boolean(data.test) || cred.isTest,
      credited: false,
      createdAt: Date.now(),
      telegramId: tgUser?.telegramId,
      chatId: tgUser?.chatId,
      method: hint ? `TolovGo · ${hint}` : 'TolovGo',
    };
    await saveOrderRecord(rec);

    res.status(201).json({
      ok: true,
      orderId,
      amount: finalAmount,
      payUrl,
      status: 'pending',
      test: rec.isTest,
      providers: data.providers && typeof data.providers === 'object' ? data.providers : {},
    });
  } catch (err) {
    console.error('[TolovGo Create Error]', err);
    res.status(502).json({
      error: "TolovGo serveri bilan bog'lanishda xatolik yuz berdi. Birozdan so'ng urinib ko'ring.",
    });
  }
});

app.get('/api/payments/tolovgo/status/:orderId', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(orderId)) {
      res.status(400).json({ error: "Noto'g'ri buyurtma raqami." });
      return;
    }

    const existing = await loadOrderRecord(orderId);
    const activeMode = await getEffectiveTolovgoMode();
    const orderIsTest = existing ? existing.isTest : activeMode === 'test';
    const cred = resolveTolovgoCredential(orderIsTest ? 'test' : 'live');
    if (!cred) {
      res.status(503).json({
        error: 'TOLOVGO_API_KEY yoki TOLOVGO_TEST_API sozlanmagan.',
      });
      return;
    }

    const tgUser = getAuthenticatedTelegramUser(req);
    if (existing?.telegramId && tgUser && existing.telegramId !== tgUser.telegramId && !isTelegramAdmin(tgUser.telegramId)) {
      res.status(403).json({ error: "Bu to'lov buyurtmasi boshqa foydalanuvchiga tegishli." });
      return;
    }

    const remote = await fetchRemoteTolovgoStatus(orderId, cred.apiKey);
    const trustedAmount = existing?.amount ?? remote.amount ?? 0;

    // Never allow a test order to credit real balance when site is in live mode
    const allowCredit = !cred.isTest || activeMode === 'test';

    let updatedBalance: number | undefined;
    let newlyCredited = false;
    if (remote.status === 'paid' && allowCredit) {
      const targetTgId = existing?.telegramId || tgUser?.telegramId;
      const targetChatId = existing?.chatId || tgUser?.chatId || targetTgId;

      if (targetTgId && targetChatId && trustedAmount >= 1000) {
        newlyCredited = await creditTgUserTopUp(
          targetTgId,
          targetChatId,
          trustedAmount,
          orderId,
          existing?.method || (cred.isTest ? 'TolovGo (Sinov)' : 'TolovGo'),
          cred.isTest
        );
        const rec: TolovgoOrderRecord = existing
          ? { ...existing, status: 'paid', credited: true, telegramId: targetTgId, chatId: targetChatId }
          : {
              orderId,
              amount: trustedAmount,
              payUrl: '',
              status: 'paid',
              isTest: cred.isTest,
              credited: true,
              createdAt: Date.now(),
              telegramId: targetTgId,
              chatId: targetChatId,
            };
        await saveOrderRecord(rec);
        const refreshed = await getTgUserAccount({
          telegramId: targetTgId,
          chatId: targetChatId,
          firstName: tgUser?.firstName || 'Foydalanuvchi',
        });
        updatedBalance = refreshed.balance;

        if (newlyCredited) {
          await Promise.all([
            notifyTelegramPaymentPaid(targetChatId, trustedAmount, orderId, cred.isTest),
            notifyPaymentToCrmAndStaff({
              orderId,
              telegramId: targetTgId,
              amount: trustedAmount,
              method: existing?.method || 'TolovGo',
              isTest: cred.isTest,
              source: 'Status Poll',
            }),
          ]);
        }
      } else if (existing) {
        existing.status = 'paid';
        if (!existing.credited && trustedAmount >= 1000) {
          existing.credited = true;
          newlyCredited = true;
        }
        await saveOrderRecord(existing);
      }
    } else if (existing) {
      existing.status = remote.status;
      await saveOrderRecord(existing);
    }

    res.json({
      ok: true,
      orderId,
      status: remote.status,
      paid: remote.status === 'paid' && allowCredit,
      newlyCredited,
      amount: trustedAmount,
      balance: updatedBalance,
    });
  } catch (err) {
    console.error('[TolovGo Status Error]', err);
    res.status(502).json({
      error: "To'lov holatini TolovGo serveridan tekshirib bo'lmadi.",
    });
  }
});

app.all('/api/payments/tolovgo/callback', async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const rawOrderId =
      req.query.order_id ??
      req.query.orderId ??
      body.order_id ??
      body.orderId ??
      '';
    const orderId = String(rawOrderId).trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(orderId)) {
      res.status(400).json({ ok: false, error: 'Invalid order_id' });
      return;
    }

    // Verify TOLOVGO_WEBHOOK_SECRET signature if configured in environment
    const sigCheck = verifyTolovgoWebhookSignature(req, orderId, body);
    if (sigCheck.configured && !sigCheck.valid) {
      await recordCrmEventSafe({
        eventType: 'security_alert',
        title: `TolovGo webhook signatura xatosi (#${orderId})`,
        message: sigCheck.provided
          ? `Buyurtma #${orderId} uchun noto'g'ri webhook signaturasi yuborildi.`
          : `Buyurtma #${orderId} uchun webhook signaturasi yuborilmadi.`,
      });
      res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
      return;
    }

    const existing = await loadOrderRecord(orderId);
    const activeMode = await getEffectiveTolovgoMode();
    const orderIsTest = existing ? existing.isTest : activeMode === 'test';
    const cred = resolveTolovgoCredential(orderIsTest ? 'test' : 'live');
    if (!cred) {
      res.status(503).json({ ok: false, error: 'Not configured' });
      return;
    }

    // Always verify callback server-to-server via TolovGo GET /status/{order_id}
    const remote = await fetchRemoteTolovgoStatus(orderId, cred.apiKey);
    const trustedAmount = existing?.amount ?? remote.amount ?? 0;
    const allowCredit = !cred.isTest || activeMode === 'test';

    if (existing) {
      existing.status = remote.status;
      if (
        remote.status === 'paid' &&
        allowCredit &&
        trustedAmount >= 1000 &&
        existing.telegramId &&
        existing.chatId
      ) {
        const wasNew = await creditTgUserTopUp(
          existing.telegramId,
          existing.chatId,
          trustedAmount,
          orderId,
          existing.method || (existing.isTest ? 'TolovGo (Sinov)' : 'TolovGo'),
          existing.isTest
        );
        existing.credited = true;
        await saveOrderRecord(existing);
        if (wasNew) {
          await Promise.all([
            notifyTelegramPaymentPaid(
              existing.chatId,
              trustedAmount,
              orderId,
              existing.isTest
            ),
            notifyPaymentToCrmAndStaff({
              orderId,
              telegramId: existing.telegramId,
              amount: trustedAmount,
              method: existing.method || 'TolovGo',
              isTest: existing.isTest,
              source: sigCheck.configured ? 'Webhook (Signatura tasdiqlangan)' : 'Webhook',
            }),
          ]);
        }
      } else {
        if (remote.status === 'paid' && allowCredit) existing.credited = true;
        await saveOrderRecord(existing);
      }
    } else if (remote.amount) {
      const rec: TolovgoOrderRecord = {
        orderId,
        amount: remote.amount,
        payUrl: '',
        status: remote.status,
        isTest: cred.isTest,
        credited: remote.status === 'paid' && allowCredit,
        createdAt: Date.now(),
      };
      await saveOrderRecord(rec);
    }

    res.json({ ok: true, orderId, status: remote.status, signatureVerified: sigCheck.valid });
  } catch (err) {
    console.error('[TolovGo Callback Error]', err);
    res.status(500).json({ ok: false });
  }
});

// =========================================================================
// Telegram Bot & Auth Routes
// =========================================================================
app.get('/api/db/status', async (_req, res) => {
  const neonStatus = await dbGetDbStatus();
  res.json({
    driver: getStorageDriver(),
    configured: hasPersistentStorage(),
    neonConfigured: neonStatus.configured,
    tablesReady: neonStatus.ready,
  });
});

app.get('/api/pricing', async (req, res) => {
  const [pricing, tolovgoMode, siteConfig] = await Promise.all([
    getEffectivePricingSettings(),
    getEffectiveTolovgoMode(),
    getEffectiveSiteConfig(),
  ]);
  const origin = getPreferredPublicOrigin(req);
  const token = getTelegramBotToken();
  const botUsername = token ? await resolveTelegramBotUsername() : null;
  res.json({
    ok: true,
    pricing,
    tolovgoMode,
    botUsername,
    tolovgoCallbackUrl: `${origin}/api/payments/tolovgo/callback`,
    siteConfig,
  });
});

// Promo code redemption (authenticated users)
app.post('/api/promo/redeem', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Promokod ishlatish uchun avval Telegram orqali kiring.' });
    return;
  }
  const code =
    typeof req.body?.code === 'string'
      ? req.body.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
      : '';
  if (!code || code.length < 3) {
    res.status(400).json({ error: "Promokod kamida 3 ta belgidan iborat bo'lishi kerak." });
    return;
  }

  const account = await getTgUserAccount(user);
  if (account.isBanned) {
    res.status(403).json({ error: 'Hisobingiz administrator tomonidan bloklangan.' });
    return;
  }

  const dbRes = await dbRedeemPromoCode({
    code,
    telegramId: user.telegramId,
    dateLabel: formatUzDate(),
  });

  if (dbRes === null) {
    // KV fallback
    const promos = (await kvGet<DbPromoCode[]>('app_promo_codes')) || [];
    const found = promos.find((p) => p.code === code);
    if (!found || !found.isActive || found.usedCount >= found.maxUses) {
      res.status(400).json({ error: "Promokod topilmadi, faol emas yoki limiti to'lgan." });
      return;
    }
    const usedKey = `promo_used:${code}:${user.telegramId}`;
    if (await kvGet<boolean>(usedKey)) {
      res.status(400).json({ error: 'Siz bu promokoddan allaqachon foydalangansiz.' });
      return;
    }
    await kvSet(usedKey, true);
    found.usedCount += 1;
    await kvSet('app_promo_codes', promos);
    account.balance += found.bonusAmount;
    account.transactions.unshift({
      id: `promo_${code}_${user.telegramId}`,
      title: `Promokod: ${code}`,
      method: 'Promokod',
      amount: found.bonusAmount,
      date: formatUzDate(),
    });
    await saveTgUserAccount(account);
    await recordCrmEventSafe({
      eventType: 'promo_redeemed',
      title: `Promokod ishlatildi: ${code}`,
      message: `${user.firstName} (${user.telegramId}) +${formatSomServer(found.bonusAmount)} oldi`,
      userId: user.telegramId,
      amount: found.bonusAmount,
    });
    res.json({ ok: true, bonusAmount: found.bonusAmount, balance: account.balance });
    return;
  }

  if (!dbRes.ok) {
    res.status(400).json({ error: dbRes.error });
    return;
  }

  await recordCrmEventSafe({
    eventType: 'promo_redeemed',
    title: `Promokod ishlatildi: ${code}`,
    message: `${user.firstName} (${user.telegramId}) +${formatSomServer(dbRes.bonusAmount)} oldi`,
    userId: user.telegramId,
    amount: dbRes.bonusAmount,
  });

  res.json({ ok: true, bonusAmount: dbRes.bonusAmount, balance: dbRes.balance });
});

// =========================================================================
// Admin & Manager Panel CRM Routes (15-Day Cookie + RBAC + 20 Systems)
// =========================================================================
app.get('/api/admin/status', async (req, res) => {
  const ctx = await requireStaffTelegram(req, res);
  if (!ctx) return;

  const { user, staff } = ctx;
  const storedHash = await getAdminPasswordHash();
  const { token: rawAdminToken } = extractAdminTokenFromRequest(req);
  const adminPayload = verifySignedToken(rawAdminToken);
  const adminUnlocked = Boolean(
    adminPayload &&
      adminPayload.kind === 'admin_session' &&
      typeof adminPayload.tid === 'string' &&
      safeTimingEqual(adminPayload.tid, user.telegramId)
  );
  const origin = getPreferredPublicOrigin(req);

  const passwordRequiredForManager =
    staff.role === 'manager'
      ? Boolean(staff.managerRecord?.hasPassword || storedHash)
      : Boolean(storedHash);

  res.json({
    ok: true,
    isAdmin: staff.role === 'super_admin',
    isManager: staff.role === 'manager',
    staffRole: staff.role,
    permissions: staff.permissions,
    passwordConfigured: passwordRequiredForManager,
    adminUnlocked,
    adminToken: adminUnlocked ? rawAdminToken : undefined,
    tolovgoCallbackUrl: `${origin}/api/payments/tolovgo/callback`,
    telegramWebhookUrl: `${origin}/api/telegram/webhook`,
  });
});

app.post('/api/admin/setup-password', async (req, res) => {
  const ctx = await requireStaffTelegram(req, res);
  if (!ctx) return;
  if (ctx.staff.role !== 'super_admin') {
    res.status(403).json({ error: "Birinchi parolni faqat Super Admin o'rnata oladi." });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: "Parol kamida 8 ta belgidan iborat bo'lishi kerak." });
    return;
  }

  const passwordHash = hashAdminPassword(password);
  const claimRes = await dbClaimAdminPasswordIfUnset(passwordHash);
  if (claimRes === 'already_set') {
    res.status(409).json({ error: "Admin paroli allaqachon o'rnatilgan. Kirish formasi orqali kiring." });
    return;
  }
  if (claimRes === 'unavailable') {
    const existingKv = await kvGet<{ passwordHash?: string }>('app_settings:admin_auth');
    if (existingKv?.passwordHash) {
      res.status(409).json({ error: "Admin paroli allaqachon o'rnatilgan." });
      return;
    }
    await kvSet('app_settings:admin_auth', { passwordHash, updatedAt: Date.now() });
  } else {
    await kvSet('app_settings:admin_auth', { passwordHash, updatedAt: Date.now() });
  }

  await dbAppendAuditLog({
    id: `aud_adm_setup_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_password_setup',
    details: "1-marta kirishda admin maxfiy paroli o'rnatildi",
  });

  const adminToken = issueAdminCookieAndToken(req, res, ctx.user.telegramId, 'super_admin');
  res.json({ ok: true, adminToken, staffRole: 'super_admin', permissions: ctx.staff.permissions });
});

app.post('/api/admin/login', async (req, res) => {
  const ctx = await requireStaffTelegram(req, res);
  if (!ctx) return;
  const { user, staff } = ctx;

  if (!checkAdminLoginAllowed(user.telegramId)) {
    res.status(429).json({ error: "Juda ko'p noto'g'ri urinish. 15 daqiqadan so'ng urinib ko'ring." });
    return;
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const globalHash = await getAdminPasswordHash();
  const mgrHash = staff.managerRecord?.passwordHash || null;

  if (staff.role === 'super_admin' && !globalHash) {
    res.status(409).json({ error: "Hali admin paroli o'rnatilmagan.", code: 'password_not_set' });
    return;
  }

  let valid = false;
  if (staff.role === 'manager' && mgrHash) {
    valid = verifyAdminPassword(password, mgrHash);
  } else if (globalHash) {
    valid = verifyAdminPassword(password, globalHash);
  }

  if (!valid) {
    recordAdminLoginFailure(user.telegramId);
    res.status(401).json({ error: "Maxfiy panel paroli noto'g'ri." });
    return;
  }

  clearAdminLoginFailures(user.telegramId);
  await dbAppendAuditLog({
    id: `aud_adm_login_${Date.now().toString(36)}`,
    actorId: user.telegramId,
    action: staff.role === 'manager' ? 'manager_login' : 'admin_login',
    details: `${staff.role === 'manager' ? 'Menejer' : 'Admin'} panelga 15 kunlik sessiya bilan kirdi`,
  });

  const adminToken = issueAdminCookieAndToken(
    req,
    res,
    user.telegramId,
    staff.role === 'manager' ? 'manager' : 'super_admin'
  );
  res.json({
    ok: true,
    adminToken,
    staffRole: staff.role,
    permissions: staff.permissions,
  });
});

app.post('/api/admin/logout', (req, res) => {
  clearAdminCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/admin/change-password', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'super_admin');
  if (!ctx) return;

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak." });
    return;
  }

  const storedHash = await getAdminPasswordHash();
  if (!storedHash || !verifyAdminPassword(currentPassword, storedHash)) {
    res.status(401).json({ error: "Joriy admin paroli noto'g'ri." });
    return;
  }

  const nextHash = hashAdminPassword(newPassword);
  await Promise.all([
    dbSetSetting('admin_auth', { passwordHash: nextHash, updatedAt: Date.now() }),
    kvSet('app_settings:admin_auth', { passwordHash: nextHash, updatedAt: Date.now() }),
  ]);

  await dbAppendAuditLog({
    id: `aud_adm_pwd_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_password_changed',
    details: 'Admin paroli yangilandi',
  });

  res.json({ ok: true });
});

app.get('/api/admin/overview', async (req, res) => {
  const ctx = await requireStaffSession(req, res);
  if (!ctx) return;

  const [overview, orders, auditLogs, pricing, tolovgoMode, dbStatus, siteConfig, managers, crmEvents] =
    await Promise.all([
      dbGetAdminOverview(),
      dbListOrdersAdmin(60),
      dbListAuditLogs(60),
      getEffectivePricingSettings(),
      getEffectiveTolovgoMode(),
      dbGetDbStatus(),
      getEffectiveSiteConfig(),
      listManagersAll(),
      dbListCrmEvents(50),
    ]);

  const kvCrm = !crmEvents ? (await kvGet<DbCrmEvent[]>('app_crm_events')) || [] : crmEvents;
  const hasLiveKey = Boolean(
    getCleanEnvKey(process.env.TOLOVGO_API_KEY, 'MY_TOLOVGO_API_KEY') ||
      getCleanEnvKey(process.env.TOLOVGO_KEY, 'MY_TOLOVGO_API_KEY')
  );
  const hasTestKey = Boolean(getCleanEnvKey(process.env.TOLOVGO_TEST_API, 'MY_TOLOVGO_TEST_API'));
  const hasWebhookSecret = Boolean(getTolovgoWebhookSecret());
  const origin = getPreferredPublicOrigin(req);

  res.json({
    ok: true,
    staffRole: ctx.staff.role,
    permissions: ctx.staff.permissions,
    overview: overview || {
      totalUsers: 0,
      bannedUsers: 0,
      totalBalance: 0,
      totalPaidOrders: 0,
      totalPaidRevenue: 0,
      totalReferrals: 0,
      totalProjects: 0,
      activeManagers: managers.filter((m) => m.isActive).length,
      unreadCrmEvents: kvCrm.filter((e) => !e.isRead).length,
      todayRevenue: 0,
      todayNewUsers: 0,
    },
    orders: orders || Array.from(tolovgoOrders.values()).slice(0, 60),
    auditLogs: auditLogs || [],
    pricing,
    tolovgoMode,
    siteConfig,
    managers: managers.map((m) => ({ ...m, passwordHash: undefined })),
    crmEvents: kvCrm,
    hasLiveKey,
    hasTestKey,
    hasWebhookSecret,
    neonConfigured: dbStatus.configured,
    tablesReady: dbStatus.ready,
    tolovgoCallbackUrl: `${origin}/api/payments/tolovgo/callback`,
    telegramWebhookUrl: `${origin}/api/telegram/webhook`,
  });
});

app.get('/api/admin/analytics', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'overview');
  if (!ctx) return;
  const days = Math.min(30, Math.max(7, Number(req.query.days) || 14));
  const data = await dbGetAdminAnalytics(days);
  res.json({
    ok: true,
    analytics: data || { daily: [], topSpenders: [], serviceBreakdown: [] },
  });
});

app.get('/api/admin/crm-events', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'crm_events');
  if (!ctx) return;
  const events = (await dbListCrmEvents(80)) || (await kvGet<DbCrmEvent[]>('app_crm_events')) || [];
  res.json({ ok: true, events });
});

app.post('/api/admin/crm-events/read', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'crm_events');
  if (!ctx) return;
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]).map(String) : undefined;
  await dbMarkCrmEventsRead(ids);
  const kvEvents = (await kvGet<DbCrmEvent[]>('app_crm_events')) || [];
  if (kvEvents.length > 0) {
    const idSet = ids ? new Set(ids) : null;
    await kvSet(
      'app_crm_events',
      kvEvents.map((e) => (!idSet || idSet.has(e.id) ? { ...e, isRead: true } : e))
    );
  }
  res.json({ ok: true });
});

app.get('/api/admin/managers', async (req, res) => {
  const ctx = await requireStaffSession(req, res);
  if (!ctx) return;
  const managers = await listManagersAll();
  res.json({
    ok: true,
    managers: managers.map((m) => ({ ...m, passwordHash: undefined })),
  });
});

app.post('/api/admin/managers', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'super_admin');
  if (!ctx) return;

  const tid = String(req.body?.telegramId || '').trim();
  if (!/^\d{3,20}$/.test(tid)) {
    res.status(400).json({ error: "Menejer Telegram ID raqami noto'g'ri (masalan: 123456789)." });
    return;
  }
  if (isTelegramAdmin(tid)) {
    res.status(400).json({ error: 'Bu ID allaqachon Super Admin hisoblanadi.' });
    return;
  }

  const firstName =
    typeof req.body?.firstName === 'string' && req.body.firstName.trim()
      ? req.body.firstName.trim().slice(0, 60)
      : `Menejer ${tid.slice(-4)}`;
  const username =
    typeof req.body?.username === 'string' && req.body.username.trim()
      ? req.body.username.trim().replace(/^@+/, '').slice(0, 50)
      : undefined;
  const roleTitle =
    typeof req.body?.roleTitle === 'string' && req.body.roleTitle.trim()
      ? req.body.roleTitle.trim().slice(0, 40)
      : 'CRM Menejer';
  const rawPerms = Array.isArray(req.body?.permissions) ? req.body.permissions : ALL_MANAGER_PERMISSIONS;
  const permissions = rawPerms.filter((p: unknown): p is DbManagerPermission =>
    ALL_MANAGER_PERMISSIONS.includes(p as DbManagerPermission)
  );
  const rawPwd = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  if (rawPwd && (rawPwd.length < 6 || rawPwd.length > 128)) {
    res.status(400).json({ error: "Menejer paroli kamida 6 ta belgidan iborat bo'lishi kerak." });
    return;
  }
  const passwordHash = rawPwd ? hashAdminPassword(rawPwd) : undefined;
  const isActive = req.body?.isActive !== false;
  const notifyTelegram = req.body?.notifyTelegram !== false;

  const saved = await dbUpsertManager({
    telegramId: tid,
    firstName,
    username,
    roleTitle,
    permissions: permissions.length ? permissions : ['overview', 'crm_events', 'users', 'orders'],
    passwordHash,
    isActive,
    notifyTelegram,
    addedBy: ctx.user.telegramId,
  });

  const existingKv = (await kvGet<DbManagerRecord[]>('app_managers_list')) || [];
  const prevKv = existingKv.find((m) => m.telegramId === tid);
  const nextRecord: DbManagerRecord = saved
    ? { ...saved, passwordHash: passwordHash ?? prevKv?.passwordHash }
    : {
        telegramId: tid,
        firstName,
        username,
        roleTitle,
        permissions: permissions.length ? permissions : ['overview', 'crm_events', 'users', 'orders'],
        passwordHash: passwordHash ?? prevKv?.passwordHash,
        hasPassword: Boolean(passwordHash ?? prevKv?.passwordHash),
        isActive,
        notifyTelegram,
        addedBy: ctx.user.telegramId,
        createdAt: prevKv?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
  await kvSet('app_managers_list', [
    nextRecord,
    ...existingKv.filter((m) => m.telegramId !== tid),
  ]);

  await Promise.all([
    dbAppendAuditLog({
      id: `aud_mgr_${Date.now().toString(36)}`,
      actorId: ctx.user.telegramId,
      action: 'admin_manager_upsert',
      targetId: tid,
      details: `Menejer ${firstName} (${isActive ? 'Faol' : 'O‘chirilgan'})`,
    }),
    recordCrmEventSafe({
      eventType: 'manager_changed',
      title: `Menejer yangilandi: ${firstName}`,
      message: `ID ${tid} · Lavozim: ${roleTitle} · Holat: ${isActive ? 'Faol' : 'Nofaol'}`,
      userId: tid,
    }),
  ]);

  if (notifyTelegram && isActive && getTelegramBotToken()) {
    await telegramApi('sendMessage', {
      chat_id: tid,
      text:
        `🛡 <b>Siz SlaydCanva CRM Menejer etib tayinlandingiz!</b>\n\n` +
        `👤 Lavozim: <b>${escapeTgHtml(roleTitle)}</b>\n` +
        `Endi saytda Admin/Menejer paneliga kirishingiz va Telegram orqali yangi foydalanuvchi hamda to'lov bildirishnomalarini qabul qilishingiz mumkin.`,
      parse_mode: 'HTML',
    }).catch(() => {});
  }

  res.json({ ok: true, manager: { ...nextRecord, passwordHash: undefined } });
});

app.delete('/api/admin/managers/:id', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'super_admin');
  if (!ctx) return;
  const tid = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(tid)) {
    res.status(400).json({ error: "Noto'g'ri menejer ID." });
    return;
  }
  await dbDeleteManager(tid);
  const existingKv = (await kvGet<DbManagerRecord[]>('app_managers_list')) || [];
  await kvSet(
    'app_managers_list',
    existingKv.filter((m) => m.telegramId !== tid)
  );
  await dbAppendAuditLog({
    id: `aud_mgr_del_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_manager_deleted',
    targetId: tid,
    details: `Menejer ID ${tid} o'chirildi`,
  });
  res.json({ ok: true });
});

app.get('/api/admin/users', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'users');
  if (!ctx) return;
  const search = typeof req.query.q === 'string' ? req.query.q : '';
  const users = await dbListUsersAdmin(search, 180);
  res.json({ ok: true, users: users || [] });
});

app.get('/api/admin/users/:id/detail', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'users');
  if (!ctx) return;
  const tid = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(tid)) {
    res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
    return;
  }
  const detail = await dbGetUserDetailAdmin(tid);
  if (!detail) {
    res.status(404).json({ error: "Foydalanuvchi ma'lumotlari topilmadi." });
    return;
  }
  res.json({ ok: true, detail });
});

app.post('/api/admin/users/:id/crm', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'users');
  if (!ctx) return;
  const tid = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(tid)) {
    res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
    return;
  }
  const crmTag = typeof req.body?.crmTag === 'string' ? req.body.crmTag.trim().slice(0, 32) : '';
  const crmNote = typeof req.body?.crmNote === 'string' ? req.body.crmNote.trim().slice(0, 500) : '';
  const ok = await dbUpdateUserCrm(tid, crmTag, crmNote);
  if (!ok) {
    res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
    return;
  }
  await dbAppendAuditLog({
    id: `aud_crm_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'staff_crm_note_updated',
    targetId: tid,
    details: `Teg: ${crmTag || '—'} · Izoh yangilandi`,
  });
  res.json({ ok: true, crmTag, crmNote });
});

app.post('/api/admin/users/:id/message', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'users');
  if (!ctx) return;
  const tid = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(tid)) {
    res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID." });
    return;
  }
  const rawText = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!rawText) {
    res.status(400).json({ error: "Xabar matnini kiriting." });
    return;
  }
  if (!getTelegramBotToken()) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' });
    return;
  }

  const sent = await telegramApi('sendMessage', {
    chat_id: tid,
    text: `💬 <b>SlaydCanva Qo'llab-quvvatlash xizmati</b>\n\n${escapeTgHtml(rawText.slice(0, 1500))}`,
    parse_mode: 'HTML',
  });
  if (!sent.ok) {
    res.status(502).json({ error: sent.description || 'Telegram xabar yuborilmadi.' });
    return;
  }

  await dbAppendAuditLog({
    id: `aud_dm_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'staff_direct_message',
    targetId: tid,
    details: rawText.slice(0, 140),
  });
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/balance', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'balance');
  if (!ctx) return;
  const admin = ctx.user;
  const targetId = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(targetId)) {
    res.status(400).json({ error: "Noto'g'ri Telegram foydalanuvchi ID." });
    return;
  }

  const rawDelta = Number(req.body?.delta);
  if (!Number.isFinite(rawDelta) || !Number.isInteger(rawDelta) || rawDelta === 0 || Math.abs(rawDelta) > 50_000_000) {
    res.status(400).json({ error: "Summa nolga teng bo'lmagan butun son (50 mln gacha) bo'lishi kerak." });
    return;
  }

  const actorLabel = ctx.staff.role === 'manager' ? 'Menejer' : 'Admin';
  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 140)
      : rawDelta > 0
        ? `${actorLabel} tomonidan balans to'ldirildi`
        : `${actorLabel} tomonidan balans tuzatildi`;

  const result = await dbAdminAdjustBalance({
    adminId: admin.telegramId,
    targetTelegramId: targetId,
    delta: rawDelta,
    reason,
    dateLabel: formatUzDate(),
  });

  if (!result) {
    const kvKey = `tg_user:${targetId}`;
    const existing = await kvGet<TgUserAccount>(kvKey);
    if (!existing) {
      res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
      return;
    }
    existing.balance = Math.max(0, existing.balance + rawDelta);
    existing.transactions.unshift({
      id: `adm_${Date.now().toString(36)}`,
      title: reason,
      method: actorLabel,
      amount: rawDelta,
      date: formatUzDate(),
    });
    await saveTgUserAccount(existing);
    await recordCrmEventSafe({
      eventType: 'balance_adjusted',
      title: `Balans o'zgartirildi: ${rawDelta > 0 ? '+' : '-'}${formatSomServer(Math.abs(rawDelta))}`,
      message: `${actorLabel} (${admin.telegramId}) -> ID ${targetId} · ${reason}`,
      userId: targetId,
      amount: rawDelta,
    });
    res.json({ ok: true, balance: existing.balance });
    return;
  }

  await recordCrmEventSafe({
    eventType: 'balance_adjusted',
    title: `Balans o'zgartirildi: ${rawDelta > 0 ? '+' : '-'}${formatSomServer(Math.abs(rawDelta))}`,
    message: `${actorLabel} (${admin.telegramId}) -> ID ${targetId} · ${reason}`,
    userId: targetId,
    amount: rawDelta,
  });

  if (req.body?.notify !== false && result.chatId && getTelegramBotToken()) {
    const sign = rawDelta > 0 ? '+' : '-';
    await telegramApi('sendMessage', {
      chat_id: result.chatId,
      text:
        `💳 <b>Balans yangilandi (${actorLabel})</b>\n\n` +
        `💵 O'zgarish: <b>${sign}${escapeTgHtml(formatSomServer(Math.abs(rawDelta)))}</b>\n` +
        `📝 Izoh: ${escapeTgHtml(reason)}\n` +
        `💰 Yangi balans: <b>${escapeTgHtml(formatSomServer(result.balance))}</b>`,
      parse_mode: 'HTML',
    }).catch(() => {});
  }

  res.json({ ok: true, balance: result.balance });
});

app.post('/api/admin/users/:id/ban', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'users');
  if (!ctx) return;
  const admin = ctx.user;
  const targetId = String(req.params.id || '').trim();
  if (!/^\d{3,20}$/.test(targetId) || targetId === admin.telegramId || isTelegramAdmin(targetId)) {
    res.status(400).json({ error: "Noto'g'ri foydalanuvchi ID yoki Adminni bloklab bo'lmaydi." });
    return;
  }
  const isBanned = Boolean(req.body?.isBanned);
  const ok = await dbSetUserBanned(admin.telegramId, targetId, isBanned);
  if (!ok) {
    const kvKey = `tg_user:${targetId}`;
    const existing = await kvGet<TgUserAccount>(kvKey);
    if (!existing) {
      res.status(404).json({ error: 'Foydalanuvchi topilmadi.' });
      return;
    }
    existing.isBanned = isBanned;
    await saveTgUserAccount(existing);
  }
  await recordCrmEventSafe({
    eventType: 'user_banned',
    title: isBanned ? `Foydalanuvchi bloklandi` : `Foydalanuvchi blokdan chiqarildi`,
    message: `ID ${targetId} · Bajaruvchi: ${admin.telegramId}`,
    userId: targetId,
  });
  res.json({ ok: true, isBanned });
});

app.get('/api/admin/orders', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'orders');
  if (!ctx) return;
  const orders = await dbListOrdersAdmin(150);
  res.json({ ok: true, orders: orders || Array.from(tolovgoOrders.values()) });
});

app.post('/api/admin/orders/verify', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'orders');
  if (!ctx) return;
  const orderId = String(req.body?.orderId || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(orderId)) {
    res.status(400).json({ error: "Noto'g'ri buyurtma raqami." });
    return;
  }
  const existing = await loadOrderRecord(orderId);
  const activeMode = await getEffectiveTolovgoMode();
  const orderIsTest = existing ? existing.isTest : activeMode === 'test';
  const cred = resolveTolovgoCredential(orderIsTest ? 'test' : 'live');
  if (!cred) {
    res.status(503).json({ error: 'TOLOVGO_API_KEY yoki TOLOVGO_TEST_API sozlanmagan.' });
    return;
  }

  try {
    const remote = await fetchRemoteTolovgoStatus(orderId, cred.apiKey);
    const trustedAmount = existing?.amount ?? remote.amount ?? 0;
    const allowCredit = !cred.isTest || activeMode === 'test';
    let newlyCredited = false;

    if (remote.status === 'paid' && allowCredit && existing?.telegramId && trustedAmount >= 1000) {
      newlyCredited = await creditTgUserTopUp(
        existing.telegramId,
        existing.chatId || existing.telegramId,
        trustedAmount,
        orderId,
        existing.method || 'TolovGo',
        cred.isTest
      );
      existing.status = 'paid';
      existing.credited = true;
      await saveOrderRecord(existing);
      if (newlyCredited) {
        await Promise.all([
          notifyTelegramPaymentPaid(
            existing.chatId || existing.telegramId,
            trustedAmount,
            orderId,
            cred.isTest
          ),
          notifyPaymentToCrmAndStaff({
            orderId,
            telegramId: existing.telegramId,
            amount: trustedAmount,
            method: existing.method || 'TolovGo',
            isTest: cred.isTest,
            source: `Admin Sinxronizatsiya (${ctx.user.telegramId})`,
          }),
        ]);
      }
    } else if (existing) {
      existing.status = remote.status;
      await saveOrderRecord(existing);
    }

    res.json({
      ok: true,
      orderId,
      status: remote.status,
      amount: trustedAmount,
      newlyCredited,
    });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "TolovGo bilan tekshirib bo'lmadi.",
    });
  }
});

app.post('/api/admin/pricing', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'pricing');
  if (!ctx) return;
  const saved = await savePricingSettings(req.body as AppPricingSettings);
  await dbAppendAuditLog({
    id: `aud_price_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_pricing_updated',
    details: `Narxlar va bonuslar yangilandi (Welcome: ${saved.welcomeBonus}, Ref: ${saved.referralInviterBonus})`,
  });
  res.json({ ok: true, pricing: saved });
});

app.post('/api/admin/settings', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'settings');
  if (!ctx) return;
  const nextMode = req.body?.tolovgoMode === 'test' ? 'test' : 'live';
  await savePaymentConfigSettings(nextMode);
  await dbAppendAuditLog({
    id: `aud_cfg_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_tolovgo_mode',
    details: `TolovGo rejimi: ${nextMode}`,
  });
  res.json({ ok: true, tolovgoMode: nextMode });
});

app.get('/api/admin/site-config', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'settings');
  if (!ctx) return;
  const siteConfig = await getEffectiveSiteConfig();
  res.json({ ok: true, siteConfig });
});

app.post('/api/admin/site-config', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'settings');
  if (!ctx) return;
  const saved = await saveSiteConfig((req.body || {}) as Partial<SiteConfigSettings>);
  await dbAppendAuditLog({
    id: `aud_site_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'admin_site_config',
    details: `Texnik rejim: ${saved.maintenanceMode ? 'Yoqilgan' : 'O‘chirilgan'}`,
  });
  res.json({ ok: true, siteConfig: saved });
});

app.get('/api/admin/promos', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'promos');
  if (!ctx) return;
  const promos = (await dbListPromoCodes()) || (await kvGet<DbPromoCode[]>('app_promo_codes')) || [];
  res.json({ ok: true, promos });
});

app.post('/api/admin/promos', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'promos');
  if (!ctx) return;
  const rawCode =
    typeof req.body?.code === 'string'
      ? req.body.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32)
      : '';
  if (rawCode.length < 3) {
    res.status(400).json({ error: "Promokod kamida 3 ta harf/raqamdan iborat bo'lishi kerak." });
    return;
  }
  const bonusAmount = Math.round(Number(req.body?.bonusAmount) || 0);
  const maxUses = Math.round(Number(req.body?.maxUses) || 50);
  if (bonusAmount < 500 || bonusAmount > 1_000_000) {
    res.status(400).json({ error: "Bonus summasi 500 dan 1 000 000 so'mgacha bo'lishi kerak." });
    return;
  }
  const isActive = req.body?.isActive !== false;
  const expiresDays = Number(req.body?.expiresDays);
  const expiresAt =
    Number.isFinite(expiresDays) && expiresDays > 0
      ? Date.now() + Math.min(365, expiresDays) * 86_400_000
      : null;

  const saved = await dbUpsertPromoCode({
    code: rawCode,
    bonusAmount,
    maxUses,
    isActive,
    expiresAt,
    createdBy: ctx.user.telegramId,
  });

  const existingKv = (await kvGet<DbPromoCode[]>('app_promo_codes')) || [];
  const promoObj: DbPromoCode = saved || {
    code: rawCode,
    bonusAmount,
    maxUses,
    usedCount: existingKv.find((p) => p.code === rawCode)?.usedCount || 0,
    isActive,
    expiresAt,
    createdBy: ctx.user.telegramId,
    createdAt: Date.now(),
  };
  await kvSet('app_promo_codes', [promoObj, ...existingKv.filter((p) => p.code !== rawCode)]);

  await dbAppendAuditLog({
    id: `aud_promo_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    action: 'staff_promo_upsert',
    targetId: rawCode,
    amount: bonusAmount,
    details: `Promokod ${rawCode}: +${formatSomServer(bonusAmount)} (limit ${maxUses})`,
  });

  res.json({ ok: true, promo: promoObj });
});

app.delete('/api/admin/promos/:code', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'promos');
  if (!ctx) return;
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!code) {
    res.status(400).json({ error: 'Kod kiriting.' });
    return;
  }
  await dbDeletePromoCode(code);
  const existingKv = (await kvGet<DbPromoCode[]>('app_promo_codes')) || [];
  await kvSet(
    'app_promo_codes',
    existingKv.filter((p) => p.code !== code)
  );
  res.json({ ok: true });
});

app.get('/api/admin/broadcasts', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'broadcast');
  if (!ctx) return;
  const logs =
    (await dbListBroadcastLogs(30)) ||
    (await kvGet<DbBroadcastLog[]>('app_broadcast_logs')) ||
    [];
  res.json({ ok: true, logs });
});

app.post('/api/admin/broadcast', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'broadcast');
  if (!ctx) return;
  if (!getTelegramBotToken()) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' });
    return;
  }
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 3 || message.length > 2000) {
    res.status(400).json({ error: "Xabar matni 3 dan 2000 tagacha belgi bo'lishi kerak." });
    return;
  }
  const segmentRaw = String(req.body?.segment || 'all');
  const segment: 'all' | 'active' | 'vip' | 'zero_balance' =
    segmentRaw === 'vip' || segmentRaw === 'zero_balance' || segmentRaw === 'active'
      ? segmentRaw
      : 'all';

  const targets = (await dbListBroadcastTargets(segment)) || [];
  if (targets.length === 0) {
    res.status(404).json({ error: 'Ushbu segmentda foydalanuvchilar topilmadi.' });
    return;
  }

  let sentCount = 0;
  let failedCount = 0;
  const cleanHtml = escapeTgHtml(message);

  // Send in small sequential batches to respect Telegram rate limits
  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    const results = await Promise.allSettled(
      batch.map((t) =>
        telegramApi('sendMessage', {
          chat_id: t.chatId,
          text: `📢 <b>SlaydCanva Yangilik</b>\n\n${cleanHtml}`,
          parse_mode: 'HTML',
        })
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) sentCount++;
      else failedCount++;
    }
  }

  const logEntry: DbBroadcastLog = {
    id: `bc_${Date.now().toString(36)}`,
    actorId: ctx.user.telegramId,
    targetSegment: segment,
    message: message.slice(0, 600),
    totalTargets: targets.length,
    sentCount,
    failedCount,
    createdAt: Date.now(),
  };
  await dbLogBroadcast(logEntry);
  const existingBc = (await kvGet<DbBroadcastLog[]>('app_broadcast_logs')) || [];
  await kvSet('app_broadcast_logs', [logEntry, ...existingBc].slice(0, 30));

  await Promise.all([
    dbAppendAuditLog({
      id: `aud_bc_${Date.now().toString(36)}`,
      actorId: ctx.user.telegramId,
      action: 'staff_broadcast_sent',
      amount: sentCount,
      details: `Segment: ${segment} · Yuborildi: ${sentCount}/${targets.length}`,
    }),
    recordCrmEventSafe({
      eventType: 'broadcast_sent',
      title: `Ommaviy xabarnoma yuborildi (${sentCount} ta)`,
      message: `Segment: ${segment} · Xato: ${failedCount}`,
      userId: ctx.user.telegramId,
      amount: sentCount,
    }),
  ]);

  res.json({ ok: true, log: logEntry });
});

app.post('/api/admin/telegram-test', async (req, res) => {
  const ctx = await requireStaffSession(req, res, 'settings');
  if (!ctx) return;
  if (!getTelegramBotToken()) {
    res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN sozlanmagan.' });
    return;
  }
  await notifyStaffTelegram(
    `🔔 <b>Sinov CRM bildirishnomasi</b>\n\n` +
      `Yuboruvchi: <b>${escapeTgHtml(ctx.user.firstName)}</b> (<code>${escapeTgHtml(ctx.user.telegramId)}</code>)\n` +
      `Holat: Telegram bot va CRM xabarnomalari faol ishlamoqda ✅`
  );
  res.json({ ok: true });
});

app.get('/api/admin/audit-logs', async (req, res) => {
  const ctx = await requireStaffSession(req, res);
  if (!ctx) return;
  const logs = await dbListAuditLogs(120);
  res.json({ ok: true, logs: logs || [] });
});

app.get('/api/telegram/config', async (req, res) => {
  const token = getTelegramBotToken();
  const botUsername = token ? await resolveTelegramBotUsername() : null;
  const origin = getPreferredPublicOrigin(req);
  res.json({
    configured: Boolean(token),
    botUsername,
    webhookUrl: `${origin}/api/telegram/webhook`,
    webhookSecretConfigured: Boolean(getTelegramWebhookSecret()),
    kvConfigured: hasPersistentStorage(),
    dbDriver: getStorageDriver(),
  });
});

app.post('/api/telegram/auth/webapp', async (req, res) => {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    res.status(503).json({ error: "TELEGRAM_BOT_TOKEN sozlanmagan." });
    return;
  }
  const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
  const profile = verifyTelegramWebAppInitData(initData, botToken);
  if (!profile) {
    res.status(401).json({ error: "Telegram WebApp ma'lumoti tasdiqlanmadi." });
    return;
  }
  const account = await getTgUserAccount(profile);
  if (account.isNewUser) {
    void notifyNewUserToCrmAndStaff(account);
  }
  const staff = await resolveStaffAccess(profile.telegramId);
  const sessionToken = issueSessionCookieAndToken(req, res, profile);
  res.json({
    ok: true,
    user: profile,
    isAdmin: staff.role === 'super_admin',
    isManager: staff.role === 'manager',
    staffRole: staff.role,
    managerPermissions: staff.permissions,
    sessionToken,
    account,
    kvConfigured: hasPersistentStorage(),
    dbDriver: getStorageDriver(),
  });
});

app.post('/api/telegram/auth/verify', async (req, res) => {
  const rawToken = typeof req.body?.token === 'string' ? req.body.token : '';
  const payload = verifySignedToken(rawToken);
  if (!payload || payload.kind !== 'tg_login') {
    res.status(401).json({ error: "Kirish havolasi eskirgan yoki noto'g'ri. Botdan /start bosing." });
    return;
  }
  const tid = typeof payload.tid === 'string' ? payload.tid : '';
  const cid = typeof payload.cid === 'string' ? payload.cid : tid;
  if (!/^\d{3,20}$/.test(tid) || !/^-?\d{3,24}$/.test(cid)) {
    res.status(401).json({ error: "Noto'g'ri Telegram foydalanuvchi identifikatori." });
    return;
  }
  const profile: TgUserProfile = {
    telegramId: tid,
    chatId: cid,
    firstName: typeof payload.fn === 'string' && payload.fn ? payload.fn : 'Foydalanuvchi',
    lastName: typeof payload.ln === 'string' && payload.ln ? payload.ln : undefined,
    username: typeof payload.un === 'string' && payload.un ? payload.un : undefined,
  };
  const account = await getTgUserAccount(profile);
  if (account.isNewUser) {
    void notifyNewUserToCrmAndStaff(account);
  }
  const staff = await resolveStaffAccess(profile.telegramId);
  const sessionToken = issueSessionCookieAndToken(req, res, profile);
  res.json({
    ok: true,
    user: profile,
    isAdmin: staff.role === 'super_admin',
    isManager: staff.role === 'manager',
    staffRole: staff.role,
    managerPermissions: staff.permissions,
    sessionToken,
    account,
    kvConfigured: hasPersistentStorage(),
    dbDriver: getStorageDriver(),
  });
});

app.get('/api/telegram/auth/poll', async (req, res) => {
  const nonce = typeof req.query.nonce === 'string' ? req.query.nonce.trim() : '';
  if (!/^[a-zA-Z0-9_-]{8,48}$/.test(nonce)) {
    res.status(400).json({ error: "Noto'g'ri kirish kodi." });
    return;
  }
  const loginToken = await loadLoginNonce(nonce);
  if (!loginToken) {
    res.json({ authenticated: false });
    return;
  }
  const payload = verifySignedToken(loginToken);
  if (!payload || payload.kind !== 'tg_login') {
    res.json({ authenticated: false });
    return;
  }
  const profile: TgUserProfile = {
    telegramId: String(payload.tid),
    chatId: String(payload.cid || payload.tid),
    firstName: typeof payload.fn === 'string' && payload.fn ? payload.fn : 'Foydalanuvchi',
    lastName: typeof payload.ln === 'string' && payload.ln ? payload.ln : undefined,
    username: typeof payload.un === 'string' && payload.un ? payload.un : undefined,
  };
  const account = await getTgUserAccount(profile);
  if (account.isNewUser) {
    void notifyNewUserToCrmAndStaff(account);
  }
  const staff = await resolveStaffAccess(profile.telegramId);
  const sessionToken = issueSessionCookieAndToken(req, res, profile);
  res.json({
    authenticated: true,
    user: profile,
    isAdmin: staff.role === 'super_admin',
    isManager: staff.role === 'manager',
    staffRole: staff.role,
    managerPermissions: staff.permissions,
    sessionToken,
    account,
    kvConfigured: hasPersistentStorage(),
    dbDriver: getStorageDriver(),
  });
});

app.get('/api/telegram/me', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const account = await getTgUserAccount(user);
  const staff = await resolveStaffAccess(user.telegramId);
  const sessionToken = issueSessionCookieAndToken(req, res, user);
  res.json({
    ok: true,
    sessionToken,
    isAdmin: staff.role === 'super_admin',
    isManager: staff.role === 'manager',
    staffRole: staff.role,
    managerPermissions: staff.permissions,
    user: {
      ...user,
      autoSendFiles: account.autoSendFiles,
      notifyOnActivity: account.notifyOnActivity,
    },
    account,
    kvConfigured: hasPersistentStorage(),
    dbDriver: getStorageDriver(),
  });
});

app.post('/api/telegram/preferences', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const prefs: { autoSendFiles?: boolean; notifyOnActivity?: boolean } = {};
  if (typeof req.body?.autoSendFiles === 'boolean') {
    prefs.autoSendFiles = req.body.autoSendFiles;
  }
  if (typeof req.body?.notifyOnActivity === 'boolean') {
    prefs.notifyOnActivity = req.body.notifyOnActivity;
  }

  const dbUpdated = await dbUpdateUserPreferences(user.telegramId, prefs);
  if (dbUpdated) {
    res.json({ ok: true, ...dbUpdated });
    return;
  }

  const account = await getTgUserAccount(user);
  if (typeof prefs.autoSendFiles === 'boolean') account.autoSendFiles = prefs.autoSendFiles;
  if (typeof prefs.notifyOnActivity === 'boolean') account.notifyOnActivity = prefs.notifyOnActivity;
  await saveTgUserAccount(account);
  res.json({
    ok: true,
    autoSendFiles: account.autoSendFiles,
    notifyOnActivity: account.notifyOnActivity,
  });
});

app.post('/api/telegram/profile', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const fullName =
    typeof req.body?.fullName === 'string' ? req.body.fullName.trim().slice(0, 100) : undefined;
  const contact =
    typeof req.body?.contact === 'string' ? req.body.contact.trim().slice(0, 120) : undefined;

  const okDb = await dbUpdateUserProfile(user.telegramId, { fullName, contact });
  if (!okDb) {
    const account = await getTgUserAccount(user);
    if (fullName !== undefined) account.fullName = fullName;
    if (contact !== undefined) account.contact = contact;
    await saveTgUserAccount(account);
  }
  res.json({ ok: true });
});

app.post('/api/telegram/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/telegram/notify', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!rawMessage) {
    res.status(400).json({ error: "Xabar matni bo'sh." });
    return;
  }
  const account = await getTgUserAccount(user);
  if (!account.notifyOnActivity) {
    res.json({ ok: true, skipped: true });
    return;
  }
  const result = await telegramApi('sendMessage', {
    chat_id: account.chatId,
    text: `🔔 ${escapeTgHtml(rawMessage.slice(0, 800))}`,
    parse_mode: 'HTML',
  });
  res.json({ ok: result.ok });
});

app.post('/api/telegram/log-activity', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 140) : '';
  const method = typeof req.body?.method === 'string' ? req.body.method.trim().slice(0, 60) : 'AI Xizmat';
  const rawDelta = Number(req.body?.amountDelta ?? 0);
  // Only allow spend/zero deductions from client; positive top-ups come exclusively from verified TolovGo
  const safeDelta =
    Number.isFinite(rawDelta) && rawDelta <= 0 && rawDelta >= -500_000 ? Math.round(rawDelta) : 0;

  if (!title) {
    res.status(400).json({ error: 'Amaliyot nomi kerak.' });
    return;
  }

  const account = await getTgUserAccount(user);
  const txId = `act_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const dateLabel = formatUzDate();

  const dbRes = await dbLogActivity(user.telegramId, txId, title, method, safeDelta, dateLabel);
  if (dbRes) {
    account.balance = dbRes.balance;
    account.transactions = dbRes.transactions;
  } else {
    if (safeDelta < 0) {
      account.balance = Math.max(0, account.balance + safeDelta);
    }
    account.transactions.unshift({
      id: txId,
      title,
      method,
      amount: safeDelta,
      date: dateLabel,
    });
    await saveTgUserAccount(account);
  }

  if (account.notifyOnActivity) {
    const costLine = safeDelta < 0 ? `\n💳 Xarajat: <b>-${escapeTgHtml(formatSomServer(Math.abs(safeDelta)))}</b>` : '';
    const balLine = `\n💰 Qoldiq: <b>${escapeTgHtml(formatSomServer(account.balance))}</b>`;
    await telegramApi('sendMessage', {
      chat_id: account.chatId,
      text: `✨ <b>${escapeTgHtml(title)}</b> tayyorlandi!${costLine}${balLine}`,
      parse_mode: 'HTML',
    }).catch(() => {});
  }

  res.json({ ok: true, balance: account.balance, transactions: account.transactions });
});

// =========================================================================
// Projects & Pages Persistence Routes (Neon PostgreSQL + KV Fallback)
// =========================================================================
app.get('/api/projects', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }

  const dbProjects = await dbListProjects(user.telegramId, 20);
  if (dbProjects) {
    const latest = dbProjects[0] ? await dbGetProjectById(user.telegramId, dbProjects[0].id) : null;
    res.json({
      ok: true,
      dbDriver: 'neon',
      projects: dbProjects,
      activeProject: latest,
    });
    return;
  }

  const fallback = await kvGet<{
    id: string;
    title: string;
    mode: 'pptx' | 'word' | 'pdf';
    pptxPages: unknown[];
    pdfPages: unknown[];
    pdfOrientation: 'portrait' | 'landscape';
    wordDoc: Record<string, unknown>;
    tolovgoMode: 'live' | 'test';
    updatedAt: number;
  }>(`tg_project:${user.telegramId}:default`);

  res.json({
    ok: true,
    dbDriver: getStorageDriver(),
    projects: fallback
      ? [
          {
            id: fallback.id,
            title: fallback.title,
            mode: fallback.mode,
            pptxCount: fallback.pptxPages.length,
            pdfCount: fallback.pdfPages.length,
            updatedAt: fallback.updatedAt,
          },
        ]
      : [],
    activeProject: fallback || null,
  });
});

app.get('/api/projects/:id', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const projectId = String(req.params.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(projectId)) {
    res.status(400).json({ error: "Noto'g'ri loyiha identifikatori." });
    return;
  }
  const project = await dbGetProjectById(user.telegramId, projectId);
  if (!project) {
    res.status(404).json({ error: 'Loyiha topilmadi.' });
    return;
  }
  res.json({ ok: true, project });
});

app.post('/api/projects/sync', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const rawId = typeof body.id === 'string' ? body.id.trim() : `proj_${user.telegramId}_main`;
  const id = /^[a-zA-Z0-9_-]{1,64}$/.test(rawId) ? rawId : `proj_${user.telegramId}_main`;
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 140)
      : 'Yangi loyiha';
  const mode =
    body.mode === 'word' || body.mode === 'pdf' ? body.mode : 'pptx';
  const pptxPages = Array.isArray(body.pptxPages) ? body.pptxPages.slice(0, 30) : [];
  const pdfPages = Array.isArray(body.pdfPages) ? body.pdfPages.slice(0, 30) : [];
  const pdfOrientation = body.pdfOrientation === 'landscape' ? 'landscape' : 'portrait';
  const wordDoc =
    body.wordDoc && typeof body.wordDoc === 'object'
      ? (body.wordDoc as Record<string, unknown>)
      : {};
  const tolovgoMode = body.tolovgoMode === 'test' ? 'test' : 'live';

  await getTgUserAccount(user);
  const summary = await dbSaveProject(user.telegramId, {
    id,
    title,
    mode,
    pptxPages,
    pdfPages,
    pdfOrientation,
    wordDoc,
    tolovgoMode,
  });

  if (summary) {
    res.json({ ok: true, dbDriver: 'neon', project: summary });
    return;
  }

  const updatedAt = Date.now();
  await kvSet(`tg_project:${user.telegramId}:default`, {
    id,
    title,
    mode,
    pptxPages,
    pdfPages,
    pdfOrientation,
    wordDoc,
    tolovgoMode,
    updatedAt,
  });

  res.json({
    ok: true,
    dbDriver: getStorageDriver(),
    project: {
      id,
      title,
      mode,
      pptxCount: pptxPages.length,
      pdfCount: pdfPages.length,
      updatedAt,
    },
  });
});

app.delete('/api/projects/:id', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const projectId = String(req.params.id || '').trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(projectId)) {
    res.status(400).json({ error: "Noto'g'ri loyiha identifikatori." });
    return;
  }
  await dbDeleteProject(user.telegramId, projectId);
  res.json({ ok: true });
});

app.post('/api/telegram/send-document', async (req, res) => {
  const user = getAuthenticatedTelegramUser(req);
  if (!user) {
    res.status(401).json({ error: 'Telegram autentifikatsiyasi talab qilinadi.' });
    return;
  }
  const account = await getTgUserAccount(user);
  if (!account.autoSendFiles && req.body?.force !== true) {
    res.json({ ok: true, skipped: true });
    return;
  }

  const rawFileName = typeof req.body?.fileName === 'string' ? req.body.fileName.trim() : '';
  const safeFileName = rawFileName.replace(/[^a-zA-Z0-9._\-\s]/g, '_').slice(0, 120);
  if (!safeFileName || !/\.(pptx|pdf|docx|png)$/i.test(safeFileName)) {
    res.status(400).json({ error: "Faqat .pptx, .pdf, .docx yoki .png fayllari qo'llab-quvvatlanadi." });
    return;
  }

  const fileBase64 = typeof req.body?.fileBase64 === 'string' ? req.body.fileBase64.trim() : '';
  if (!fileBase64) {
    res.status(400).json({ error: "Fayl ma'lumoti bo'sh." });
    return;
  }

  const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',').pop() || '' : fileBase64;
  const approxBytes = Math.floor((cleanBase64.length * 3) / 4);
  if (approxBytes <= 0 || approxBytes > MAX_TG_DOCUMENT_BYTES) {
    res.status(413).json({
      error: "Fayl hajmi 3.2 MB dan oshdi — Telegram bot orqali yuborish uchun fayl juda katta.",
    });
    return;
  }

  const buf = Buffer.from(cleanBase64, 'base64');
  if (buf.length === 0 || buf.length > MAX_TG_DOCUMENT_BYTES) {
    res.status(413).json({ error: "Fayl hajmi ruxsat etilgan chegaradan oshdi." });
    return;
  }

  const ext = safeFileName.split('.').pop()?.toLowerCase();
  const mimeType =
    ext === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : ext === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === 'pdf'
          ? 'application/pdf'
          : 'image/png';

  const caption =
    typeof req.body?.caption === 'string' && req.body.caption.trim()
      ? req.body.caption.trim().slice(0, 400)
      : `📄 ${safeFileName} — SlaydCanva orqali tayyorlandi`;

  const sent = await telegramSendDocument(account.chatId, safeFileName, mimeType, buf, caption);
  if (!sent.ok) {
    res.status(502).json({
      error: sent.description || "Faylni Telegram botga yuborishda xatolik yuz berdi.",
    });
    return;
  }

  res.json({ ok: true, fileName: safeFileName });
});

function buildMainBotKeyboard(loginUrl: string, webAppUrl: string) {
  return {
    inline_keyboard: [
      [
        { text: '💰 Balans', callback_data: 'menu:balance' },
        { text: "💳 Balans to'ldirish", callback_data: 'menu:topup' },
      ],
      [
        { text: '📜 Tarix', callback_data: 'menu:history' },
        { text: '🤝 Referal (1 000 so‘m)', callback_data: 'menu:referral' },
      ],
      [
        { text: '🔐 Saytga kirish', url: loginUrl },
        { text: "📱 SlaydCanva'ni ochish", web_app: { url: webAppUrl } },
      ],
    ],
  };
}

function buildTopUpBotKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "25 000 so'm", callback_data: 'topup:25000' },
        { text: "50 000 so'm", callback_data: 'topup:50000' },
      ],
      [
        { text: "100 000 so'm", callback_data: 'topup:100000' },
        { text: "250 000 so'm", callback_data: 'topup:250000' },
      ],
      [{ text: '⬅️ Bosh menyu', callback_data: 'menu:home' }],
    ],
  };
}

function formatBotHistoryMessage(account: TgUserAccount): string {
  if (!account.transactions.length) {
    return "📜 <b>Amaliyotlar tarixi</b>\n\nHozircha amaliyotlar mavjud emas.";
  }
  const rows = account.transactions.slice(0, 10).map((tx, idx) => {
    const sign = tx.amount < 0 ? '-' : '+';
    const amt = formatSomServer(Math.abs(tx.amount));
    return `${idx + 1}. <b>${escapeTgHtml(tx.title)}</b>\n    ${sign}${escapeTgHtml(amt)} · ${escapeTgHtml(tx.method)} · ${escapeTgHtml(tx.date)}`;
  });
  return (
    `📜 <b>Oxirgi amaliyotlar tarixi</b>\n` +
    `💰 Joriy balans: <b>${escapeTgHtml(formatSomServer(account.balance))}</b>\n\n` +
    rows.join('\n\n')
  );
}

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const expectedSecret = getTelegramWebhookSecret();
    if (expectedSecret) {
      const provided = req.get('x-telegram-bot-api-secret-token') || '';
      if (!safeTimingEqual(provided, expectedSecret)) {
        res.status(401).json({ ok: false, error: 'Unauthorized webhook' });
        return;
      }
    }

    const update = (req.body || {}) as Record<string, unknown>;
    const origin = getPreferredPublicOrigin(req);

    // 1) Handle inline button callback queries
    if (update.callback_query && typeof update.callback_query === 'object') {
      const cq = update.callback_query as Record<string, unknown>;
      const cqId = String(cq.id || '');
      const from = (cq.from || {}) as Record<string, unknown>;
      const msg = (cq.message || {}) as Record<string, unknown>;
      const chat = (msg.chat || {}) as Record<string, unknown>;
      const data = typeof cq.data === 'string' ? cq.data : '';

      const tid = from.id !== undefined ? String(from.id) : '';
      const cid = chat.id !== undefined ? String(chat.id) : tid;
      if (/^\d{3,20}$/.test(tid) && /^-?\d{3,24}$/.test(cid)) {
        const user: TgUserProfile = {
          telegramId: tid,
          chatId: cid,
          firstName: typeof from.first_name === 'string' ? from.first_name : 'Foydalanuvchi',
          lastName: typeof from.last_name === 'string' ? from.last_name : undefined,
          username: typeof from.username === 'string' ? from.username : undefined,
        };
        const account = await getTgUserAccount(user);
        const loginToken = signToken(
          {
            kind: 'tg_login',
            tid: user.telegramId,
            cid: user.chatId,
            fn: user.firstName,
            ln: user.lastName || '',
            un: user.username || '',
          },
          10 * 60 * 1000
        );
        const loginUrl = `${origin}/?tg_auth=${encodeURIComponent(loginToken)}`;

        if (data === 'menu:home') {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `👋 <b>SlaydCanva bot</b>\n\n` +
              `💰 Balansingiz: <b>${escapeTgHtml(formatSomServer(account.balance))}</b>\n\n` +
              `Bu bot orqali:\n` +
              `• Saytga tezkor kirish (Auth)\n` +
              `• Balans va amaliyotlar tarixini ko'rish\n` +
              `• TolovGo orqali balans to'ldirish\n` +
              `• Tayyor PPTX/PDF/Word fayllari va bildirishnomalarni olish mumkin.`,
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (data === 'menu:balance') {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `💰 <b>Joriy balansingiz:</b> ${escapeTgHtml(formatSomServer(account.balance))}\n` +
              `🔔 Bildirishnomalar: <b>${account.notifyOnActivity ? 'Yoqilgan' : "O'chirilgan"}</b>\n` +
              `📎 Tayyor fayllar yuborilishi: <b>${account.autoSendFiles ? 'Yoqilgan' : "O'chirilgan"}</b>`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "💳 Balans to'ldirish", callback_data: 'menu:topup' }],
                [{ text: '📜 Tarix', callback_data: 'menu:history' }],
              ],
            },
          });
        } else if (data === 'menu:topup') {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `💳 <b>Balansni to'ldirish (TolovGo · UZS)</b>\n\n` +
              `Quyidagi summalardan birini tanlang yoki <code>/topup 75000</code> shaklida yozing:`,
            parse_mode: 'HTML',
            reply_markup: buildTopUpBotKeyboard(),
          });
        } else if (data === 'menu:history') {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          await telegramApi('sendMessage', {
            chat_id: cid,
            text: formatBotHistoryMessage(account),
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (data === 'menu:referral') {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          const botUsername = await resolveTelegramBotUsername();
          const pricing = await getEffectivePricingSettings();
          const refLink = botUsername
            ? `https://t.me/${botUsername}?start=ref_${tid}`
            : origin;
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `🤝 <b>Referal dasturi — har bir do'stingiz uchun ${escapeTgHtml(formatSomServer(pricing.referralInviterBonus))}!</b>\n\n` +
              `👥 Taklif qilgan do'stlaringiz: <b>${account.referralCount || 0} ta</b>\n` +
              `🔗 Sizning shaxsiy havolangiz:\n<code>${escapeTgHtml(refLink)}</code>\n\n` +
              `Havolani do'stlaringizga yuboring. Yangi foydalanuvchi botga birinchi marta kirganida sizga avtomatik <b>+${escapeTgHtml(formatSomServer(pricing.referralInviterBonus))}</b>, do'stingizga esa <b>+${escapeTgHtml(formatSomServer(pricing.welcomeBonus))}</b> bonus beriladi!`,
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (data.startsWith('topup:')) {
          const amount = Number(data.slice(6));
          if (Number.isInteger(amount) && amount >= 1000 && amount <= 99_999_999) {
            await telegramApi('answerCallbackQuery', {
              callback_query_id: cqId,
              text: "To'lov havolasi yaratilmoqda...",
            });
            const created = await createTolovgoOrderForBot(req, amount, tid, cid);
            if ('error' in created) {
              await telegramApi('sendMessage', {
                chat_id: cid,
                text: `❌ ${escapeTgHtml(created.error)}`,
                parse_mode: 'HTML',
              });
            } else {
              await telegramApi('sendMessage', {
                chat_id: cid,
                text:
                  `💳 <b>TolovGo hisob-fakturasi${created.isTest ? ' (Sinov)' : ''}</b>\n\n` +
                  `💵 Summa: <b>${escapeTgHtml(formatSomServer(created.amount))}</b>\n` +
                  `🧾 Buyurtma: <code>#${escapeTgHtml(created.orderId)}</code>\n\n` +
                  `Quyidagi havola orqali to'lang, so'ng «To'lovni tekshirish» tugmasini bosing:`,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "💳 TolovGo sahifasida to'lash", url: created.payUrl }],
                    [
                      {
                        text: "🔄 To'lovni tekshirish",
                        callback_data: `check_pay:${created.orderId}:${created.isTest ? 'test' : 'live'}`,
                      },
                    ],
                  ],
                },
              });
            }
          } else {
            await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
          }
        } else if (data.startsWith('check_pay:')) {
          const [, orderId, modeFlag] = data.split(':');
          const rec = await loadOrderRecord(orderId || '');
          const activeMode = await getEffectiveTolovgoMode();
          const orderIsTest = modeFlag === 'test' || Boolean(rec?.isTest);
          const cred = resolveTolovgoCredential(orderIsTest ? 'test' : 'live');
          if (!cred || !/^[a-zA-Z0-9_-]{1,64}$/.test(orderId || '')) {
            await telegramApi('answerCallbackQuery', {
              callback_query_id: cqId,
              text: "Buyurtmani tekshirib bo'lmadi.",
              show_alert: true,
            });
          } else if (cred.isTest && activeMode !== 'test') {
            await telegramApi('answerCallbackQuery', {
              callback_query_id: cqId,
              text: "Sinov rejimi hozirda o'chirilgan.",
              show_alert: true,
            });
          } else {
            const remote = await fetchRemoteTolovgoStatus(orderId, cred.apiKey).catch(() => null);
            if (!remote) {
              await telegramApi('answerCallbackQuery', {
                callback_query_id: cqId,
                text: "TolovGo serveriga ulanib bo'lmadi.",
                show_alert: true,
              });
            } else if (remote.status === 'paid') {
              const finalAmount = rec?.amount ?? remote.amount ?? 0;
              const wasNew =
                finalAmount >= 1000
                  ? await creditTgUserTopUp(
                      tid,
                      cid,
                      finalAmount,
                      orderId,
                      cred.isTest ? 'TolovGo (Sinov)' : 'TolovGo',
                      cred.isTest
                    )
                  : false;
              if (rec) {
                rec.status = 'paid';
                rec.credited = true;
                await saveOrderRecord(rec);
              }
              await telegramApi('answerCallbackQuery', {
                callback_query_id: cqId,
                text: wasNew ? "To'lov tasdiqlandi! Balansga qo'shildi." : "Bu to'lov allaqachon tasdiqlangan.",
              });
              if (wasNew) {
                await Promise.all([
                  notifyTelegramPaymentPaid(cid, finalAmount, orderId, cred.isTest),
                  notifyPaymentToCrmAndStaff({
                    orderId,
                    telegramId: tid,
                    amount: finalAmount,
                    method: rec?.method || 'Telegram Bot',
                    isTest: cred.isTest,
                    source: 'Telegram Bot Check',
                  }),
                ]);
              }
            } else {
              await telegramApi('answerCallbackQuery', {
                callback_query_id: cqId,
                text: `Holat: ${remote.status}. Hali to'lanmagan.`,
                show_alert: true,
              });
            }
          }
        } else {
          await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
        }
      } else if (cqId) {
        await telegramApi('answerCallbackQuery', { callback_query_id: cqId });
      }

      res.json({ ok: true });
      return;
    }

    // 2) Handle incoming text commands
    const message = (update.message || update.edited_message) as Record<string, unknown> | undefined;
    if (message && typeof message === 'object') {
      const from = (message.from || {}) as Record<string, unknown>;
      const chat = (message.chat || {}) as Record<string, unknown>;
      const text = typeof message.text === 'string' ? message.text.trim() : '';
      const tid = from.id !== undefined ? String(from.id) : '';
      const cid = chat.id !== undefined ? String(chat.id) : tid;
      const isBotUser = Boolean(from.is_bot);

      if (!isBotUser && /^\d{3,20}$/.test(tid) && /^-?\d{3,24}$/.test(cid) && text) {
        const pricing = await getEffectivePricingSettings();
        const user: TgUserProfile = {
          telegramId: tid,
          chatId: cid,
          firstName: typeof from.first_name === 'string' ? from.first_name : 'Foydalanuvchi',
          lastName: typeof from.last_name === 'string' ? from.last_name : undefined,
          username: typeof from.username === 'string' ? from.username : undefined,
        };
        const account = await getTgUserAccount(user, pricing.welcomeBonus);
        const cmdParts = text.split(/\s+/);
        const cmd = cmdParts[0].toLowerCase().split('@')[0];
        const arg = cmdParts[1] || '';

        const loginToken = signToken(
          {
            kind: 'tg_login',
            tid: user.telegramId,
            cid: user.chatId,
            fn: user.firstName,
            ln: user.lastName || '',
            un: user.username || '',
          },
          10 * 60 * 1000
        );
        const loginUrl = `${origin}/?tg_auth=${encodeURIComponent(loginToken)}`;

        if (cmd === '/start' || cmd === '/login' || cmd === '/auth') {
          if (arg.startsWith('auth_')) {
            const nonce = arg.slice(5).trim();
            if (/^[a-zA-Z0-9_-]{8,48}$/.test(nonce)) {
              await saveLoginNonce(nonce, loginToken);
            }
          }

          let appliedInviterId: string | undefined;
          let refApplied = false;
          if (arg.startsWith('ref_') && account.isNewUser) {
            const inviterId = arg.slice(4).trim();
            appliedInviterId = inviterId;
            const refResult = await applyReferralReward(user.telegramId, inviterId, pricing);
            if (refResult.applied) {
              refApplied = true;
              if (refResult.inviterChatId && pricing.referralInviterBonus > 0) {
                await telegramApi('sendMessage', {
                  chat_id: refResult.inviterChatId,
                  text:
                    `🎉 <b>Tabriklaymiz! Yangi referal qo'shildi</b>\n\n` +
                    `👤 Do'stingiz: <b>${escapeTgHtml(user.firstName)}</b>\n` +
                    `💵 Mukofot: <b>+${escapeTgHtml(formatSomServer(pricing.referralInviterBonus))}</b> hisobingizga qo'shildi!`,
                  parse_mode: 'HTML',
                }).catch(() => {});
              }
            }
          }

          const refreshedAccount = refApplied ? await getTgUserAccount(user, pricing.welcomeBonus) : account;
          if (account.isNewUser) {
            void notifyNewUserToCrmAndStaff(refreshedAccount, appliedInviterId);
          }
          const bonusLine = account.isNewUser && pricing.welcomeBonus > 0
            ? `🎁 Yangi foydalanuvchi bonusi: <b>+${escapeTgHtml(formatSomServer(pricing.welcomeBonus))}</b> qo'shildi!\n`
            : '';

          const greetingName = escapeTgHtml(user.firstName);
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `Assalomu alaykum, <b>${greetingName}</b>! 👋\n\n` +
              bonusLine +
              `<b>SlaydCanva</b> hisobingiz Telegram bilan bog'landi.\n` +
              `💰 Joriy balans: <b>${escapeTgHtml(formatSomServer(refreshedAccount.balance))}</b>\n\n` +
              `Pastdagi <b>«🔐 Saytga kirish»</b> tugmasini bosing (yoki agar brauzerda kirish sahifasi ochiq bo'lsa, u avtomatik ulanadi).\n\n` +
              `Bot imkoniyatlari:\n` +
              `• 🔔 Tayyorlangan taqdimot va to'lov bildirishnomalari\n` +
              `• 📎 Tayyor PPTX / PDF / Word fayllarini chatga qabul qilish\n` +
              `• 🤝 Referal havola orqali har bir do'st uchun +${escapeTgHtml(formatSomServer(pricing.referralInviterBonus))}\n` +
              `• 💳 TolovGo orqali balans to'ldirish`,
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (cmd === '/referral' || cmd === '/ref') {
          const botUsername = await resolveTelegramBotUsername();
          const refLink = botUsername
            ? `https://t.me/${botUsername}?start=ref_${tid}`
            : origin;
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `🤝 <b>Referal dasturi</b>\n\n` +
              `👥 Taklif qilgan do'stlaringiz: <b>${account.referralCount || 0} ta</b>\n` +
              `💵 Har bir yangi do'st uchun bonus: <b>+${escapeTgHtml(formatSomServer(pricing.referralInviterBonus))}</b>\n\n` +
              `🔗 Sizning havolangiz:\n<code>${escapeTgHtml(refLink)}</code>`,
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (cmd === '/balance') {
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `💰 <b>Joriy balansingiz:</b> ${escapeTgHtml(formatSomServer(account.balance))}\n` +
              `To'ldirish uchun /topup buyrug'idan foydalaning.`,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: "💳 Balans to'ldirish", callback_data: 'menu:topup' }],
                [{ text: '📜 Tarix', callback_data: 'menu:history' }],
              ],
            },
          });
        } else if (cmd === '/history') {
          await telegramApi('sendMessage', {
            chat_id: cid,
            text: formatBotHistoryMessage(account),
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        } else if (cmd === '/topup') {
          const customAmount = Number(arg.replace(/\D/g, ''));
          if (arg && Number.isInteger(customAmount) && customAmount >= 1000 && customAmount <= 99_999_999) {
            const created = await createTolovgoOrderForBot(req, customAmount, tid, cid);
            if ('error' in created) {
              await telegramApi('sendMessage', {
                chat_id: cid,
                text: `❌ ${escapeTgHtml(created.error)}`,
                parse_mode: 'HTML',
              });
            } else {
              await telegramApi('sendMessage', {
                chat_id: cid,
                text:
                  `💳 <b>TolovGo hisob-fakturasi${created.isTest ? ' (Sinov)' : ''}</b>\n\n` +
                  `💵 Summa: <b>${escapeTgHtml(formatSomServer(created.amount))}</b>\n` +
                  `🧾 Buyurtma: <code>#${escapeTgHtml(created.orderId)}</code>`,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "💳 TolovGo sahifasida to'lash", url: created.payUrl }],
                    [
                      {
                        text: "🔄 To'lovni tekshirish",
                        callback_data: `check_pay:${created.orderId}:${created.isTest ? 'test' : 'live'}`,
                      },
                    ],
                  ],
                },
              });
            }
          } else {
            await telegramApi('sendMessage', {
              chat_id: cid,
              text:
                `💳 <b>Balansni to'ldirish (TolovGo · UZS)</b>\n\n` +
                `Summani tanlang yoki <code>/topup 50000</code> shaklida kiriting:`,
              parse_mode: 'HTML',
              reply_markup: buildTopUpBotKeyboard(),
            });
          }
        } else {
          await telegramApi('sendMessage', {
            chat_id: cid,
            text:
              `📌 <b>Mavjud buyruqlar:</b>\n` +
              `/start — Kirish va bosh menyu\n` +
              `/balance — Balansni tekshirish\n` +
              `/referral — Referal havola olish\n` +
              `/topup — Balans to'ldirish\n` +
              `/history — Amaliyotlar tarixi`,
            parse_mode: 'HTML',
            reply_markup: buildMainBotKeyboard(loginUrl, origin),
          });
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Telegram Webhook Error]', err);
    res.json({ ok: true });
  }
});

app.all('/api/telegram/setup-webhook', async (req, res) => {
  const token = getTelegramBotToken();
  if (!token) {
    res.status(503).json({
      error: "TELEGRAM_BOT_TOKEN sozlanmagan. Vercel Environment Variables bo'limida kiriting.",
    });
    return;
  }

  const secret = getTelegramWebhookSecret();
  const isProd = Boolean(process.env.VERCEL);
  if (secret) {
    const provided = String(
      req.get('x-admin-secret') || req.query.secret || req.body?.secret || ''
    ).trim();
    if (!provided || !safeTimingEqual(provided, secret)) {
      res.status(401).json({
        error: "Webhook sozlash uchun secret noto'g'ri (X-Admin-Secret yoki ?secret=).",
      });
      return;
    }
  } else if (isProd) {
    res.status(503).json({
      error: "Production muhitida TELEGRAM_WEBHOOK_SECRET majburiy. Vercel Environment Variables ga qo'shing.",
    });
    return;
  }

  const origin = getPreferredPublicOrigin(req);
  const webhookUrl = `${origin}/api/telegram/webhook`;

  const setHookRes = await telegramApi('setWebhook', {
    url: webhookUrl,
    ...(secret ? { secret_token: secret } : {}),
    allowed_updates: ['message', 'callback_query'],
  });

  const setCmdRes = await telegramApi('setMyCommands', {
    commands: [
      { command: 'start', description: "Saytga kirish va bosh menyu" },
      { command: 'balance', description: "Joriy balansni ko'rish" },
      { command: 'topup', description: "TolovGo orqali balans to'ldirish" },
      { command: 'history', description: "Amaliyotlar tarixini ko'rish" },
    ],
  });

  const botUsername = await resolveTelegramBotUsername();

  res.status(setHookRes.ok ? 200 : 502).json({
    ok: setHookRes.ok,
    webhookUrl,
    botUsername,
    commandsUpdated: setCmdRes.ok,
    telegramResponse: setHookRes,
  });
});

export default app;
