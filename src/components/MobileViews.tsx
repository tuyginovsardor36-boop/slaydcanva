import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  FileType2,
  FolderOpen,
  Gift,
  Headphones,
  Loader2,
  LogOut,
  Plus,
  Presentation,
  RefreshCw,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { AI_SERVICES } from '../data/aiServices';
import { DEFAULT_PRICING_SETTINGS, formatSom } from '../data/defaults';
import {
  AiServiceId,
  AppPricingSettings,
  BalanceTransaction,
  InboxMessageRow,
  ManagerPermission,
  MobileTab,
  ProjectSummary,
  StaffRole,
  SupportAgentPublic,
  SupportTicketRow,
  TelegramUser,
  TolovgoPaymentMode,
  UserFileRecord,
  UserProfile,
  WorkspaceMode,
} from '../types/editor';
import {
  fetchSupportInfo,
  fetchUserSavedFiles,
  formatTelegramDisplayName,
  getTelegramAuthHeaders,
  redeemPromoCode,
  sendUserSupportMessage,
  TelegramAccountResponse,
  TelegramConfigResponse,
} from '../utils/telegramClient';
import { ServiceThumbnail } from './AiServicesView';

interface HomeViewProps {
  docTitle: string;
  pptxCount: number;
  pdfCount: number;
  balance: number;
  pricingSettings?: AppPricingSettings;
  onOpenEditor: (mode: WorkspaceMode) => void;
  onOpenAiService: (id: AiServiceId) => void;
  onOpenTab: (tab: MobileTab) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  docTitle,
  balance,
  pricingSettings,
  onOpenAiService,
  onOpenTab,
}) => {
  const effectivePricing = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const primaryCards: Array<{
    id: AiServiceId;
    title: string;
    subtitle: string;
    formatLabel: string;
    basePrice: number;
  }> = [
    {
      id: 'academic_wave_pptx',
      title: 'Slayd (Prezentatsiya va taqdimot)',
      subtitle: 'Akademik, oq kartochkali yoki erkin dizayn uslublari',
      formatLabel: 'PPTX · PDF',
      basePrice: effectivePricing.services.academic_wave_pptx.basePrice,
    },
    {
      id: 'independent_work_word',
      title: 'Mustaqil ish (Referat)',
      subtitle: "O'zDST standarti: Titul, reja, boblar, xulosa, adabiyotlar",
      formatLabel: 'DOCX · PDF',
      basePrice:
        effectivePricing.services.independent_work_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.independent_work_word.basePrice,
    },
    {
      id: 'course_work_word',
      title: 'Kurs ishi',
      subtitle: 'OTM talabiga mos 3 bobli chuqur tadqiqot va tahlil',
      formatLabel: 'DOCX · PDF',
      basePrice:
        effectivePricing.services.course_work_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.course_work_word.basePrice,
    },
    {
      id: 'essay_article_word',
      title: 'Esse va Ilmiy maqola',
      subtitle: 'IMRAD ilmiy maqola, tahliliy esse yoki konferensiya tezisi',
      formatLabel: 'DOCX · PDF',
      basePrice:
        effectivePricing.services.essay_article_word?.basePrice ??
        DEFAULT_PRICING_SETTINGS.services.essay_article_word.basePrice,
    },
  ];

  const secondaryTools = AI_SERVICES.filter((s) => s.category === 'tools');

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-4 py-4 space-y-4">
      {/* Balance summary strip */}
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
          className="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          To'ldirish
        </button>
      </section>

      {/* Primary AI Services */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-zinc-900">
              Asosiy xizmatlar
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {primaryCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onOpenAiService(card.id)}
              className="w-full bg-white border border-zinc-200 hover:border-red-500 rounded-2xl p-3 text-left transition-colors flex items-center gap-3 min-h-[44px]"
            >
              <div className="w-24 shrink-0">
                <ServiceThumbnail id={card.id} />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-900 truncate">
                    {card.title}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 shrink-0">
                    {card.formatLabel}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 line-clamp-2 leading-snug">
                  {card.subtitle}
                </p>
                <div className="pt-0.5 flex items-center justify-between">
                  <span className="text-[11px] font-mono tabular-nums font-semibold text-red-600">
                    {formatSom(card.basePrice)}+
                  </span>
                  <span className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                    Tayyorlash
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Secondary Tools */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-zinc-600 px-0.5">
          Qo'shimcha xizmatlar
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {secondaryTools.map((svc) => (
            <button
              key={svc.id}
              type="button"
              onClick={() => onOpenAiService(svc.id)}
              className="bg-white border border-zinc-200 hover:border-red-500 rounded-xl p-3 text-left transition-colors space-y-1.5 min-h-[44px]"
            >
              <div className="text-xs font-semibold text-zinc-900 truncate">{svc.shortTitle}</div>
              <div className="text-[11px] font-mono tabular-nums font-semibold text-red-600">
                {formatSom(effectivePricing.services[svc.id].basePrice)}
              </div>
            </button>
          ))}
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
          className="px-4 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
        >
          Ko'rish
        </button>
      </section>
    </main>
  );
};

interface TopUpViewProps {
  balance: number;
  tolovgoMode?: TolovgoPaymentMode;
  telegramSessionToken?: string | null;
  onTopUp: (
    amount: number,
    method: string,
    externalOrderId?: string,
    serverBalance?: number
  ) => void;
  onPromoRedeemed?: (bonusAmount: number, serverBalance: number, code: string) => void;
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
  onPromoRedeemed,
  onNotify,
}) => {
  const [amountText, setAmountText] = useState('50000');
  const [method, setMethod] = useState('Click');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [redeemingPromo, setRedeemingPromo] = useState(false);
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

  const effectiveMode: TolovgoPaymentMode = serverConfig?.isTestMode
    ? 'test'
    : tolovgoMode === 'test' && !serverConfig
      ? 'test'
      : 'live';

  const checkOrderStatus = useCallback(
    async (order: PendingTolovgoOrder, silent = false) => {
      if (!order?.orderId) return;
      if (!silent) setChecking(true);
      try {
        const res = await fetch(
          `/api/payments/tolovgo/status/${encodeURIComponent(order.orderId)}`,
          {
            headers: getTelegramAuthHeaders(telegramSessionToken),
          }
        );
        const data = (await res.json().catch(() => ({}))) as {
          status?: PendingTolovgoOrder['status'];
          paid?: boolean;
          newlyCredited?: boolean;
          amount?: number;
          balance?: number;
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
              order.orderId,
              typeof data.balance === 'number' ? data.balance : undefined
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
    },
    [telegramSessionToken]
  );

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

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoInput.trim().toUpperCase();
    if (cleanCode.length < 3 || redeemingPromo) return;
    setRedeemingPromo(true);
    setErrorMsg(null);
    try {
      const res = await redeemPromoCode(cleanCode, telegramSessionToken);
      if (!res.ok) {
        setErrorMsg(res.error || "Promokodni faollashtirib bo'lmadi.");
        return;
      }
      setPromoInput('');
      if (typeof res.balance === 'number' && typeof res.bonusAmount === 'number') {
        onPromoRedeemed?.(res.bonusAmount, res.balance, cleanCode);
      }
      onNotifyRef.current?.(
        'ok',
        `Promokod (${cleanCode}) faollashtirildi: +${formatSom(res.bonusAmount || 0)}`
      );
    } finally {
      setRedeemingPromo(false);
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

        {/* Promo Code Redemption (Server-Verified Only) */}
        <div className="pt-4 border-t border-slate-100">
          <form onSubmit={handleRedeemPromo} className="space-y-2">
            <label
              htmlFor="promo-code-input"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700"
            >
              <Gift className="w-3.5 h-3.5 text-red-600" />
              <span>Promokod bormi?</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="promo-code-input"
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Masalan: SLAYD5000"
                className="flex-1 min-w-0 text-xs font-mono uppercase text-slate-900 bg-slate-50 border border-slate-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
              />
              <button
                type="submit"
                disabled={promoInput.trim().length < 3 || redeemingPromo}
                className="px-3.5 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-45 text-white text-xs font-medium shrink-0 transition-colors"
              >
                {redeemingPromo ? 'Tekshirilmoqda...' : 'Faollashtirish'}
              </button>
            </div>
          </form>
        </div>
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
  const [selectedTx, setSelectedTx] = useState<BalanceTransaction | null>(null);

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
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Amaliyotlar tarixi & Cheklar
          </h2>
          <span className="text-[11px] text-zinc-500">Batafsil ko'rish uchun bosing</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Hozircha amaliyotlar mavjud emas.
            </div>
          ) : (
            transactions.map((tx) => (
              <button
                type="button"
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 transition-colors"
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
                <div className="flex items-center gap-2">
                  <div
                    className={`text-sm font-mono tabular-nums font-semibold whitespace-nowrap shrink-0 ${
                      tx.amount < 0 ? 'text-slate-700' : 'text-emerald-700'
                    }`}
                  >
                    {tx.amount < 0 ? `-${formatSom(Math.abs(tx.amount))}` : `+${formatSom(tx.amount)}`}
                  </div>
                  <span className="text-xs text-zinc-400">›</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Receipt Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-zinc-200 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h3 className="text-base font-bold text-zinc-900">SlaydCanva Rasmiy Cheki</h3>
              <p className="text-xs text-zinc-500 font-mono">ID: #{selectedTx.id}</p>
            </div>

            <div className="bg-zinc-50 rounded-2xl p-4 space-y-3 text-xs border border-zinc-200/80">
              <div className="flex justify-between">
                <span className="text-zinc-500">Amaliyot nomi</span>
                <span className="font-semibold text-zinc-900 text-right">{selectedTx.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">To'lov / Amal usuli</span>
                <span className="font-medium text-zinc-800">{selectedTx.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Sana va Vaqt</span>
                <span className="font-mono text-zinc-800">{selectedTx.date}</span>
              </div>
              <div className="pt-2 border-t border-zinc-200 flex justify-between items-center">
                <span className="text-zinc-700 font-medium">Summa</span>
                <span className={`text-base font-bold font-mono tabular-nums ${selectedTx.amount < 0 ? 'text-zinc-900' : 'text-emerald-600'}`}>
                  {selectedTx.amount < 0 ? `-${formatSom(Math.abs(selectedTx.amount))}` : `+${formatSom(selectedTx.amount)}`}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-md transition-colors"
              >
                Chekni Chop Etish / Saqlash
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="w-full py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold transition-colors"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

interface SupportClientPanelProps {
  telegramSessionToken?: string | null;
  telegramUser?: TelegramUser | null;
  botUsername?: string | null;
  supportUsername?: string;
  compact?: boolean;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

export const SupportClientPanel: React.FC<SupportClientPanelProps> = ({
  telegramSessionToken = null,
  telegramUser = null,
  botUsername = null,
  supportUsername,
  compact = false,
  onNotify,
}) => {
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<SupportAgentPublic | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<InboxMessageRow[]>([]);
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const loadSupport = useCallback(async () => {
    const res = await fetchSupportInfo(telegramSessionToken);
    if (res) {
      setAgent(res.agent);
      setTicket(res.ticket);
      setMessages(res.messages);
    }
    setLoading(false);
  }, [telegramSessionToken]);

  useEffect(() => {
    void loadSupport();
    const timer = window.setInterval(() => {
      void loadSupport();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadSupport]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramSessionToken || !text.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendUserSupportMessage(
        telegramSessionToken,
        text.trim(),
        subject.trim() || undefined
      );
      if (!res.ok) {
        onNotify?.('err', res.error || "Xabar yuborilmadi.");
        return;
      }
      setText('');
      if (res.ticket) setTicket(res.ticket);
      if (res.message) setMessages((prev) => [...prev, res.message!]);
      onNotify?.('ok', 'Support xizmatiga xabaringiz yuborildi.');
    } finally {
      setSending(false);
    }
  };

  const agentUsername = (agent?.username || supportUsername || '').replace(/^@/, '');

  return (
    <section
      className={`${
        compact ? '' : 'max-w-md mx-auto'
      } bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 space-y-3.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
            <Headphones className="w-4 h-4 text-red-600" />
            <span>Support va Jonli Yordam</span>
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
            Savollaringizga biriktirilgan mutaxassis sayt va Telegram lichkangiz orqali javob beradi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSupport()}
          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 shrink-0"
          aria-label="Yangilash"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Biriktirilgan Support mutaxassisi */}
      <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-zinc-500">Mas'ul mutaxassis</div>
          <div className="text-xs font-semibold text-zinc-900 truncate mt-0.5">
            {agent ? `${agent.firstName} · ${agent.roleTitle}` : 'SlaydCanva Support Jamoasi'}
          </div>
          {ticket && (
            <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
              Murojaat holati:{' '}
              <span
                className={
                  ticket.status === 'resolved'
                    ? 'text-emerald-700 font-semibold'
                    : ticket.status === 'pending'
                      ? 'text-amber-700 font-semibold'
                      : 'text-red-600 font-semibold'
                }
              >
                {ticket.status === 'resolved'
                  ? 'Hal qilingan'
                  : ticket.status === 'pending'
                    ? 'Kutilmoqda'
                    : 'Ochiq'}
              </span>
            </div>
          )}
        </div>
        {agentUsername ? (
          <a
            href={`https://t.me/${agentUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-[#111113] hover:bg-zinc-800 text-white text-[11px] font-medium flex items-center gap-1 shrink-0"
          >
            <Send className="w-3 h-3" />
            <span>@{agentUsername}</span>
          </a>
        ) : botUsername ? (
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-lg bg-[#111113] hover:bg-zinc-800 text-white text-[11px] font-medium flex items-center gap-1 shrink-0"
          >
            <Send className="w-3 h-3" />
            <span>Botda yozish</span>
          </a>
        ) : null}
      </div>

      {/* Chat tarixi */}
      {telegramUser && telegramSessionToken ? (
        <>
          <div className="border border-zinc-200 rounded-xl bg-zinc-50/70 p-3 max-h-56 overflow-y-auto space-y-2">
            {loading && messages.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">Yuklanmoqda...</div>
            ) : messages.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                Hali yozishmalar yo‘q. Savolingizni quyida yozib qoldiring.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.senderRole === 'user';
                const d = new Date(m.createdAt);
                const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(
                  d.getMinutes()
                ).padStart(2, '0')}`;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        isUser
                          ? 'bg-[#111113] text-white rounded-br-sm'
                          : 'bg-white border border-zinc-200 text-zinc-900 rounded-bl-sm'
                      }`}
                    >
                      {!isUser && (
                        <div className="text-[10px] font-semibold text-red-600 mb-0.5">
                          {m.senderName} · Support
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.message}</div>
                      <div
                        className={`text-[9px] font-mono mt-1 ${
                          isUser ? 'text-zinc-400' : 'text-zinc-400'
                        }`}
                      >
                        {hhmm} · {m.channel === 'telegram' ? 'Telegram' : m.channel === 'both' ? 'Sayt + TG' : 'Sayt'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="space-y-2">
            {messages.length === 0 && (
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Murojaat mavzusi (masalan: To'lov yoki slayd haqida)"
                className="w-full text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2 outline-none"
              />
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Support mutaxassisiga xabar yozing..."
                className="flex-1 min-w-0 text-xs text-zinc-900 bg-zinc-50 border border-zinc-200 focus:border-red-600 focus:bg-white rounded-xl px-3 py-2.5 outline-none"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-45 text-white text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Yuborish</span>
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Supportga yozish uchun Telegram hisobingiz bilan kiring.
        </div>
      )}
    </section>
  );
};

interface FilesAndOpsViewProps {
  telegramSessionToken?: string | null;
  telegramUser?: TelegramUser | null;
  botUsername?: string | null;
  savedProjects: ProjectSummary[];
  activeProjectId?: string;
  transactions: BalanceTransaction[];
  syncingProject?: boolean;
  onSaveProjectNow?: () => void;
  onLoadCloudProject?: (id: string) => void;
  onDeleteCloudProject?: (id: string) => void;
  onSendCurrentToTelegram?: () => void;
  onOpenEditor: (mode: WorkspaceMode) => void;
  onOpenTab: (tab: MobileTab) => void;
}

export const FilesAndOpsView: React.FC<FilesAndOpsViewProps> = ({
  telegramSessionToken = null,
  telegramUser = null,
  botUsername = null,
  savedProjects,
  activeProjectId,
  transactions,
  syncingProject = false,
  onSaveProjectNow,
  onLoadCloudProject,
  onDeleteCloudProject,
  onSendCurrentToTelegram,
  onOpenEditor,
  onOpenTab,
}) => {
  const [files, setFiles] = useState<UserFileRecord[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const refreshFiles = useCallback(async () => {
    if (!telegramSessionToken) return;
    setLoadingFiles(true);
    try {
      const res = await fetchUserSavedFiles(telegramSessionToken);
      if (res?.files) {
        setFiles(res.files);
      }
    } finally {
      setLoadingFiles(false);
    }
  }, [telegramSessionToken]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#F4F4F6] px-4 py-5 space-y-5">
      {/* Telegram Storage Banner */}
      <section className="max-w-md mx-auto bg-[#111113] text-white border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Send className="w-4 h-4 text-sky-400" />
              <span>Telegramda saqlangan fayllar</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
              Tayyorlangan PPTX, PDF, Word va PNG fayllar avtomatik ravishda Telegram bot chatiga yuboriladi va shu yerda qayd etiladi.
            </p>
          </div>
          {botUsername && (
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white flex items-center gap-1 shrink-0"
            >
              <span>Bot</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onSendCurrentToTelegram && (
            <button
              type="button"
              onClick={onSendCurrentToTelegram}
              className="py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Joriy faylni TG ga</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenEditor('pptx')}
            className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>Muharrirni ochish</span>
          </button>
        </div>
      </section>

      {/* Telegram-exported files list */}
      <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-zinc-900">
              Eksport qilingan fayllar ({files.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void refreshFiles()}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900"
            aria-label="Yangilash"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="divide-y divide-zinc-100">
          {!telegramUser ? (
            <div className="p-5 text-center text-xs text-zinc-500">
              Fayllar tarixi uchun Telegram orqali kiring.
            </div>
          ) : files.length === 0 ? (
            <div className="p-5 text-center text-xs text-zinc-500">
              Hali Telegramga yuborilgan fayllar yo‘q. AI xizmat yoki muharrirdan yuklab oling — shu yerda va Telegramda saqlanadi.
            </div>
          ) : (
            files.map((f) => (
              <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 truncate">{f.fileName}</div>
                  <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-1.5 mt-0.5">
                    <span className="uppercase font-semibold text-red-600">{f.format}</span>
                    <span>·</span>
                    <span>{formatFileSize(f.sizeBytes)}</span>
                    <span>·</span>
                    <span>{new Date(f.createdAt).toLocaleDateString('uz-UZ')}</span>
                  </div>
                </div>
                {botUsername ? (
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-medium shrink-0 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>TG Chat</span>
                  </a>
                ) : (
                  <span className="text-[11px] text-emerald-700 font-medium shrink-0">
                    Saqlangan
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Bulutli Loyihalar */}
      {telegramUser && (
        <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Bulutli loyihalar ({savedProjects.length})
            </h2>
            {onSaveProjectNow && (
              <button
                type="button"
                disabled={syncingProject}
                onClick={onSaveProjectNow}
                className="px-2.5 py-1.5 rounded-lg bg-[#111113] text-white text-[11px] font-medium flex items-center gap-1 disabled:opacity-50"
              >
                {syncingProject ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                <span>Saqlash</span>
              </button>
            )}
          </div>
          <div className="divide-y divide-zinc-100">
            {savedProjects.length === 0 ? (
              <div className="p-5 text-center text-xs text-zinc-500">Saqlangan loyihalar yo‘q.</div>
            ) : (
              savedProjects.map((proj) => (
                <div
                  key={proj.id}
                  className={`px-4 py-3 flex items-center justify-between gap-2 ${
                    proj.id === activeProjectId ? 'bg-red-50/40' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onLoadCloudProject?.(proj.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-xs font-semibold text-zinc-900 truncate">
                      {proj.title}
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      {proj.mode.toUpperCase()} · {proj.pptxCount} slayd · {proj.pdfCount} PDF
                    </div>
                  </button>
                  {onDeleteCloudProject && (
                    <button
                      type="button"
                      onClick={() => onDeleteCloudProject(proj.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600"
                      aria-label="Loyihani o'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Oxirgi Amaliyotlar */}
      <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">So‘nggi amaliyotlar</h2>
          <button
            type="button"
            onClick={() => onOpenTab('balance')}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Barchasi
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {transactions.length === 0 ? (
            <div className="p-5 text-center text-xs text-zinc-400">Hozircha amaliyotlar yo‘q.</div>
          ) : (
            transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-zinc-900 truncate">{tx.title}</div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    {tx.method} · {tx.date}
                  </div>
                </div>
                <span
                  className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${
                    tx.amount < 0 ? 'text-zinc-700' : 'text-emerald-700'
                  }`}
                >
                  {tx.amount < 0 ? `-${formatSom(Math.abs(tx.amount))}` : `+${formatSom(tx.amount)}`}
                </span>
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
  isAdmin?: boolean;
  staffRole?: StaffRole;
  pricingSettings?: AppPricingSettings;
  botUsername?: string | null;
  supportUsername?: string;
  telegramUser?: TelegramUser | null;
  telegramSessionToken?: string | null;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
  onTelegramAuthenticated?: (payload: {
    user: TelegramUser;
    sessionToken: string;
    account?: TelegramAccountResponse;
    kvConfigured?: boolean;
    isAdmin?: boolean;
    isManager?: boolean;
    isSupport?: boolean;
    staffRole?: StaffRole;
    managerPermissions?: ManagerPermission[];
  }) => void;
  onUpdateTelegramPrefs?: (prefs: { autoSendFiles?: boolean; notifyOnActivity?: boolean }) => void;
  onTelegramLogout?: () => void;
  onOpenAdminPanel?: () => void;
  onSaveProfile: (profile: UserProfile) => void;
  onOpenTab: (tab: MobileTab) => void;
  savedProjects?: ProjectSummary[];
  activeProjectId?: string;
  syncingProject?: boolean;
  onSaveProjectNow?: () => void;
  onLoadCloudProject?: (id: string) => void;
  onCreateNewCloudProject?: () => void;
  onDeleteCloudProject?: (id: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  balance,
  pptxCount,
  pdfCount,
  isAdmin = false,
  staffRole = 'user',
  pricingSettings,
  botUsername,
  supportUsername,
  telegramUser,
  telegramSessionToken,
  onNotify,
  onTelegramAuthenticated,
  onUpdateTelegramPrefs,
  onTelegramLogout,
  onOpenAdminPanel,
  onSaveProfile,
  onOpenTab,
  savedProjects = [],
  activeProjectId,
  syncingProject = false,
  onSaveProjectNow,
  onLoadCloudProject,
  onCreateNewCloudProject,
  onDeleteCloudProject,
}) => {
  const effectivePricing = pricingSettings || DEFAULT_PRICING_SETTINGS;
  const [fullName, setFullName] = useState(profile.fullName);
  const [contact, setContact] = useState(profile.contact);
  const [saved, setSaved] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [tgConfig, setTgConfig] = useState<TelegramConfigResponse | null>(null);
  const [loginNonce, setLoginNonce] = useState<string>('');
  const [waitingTelegramAuth, setWaitingTelegramAuth] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName);
    setContact(profile.contact);
  }, [profile.fullName, profile.contact]);

  useEffect(() => {
    let active = true;
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
          isAdmin?: boolean;
          isManager?: boolean;
          isSupport?: boolean;
          staffRole?: StaffRole;
          managerPermissions?: ManagerPermission[];
        };
        if (data.authenticated && data.user && data.sessionToken && active) {
          setWaitingTelegramAuth(false);
          onTelegramAuthenticated?.({
            user: data.user,
            sessionToken: data.sessionToken,
            account: data.account,
            kvConfigured: data.kvConfigured,
            isAdmin: data.isAdmin,
            isManager: data.isManager,
            isSupport: data.isSupport,
            staffRole: data.staffRole,
            managerPermissions: data.managerPermissions,
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

      {/* Mening loyihalarim (Cloud Synced Projects) */}
      {telegramUser && (
        <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-red-600" />
                <span>Saqlangan loyihalar</span>
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Slayd, PDF va Word sahifalaringiz hisobingizda saqlanadi
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onSaveProjectNow && (
                <button
                  type="button"
                  disabled={syncingProject}
                  onClick={onSaveProjectNow}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-[11px] font-medium hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                  {syncingProject ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  <span>Saqlash</span>
                </button>
              )}
              {onCreateNewCloudProject && (
                <button
                  type="button"
                  onClick={onCreateNewCloudProject}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 text-[11px] font-medium hover:bg-zinc-50 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Yangi</span>
                </button>
              )}
            </div>
          </div>

          {savedProjects.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-500 text-center">
              Joriy ishingizni saqlash uchun yuqoridagi «Saqlash» tugmasini bosing.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
              {savedProjects.map((proj) => {
                const isActive = proj.id === activeProjectId;
                return (
                  <div
                    key={proj.id}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      isActive ? 'bg-red-50/50' : 'bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadCloudProject?.(proj.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-900 truncate">
                          {proj.title}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 shrink-0">
                            Ochiq
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className="uppercase">{proj.mode}</span>
                        <span>·</span>
                        <span>{proj.pptxCount} slayd</span>
                        <span>·</span>
                        <span>{proj.pdfCount} PDF</span>
                      </div>
                    </button>

                    {onDeleteCloudProject && (
                      <button
                        type="button"
                        aria-label="Loyihani o'chirish"
                        onClick={() => onDeleteCloudProject(proj.id)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Referal havolasi (har bir yangi do'st uchun 1 000 so'm) */}
      {telegramUser && (
        <section className="max-w-md mx-auto bg-white border border-zinc-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-red-600" />
                <span>Referal dasturi</span>
              </h2>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
                Har bir taklif qilingan yangi foydalanuvchi uchun sizga{' '}
                <strong className="text-zinc-900">
                  +{formatSom(effectivePricing.referralInviterBonus)}
                </strong>
                , do&apos;stingizga{' '}
                <strong className="text-zinc-900">
                  +{formatSom(effectivePricing.welcomeBonus)}
                </strong>{' '}
                bonus beriladi.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono tabular-nums font-semibold text-zinc-800 shrink-0">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span>{telegramUser.referralCount ?? 0} ta</span>
            </div>
          </div>

          {(() => {
            const activeBot = botUsername || tgConfig?.botUsername || 'SlaydCanvaBot';
            const referralLink = `https://t.me/${activeBot}?start=ref_${telegramUser.telegramId}`;
            return (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  aria-label="Referal havolangiz"
                  className="flex-1 min-w-0 text-xs font-mono text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(referralLink).then(() => {
                      setRefCopied(true);
                      window.setTimeout(() => setRefCopied(false), 2000);
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#111113] hover:bg-zinc-800 text-white text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {refCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{refCopied ? 'Nusxalandi' : 'Nusxalash'}</span>
                </button>
              </div>
            );
          })()}
        </section>
      )}

      {/* Support va Jonli Yordam */}
      <SupportClientPanel
        telegramSessionToken={telegramSessionToken}
        telegramUser={telegramUser}
        botUsername={botUsername || tgConfig?.botUsername || null}
        supportUsername={supportUsername || tgConfig?.supportUsername}
        onNotify={onNotify}
      />

      {/* Super Admin, Menejer yoki Support xodimi uchun CRM Panelga kirish */}
      {(isAdmin || staffRole === 'super_admin' || staffRole === 'manager' || staffRole === 'support') &&
        onOpenAdminPanel && (
          <section className="max-w-md mx-auto bg-[#111113] text-white border border-zinc-800 rounded-2xl p-5 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Shield className="w-4 h-4 text-red-500" />
                <span>
                  {staffRole === 'support'
                    ? 'Support CRM Paneli'
                    : staffRole === 'manager'
                      ? 'Menejer CRM Paneli'
                      : 'Boshqaruv paneli (Admin CRM)'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {staffRole === 'support'
                  ? 'Mijozlar Inbox yozishmalari (Telegram & Sayt) va yordam tiketlari'
                  : staffRole === 'manager'
                    ? 'CRM xabarnomalar, foydalanuvchilar, buyurtmalar va promokodlar'
                    : '20+ kordinatali statistika, Support Inbox, Xavfsizlik skaneri va CRM'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shrink-0 whitespace-nowrap"
            >
              {staffRole === 'support'
                ? 'Support Panel'
                : staffRole === 'manager'
                  ? 'Menejer Panel'
                  : 'Admin Panel'}
            </button>
          </section>
        )}

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
