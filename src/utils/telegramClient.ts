import {
  AdminAnalyticsPayload,
  AdminAuditRow,
  AdminOrderRow,
  AdminOverviewStats,
  AdminProjectRow,
  AdminUserDetailPayload,
  AdminUserRow,
  AppPricingSettings,
  BackupAiProviderRecord,
  BackupAiProviderType,
  BalanceTransaction,
  BroadcastLogRow,
  CloudProjectData,
  CrmEventRow,
  InboxMessageRow,
  ManagerPermission,
  ManagerRecord,
  MandatoryChannelPublic,
  MandatoryChannelRecord,
  ProjectSummary,
  PromoCodeRow,
  SecurityLogRow,
  SecurityScanReport,
  SiteConfigSettings,
  StaffRole,
  SupportAgentPublic,
  SupportTicketRow,
  SupportTicketStatus,
  SystemApiKeyRow,
  SystemApiKeySlot,
  TelegramUser,
  TolovgoPaymentMode,
  UserFileRecord,
  UserProfile,
} from '../types/editor';

export interface TelegramConfigResponse {
  configured: boolean;
  botUsername: string | null;
  webhookUrl: string;
  webhookSecretConfigured: boolean;
  kvConfigured: boolean;
  dbDriver?: string;
  telegramOnlyMode?: boolean;
  supportUsername?: string;
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

export const MAX_TELEGRAM_FILE_BYTES = 15_000_000;

export function getTelegramAuthHeaders(sessionToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'SlaydCanva',
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }
  return headers;
}

export async function saveAndSendUserFile(params: {
  blob: Blob;
  fileName: string;
  sessionToken?: string | null;
  caption?: string;
  serviceId?: string;
  serviceTitle?: string;
  sendToTelegram?: boolean;
  forceTelegram?: boolean;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  tooLarge?: boolean;
  file?: UserFileRecord;
  downloadPath?: string;
  sentToTelegram?: boolean;
  telegramError?: string;
  error?: string;
}> {
  if (!params.sessionToken) {
    return { ok: false, skipped: true };
  }
  if (params.blob.size > MAX_TELEGRAM_FILE_BYTES) {
    return {
      ok: false,
      tooLarge: true,
      error: "Fayl hajmi 15 MB dan katta bo'lgani uchun serverga saqlanmadi.",
    };
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(params.fileName),
      'X-Send-Telegram': params.sendToTelegram !== false ? 'true' : 'false',
      'X-Force-Telegram': params.forceTelegram === true ? 'true' : 'false',
      ...getTelegramAuthHeaders(params.sessionToken),
    };
    if (params.caption) {
      headers['X-File-Caption'] = encodeURIComponent(params.caption);
    }
    if (params.serviceId) {
      headers['X-Service-Id'] = encodeURIComponent(params.serviceId);
    }
    if (params.serviceTitle) {
      headers['X-Service-Title'] = encodeURIComponent(params.serviceTitle);
    }
    const res = await fetch('/api/files/save', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: params.blob,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      file?: UserFileRecord;
      downloadPath?: string;
      sentToTelegram?: boolean;
      telegramError?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || "Faylni saqlashda xatolik." };
    }
    return {
      ok: true,
      file: data.file,
      downloadPath: data.downloadPath,
      sentToTelegram: Boolean(data.sentToTelegram),
      telegramError: data.telegramError,
    };
  } catch {
    return { ok: false, error: "Server bilan bog'lanib bo'lmadi." };
  }
}

export async function sendBlobToTelegram(
  blob: Blob,
  fileName: string,
  sessionToken?: string | null,
  caption?: string,
  force = false,
  serviceMeta?: { serviceId?: string; serviceTitle?: string }
): Promise<{
  ok: boolean;
  skipped?: boolean;
  tooLarge?: boolean;
  file?: UserFileRecord;
  downloadPath?: string;
  sentToTelegram?: boolean;
  error?: string;
}> {
  return saveAndSendUserFile({
    blob,
    fileName,
    sessionToken,
    caption,
    serviceId: serviceMeta?.serviceId,
    serviceTitle: serviceMeta?.serviceTitle,
    sendToTelegram: true,
    forceTelegram: force,
  });
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
      platform?: string;
      version?: string;
      ready?: () => void;
      expand?: () => void;
      downloadFile?: (
        params: { url: string; file_name: string },
        cb?: (accepted: boolean) => void
      ) => void;
      openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
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
  missingChannels?: MandatoryChannelPublic[];
  isAdmin?: boolean;
  isManager?: boolean;
  isSupport?: boolean;
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
      missingChannels?: MandatoryChannelPublic[];
      isAdmin?: boolean;
      isManager?: boolean;
      isSupport?: boolean;
      staffRole?: StaffRole;
      managerPermissions?: ManagerPermission[];
    };
  } catch {
    return null;
  }
}

export async function checkTelegramSubscriptionStatus(sessionToken?: string | null): Promise<{
  ok: boolean;
  subscribed: boolean;
  missingChannels: MandatoryChannelPublic[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/telegram/subscription-status', {
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      subscribed?: boolean;
      missingChannels?: MandatoryChannelPublic[];
      error?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        subscribed: true,
        missingChannels: [],
        error: data.error || 'Obuna holatini tekshirib bo‘lmadi.',
      };
    }
    return {
      ok: true,
      subscribed: Boolean(data.subscribed),
      missingChannels: Array.isArray(data.missingChannels) ? data.missingChannels : [],
    };
  } catch {
    return { ok: false, subscribed: true, missingChannels: [], error: 'Tarmoq xatosi.' };
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
  isSupport?: boolean;
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
    roleType?: 'manager' | 'support';
    isSupportDefault?: boolean;
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
  isBanned: boolean,
  banDurationDays?: number
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(targetTelegramId)}/ban`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ isBanned, banDurationDays }),
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

export async function fetchSupportInfo(sessionToken?: string | null): Promise<{
  ok: boolean;
  agent: SupportAgentPublic | null;
  ticket: SupportTicketRow | null;
  messages: InboxMessageRow[];
  botUsername?: string | null;
} | null> {
  try {
    const res = await fetch('/api/support/info', {
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      supportAgent?: SupportAgentPublic | null;
      agent?: SupportAgentPublic | null;
      ticket?: SupportTicketRow | null;
      messages?: InboxMessageRow[];
      botUsername?: string | null;
    };
    return {
      ok: Boolean(data.ok),
      agent: data.supportAgent || data.agent || null,
      ticket: data.ticket || null,
      messages: Array.isArray(data.messages) ? data.messages : [],
      botUsername: data.botUsername || null,
    };
  } catch {
    return null;
  }
}

export async function sendUserSupportMessage(
  sessionToken: string,
  message: string,
  subject?: string
): Promise<{
  ok: boolean;
  ticket?: SupportTicketRow;
  message?: InboxMessageRow;
  error?: string;
}> {
  try {
    const res = await fetch('/api/support/messages', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramAuthHeaders(sessionToken),
      },
      body: JSON.stringify({ message, subject }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      ticket?: SupportTicketRow;
      message?: InboxMessageRow;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || 'Xabar yuborilmadi.' };
    return { ok: true, ticket: data.ticket, message: data.message };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function resetUserSupportChat(
  sessionToken: string
): Promise<{ ok: boolean; resetAt?: number; error?: string }> {
  try {
    const res = await fetch('/api/support/reset', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      resetAt?: number;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || 'Chatni tiklab bo‘lmadi.' };
    return { ok: true, resetAt: data.resetAt };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function fetchUserSavedFiles(sessionToken?: string | null): Promise<{
  files: UserFileRecord[];
  projects: ProjectSummary[];
} | null> {
  if (!sessionToken) return null;
  try {
    const res = await fetch('/api/files', {
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      ok?: boolean;
      files?: UserFileRecord[];
      projects?: ProjectSummary[];
    };
    return {
      files: Array.isArray(data.files) ? data.files : [],
      projects: Array.isArray(data.projects) ? data.projects : [],
    };
  } catch {
    return null;
  }
}

export async function getFileDownloadLink(
  fileId: string,
  sessionToken?: string | null
): Promise<{ ok: boolean; fileName?: string; downloadPath?: string; error?: string }> {
  if (!sessionToken) return { ok: false, error: 'Sessiya topilmadi.' };
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(fileId)}/download-link`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      fileName?: string;
      downloadPath?: string;
      error?: string;
    };
    if (!res.ok || !data.downloadPath) {
      return { ok: false, error: data.error || 'Yuklab olish havolasi olinmadi.' };
    }
    return { ok: true, fileName: data.fileName, downloadPath: data.downloadPath };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function resendUserFileToTelegram(
  fileId: string,
  sessionToken?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!sessionToken) return { ok: false, error: 'Sessiya topilmadi.' };
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(fileId)}/send-telegram`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || 'Botga yuborilmadi.' };
    return { ok: true };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function deleteUserSavedFile(
  fileId: string,
  sessionToken?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!sessionToken) return { ok: false, error: 'Sessiya topilmadi.' };
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: getTelegramAuthHeaders(sessionToken),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || "O'chirib bo'lmadi." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminListAllFiles(
  sessionToken: string,
  adminToken: string,
  query = '',
  format = 'all'
): Promise<{ ok: boolean; files: UserFileRecord[]; error?: string }> {
  try {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set('q', query.trim());
    if (format && format !== 'all') qs.set('format', format);
    const res = await fetch(`/api/admin/files?${qs.toString()}`, {
      credentials: 'same-origin',
      headers: getAdminHeaders(sessionToken, adminToken),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      files?: UserFileRecord[];
      error?: string;
    };
    if (!res.ok) return { ok: false, files: [], error: data.error || 'Fayllar yuklanmadi.' };
    return { ok: true, files: Array.isArray(data.files) ? data.files : [] };
  } catch {
    return { ok: false, files: [], error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminFetchFileBlob(
  fileId: string,
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; blob?: Blob; error?: string }> {
  try {
    const res = await fetch(`/api/admin/files/${encodeURIComponent(fileId)}/download`, {
      credentials: 'same-origin',
      headers: getAdminHeaders(sessionToken, adminToken),
    });
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: errData.error || 'Fayl yuklab olinmadi.' };
    }
    const blob = await res.blob();
    return { ok: true, blob };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminListAllProjects(
  sessionToken: string,
  adminToken: string,
  query = '',
  mode = 'all'
): Promise<{ ok: boolean; projects: AdminProjectRow[]; error?: string }> {
  try {
    const qs = new URLSearchParams();
    if (query.trim()) qs.set('q', query.trim());
    if (mode && mode !== 'all') qs.set('mode', mode);
    const res = await fetch(`/api/admin/projects?${qs.toString()}`, {
      credentials: 'same-origin',
      headers: getAdminHeaders(sessionToken, adminToken),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      projects?: AdminProjectRow[];
      error?: string;
    };
    if (!res.ok) return { ok: false, projects: [], error: data.error || 'Loyihalar yuklanmadi.' };
    return { ok: true, projects: Array.isArray(data.projects) ? data.projects : [] };
  } catch {
    return { ok: false, projects: [], error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminGetUserProject(
  telegramId: string,
  projectId: string,
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; project?: CloudProjectData; error?: string }> {
  try {
    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(telegramId)}/projects/${encodeURIComponent(projectId)}`,
      {
        credentials: 'same-origin',
        headers: getAdminHeaders(sessionToken, adminToken),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      project?: CloudProjectData;
      error?: string;
    };
    if (!res.ok || !data.project) {
      return { ok: false, error: data.error || 'Loyiha topilmadi.' };
    }
    return { ok: true, project: data.project };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminSendUserFileToTelegram(
  telegramId: string,
  fileId: string,
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(telegramId)}/files/${encodeURIComponent(fileId)}/send-telegram`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAdminHeaders(sessionToken, adminToken),
      }
    );
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || 'Botga yuborib bo‘lmadi.' };
    return { ok: true };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminSendProjectBlobToUserTelegram(params: {
  telegramId: string;
  blob: Blob;
  fileName: string;
  caption?: string;
  serviceTitle?: string;
  sessionToken: string;
  adminToken: string;
}): Promise<{ ok: boolean; file?: UserFileRecord; sentToTelegram?: boolean; telegramError?: string; error?: string }> {
  if (params.blob.size > MAX_TELEGRAM_FILE_BYTES) {
    return { ok: false, error: 'Fayl hajmi 15 MB dan oshib ketdi.' };
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(params.fileName),
      ...getAdminHeaders(params.sessionToken, params.adminToken),
    };
    if (params.caption) headers['X-File-Caption'] = encodeURIComponent(params.caption);
    if (params.serviceTitle) headers['X-Service-Title'] = encodeURIComponent(params.serviceTitle);
    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(params.telegramId)}/send-file`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: params.blob,
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      file?: UserFileRecord;
      sentToTelegram?: boolean;
      telegramError?: string;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: data.error || 'Faylni botga yuborib bo‘lmadi.' };
    return {
      ok: true,
      file: data.file,
      sentToTelegram: Boolean(data.sentToTelegram),
      telegramError: data.telegramError,
    };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminImpersonateUser(
  telegramId: string,
  sessionToken: string,
  adminToken: string
): Promise<{
  ok: boolean;
  user?: TelegramUser;
  sessionToken?: string;
  account?: TelegramAccountResponse;
  error?: string;
}> {
  try {
    const res = await fetch(
      `/api/admin/users/${encodeURIComponent(telegramId)}/impersonate`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAdminHeaders(sessionToken, adminToken),
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: TelegramUser;
      sessionToken?: string;
      account?: TelegramAccountResponse;
      error?: string;
    };
    if (!res.ok || !data.user || !data.sessionToken) {
      return { ok: false, error: data.error || 'Mijoz hisobiga kirib bo‘lmadi.' };
    }
    return {
      ok: true,
      user: data.user,
      sessionToken: data.sessionToken,
      account: data.account,
    };
  } catch {
    return { ok: false, error: "Server bilan bog'lanishda xatolik." };
  }
}

export async function adminListSupportTickets(
  sessionToken: string,
  adminToken: string
): Promise<{
  tickets: SupportTicketRow[];
  supportAgents: Array<{
    telegramId: string;
    firstName: string;
    username?: string;
    roleTitle: string;
    isSupportDefault?: boolean;
  }>;
  error?: string;
}> {
  const res = await fetch('/api/admin/support/tickets', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    tickets?: SupportTicketRow[];
    supportAgents?: Array<{
      telegramId: string;
      firstName: string;
      username?: string;
      roleTitle: string;
      isSupportDefault?: boolean;
    }>;
    error?: string;
  };
  if (!res.ok) return { tickets: [], supportAgents: [], error: data.error };
  return {
    tickets: Array.isArray(data.tickets) ? data.tickets : [],
    supportAgents: Array.isArray(data.supportAgents) ? data.supportAgents : [],
  };
}

export async function adminGetSupportThread(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string
): Promise<{
  ticket: SupportTicketRow | null;
  messages: InboxMessageRow[];
  userDetail: AdminUserDetailPayload | null;
  error?: string;
}> {
  const res = await fetch(
    `/api/admin/support/tickets/${encodeURIComponent(targetTelegramId)}`,
    {
      credentials: 'same-origin',
      headers: getAdminHeaders(sessionToken, adminToken),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    ticket?: SupportTicketRow | null;
    messages?: InboxMessageRow[];
    userDetail?: AdminUserDetailPayload | null;
    error?: string;
  };
  if (!res.ok) return { ticket: null, messages: [], userDetail: null, error: data.error };
  return {
    ticket: data.ticket || null,
    messages: Array.isArray(data.messages) ? data.messages : [],
    userDetail: data.userDetail || null,
  };
}

export async function adminReplySupportTicket(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  message: string,
  channel: 'site' | 'telegram' | 'both' = 'both'
): Promise<{
  ok: boolean;
  ticket?: SupportTicketRow;
  message?: InboxMessageRow;
  telegramSent?: boolean;
  error?: string;
}> {
  const res = await fetch(
    `/api/admin/support/tickets/${encodeURIComponent(targetTelegramId)}/reply`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeaders(sessionToken, adminToken),
      },
      body: JSON.stringify({ message, channel }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    ticket?: SupportTicketRow;
    message?: InboxMessageRow;
    telegramSent?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Javob yuborilmadi.' };
  return {
    ok: true,
    ticket: data.ticket,
    message: data.message,
    telegramSent: data.telegramSent,
  };
}

export async function adminAssignSupportTicket(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  assignedTo: string | null
): Promise<{ ok: boolean; assignedTo?: string | null; assignedName?: string | null; error?: string }> {
  const res = await fetch(
    `/api/admin/support/tickets/${encodeURIComponent(targetTelegramId)}/assign`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeaders(sessionToken, adminToken),
      },
      body: JSON.stringify({ assignedTo }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    assignedTo?: string | null;
    assignedName?: string | null;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Biriktirib bo‘lmadi.' };
  return { ok: true, assignedTo: data.assignedTo, assignedName: data.assignedName };
}

export async function adminUpdateSupportStatus(
  sessionToken: string,
  adminToken: string,
  targetTelegramId: string,
  status: SupportTicketStatus
): Promise<{
  ok: boolean;
  status?: SupportTicketStatus;
  closingMessage?: InboxMessageRow;
  error?: string;
}> {
  const res = await fetch(
    `/api/admin/support/tickets/${encodeURIComponent(targetTelegramId)}/status`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getAdminHeaders(sessionToken, adminToken),
      },
      body: JSON.stringify({ status }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    status?: SupportTicketStatus;
    closingMessage?: InboxMessageRow;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Holatni o'zgartirib bo'lmadi." };
  return { ok: true, status: data.status, closingMessage: data.closingMessage };
}

export async function adminListSecurityLogs(
  sessionToken: string,
  adminToken: string
): Promise<{ logs: SecurityLogRow[]; lastScan: SecurityScanReport | null; error?: string }> {
  const res = await fetch('/api/admin/security/logs', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    logs?: SecurityLogRow[];
    lastScan?: SecurityScanReport | null;
    error?: string;
  };
  if (!res.ok) return { logs: [], lastScan: null, error: data.error };
  return {
    logs: Array.isArray(data.logs) ? data.logs : [],
    lastScan: data.lastScan || null,
  };
}

export async function adminResolveSecurityLog(
  sessionToken: string,
  adminToken: string,
  logId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/security/logs/${encodeURIComponent(logId)}/resolve`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: data.error || 'Log yopilmadi.' };
  return { ok: true };
}

export async function adminRunSecurityScan(
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; report?: SecurityScanReport; error?: string }> {
  const res = await fetch('/api/admin/security/scan', {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    report?: SecurityScanReport;
    error?: string;
  };
  if (!res.ok || !data.report) {
    return { ok: false, error: data.error || 'Skaner ishga tushmadi.' };
  }
  return { ok: true, report: data.report };
}

export async function adminAnalyzeSecurityLogs(
  sessionToken: string,
  adminToken: string,
  notifyStaff = true
): Promise<{
  ok: boolean;
  unresolvedCount?: number;
  criticalCount?: number;
  topCategories?: Array<[string, number]>;
  topIps?: Array<[string, number]>;
  analysisText?: string;
  alertSent?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/admin/security/analyze', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ notifyStaff }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    unresolvedCount?: number;
    criticalCount?: number;
    topCategories?: Array<[string, number]>;
    topIps?: Array<[string, number]>;
    analysisText?: string;
    alertSent?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Log tahlili bajarilmadi.' };
  return {
    ok: true,
    unresolvedCount: data.unresolvedCount,
    criticalCount: data.criticalCount,
    topCategories: data.topCategories,
    topIps: data.topIps,
    analysisText: data.analysisText,
    alertSent: data.alertSent,
  };
}

export async function adminSetupTelegramWebhook(
  sessionToken: string,
  adminToken: string
): Promise<{
  ok: boolean;
  webhookUrl?: string;
  botUsername?: string | null;
  commandsUpdated?: boolean;
  menuButtonUpdated?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/admin/telegram/setup-webhook', {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    webhookUrl?: string;
    botUsername?: string | null;
    commandsUpdated?: boolean;
    menuButtonUpdated?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Webhook sozlanmadi.' };
  return {
    ok: true,
    webhookUrl: data.webhookUrl,
    botUsername: data.botUsername,
    commandsUpdated: data.commandsUpdated,
    menuButtonUpdated: data.menuButtonUpdated,
  };
}

export async function adminListAiProviders(
  sessionToken: string,
  adminToken: string
): Promise<{
  ok: boolean;
  providers: BackupAiProviderRecord[];
  defaultAiModel?: string;
  hasPrimaryOpenRouter?: boolean;
  hasPrimaryGemini?: boolean;
  error?: string;
}> {
  const res = await fetch('/api/admin/ai-providers', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    providers?: BackupAiProviderRecord[];
    defaultAiModel?: string;
    hasPrimaryOpenRouter?: boolean;
    hasPrimaryGemini?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, providers: [], error: data.error || 'AI provayderlarni yuklab bo‘lmadi.' };
  return {
    ok: true,
    providers: Array.isArray(data.providers) ? data.providers : [],
    defaultAiModel: data.defaultAiModel,
    hasPrimaryOpenRouter: Boolean(data.hasPrimaryOpenRouter),
    hasPrimaryGemini: Boolean(data.hasPrimaryGemini),
  };
}

export async function adminUpsertAiProvider(
  sessionToken: string,
  adminToken: string,
  payload: {
    id?: string;
    name: string;
    providerType: BackupAiProviderType;
    model: string;
    endpointUrl?: string;
    apiKey?: string;
    enabled: boolean;
    priority: number;
  }
): Promise<{ ok: boolean; providers?: BackupAiProviderRecord[]; error?: string }> {
  const res = await fetch('/api/admin/ai-providers', {
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
    providers?: BackupAiProviderRecord[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Zapaska AI saqlanmadi.' };
  return { ok: true, providers: Array.isArray(data.providers) ? data.providers : [] };
}

export async function adminDeleteAiProvider(
  sessionToken: string,
  adminToken: string,
  id: string
): Promise<{ ok: boolean; providers?: BackupAiProviderRecord[]; error?: string }> {
  const res = await fetch(`/api/admin/ai-providers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    providers?: BackupAiProviderRecord[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "O'chirib bo'lmadi." };
  return { ok: true, providers: Array.isArray(data.providers) ? data.providers : [] };
}

export async function adminTestAiProvider(
  sessionToken: string,
  adminToken: string,
  id: string
): Promise<{
  ok: boolean;
  latencyMs?: number;
  model?: string;
  providers?: BackupAiProviderRecord[];
  error?: string;
}> {
  const res = await fetch(`/api/admin/ai-providers/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    latencyMs?: number;
    model?: string;
    providers?: BackupAiProviderRecord[];
    error?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || 'AI sinovdan o‘tmadi.',
      providers: Array.isArray(data.providers) ? data.providers : undefined,
    };
  }
  return {
    ok: true,
    latencyMs: data.latencyMs,
    model: data.model,
    providers: Array.isArray(data.providers) ? data.providers : [],
  };
}

export async function adminListSystemApiKeys(
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; keys: SystemApiKeyRow[]; error?: string }> {
  const res = await fetch('/api/admin/api-keys', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    keys?: SystemApiKeyRow[];
    error?: string;
  };
  if (!res.ok) return { ok: false, keys: [], error: data.error || 'API kalitlarni yuklab bo‘lmadi.' };
  return { ok: true, keys: Array.isArray(data.keys) ? data.keys : [] };
}

export async function adminSaveSystemApiKey(
  sessionToken: string,
  adminToken: string,
  slot: SystemApiKeySlot,
  value: string
): Promise<{ ok: boolean; keys?: SystemApiKeyRow[]; error?: string }> {
  const res = await fetch('/api/admin/api-keys', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...getAdminHeaders(sessionToken, adminToken),
    },
    body: JSON.stringify({ slot, value }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    keys?: SystemApiKeyRow[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'API kalit saqlanmadi.' };
  return { ok: true, keys: Array.isArray(data.keys) ? data.keys : [] };
}

export async function adminDeleteSystemApiKey(
  sessionToken: string,
  adminToken: string,
  slot: SystemApiKeySlot
): Promise<{ ok: boolean; keys?: SystemApiKeyRow[]; error?: string }> {
  const res = await fetch(`/api/admin/api-keys/${encodeURIComponent(slot)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    keys?: SystemApiKeyRow[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Kalitni o'chirib bo'lmadi." };
  return { ok: true, keys: Array.isArray(data.keys) ? data.keys : [] };
}

export async function adminListMandatoryChannels(
  sessionToken: string,
  adminToken: string
): Promise<{ ok: boolean; channels: MandatoryChannelRecord[]; hasBotToken?: boolean; error?: string }> {
  const res = await fetch('/api/admin/channels', {
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    channels?: MandatoryChannelRecord[];
    hasBotToken?: boolean;
    error?: string;
  };
  if (!res.ok) return { ok: false, channels: [], error: data.error || 'Kanallarni yuklab bo‘lmadi.' };
  return {
    ok: true,
    channels: Array.isArray(data.channels) ? data.channels : [],
    hasBotToken: Boolean(data.hasBotToken),
  };
}

export async function adminUpsertMandatoryChannel(
  sessionToken: string,
  adminToken: string,
  payload: {
    id?: string;
    title: string;
    chatId: string;
    inviteUrl?: string;
    enabled: boolean;
    priority: number;
  }
): Promise<{ ok: boolean; channels?: MandatoryChannelRecord[]; error?: string }> {
  const res = await fetch('/api/admin/channels', {
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
    channels?: MandatoryChannelRecord[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || 'Kanal saqlanmadi.' };
  return { ok: true, channels: Array.isArray(data.channels) ? data.channels : [] };
}

export async function adminTestMandatoryChannel(
  sessionToken: string,
  adminToken: string,
  id: string
): Promise<{ ok: boolean; message?: string; channels?: MandatoryChannelRecord[]; error?: string }> {
  const res = await fetch(`/api/admin/channels/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    channels?: MandatoryChannelRecord[];
    error?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || 'Kanal tekshiruvdan o‘tmadi.',
      channels: Array.isArray(data.channels) ? data.channels : undefined,
    };
  }
  return {
    ok: true,
    message: data.message,
    channels: Array.isArray(data.channels) ? data.channels : [],
  };
}

export async function adminDeleteMandatoryChannel(
  sessionToken: string,
  adminToken: string,
  id: string
): Promise<{ ok: boolean; channels?: MandatoryChannelRecord[]; error?: string }> {
  const res = await fetch(`/api/admin/channels/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: getAdminHeaders(sessionToken, adminToken),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    channels?: MandatoryChannelRecord[];
    error?: string;
  };
  if (!res.ok) return { ok: false, error: data.error || "Kanal o'chirib bo'lmadi." };
  return { ok: true, channels: Array.isArray(data.channels) ? data.channels : [] };
}



