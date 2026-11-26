import {
  BalanceTransaction,
  CloudProjectData,
  ProjectSummary,
  TelegramUser,
  UserProfile,
} from '../types/editor';

export interface TelegramConfigResponse {
  configured: boolean;
  botUsername: string | null;
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  kvConfigured: boolean;
}

export interface TelegramAccountResponse {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  fullName?: string;
  contact?: string;
  balance: number;
  transactions: BalanceTransaction[];
  notifyOnActivity: boolean;
  autoSendFiles: boolean;
  updatedAt: number;
}

export const MAX_TELEGRAM_FILE_BYTES = 3_200_000;

export function getTelegramAuthHeaders(sessionToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'SlaydCanva',
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',').pop() || '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to encode file'));
    reader.readAsDataURL(blob);
  });
}

export async function sendBlobToTelegram(
  blob: Blob,
  fileName: string,
  sessionToken?: string | null,
  caption?: string,
  force = false
): Promise<{ ok: boolean; skipped?: boolean; tooLarge?: boolean; error?: string }> {
  if (!sessionToken) {
    return { ok: false, skipped: true };
  }
  if (blob.size > MAX_TELEGRAM_FILE_BYTES) {
    return {
      ok: false,
      tooLarge: true,
      error: "Fayl 3.2 MB dan katta bo'lgani uchun Telegramga yuborilmadi.",
    };
  }
  try {
    const fileBase64 = await blobToBase64(blob);
    const res = await fetch('/api/telegram/send-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify({
        fileName,
        fileBase64,
        caption,
        force,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      skipped?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "Telegramga yuborishda xatolik." };
    }
    return { ok: true, skipped: Boolean(data.skipped) };
  } catch {
    return { ok: false, error: "Telegram serveri bilan bog'lanib bo'lmadi." };
  }
}

export async function logTelegramActivity(
  title: string,
  method: string,
  amountDelta: number,
  sessionToken?: string | null
): Promise<boolean> {
  if (!sessionToken) return false;
  try {
    const res = await fetch('/api/telegram/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify({
        title,
        method,
        amountDelta: amountDelta <= 0 ? amountDelta : 0,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyTelegram(
  message: string,
  sessionToken?: string | null
): Promise<boolean> {
  if (!sessionToken || !message.trim()) return false;
  try {
    const res = await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify({ message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface TelegramWebAppWindow extends Window {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
      initDataUnsafe?: {
        user?: {
          id?: number;
          first_name?: string;
          last_name?: string;
          username?: string;
        };
      };
    };
  };
}

export function formatTelegramDisplayName(user: TelegramUser): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (user.username) {
    return full ? `${full} (@${user.username})` : `@${user.username}`;
  }
  return full || `ID ${user.telegramId}`;
}

const MAX_PROJECT_SYNC_BYTES = 3_800_000;

export async function fetchCloudProjects(sessionToken?: string | null): Promise<{
  projects: ProjectSummary[];
  activeProject: CloudProjectData | null;
} | null> {
  if (!sessionToken) return null;
  try {
    const res = await fetch('/api/projects', {
      headers: getTelegramAuthHeaders(sessionToken),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      projects?: ProjectSummary[];
      activeProject?: CloudProjectData | null;
    };
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
      activeProject: data.activeProject || null,
    };
  } catch {
    return null;
  }
}

export async function loadCloudProject(
  projectId: string,
  sessionToken?: string | null
): Promise<CloudProjectData | null> {
  if (!sessionToken || !projectId) return null;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      headers: getTelegramAuthHeaders(sessionToken),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; project?: CloudProjectData };
    return data.project || null;
  } catch {
    return null;
  }
}

export async function syncCloudProject(
  payload: Omit<CloudProjectData, 'updatedAt'>,
  sessionToken?: string | null
): Promise<{ ok: boolean; project?: ProjectSummary; tooLarge?: boolean }> {
  if (!sessionToken) return { ok: false };
  try {
    const bodyStr = JSON.stringify(payload);
    if (bodyStr.length > MAX_PROJECT_SYNC_BYTES) {
      return { ok: false, tooLarge: true };
    }
    const res = await fetch('/api/projects/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: bodyStr,
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; project?: ProjectSummary };
    return { ok: Boolean(data.ok), project: data.project };
  } catch {
    return { ok: false };
  }
}

export async function deleteCloudProject(
  projectId: string,
  sessionToken?: string | null
): Promise<boolean> {
  if (!sessionToken || !projectId) return false;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveCloudProfile(
  profile: UserProfile,
  sessionToken?: string | null
): Promise<boolean> {
  if (!sessionToken) return false;
  try {
    const res = await fetch('/api/telegram/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify(profile),
    });
    return res.ok;
  } catch {
    return false;
  }
}

