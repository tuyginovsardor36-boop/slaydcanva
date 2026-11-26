import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileType2,
  Loader2,
  LogOut,
  Plus,
  Presentation,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { AI_SERVICES } from '../data/aiServices';
import { formatSom } from '../data/defaults';
import {
  AiServiceId,
  BalanceTransaction,
  MobileTab,
  TelegramUser,
  TolovgoPaymentMode,
  UserProfile,
  WorkspaceMode,
} from '../types/editor';
import {
  formatTelegramDisplayName,
  getTelegramAuthHeaders,
  TelegramAccountResponse,
  TelegramConfigResponse,
} from '../utils/telegramClient';
import { ServiceThumbnail } from './AiServicesView';

interface HomeViewProps {
  docTitle: string;
  pptxCount: number;
  pdfCount: number;
  balance: number;
  onOpenEditor: (mode: WorkspaceMode) => void;
  onOpenAiService: (id: AiServiceId) => void;
  onOpenTab: (tab: MobileTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  docTitle,
  pptxCount,
  pdfCount,
  balance,
  onOpenEditor,
  onOpenAiService,
  onOpenTab,
}) => {
  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-4 py-5 space-y-5">
      {/* Balance summary strip - Obsidian hero card matching brand logo */}
      <section className="bg-[#111113] text-white border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="text-xs text-zinc-400">Joriy balans</div>
          <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
            {formatSom(balance)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenTab('topup')}
          className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-full transition-colors whitespace-nowrap shrink-0"
        >
          To'ldirish
        </button>
      </section>

      {/* AI Services Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-zinc-900">
              AI Xizmatlar · Avtomatik tayyorlash
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {AI_SERVICES.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => onOpenAiService(svc.id)}
              className="w-full bg-white border border-zinc-200 hover:border-red-500 rounded-2xl p-3 text-left transition-colors flex items-center gap-3"
            >
              <div className="w-28 shrink-0">
                <ServiceThumbnail id={svc.id} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 truncate">
                    {svc.title}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug">
                  {svc.subtitle}
                </p>
                <div className="pt-0.5 flex items-center justify-between">
                  <span className="text-[11px] font-mono tabular-nums font-semibold text-red-600">
                    {formatSom(svc.price)}
                  </span>
                  <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                    Yaratish
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Quick Start Manual Tools */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-zinc-900 px-0.5">
          Qo'lda tahrirlash muhiti
        </h2>

        <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-100">
          <button
            type="button"
            onClick={() => onOpenEditor('pptx')}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 transition-colors rounded-t-2xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <Presentation className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  Slayd · PPTX
                </div>
                <div className="text-xs text-slate-500 truncate">
                  16:9 taqdimot tayyorlash ·{' '}
                  <span className="font-mono tabular-nums">{pptxCount}</span> ta slayd
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onOpenEditor('word')}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  Hujjat · Word
                </div>
                <div className="text-xs text-slate-500 truncate">
                  A4 matn va jadval muhiti (.docx)
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onOpenEditor('pdf')}
            className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors rounded-b-2xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <FileType2 className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">
                  PDF sahifa
                </div>
                <div className="text-xs text-slate-500 truncate">
                  Tik va yotiq A4 sahifalar ·{' '}
                  <span className="font-mono tabular-nums">{pdfCount}</span> ta sahifa
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
          </button>
        </div>
      </section>

      {/* Active Project Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">Joriy loyiha</div>
          <div className="text-sm font-semibold text-slate-900 truncate mt-0.5">
            {docTitle || 'Yangi loyiha'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenTab('editor')}
          className="px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors whitespace-nowrap shrink-0"
        >
          Davom etish
        </button>
      </section>
    </main>
  );
};

interface TopUpViewProps {
  balance: number;
  tolovgoMode?: TolovgoPaymentMode;
  telegramSessionToken?: string | null;
  onTopUp: (amount: number, method: string, externalOrderId?: string) => void;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

interface PendingTolovgoOrder {
  orderId: string;
  amount: number;
  payUrl: string;
  method: string;
  isTest?: boolean;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
}

const PRESET_AMOUNTS = [25000, 50000, 100000, 250000];
const PAYMENT_METHODS = ['Click', 'Payme', 'Uzum / Karta'];

export const TopUpView: React.FC<TopUpViewProps> = ({
  balance,
  tolovgoMode = 'live',
  telegramSessionToken = null,
  onTopUp,
  onNotify,
}) => {
  const [amountText, setAmountText] = useState('50000');
  const [method, setMethod] = useState('Click');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [serverConfig, setServerConfig] = useState<{
    isTestMode: boolean;
    hasLiveKey: boolean;
    hasTestKey: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingTolovgoOrder | null>(null);

  const creditedOrdersRef = useRef<Set<string>>(new Set());
  const onTopUpRef = useRef(onTopUp);
  onTopUpRef.current = onTopUp;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const parsedAmount = Math.max(0, Number(amountText.replace(/\D/g, '')) || 0);

  useEffect(() => {
    let active = true;
    fetch('/api/payments/tolovgo/config')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          cfg: {
            isTestMode?: boolean;
            hasLiveKey?: boolean;
            hasTestKey?: boolean;
          } | null
        ) => {
          if (active && cfg) {
            setServerConfig({
              isTestMode: Boolean(cfg.isTestMode),
              hasLiveKey: Boolean(cfg.hasLiveKey),
              hasTestKey: Boolean(cfg.hasTestKey),
            });
          }
        }
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const effectiveMode: TolovgoPaymentMode =
    tolovgoMode === 'test' && (serverConfig ? serverConfig.hasTestKey : true)
      ? 'test'
      : tolovgoMode === 'live' && (serverConfig ? serverConfig.hasLiveKey : true)
        ? 'live'
        : serverConfig?.isTestMode
          ? 'test'
          : 'live';

  const checkOrderStatus = useCallback(async (order: PendingTolovgoOrder, silent = false) => {
    if (!order?.orderId) return;
    if (!silent) setChecking(true);
    try {
      const modeParam = order.isTest ? 'test' : 'live';
      const res = await fetch(
        `/api/payments/tolovgo/status/${encodeURIComponent(order.orderId)}?mode=${modeParam}`,
        {
          headers: getTelegramAuthHeaders(telegramSessionToken),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        status?: PendingTolovgoOrder['status'];
        paid?: boolean;
        newlyCredited?: boolean;
        amount?: number;
        error?: string;
      };

      if (!res.ok) {
        if (!silent) {
          setErrorMsg(data.error || "To'lov holatini tekshirib bo'lmadi.");
        }
        return;
      }

      const nextStatus = data.status || 'pending';
      if (data.paid || nextStatus === 'paid') {
        if (!creditedOrdersRef.current.has(order.orderId)) {
          creditedOrdersRef.current.add(order.orderId);
          const finalAmount =
            typeof data.amount === 'number' && data.amount >= 1000 ? data.amount : order.amount;
          setPendingOrder(null);
          setErrorMsg(null);
          onTopUpRef.current(
            finalAmount,
            order.isTest ? `TolovGo (Sinov) · ${order.method}` : `TolovGo · ${order.method}`,
            order.orderId
          );
          onNotifyRef.current?.('ok', `TolovGo to'lovi tasdiqlandi: +${formatSom(finalAmount)}`);
        }
        return;
      }

      setPendingOrder((curr) => (curr && curr.orderId === order.orderId ? { ...curr, status: nextStatus } : curr));

      if (nextStatus === 'expired' || nextStatus === 'cancelled' || nextStatus === 'refunded') {
        const msg =
          nextStatus === 'expired'
            ? "To'lov havolasi muddati tugadi (1 soat). Qaytadan yarating."
            : nextStatus === 'cancelled'
              ? "To'lov bekor qilindi."
              : "To'lov qaytarildi.";
        setErrorMsg(msg);
      } else if (!silent) {
        onNotifyRef.current?.('ok', "To'lov hali kutilmoqda. TolovGo sahifasida tasdiqlang.");
      }
    } catch {
      if (!silent) {
        setErrorMsg("Server bilan bog'lanishda xatolik yuz berdi.");
      }
    } finally {
      if (!silent) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!pendingOrder || pendingOrder.status !== 'pending') return;
    const timer = window.setInterval(() => {
      void checkOrderStatus(pendingOrder, true);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [pendingOrder, checkOrderStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount < 1000 || creating) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/payments/tolovgo/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTelegramAuthHeaders(telegramSessionToken),
        },
        body: JSON.stringify({
          amount: parsedAmount,
          providerHint: method,
          mode: effectiveMode,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        orderId?: string;
        amount?: number;
        payUrl?: string;
        test?: boolean;
        error?: string;
      };

      if (!res.ok || !data.orderId || !data.payUrl) {
        setErrorMsg(data.error || "TolovGo hisob-fakturasini yaratishda xatolik yuz berdi.");
        return;
      }

      setPendingOrder({
        orderId: data.orderId,
        amount: typeof data.amount === 'number' ? data.amount : parsedAmount,
        payUrl: data.payUrl,
        method,
        isTest: Boolean(data.test),
        status: 'pending',
      });
    } catch {
      setErrorMsg("TolovGo xizmatiga ulanib bo'lmadi. Internet aloqasini tekshiring.");
    } finally {
      setCreating(false);
    }
  };

  const showTestBadge = Boolean(
    pendingOrder ? pendingOrder.isTest : effectiveMode === 'test'
  );

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F5F7] px-4 py-5">
      <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Joriy balans</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatSom(balance)}
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0 ${
              showTestBadge
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{showTestBadge ? 'TolovGo · Sinov' : 'TolovGo · UZS'}</span>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed"
          >
            {errorMsg}
          </div>
        )}

        {pendingOrder ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Buyurtma #{pendingOrder.orderId}
                </span>
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                  {pendingOrder.status === 'pending' ? 'Kutilmoqda' : pendingOrder.status}
                </span>
              </div>
              <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
                {formatSom(pendingOrder.amount)}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {pendingOrder.isTest ? (
                  <>
                    Sinov havolasi: TolovGo sahifasida{' '}
                    <strong>«To'landi deb belgilash»</strong> tugmasini bosing (haqiqiy pul yechilmaydi).
                  </>
                ) : (
                  <>
                    TolovGo sahifasida <strong>{pendingOrder.method}</strong> (yoki Click / Payme / Uzum)
                    orqali to'lang. Tasdiqlangach balans avtomatik to'ldiriladi.
                  </>
                )}
              </p>
            </div>

            <a
              href={pendingOrder.payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>TolovGo sahifasini ochish</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={checking}
                onClick={() => void checkOrderStatus(pendingOrder, false)}
                className="py-2.5 px-3 rounded-full text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {checking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>To'lovni tekshirish</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingOrder(null);
                  setErrorMsg(null);
                }}
                className="py-2.5 px-3 rounded-full text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Boshqa summa</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="topup-amount"
                className="block text-xs font-medium text-slate-700"
              >
                To'ldirish summasi (so'm)
              </label>
              <input
                id="topup-amount"
                type="text"
                inputMode="numeric"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ''))}
                placeholder="50000"
                className="w-full text-base font-mono tabular-nums font-semibold text-slate-900 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                {PRESET_AMOUNTS.map((val) => {
                  const active = parsedAmount === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmountText(String(val))}
                      className={`py-2 px-3 rounded-full text-xs font-mono tabular-nums font-medium border transition-colors ${
                        active
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {formatSom(val)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-700">
                To'lov tizimi (TolovGo orqali)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors truncate ${
                      method === m
                        ? 'bg-red-50 border-red-600 text-red-700'
                        : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={parsedAmount < 1000 || creating}
              className="w-full py-3 px-4 rounded-full text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-45 transition-colors flex items-center justify-center gap-2"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>{creating ? 'Hisob-faktura yaratilmoqda...' : "TolovGo orqali to'lash"}</span>
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

interface BalanceViewProps {
  balance: number;
  transactions: BalanceTransaction[];
  onGoTopUp: () => void;
}

export const BalanceView: React.FC<BalanceViewProps> = ({
  balance,
  transactions,
  onGoTopUp,
}) => {
  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-4 py-5 space-y-5">
      <section className="max-w-md mx-auto bg-[#111113] text-white border border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Wallet className="w-3.5 h-3.5 text-red-500" />
            <span>Mavjud balans</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {formatSom(balance)}
          </div>
        </div>
        <button
          type="button"
          onClick={onGoTopUp}
          className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-full transition-colors whitespace-nowrap shrink-0"
        >
          To'ldirish
        </button>
      </section>

      <section className="max-w-md mx-auto space-y-2.5">
        <h2 className="text-sm font-semibold text-slate-900 px-0.5">
          Amaliyotlar tarixi
        </h2>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Hozircha amaliyotlar mavjud emas.
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {tx.title}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>{tx.method}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{tx.date}</span>
                  </div>
                </div>
                <div
                  className={`text-sm font-mono tabular-nums font-semibold whitespace-nowrap shrink-0 ${
                    tx.amount < 0 ? 'text-slate-700' : 'text-emerald-700'
                  }`}
                >
                  {tx.amount < 0 ? `-${formatSom(Math.abs(tx.amount))}` : `+${formatSom(tx.amount)}`}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
};

interface ProfileViewProps {
  profile: UserProfile;
  balance: number;
  pptxCount: number;
  pdfCount: number;
  tolovgoMode: TolovgoPaymentMode;
  telegramUser?: TelegramUser | null;
  telegramSessionToken?: string | null;
  onTelegramAuthenticated?: (payload: {
    user: TelegramUser;
    sessionToken: string;
    account?: TelegramAccountResponse;
    kvConfigured?: boolean;
  }) => void;
  onUpdateTelegramPrefs?: (prefs: { autoSendFiles?: boolean; notifyOnActivity?: boolean }) => void;
  onTelegramLogout?: () => void;
  onChangeTolovgoMode: (mode: TolovgoPaymentMode) => void;
  onSaveProfile: (profile: UserProfile) => void;
  onOpenTab: (tab: MobileTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  balance,
  pptxCount,
  pdfCount,
  tolovgoMode,
  telegramUser,
  telegramSessionToken,
  onTelegramAuthenticated,
  onUpdateTelegramPrefs,
  onTelegramLogout,
  onChangeTolovgoMode,
  onSaveProfile,
  onOpenTab,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [contact, setContact] = useState(profile.contact);
  const [saved, setSaved] = useState(false);
  const [tolovgoKeys, setTolovgoKeys] = useState<{
    hasLiveKey: boolean;
    hasTestKey: boolean;
  } | null>(null);
  const [tgConfig, setTgConfig] = useState<TelegramConfigResponse | null>(null);
  const [loginNonce, setLoginNonce] = useState<string>('');
  const [waitingTelegramAuth, setWaitingTelegramAuth] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName);
    setContact(profile.contact);
  }, [profile.fullName, profile.contact]);

  useEffect(() => {
    let active = true;
    fetch('/api/payments/tolovgo/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: { hasLiveKey?: boolean; hasTestKey?: boolean } | null) => {
        if (active && cfg) {
          setTolovgoKeys({
            hasLiveKey: Boolean(cfg.hasLiveKey),
            hasTestKey: Boolean(cfg.hasTestKey),
          });
        }
      })
      .catch(() => {});

    fetch('/api/telegram/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: TelegramConfigResponse | null) => {
        if (active && cfg) {
          setTgConfig(cfg);
        }
      })
      .catch(() => {});

    const bytes = new Uint8Array(9);
    window.crypto.getRandomValues(bytes);
    setLoginNonce(
      Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!waitingTelegramAuth || !loginNonce || telegramUser) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/telegram/auth/poll?nonce=${encodeURIComponent(loginNonce)}`
        );
        if (!res.ok || !active) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: TelegramUser;
          sessionToken?: string;
          account?: TelegramAccountResponse;
          kvConfigured?: boolean;
        };
        if (data.authenticated && data.user && data.sessionToken && active) {
          setWaitingTelegramAuth(false);
          onTelegramAuthenticated?.({
            user: data.user,
            sessionToken: data.sessionToken,
            account: data.account,
            kvConfigured: data.kvConfigured,
          });
        }
      } catch {
        // Ignore transient network failures during polling
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [waitingTelegramAuth, loginNonce, telegramUser, onTelegramAuthenticated]);

  const initials = (fullName || 'F')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile({
      fullName: fullName.trim() || 'Foydalanuvchi',
      contact: contact.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const botDeepLink =
    tgConfig?.botUsername && loginNonce
      ? `https://t.me/${tgConfig.botUsername}?start=auth_${loginNonce}`
      : tgConfig?.botUsername
        ? `https://t.me/${tgConfig.botUsername}`
        : null;

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F5F7] px-4 py-5 space-y-5">
      <section className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-display font-bold text-base flex items-center justify-center shrink-0">
          {initials || 'F'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold text-slate-900 truncate">
            {profile.fullName || 'Foydalanuvchi'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {telegramUser
              ? formatTelegramDisplayName(telegramUser)
              : profile.contact || "Kontakt kiritilmagan"}
          </div>
        </div>
      </section>

      <section className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-3 divide-x divide-slate-100 text-center">
        <div className="px-2">
          <div className="text-base font-bold font-mono tabular-nums text-slate-900">
            {pptxCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Slaydlar</div>
        </div>
        <div className="px-2">
          <div className="text-base font-bold font-mono tabular-nums text-slate-900">
            {pdfCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">PDF sahifa</div>
        </div>
        <button
          type="button"
          onClick={() => onOpenTab('balance')}
          className="px-2 text-center hover:bg-zinc-50 rounded-r-xl transition-colors"
        >
          <div className="text-sm font-bold font-mono tabular-nums text-red-600 truncate">
            {balance.toLocaleString('uz-UZ').replace(/,/g, ' ')}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Balans (so'm)</div>
        </button>
      </section>

      {/* Telegram Bot & Auth Card */}
      <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-5 space-y-3.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
              <Send className="w-4 h-4 text-sky-600" />
              <span>Telegram Bot va Auth</span>
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
              Bildirishnomalar, tarix, TolovGo balans to'ldirish va tayyor fayllar Telegram chatga boradi
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${
              telegramUser
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-zinc-100 border-zinc-200 text-zinc-600'
            }`}
          >
            {telegramUser ? 'Ulangan' : 'Ulanmagan'}
          </span>
        </div>

        {telegramUser ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 truncate">
                  {formatTelegramDisplayName(telegramUser)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Telegram ID: {telegramUser.telegramId}
                </div>
              </div>
              {tgConfig?.botUsername && (
                <a
                  href={`https://t.me/${tgConfig.botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-sky-200 text-sky-700 text-[11px] font-medium hover:bg-sky-50 flex items-center gap-1 shrink-0"
                >
                  <span>Bot</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="text-xs font-medium text-zinc-800">
                  Tayyor fayllarni Telegramga yuborish
                </span>
              </div>
              <input
                type="checkbox"
                checked={telegramUser.autoSendFiles !== false}
                onChange={(e) => onUpdateTelegramPrefs?.({ autoSendFiles: e.target.checked })}
                className="accent-red-600 w-4 h-4 shrink-0"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-200 cursor-pointer hover:bg-zinc-50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-xs font-medium text-zinc-800">
                  To'lov va AI bildirishnomalari
                </span>
              </div>
              <input
                type="checkbox"
                checked={telegramUser.notifyOnActivity !== false}
                onChange={(e) => onUpdateTelegramPrefs?.({ notifyOnActivity: e.target.checked })}
                className="accent-red-600 w-4 h-4 shrink-0"
              />
            </label>

            {onTelegramLogout && (
              <button
                type="button"
                onClick={onTelegramLogout}
                className="w-full py-2 px-3 rounded-full border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Telegram hisobidan chiqish</span>
              </button>
            )}
          </div>
        ) : tgConfig?.configured && botDeepLink ? (
          <div className="space-y-2.5">
            <a
              href={botDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setWaitingTelegramAuth(true)}
              className="w-full py-2.5 px-4 rounded-full text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Telegram bot orqali kirish (@{tgConfig.botUsername})</span>
            </a>

            {waitingTelegramAuth && (
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-[11px] text-sky-800 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>
                  Botda <strong>Start</strong> bosing — kirish avtomatik tasdiqlanadi (yoki botdagi «Saytga kirish» tugmasini bosing).
                </span>
              </div>
            )}

            {!telegramSessionToken && (
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Botga kirib <code>/start</code> bossangiz, barcha tayyor slayd va hujjatlaringiz hamda balans tarixi Telegram chatda ko'rinadi.
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
            Telegram botni ulash uchun Vercel Environment Variables bo'limida{' '}
            <code>TELEGRAM_BOT_TOKEN</code>, <code>TELEGRAM_BOT_USERNAME</code> va{' '}
            <code>TELEGRAM_WEBHOOK_SECRET</code> o'zgaruvchilarini kiriting.
          </div>
        )}
      </section>

      {/* Vaqtinchalik TolovGo rejimi sozlamasi */}
      <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              TolovGo rejimi
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Vaqtinchalik sozlama: real va sinov kalitlari orasida almashish
            </p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              tolovgoMode === 'test'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {tolovgoMode === 'test' ? 'Sinov' : 'Haqiqiy'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={tolovgoKeys !== null && !tolovgoKeys.hasLiveKey}
            onClick={() => onChangeTolovgoMode('live')}
            className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-45 ${
              tolovgoMode === 'live'
                ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <div className="text-xs font-semibold">Haqiqiy to'lov</div>
            <div className="text-[11px] opacity-75 mt-0.5">TOLOVGO_API_KEY</div>
          </button>

          <button
            type="button"
            disabled={tolovgoKeys !== null && !tolovgoKeys.hasTestKey}
            onClick={() => onChangeTolovgoMode('test')}
            className={`p-3 rounded-xl border text-left transition-colors disabled:opacity-45 ${
              tolovgoMode === 'test'
                ? 'bg-amber-50 border-amber-600 text-amber-900'
                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <div className="text-xs font-semibold">Sinov rejimi</div>
            <div className="text-[11px] opacity-75 mt-0.5">TOLOVGO_TEST_API</div>
          </button>
        </div>

        {tolovgoKeys && !tolovgoKeys.hasTestKey && !tolovgoKeys.hasLiveKey && (
          <p className="text-[11px] text-red-600">
            Serverda TOLOVGO_API_KEY yoki TOLOVGO_TEST_API topilmadi.
          </p>
        )}
      </section>

      <form
        onSubmit={handleSave}
        className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-5 space-y-4"
      >
        <h2 className="text-sm font-semibold text-zinc-900">
          Shaxsiy ma'lumotlar
        </h2>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-name"
            className="block text-xs font-medium text-zinc-700"
          >
            Ism familiya
          </label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-contact"
            className="block text-xs font-medium text-zinc-700"
          >
            Email yoki telefon
          </label>
          <input
            id="profile-contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full text-sm text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3.5 py-2.5 outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 px-4 rounded-full text-sm font-medium text-white bg-[#111113] hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
        >
          {saved && <Check className="w-4 h-4" />}
          <span>{saved ? 'Saqlandi' : 'Saqlash'}</span>
        </button>
      </form>
    </main>
  );
};
