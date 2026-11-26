import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

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

  // Attempt 1: Fast streaming with json_object (avoids strict json_schema grammar compile stalls)
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

  // Attempt 2: Clean openrouter/free with plain JSON prompt (proven fast fallback)
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

  // Polite sequential/paired lookup so Wikimedia never rate-limits burst requests
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
        // Space out photos if picking 2
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

  // Strip dangerous tags and attributes
  svg = svg
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|animate|set)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|animate|set)[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript:|https?:|data:text)[^"]*"|'\s*(?:javascript:|https?:|data:text)[^']*')/gi, '')
    .replace(/url\(\s*['"]?https?:[^)]+\)/gi, 'none');

  // Ensure proper root svg attributes
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

    // Place 1-3 real topic photos cleanly across slides without exceeding 3 total
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({
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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({
            serviceId: body.serviceId,
            splitMode: 'part2',
            data: { pages },
          });
          return;
        }

        // Default single or automatic internal 2-part split when requestedSlides > 6
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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({
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

        res.setHeader('X-AI-Trace', trace.join(' | '));
        res.json({
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
        const totalContentCount = Math.max(2, totalSlides - 3); // Slide 1=Title, Slide 2=Plan, Last=References
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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({ serviceId: body.serviceId, splitMode: 'part1', data });
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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({ serviceId: body.serviceId, splitMode: 'part2', data: part2Data });
          return;
        }

        // Single request OR automatic server-side 2-part split if totalSlides > 11 (e.g. 12..30)
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

          res.setHeader('X-AI-Trace', trace.join(' | '));
          res.json({ serviceId: body.serviceId, data: data1 });
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

        res.setHeader('X-AI-Trace', trace.join(' | '));
        res.json({ serviceId: body.serviceId, data });
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
        res.setHeader('X-AI-Trace', trace.join(' | '));
        res.json({ serviceId: body.serviceId, data });
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
        res.setHeader('X-AI-Trace', trace.join(' | '));
        res.json({ serviceId: body.serviceId, data });
        return;
      }

      res.status(400).json({ error: "Noto'g'ri xizmat turi." });
    } catch (err) {
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SlaydCanva server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
