import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  BarChart3,
  Bell,
  Check,
  CheckCheck,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  Gift,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Tag,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { DEFAULT_PRICING_SETTINGS, formatSom } from '../data/defaults';
import {
  AdminAnalyticsPayload,
  AdminAuditRow,
  AdminOrderRow,
  AdminOverviewStats,
  AdminUserDetailPayload,
  AdminUserRow,
  AppPricingSettings,
  BroadcastLogRow,
  CrmEventRow,
  ManagerPermission,
  ManagerRecord,
  PromoCodeRow,
  SiteConfigSettings,
  StaffRole,
  TelegramUser,
  TolovgoPaymentMode,
} from '../types/editor';
import {
  adminAdjustUserBalance,
  adminChangePassword,
  adminDeleteManager,
  adminDeletePromo,
  adminGetAnalytics,
  adminGetOverview,
  adminGetStatus,
  adminGetUserDetail,
  adminListAuditLogs,
  adminListBroadcasts,
  adminListCrmEvents,
  adminListManagers,
  adminListOrders,
  adminListPromos,
  adminListUsers,
  adminLogin,
  adminLogout,
  adminMarkCrmEventsRead,
  adminSavePricing,
  adminSaveSettings,
  adminSaveSiteConfig,
  adminSendBroadcast,
  adminSendDirectMessage,
  adminSendTestTelegramAlert,
  adminSetupPassword,
  adminSetUserBanned,
  adminUpdateUserCrm,
  adminUpsertManager,
  adminUpsertPromo,
  adminVerifyOrder,
} from '../utils/telegramClient';

type AdminTab =
  | 'overview'
  | 'users'
  | 'managers'
  | 'orders'
  | 'pricing'
  | 'marketing'
  | 'security';

interface AdminDashboardProps {
  telegramUser: TelegramUser;
  telegramSessionToken: string;
  adminToken: string | null;
  staffRole?: StaffRole;
  initialPermissions?: ManagerPermission[];
  onAdminTokenChange: (token: string | null) => void;
  onPricingUpdated: (pricing: AppPricingSettings) => void;
  onTolovgoModeUpdated: (mode: TolovgoPaymentMode) => void;
  onSiteConfigUpdated?: (cfg: SiteConfigSettings) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
  onClose: () => void;
}

const SERVICE_LABELS: Array<{
  key: keyof AppPricingSettings['services'];
  title: string;
  unitLabel: string;
  hasSteps: boolean;
}> = [
  { key: 'academic_wave_pptx', title: 'Akademik To‘lqin · PPTX', unitLabel: 'slayd', hasSteps: true },
  { key: 'white_card_pptx', title: 'Oq Karta · PPTX', unitLabel: 'slayd', hasSteps: true },
  { key: 'stitched_notebook_pdf', title: 'Tikilgan Daftar · PDF', unitLabel: 'topshiriq bloki', hasSteps: true },
  { key: 'ai_canvas_design', title: 'AI Erkin Kanvas Dizayni', unitLabel: 'slayd', hasSteps: true },
  { key: 'five_block_infographic', title: '5-Blokli Infografika', unitLabel: 'poster', hasSteps: false },
];

const MANAGER_PERMISSION_LABELS: Array<{ id: ManagerPermission; label: string }> = [
  { id: 'overview', label: 'KPI va Analitika' },
  { id: 'crm_events', label: 'Jonli CRM Xabarnomalar' },
  { id: 'users', label: 'Foydalanuvchilar & CRM Teg' },
  { id: 'balance', label: 'Balans Boshqaruvi' },
  { id: 'orders', label: 'TolovGo Buyurtmalari' },
  { id: 'pricing', label: 'Narxlar & Bonuslar' },
  { id: 'promos', label: 'Promokodlar' },
  { id: 'broadcast', label: 'Telegram Broadcast' },
  { id: 'settings', label: 'Sayt & Gateway Sozlamalari' },
];

const CRM_TAGS = ['', 'yangi', 'faol', 'vip', 'korporativ', 'muammoli'] as const;

function formatDateTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csvContent =
    '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  telegramUser,
  telegramSessionToken,
  adminToken,
  staffRole: initialRole = 'user',
  initialPermissions = [],
  onAdminTokenChange,
  onPricingUpdated,
  onTolovgoModeUpdated,
  onSiteConfigUpdated,
  onNotify,
  onClose,
}) => {
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [passwordConfigured, setPasswordConfigured] = useState<boolean>(true);
  const [effectiveRole, setEffectiveRole] = useState<StaffRole>(initialRole);
  const [permissions, setPermissions] = useState<ManagerPermission[]>(initialPermissions);
  const [tolovgoCallbackUrl, setTolovgoCallbackUrl] = useState<string>(
    'https://slaydcanva.vercel.app/api/payments/tolovgo/callback'
  );
  const [telegramWebhookUrl, setTelegramWebhookUrl] = useState<string>(
    'https://slaydcanva.vercel.app/api/telegram/webhook'
  );

  // Auth Gate Inputs
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation & Core State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewStats>({
    totalUsers: 0,
    bannedUsers: 0,
    totalBalance: 0,
    totalPaidOrders: 0,
    totalPaidRevenue: 0,
    totalReferrals: 0,
    totalProjects: 0,
    activeManagers: 0,
    unreadCrmEvents: 0,
    todayRevenue: 0,
    todayNewUsers: 0,
  });
  const [analyticsDays, setAnalyticsDays] = useState<7 | 14 | 30>(14);
  const [analytics, setAnalytics] = useState<AdminAnalyticsPayload | null>(null);
  const [crmEvents, setCrmEvents] = useState<CrmEventRow[]>([]);
  const [crmFilter, setCrmFilter] = useState<'all' | 'new_user' | 'payment_paid' | 'unread'>('all');

  // Users & CRM
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userSegmentFilter, setUserSegmentFilter] = useState<
    'all' | 'active' | 'vip' | 'yangi' | 'banned' | 'zero'
  >('all');
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [crmEditTag, setCrmEditTag] = useState('');
  const [crmEditNote, setCrmEditNote] = useState('');
  const [savingCrm, setSavingCrm] = useState(false);
  const [dmText, setDmText] = useState('');
  const [sendingDm, setSendingDm] = useState(false);

  // Balance Adjust Modal
  const [balanceTarget, setBalanceTarget] = useState<AdminUserRow | null>(null);
  const [balanceOp, setBalanceOp] = useState<'add' | 'sub'>('add');
  const [balanceAmountText, setBalanceAmountText] = useState('10000');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceNotifyTg, setBalanceNotifyTg] = useState(true);
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  // Managers
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [mgrTelegramId, setMgrTelegramId] = useState('');
  const [mgrFirstName, setMgrFirstName] = useState('');
  const [mgrUsername, setMgrUsername] = useState('');
  const [mgrRoleTitle, setMgrRoleTitle] = useState('CRM Menejer');
  const [mgrPassword, setMgrPassword] = useState('');
  const [mgrNotifyTg, setMgrNotifyTg] = useState(true);
  const [mgrIsActive, setMgrIsActive] = useState(true);
  const [mgrPerms, setMgrPerms] = useState<ManagerPermission[]>([
    'overview',
    'crm_events',
    'users',
    'balance',
    'orders',
    'promos',
    'broadcast',
  ]);
  const [savingMgr, setSavingMgr] = useState(false);

  // Orders & TolovGo
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'pending' | 'test'>('all');
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [manualOrderId, setManualOrderId] = useState('');
  const [verifyingManualOrder, setVerifyingManualOrder] = useState(false);
  const [tolovgoMode, setTolovgoMode] = useState<TolovgoPaymentMode>('live');
  const [hasLiveKey, setHasLiveKey] = useState(false);
  const [hasTestKey, setHasTestKey] = useState(false);
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false);
  const [neonConfigured, setNeonConfigured] = useState(false);
  const [tablesReady, setTablesReady] = useState(false);
  const [savingMode, setSavingMode] = useState(false);

  // Pricing & Promos
  const [pricingDraft, setPricingDraft] = useState<AppPricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [savingPricing, setSavingPricing] = useState(false);
  const [promos, setPromos] = useState<PromoCodeRow[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoBonus, setPromoBonus] = useState('5000');
  const [promoMaxUses, setPromoMaxUses] = useState('50');
  const [promoExpireDays, setPromoExpireDays] = useState('30');
  const [savingPromo, setSavingPromo] = useState(false);

  // Marketing / Broadcast / Site Config
  const [broadcastSegment, setBroadcastSegment] = useState<'all' | 'active' | 'vip' | 'zero_balance'>('all');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastLogs, setBroadcastLogs] = useState<BroadcastLogRow[]>([]);
  const [siteConfigDraft, setSiteConfigDraft] = useState<SiteConfigSettings>({
    maintenanceMode: false,
    maintenanceMessage: '',
    announcementBanner: '',
    notifyNewUsersToStaff: true,
    notifyPaymentsToStaff: true,
    defaultAiModel: 'google/gemini-2.5-flash',
  });
  const [savingSiteCfg, setSavingSiteCfg] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);

  // Security & Audit
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const analyticsDaysRef = useRef(analyticsDays);
  analyticsDaysRef.current = analyticsDays;

  const isSuperAdmin = effectiveRole === 'super_admin';

  const hasPerm = useCallback(
    (perm: ManagerPermission | 'super_admin') => {
      if (effectiveRole === 'super_admin') return true;
      if (perm === 'super_admin') return false;
      return permissions.includes(perm);
    },
    [effectiveRole, permissions]
  );

  useEffect(() => {
    const allowed: Record<AdminTab, boolean> = {
      overview: hasPerm('overview') || hasPerm('crm_events'),
      users: hasPerm('users') || hasPerm('balance'),
      managers: true,
      orders: hasPerm('orders') || hasPerm('settings'),
      pricing: hasPerm('pricing') || hasPerm('promos'),
      marketing: hasPerm('broadcast') || hasPerm('settings'),
      security: true,
    };
    if (!allowed[activeTab]) {
      const firstAllowed = (Object.keys(allowed) as AdminTab[]).find((k) => allowed[k]);
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [activeTab, hasPerm]);

  const copyText = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  useEffect(() => {
    let active = true;
    setStatusLoading(true);
    setStatusError(null);
    void adminGetStatus(telegramSessionToken, adminToken).then((res) => {
      if (!active) return;
      if ('error' in res) {
        setStatusError(res.error);
        if (res.status === 401 || res.status === 403) {
          onAdminTokenChange(null);
        }
      } else {
        setPasswordConfigured(res.passwordConfigured);
        if (res.staffRole) setEffectiveRole(res.staffRole);
        if (Array.isArray(res.permissions)) setPermissions(res.permissions);
        if (res.tolovgoCallbackUrl) setTolovgoCallbackUrl(res.tolovgoCallbackUrl);
        if (res.telegramWebhookUrl) setTelegramWebhookUrl(res.telegramWebhookUrl);
        if (res.adminUnlocked && res.adminToken && !adminToken) {
          onAdminTokenChange(res.adminToken);
        } else if (adminToken && !res.adminUnlocked) {
          onAdminTokenChange(null);
        }
      }
      setStatusLoading(false);
    });
    return () => {
      active = false;
    };
  }, [telegramSessionToken, adminToken, onAdminTokenChange]);

  const loadAllAdminData = useCallback(
    async (token: string, daysOverride?: 7 | 14 | 30) => {
      setLoadingData(true);
      try {
        const res = await adminGetOverview(telegramSessionToken, token);
        if ('error' in res) {
          if (res.status === 401 || res.status === 403) {
            onAdminTokenChange(null);
          }
          onNotify('err', res.error);
          return;
        }
        if (res.staffRole) setEffectiveRole(res.staffRole);
        if (Array.isArray(res.permissions)) setPermissions(res.permissions);
        setOverview(res.overview);
        setOrders(res.orders);
        setAuditLogs(res.auditLogs);
        setPricingDraft(res.pricing);
        setTolovgoMode(res.tolovgoMode);
        if (res.siteConfig) setSiteConfigDraft(res.siteConfig);
        if (Array.isArray(res.managers)) setManagers(res.managers);
        if (Array.isArray(res.crmEvents)) setCrmEvents(res.crmEvents);
        setHasLiveKey(res.hasLiveKey);
        setHasTestKey(res.hasTestKey);
        setHasWebhookSecret(Boolean(res.hasWebhookSecret));
        setNeonConfigured(res.neonConfigured);
        setTablesReady(res.tablesReady);
        if (res.tolovgoCallbackUrl) setTolovgoCallbackUrl(res.tolovgoCallbackUrl);
        if (res.telegramWebhookUrl) setTelegramWebhookUrl(res.telegramWebhookUrl);

        const roleNow = res.staffRole || initialRole;
        const permsNow = res.permissions || initialPermissions;
        const can = (p: ManagerPermission) => roleNow === 'super_admin' || permsNow.includes(p);

        await Promise.all([
          can('users')
            ? adminListUsers(telegramSessionToken, token, '').then((r) => setUsers(r.users))
            : Promise.resolve(),
          can('overview')
            ? adminGetAnalytics(
                telegramSessionToken,
                token,
                daysOverride || analyticsDaysRef.current
              ).then((r) => {
                if (r.analytics) setAnalytics(r.analytics);
              })
            : Promise.resolve(),
          can('promos')
            ? adminListPromos(telegramSessionToken, token).then((r) => setPromos(r.promos))
            : Promise.resolve(),
          can('broadcast')
            ? adminListBroadcasts(telegramSessionToken, token).then((r) => setBroadcastLogs(r.logs))
            : Promise.resolve(),
        ]);
      } finally {
        setLoadingData(false);
      }
    },
    [telegramSessionToken, onAdminTokenChange, onNotify, initialRole, initialPermissions]
  );

  useEffect(() => {
    if (adminToken) {
      void loadAllAdminData(adminToken);
    }
  }, [adminToken, loadAllAdminData]);

  const handleChangeAnalyticsDays = async (days: 7 | 14 | 30) => {
    setAnalyticsDays(days);
    if (!adminToken) return;
    const r = await adminGetAnalytics(telegramSessionToken, adminToken, days);
    if (r.analytics) setAnalytics(r.analytics);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const minLen = effectiveRole === 'manager' ? 6 : 8;
    if (passwordInput.length < minLen) {
      setAuthError(`Parol kamida ${minLen} ta belgidan iborat bo'lishi kerak.`);
      return;
    }
    if (!passwordConfigured && passwordInput !== confirmPasswordInput) {
      setAuthError('Tasdiqlash paroli mos kelmadi.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = passwordConfigured
        ? await adminLogin(telegramSessionToken, passwordInput)
        : await adminSetupPassword(telegramSessionToken, passwordInput);

      if (!res.ok) {
        if ('code' in res && res.code === 'password_not_set') {
          setPasswordConfigured(false);
        }
        setAuthError(res.error);
        return;
      }

      if (res.staffRole) setEffectiveRole(res.staffRole);
      if (res.permissions) setPermissions(res.permissions);
      setPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordConfigured(true);
      onAdminTokenChange(res.adminToken);
      onNotify(
        'ok',
        passwordConfigured
          ? '15 kunlik boshqaruv sessiyasi ochildi.'
          : "Maxfiy parol o'rnatildi va 15 kunlik sessiya ochildi."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLockSession = async () => {
    await adminLogout(telegramSessionToken);
    onAdminTokenChange(null);
    onNotify('ok', 'Panel qulflandi.');
  };

  const handleMarkAllEventsRead = async () => {
    if (!adminToken) return;
    const ok = await adminMarkCrmEventsRead(telegramSessionToken, adminToken);
    if (ok) {
      setCrmEvents((prev) => prev.map((ev) => ({ ...ev, isRead: true })));
      setOverview((prev) => ({ ...prev, unreadCrmEvents: 0 }));
      onNotify('ok', "Barcha CRM bildirishnomalari o'qilgan deb belgilandi.");
    }
  };

  const handleSearchUsers = async (queryText: string) => {
    if (!adminToken) return;
    setUsersLoading(true);
    try {
      const res = await adminListUsers(telegramSessionToken, adminToken, queryText);
      if (res.error) onNotify('err', res.error);
      else setUsers(res.users);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleOpenUserDetail = async (telegramId: string) => {
    if (!adminToken) return;
    setDetailLoading(true);
    try {
      const res = await adminGetUserDetail(telegramSessionToken, adminToken, telegramId);
      if (!res.detail) {
        onNotify('err', res.error || "Foydalanuvchi profili yuklanmadi.");
        return;
      }
      setSelectedUserDetail(res.detail);
      setCrmEditTag(res.detail.user.crmTag || '');
      setCrmEditNote(res.detail.user.crmNote || '');
      setDmText('');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveUserCrm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !selectedUserDetail) return;
    setSavingCrm(true);
    try {
      const res = await adminUpdateUserCrm(
        telegramSessionToken,
        adminToken,
        selectedUserDetail.user.telegramId,
        crmEditTag,
        crmEditNote
      );
      if (!res.ok) {
        onNotify('err', res.error || "CRM izohi saqlanmadi.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.telegramId === selectedUserDetail.user.telegramId
            ? { ...u, crmTag: crmEditTag, crmNote: crmEditNote }
            : u
        )
      );
      setSelectedUserDetail((prev) =>
        prev
          ? { ...prev, user: { ...prev.user, crmTag: crmEditTag, crmNote: crmEditNote } }
          : null
      );
      onNotify('ok', 'CRM teg va izoh saqlandi.');
    } finally {
      setSavingCrm(false);
    }
  };

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !selectedUserDetail || !dmText.trim()) return;
    setSendingDm(true);
    try {
      const res = await adminSendDirectMessage(
        telegramSessionToken,
        adminToken,
        selectedUserDetail.user.telegramId,
        dmText.trim()
      );
      if (!res.ok) {
        onNotify('err', res.error || 'Xabar yuborilmadi.');
        return;
      }
      setDmText('');
      onNotify('ok', 'Foydalanuvchiga Telegram bot orqali xabar yuborildi.');
    } finally {
      setSendingDm(false);
    }
  };

  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !balanceTarget) return;
    const raw = Math.round(Number(balanceAmountText.replace(/\D/g, '')) || 0);
    if (raw <= 0) {
      onNotify('err', 'Summani kiriting.');
      return;
    }
    const delta = balanceOp === 'add' ? raw : -raw;
    const reason =
      balanceReason.trim() ||
      (delta > 0 ? "Xodim tomonidan balans to'ldirildi" : 'Xodim tomonidan balans tuzatildi');

    setBalanceSubmitting(true);
    try {
      const res = await adminAdjustUserBalance(
        telegramSessionToken,
        adminToken,
        balanceTarget.telegramId,
        delta,
        reason,
        balanceNotifyTg
      );
      if (!res.ok) {
        onNotify('err', res.error || 'Xatolik yuz berdi.');
        return;
      }
      onNotify('ok', `Balans yangilandi: ${formatSom(res.balance ?? 0)}`);
      setBalanceTarget(null);
      setBalanceReason('');
      await Promise.all([handleSearchUsers(userSearch), loadAllAdminData(adminToken)]);
    } finally {
      setBalanceSubmitting(false);
    }
  };

  const handleToggleBan = async (u: AdminUserRow) => {
    if (!adminToken) return;
    if (u.telegramId === telegramUser.telegramId) {
      onNotify('err', "O'z hisobingizni bloklab bo'lmaydi.");
      return;
    }
    const nextBanned = !u.isBanned;
    const res = await adminSetUserBanned(telegramSessionToken, adminToken, u.telegramId, nextBanned);
    if (!res.ok) {
      onNotify('err', res.error || 'Xatolik yuz berdi.');
      return;
    }
    onNotify('ok', nextBanned ? `${u.firstName} bloklandi.` : `${u.firstName} blokdan chiqarildi.`);
    setUsers((prev) =>
      prev.map((row) => (row.telegramId === u.telegramId ? { ...row, isBanned: nextBanned } : row))
    );
    const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
    setAuditLogs(logsRes.logs);
  };

  const handleSaveManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (!/^\d{3,20}$/.test(mgrTelegramId.trim())) {
      onNotify('err', "Menejerning to'g'ri Telegram ID raqamini kiriting.");
      return;
    }
    setSavingMgr(true);
    try {
      const res = await adminUpsertManager(telegramSessionToken, adminToken, {
        telegramId: mgrTelegramId.trim(),
        firstName: mgrFirstName.trim() || `Menejer ${mgrTelegramId.trim().slice(-4)}`,
        username: mgrUsername.trim() || undefined,
        roleTitle: mgrRoleTitle.trim() || 'CRM Menejer',
        permissions: mgrPerms,
        password: mgrPassword.trim() || undefined,
        isActive: mgrIsActive,
        notifyTelegram: mgrNotifyTg,
      });
      if (!res.ok) {
        onNotify('err', res.error || "Menejerni saqlab bo'lmadi.");
        return;
      }
      onNotify('ok', 'Menejer saqlandi va Telegram bot orqali xabardor qilindi.');
      setMgrTelegramId('');
      setMgrFirstName('');
      setMgrUsername('');
      setMgrPassword('');
      const [mgrRes, evRes] = await Promise.all([
        adminListManagers(telegramSessionToken, adminToken),
        adminListCrmEvents(telegramSessionToken, adminToken),
      ]);
      setManagers(mgrRes.managers);
      setCrmEvents(evRes.events);
    } finally {
      setSavingMgr(false);
    }
  };

  const handleDeleteManagerClick = async (tid: string) => {
    if (!adminToken) return;
    const res = await adminDeleteManager(telegramSessionToken, adminToken, tid);
    if (!res.ok) {
      onNotify('err', res.error || "Menejerni o'chirib bo'lmadi.");
      return;
    }
    setManagers((prev) => prev.filter((m) => m.telegramId !== tid));
    onNotify('ok', `Menejer (ID ${tid}) o'chirildi.`);
  };

  const handleVerifyOrderAction = async (orderId: string, manual = false) => {
    if (!adminToken || !orderId.trim()) return;
    if (manual) setVerifyingManualOrder(true);
    else setCheckingOrderId(orderId);
    try {
      const res = await adminVerifyOrder(telegramSessionToken, adminToken, orderId.trim());
      if (!res.ok) {
        onNotify('err', res.error || "Buyurtmani tekshirib bo'lmadi.");
        return;
      }
      onNotify(
        'ok',
        `#${orderId.trim()}: ${res.status}${res.newlyCredited ? ' (balansga tushirildi!)' : ''}`
      );
      if (manual) setManualOrderId('');
      const [ordRes] = await Promise.all([
        adminListOrders(telegramSessionToken, adminToken),
        loadAllAdminData(adminToken),
      ]);
      setOrders(ordRes.orders);
    } finally {
      setVerifyingManualOrder(false);
      setCheckingOrderId(null);
    }
  };

  const handleSavePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingPricing(true);
    try {
      const res = await adminSavePricing(telegramSessionToken, adminToken, pricingDraft);
      if (!res.ok || !res.pricing) {
        onNotify('err', res.error || "Narxlarni saqlab bo'lmadi.");
        return;
      }
      setPricingDraft(res.pricing);
      onPricingUpdated(res.pricing);
      onNotify('ok', 'Xizmat narxlari va bonus qoidalari saqlandi.');
      const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
      setAuditLogs(logsRes.logs);
    } finally {
      setSavingPricing(false);
    }
  };

  const handleCreatePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingPromo(true);
    try {
      const res = await adminUpsertPromo(telegramSessionToken, adminToken, {
        code: promoCode.trim().toUpperCase(),
        bonusAmount: Math.round(Number(promoBonus.replace(/\D/g, '')) || 0),
        maxUses: Math.round(Number(promoMaxUses.replace(/\D/g, '')) || 50),
        isActive: true,
        expiresDays: Math.round(Number(promoExpireDays.replace(/\D/g, '')) || 30),
      });
      if (!res.ok) {
        onNotify('err', res.error || "Promokodni saqlab bo'lmadi.");
        return;
      }
      setPromoCode('');
      const pr = await adminListPromos(telegramSessionToken, adminToken);
      setPromos(pr.promos);
      onNotify('ok', 'Promokod yaratildi va faollashtirildi.');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromoActive = async (p: PromoCodeRow) => {
    if (!adminToken) return;
    const res = await adminUpsertPromo(telegramSessionToken, adminToken, {
      code: p.code,
      bonusAmount: p.bonusAmount,
      maxUses: p.maxUses,
      isActive: !p.isActive,
    });
    if (res.ok) {
      setPromos((prev) =>
        prev.map((row) => (row.code === p.code ? { ...row, isActive: !p.isActive } : row))
      );
      onNotify('ok', `${p.code}: ${!p.isActive ? 'Faollashtirildi' : "O'chirildi"}`);
    }
  };

  const handleDeletePromoClick = async (code: string) => {
    if (!adminToken) return;
    const res = await adminDeletePromo(telegramSessionToken, adminToken, code);
    if (res.ok) {
      setPromos((prev) => prev.filter((p) => p.code !== code));
      onNotify('ok', `${code} o'chirildi.`);
    }
  };

  const handleSendBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || sendingBroadcast) return;
    setSendingBroadcast(true);
    try {
      const res = await adminSendBroadcast(
        telegramSessionToken,
        adminToken,
        broadcastSegment,
        broadcastMsg
      );
      if (!res.ok || !res.log) {
        onNotify('err', res.error || 'Xabarnoma yuborilmadi.');
        return;
      }
      setBroadcastMsg('');
      setBroadcastLogs((prev) => [res.log!, ...prev]);
      onNotify(
        'ok',
        `Xabarnoma yuborildi: ${res.log.sentCount}/${res.log.totalTargets} ta yetkazildi.`
      );
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSaveSiteConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setSavingSiteCfg(true);
    try {
      const res = await adminSaveSiteConfig(telegramSessionToken, adminToken, siteConfigDraft);
      if (!res.ok || !res.siteConfig) {
        onNotify('err', res.error || "Sayt sozlamalari saqlanmadi.");
        return;
      }
      setSiteConfigDraft(res.siteConfig);
      onSiteConfigUpdated?.(res.siteConfig);
      onNotify('ok', 'Sayt e’loni va texnik rejim sozlamalari saqlandi.');
    } finally {
      setSavingSiteCfg(false);
    }
  };

  const handleTestTelegramAlert = async () => {
    if (!adminToken) return;
    setTestingAlert(true);
    try {
      const res = await adminSendTestTelegramAlert(telegramSessionToken, adminToken);
      if (!res.ok) onNotify('err', res.error || 'Sinov xabari ketmadi.');
      else onNotify('ok', 'Admin va barcha faol menejerlarga sinov xabari yuborildi.');
    } finally {
      setTestingAlert(false);
    }
  };

  const handleChangeTolovgoModeAdmin = async (nextMode: TolovgoPaymentMode) => {
    if (!adminToken || savingMode) return;
    setSavingMode(true);
    try {
      const res = await adminSaveSettings(telegramSessionToken, adminToken, nextMode);
      if (!res.ok || !res.tolovgoMode) {
        onNotify('err', res.error || "Rejimni saqlab bo'lmadi.");
        return;
      }
      setTolovgoMode(res.tolovgoMode);
      onTolovgoModeUpdated(res.tolovgoMode);
      onNotify(
        'ok',
        res.tolovgoMode === 'test'
          ? 'TolovGo Sinov rejimi yoqildi.'
          : 'TolovGo Haqiqiy to‘lov rejimi yoqildi.'
      );
      const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
      setAuditLogs(logsRes.logs);
    } finally {
      setSavingMode(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (newPwd.length < 8) {
      onNotify('err', "Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPwd !== newPwdConfirm) {
      onNotify('err', 'Yangi parol tasdig‘i mos kelmadi.');
      return;
    }
    setChangingPwd(true);
    try {
      const res = await adminChangePassword(telegramSessionToken, adminToken, curPwd, newPwd);
      if (!res.ok) {
        onNotify('err', res.error || "Parolni yangilab bo'lmadi.");
        return;
      }
      setCurPwd('');
      setNewPwd('');
      setNewPwdConfirm('');
      onNotify('ok', 'Maxfiy admin paroli yangilandi.');
      const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
      setAuditLogs(logsRes.logs);
    } finally {
      setChangingPwd(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'all') return orders;
    if (orderFilter === 'test') return orders.filter((o) => o.isTest);
    return orders.filter((o) => o.status === orderFilter);
  }, [orders, orderFilter]);

  const filteredUsers = useMemo(() => {
    if (userSegmentFilter === 'all') return users;
    if (userSegmentFilter === 'banned') return users.filter((u) => u.isBanned);
    if (userSegmentFilter === 'zero') return users.filter((u) => u.balance <= 0);
    if (userSegmentFilter === 'vip') return users.filter((u) => u.crmTag === 'vip');
    if (userSegmentFilter === 'yangi') return users.filter((u) => u.crmTag === 'yangi');
    return users.filter((u) => !u.isBanned);
  }, [users, userSegmentFilter]);

  const filteredCrmEvents = useMemo(() => {
    if (crmFilter === 'all') return crmEvents;
    if (crmFilter === 'unread') return crmEvents.filter((e) => !e.isRead);
    return crmEvents.filter((e) => e.eventType === crmFilter);
  }, [crmEvents, crmFilter]);

  // =========================================================================
  // 1) Security Gate Screen (15-Day Cookie Session)
  // =========================================================================
  if (!adminToken) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F4F4F6] flex flex-col">
        <header className="h-[54px] bg-[#111113] text-white border-b border-zinc-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="font-display text-sm font-bold tracking-tight">
              SlaydCanva {effectiveRole === 'manager' ? 'Menejer CRM' : 'Admin CRM'} · Xavfsizlik
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Saytga qaytish</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-5">
            {statusLoading ? (
              <div className="py-10 flex flex-col items-center gap-2.5 text-xs text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                <span>Xodim ruxsati va 15 kunlik cookie tekshirilmoqda...</span>
              </div>
            ) : statusError ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{statusError}</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-[#111113] text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
                >
                  Orqaga qaytish
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                    <Lock className="w-3.5 h-3.5 text-red-600" />
                    <span>
                      {effectiveRole === 'manager' ? 'MENEJER' : 'SUPER ADMIN'} ID:{' '}
                      {telegramUser.telegramId}
                    </span>
                  </div>
                  <h1 className="font-display text-lg font-bold text-zinc-900">
                    {passwordConfigured
                      ? effectiveRole === 'manager'
                        ? 'Menejer CRM paneliga kirish'
                        : 'Admin CRM paneliga kirish'
                      : "1-marta kirish: Maxfiy parol o'rnatish"}
                  </h1>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {passwordConfigured
                      ? 'Parol bir marta tasdiqlangach, 15 kunlik HttpOnly cookie sessiyasi saqlanadi — qayta parol so‘ralmaydi.'
                      : 'Panelni himoyalash uchun kamida 8 belgili maxfiy parol o‘rnating (bazada scrypt bilan shifrlanadi).'}
                  </p>
                </div>

                {authError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-secret-pwd"
                      className="block text-xs font-medium text-zinc-700"
                    >
                      {passwordConfigured ? 'Maxfiy kirish paroli' : 'Yangi maxfiy parol'}
                    </label>
                    <input
                      id="admin-secret-pwd"
                      type="password"
                      autoFocus
                      autoComplete={passwordConfigured ? 'current-password' : 'new-password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={
                        effectiveRole === 'manager' ? 'Kamida 6 ta belgi' : 'Kamida 8 ta belgi'
                      }
                      className="w-full text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                    />
                  </div>

                  {!passwordConfigured && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-secret-pwd-confirm"
                        className="block text-xs font-medium text-zinc-700"
                      >
                        Parolni tasdiqlang
                      </label>
                      <input
                        id="admin-secret-pwd-confirm"
                        type="password"
                        autoComplete="new-password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Parolni qayta kiriting"
                        className="w-full text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {authSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <KeyRound className="w-4 h-4" />
                    )}
                    <span>
                      {passwordConfigured ? 'Panelni ochish (15 kun)' : "Parolni o'rnatish va kirish"}
                    </span>
                  </button>
                </form>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // 2) Full Admin & Manager CRM Workspace (20 Systems)
  // =========================================================================
  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
    badge?: number;
  }> = [
    {
      id: 'overview',
      label: 'CRM & Analitika',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: hasPerm('overview') || hasPerm('crm_events'),
      badge: overview.unreadCrmEvents || crmEvents.filter((e) => !e.isRead).length || undefined,
    },
    {
      id: 'users',
      label: 'Foydalanuvchilar',
      icon: <Users className="w-4 h-4" />,
      visible: hasPerm('users') || hasPerm('balance'),
    },
    {
      id: 'managers',
      label: 'Menejerlar Jamoasi',
      icon: <UserCheck className="w-4 h-4" />,
      visible: true,
    },
    {
      id: 'orders',
      label: 'TolovGo & Buyurtmalar',
      icon: <CreditCard className="w-4 h-4" />,
      visible: hasPerm('orders') || hasPerm('settings'),
    },
    {
      id: 'pricing',
      label: 'Narxlar & Promokod',
      icon: <Sliders className="w-4 h-4" />,
      visible: hasPerm('pricing') || hasPerm('promos'),
    },
    {
      id: 'marketing',
      label: 'Bot Xabar & Sayt',
      icon: <Megaphone className="w-4 h-4" />,
      visible: hasPerm('broadcast') || hasPerm('settings'),
    },
    {
      id: 'security',
      label: 'Xavfsizlik & Audit',
      icon: <ShieldCheck className="w-4 h-4" />,
      visible: true,
    },
  ];

  const visibleNavItems = navItems.filter((n) => n.visible);
  const dailyPoints = analytics?.daily || [];
  const maxDailyRevenue = Math.max(1000, ...dailyPoints.map((d) => d.paidRevenue));
  const maxDailyUsers = Math.max(1, ...dailyPoints.map((d) => d.newUsers));

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F4F6] flex flex-col md:flex-row overflow-hidden">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#111113] text-white border-r border-zinc-800 flex-col">
        <div className="h-[54px] px-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-display text-sm font-bold tracking-tight truncate">
              Slayd<span className="text-red-500">Canva</span>{' '}
              {isSuperAdmin ? 'Admin' : 'Menejer'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-semibold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 space-y-0.5">
            <div className="font-medium text-zinc-200 truncate">
              {telegramUser.username ? `@${telegramUser.username}` : telegramUser.firstName}
            </div>
            <div className="font-mono tabular-nums text-zinc-500">
              {isSuperAdmin ? 'Super Admin' : 'Menejer'} · ID {telegramUser.telegramId}
            </div>
            <div className="text-[10px] text-zinc-500">15 kunlik cookie faol</div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => void handleLockSession()}
              className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
            >
              <Lock className="w-3 h-3" />
              <span>Qulflash</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-white flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Saytga</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-[54px] shrink-0 bg-white border-b border-zinc-200 px-4 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              aria-label="Saytga qaytish"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display text-sm md:text-base font-bold text-zinc-900 truncate">
              {visibleNavItems.find((n) => n.id === activeTab)?.label || 'CRM Boshqaruv'}
            </h1>
            <span className="hidden sm:inline text-xs text-zinc-400">·</span>
            <span className="hidden sm:inline text-xs font-mono text-zinc-500 truncate">
              TolovGo: {tolovgoMode === 'test' ? 'Sinov' : 'Haqiqiy'} · Imzo:{' '}
              {hasWebhookSecret ? 'Yoqilgan' : 'Kutilmoqda'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={loadingData}
              onClick={() => void loadAllAdminData(adminToken)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex px-3 py-1.5 rounded-lg bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Muhitga qaytish</span>
            </button>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="md:hidden shrink-0 bg-white border-b border-zinc-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
          {visibleNavItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-colors ${
                  active ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* ============================================================
                TAB 1: CRM OVERVIEW, ANALYTICS, LIVE INBOX, TOP SPENDERS (#1-#4)
                ============================================================ */}
            {activeTab === 'overview' && (
              <>
                {/* #1 KPI Dashboard */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1">
                    <div className="text-xs text-zinc-500">Jami foydalanuvchilar</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {overview.totalUsers.toLocaleString('uz-UZ').replace(/,/g, ' ')}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Bugun +{overview.todayNewUsers || 0} · Blok: {overview.bannedUsers}
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1">
                    <div className="text-xs text-zinc-500">TolovGo jami tushumi</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                      {formatSom(overview.totalPaidRevenue)}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Bugun: {formatSom(overview.todayRevenue || 0)} · {overview.totalPaidOrders} ta
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1">
                    <div className="text-xs text-zinc-500">Serverdagi foydalanuvchi balansi</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {formatSom(overview.totalBalance)}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Loyihalar: {overview.totalProjects} · Referal: {overview.totalReferrals}
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1">
                    <div className="text-xs text-zinc-500">Jamoa va CRM Inbox</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {overview.unreadCrmEvents ?? crmEvents.filter((e) => !e.isRead).length} ta yangi
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Faol menejerlar: {overview.activeManagers ?? managers.filter((m) => m.isActive).length} ta
                    </div>
                  </div>
                </section>

                {/* #2 Revenue & Growth Analytics Charts */}
                {hasPerm('overview') && (
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-red-600" />
                          <span>Tushum va yangi foydalanuvchilar dinamikasi</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          TolovGo to‘lovlari va ro‘yxatdan o‘tgan foydalanuvchilarning kunlik statistikasi
                        </p>
                      </div>
                      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl self-start">
                        {([7, 14, 30] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => void handleChangeAnalyticsDays(d)}
                            className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap ${
                              analyticsDays === d
                                ? 'bg-white text-zinc-900 shadow-xs'
                                : 'text-zinc-600 hover:text-zinc-900'
                            }`}
                          >
                            {d} kun
                          </button>
                        ))}
                      </div>
                    </div>

                    {dailyPoints.length === 0 ? (
                      <div className="py-8 text-center text-xs text-zinc-400">
                        Tanlangan davr uchun ma'lumotlar hali shakllanmagan.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-zinc-700">
                            Kunlik TolovGo tushumi (so‘m)
                          </div>
                          <div className="h-36 flex items-end gap-1.5 pt-2 border-b border-zinc-200">
                            {dailyPoints.map((pt) => {
                              const pct = Math.max(4, Math.round((pt.paidRevenue / maxDailyRevenue) * 100));
                              return (
                                <div
                                  key={`rev-${pt.day}`}
                                  className="flex-1 flex flex-col items-center justify-end h-full group"
                                  title={`${pt.day}: ${formatSom(pt.paidRevenue)} (${pt.paidOrders} ta)`}
                                >
                                  <div
                                    style={{ height: `${pct}%` }}
                                    className="w-full max-w-[26px] rounded-t-md bg-emerald-600/85 group-hover:bg-emerald-600 transition-colors"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>{dailyPoints[0]?.day || ''}</span>
                            <span>{dailyPoints[dailyPoints.length - 1]?.day || ''}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-xs font-medium text-zinc-700">
                            Yangi foydalanuvchilar o‘sishi (kishi)
                          </div>
                          <div className="h-36 flex items-end gap-1.5 pt-2 border-b border-zinc-200">
                            {dailyPoints.map((pt) => {
                              const pct = Math.max(6, Math.round((pt.newUsers / maxDailyUsers) * 100));
                              return (
                                <div
                                  key={`usr-${pt.day}`}
                                  className="flex-1 flex flex-col items-center justify-end h-full group"
                                  title={`${pt.day}: +${pt.newUsers} kishi`}
                                >
                                  <div
                                    style={{ height: `${pct}%` }}
                                    className="w-full max-w-[26px] rounded-t-md bg-red-600/85 group-hover:bg-red-600 transition-colors"
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                            <span>{dailyPoints[0]?.day || ''}</span>
                            <span>{dailyPoints[dailyPoints.length - 1]?.day || ''}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* #3 Live CRM Notifications Feed */}
                  {hasPerm('crm_events') && (
                    <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
                      <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-red-600" />
                          <h2 className="text-sm font-semibold text-zinc-900">
                            Jonli CRM voqealar lentasi
                          </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg">
                            {(
                              [
                                { id: 'all', label: 'Barchasi' },
                                { id: 'payment_paid', label: 'To‘lovlar' },
                                { id: 'new_user', label: 'Yangi userlar' },
                                { id: 'unread', label: 'O‘qilmagan' },
                              ] as const
                            ).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setCrmFilter(f.id)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                                  crmFilter === f.id
                                    ? 'bg-white text-zinc-900 shadow-xs'
                                    : 'text-zinc-600 hover:text-zinc-900'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleMarkAllEventsRead()}
                            className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-[11px] font-medium text-zinc-700 flex items-center gap-1 whitespace-nowrap"
                          >
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>O‘qildi</span>
                          </button>
                        </div>
                      </div>

                      <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto">
                        {filteredCrmEvents.length === 0 ? (
                          <div className="py-10 text-center text-xs text-zinc-400">
                            Hozircha CRM voqealari yo‘q. Yangi foydalanuvchi kirganda yoki TolovGo to‘lovi tushganda shu yerda hamda Telegram botda ko‘rinadi.
                          </div>
                        ) : (
                          filteredCrmEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className={`px-4 py-3 flex items-start justify-between gap-3 ${
                                !ev.isRead ? 'bg-red-50/40' : 'hover:bg-zinc-50'
                              }`}
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="text-xs font-semibold text-zinc-900">
                                  {ev.title}
                                </div>
                                <div className="text-[11px] text-zinc-600">{ev.message}</div>
                                <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5">
                                  <span>{ev.eventType}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{formatDateTime(ev.createdAt)}</span>
                                </div>
                              </div>
                              {typeof ev.amount === 'number' && ev.amount !== 0 && (
                                <span
                                  className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                                    ev.amount > 0 ? 'text-emerald-700' : 'text-zinc-700'
                                  }`}
                                >
                                  {ev.amount > 0 ? `+${formatSom(ev.amount)}` : formatSom(ev.amount)}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  )}

                  {/* #4 Top Customers Leaderboard */}
                  <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-zinc-200">
                      <h2 className="text-sm font-semibold text-zinc-900">Top Mijozlar</h2>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        TolovGo orqali eng ko‘p to‘lov qilgan mijozlar
                      </p>
                    </div>
                    <div className="divide-y divide-zinc-100 flex-1 overflow-y-auto max-h-[380px]">
                      {(analytics?.topSpenders || []).length === 0 ? (
                        <div className="py-10 text-center text-xs text-zinc-400">
                          Ma'lumotlar yo‘q.
                        </div>
                      ) : (
                        analytics!.topSpenders.map((sp, idx) => (
                          <button
                            key={sp.telegramId}
                            type="button"
                            onClick={() => {
                              setActiveTab('users');
                              void handleOpenUserDetail(sp.telegramId);
                            }}
                            className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-zinc-50 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-zinc-900 truncate">
                                <span className="font-mono text-zinc-400 mr-1.5">
                                  {String(idx + 1).padStart(2, '0')}.
                                </span>
                                {sp.firstName} {sp.username ? `(@${sp.username})` : ''}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-500">
                                ID {sp.telegramId} · Balans: {formatSom(sp.balance)}
                              </div>
                            </div>
                            <span className="text-xs font-mono tabular-nums font-bold text-emerald-700 shrink-0">
                              {formatSom(sp.totalDeposited || 0)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}

            {/* ============================================================
                TAB 2: USERS DIRECTORY, CRM DETAIL, TAGS, BALANCE, BAN, DM (#5-#9, #18)
                ============================================================ */}
            {activeTab === 'users' && (
              <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="p-4 md:p-5 border-b border-zinc-200 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Foydalanuvchilar, CRM teglar va balans boshqaruvi
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Balans faqat TolovGo, Promokod yoki Xodim tomonidan server bazasida o‘zgartiriladi.
                      </p>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleSearchUsers(userSearch);
                      }}
                      className="flex items-center gap-2"
                    >
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="ID, @username, ism yoki teg..."
                          className="pl-8 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl outline-none w-52 sm:w-64"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={usersLoading}
                        className="px-3.5 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                      >
                        Qidirish
                      </button>
                    </form>
                  </div>

                  {/* Segment Filters */}
                  <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
                    {(
                      [
                        { id: 'all', label: 'Barchasi' },
                        { id: 'active', label: 'Faol' },
                        { id: 'vip', label: 'VIP' },
                        { id: 'yangi', label: 'Yangi' },
                        { id: 'zero', label: '0 Balans' },
                        { id: 'banned', label: 'Bloklangan' },
                      ] as const
                    ).map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => setUserSegmentFilter(seg.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          userSegmentFilter === seg.id
                            ? 'bg-white text-zinc-900 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {seg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                        <th className="py-3 px-4 font-medium">Telegram ID</th>
                        <th className="py-3 px-4 font-medium">Foydalanuvchi</th>
                        <th className="py-3 px-4 font-medium">Balans / Tushum</th>
                        <th className="py-3 px-4 font-medium">CRM Teg · Holat</th>
                        <th className="py-3 px-4 font-medium text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-zinc-500">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            Yuklanmoqda...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-zinc-400">
                            Foydalanuvchi topilmadi.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => (
                          <tr key={u.telegramId} className="hover:bg-zinc-50/70">
                            <td className="py-3 px-4 font-mono tabular-nums text-zinc-700">
                              {u.telegramId}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-zinc-900">
                                {u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ')}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {u.username ? `@${u.username}` : 'usernamesiz'}
                                {' · '}
                                {u.referralCount} ta referal
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums">
                              <div className="font-semibold text-zinc-900">
                                {formatSom(u.balance)}
                              </div>
                              {typeof u.totalDeposited === 'number' && u.totalDeposited > 0 && (
                                <div className="text-[11px] text-emerald-700">
                                  +{formatSom(u.totalDeposited)} kiritgan
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-xs">
                              <div className="text-zinc-700">
                                {u.crmTag ? `${u.crmTag} · ` : ''}
                                <span
                                  className={`font-medium ${
                                    u.isBanned ? 'text-red-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {u.isBanned ? 'Bloklangan' : 'Faol'}
                                </span>
                              </div>
                              {u.crmNote && (
                                <div className="text-[11px] text-zinc-400 truncate max-w-[190px]">
                                  {u.crmNote}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => void handleOpenUserDetail(u.telegramId)}
                                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium inline-flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Profil & CRM</span>
                              </button>
                              {hasPerm('balance') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBalanceTarget(u);
                                    setBalanceOp('add');
                                    setBalanceAmountText('10000');
                                    setBalanceReason('');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium inline-flex items-center gap-1"
                                >
                                  <Wallet className="w-3 h-3 text-red-600" />
                                  <span>Balans</span>
                                </button>
                              )}
                              {hasPerm('users') && (
                                <button
                                  type="button"
                                  disabled={u.telegramId === telegramUser.telegramId}
                                  onClick={() => void handleToggleBan(u)}
                                  className={`px-2.5 py-1.5 rounded-lg border font-medium inline-flex items-center gap-1 disabled:opacity-40 ${
                                    u.isBanned
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                                  }`}
                                >
                                  {u.isBanned ? <Unlock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                  <span>{u.isBanned ? 'Ochish' : 'Blok'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ============================================================
                TAB 3: MANAGERS TEAM MANAGEMENT (#10)
                ============================================================ */}
            {activeTab === 'managers' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {isSuperAdmin && (
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-red-600" />
                        <span>Yangi menejer qo‘shish / tahrirlash</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Menejer Telegram ID bilan qo‘shiladi, shaxsiy panel paroliga va bot xabarnomalariga ega bo‘ladi.
                      </p>
                    </div>

                    <form onSubmit={handleSaveManagerSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">
                          Telegram ID *
                        </label>
                        <input
                          type="text"
                          value={mgrTelegramId}
                          onChange={(e) => setMgrTelegramId(e.target.value.replace(/\D/g, ''))}
                          placeholder="Masalan: 123456789"
                          className="w-full text-xs font-mono bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-zinc-700">Ism</label>
                          <input
                            type="text"
                            value={mgrFirstName}
                            onChange={(e) => setMgrFirstName(e.target.value)}
                            placeholder="Alisher"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-zinc-700">
                            @username
                          </label>
                          <input
                            type="text"
                            value={mgrUsername}
                            onChange={(e) => setMgrUsername(e.target.value)}
                            placeholder="alisher_crm"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-zinc-700">Lavozim</label>
                          <input
                            type="text"
                            value={mgrRoleTitle}
                            onChange={(e) => setMgrRoleTitle(e.target.value)}
                            placeholder="CRM Menejer"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-medium text-zinc-700">
                            Kirish paroli (min 6)
                          </label>
                          <input
                            type="password"
                            value={mgrPassword}
                            onChange={(e) => setMgrPassword(e.target.value)}
                            placeholder="Ixtiyoriy yangilash"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium text-zinc-700">
                          Ruxsat etilgan bo‘limlar:
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                          {MANAGER_PERMISSION_LABELS.map((perm) => {
                            const checked = mgrPerms.includes(perm.id);
                            return (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    setMgrPerms((prev) =>
                                      e.target.checked
                                        ? [...new Set([...prev, perm.id])]
                                        : prev.filter((p) => p !== perm.id)
                                    );
                                  }}
                                  className="accent-red-600 w-3.5 h-3.5"
                                />
                                <span>{perm.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mgrNotifyTg}
                            onChange={(e) => setMgrNotifyTg(e.target.checked)}
                            className="accent-red-600 w-3.5 h-3.5"
                          />
                          <span>Yangi user va to‘lovlarni Telegram botda yuborish</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mgrIsActive}
                            onChange={(e) => setMgrIsActive(e.target.checked)}
                            className="accent-red-600 w-3.5 h-3.5"
                          />
                          <span>Menejer hisobi faol</span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={savingMgr}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        {savingMgr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Menejerni saqlash</span>
                      </button>
                    </form>
                  </section>
                )}

                <section
                  className={`${
                    isSuperAdmin ? 'lg:col-span-2' : 'lg:col-span-3'
                  } bg-white border border-zinc-200 rounded-2xl overflow-hidden`}
                >
                  <div className="p-4 md:p-5 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Menejerlar va bot bildirishnoma jamoasi ({managers.length} ta)
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Faol menejerlar o‘z ruxsatlari doirasida CRM panelini boshqaradi va Telegram bot orqali real vaqt xabarnomalarini oladi.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                          <th className="py-3 px-4 font-medium">Menejer</th>
                          <th className="py-3 px-4 font-medium">Lavozim & Ruxsatlar</th>
                          <th className="py-3 px-4 font-medium">Bot Alert · Holat</th>
                          {isSuperAdmin && <th className="py-3 px-4 font-medium text-right">Amal</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {managers.length === 0 ? (
                          <tr>
                            <td colSpan={isSuperAdmin ? 4 : 3} className="py-10 text-center text-zinc-400">
                              Hozircha qo‘shilgan menejerlar yo‘q.
                            </td>
                          </tr>
                        ) : (
                          managers.map((m) => (
                            <tr key={m.telegramId} className="hover:bg-zinc-50/70">
                              <td className="py-3 px-4">
                                <div className="font-semibold text-zinc-900">
                                  {m.firstName} {m.username ? `(@${m.username})` : ''}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-500">
                                  ID {m.telegramId}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-zinc-800">{m.roleTitle}</div>
                                <div className="text-[11px] text-zinc-500">
                                  {m.permissions.length} ta bo‘lim ruxsati
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs">
                                <div className={m.isActive ? 'text-emerald-700 font-medium' : 'text-zinc-500'}>
                                  {m.isActive ? 'Faol' : 'O‘chirilgan'}
                                  {' · '}
                                  {m.notifyTelegram ? 'Bot Alert Yoqilgan' : 'Alert O‘chirilgan'}
                                </div>
                              </td>
                              {isSuperAdmin && (
                                <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMgrTelegramId(m.telegramId);
                                      setMgrFirstName(m.firstName);
                                      setMgrUsername(m.username || '');
                                      setMgrRoleTitle(m.roleTitle);
                                      setMgrPerms(m.permissions);
                                      setMgrIsActive(m.isActive);
                                      setMgrNotifyTg(m.notifyTelegram);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium"
                                  >
                                    Tahrirlash
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteManagerClick(m.telegramId)}
                                    className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 inline-flex items-center"
                                    aria-label="Menejerni o'chirish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================
                TAB 4: TOLOVGO ORDERS, MANUAL VERIFY, WEBHOOK & MODE (#11-#13)
                ============================================================ */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {/* #13 TolovGo Webhook URL + Signature Status + Gateway Mode */}
                <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        TolovGo Webhook URL, Signatura va Rejim
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        TolovGo kabinetiga quyidagi Webhook URL ni kiriting va .env / Vercel Env ga{' '}
                        <code className="font-mono text-zinc-900">TOLOVGO_WEBHOOK_SECRET</code> ni qo‘shing.
                      </p>
                    </div>
                    <div className="text-xs font-mono text-zinc-600">
                      Signatura himoyasi:{' '}
                      <span className={hasWebhookSecret ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                        {hasWebhookSecret ? 'Faol (HMAC-SHA256)' : 'TOLOVGO_WEBHOOK_SECRET kiritilmagan'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-700">
                        TolovGo Callback / Webhook URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={tolovgoCallbackUrl}
                          className="flex-1 min-w-0 text-xs font-mono text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => copyText('tolovgo_cb', tolovgoCallbackUrl)}
                          className="px-3 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium flex items-center gap-1.5 shrink-0"
                        >
                          {copiedKey === 'tolovgo_cb' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === 'tolovgo_cb' ? 'Nusxalandi' : 'Nusxalash'}</span>
                        </button>
                      </div>
                    </div>

                    {hasPerm('settings') && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-zinc-700">
                          TolovGo to‘lov rejimi
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            disabled={savingMode || !hasLiveKey}
                            onClick={() => void handleChangeTolovgoModeAdmin('live')}
                            className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors disabled:opacity-45 ${
                              tolovgoMode === 'live'
                                ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold'
                                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Haqiqiy (Live) {hasLiveKey ? '· tayyor' : '· yo‘q'}
                          </button>
                          <button
                            type="button"
                            disabled={savingMode || !hasTestKey}
                            onClick={() => void handleChangeTolovgoModeAdmin('test')}
                            className={`px-3 py-2 rounded-xl border text-left text-xs transition-colors disabled:opacity-45 ${
                              tolovgoMode === 'test'
                                ? 'bg-amber-50 border-amber-600 text-amber-950 font-semibold'
                                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Sinov (Test) {hasTestKey ? '· tayyor' : '· yo‘q'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* #12 Manual Order Reconciliation */}
                <section className="bg-white border border-zinc-200 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Buyurtmani ID orqali qo‘lda tekshirish va balansga sinxronlash
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Agar mijoz to‘lov qilib saytga qaytmagan bo‘lsa, buyurtma raqamini kiriting.
                    </p>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleVerifyOrderAction(manualOrderId, true);
                    }}
                    className="flex items-center gap-2 shrink-0"
                  >
                    <input
                      type="text"
                      value={manualOrderId}
                      onChange={(e) => setManualOrderId(e.target.value)}
                      placeholder="Buyurtma ID..."
                      className="text-xs font-mono bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none w-44"
                    />
                    <button
                      type="submit"
                      disabled={verifyingManualOrder || !manualOrderId.trim()}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap"
                    >
                      {verifyingManualOrder ? 'Tekshirilmoqda...' : 'Sinxronlash'}
                    </button>
                  </form>
                </section>

                {/* #11 Orders Table */}
                <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <div className="p-4 md:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        TolovGo to‘lov buyurtmalari ({filteredOrders.length} ta)
                      </h2>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                      {(
                        [
                          { id: 'all', label: 'Hammasi' },
                          { id: 'paid', label: 'To‘langan' },
                          { id: 'pending', label: 'Kutilmoqda' },
                          { id: 'test', label: 'Sinov' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setOrderFilter(f.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                            orderFilter === f.id
                              ? 'bg-white text-zinc-900 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                          <th className="py-3 px-4 font-medium">Buyurtma ID</th>
                          <th className="py-3 px-4 font-medium">Summa</th>
                          <th className="py-3 px-4 font-medium">Usul · Rejim</th>
                          <th className="py-3 px-4 font-medium">Foydalanuvchi</th>
                          <th className="py-3 px-4 font-medium">Holat</th>
                          <th className="py-3 px-4 font-medium">Sana</th>
                          <th className="py-3 px-4 font-medium text-right">Tekshirish</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-zinc-400">
                              Mos buyurtmalar topilmadi.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((o) => (
                            <tr key={o.orderId} className="hover:bg-zinc-50/70">
                              <td className="py-3 px-4 font-mono text-zinc-900">#{o.orderId}</td>
                              <td className="py-3 px-4 font-mono tabular-nums font-semibold text-zinc-900">
                                {formatSom(o.amount)}
                              </td>
                              <td className="py-3 px-4 text-zinc-600">
                                {o.method || 'TolovGo'} · {o.isTest ? 'Sinov' : 'Haqiqiy'}
                              </td>
                              <td className="py-3 px-4 font-mono text-zinc-600">
                                {o.telegramId || '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`font-medium ${
                                    o.status === 'paid'
                                      ? 'text-emerald-700'
                                      : o.status === 'pending'
                                        ? 'text-amber-700'
                                        : 'text-zinc-500'
                                  }`}
                                >
                                  {o.status}
                                  {o.credited ? ' · balansga tushdi' : ''}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono tabular-nums text-zinc-500">
                                {formatDateTime(o.createdAt)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  disabled={checkingOrderId === o.orderId}
                                  onClick={() => void handleVerifyOrderAction(o.orderId, false)}
                                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium inline-flex items-center gap-1 disabled:opacity-50"
                                >
                                  {checkingOrderId === o.orderId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  <span>Tekshirish</span>
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ============================================================
                TAB 5: PRICING, BONUSES & PROMO CODES (#14-#16)
                ============================================================ */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                {hasPerm('pricing') && (
                  <form onSubmit={handleSavePricingSubmit} className="space-y-6">
                    {/* #14 Services Pricing */}
                    <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                        <div>
                          <h2 className="text-sm font-semibold text-zinc-900">
                            AI Xizmatlar narxlarini boshqarish (Serverda hisoblanadi)
                          </h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Barcha narxlar serverda tekshiriladi; brauzerdan o‘zgartirish mumkin emas.
                          </p>
                        </div>
                        <button
                          type="submit"
                          disabled={savingPricing}
                          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                        >
                          {savingPricing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Saqlash</span>
                        </button>
                      </div>

                      <div className="divide-y divide-zinc-100">
                        {SERVICE_LABELS.map((item) => {
                          if (!item.hasSteps) {
                            const val = pricingDraft.services.five_block_infographic.basePrice;
                            return (
                              <div
                                key={item.key}
                                className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center"
                              >
                                <div className="md:col-span-2">
                                  <div className="text-sm font-semibold text-zinc-900">
                                    {item.title}
                                  </div>
                                  <div className="text-xs text-zinc-500">Yagona fiksirlangan narx</div>
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[11px] font-medium text-zinc-600">
                                    Asosiy narx (so‘m)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={500000}
                                    step={100}
                                    value={val}
                                    onChange={(e) => {
                                      const num = Math.max(
                                        0,
                                        Math.round(Number(e.target.value) || 0)
                                      );
                                      setPricingDraft((p) => ({
                                        ...p,
                                        services: {
                                          ...p.services,
                                          five_block_infographic: { basePrice: num },
                                        },
                                      }));
                                    }}
                                    className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                                  />
                                </div>
                                <div className="text-xs text-zinc-400">—</div>
                              </div>
                            );
                          }

                          const cfg =
                            pricingDraft.services[
                              item.key as Exclude<
                                keyof AppPricingSettings['services'],
                                'five_block_infographic'
                              >
                            ];
                          return (
                            <div
                              key={item.key}
                              className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center"
                            >
                              <div>
                                <div className="text-sm font-semibold text-zinc-900">
                                  {item.title}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  Birlik: {item.unitLabel}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-zinc-600">
                                  Boshlang‘ich narx (so‘m)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={500000}
                                  step={100}
                                  value={cfg.basePrice}
                                  onChange={(e) => {
                                    const num = Math.max(0, Math.round(Number(e.target.value) || 0));
                                    setPricingDraft((p) => ({
                                      ...p,
                                      services: {
                                        ...p.services,
                                        [item.key]: { ...cfg, basePrice: num },
                                      },
                                    }));
                                  }}
                                  className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-zinc-600">
                                  Boshlang‘ich chegara ({item.unitLabel})
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={cfg.baseLimit}
                                  onChange={(e) => {
                                    const num = Math.max(
                                      1,
                                      Math.min(20, Math.round(Number(e.target.value) || 1))
                                    );
                                    setPricingDraft((p) => ({
                                      ...p,
                                      services: {
                                        ...p.services,
                                        [item.key]: { ...cfg, baseLimit: num },
                                      },
                                    }));
                                  }}
                                  className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-zinc-600">
                                  Har bir qo‘shimcha (+so‘m)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100000}
                                  step={100}
                                  value={cfg.extraStepPrice}
                                  onChange={(e) => {
                                    const num = Math.max(0, Math.round(Number(e.target.value) || 0));
                                    setPricingDraft((p) => ({
                                      ...p,
                                      services: {
                                        ...p.services,
                                        [item.key]: { ...cfg, extraStepPrice: num },
                                      },
                                    }));
                                  }}
                                  className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    {/* #15 Welcome & Referral Bonus */}
                    <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900">
                          Xush kelibsiz va Referal bonus qoidalari
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          24 soatlik anti-abuse limiti va bir martalik referal tekshiruvi bilan.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Yangi foydalanuvchi bonusi (so‘m)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            step={100}
                            value={pricingDraft.welcomeBonus}
                            onChange={(e) =>
                              setPricingDraft((p) => ({
                                ...p,
                                welcomeBonus: Math.max(0, Math.round(Number(e.target.value) || 0)),
                              }))
                            }
                            className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Taklif qiluvchi bonusi (so‘m)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            step={100}
                            value={pricingDraft.referralInviterBonus}
                            onChange={(e) =>
                              setPricingDraft((p) => ({
                                ...p,
                                referralInviterBonus: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                ),
                              }))
                            }
                            className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Taklif qilingan do‘st bonusi (so‘m)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            step={100}
                            value={pricingDraft.referralInviteeBonus}
                            onChange={(e) =>
                              setPricingDraft((p) => ({
                                ...p,
                                referralInviteeBonus: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0)
                                ),
                              }))
                            }
                            className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Kunlik referal limiti (kishi / 24s)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={pricingDraft.dailyReferralLimit}
                            onChange={(e) =>
                              setPricingDraft((p) => ({
                                ...p,
                                dailyReferralLimit: Math.max(
                                  1,
                                  Math.min(200, Math.round(Number(e.target.value) || 1))
                                ),
                              }))
                            }
                            className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                      </div>
                    </section>
                  </form>
                )}

                {/* #16 Promo Codes System */}
                {hasPerm('promos') && (
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-red-600" />
                        <span>Promokod va vaucherlar tizimi</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Mijozlar «Balans to‘ldirish» oynasida promokod kiritib, serverda tasdiqlangan bonus olishadi.
                      </p>
                    </div>

                    <form
                      onSubmit={handleCreatePromoSubmit}
                      className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end"
                    >
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">Kod</label>
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                          placeholder="SLAYD5000"
                          className="w-full text-xs font-mono uppercase bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">
                          Bonus (so‘m)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={promoBonus}
                          onChange={(e) => setPromoBonus(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-xs font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">
                          Maks. limit
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={promoMaxUses}
                          onChange={(e) => setPromoMaxUses(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-xs font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">
                          Muddat (kun)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={promoExpireDays}
                          onChange={(e) => setPromoExpireDays(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-xs font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingPromo || promoCode.trim().length < 3}
                        className="py-2 px-4 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Yaratish</span>
                      </button>
                    </form>

                    <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                            <th className="py-2.5 px-4 font-medium">Kod</th>
                            <th className="py-2.5 px-4 font-medium">Bonus</th>
                            <th className="py-2.5 px-4 font-medium">Ishlatildi</th>
                            <th className="py-2.5 px-4 font-medium">Holat</th>
                            <th className="py-2.5 px-4 font-medium text-right">Amal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {promos.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-zinc-400">
                                Hozircha promokodlar yo‘q.
                              </td>
                            </tr>
                          ) : (
                            promos.map((p) => (
                              <tr key={p.code}>
                                <td className="py-2.5 px-4 font-mono font-semibold text-zinc-900">
                                  {p.code}
                                </td>
                                <td className="py-2.5 px-4 font-mono tabular-nums text-emerald-700 font-semibold">
                                  +{formatSom(p.bonusAmount)}
                                </td>
                                <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-700">
                                  {p.usedCount} / {p.maxUses}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={
                                      p.isActive ? 'text-emerald-700 font-medium' : 'text-zinc-500'
                                    }
                                  >
                                    {p.isActive ? 'Faol' : 'O‘chirilgan'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => void handleTogglePromoActive(p)}
                                    className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium"
                                  >
                                    {p.isActive ? 'To‘xtatish' : 'Yoqish'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeletePromoClick(p.code)}
                                    className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 inline-flex items-center"
                                    aria-label="O'chirish"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ============================================================
                TAB 6: MARKETING, BOT BROADCAST & SITE CONFIG (#17, #19)
                ============================================================ */}
            {activeTab === 'marketing' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* #17 Mass Telegram Broadcast */}
                {hasPerm('broadcast') && (
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Send className="w-4 h-4 text-red-600" />
                        <span>Ommaviy Telegram Bot Xabarnomasi</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Tanlangan foydalanuvchilar segmentiga Telegram bot orqali e'lon yuborish.
                      </p>
                    </div>

                    <form onSubmit={handleSendBroadcastSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">Segment</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {(
                            [
                              { id: 'all', label: 'Barcha' },
                              { id: 'active', label: 'Faol' },
                              { id: 'vip', label: 'VIP' },
                              { id: 'zero_balance', label: '0 Balans' },
                            ] as const
                          ).map((seg) => (
                            <button
                              key={seg.id}
                              type="button"
                              onClick={() => setBroadcastSegment(seg.id)}
                              className={`py-2 px-2 rounded-xl border text-xs font-medium transition-colors ${
                                broadcastSegment === seg.id
                                  ? 'bg-[#111113] border-[#111113] text-white'
                                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                              }`}
                            >
                              {seg.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">
                          Xabar matni
                        </label>
                        <textarea
                          rows={4}
                          value={broadcastMsg}
                          onChange={(e) => setBroadcastMsg(e.target.value)}
                          placeholder="Masalan: Bugun barcha taqdimot shablonlariga SLAYD5000 promokodi amal qiladi!"
                          className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl p-3 outline-none resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sendingBroadcast || broadcastMsg.trim().length < 3}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        {sendingBroadcast ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Barcha tanlanganlarga yuborish</span>
                      </button>
                    </form>

                    {broadcastLogs.length > 0 && (
                      <div className="pt-3 border-t border-zinc-100 space-y-2">
                        <div className="text-xs font-medium text-zinc-700">
                          Oxirgi yuborilgan xabarlar
                        </div>
                        <div className="divide-y divide-zinc-100 max-h-48 overflow-y-auto">
                          {broadcastLogs.slice(0, 6).map((b) => (
                            <div key={b.id} className="py-2 space-y-0.5 text-xs">
                              <div className="flex justify-between font-mono text-[11px] text-zinc-500">
                                <span>
                                  {b.targetSegment} · {b.sentCount}/{b.totalTargets} yetkazildi
                                </span>
                                <span>{formatDateTime(b.createdAt)}</span>
                              </div>
                              <div className="text-zinc-800 line-clamp-2">{b.message}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* #19 Site Config, Maintenance Mode, Banner & Test Bot Alert */}
                {hasPerm('settings') && (
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Megaphone className="w-4 h-4 text-red-600" />
                        <span>Sayt E’loni, Texnik Rejim & Bot Sinovi</span>
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Sayt tepasidagi e'lon tasmasi, texnik rejim va xodimlar uchun sinov Telegram xabari.
                      </p>
                    </div>

                    <form onSubmit={handleSaveSiteConfigSubmit} className="space-y-3.5">
                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="text-xs font-semibold text-zinc-900">
                            Texnik ta'mirlash rejimi (AI generatsiyani vaqtincha to‘xtatish)
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={siteConfigDraft.maintenanceMode}
                          onChange={(e) =>
                            setSiteConfigDraft((s) => ({
                              ...s,
                              maintenanceMode: e.target.checked,
                            }))
                          }
                          className="accent-red-600 w-4 h-4"
                        />
                      </label>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">
                          Texnik rejim xabari
                        </label>
                        <input
                          type="text"
                          value={siteConfigDraft.maintenanceMessage}
                          onChange={(e) =>
                            setSiteConfigDraft((s) => ({ ...s, maintenanceMessage: e.target.value }))
                          }
                          placeholder="Saytda texnik yangilanish ishlari olib borilmoqda..."
                          className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-medium text-zinc-700">
                          Sayt tepasi e’lon tasmasi (ixtiyoriy)
                        </label>
                        <input
                          type="text"
                          value={siteConfigDraft.announcementBanner}
                          onChange={(e) =>
                            setSiteConfigDraft((s) => ({ ...s, announcementBanner: e.target.value }))
                          }
                          placeholder="Masalan: Yangi 20 sahifali slayd shablonlari qo'shildi!"
                          className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
                          <span className="text-xs font-medium text-zinc-800">
                            Yangi user haqida bot xabari
                          </span>
                          <input
                            type="checkbox"
                            checked={siteConfigDraft.notifyNewUsersToStaff}
                            onChange={(e) =>
                              setSiteConfigDraft((s) => ({
                                ...s,
                                notifyNewUsersToStaff: e.target.checked,
                              }))
                            }
                            className="accent-red-600 w-4 h-4"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
                          <span className="text-xs font-medium text-zinc-800">
                            TolovGo to‘lovi haqida bot xabari
                          </span>
                          <input
                            type="checkbox"
                            checked={siteConfigDraft.notifyPaymentsToStaff}
                            onChange={(e) =>
                              setSiteConfigDraft((s) => ({
                                ...s,
                                notifyPaymentsToStaff: e.target.checked,
                              }))
                            }
                            className="accent-red-600 w-4 h-4"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button
                          type="submit"
                          disabled={savingSiteCfg}
                          className="py-2.5 px-4 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Sozlamalarni saqlash</span>
                        </button>
                        <button
                          type="button"
                          disabled={testingAlert}
                          onClick={() => void handleTestTelegramAlert()}
                          className="py-2.5 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5 text-red-600" />
                          <span>{testingAlert ? 'Yuborilmoqda...' : 'Sinov Bot Alert'}</span>
                        </button>
                      </div>
                    </form>
                  </section>
                )}
              </div>
            )}

            {/* ============================================================
                TAB 7: SECURITY, PASSWORD, CSV EXPORT & AUDIT LOGS (#20)
                ============================================================ */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* System Status & Webhook Reference + CSV Export */}
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900">
                          Tizim, Telegram Webhook va CSV Eksport
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Neon DB: {neonConfigured && tablesReady ? 'Tayyor' : 'Ulash kutilmoqda'} · Cookie muddati: 15 kun
                        </p>
                      </div>
                      <Database className="w-4 h-4 text-zinc-500" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-700">
                        Telegram Bot Webhook URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={telegramWebhookUrl}
                          className="flex-1 min-w-0 text-xs font-mono text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => copyText('tg_wh', telegramWebhookUrl)}
                          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-medium flex items-center gap-1.5 shrink-0"
                        >
                          {copiedKey === 'tg_wh' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedKey === 'tg_wh' ? 'Nusxalandi' : 'Nusxalash'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(
                            `slaydcanva_users_${new Date().toISOString().slice(0, 10)}.csv`,
                            ['Telegram ID', 'Ism', 'Username', 'Balans', 'Tushum', 'Teg', 'Holat'],
                            users.map((u) => [
                              u.telegramId,
                              u.fullName || u.firstName,
                              u.username || '',
                              u.balance,
                              u.totalDeposited || 0,
                              u.crmTag || '',
                              u.isBanned ? 'Bloklangan' : 'Faol',
                            ])
                          )
                        }
                        className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Userlar CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(
                            `slaydcanva_orders_${new Date().toISOString().slice(0, 10)}.csv`,
                            ['Order ID', 'Summa', 'Usul', 'Rejim', 'User ID', 'Holat', 'Sana'],
                            orders.map((o) => [
                              o.orderId,
                              o.amount,
                              o.method || 'TolovGo',
                              o.isTest ? 'Sinov' : 'Haqiqiy',
                              o.telegramId || '',
                              o.status,
                              formatDateTime(o.createdAt),
                            ])
                          )
                        }
                        className="px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Buyurtmalar CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleLockSession()}
                        className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Sessiyani qulflash</span>
                      </button>
                    </div>
                  </section>

                  {/* Change Super Admin Password */}
                  {isSuperAdmin && (
                    <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                          <KeyRound className="w-4 h-4 text-red-600" />
                          <span>Maxfiy Super Admin parolini almashtirish</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak.
                        </p>
                      </div>

                      <form onSubmit={handleChangePasswordSubmit} className="space-y-3">
                        <input
                          type="password"
                          value={curPwd}
                          onChange={(e) => setCurPwd(e.target.value)}
                          placeholder="Joriy parol"
                          className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="password"
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            placeholder="Yangi parol (min 8)"
                            className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                          <input
                            type="password"
                            value={newPwdConfirm}
                            onChange={(e) => setNewPwdConfirm(e.target.value)}
                            placeholder="Tasdiqlash"
                            className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={changingPwd}
                          className="px-4 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          {changingPwd ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Parolni yangilash</span>
                        </button>
                      </form>
                    </section>
                  )}
                </div>

                {/* Security Audit Log Table */}
                <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-red-600" />
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Xavfsizlik va moliyaviy audit jurnali
                      </h2>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-zinc-500">
                      {auditLogs.length} ta yozuv
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                          <th className="py-2.5 px-4 font-medium">Vaqt</th>
                          <th className="py-2.5 px-4 font-medium">Amal</th>
                          <th className="py-2.5 px-4 font-medium">Ijrochi / Maqsad</th>
                          <th className="py-2.5 px-4 font-medium">Summa</th>
                          <th className="py-2.5 px-4 font-medium">Tafsilot</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-400">
                              Hozircha audit yozuvlari yo‘q.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-50/70">
                              <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-500 whitespace-nowrap">
                                {formatDateTime(log.createdAt)}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-zinc-900">{log.action}</td>
                              <td className="py-2.5 px-4 font-mono text-zinc-600">
                                {log.actorId}
                                {log.targetId ? ` → ${log.targetId}` : ''}
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums font-semibold">
                                {typeof log.amountDelta === 'number' && log.amountDelta !== 0 ? (
                                  <span
                                    className={
                                      log.amountDelta > 0 ? 'text-emerald-700' : 'text-red-600'
                                    }
                                  >
                                    {log.amountDelta > 0
                                      ? `+${formatSom(log.amountDelta)}`
                                      : `-${formatSom(Math.abs(log.amountDelta))}`}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-zinc-600">{log.details || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ============================================================
          MODAL: USER FULL CRM PROFILE, NOTES, TAGS & DIRECT BOT DM
          ============================================================ */}
      {(selectedUserDetail || detailLoading) && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => !detailLoading && setSelectedUserDetail(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Mijoz CRM Profili va Tarixi
                </h3>
                {selectedUserDetail && (
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">
                    {selectedUserDetail.user.firstName} · ID {selectedUserDetail.user.telegramId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="p-1 text-zinc-400 hover:text-zinc-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !selectedUserDetail ? (
              <div className="p-10 flex items-center justify-center text-xs text-zinc-500 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                <span>Yuklanmoqda...</span>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="text-zinc-500">Balans</div>
                    <div className="font-mono tabular-nums font-bold text-zinc-900 mt-0.5">
                      {formatSom(selectedUserDetail.user.balance)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="text-zinc-500">Kiritgan</div>
                    <div className="font-mono tabular-nums font-bold text-emerald-700 mt-0.5">
                      {formatSom(selectedUserDetail.user.totalDeposited || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="text-zinc-500">Sarflagan</div>
                    <div className="font-mono tabular-nums font-bold text-zinc-900 mt-0.5">
                      {formatSom(selectedUserDetail.user.totalSpent || 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                    <div className="text-zinc-500">Loyiha / Referal</div>
                    <div className="font-mono tabular-nums font-bold text-zinc-900 mt-0.5">
                      {selectedUserDetail.projects.length} / {selectedUserDetail.user.referralCount}
                    </div>
                  </div>
                </div>

                {/* CRM Tag & Note */}
                <form
                  onSubmit={handleSaveUserCrm}
                  className="p-4 rounded-xl border border-zinc-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-red-600" />
                      <span>CRM Teg va Ichki Izoh</span>
                    </span>
                    <button
                      type="submit"
                      disabled={savingCrm}
                      className="px-3 py-1.5 rounded-lg bg-[#111113] text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {savingCrm ? 'Saqlanmoqda...' : 'Saqlash'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CRM_TAGS.map((t) => (
                      <button
                        key={t || 'none'}
                        type="button"
                        onClick={() => setCrmEditTag(t)}
                        className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          crmEditTag === t
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        {t || 'Tegsız'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={crmEditNote}
                    onChange={(e) => setCrmEditNote(e.target.value)}
                    placeholder="Menejer/Admin uchun ichki izoh..."
                    className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl p-2.5 outline-none resize-none"
                  />
                </form>

                {/* Direct Bot Message */}
                <form
                  onSubmit={handleSendDirectMessage}
                  className="p-4 rounded-xl border border-zinc-200 space-y-2.5"
                >
                  <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-red-600" />
                    <span>Telegram bot orqali shaxsiy xabar yuborish</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={dmText}
                      onChange={(e) => setDmText(e.target.value)}
                      placeholder="Mijozga xabar yozing..."
                      className="flex-1 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingDm || !dmText.trim()}
                      className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold"
                    >
                      {sendingDm ? '...' : 'Yuborish'}
                    </button>
                  </div>
                </form>

                {/* User Orders & Transactions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-900">
                      TolovGo Buyurtmalari ({selectedUserDetail.orders.length})
                    </div>
                    <div className="divide-y divide-zinc-100 max-h-44 overflow-y-auto">
                      {selectedUserDetail.orders.length === 0 ? (
                        <div className="p-4 text-center text-zinc-400">Buyurtmalar yo‘q</div>
                      ) : (
                        selectedUserDetail.orders.map((o) => (
                          <div key={o.orderId} className="px-3.5 py-2 flex justify-between gap-2">
                            <div>
                              <div className="font-mono text-zinc-900">#{o.orderId}</div>
                              <div className="text-[11px] text-zinc-500">
                                {o.status} · {formatDateTime(o.createdAt)}
                              </div>
                            </div>
                            <span className="font-mono tabular-nums font-semibold text-zinc-900">
                              {formatSom(o.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-900">
                      Amaliyotlar ({selectedUserDetail.transactions.length})
                    </div>
                    <div className="divide-y divide-zinc-100 max-h-44 overflow-y-auto">
                      {selectedUserDetail.transactions.length === 0 ? (
                        <div className="p-4 text-center text-zinc-400">Amaliyotlar yo‘q</div>
                      ) : (
                        selectedUserDetail.transactions.map((t) => (
                          <div key={t.id} className="px-3.5 py-2 flex justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-zinc-900 truncate">{t.title}</div>
                              <div className="text-[11px] text-zinc-500">
                                {t.method} · {t.date}
                              </div>
                            </div>
                            <span
                              className={`font-mono tabular-nums font-semibold shrink-0 ${
                                t.amount >= 0 ? 'text-emerald-700' : 'text-zinc-700'
                              }`}
                            >
                              {t.amount >= 0 ? `+${formatSom(t.amount)}` : formatSom(t.amount)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: BALANCE ADJUSTMENT
          ============================================================ */}
      {balanceTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={() => setBalanceTarget(null)}
        >
          <div
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">
                  Foydalanuvchi balansini o‘zgartirish
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                  {balanceTarget.fullName || balanceTarget.firstName} · ID {balanceTarget.telegramId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceTarget(null)}
                className="p-1 text-zinc-400 hover:text-zinc-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
              <span className="text-zinc-500">Joriy server balansi:</span>
              <span className="font-mono tabular-nums font-bold text-zinc-900">
                {formatSom(balanceTarget.balance)}
              </span>
            </div>

            <form onSubmit={handleAdjustBalanceSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceOp('add')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    balanceOp === 'add'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                      : 'bg-white border-zinc-200 text-zinc-600'
                  }`}
                >
                  + Qo‘shish
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceOp('sub')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                    balanceOp === 'sub'
                      ? 'bg-red-50 border-red-600 text-red-700'
                      : 'bg-white border-zinc-200 text-zinc-600'
                  }`}
                >
                  − Ayirish
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700">Summa (so‘m)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={balanceAmountText}
                  onChange={(e) => setBalanceAmountText(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-sm font-mono tabular-nums font-semibold text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[1000, 5000, 10000, 50000, 100000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBalanceAmountText(String(val))}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[11px] font-mono tabular-nums text-zinc-700"
                    >
                      {formatSom(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-700">
                  Izoh (audit jurnaliga yoziladi)
                </label>
                <input
                  type="text"
                  value={balanceReason}
                  onChange={(e) => setBalanceReason(e.target.value)}
                  placeholder="Masalan: TolovGo orqali qo'lda tasdiqlandi"
                  className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={balanceNotifyTg}
                  onChange={(e) => setBalanceNotifyTg(e.target.checked)}
                  className="accent-red-600 w-4 h-4"
                />
                <span>Foydalanuvchiga Telegram bot orqali xabar yuborish</span>
              </label>

              <button
                type="submit"
                disabled={balanceSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {balanceSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Tasdiqlash</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
