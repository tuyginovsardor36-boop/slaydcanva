import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Ban,
  Check,
  Copy,
  CreditCard,
  Database,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Unlock,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { DEFAULT_PRICING_SETTINGS, formatSom } from '../data/defaults';
import {
  AdminAuditRow,
  AdminOrderRow,
  AdminOverviewStats,
  AdminUserRow,
  AppPricingSettings,
  TelegramUser,
  TolovgoPaymentMode,
} from '../types/editor';
import {
  adminAdjustUserBalance,
  adminChangePassword,
  adminGetOverview,
  adminGetStatus,
  adminListAuditLogs,
  adminListOrders,
  adminListUsers,
  adminLogin,
  adminSavePricing,
  adminSaveSettings,
  adminSetupPassword,
  adminSetUserBanned,
  getTelegramAuthHeaders,
} from '../utils/telegramClient';

type AdminTab = 'overview' | 'users' | 'orders' | 'pricing' | 'settings';

interface AdminDashboardProps {
  telegramUser: TelegramUser;
  telegramSessionToken: string;
  adminToken: string | null;
  onAdminTokenChange: (token: string | null) => void;
  onPricingUpdated: (pricing: AppPricingSettings) => void;
  onTolovgoModeUpdated: (mode: TolovgoPaymentMode) => void;
  onNotify: (type: 'ok' | 'err', text: string) => void;
  onClose: () => void;
}

const SERVICE_LABELS: Array<{
  key: keyof AppPricingSettings['services'];
  title: string;
  unitLabel: string;
  hasSteps: boolean;
}> = [
  {
    key: 'academic_wave_pptx',
    title: 'Akademik To‘lqin · PPTX',
    unitLabel: 'slayd',
    hasSteps: true,
  },
  {
    key: 'white_card_pptx',
    title: 'Oq Karta · PPTX',
    unitLabel: 'slayd',
    hasSteps: true,
  },
  {
    key: 'stitched_notebook_pdf',
    title: 'Tikilgan Daftar · PDF',
    unitLabel: 'topshiriq bloki',
    hasSteps: true,
  },
  {
    key: 'ai_canvas_design',
    title: 'AI Erkin Kanvas Dizayni',
    unitLabel: 'slayd',
    hasSteps: true,
  },
  {
    key: 'five_block_infographic',
    title: '5-Blokli Infografika',
    unitLabel: 'poster',
    hasSteps: false,
  },
];

function formatDateTime(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  telegramUser,
  telegramSessionToken,
  adminToken,
  onAdminTokenChange,
  onPricingUpdated,
  onTolovgoModeUpdated,
  onNotify,
  onClose,
}) => {
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [passwordConfigured, setPasswordConfigured] = useState<boolean>(true);
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

  // Dashboard Data
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
  });
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'pending' | 'test'>('all');
  const [checkingOrderId, setCheckingOrderId] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [pricingDraft, setPricingDraft] = useState<AppPricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [savingPricing, setSavingPricing] = useState(false);
  const [tolovgoMode, setTolovgoMode] = useState<TolovgoPaymentMode>('live');
  const [hasLiveKey, setHasLiveKey] = useState(false);
  const [hasTestKey, setHasTestKey] = useState(false);
  const [neonConfigured, setNeonConfigured] = useState(false);
  const [tablesReady, setTablesReady] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Balance Adjust Modal
  const [balanceTarget, setBalanceTarget] = useState<AdminUserRow | null>(null);
  const [balanceOp, setBalanceOp] = useState<'add' | 'sub'>('add');
  const [balanceAmountText, setBalanceAmountText] = useState('10000');
  const [balanceReason, setBalanceReason] = useState('');
  const [balanceNotifyTg, setBalanceNotifyTg] = useState(true);
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);

  // Password Change Form
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwdConfirm, setNewPwdConfirm] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

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
        if (res.tolovgoCallbackUrl) setTolovgoCallbackUrl(res.tolovgoCallbackUrl);
        if (res.telegramWebhookUrl) setTelegramWebhookUrl(res.telegramWebhookUrl);
        if (adminToken && !res.adminUnlocked) {
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
    async (token: string) => {
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
        setOverview(res.overview);
        setOrders(res.orders);
        setAuditLogs(res.auditLogs);
        setPricingDraft(res.pricing);
        setTolovgoMode(res.tolovgoMode);
        setHasLiveKey(res.hasLiveKey);
        setHasTestKey(res.hasTestKey);
        setNeonConfigured(res.neonConfigured);
        setTablesReady(res.tablesReady);
        if (res.tolovgoCallbackUrl) setTolovgoCallbackUrl(res.tolovgoCallbackUrl);
        if (res.telegramWebhookUrl) setTelegramWebhookUrl(res.telegramWebhookUrl);

        const usersRes = await adminListUsers(telegramSessionToken, token, '');
        setUsers(usersRes.users);
      } finally {
        setLoadingData(false);
      }
    },
    [telegramSessionToken, onAdminTokenChange, onNotify]
  );

  useEffect(() => {
    if (adminToken) {
      void loadAllAdminData(adminToken);
    }
  }, [adminToken, loadAllAdminData]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (passwordInput.length < 8) {
      setAuthError("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
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

      setPasswordInput('');
      setConfirmPasswordInput('');
      setPasswordConfigured(true);
      onAdminTokenChange(res.adminToken);
      onNotify(
        'ok',
        passwordConfigured
          ? 'Admin panel muvaffaqiyatli ochildi.'
          : "Maxfiy admin paroli o'rnatildi va panel ochildi."
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSearchUsers = async (queryText: string) => {
    if (!adminToken) return;
    setUsersLoading(true);
    try {
      const res = await adminListUsers(telegramSessionToken, adminToken, queryText);
      if (res.error) {
        onNotify('err', res.error);
      } else {
        setUsers(res.users);
      }
    } finally {
      setUsersLoading(false);
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
      (delta > 0 ? "Admin tomonidan balans to'ldirildi" : 'Admin tomonidan balans tuzatildi');

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
        onNotify('err', res.error || "Xatolik yuz berdi.");
        return;
      }
      onNotify('ok', `Balans yangilandi: ${formatSom(res.balance ?? 0)}`);
      setBalanceTarget(null);
      setBalanceReason('');
      await Promise.all([
        handleSearchUsers(userSearch),
        loadAllAdminData(adminToken),
      ]);
    } finally {
      setBalanceSubmitting(false);
    }
  };

  const handleToggleBan = async (u: AdminUserRow) => {
    if (!adminToken) return;
    if (u.telegramId === telegramUser.telegramId) {
      onNotify('err', "O'z admin hisobingizni bloklab bo'lmaydi.");
      return;
    }
    const nextBanned = !u.isBanned;
    const res = await adminSetUserBanned(telegramSessionToken, adminToken, u.telegramId, nextBanned);
    if (!res.ok) {
      onNotify('err', res.error || "Xatolik yuz berdi.");
      return;
    }
    onNotify('ok', nextBanned ? `${u.firstName} bloklandi.` : `${u.firstName} blokdan chiqarildi.`);
    setUsers((prev) =>
      prev.map((row) => (row.telegramId === u.telegramId ? { ...row, isBanned: nextBanned } : row))
    );
    const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
    setAuditLogs(logsRes.logs);
  };

  const handleCheckRemoteOrder = async (orderId: string) => {
    if (!adminToken) return;
    setCheckingOrderId(orderId);
    try {
      const res = await fetch(`/api/payments/tolovgo/status/${encodeURIComponent(orderId)}`, {
        headers: getTelegramAuthHeaders(telegramSessionToken),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (!res.ok) {
        onNotify('err', data.error || "Buyurtma holatini tekshirib bo'lmadi.");
        return;
      }
      onNotify('ok', `Buyurtma #${orderId}: ${data.status || 'tekshirildi'}`);
      const [ordRes] = await Promise.all([
        adminListOrders(telegramSessionToken, adminToken),
        loadAllAdminData(adminToken),
      ]);
      setOrders(ordRes.orders);
    } finally {
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
      onNotify('ok', 'Xizmat narxlari va bonus qoidalari bazaga saqlandi.');
      const logsRes = await adminListAuditLogs(telegramSessionToken, adminToken);
      setAuditLogs(logsRes.logs);
    } finally {
      setSavingPricing(false);
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

  // =========================================================================
  // 1) Security Gate Screen (First-Time Setup or Password Login)
  // =========================================================================
  if (!adminToken) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F4F4F6] flex flex-col">
        <header className="h-[54px] bg-[#111113] text-white border-b border-zinc-800 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="font-display text-sm font-bold tracking-tight">
              SlaydCanva Admin · Xavfsizlik darvozasi
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
                <span>Admin ruxsati tekshirilmoqda...</span>
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
                    <span>ADMIN ID: {telegramUser.telegramId}</span>
                  </div>
                  <h1 className="font-display text-lg font-bold text-zinc-900">
                    {passwordConfigured
                      ? 'Admin panelga kirish'
                      : "1-marta kirish: Maxfiy parol o'rnatish"}
                  </h1>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {passwordConfigured
                      ? "Davom etish uchun avval o'rnatilgan maxfiy admin parolini kiriting."
                      : "Siz birinchi marta admin panelga kiryapsiz. Boshqaruv panelini himoyalash uchun kamida 8 belgili maxfiy parol o'rnating — u bazada shifrlangan (scrypt) holda saqlanadi."}
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
                      {passwordConfigured ? 'Maxfiy admin paroli' : 'Yangi maxfiy parol'}
                    </label>
                    <input
                      id="admin-secret-pwd"
                      type="password"
                      autoFocus
                      autoComplete={passwordConfigured ? 'current-password' : 'new-password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Kamida 8 ta belgi"
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
                      {passwordConfigured ? 'Panelni ochish' : "Parolni o'rnatish va kirish"}
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
  // 2) Full SaaS Admin Dashboard Workspace
  // =========================================================================
  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Umumiy ko‘rsatkichlar', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'Foydalanuvchilar', icon: <Users className="w-4 h-4" /> },
    { id: 'orders', label: 'To‘lovlar · TolovGo', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'pricing', label: 'Narxlar va Bonuslar', icon: <Sliders className="w-4 h-4" /> },
    { id: 'settings', label: 'Sozlamalar va Audit', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F4F6] flex flex-col md:flex-row overflow-hidden">
      {/* Left Sidebar (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#111113] text-white border-r border-zinc-800 flex-col">
        <div className="h-[54px] px-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            <span className="font-display text-sm font-bold tracking-tight">
              Slayd<span className="text-red-500">Canva</span> Admin
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors text-left ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
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
              ID {telegramUser.telegramId}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onAdminTokenChange(null)}
              className="py-2 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Lock className="w-3 h-3" />
              <span>Qulflash</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-white flex items-center justify-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Chiqish</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-[54px] shrink-0 bg-white border-b border-zinc-200 px-4 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              aria-label="Saytga qaytish"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="font-display text-sm md:text-base font-bold text-zinc-900 truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span className="hidden sm:inline text-xs text-zinc-400">·</span>
            <span className="hidden sm:inline text-xs font-mono text-zinc-500">
              TolovGo: {tolovgoMode === 'test' ? 'Sinov' : 'Haqiqiy'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loadingData}
              onClick={() => void loadAllAdminData(adminToken)}
              className="px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Yangilash</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex px-3 py-1.5 rounded-lg bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Muhitga qaytish</span>
            </button>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="md:hidden shrink-0 bg-white border-b border-zinc-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0 transition-colors ${
                  active
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <>
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1.5">
                    <div className="text-xs text-zinc-500">Foydalanuvchilar</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {overview.totalUsers.toLocaleString('uz-UZ').replace(/,/g, ' ')}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Bloklangan: {overview.bannedUsers} · Loyihalar: {overview.totalProjects}
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1.5">
                    <div className="text-xs text-zinc-500">Jami foydalanuvchi balansi</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {formatSom(overview.totalBalance)}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Serverda saqlangan qoldiq
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1.5">
                    <div className="text-xs text-zinc-500">TolovGo tushumi</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                      {formatSom(overview.totalPaidRevenue)}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      To‘langan buyurtmalar: {overview.totalPaidOrders} ta
                    </div>
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-1.5">
                    <div className="text-xs text-zinc-500">Tasdiqlangan referallar</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-900">
                      {overview.totalReferrals}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      Bonus: +{formatSom(pricingDraft.referralInviterBonus)} / do‘st
                    </div>
                  </div>
                </section>

                {/* TolovGo & Telegram Webhook Reference Panel */}
                <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        TolovGo Webhook &amp; Tizim holati
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        TolovGo shaxsiy kabinetidagi Callback / Webhook URL maydoniga quyidagi manzilni qo‘shing
                      </p>
                    </div>
                    <div className="text-xs font-mono text-zinc-600 flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-zinc-500" />
                      <span>
                        Neon DB: {neonConfigured && tablesReady ? 'Tayyor' : neonConfigured ? 'Ulanmoqda' : 'Yo‘q'}
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
                  </div>
                </section>

                {/* Recent Orders Table */}
                <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Oxirgi TolovGo buyurtmalari
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Barchasini ko‘rish
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                          <th className="py-2.5 px-4 font-medium">Buyurtma ID</th>
                          <th className="py-2.5 px-4 font-medium">Summa</th>
                          <th className="py-2.5 px-4 font-medium">Foydalanuvchi</th>
                          <th className="py-2.5 px-4 font-medium">Holat</th>
                          <th className="py-2.5 px-4 font-medium">Sana</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {orders.slice(0, 8).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-400">
                              Hozircha buyurtmalar mavjud emas.
                            </td>
                          </tr>
                        ) : (
                          orders.slice(0, 8).map((o) => (
                            <tr key={o.orderId} className="hover:bg-zinc-50/70">
                              <td className="py-2.5 px-4 font-mono text-zinc-900">
                                #{o.orderId}
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-zinc-900">
                                {formatSom(o.amount)}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-zinc-600">
                                {o.telegramId || '—'}
                              </td>
                              <td className="py-2.5 px-4">
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
                                  {o.isTest ? ' · sinov' : ''}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums text-zinc-500">
                                {formatDateTime(o.createdAt)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {/* TAB 2: USERS */}
            {activeTab === 'users' && (
              <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="p-4 md:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Foydalanuvchilar va balans boshqaruvi
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Balans qo‘shish/ayirish faqat Admin va TolovGo orqali bajariladi hamda audit jurnaliga yoziladi.
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
                        placeholder="ID, @username yoki ism..."
                        className="pl-8 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl outline-none w-52 sm:w-60"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={usersLoading}
                      className="px-3.5 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium disabled:opacity-50"
                    >
                      Qidirish
                    </button>
                  </form>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/70 text-zinc-500">
                        <th className="py-3 px-4 font-medium">Telegram ID</th>
                        <th className="py-3 px-4 font-medium">Foydalanuvchi</th>
                        <th className="py-3 px-4 font-medium">Balans</th>
                        <th className="py-3 px-4 font-medium">Referal</th>
                        <th className="py-3 px-4 font-medium">Holat</th>
                        <th className="py-3 px-4 font-medium text-right">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-zinc-500">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                            Yuklanmoqda...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-zinc-400">
                            Foydalanuvchi topilmadi.
                          </td>
                        </tr>
                      ) : (
                        users.map((u) => (
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
                                {u.referredBy ? ` · taklif: ${u.referredBy}` : ''}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums font-semibold text-zinc-900">
                              {formatSom(u.balance)}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-zinc-700">
                              {u.referralCount} ta
                            </td>
                            <td className="py-3 px-4">
                              {u.isBanned ? (
                                <span className="font-medium text-red-600">Bloklangan</span>
                              ) : (
                                <span className="font-medium text-emerald-700">Faol</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
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
                                {u.isBanned ? (
                                  <>
                                    <Unlock className="w-3 h-3" />
                                    <span>Ochish</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3" />
                                    <span>Bloklash</span>
                                  </>
                                )}
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

            {/* TAB 3: ORDERS */}
            {activeTab === 'orders' && (
              <section className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
                <div className="p-4 md:p-5 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      TolovGo to‘lov buyurtmalari
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Sinov buyurtmalari faqat sinov rejimida hisobga qo‘shiladi. Haqiqiy rejimda qat’iy rad etiladi.
                    </p>
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                        <th className="py-3 px-4 font-medium">Usul / Rejim</th>
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
                                onClick={() => void handleCheckRemoteOrder(o.orderId)}
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
            )}

            {/* TAB 4: PRICING & BONUSES */}
            {activeTab === 'pricing' && (
              <form onSubmit={handleSavePricingSubmit} className="space-y-6">
                <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">
                        AI Xizmatlar narxlarini boshqarish (Bazaga saqlanadi)
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Narxlar backendda hisoblanadi va foydalanuvchi balansidan serverda yechiladi.
                      </p>
                    </div>
                    <button
                      type="submit"
                      disabled={savingPricing}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-55 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
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
                              <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
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
                                  const num = Math.max(0, Math.round(Number(e.target.value) || 0));
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

                      const cfg = pricingDraft.services[
                        item.key as Exclude<keyof AppPricingSettings['services'], 'five_block_infographic'>
                      ];
                      return (
                        <div
                          key={item.key}
                          className="py-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-center"
                        >
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
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
                                const num = Math.max(1, Math.min(20, Math.round(Number(e.target.value) || 1)));
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

                <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Xush kelibsiz va Referal bonus qoidalari
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Referal bonusi faqat birinchi marta botga kirgan haqiqiy foydalanuvchilar uchun bir marta beriladi.
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
                            referralInviterBonus: Math.max(0, Math.round(Number(e.target.value) || 0)),
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
                            referralInviteeBonus: Math.max(0, Math.round(Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-zinc-700">
                        Kunlik referal limiti (kishi / 24 soat)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={pricingDraft.dailyReferralLimit}
                        onChange={(e) =>
                          setPricingDraft((p) => ({
                            ...p,
                            dailyReferralLimit: Math.max(1, Math.min(200, Math.round(Number(e.target.value) || 1))),
                          }))
                        }
                        className="w-full text-sm font-mono tabular-nums bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                      />
                    </div>
                  </div>
                </section>
              </form>
            )}

            {/* TAB 5: SETTINGS & AUDIT LOGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* TolovGo Gateway Mode Switch */}
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-red-600" />
                          <span>TolovGo to‘lov rejimi</span>
                        </h2>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Oddiy foydalanuvchilar rejimni o‘zgartira olmaydi. Faqat admin boshqaradi.
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-zinc-800">
                        {tolovgoMode === 'test' ? 'Sinov' : 'Haqiqiy'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={savingMode || !hasLiveKey}
                        onClick={() => void handleChangeTolovgoModeAdmin('live')}
                        className={`p-3.5 rounded-xl border text-left transition-colors disabled:opacity-45 ${
                          tolovgoMode === 'live'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="text-xs font-semibold">Haqiqiy to‘lov (Live)</div>
                        <div className="text-[11px] opacity-75 font-mono mt-0.5">
                          TOLOVGO_API_KEY {hasLiveKey ? '· tayyor' : '· yo‘q'}
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={savingMode || !hasTestKey}
                        onClick={() => void handleChangeTolovgoModeAdmin('test')}
                        className={`p-3.5 rounded-xl border text-left transition-colors disabled:opacity-45 ${
                          tolovgoMode === 'test'
                            ? 'bg-amber-50 border-amber-600 text-amber-950'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="text-xs font-semibold">Sinov rejimi (Test)</div>
                        <div className="text-[11px] opacity-75 font-mono mt-0.5">
                          TOLOVGO_TEST_API {hasTestKey ? '· tayyor' : '· yo‘q'}
                        </div>
                      </button>
                    </div>
                  </section>

                  {/* Change Admin Password */}
                  <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-red-600" />
                        <span>Maxfiy admin parolini almashtirish</span>
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
                          placeholder="Yangi parol (min 8 belgi)"
                          className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
                        />
                        <input
                          type="password"
                          value={newPwdConfirm}
                          onChange={(e) => setNewPwdConfirm(e.target.value)}
                          placeholder="Yangi parolni tasdiqlang"
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
                    <span className="text-xs font-mono text-zinc-500">
                      Oxirgi {auditLogs.length} ta yozuv
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
                              <td className="py-2.5 px-4 font-mono text-zinc-900">
                                {log.action}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-zinc-600">
                                {log.actorId}
                                {log.targetId ? ` → ${log.targetId}` : ''}
                              </td>
                              <td className="py-2.5 px-4 font-mono tabular-nums font-semibold">
                                {typeof log.amountDelta === 'number' && log.amountDelta !== 0 ? (
                                  <span className={log.amountDelta > 0 ? 'text-emerald-700' : 'text-red-600'}>
                                    {log.amountDelta > 0 ? `+${formatSom(log.amountDelta)}` : `-${formatSom(Math.abs(log.amountDelta))}`}
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

      {/* Balance Adjustment Modal */}
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
              <span className="text-zinc-500">Joriy balans:</span>
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
