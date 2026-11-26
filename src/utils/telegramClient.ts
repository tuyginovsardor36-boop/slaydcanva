import {
  AdminAnalyticsPayload,
  AdminAuditRow,
  AdminOrderRow,
  AdminOverviewStats,
  AdminUserDetailPayload,
  AdminUserRow,
  AppPricingSettings,
  BalanceTransaction,
  BroadcastLogRow,
  CloudProjectData,
  CrmEventRow,
  ManagerPermission,
  ManagerRecord,
  ProjectSummary,
  PromoCodeRow,
  SiteConfigSettings,
  StaffRole,
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
      const base64 = result.includes(',') ? result.split(',').pop() || '' : '';
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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

export async function fetchTelegramAccountMe(sessionToken?: string | null): Promise<{
  ok: boolean;
  user?: TelegramUser;
  sessionToken?: string;
  account?: TelegramAccountResponse;
  isAdmin?: boolean;
  isManager?: boolean;
  staffRole?: StaffRole;
  managerPermissions?: ManagerPermission[];
} | null> {
  try {
    const res = await fetch('/api/telegram/me', {
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      user?: TelegramUser;
      sessionToken?: string;
      account?: TelegramAccountResponse;
      isAdmin?: boolean;
      isManager?: boolean;
      staffRole?: StaffRole;
      managerPermissions?: ManagerPermission[];
    };
  } catch {
    return null;
  }
}

export async function redeemPromoCode(
  code: string,
  sessionToken?: string | null
): Promise<{ ok: boolean; bonusAmount?: number; balance?: number; error?: string }> {
  try {
    const res = await fetch('/api/promo/redeem', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify({ code }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      bonusAmount?: number;
      balance?: number;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "Promokodni faollashtirib bo'lmadi." };
    }
    return { ok: true, bonusAmount: data.bonusAmount, balance: data.balance };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function fetchCloudProjects(sessionToken?: string | null): Promise<{
  projects: ProjectSummary[];
  activeProject: CloudProjectData | null;
} | null> {
  if (!sessionToken) return null;
  try {
    const res = await fetch('/api/projects', {
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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
      credentials: 'same-origin',
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
  siteConfig?: SiteConfigSettings;
}

export async function fetchAppPricing(): Promise<AppPricingResponse | null> {
  try {
    const res = await fetch('/api/pricing', { credentials: 'same-origin' });
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
  isManager?: boolean;
  staffRole?: StaffRole;
  permissions?: ManagerPermission[];
  passwordConfigured: boolean;
  adminUnlocked: boolean;
  adminToken?: string;
  tolovgoCallbackUrl: string;
  telegramWebhookUrl: string;
}

export async function adminGetStatus(
  sessionToken: string,
  adminToken?: string | null
): Promise<AdminStatusResponse | { error: string; status: number }> {
  const res = await fetch('/api/admin/status', {
    credentials: 'same-origin',
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
): Promise<
  | { ok: true; adminToken: string; staffRole?: StaffRole; permissions?: ManagerPermission[] }
  | { ok: false; error: string }
> {
  const res = await fetch('/api/admin/setup-password', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken),
    },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    adminToken?: string;
    staffRole?: StaffRole;
    permissions?: ManagerPermission[];
    error?: string;
  };
  if (!res.ok || !data.adminToken) {
    return { ok: false, error: data.error || "Parolni o'rnatib bo'lmadi." };
  }
  return {
    ok: true,
    adminToken: data.adminToken,
    staffRole: data.staffRole,
    permissions: data.permissions,
  };
}

export async function adminLogin(
  sessionToken: string,
  password: string
): Promise<
  | { ok: true; adminToken: string; staffRole?: StaffRole; permissions?: ManagerPermission[] }
  | { ok: false; error: string; code?: string }
> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken),
    },
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    adminToken?: string;
    staffRole?: StaffRole;
    permissions?: ManagerPermission[];
    error?: string;
    code?: string;
  };
  if (!res.ok || !data.adminToken) {
    return { ok: false, error: data.error || "Parol noto'g'ri.", code: data.code };
  }
  return {
    ok: true,
    adminToken: data.adminToken,
    staffRole: data.staffRole,
    permissions: data.permissions,
  };
}

export async function adminLogout(sessionToken?: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getAdminHeaders(sessionToken),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function adminChangePassword(
  sessionToken: string,
  adminToken: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    credentials: 'same-origin',
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
  staffRole?: StaffRole;
  permissions?: ManagerPermission[];
  overview: AdminOverviewStats;
  orders: AdminOrderRow[];
  auditLogs: AdminAuditRow[];
  pricing: AppPricingSettings;
  tolovgoMode: TolovgoPaymentMode;
  siteConfig?: SiteConfigSettings;
  managers?: ManagerRecord[];
  crmEvents?: CrmEventRow[];
  hasLiveKey: boolean;
  hasTestKey: boolean;
  hasWebhookSecret?: boolean;
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
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: data.error || "Admin ma'lumotlarini yuklab bo'lmadi.", status: res.status };
  }
  return data as AdminOverviewPayload;
}

export async function adminGetAnalytics(
  sessionToken: string,
  adminToken: string,
  days = 14
): Promise<{ analytics: AdminAnalyticsPayload | null; error?: string }> {
  const res = await fetch(`/api/admin/analytics?days=${encodeURIComponent(String(days))}`, {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    analytics?: AdminAnalyticsPayload;
    error?: string;
  };
  if (!res.ok) return { analytics: null, error: data.error };
  return { analytics: data.analytics || null };
}

export async function adminListCrmEvents(
  sessionToken: string,
  adminToken: string
): Promise<{ events: CrmEventRow[]; error?: string }> {
  const res = await fetch('/api/admin/crm-events', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    events?: CrmEventRow[];
    error?: string;
  };
  if (!res.ok) return { events: [], error: data.error };
  return { events: Array.isArray(data.events) ? data.events : [] };
}

export async function adminMarkCrmEventsRead(
  sessionToken: string,
  adminToken: string,
  ids?: string[]
): Promise<boolean> {
  const res = await fetch('/api/admin/crm-events/read', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify(ids ? { ids } : {}),
  });
  return res.ok;
}

export async function adminListManagers(
  sessionToken: string,
  adminToken: string
): Promise<{ managers: ManagerRecord[]; error?: string }> {
  const res = await fetch('/api/admin/managers', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    managers?: ManagerRecord[];
    error?: string;
  };
  if (!res.ok) return { managers: [], error: data.error };
  return { managers: Array.isArray(data.managers) ? data.managers : [] };
}

export async function adminUpsertManager(
  sessionToken: string,
  adminToken: string,
  payload: {
    telegramId: string;
    firstName: string;
    username?: string;
    roleTitle: string;
    permissions: ManagerPermission[];
    password?: string;
    isActive: boolean;
    notifyTelegram: boolean;
  }
): Promise<{ ok: boolean; manager?: ManagerRecord; error?: string }> {
  const res = await fetch('/api/admin/managers', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    manager?: ManagerRecord;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Menejerni saqlab bo'lmadi." };
  return { ok: true, manager: data.manager };
}

export async function adminDeleteManager(
  sessionToken: string,
  adminToken: string,
  telegramId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/managers/${encodeURIComponent(telegramId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Menejerni o'chirib bo'lmadi." };
  return { ok: true };
}

export async function adminListUsers(
  sessionToken: string,
  adminToken: string,
  query = ''
): Promise<{ users: AdminUserRow[]; error?: string }> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const res = await fetch(`/api/admin/users${qs}`, {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { users?: AdminUserRow[]; error?: string };
  if (!res.ok) return { users: [], error: data.error };
  return { users: Array.isArray(data.users) ? data.users : [] };
}

export async function adminGetUserDetail(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string
): Promise<{ detail: AdminUserDetailPayload | null; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/detail`, {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: AdminUserDetailPayload;
    error?: string;
  };
  if (!res.ok) return { detail: null, error: data.error || "Foydalanuvchi profili yuklanmadi." };
  return { detail: data.detail || null };
}

export async function adminUpdateUserCrm(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  crmTag: string,
  crmNote: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/crm`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ crmTag, crmNote }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "CRM izohini saqlab bo'lmadi." };
  return { ok: true };
}

export async function adminSendDirectMessage(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/message`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ message }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || 'Xabar yuborilmadi.' };
  return { ok: true };
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
    credentials: 'same-origin',
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
    credentials: 'same-origin',
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
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { orders?: AdminOrderRow[]; error?: string };
  if (!res.ok) return { orders: [], error: data.error };
  return { orders: Array.isArray(data.orders) ? data.orders : [] };
}

export async function adminVerifyOrder(
  sessionToken: string,
  adminToken: string,
  orderId: string
): Promise<{
  ok: boolean;
  status?: string;
  amount?: number;
  newlyCredited?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/admin/orders/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ orderId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    status?: string;
    amount?: number;
    newlyCredited?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Buyurtmani tekshirib bo'lmadi." };
  return {
    ok: true,
    status: data.status,
    amount: data.amount,
    newlyCredited: data.newlyCredited,
  };
}

export async function adminSavePricing(
  sessionToken: string,
  adminToken: string,
  pricing: AppPricingSettings
): Promise<{ ok: boolean; pricing?: AppPricingSettings; error?: string }> {
  const res = await fetch('/api/admin/pricing', {
    method: 'POST',
    credentials: 'same-origin',
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
    credentials: 'same-origin',
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

export async function adminSaveSiteConfig(
  sessionToken: string,
  adminToken: string,
  config: Partial<SiteConfigSettings>
): Promise<{ ok: boolean; siteConfig?: SiteConfigSettings; error?: string }> {
  const res = await fetch('/api/admin/site-config', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify(config),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    siteConfig?: SiteConfigSettings;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Sayt sozlamalarini saqlab bo'lmadi." };
  return { ok: true, siteConfig: data.siteConfig };
}

export async function adminSendTestTelegramAlert(
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/telegram-test', {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || 'Sinov xabari yuborilmadi.' };
  return { ok: true };
}

export async function adminListPromos(
  sessionToken: string,
  adminToken: string
): Promise<{ promos: PromoCodeRow[]; error?: string }> {
  const res = await fetch('/api/admin/promos', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { promos?: PromoCodeRow[]; error?: string };
  if (!res.ok) return { promos: [], error: data.error };
  return { promos: Array.isArray(data.promos) ? data.promos : [] };
}

export async function adminUpsertPromo(
  sessionToken: string,
  adminToken: string,
  payload: {
    code: string;
    bonusAmount: number;
    maxUses: number;
    isActive: boolean;
    expiresDays?: number;
  }
): Promise<{ ok: boolean; promo?: PromoCodeRow; error?: string }> {
  const res = await fetch('/api/admin/promos', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    promo?: PromoCodeRow;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Promokodni saqlab bo'lmadi." };
  return { ok: true, promo: data.promo };
}

export async function adminDeletePromo(
  sessionToken: string,
  adminToken: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/promos/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || "Promokodni o'chirib bo'lmadi." };
  return { ok: true };
}

export async function adminListBroadcasts(
  sessionToken: string,
  adminToken: string
): Promise<{ logs: BroadcastLogRow[]; error?: string }> {
  const res = await fetch('/api/admin/broadcasts', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    logs?: BroadcastLogRow[];
    error?: string;
  };
  if (!res.ok) return { logs: [], error: data.error };
  return { logs: Array.isArray(data.logs) ? data.logs : [] };
}

export async function adminSendBroadcast(
  sessionToken: string,
  adminToken: string,
  segment: 'all' | 'active' | 'vip' | 'zero_balance',
  message: string
): Promise<{ ok: boolean; log?: BroadcastLogRow; error?: string }> {
  const res = await fetch('/api/admin/broadcast', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ segment, message }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    log?: BroadcastLogRow;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Xabarnoma yuborilmadi.' };
  return { ok: true, log: data.log };
}

export async function adminListAuditLogs(
  sessionToken: string,
  adminToken: string
): Promise<{ logs: AdminAuditRow[]; error?: string }> {
  const res = await fetch('/api/admin/audit-logs', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { logs?: AdminAuditRow[]; error?: string };
  if (!res.ok) return { logs: [], error: data.error };
  return { logs: Array.isArray(data.logs) ? data.logs : [] };
}


