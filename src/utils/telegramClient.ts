import {
  AdminAuditRow,
  AdminOrderRow,
  AdminOverviewStats,
  AdminUserRow,
  AppPricingSettings,
  BalanceTransaction,
  CloudProjectData,
  ProjectSummary,
  TelegramUser,
  TolovgoPaymentMode,
  UserProfile,
} from '../types/editor';

export interface TelegramConfigResponse {
  configured: boolean;
  botUsername: string | null;
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  kvConfigured: boolean;
  dbDriver?: string;
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
  referralCount?: number;
  isBanned?: boolean;
  isNewUser?: boolean;
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

export interface AppPricingResponse {
  ok: boolean;
  pricing: AppPricingSettings;
  tolovgoMode: TolovgoPaymentMode;
  botUsername: string | null;
  tolovgoCallbackUrl: string;
}

export async function fetchAppPricing(): Promise<AppPricingResponse | null> {
  try {
    const res = await fetch('/api/pricing');
    if (!res.ok) return null;
    return (await res.json()) as AppPricingResponse;
  } catch {
    return null;
  }
}

function getAdminHeaders(sessionToken?: string | null, adminToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    ...getTelegramAuthHeaders(sessionToken),
  };
  if (adminToken) {
    headers['X-Admin-Token'] = adminToken;
  }
  return headers;
}

export interface AdminStatusResponse {
  ok: boolean;
  isAdmin: boolean;
  passwordConfigured: boolean;
  adminUnlocked: boolean;
  tolovgoCallbackUrl: string;
  telegramWebhookUrl: string;
}

export async function adminGetStatus(
  sessionToken: string,
  adminToken?: string | null
): Promise<AdminStatusResponse | { error: string; status: number }> {
  const res = await fetch('/api/admin/status', {
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Admin holatini tekshirib bo'lmadi.", status: res.status };
  }
  return data as AdminStatusResponse;
}

export async function adminSetupPassword(
  sessionToken: string,
  password: string
): Promise<{ ok: true; adminToken: string } | { ok: false; error: string }> {
  const res = await fetch('/api/admin/setup-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken),
    },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; adminToken?: string; error?: string };
  if (!res.ok || !data.adminToken) {
    return { ok: false, error: data.error || "Parolni o'rnatib bo'lmadi." };
  }
  return { ok: true, adminToken: data.adminToken };
}

export async function adminLogin(
  sessionToken: string,
  password: string
): Promise<{ ok: true; adminToken: string } | { ok: false; error: string; code?: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken),
    },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    adminToken?: string;
    error?: string;
    code?: string;
  };
  if (!res.ok || !data.adminToken) {
    return { ok: false, error: data.error || "Parol noto'g'ri.", code: data.code };
  }
  return { ok: true, adminToken: data.adminToken };
}

export async function adminChangePassword(
  sessionToken: string,
  adminToken: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Parolni o'zgartirib bo'lmadi." };
  return { ok: true };
}

export interface AdminOverviewPayload {
  ok: boolean;
  overview: AdminOverviewStats;
  orders: AdminOrderRow[];
  auditLogs: AdminAuditRow[];
  pricing: AppPricingSettings;
  tolovgoMode: TolovgoPaymentMode;
  hasLiveKey: boolean;
  hasTestKey: boolean;
  neonConfigured: boolean;
  tablesReady: boolean;
  tolovgoCallbackUrl: string;
  telegramWebhookUrl: string;
}

export async function adminGetOverview(
  sessionToken: string,
  adminToken: string
): Promise<AdminOverviewPayload | { error: string; status: number }> {
  const res = await fetch('/api/admin/overview', {
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Admin ma'lumotlarini yuklab bo'lmadi.", status: res.status };
  }
  return data as AdminOverviewPayload;
}

export async function adminListUsers(
  sessionToken: string,
  adminToken: string,
  query = ''
): Promise<{ users: AdminUserRow[]; error?: string }> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const res = await fetch(`/api/admin/users${qs}`, {
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { users?: AdminUserRow[]; error?: string };
  if (!res.ok) return { users: [], error: data.error };
  return { users: Array.isArray(data.users) ? data.users : [] };
}

export async function adminAdjustUserBalance(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  delta: number,
  reason: string,
  notify = true
): Promise<{ ok: boolean; balance?: number; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/balance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ delta, reason, notify }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; balance?: number; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Balansni o'zgartirib bo'lmadi." };
  return { ok: true, balance: data.balance };
}

export async function adminSetUserBanned(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  isBanned: boolean
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/ban`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ isBanned }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Foydalanuvchi holatini o'zgartirib bo'lmadi." };
  return { ok: true };
}

export async function adminListOrders(
  sessionToken: string,
  adminToken: string
): Promise<{ orders: AdminOrderRow[]; error?: string }> {
  const res = await fetch('/api/admin/orders', {
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { orders?: AdminOrderRow[]; error?: string };
  if (!res.ok) return { orders: [], error: data.error };
  return { orders: Array.isArray(data.orders) ? data.orders : [] };
}

export async function adminSavePricing(
  sessionToken: string,
  adminToken: string,
  pricing: AppPricingSettings
): Promise<{ ok: boolean; pricing?: AppPricingSettings; error?: string }> {
  const res = await fetch('/api/admin/pricing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify(pricing),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    pricing?: AppPricingSettings;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Narxlarni saqlab bo'lmadi." };
  return { ok: true, pricing: data.pricing };
}

export async function adminSaveSettings(
  sessionToken: string,
  adminToken: string,
  tolovgoMode: TolovgoPaymentMode
): Promise<{ ok: boolean; tolovgoMode?: TolovgoPaymentMode; error?: string }> {
  const res = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ tolovgoMode }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    tolovgoMode?: TolovgoPaymentMode;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Sozlamalarni saqlab bo'lmadi." };
  return { ok: true, tolovgoMode: data.tolovgoMode };
}

export async function adminListAuditLogs(
  sessionToken: string,
  adminToken: string
): Promise<{ logs: AdminAuditRow[]; error?: string }> {
  const res = await fetch('/api/admin/audit-logs', {
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { logs?: AdminAuditRow[]; error?: string };
  if (!res.ok) return { logs: [], error: data.error };
  return { logs: Array.isArray(data.logs) ? data.logs : [] };
}

