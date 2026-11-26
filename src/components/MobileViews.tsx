import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileType2,
  Loader2,
  Plus,
  Presentation,
  RefreshCw,
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
  UserProfile,
  WorkspaceMode,
} from '../types/editor';
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
  onTopUp: (amount: number, method: string, externalOrderId?: string) => void;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

interface PendingTolovgoOrder {
  orderId: string;
  amount: number;
  payUrl: string;
  method: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
}

const PRESET_AMOUNTS = [25000, 50000, 100000, 250000];
const PAYMENT_METHODS = ['Click', 'Payme', 'Uzum / Karta'];

export const TopUpView: React.FC<TopUpViewProps> = ({ balance, onTopUp, onNotify }) => {
  const [amountText, setAmountText] = useState('50000');
  const [method, setMethod] = useState('Click');
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingTolovgoOrder | null>(null);

  const creditedOrdersRef = useRef<Set<string>>(new Set());
  const onTopUpRef = useRef(onTopUp);
  onTopUpRef.current = onTopUp;
  const onNotifyRef = useRef(onNotify);
  onNotifyRef.current = onNotify;

  const parsedAmount = Math.max(0, Number(amountText.replace(/\D/g, '')) || 0);

  const checkOrderStatus = useCallback(async (order: PendingTolovgoOrder, silent = false) => {
    if (!order?.orderId) return;
    if (!silent) setChecking(true);
    try {
      const res = await fetch(`/api/payments/tolovgo/status/${encodeURIComponent(order.orderId)}`);
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
          onTopUpRef.current(finalAmount, `TolovGo · ${order.method}`, order.orderId);
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
        headers: { 'Content-Type': 'application/json' },
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
        status: 'pending',
      });
    } catch {
      setErrorMsg("TolovGo xizmatiga ulanib bo'lmadi. Internet aloqasini tekshiring.");
    } finally {
      setCreating(false);
    }
  };

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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>TolovGo · UZS</span>
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
                TolovGo sahifasida <strong>{pendingOrder.method}</strong> (yoki Click / Payme / Uzum)
                orqali to'lang. Tasdiqlangach balans avtomatik to'ldiriladi.
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
  onSaveProfile: (profile: UserProfile) => void;
  onOpenTab: (tab: MobileTab) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  balance,
  pptxCount,
  pdfCount,
  onSaveProfile,
  onOpenTab,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [contact, setContact] = useState(profile.contact);
  const [saved, setSaved] = useState(false);

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
            {profile.contact || "Kontakt kiritilmagan"}
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
