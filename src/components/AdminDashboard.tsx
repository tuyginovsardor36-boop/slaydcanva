import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bell,
  Check,
  CheckCheck,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  Gift,
  Headphones,
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
  Sparkles,
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
  BalanceTransaction,
  BroadcastLogRow,
  CrmEventRow,
  InboxMessageRow,
  ManagerPermission,
  ManagerRecord,
  PromoCodeRow,
  SecurityLogRow,
  SecurityScanReport,
  SiteConfigSettings,
  StaffRole,
  SupportTicketRow,
  SupportTicketStatus,
  TelegramUser,
  TolovgoPaymentMode,
} from '../types/editor';
import {
  adminAdjustUserBalance,
  adminAnalyzeSecurityLogs,
  adminAssignSupportTicket,
  adminChangePassword,
  adminDeleteManager,
  adminDeletePromo,
  adminGetAnalytics,
  adminGetOverview,
  adminGetStatus,
  adminGetSupportThread,
  adminGetUserDetail,
  adminListAuditLogs,
  adminListBroadcasts,
  adminListCrmEvents,
  adminListManagers,
  adminListOrders,
  adminListPromos,
  adminListSecurityLogs,
  adminListSupportTickets,
  adminListUsers,
  adminLogin,
  adminLogout,
  adminMarkCrmEventsRead,
  adminReplySupportTicket,
  adminResolveSecurityLog,
  adminRunSecurityScan,
  adminSavePricing,
  adminSaveSettings,
  adminSaveSiteConfig,
  adminSendBroadcast,
  adminSendDirectMessage,
  adminSendTestTelegramAlert,
  adminSetupPassword,
  adminSetupTelegramWebhook,
  adminSetUserBanned,
  adminUpdateSupportStatus,
  adminUpdateUserCrm,
  adminUpsertManager,
  adminUpsertPromo,
  adminVerifyOrder,
} from '../utils/telegramClient';
import { AdminCoordinateStats } from './AdminCoordinateStats';

type AdminTab =
  | 'overview'
  | 'inbox'
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
  { key: 'academic_wave_pptx', title: 'Slayd · Akademik To‘lqin', unitLabel: 'slayd', hasSteps: true },
  { key: 'white_card_pptx', title: 'Slayd · Oq Karta', unitLabel: 'slayd', hasSteps: true },
  { key: 'ai_canvas_design', title: 'Slayd · AI Erkin Kanvas', unitLabel: 'slayd', hasSteps: true },
  { key: 'independent_work_word', title: 'Mustaqil ish (Referat) · Word', unitLabel: 'bob', hasSteps: true },
  { key: 'course_work_word', title: 'Kurs ishi · Word', unitLabel: 'bob', hasSteps: true },
  { key: 'essay_article_word', title: 'Esse va Ilmiy maqola · Word', unitLabel: 'qism', hasSteps: true },
  { key: 'stitched_notebook_pdf', title: 'Tikilgan Daftar · PDF', unitLabel: 'topshiriq bloki', hasSteps: true },
  { key: 'five_block_infographic', title: '5-Blokli Infografika', unitLabel: 'poster', hasSteps: false },
];

const MANAGER_PERMISSION_LABELS: Array<{ id: ManagerPermission; label: string }> = [
  { id: 'overview', label: 'KPI va 20 Kordinata Analitika' },
  { id: 'crm_events', label: 'Jonli CRM Xabarnomalar' },
  { id: 'support', label: 'Support Inbox (TG & Sayt Chat)' },
  { id: 'users', label: 'Foydalanuvchilar & CRM Teg' },
  { id: 'balance', label: 'Balans Boshqaruvi' },
  { id: 'orders', label: 'TolovGo Buyurtmalari' },
  { id: 'pricing', label: 'Narxlar & Bonuslar' },
  { id: 'promos', label: 'Promokodlar' },
  { id: 'broadcast', label: 'Telegram Broadcast' },
  { id: 'settings', label: 'Sayt & Bot Sozlamalari' },
  { id: 'security', label: 'Xavfsizlik Skaneri & Loglar' },
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

  // Google-like Global Search & Suggestions
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedAdminTx, setSelectedAdminTx] = useState<BalanceTransaction | null>(null);



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

  // Managers & Support Staff
  const [managers, setManagers] = useState<ManagerRecord[]>([]);
  const [mgrTelegramId, setMgrTelegramId] = useState('');
  const [mgrFirstName, setMgrFirstName] = useState('');
  const [mgrUsername, setMgrUsername] = useState('');
  const [mgrRoleType, setMgrRoleType] = useState<'manager' | 'support'>('manager');
  const [mgrIsSupportDefault, setMgrIsSupportDefault] = useState(false);
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

  // Support Inbox
  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>([]);
  const [supportAgents, setSupportAgents] = useState<
    Array<{
      telegramId: string;
      firstName: string;
      username?: string;
      roleTitle: string;
      isSupportDefault?: boolean;
    }>
  >([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [selectedTicketTid, setSelectedTicketTid] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<InboxMessageRow[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyChannel, setReplyChannel] = useState<'both' | 'telegram' | 'site'>('both');
  const [sendingReply, setSendingReply] = useState(false);

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

  const searchSuggestions = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const results: Array<{ id: string; type: 'user' | 'order' | 'promo'; title: string; subtitle: string; tab: AdminTab }> = [];

    users.forEach((u) => {
      if (results.length >= 6) return;
      if (u.telegramId.toLowerCase().includes(q) || u.firstName.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q))) {
        results.push({
          id: `u_${u.telegramId}`,
          type: 'user',
          title: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.telegramId,
          subtitle: `Foydalanuvchi · ID: ${u.telegramId} · Balans: ${formatSom(u.balance)}`,
          tab: 'users',
        });
      }
    });

    orders.forEach((o) => {
      if (results.length >= 10) return;
      if (o.orderId.toLowerCase().includes(q) || (o.telegramId && o.telegramId.toLowerCase().includes(q))) {
        results.push({
          id: `o_${o.orderId}`,
          type: 'order',
          title: `Buyurtma #${o.orderId}`,
          subtitle: `TolovGo · ${formatSom(o.amount)} · ${o.status.toUpperCase()}`,
          tab: 'orders',
        });
      }
    });

    promos.forEach((p) => {
      if (results.length >= 12) return;
      if (p.code.toLowerCase().includes(q)) {
        results.push({
          id: `p_${p.code}`,
          type: 'promo',
          title: `Promokod: ${p.code}`,
          subtitle: `Bonus: ${formatSom(p.bonusAmount)} · Foydalanish: ${p.usedCount}/${p.maxUses}`,
          tab: 'pricing',
        });
      }
    });

    return results;
  }, [globalSearchQuery, users, orders, promos]);

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
    telegramOnlyMode: true,
    supportUsername: '',
    botWelcomeTitle: '',
  });
  const [savingSiteCfg, setSavingSiteCfg] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [syncingBotWebhook, setSyncingBotWebhook] = useState(false);

  // Security Scanner, Threat Logs, Log Analyzer & Audit
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLogRow[]>([]);
  const [securitySeverityFilter, setSecuritySeverityFilter] = useState<
    'all' | 'unresolved' | 'critical' | 'high' | 'medium'
  >('all');
  const [lastScanReport, setLastScanReport] = useState<SecurityScanReport | null>(null);
  const [runningScan, setRunningScan] = useState(false);
  const [simulatingAttack, setSimulatingAttack] = useState(false);
  const [analyzingLogs, setAnalyzingLogs] = useState(false);
  const [logAnalysisResult, setLogAnalysisResult] = useState<{
    unresolvedCount: number;
    criticalCount: number;
    topCategories: Array<[string, number]>;
    topIps: Array<[string, number]>;
    analysisText: string;
    alertSent: boolean;
  } | null>(null);
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
      inbox: hasPerm('support'),
      users: hasPerm('users') || hasPerm('balance'),
      managers: isSuperAdmin,
      orders: hasPerm('orders') || hasPerm('settings'),
      pricing: hasPerm('pricing') || hasPerm('promos'),
      marketing: hasPerm('broadcast') || hasPerm('settings'),
      security: hasPerm('security') || isSuperAdmin,
    };
    if (!allowed[activeTab]) {
      const firstAllowed = (Object.keys(allowed) as AdminTab[]).find((k) => allowed[k]);
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [activeTab, hasPerm, isSuperAdmin]);

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
          can('support')
            ? adminListSupportTickets(telegramSessionToken, token).then((r) => {
                setSupportTickets(r.tickets);
                setSupportAgents(r.supportAgents);
              })
            : Promise.resolve(),
          can('security')
            ? adminListSecurityLogs(telegramSessionToken, token).then((r) => {
                setSecurityLogs(r.logs);
                if (r.lastScan) setLastScanReport(r.lastScan);
              })
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

  const handleOpenSupportThread = useCallback(
    async (tid: string) => {
      if (!adminToken) return;
      setSelectedTicketTid(tid);
      setLoadingThread(true);
      try {
        const res = await adminGetSupportThread(telegramSessionToken, adminToken, tid);
        setThreadMessages(res.messages);
        if (res.ticket) {
          setSupportTickets((prev) =>
            prev.map((t) => (t.telegramId === tid ? { ...res.ticket!, unreadForStaff: 0 } : t))
          );
        }
      } finally {
        setLoadingThread(false);
      }
    },
    [adminToken, telegramSessionToken]
  );

  useEffect(() => {
    if (!adminToken || activeTab !== 'inbox') return;
    const timer = window.setInterval(() => {
      void adminListSupportTickets(telegramSessionToken, adminToken).then((r) => {
        setSupportTickets(r.tickets);
        setSupportAgents(r.supportAgents);
      });
      if (selectedTicketTid) {
        void adminGetSupportThread(telegramSessionToken, adminToken, selectedTicketTid).then(
          (res) => {
            setThreadMessages(res.messages);
          }
        );
      }
    }, 8000);
    return () => window.clearInterval(timer);
  }, [adminToken, activeTab, selectedTicketTid, telegramSessionToken]);

  const handleChangeAnalyticsDays = async (days: 7 | 14 | 30) => {
    setAnalyticsDays(days);
    if (!adminToken) return;
    const r = await adminGetAnalytics(telegramSessionToken, adminToken, days);
    if (r.analytics) setAnalytics(r.analytics);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const minLen = effectiveRole === 'manager' || effectiveRole === 'support' ? 6 : 8;
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
    let days = 0;
    if (nextBanned) {
      const input = prompt(
        `Foydalanuvchi (${u.firstName}) ni bloklash muddati (kunlarda):\n0 = Doimiy blok\n1, 3, 7, 30 = Belgilangan kunlar soni`,
        '0'
      );
      if (input === null) return;
      days = Math.max(0, parseInt(input, 10) || 0);
    }
    const res = await adminSetUserBanned(telegramSessionToken, adminToken, u.telegramId, nextBanned, days);
    if (!res.ok) {
      onNotify('err', res.error || 'Xatolik yuz berdi.');
      return;
    }
    onNotify('ok', nextBanned ? `${u.firstName} ${days > 0 ? `${days} kunga` : 'doimiy'} bloklandi.` : `${u.firstName} blokdan chiqarildi.`);
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
      onNotify('err', "Xodimning to'g'ri Telegram ID raqamini kiriting.");
      return;
    }
    setSavingMgr(true);
    try {
      const res = await adminUpsertManager(telegramSessionToken, adminToken, {
        telegramId: mgrTelegramId.trim(),
        firstName:
          mgrFirstName.trim() ||
          `${mgrRoleType === 'support' ? 'Support' : 'Menejer'} ${mgrTelegramId.trim().slice(-4)}`,
        username: mgrUsername.trim() || undefined,
        roleTitle:
          mgrRoleTitle.trim() || (mgrRoleType === 'support' ? 'Support Mutaxassisi' : 'CRM Menejer'),
        roleType: mgrRoleType,
        isSupportDefault: mgrRoleType === 'support' ? mgrIsSupportDefault : false,
        permissions: mgrPerms,
        password: mgrPassword.trim() || undefined,
        isActive: mgrIsActive,
        notifyTelegram: mgrNotifyTg,
      });
      if (!res.ok) {
        onNotify('err', res.error || "Xodimni saqlab bo'lmadi.");
        return;
      }
      onNotify(
        'ok',
        `${mgrRoleType === 'support' ? 'Support mutaxassisi' : 'Menejer'} saqlandi va Telegram bot orqali xabardor qilindi.`
      );
      setMgrTelegramId('');
      setMgrFirstName('');
      setMgrUsername('');
      setMgrPassword('');
      setMgrIsSupportDefault(false);
      const [mgrRes, evRes, supRes] = await Promise.all([
        adminListManagers(telegramSessionToken, adminToken),
        adminListCrmEvents(telegramSessionToken, adminToken),
        adminListSupportTickets(telegramSessionToken, adminToken),
      ]);
      setManagers(mgrRes.managers);
      setCrmEvents(evRes.events);
      setSupportAgents(supRes.supportAgents);
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

  const handleReplySupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !selectedTicketTid || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await adminReplySupportTicket(
        telegramSessionToken,
        adminToken,
        selectedTicketTid,
        replyText.trim(),
        replyChannel
      );
      if (!res.ok) {
        onNotify('err', res.error || 'Javob yuborilmadi.');
        return;
      }
      setReplyText('');
      if (res.message) setThreadMessages((prev) => [...prev, res.message!]);
      if (res.ticket) {
        setSupportTickets((prev) =>
          prev.map((t) => (t.telegramId === selectedTicketTid ? res.ticket! : t))
        );
      }
      onNotify(
        'ok',
        res.telegramSent
          ? 'Javob saytga va mijozning Telegram lichkasiga yuborildi.'
          : 'Javob Support Inboxga saqlandi.'
      );
    } finally {
      setSendingReply(false);
    }
  };

  const handleAssignTicket = async (tid: string, assignedTo: string) => {
    if (!adminToken) return;
    const res = await adminAssignSupportTicket(
      telegramSessionToken,
      adminToken,
      tid,
      assignedTo || null
    );
    if (!res.ok) {
      onNotify('err', res.error || 'Biriktirib bo‘lmadi.');
      return;
    }
    setSupportTickets((prev) =>
      prev.map((t) =>
        t.telegramId === tid
          ? {
              ...t,
              assignedTo: res.assignedTo || undefined,
              assignedName: res.assignedName || undefined,
            }
          : t
      )
    );
    onNotify('ok', res.assignedName ? `Biriktirildi: ${res.assignedName}` : 'Biriktirish yechildi.');
  };

  const handleUpdateTicketStatus = async (tid: string, status: SupportTicketStatus) => {
    if (!adminToken) return;
    const res = await adminUpdateSupportStatus(telegramSessionToken, adminToken, tid, status);
    if (!res.ok) {
      onNotify('err', res.error || "Holat o'zgartirilmadi.");
      return;
    }
    setSupportTickets((prev) =>
      prev.map((t) => (t.telegramId === tid ? { ...t, status } : t))
    );
    onNotify('ok', `Tiket holati: ${status}`);
  };

  const handleRunSecurityScan = async () => {
    if (!adminToken || runningScan) return;
    setRunningScan(true);
    try {
      const res = await adminRunSecurityScan(telegramSessionToken, adminToken);
      if (!res.ok || !res.report) {
        onNotify('err', res.error || 'Xavfsizlik skaneri ishga tushmadi.');
        return;
      }
      setLastScanReport(res.report);
      onNotify('ok', res.report.summary);
    } finally {
      setRunningScan(false);
    }
  };

  const handleSimulateAttack = async () => {
    if (!adminToken || simulatingAttack) return;
    setSimulatingAttack(true);
    try {
      const res = await fetch('/api/payments/tolovgo/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tolovgo-Signature': 'fake_signature_test_999',
        },
        body: JSON.stringify({
          order_id: 999999,
          status: 'paid',
          amount: 500000,
        }),
      });
      await res.json();
      onNotify('ok', "Soxta hujum simulyatsiyasi bajarildi! Kiber tizim logni qayd etdi.");
      const secRes = await adminListSecurityLogs(telegramSessionToken, adminToken);
      if (secRes.logs) {
        setSecurityLogs(secRes.logs);
      }
    } catch (err: any) {
      onNotify('err', 'Simulyatsiya xatosi: ' + (err.message || 'Xatolik'));
    } finally {
      setSimulatingAttack(false);
    }
  };

  const handleAnalyzeSecurityLogs = async () => {
    if (!adminToken || analyzingLogs) return;
    setAnalyzingLogs(true);
    try {
      const res = await adminAnalyzeSecurityLogs(telegramSessionToken, adminToken, true);
      if (!res.ok) {
        onNotify('err', res.error || 'Loglar tahlil qilinmadi.');
        return;
      }
      setLogAnalysisResult({
        unresolvedCount: res.unresolvedCount || 0,
        criticalCount: res.criticalCount || 0,
        topCategories: res.topCategories || [],
        topIps: res.topIps || [],
        analysisText: res.analysisText || '',
        alertSent: Boolean(res.alertSent),
      });
      onNotify(
        'ok',
        res.alertSent
          ? 'Loglar tahlil qilindi va Telegram/CRM ogohlantirish yuborildi!'
          : 'Loglar tahlili yakunlandi.'
      );
    } finally {
      setAnalyzingLogs(false);
    }
  };

  const handleResolveSecLog = async (logId: string) => {
    if (!adminToken) return;
    const res = await adminResolveSecurityLog(telegramSessionToken, adminToken, logId);
    if (!res.ok) {
      onNotify('err', res.error || 'Yopilmadi.');
      return;
    }
    setSecurityLogs((prev) =>
      prev.map((l) => (l.id === logId ? { ...l, isResolved: true } : l))
    );
    onNotify('ok', 'Xavfsizlik logi hal qilingan deb belgilandi.');
  };

  const handleSyncBotWebhook = async () => {
    if (!adminToken || syncingBotWebhook) return;
    setSyncingBotWebhook(true);
    try {
      const res = await adminSetupTelegramWebhook(telegramSessionToken, adminToken);
      if (!res.ok) {
        onNotify('err', res.error || 'Bot webhook sozlanmadi.');
        return;
      }
      onNotify('ok', `Bot Webhook, MenuButton va 6 ta buyruq yangilandi (@${res.botUsername || 'bot'})`);
    } finally {
      setSyncingBotWebhook(false);
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

  const filteredTickets = useMemo(() => {
    const q = ticketSearch.trim().toLowerCase();
    return supportTickets.filter((t) => {
      if (ticketFilter !== 'all' && t.status !== ticketFilter) return false;
      if (!q) return true;
      return (
        t.telegramId.toLowerCase().includes(q) ||
        t.userFirstName.toLowerCase().includes(q) ||
        (t.userUsername || '').toLowerCase().includes(q) ||
        t.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [supportTickets, ticketFilter, ticketSearch]);

  const filteredSecurityLogs = useMemo(() => {
    if (securitySeverityFilter === 'all') return securityLogs;
    if (securitySeverityFilter === 'unresolved') return securityLogs.filter((l) => !l.isResolved);
    return securityLogs.filter((l) => l.severity === securitySeverityFilter);
  }, [securityLogs, securitySeverityFilter]);

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
              SlaydCanva{' '}
              {effectiveRole === 'support'
                ? 'Support CRM'
                : effectiveRole === 'manager'
                  ? 'Menejer CRM'
                  : 'Admin CRM'}{' '}
              · Xavfsizlik
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
                      {effectiveRole === 'support'
                        ? 'SUPPORT'
                        : effectiveRole === 'manager'
                          ? 'MENEJER'
                          : 'SUPER ADMIN'}{' '}
                      ID: {telegramUser.telegramId}
                    </span>
                  </div>
                  <h1 className="font-display text-lg font-bold text-zinc-900">
                    {passwordConfigured
                      ? effectiveRole === 'support'
                        ? 'Support CRM paneliga kirish'
                        : effectiveRole === 'manager'
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
                        effectiveRole === 'manager' || effectiveRole === 'support'
                          ? 'Kamida 6 ta belgi'
                          : 'Kamida 8 ta belgi'
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
  const unreadSupportCount = supportTickets.reduce(
    (sum, t) => sum + (t.unreadForStaff || 0),
    0
  );
  const unresolvedCriticalLogs = securityLogs.filter(
    (l) => !l.isResolved && (l.severity === 'critical' || l.severity === 'high')
  ).length;

  const navItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    visible: boolean;
    badge?: number;
  }> = [
    {
      id: 'overview',
      label: 'CRM & 20 Statistika',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: hasPerm('overview') || hasPerm('crm_events'),
      badge: overview.unreadCrmEvents || crmEvents.filter((e) => !e.isRead).length || undefined,
    },
    {
      id: 'inbox',
      label: 'Support Inbox',
      icon: <Headphones className="w-4 h-4" />,
      visible: hasPerm('support'),
      badge: unreadSupportCount > 0 ? unreadSupportCount : undefined,
    },
    {
      id: 'users',
      label: 'Foydalanuvchilar',
      icon: <Users className="w-4 h-4" />,
      visible: hasPerm('users') || hasPerm('balance'),
    },
    {
      id: 'managers',
      label: 'Jamoa & Support',
      icon: <UserCheck className="w-4 h-4" />,
      visible: isSuperAdmin,
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
      label: 'Xavfsizlik & Skaner',
      icon: <ShieldCheck className="w-4 h-4" />,
      visible: hasPerm('security') || isSuperAdmin,
      badge: unresolvedCriticalLogs > 0 ? unresolvedCriticalLogs : undefined,
    },
  ];

  const visibleNavItems = navItems.filter((n) => n.visible);

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F4F6] flex flex-col md:flex-row overflow-hidden">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#111113] text-white border-r border-zinc-800 flex-col">
        <div className="h-[54px] px-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-4 h-4 text-red-500 shrink-0" />
            <span className="font-display text-sm font-bold tracking-tight truncate">
              Slayd<span className="text-red-500">Canva</span>{' '}
              {isSuperAdmin ? 'Admin' : effectiveRole === 'support' ? 'Support' : 'Menejer'}
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
              {isSuperAdmin
                ? 'Super Admin'
                : effectiveRole === 'support'
                  ? 'Support Mutaxassisi'
                  : 'Menejer'}{' '}
              · ID {telegramUser.telegramId}
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

          {/* Google-like Global Search & Suggestions */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm mx-2">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={globalSearchQuery}
                onChange={(e) => {
                  setGlobalSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                placeholder="Google kabi qidirish (Foydalanuvchi, buyurtma, promo)..."
                className="w-full pl-9 pr-8 py-1.5 bg-zinc-100 hover:bg-zinc-200/60 focus:bg-white border border-zinc-200 focus:border-red-500 rounded-xl text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition-all shadow-2xs"
              />
              {globalSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="absolute right-2.5 text-zinc-400 hover:text-zinc-700 text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {showSearchDropdown && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden z-50 divide-y divide-zinc-100 max-h-72 overflow-y-auto">
                <div className="px-3 py-1.5 bg-zinc-50 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Tezkor qidiruv natijalari ({searchSuggestions.length})
                </div>
                {searchSuggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setGlobalSearchQuery('');
                      setShowSearchDropdown(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-zinc-50 flex items-start gap-2.5 transition-colors"
                  >
                    <span className="w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">
                      {item.type === 'user' ? 'U' : item.type === 'order' ? 'O' : 'P'}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 truncate">{item.title}</div>
                      <div className="text-[11px] text-zinc-500 truncate">{item.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
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

                {/* #2 20 Coordinate-Based Statistics */}
                {hasPerm('overview') && (
                  <AdminCoordinateStats
                    analytics={analytics}
                    overview={overview}
                    days={analyticsDays}
                    onChangeDays={(d) => void handleChangeAnalyticsDays(d)}
                  />
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
                TAB 1B: BIDIRECTIONAL SUPPORT INBOX (TELEGRAM LICHKA + SAYT CHAT)
                ============================================================ */}
            {activeTab === 'inbox' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-[calc(100vh-140px)] min-h-[540px]">
                {/* Left: Ticket List */}
                <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
                  <div className="p-3.5 border-b border-zinc-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <Headphones className="w-4 h-4 text-red-600" />
                        <span>Murojaatlar ({filteredTickets.length})</span>
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          adminToken &&
                          void adminListSupportTickets(telegramSessionToken, adminToken).then((r) => {
                            setSupportTickets(r.tickets);
                            setSupportAgents(r.supportAgents);
                          })
                        }
                        className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900"
                        aria-label="Yangilash"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        placeholder="Ism, @username, ID yoki matn..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                      {(
                        [
                          { id: 'all', label: 'Hammasi' },
                          { id: 'open', label: 'Ochiq' },
                          { id: 'pending', label: 'Jarayon' },
                          { id: 'resolved', label: 'Yopilgan' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setTicketFilter(st.id)}
                          className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                            ticketFilter === st.id
                              ? 'bg-white text-zinc-900 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                    {filteredTickets.length === 0 ? (
                      <div className="py-12 px-4 text-center text-xs text-zinc-400">
                        Hozircha murojaatlar yo‘q. Mijozlar saytdan yoki Telegram bot lichkasidan yozganda shu yerda paydo bo‘ladi.
                      </div>
                    ) : (
                      filteredTickets.map((t) => {
                        const active = selectedTicketTid === t.telegramId;
                        return (
                          <button
                            key={t.telegramId}
                            type="button"
                            onClick={() => void handleOpenSupportThread(t.telegramId)}
                            className={`w-full px-3.5 py-3 text-left transition-colors space-y-1 ${
                              active ? 'bg-red-50/70 border-l-2 border-red-600' : 'hover:bg-zinc-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-zinc-900 truncate">
                                {t.userFirstName}{' '}
                                {t.userUsername ? (
                                  <span className="font-normal text-zinc-500">@{t.userUsername}</span>
                                ) : null}
                              </div>
                              {t.unreadForStaff > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-red-600 text-white font-mono text-[10px] font-semibold">
                                  {t.unreadForStaff}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-600 line-clamp-1">
                              {t.lastMessage || t.subject}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                              <span>
                                {t.status === 'resolved'
                                  ? 'Yopilgan'
                                  : t.status === 'pending'
                                    ? 'Jarayonda'
                                    : 'Ochiq'}
                                {t.assignedName ? ` · ${t.assignedName}` : ''}
                              </span>
                              <span>{formatDateTime(t.updatedAt)}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Right: Active Conversation Thread */}
                <section className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col">
                  {!selectedTicketTid ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-2 text-zinc-400">
                      <Headphones className="w-8 h-8 text-zinc-300" />
                      <div className="text-sm font-medium text-zinc-600">
                        Suhbatni boshlash uchun chapdan murojaat tanlang
                      </div>
                      <p className="text-xs max-w-sm">
                        Javoblaringizni bir vaqtning o‘zida ham sayt ichidagi Support chatiga, ham mijozning Telegram lichkasiga yuborishingiz mumkin.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const activeTicket = supportTickets.find(
                        (t) => t.telegramId === selectedTicketTid
                      );
                      return (
                        <>
                          {/* Thread Header */}
                          <div className="p-3.5 md:p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-zinc-900 truncate">
                                {activeTicket?.userFirstName || selectedTicketTid}{' '}
                                {activeTicket?.userUsername ? `@${activeTicket.userUsername}` : ''}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-500">
                                ID {selectedTicketTid} · Mavzu: {activeTicket?.subject || 'Yordam'}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={activeTicket?.assignedTo || ''}
                                onChange={(e) =>
                                  void handleAssignTicket(selectedTicketTid, e.target.value)
                                }
                                aria-label="Support mutaxassisiga biriktirish"
                                className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none"
                              >
                                <option value="">Biriktirilmagan</option>
                                {supportAgents.map((ag) => (
                                  <option key={ag.telegramId} value={ag.telegramId}>
                                    {ag.firstName} ({ag.roleTitle})
                                  </option>
                                ))}
                              </select>

                              <select
                                value={activeTicket?.status || 'open'}
                                onChange={(e) =>
                                  void handleUpdateTicketStatus(
                                    selectedTicketTid,
                                    e.target.value as SupportTicketStatus
                                  )
                                }
                                aria-label="Murojaat holati"
                                className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none"
                              >
                                <option value="open">Ochiq</option>
                                <option value="pending">Jarayonda</option>
                                <option value="resolved">Hal qilindi</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('users');
                                  void handleOpenUserDetail(selectedTicketTid);
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700"
                              >
                                CRM Profil
                              </button>
                            </div>
                          </div>

                          {/* Messages Scroll Area */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/60">
                            {loadingThread && threadMessages.length === 0 ? (
                              <div className="py-10 text-center text-xs text-zinc-400">
                                <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
                                Xabarlar yuklanmoqda...
                              </div>
                            ) : threadMessages.length === 0 ? (
                              <div className="py-10 text-center text-xs text-zinc-400">
                                Ushbu foydalanuvchi bilan hali xabarlar yo‘q.
                              </div>
                            ) : (
                              threadMessages.map((m) => {
                                const isStaff = m.senderRole === 'staff';
                                return (
                                  <div
                                    key={m.id}
                                    className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                                  >
                                    <div
                                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                                        isStaff
                                          ? 'bg-[#111113] text-white rounded-br-sm'
                                          : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm'
                                      }`}
                                    >
                                      <div
                                        className={`text-[10px] font-semibold mb-0.5 ${
                                          isStaff ? 'text-red-400' : 'text-zinc-500'
                                        }`}
                                      >
                                        {m.senderName} ·{' '}
                                        {isStaff ? 'Support / Staff' : 'Mijoz'}
                                      </div>
                                      <div className="whitespace-pre-wrap break-words">
                                        {m.message}
                                      </div>
                                      <div className="text-[10px] font-mono text-zinc-400 mt-1">
                                        {formatDateTime(m.createdAt)} ·{' '}
                                        {m.channel === 'both'
                                          ? 'Sayt + TG Lichka'
                                          : m.channel === 'telegram'
                                            ? 'Telegram Lichka'
                                            : 'Sayt Chat'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Reply Form */}
                          <form
                            onSubmit={handleReplySupportSubmit}
                            className="p-3.5 border-t border-zinc-200 bg-white space-y-2.5"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-medium text-zinc-600">
                                Yuborish kanali:
                              </span>
                              <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg">
                                {(
                                  [
                                    { id: 'both', label: 'Sayt + Telegram Lichka' },
                                    { id: 'telegram', label: 'Faqat Telegram' },
                                    { id: 'site', label: 'Faqat Sayt' },
                                  ] as const
                                ).map((ch) => (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => setReplyChannel(ch.id)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                      replyChannel === ch.id
                                        ? 'bg-white text-zinc-900 shadow-xs'
                                        : 'text-zinc-600 hover:text-zinc-900'
                                    }`}
                                  >
                                    {ch.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Mijozga javob yozing..."
                                className="flex-1 text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none"
                              />
                              <button
                                type="submit"
                                disabled={sendingReply || !replyText.trim()}
                                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                              >
                                {sendingReply ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                <span>Yuborish</span>
                              </button>
                            </div>
                          </form>
                        </>
                      );
                    })()
                  )}
                </section>
              </div>
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
                              <div className="flex items-center gap-2.5">
                                {u.photoUrl ? (
                                  <img src={u.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-700 font-semibold text-xs flex items-center justify-center shrink-0">
                                    {(u.firstName || 'U')[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-zinc-900">
                                    {u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ')}
                                  </div>
                                  <div className="text-[11px] text-zinc-500">
                                    {u.username ? `@${u.username}` : 'usernamesiz'}
                                    {' · '}
                                    {u.referralCount} ta referal
                                  </div>
                                </div>
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

                      <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-zinc-700">
                          Xodim turi (Rol)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMgrRoleType('manager');
                              setMgrIsSupportDefault(false);
                              if (!mgrRoleTitle || mgrRoleTitle === 'Support Mutaxassisi') {
                                setMgrRoleTitle('CRM Menejer');
                              }
                            }}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-colors ${
                              mgrRoleType === 'manager'
                                ? 'bg-[#111113] border-[#111113] text-white'
                                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Menejer
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMgrRoleType('support');
                              if (!mgrRoleTitle || mgrRoleTitle === 'CRM Menejer') {
                                setMgrRoleTitle('Support Mutaxassisi');
                              }
                              setMgrPerms((prev) =>
                                prev.includes('support') ? prev : [...prev, 'support']
                              );
                            }}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-colors ${
                              mgrRoleType === 'support'
                                ? 'bg-red-600 border-red-600 text-white'
                                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Support Xodimi
                          </button>
                        </div>
                      </div>

                      {mgrRoleType === 'support' && (
                        <label className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50/70 border border-red-200 text-xs text-red-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mgrIsSupportDefault}
                            onChange={(e) => setMgrIsSupportDefault(e.target.checked)}
                            className="accent-red-600 w-3.5 h-3.5"
                          />
                          <span>Mijozlarga asosiy Support mutaxassisi sifatida ko‘rsatish</span>
                        </label>
                      )}

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
                                <div className="font-medium text-zinc-800">
                                  {m.roleTitle}{' '}
                                  <span
                                    className={`text-[10px] font-mono ${
                                      m.roleType === 'support' ? 'text-red-600 font-semibold' : 'text-zinc-500'
                                    }`}
                                  >
                                    [{m.roleType === 'support' ? 'SUPPORT' : 'MENEJER'}
                                    {m.isSupportDefault ? ' · ASOSIY' : ''}]
                                  </span>
                                </div>
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
                                      setMgrRoleType(m.roleType === 'support' ? 'support' : 'manager');
                                      setMgrIsSupportDefault(Boolean(m.isSupportDefault));
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

                          const svcKey = item.key as Exclude<
                            keyof AppPricingSettings['services'],
                            'five_block_infographic'
                          >;
                          const cfg =
                            pricingDraft.services?.[svcKey] ||
                            DEFAULT_PRICING_SETTINGS.services[svcKey];
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
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-[11px] font-medium text-zinc-700">Kod</label>
                          <button
                            type="button"
                            onClick={() => {
                              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                              let rnd = 'SLAYD';
                              for (let i = 0; i < 4; i++) {
                                rnd += chars[Math.floor(Math.random() * chars.length)];
                              }
                              setPromoCode(rnd);
                            }}
                            className="text-[11px] font-medium text-red-600 hover:underline flex items-center gap-0.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Tasodifiy</span>
                          </button>
                        </div>
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
                                  {hasPerm('broadcast') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBroadcastMsg(
                                          `🎁 Yangi promokod: ${p.code}\n💰 Bonus: +${formatSom(p.bonusAmount)}\n\nBalans to'ldirish bo'limida «${p.code}» kodini kiriting!`
                                        );
                                        setActiveTab('marketing');
                                      }}
                                      className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-medium"
                                    >
                                      Botda e’lon
                                    </button>
                                  )}
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

                      <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer">
                        <div>
                          <div className="text-xs font-semibold text-zinc-900">
                            Faqat Telegram ilovasi (Mini App) orqali kirish
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            Yoqilganda oddiy brauzerdagi oddiy foydalanuvchilar botdagi «Ilovani ochish» tugmasiga yo‘naltiriladi (xodimlar kira oladi).
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={siteConfigDraft.telegramOnlyMode}
                          onChange={(e) =>
                            setSiteConfigDraft((s) => ({
                              ...s,
                              telegramOnlyMode: e.target.checked,
                            }))
                          }
                          className="accent-red-600 w-4 h-4 shrink-0"
                        />
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Zaxira Support @username
                          </label>
                          <input
                            type="text"
                            value={siteConfigDraft.supportUsername || ''}
                            onChange={(e) =>
                              setSiteConfigDraft((s) => ({ ...s, supportUsername: e.target.value }))
                            }
                            placeholder="@slaydcanva_support"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-zinc-700">
                            Bot /start sarlavhasi
                          </label>
                          <input
                            type="text"
                            value={siteConfigDraft.botWelcomeTitle || ''}
                            onChange={(e) =>
                              setSiteConfigDraft((s) => ({ ...s, botWelcomeTitle: e.target.value }))
                            }
                            placeholder="SlaydCanva AI — Telegramda Tezkor Taqdimot!"
                            className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={savingSiteCfg}
                          className="py-2.5 px-3 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Sozlamalarni saqlash</span>
                        </button>
                        <button
                          type="button"
                          disabled={testingAlert}
                          onClick={() => void handleTestTelegramAlert()}
                          className="py-2.5 px-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5 text-red-600" />
                          <span>{testingAlert ? 'Yuborilmoqda...' : 'Sinov Bot Alert'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={syncingBotWebhook}
                          onClick={() => void handleSyncBotWebhook()}
                          className="py-2.5 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          {syncingBotWebhook ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Bot Webhook + 5 Tugma</span>
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
                {/* Security Scanner & Automatic Log Analyzer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Scanner Card */}
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-red-600" />
                          <span>Tizim Xavfsizlik Skaneri</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Env kalitlar, TolovGo HMAC, Telegram-only darvozasi va shubhali loglarni tekshirish.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={simulatingAttack}
                          onClick={() => void handleSimulateAttack()}
                          className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                        >
                          {simulatingAttack ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          )}
                          <span>{simulatingAttack ? 'Sinovda...' : 'Soxta Hujum Testi'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={runningScan}
                          onClick={() => void handleRunSecurityScan()}
                          className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                        >
                          {runningScan ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                          )}
                          <span>{runningScan ? 'Skanerlanmoqda...' : 'Skanerlash'}</span>
                        </button>
                      </div>
                    </div>

                    {lastScanReport ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-zinc-900">
                              {lastScanReport.summary}
                            </div>
                            <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                              Xavf darajasi: {lastScanReport.riskLevel.toUpperCase()} · Tahdidlar:{' '}
                              {lastScanReport.threatsDetected} · {formatDateTime(lastScanReport.scannedAt)}
                            </div>
                          </div>
                          <div
                            className={`text-xl font-bold font-mono tabular-nums shrink-0 ${
                              lastScanReport.score >= 85
                                ? 'text-emerald-700'
                                : lastScanReport.score >= 60
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                            }`}
                          >
                            {lastScanReport.score}/100
                          </div>
                        </div>

                        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl max-h-56 overflow-y-auto">
                          {lastScanReport.checks.map((chk) => (
                            <div key={chk.id} className="p-2.5 flex items-start justify-between gap-2 text-xs">
                              <div className="min-w-0">
                                <div className="font-semibold text-zinc-900">{chk.name}</div>
                                <div className="text-[11px] text-zinc-600">{chk.message}</div>
                                {chk.recommendation && (
                                  <div className="text-[10px] text-amber-700 mt-0.5">
                                    Tavsiya: {chk.recommendation}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`font-mono text-[11px] font-semibold uppercase shrink-0 ${
                                  chk.status === 'pass'
                                    ? 'text-emerald-700'
                                    : chk.status === 'warn'
                                      ? 'text-amber-700'
                                      : 'text-red-600'
                                }`}
                              >
                                {chk.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                        Tizim himoyasini tekshirish uchun «Skanerlash» tugmasini bosing.
                      </div>
                    )}
                  </section>

                  {/* Auto Log Analyzer Card */}
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-red-600" />
                          <span>Log Tahlilchisi & Avto-Xabarnoma</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Xavfsizlik loglarini tahlil qilib xavfli IP va hujumlarni darhol Telegram botga yuboradi.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={analyzingLogs}
                        onClick={() => void handleAnalyzeSecurityLogs()}
                        className="px-3.5 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        {analyzingLogs ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>{analyzingLogs ? 'Tahlil...' : 'Loglarni Tahlil Qilish'}</span>
                      </button>
                    </div>

                    {logAnalysisResult ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                            <div className="text-[11px] text-zinc-500">Yopilmagan</div>
                            <div className="font-mono tabular-nums font-bold text-zinc-900">
                              {logAnalysisResult.unresolvedCount}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200">
                            <div className="text-[11px] text-red-700">Kritik</div>
                            <div className="font-mono tabular-nums font-bold text-red-700">
                              {logAnalysisResult.criticalCount}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200">
                            <div className="text-[11px] text-zinc-500">Bot Alert</div>
                            <div className="font-mono font-bold text-zinc-900">
                              {logAnalysisResult.alertSent ? 'Yuborildi' : 'Kerak emas'}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-700 leading-relaxed">
                          {logAnalysisResult.analysisText}
                        </div>

                        {logAnalysisResult.topIps.length > 0 && (
                          <div className="text-[11px] font-mono text-zinc-600">
                            Shubhali IP manzillar:{' '}
                            {logAnalysisResult.topIps.map(([ip, cnt]) => `${ip} (${cnt}x)`).join(' · ')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
                        Oxirgi 150 ta xavfsizlik hodisasini tahlil qilish va xavflarni aniqlash uchun bosing.
                      </div>
                    )}
                  </section>
                </div>

                {/* Threat / Security Logs Table */}
                <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        Real vaqt Xavfsizlik & Tahdid Loglari ({filteredSecurityLogs.length})
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Noto‘g‘ri TolovGo imzosi, admin parol xatolari, yaroqsiz WebApp va Telegram-only urinishlari avtomatik qayd etiladi.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                      {(
                        [
                          { id: 'all', label: 'Barchasi' },
                          { id: 'unresolved', label: 'Ochiq' },
                          { id: 'critical', label: 'Kritik' },
                          { id: 'high', label: 'Yuqori' },
                          { id: 'medium', label: "O'rta" },
                        ] as const
                      ).map((sf) => (
                        <button
                          key={sf.id}
                          type="button"
                          onClick={() => setSecuritySeverityFilter(sf.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            securitySeverityFilter === sf.id
                              ? 'bg-white text-zinc-900 shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          {sf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                          <th className="py-2.5 px-4 font-medium">Vaqt</th>
                          <th className="py-2.5 px-4 font-medium">Daraja</th>
                          <th className="py-2.5 px-4 font-medium">Hodisa</th>
                          <th className="py-2.5 px-4 font-medium">IP / User</th>
                          <th className="py-2.5 px-4 font-medium text-right">Holat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredSecurityLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-400">
                              Hozircha xavfsizlik tahdidlari qayd etilmagan.
                            </td>
                          </tr>
                        ) : (
                          filteredSecurityLogs.slice(0, 60).map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-50/70">
                              <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-500 whitespace-nowrap">
                                {formatDateTime(log.createdAt)}
                              </td>
                              <td className="py-2.5 px-4 font-mono uppercase font-semibold">
                                <span
                                  className={
                                    log.severity === 'critical'
                                      ? 'text-red-600'
                                      : log.severity === 'high'
                                        ? 'text-amber-700'
                                        : 'text-zinc-600'
                                  }
                                >
                                  {log.severity}
                                </span>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="font-semibold text-zinc-900">{log.title}</div>
                                <div className="text-[11px] text-zinc-500">{log.details}</div>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-600">
                                <div>{log.ipAddress || '—'}</div>
                                {log.userId && <div>ID {log.userId}</div>}
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                {log.isResolved ? (
                                  <span className="text-emerald-700 font-medium">Hal qilingan</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void handleResolveSecLog(log.id)}
                                    className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 font-medium"
                                  >
                                    Hal qilindi
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
                    <div className="px-3.5 py-2.5 bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-900 flex items-center justify-between">
                      <span>Amaliyotlar ({selectedUserDetail.transactions.length})</span>
                      <span className="text-[10px] text-zinc-400">Batafsil uchun bosing</span>
                    </div>
                    <div className="divide-y divide-zinc-100 max-h-44 overflow-y-auto">
                      {selectedUserDetail.transactions.length === 0 ? (
                        <div className="p-4 text-center text-zinc-400">Amaliyotlar yo‘q</div>
                      ) : (
                        selectedUserDetail.transactions.map((t) => (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => setSelectedAdminTx(t)}
                            className="w-full px-3.5 py-2.5 flex justify-between gap-2 text-left hover:bg-zinc-50 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-zinc-900 font-medium truncate">{t.title}</div>
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
                          </button>
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

      {/* Admin Transaction Detail & PDF Receipt Modal */}
      {selectedAdminTx && (
        <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-zinc-200">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h3 className="text-base font-bold text-zinc-900">Tranzaksiya Tafsiloti & PDF Chek</h3>
              <p className="text-xs text-zinc-500 font-mono">ID: #{selectedAdminTx.id}</p>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 text-xs border border-zinc-200/80">
              <div className="flex justify-between">
                <span className="text-zinc-500">Mijoz / Foydalanuvchi</span>
                <span className="font-semibold text-zinc-900">{selectedUserDetail?.user.firstName} ({selectedUserDetail?.user.telegramId})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Amaliyot sarlavhasi</span>
                <span className="font-semibold text-zinc-900 text-right">{selectedAdminTx.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">To'lov / Amal usuli</span>
                <span className="font-medium text-zinc-800">{selectedAdminTx.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sana va Vaqt</span>
                <span className="font-mono text-zinc-800">{selectedAdminTx.date}</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                <span className="text-zinc-700 font-medium">Summa</span>
                <span className={`text-base font-bold font-mono tabular-nums ${selectedAdminTx.amount < 0 ? 'text-zinc-900' : 'text-emerald-600'}`}>
                  {selectedAdminTx.amount < 0 ? `-${formatSom(Math.abs(selectedAdminTx.amount))}` : `+${formatSom(selectedAdminTx.amount)}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <span>PDF Chek / Chop Etish</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAdminTx(null)}
                className="w-full py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
