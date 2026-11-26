import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AiGeneratedPayload, AiServicesView } from './components/AiServicesView';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { MobileBottomNav } from './components/MobileBottomNav';
import { BalanceView, HomeView, ProfileView, TopUpView } from './components/MobileViews';
import { TopBar } from './components/TopBar';
import { WordWorkspace } from './components/WordWorkspace';
import {
  createInitialPdfPages,
  createInitialPptxPages,
  createInitialState,
  DEFAULT_PRICING_SETTINGS,
  formatSom,
  INITIAL_WORD_HTML,
  uid,
} from './data/defaults';
import {
  AiServiceId,
  AppPricingSettings,
  CanvasPage,
  CloudProjectData,
  DesktopView,
  MobileTab,
  PdfOrientation,
  ProjectSummary,
  SlaydCanvaState,
  TelegramUser,
  UserProfile,
  WorkspaceMode,
} from './types/editor';
import { exportToDocx } from './utils/exportDocx';
import {
  exportCanvasPagesToPdf,
  exportCanvasPageToPng,
  exportWordElementToPdf,
} from './utils/exportPdf';
import { exportToPptx } from './utils/exportPptx';
import {
  deleteCloudProject,
  fetchAppPricing,
  fetchCloudProjects,
  getTelegramAuthHeaders,
  loadCloudProject,
  logTelegramActivity,
  saveCloudProfile,
  sendBlobToTelegram,
  syncCloudProject,
  TelegramAccountResponse,
  TelegramWebAppWindow,
} from './utils/telegramClient';

const STORAGE_KEY = 'slaydcanva_workspace_v1';

interface HistoryStack {
  past: CanvasPage[][];
  future: CanvasPage[][];
}

function sanitizeTextValue(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if ('title' in obj || 'author' in obj || 'publisher' in obj || 'year' in obj) {
      const parts = [
        typeof obj.author === 'string' ? obj.author.trim() : '',
        typeof obj.title === 'string' ? obj.title.trim() : '',
        typeof obj.publisher === 'string' ? obj.publisher.trim() : '',
        obj.year ? String(obj.year).trim() : '',
      ].filter(Boolean);
      if (parts.length > 0) return parts.join('. ');
    }
    return Object.values(obj)
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(' — ');
  }
  return '';
}

function sanitizeLoadedPages(pages?: CanvasPage[]): CanvasPage[] | undefined {
  if (!Array.isArray(pages)) return undefined;
  return pages.map((page) => ({
    ...page,
    title: page.title ? sanitizeTextValue(page.title) : page.title,
    elements: Array.isArray(page.elements)
      ? page.elements.map((el) =>
          el.type === 'text' ? { ...el, text: sanitizeTextValue(el.text) } : el
        )
      : [],
  }));
}

function loadSavedState(): SlaydCanvaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<SlaydCanvaState>;
    const fallback = createInitialState();
    const pptxPages = sanitizeLoadedPages(parsed.pptxPages);
    const pdfPages = sanitizeLoadedPages(parsed.pdfPages);
    return {
      mode: parsed.mode || fallback.mode,
      docTitle: parsed.docTitle ?? fallback.docTitle,
      pptxPages: pptxPages?.length ? pptxPages : fallback.pptxPages,
      activePptxId: parsed.activePptxId || pptxPages?.[0]?.id || fallback.activePptxId,
      pdfPages: pdfPages?.length ? pdfPages : fallback.pdfPages,
      pdfOrientation: parsed.pdfOrientation || fallback.pdfOrientation,
      activePdfId: parsed.activePdfId || pdfPages?.[0]?.id || fallback.activePdfId,
      wordDoc: parsed.wordDoc?.html !== undefined ? parsed.wordDoc : fallback.wordDoc,
      balance: typeof parsed.balance === 'number' ? parsed.balance : fallback.balance,
      transactions: Array.isArray(parsed.transactions)
        ? parsed.transactions
        : fallback.transactions,
      profile: parsed.profile?.fullName ? parsed.profile : fallback.profile,
      tolovgoMode: parsed.tolovgoMode === 'test' ? 'test' : 'live',
    };
  } catch {
    return createInitialState();
  }
}

export default function App() {
  const [state, setState] = useState<SlaydCanvaState>(loadSavedState);
  const [pptxHistory, setPptxHistory] = useState<HistoryStack>({ past: [], future: [] });
  const [pdfHistory, setPdfHistory] = useState<HistoryStack>({ past: [], future: [] });
  const [isExporting, setIsExporting] = useState(false);
  const [desktopView, setDesktopView] = useState<DesktopView>('services');
  const [selectedAiService, setSelectedAiService] = useState<AiServiceId>('academic_wave_pptx');
  const [mobileTab, setMobileTab] = useState<MobileTab>('home');
  const [mobileServiceOpen, setMobileServiceOpen] = useState(false);
  const [desktopTopUpOpen, setDesktopTopUpOpen] = useState(false);
  const [desktopProfileOpen, setDesktopProfileOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [tgSessionToken, setTgSessionToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [pricingSettings, setPricingSettings] = useState<AppPricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [syncingProject, setSyncingProject] = useState(false);

  const wordPaperRef = useRef<HTMLDivElement | null>(null);
  const hydratedCloudUserRef = useRef<string | null>(null);
  const skipNextAutoSyncRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchAppPricing().then((res) => {
      if (!active || !res) return;
      if (res.pricing) setPricingSettings(res.pricing);
      if (res.botUsername) setBotUsername(res.botUsername);
      if (res.tolovgoMode === 'test' || res.tolovgoMode === 'live') {
        setState((prev) => ({ ...prev, tolovgoMode: res.tolovgoMode }));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist workspace to localStorage (never persist session tokens)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const showNotice = useCallback((type: 'ok' | 'err', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 3200);
  }, []);

  const applyTelegramAuth = useCallback(
    (
      payload: {
        user: TelegramUser;
        sessionToken: string;
        account?: TelegramAccountResponse;
        kvConfigured?: boolean;
        isAdmin?: boolean;
      },
      announce = true
    ) => {
      const adminFlag = Boolean(payload.isAdmin || payload.user.isAdmin);
      setIsAdmin(adminFlag);
      setTelegramUser({
        ...payload.user,
        autoSendFiles: payload.account?.autoSendFiles ?? payload.user.autoSendFiles ?? true,
        notifyOnActivity: payload.account?.notifyOnActivity ?? payload.user.notifyOnActivity ?? true,
        referralCount: payload.account?.referralCount ?? payload.user.referralCount ?? 0,
        isBanned: payload.account?.isBanned ?? payload.user.isBanned ?? false,
        isAdmin: adminFlag,
      });
      setTgSessionToken(payload.sessionToken);

      setState((prev) => {
        const displayName = [payload.user.firstName, payload.user.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        const nextProfile: UserProfile = {
          fullName:
            payload.account?.fullName && prev.profile.fullName === 'Foydalanuvchi'
              ? payload.account.fullName
              : prev.profile.fullName === 'Foydalanuvchi' && displayName
                ? displayName
                : prev.profile.fullName,
          contact:
            payload.account?.contact &&
            (!prev.profile.contact || prev.profile.contact === 'tuyginovsardor4@gmail.com')
              ? payload.account.contact
              : payload.user.username &&
                  (!prev.profile.contact || prev.profile.contact === 'tuyginovsardor4@gmail.com')
                ? `@${payload.user.username}`
                : prev.profile.contact,
        };

        let nextBalance = prev.balance;
        let nextTransactions = prev.transactions.filter((t) => t.id !== 'tx_init_1');

        if (payload.account) {
          nextBalance = payload.account.balance;
          const serverIds = new Set(payload.account.transactions.map((t) => t.id));
          const localOnly = nextTransactions.filter((t) => !serverIds.has(t.id));
          nextTransactions = [...payload.account.transactions, ...localOnly].slice(0, 60);
        }

        return {
          ...prev,
          profile: nextProfile,
          balance: nextBalance,
          transactions: nextTransactions,
        };
      });

      if (announce) {
        const label = payload.user.username ? `@${payload.user.username}` : payload.user.firstName;
        showNotice('ok', `Telegram orqali kirildi: ${label}`);
      }
    },
    [showNotice]
  );

  // Telegram WebApp / Magic Link (?tg_auth=) / Existing HttpOnly Session Auto-Auth
  useEffect(() => {
    let active = true;
    const bootTelegramAuth = async () => {
      const url = new URL(window.location.href);
      const tgAuthToken = url.searchParams.get('tg_auth');
      if (tgAuthToken) {
        url.searchParams.delete('tg_auth');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        try {
          const res = await fetch('/api/telegram/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tgAuthToken }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            user?: TelegramUser;
            sessionToken?: string;
            account?: TelegramAccountResponse;
            kvConfigured?: boolean;
            isAdmin?: boolean;
          };
          if (active && res.ok && data.user && data.sessionToken) {
            applyTelegramAuth(
              {
                user: data.user,
                sessionToken: data.sessionToken,
                account: data.account,
                kvConfigured: data.kvConfigured,
                isAdmin: data.isAdmin,
              },
              true
            );
            return;
          }
        } catch {
          // Ignore verification errors and continue
        }
      }

      const webApp = (window as TelegramWebAppWindow).Telegram?.WebApp;
      if (webApp) {
        webApp.ready?.();
        webApp.expand?.();
        if (webApp.initData) {
          try {
            const res = await fetch('/api/telegram/auth/webapp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ initData: webApp.initData }),
            });
            const data = (await res.json().catch(() => ({}))) as {
              ok?: boolean;
              user?: TelegramUser;
              sessionToken?: string;
              account?: TelegramAccountResponse;
              kvConfigured?: boolean;
              isAdmin?: boolean;
            };
            if (active && res.ok && data.user && data.sessionToken) {
              applyTelegramAuth(
                {
                  user: data.user,
                  sessionToken: data.sessionToken,
                  account: data.account,
                  kvConfigured: data.kvConfigured,
                  isAdmin: data.isAdmin,
                },
                false
              );
              return;
            }
          } catch {
            // Ignore WebApp auth fallback
          }
        }
      }

      try {
        const res = await fetch('/api/telegram/me');
        if (!res.ok || !active) return;
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          user?: TelegramUser;
          sessionToken?: string;
          account?: TelegramAccountResponse;
          kvConfigured?: boolean;
          isAdmin?: boolean;
        };
        if (active && data.user && data.sessionToken) {
          applyTelegramAuth(
            {
              user: data.user,
              sessionToken: data.sessionToken,
              account: data.account,
              kvConfigured: data.kvConfigured,
              isAdmin: data.isAdmin,
            },
            false
          );
        }
      } catch {
        // Not logged in yet
      }
    };

    void bootTelegramAuth();
    return () => {
      active = false;
    };
  }, [applyTelegramAuth]);

  const handleModeChange = (mode: WorkspaceMode) => {
    setMobileSheetOpen(false);
    setState((prev) => ({ ...prev, mode }));
  };

  const handleOpenEditorMode = (mode: WorkspaceMode) => {
    setMobileSheetOpen(false);
    setMobileServiceOpen(false);
    setDesktopView('editor');
    setState((prev) => ({ ...prev, mode }));
    setMobileTab('editor');
  };

  const handleSelectMobileTab = (tab: MobileTab) => {
    setMobileSheetOpen(false);
    setMobileServiceOpen(false);
    setMobileTab(tab);
  };

  const handleOpenAiServiceMobile = (id: AiServiceId) => {
    setSelectedAiService(id);
    setMobileServiceOpen(true);
    setMobileTab('home');
  };

  const handleTitleChange = (docTitle: string) => {
    setState((prev) => ({ ...prev, docTitle }));
  };

  const updateCanvasPages = useCallback(
    (
      kind: 'pptx' | 'pdf',
      nextPages: CanvasPage[],
      nextActiveId?: string,
      options?: { skipHistory?: boolean; historyBase?: CanvasPage[] }
    ) => {
      setState((prev) => {
        const currentPages = kind === 'pptx' ? prev.pptxPages : prev.pdfPages;
        if (!options?.skipHistory) {
          const base = options?.historyBase || currentPages;
          const setHist = kind === 'pptx' ? setPptxHistory : setPdfHistory;
          setHist((h) => ({
            past: [...h.past.slice(-29), base],
            future: [],
          }));
        }

        if (kind === 'pptx') {
          return {
            ...prev,
            pptxPages: nextPages,
            activePptxId: nextActiveId || prev.activePptxId,
          };
        }
        return {
          ...prev,
          pdfPages: nextPages,
          activePdfId: nextActiveId || prev.activePdfId,
        };
      });
    },
    []
  );

  const stateRef = useRef(state);
  stateRef.current = state;

  const handleUndo = useCallback(
    (kind: 'pptx' | 'pdf') => {
      const hist = kind === 'pptx' ? pptxHistory : pdfHistory;
      if (hist.past.length === 0) return;

      const previous = hist.past[hist.past.length - 1];
      const nextPast = hist.past.slice(0, -1);
      const current = kind === 'pptx' ? stateRef.current.pptxPages : stateRef.current.pdfPages;

      const setHist = kind === 'pptx' ? setPptxHistory : setPdfHistory;
      setHist({
        past: nextPast,
        future: [current, ...hist.future.slice(0, 29)],
      });

      setState((prev) => {
        if (kind === 'pptx') {
          const validActive = previous.some((p) => p.id === prev.activePptxId)
            ? prev.activePptxId
            : previous[0]?.id || '';
          return { ...prev, pptxPages: previous, activePptxId: validActive };
        }
        const validActive = previous.some((p) => p.id === prev.activePdfId)
          ? prev.activePdfId
          : previous[0]?.id || '';
        return { ...prev, pdfPages: previous, activePdfId: validActive };
      });
    },
    [pptxHistory, pdfHistory]
  );

  const handleRedo = useCallback(
    (kind: 'pptx' | 'pdf') => {
      const hist = kind === 'pptx' ? pptxHistory : pdfHistory;
      if (hist.future.length === 0) return;

      const next = hist.future[0];
      const nextFuture = hist.future.slice(1);
      const current = kind === 'pptx' ? stateRef.current.pptxPages : stateRef.current.pdfPages;

      const setHist = kind === 'pptx' ? setPptxHistory : setPdfHistory;
      setHist({
        past: [...hist.past.slice(-29), current],
        future: nextFuture,
      });

      setState((prev) => {
        if (kind === 'pptx') {
          const validActive = next.some((p) => p.id === prev.activePptxId)
            ? prev.activePptxId
            : next[0]?.id || '';
          return { ...prev, pptxPages: next, activePptxId: validActive };
        }
        const validActive = next.some((p) => p.id === prev.activePdfId)
          ? prev.activePdfId
          : next[0]?.id || '';
        return { ...prev, pdfPages: next, activePdfId: validActive };
      });
    },
    [pptxHistory, pdfHistory]
  );

  const deliverExportToTelegram = useCallback(
    async (blob: Blob, fileName: string, baseMessage: string) => {
      if (!tgSessionToken || telegramUser?.autoSendFiles === false) {
        showNotice('ok', baseMessage);
        return;
      }
      const res = await sendBlobToTelegram(
        blob,
        fileName,
        tgSessionToken,
        `📄 ${fileName} — SlaydCanva`
      );
      if (res.ok && !res.skipped) {
        showNotice('ok', `${baseMessage} Telegramga ham yuborildi.`);
      } else if (res.tooLarge) {
        showNotice('ok', `${baseMessage} (3.2 MB dan katta — Telegramga yuborilmadi).`);
      } else {
        showNotice('ok', baseMessage);
      }
    },
    [tgSessionToken, telegramUser, showNotice]
  );

  const handleExportPrimary = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (state.mode === 'pptx') {
        const res = await exportToPptx(state.pptxPages, state.docTitle);
        await deliverExportToTelegram(res.blob, res.fileName, 'PPTX fayli yuklab olindi.');
      } else if (state.mode === 'word') {
        const res = await exportToDocx(state.wordDoc, state.docTitle);
        await deliverExportToTelegram(res.blob, res.fileName, 'Word (.docx) fayli yuklab olindi.');
      } else {
        const res = await exportCanvasPagesToPdf(
          state.pdfPages,
          state.docTitle,
          'pdf',
          state.pdfOrientation
        );
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli yuklab olindi.');
      }
    } catch {
      showNotice('err', "Eksport qilishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSecondaryPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (state.mode === 'pptx') {
        const res = await exportCanvasPagesToPdf(state.pptxPages, state.docTitle, 'pptx');
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli yuklab olindi.');
      } else if (state.mode === 'word' && wordPaperRef.current) {
        const res = await exportWordElementToPdf(wordPaperRef.current, state.docTitle);
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli yuklab olindi.');
      } else {
        showNotice('ok', 'PDF fayli yuklab olindi.');
      }
    } catch {
      showNotice('err', 'PDF yaratishda xatolik yuz berdi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPng = async () => {
    if (isExporting || state.mode === 'word') return;
    setIsExporting(true);
    try {
      if (state.mode === 'pptx') {
        const active =
          state.pptxPages.find((p) => p.id === state.activePptxId) || state.pptxPages[0];
        if (active) {
          const res = await exportCanvasPageToPng(active, state.docTitle, 'pptx');
          await deliverExportToTelegram(res.blob, res.fileName, 'PNG rasm yuklab olindi.');
        }
      } else {
        const active =
          state.pdfPages.find((p) => p.id === state.activePdfId) || state.pdfPages[0];
        if (active) {
          const res = await exportCanvasPageToPng(active, state.docTitle, 'pdf', state.pdfOrientation);
          await deliverExportToTelegram(res.blob, res.fileName, 'PNG rasm yuklab olindi.');
        }
      }
    } catch {
      showNotice('err', 'PNG rasm yaratishda xatolik yuz berdi.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetCurrent = () => {
    if (state.mode === 'pptx') {
      const fresh = createInitialPptxPages();
      setPptxHistory({ past: [], future: [] });
      setState((prev) => ({
        ...prev,
        pptxPages: fresh,
        activePptxId: fresh[0].id,
      }));
      showNotice('ok', "Slayd muhiti boshlang'ich holatga qaytarildi.");
    } else if (state.mode === 'pdf') {
      const fresh = createInitialPdfPages();
      setPdfHistory({ past: [], future: [] });
      setState((prev) => ({
        ...prev,
        pdfPages: fresh,
        activePdfId: fresh[0].id,
      }));
      showNotice('ok', "PDF muhiti boshlang'ich holatga qaytarildi.");
    } else {
      setState((prev) => ({
        ...prev,
        wordDoc: {
          ...prev.wordDoc,
          html: INITIAL_WORD_HTML,
        },
      }));
      showNotice('ok', "Word hujjati boshlang'ich holatga qaytarildi.");
    }
  };

  const handleTopUp = (amount: number, method: string, externalOrderId?: string) => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    const txId = externalOrderId ? `tolovgo_${externalOrderId}` : uid('tx');
    let credited = false;

    setState((prev) => {
      if (externalOrderId && prev.transactions.some((t) => t.id === txId)) {
        return prev;
      }
      credited = true;
      return {
        ...prev,
        balance: prev.balance + amount,
        transactions: [
          {
            id: txId,
            title: externalOrderId ? `Balans to'ldirish (#${externalOrderId})` : "Balans to'ldirish",
            method,
            amount,
            date: dateStr,
          },
          ...prev.transactions,
        ],
      };
    });

    if (credited) {
      showNotice('ok', `${formatSom(amount)} qo'shildi.`);
    }
    setDesktopTopUpOpen(false);
    if (mobileTab === 'topup') {
      setMobileTab('balance');
    }
  };

  const handleSaveProfile = (profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
    if (tgSessionToken) {
      void saveCloudProfile(profile, tgSessionToken);
    }
    showNotice('ok', "Profil ma'lumotlari saqlandi.");
  };

  const handleUpdateTelegramPrefs = async (prefs: {
    autoSendFiles?: boolean;
    notifyOnActivity?: boolean;
  }) => {
    if (!tgSessionToken) return;
    setTelegramUser((prev) => (prev ? { ...prev, ...prefs } : prev));
    try {
      await fetch('/api/telegram/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTelegramAuthHeaders(tgSessionToken),
        },
        body: JSON.stringify(prefs),
      });
    } catch {
      // Ignore network hiccup
    }
  };

  const handleTelegramLogout = async () => {
    try {
      await fetch('/api/telegram/logout', {
        method: 'POST',
        headers: getTelegramAuthHeaders(tgSessionToken),
      });
    } catch {
      // Ignore
    }
    hydratedCloudUserRef.current = null;
    setSavedProjects([]);
    setActiveProjectId('');
    setIsAdmin(false);
    setAdminOpen(false);
    setAdminToken(null);
    setTelegramUser(null);
    setTgSessionToken(null);
    setState((prev) => ({
      ...prev,
      balance: 0,
      transactions: [],
    }));
    showNotice('ok', 'Telegram hisobidan chiqildi.');
  };

  const applyCloudProjectToWorkspace = useCallback((project: CloudProjectData) => {
    skipNextAutoSyncRef.current = true;
    const fallback = createInitialState();
    const pptxPages = sanitizeLoadedPages(project.pptxPages);
    const pdfPages = sanitizeLoadedPages(project.pdfPages);
    const nextPptx = pptxPages?.length ? pptxPages : fallback.pptxPages;
    const nextPdf = pdfPages?.length ? pdfPages : fallback.pdfPages;
    const nextWord =
      project.wordDoc && typeof project.wordDoc.html === 'string'
        ? project.wordDoc
        : fallback.wordDoc;

    setPptxHistory({ past: [], future: [] });
    setPdfHistory({ past: [], future: [] });
    setActiveProjectId(project.id);
    setState((prev) => ({
      ...prev,
      docTitle: project.title || prev.docTitle,
      mode: project.mode || prev.mode,
      pptxPages: nextPptx,
      activePptxId: nextPptx[0]?.id || prev.activePptxId,
      pdfPages: nextPdf,
      activePdfId: nextPdf[0]?.id || prev.activePdfId,
      pdfOrientation: project.pdfOrientation || prev.pdfOrientation,
      wordDoc: nextWord,
      tolovgoMode: project.tolovgoMode || prev.tolovgoMode,
    }));
  }, []);

  const syncCurrentProjectNow = useCallback(
    async (explicitId?: string, silent = true) => {
      if (!tgSessionToken || !telegramUser) return;
      const s = stateRef.current;
      const targetId = explicitId || activeProjectId || `proj_${telegramUser.telegramId}_main`;
      setSyncingProject(true);
      try {
        const res = await syncCloudProject(
          {
            id: targetId,
            title: s.docTitle || 'Yangi loyiha',
            mode: s.mode,
            pptxPages: s.pptxPages,
            pdfPages: s.pdfPages,
            pdfOrientation: s.pdfOrientation,
            wordDoc: s.wordDoc,
            tolovgoMode: s.tolovgoMode || 'live',
          },
          tgSessionToken
        );
        if (res.ok && res.project) {
          setActiveProjectId(res.project.id);
          setSavedProjects((prev) => [
            res.project!,
            ...prev.filter((p) => p.id !== res.project!.id),
          ]);
          if (!silent) {
            showNotice('ok', 'Loyiha bazaga saqlandi.');
          }
        } else if (!silent) {
          showNotice(
            'err',
            res.tooLarge
              ? 'Loyiha hajmi 3.8 MB dan katta.'
              : "Loyihani saqlashda xatolik yuz berdi."
          );
        }
      } finally {
        setSyncingProject(false);
      }
    },
    [tgSessionToken, telegramUser, activeProjectId, showNotice]
  );

  // Hydrate projects from Neon PostgreSQL once per authenticated Telegram user
  useEffect(() => {
    if (!tgSessionToken || !telegramUser) return;
    if (hydratedCloudUserRef.current === telegramUser.telegramId) return;
    hydratedCloudUserRef.current = telegramUser.telegramId;

    let active = true;
    const hydrate = async () => {
      const data = await fetchCloudProjects(tgSessionToken);
      if (!active || !data) return;

      setSavedProjects(data.projects);
      const curr = stateRef.current;
      const isDefaultWorkspace =
        curr.docTitle === 'Yangi loyiha' &&
        curr.pptxPages.length <= 2 &&
        curr.pdfPages.length <= 1 &&
        curr.wordDoc.html === INITIAL_WORD_HTML;

      if (data.activeProject) {
        if (isDefaultWorkspace) {
          applyCloudProjectToWorkspace(data.activeProject);
        } else {
          setActiveProjectId(data.activeProject.id);
        }
      } else {
        const initialId = `proj_${telegramUser.telegramId}_main`;
        setActiveProjectId(initialId);
        void syncCurrentProjectNow(initialId, true);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, [tgSessionToken, telegramUser, applyCloudProjectToWorkspace, syncCurrentProjectNow]);

  // Debounced background sync of active project to Neon PostgreSQL
  useEffect(() => {
    if (!tgSessionToken || !telegramUser) return;
    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void syncCurrentProjectNow(undefined, true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    tgSessionToken,
    telegramUser,
    state.docTitle,
    state.mode,
    state.pptxPages,
    state.pdfPages,
    state.pdfOrientation,
    state.wordDoc,
    state.tolovgoMode,
    syncCurrentProjectNow,
  ]);

  const handleLoadCloudProject = async (projectId: string) => {
    if (!tgSessionToken) return;
    setSyncingProject(true);
    try {
      const proj = await loadCloudProject(projectId, tgSessionToken);
      if (proj) {
        applyCloudProjectToWorkspace(proj);
        setDesktopProfileOpen(false);
        setDesktopView('editor');
        setMobileTab('editor');
        showNotice('ok', `"${proj.title}" loyihasi ochildi.`);
      } else {
        showNotice('err', 'Loyihani yuklab bo‘lmadi.');
      }
    } finally {
      setSyncingProject(false);
    }
  };

  const handleCreateNewCloudProject = () => {
    if (!telegramUser) return;
    skipNextAutoSyncRef.current = true;
    const fresh = createInitialState();
    const nextId = `proj_${telegramUser.telegramId}_${Date.now().toString(36)}`;
    setPptxHistory({ past: [], future: [] });
    setPdfHistory({ past: [], future: [] });
    setActiveProjectId(nextId);
    setState((prev) => ({
      ...fresh,
      balance: prev.balance,
      transactions: prev.transactions,
      profile: prev.profile,
      tolovgoMode: prev.tolovgoMode,
    }));
    setDesktopProfileOpen(false);
    setDesktopView('editor');
    setMobileTab('editor');
    showNotice('ok', 'Yangi loyiha yaratildi.');
    window.setTimeout(() => {
      void syncCurrentProjectNow(nextId, true);
    }, 100);
  };

  const handleDeleteCloudProject = async (projectId: string) => {
    if (!tgSessionToken || !telegramUser) return;
    const ok = await deleteCloudProject(projectId, tgSessionToken);
    if (!ok) {
      showNotice('err', "Loyihani o'chirishda xatolik yuz berdi.");
      return;
    }
    setSavedProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(`proj_${telegramUser.telegramId}_${Date.now().toString(36)}`);
    }
    showNotice('ok', "Loyiha o'chirildi.");
  };

  const handleAiGenerated = (result: AiGeneratedPayload) => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;

    if (result.targetMode === 'pptx') {
      setPptxHistory((h) => ({
        past: [...h.past.slice(-29), stateRef.current.pptxPages],
        future: [],
      }));
    } else if (result.targetMode === 'pdf') {
      setPdfHistory((h) => ({
        past: [...h.past.slice(-29), stateRef.current.pdfPages],
        future: [],
      }));
    }

    setState((prev) => ({
      ...prev,
      mode: result.targetMode,
      docTitle: result.docTitle,
      pptxPages: result.targetMode === 'pptx' ? result.pages : prev.pptxPages,
      activePptxId:
        result.targetMode === 'pptx' ? result.pages[0]?.id || prev.activePptxId : prev.activePptxId,
      pdfPages: result.targetMode === 'pdf' ? result.pages : prev.pdfPages,
      activePdfId:
        result.targetMode === 'pdf' ? result.pages[0]?.id || prev.activePdfId : prev.activePdfId,
      pdfOrientation: result.pdfOrientation || prev.pdfOrientation,
      balance:
        result.serverCharged && typeof result.newBalance === 'number'
          ? result.newBalance
          : Math.max(0, prev.balance - result.price),
      transactions: [
        {
          id: uid('tx'),
          title: result.serviceTitle,
          method: 'AI Xizmat',
          amount: -result.price,
          date: dateStr,
        },
        ...prev.transactions,
      ],
    }));

    setDesktopView('editor');
    setMobileServiceOpen(false);
    setMobileTab('editor');
    showNotice('ok', `${result.serviceTitle} tayyorlandi.`);

    if (tgSessionToken) {
      const tokenSnapshot = tgSessionToken;
      const shouldSendFile = telegramUser?.autoSendFiles !== false;
      void (async () => {
        await logTelegramActivity(
          `${result.serviceTitle}: ${result.docTitle}`,
          'AI Xizmat',
          result.serverCharged ? 0 : -result.price,
          tokenSnapshot
        );
        if (!shouldSendFile) return;
        try {
          if (result.targetMode === 'pptx') {
            const exported = await exportToPptx(result.pages, result.docTitle, {
              download: false,
            });
            await sendBlobToTelegram(
              exported.blob,
              exported.fileName,
              tokenSnapshot,
              `✨ ${result.serviceTitle}: ${result.docTitle}`
            );
          } else if (result.targetMode === 'pdf') {
            const exported = await exportCanvasPagesToPdf(
              result.pages,
              result.docTitle,
              'pdf',
              result.pdfOrientation || stateRef.current.pdfOrientation,
              { download: false }
            );
            await sendBlobToTelegram(
              exported.blob,
              exported.fileName,
              tokenSnapshot,
              `✨ ${result.serviceTitle}: ${result.docTitle}`
            );
          }
        } catch {
          // Non-blocking Telegram background export
        }
      })();
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F4F6]">
      <TopBar
        mode={state.mode}
        desktopView={desktopView}
        onDesktopViewChange={setDesktopView}
        onModeChange={handleModeChange}
        mobileTab={mobileTab}
        mobileServiceOpen={mobileServiceOpen}
        balance={state.balance}
        docTitle={state.docTitle}
        onTitleChange={handleTitleChange}
        onExportPrimary={handleExportPrimary}
        onExportSecondaryPdf={handleExportSecondaryPdf}
        onExportPng={handleExportPng}
        onResetCurrent={handleResetCurrent}
        onOpenTopUp={() => setDesktopTopUpOpen(true)}
        onOpenProfile={() => setDesktopProfileOpen(true)}
        isAdmin={isAdmin}
        onOpenAdminPanel={() => setAdminOpen(true)}
        telegramUser={telegramUser}
        isExporting={isExporting}
      />

      {/* Mobile Secondary Views (Bosh sahifa, AI Xizmatlar, Balans to'ldirish, Balans, Profil) */}
      {mobileTab !== 'editor' && (
        <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden">
          {mobileTab === 'home' && !mobileServiceOpen && (
            <HomeView
              docTitle={state.docTitle}
              pptxCount={state.pptxPages.length}
              pdfCount={state.pdfPages.length}
              balance={state.balance}
              pricingSettings={pricingSettings}
              onOpenEditor={handleOpenEditorMode}
              onOpenAiService={handleOpenAiServiceMobile}
              onOpenTab={handleSelectMobileTab}
            />
          )}
          {mobileTab === 'home' && mobileServiceOpen && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center">
                <button
                  type="button"
                  onClick={() => setMobileServiceOpen(false)}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Bosh sahifaga qaytish</span>
                </button>
              </div>
              <AiServicesView
                selectedService={selectedAiService}
                onSelectService={setSelectedAiService}
                balance={state.balance}
                profile={state.profile}
                pricingSettings={pricingSettings}
                telegramSessionToken={tgSessionToken}
                onRequestTopUp={() => {
                  setMobileServiceOpen(false);
                  setMobileTab('topup');
                }}
                onGenerated={handleAiGenerated}
              />
            </div>
          )}
          {mobileTab === 'topup' && (
            <TopUpView
              balance={state.balance}
              tolovgoMode={state.tolovgoMode || 'live'}
              telegramSessionToken={tgSessionToken}
              onTopUp={handleTopUp}
              onNotify={showNotice}
            />
          )}
          {mobileTab === 'balance' && (
            <BalanceView
              balance={state.balance}
              transactions={state.transactions}
              onGoTopUp={() => handleSelectMobileTab('topup')}
            />
          )}
          {mobileTab === 'profile' && (
            <ProfileView
              profile={state.profile}
              balance={state.balance}
              pptxCount={state.pptxPages.length}
              pdfCount={state.pdfPages.length}
              isAdmin={isAdmin}
              pricingSettings={pricingSettings}
              botUsername={botUsername}
              telegramUser={telegramUser}
              telegramSessionToken={tgSessionToken}
              onTelegramAuthenticated={(p) => applyTelegramAuth(p, true)}
              onUpdateTelegramPrefs={handleUpdateTelegramPrefs}
              onTelegramLogout={handleTelegramLogout}
              onOpenAdminPanel={() => setAdminOpen(true)}
              onSaveProfile={handleSaveProfile}
              onOpenTab={handleSelectMobileTab}
              savedProjects={savedProjects}
              activeProjectId={activeProjectId}
              syncingProject={syncingProject}
              onSaveProjectNow={() => void syncCurrentProjectNow(undefined, false)}
              onLoadCloudProject={(id) => void handleLoadCloudProject(id)}
              onCreateNewCloudProject={handleCreateNewCloudProject}
              onDeleteCloudProject={(id) => void handleDeleteCloudProject(id)}
            />
          )}
        </div>
      )}

      {/* Desktop AI Services View */}
      {desktopView === 'services' && (
        <div className="hidden md:flex flex-1 flex-col min-h-0 overflow-hidden">
          <AiServicesView
            selectedService={selectedAiService}
            onSelectService={setSelectedAiService}
            balance={state.balance}
            profile={state.profile}
            pricingSettings={pricingSettings}
            telegramSessionToken={tgSessionToken}
            onRequestTopUp={() => setDesktopTopUpOpen(true)}
            onGenerated={handleAiGenerated}
          />
        </div>
      )}

      {/* Editor Workspace (Visible on desktop when desktopView === 'editor', visible on mobile when mobileTab === 'editor') */}
      <div
        className={
          mobileTab === 'editor'
            ? desktopView === 'editor'
              ? 'flex-1 flex flex-col min-h-0 overflow-hidden'
              : 'flex md:hidden flex-1 flex-col min-h-0 overflow-hidden'
            : desktopView === 'editor'
              ? 'hidden md:flex flex-1 flex-col min-h-0 overflow-hidden'
              : 'hidden'
        }
      >
        {state.mode === 'pptx' && (
          <CanvasWorkspace
            kind="pptx"
            onModeChange={handleModeChange}
            pages={state.pptxPages}
            activePageId={state.activePptxId}
            onSelectPage={(id) => setState((prev) => ({ ...prev, activePptxId: id }))}
            onUpdatePages={(nextPages, nextActiveId, options) =>
              updateCanvasPages('pptx', nextPages, nextActiveId, options)
            }
            canUndo={pptxHistory.past.length > 0}
            canRedo={pptxHistory.future.length > 0}
            onUndo={() => handleUndo('pptx')}
            onRedo={() => handleRedo('pptx')}
            mobileSheetOpen={mobileSheetOpen}
            onOpenMobileSheet={() => setMobileSheetOpen(true)}
            onCloseMobileSheet={() => setMobileSheetOpen(false)}
          />
        )}

        {state.mode === 'pdf' && (
          <CanvasWorkspace
            kind="pdf"
            onModeChange={handleModeChange}
            pages={state.pdfPages}
            activePageId={state.activePdfId}
            orientation={state.pdfOrientation}
            onOrientationChange={(pdfOrientation: PdfOrientation) =>
              setState((prev) => ({ ...prev, pdfOrientation }))
            }
            onSelectPage={(id) => setState((prev) => ({ ...prev, activePdfId: id }))}
            onUpdatePages={(nextPages, nextActiveId, options) =>
              updateCanvasPages('pdf', nextPages, nextActiveId, options)
            }
            canUndo={pdfHistory.past.length > 0}
            canRedo={pdfHistory.future.length > 0}
            onUndo={() => handleUndo('pdf')}
            onRedo={() => handleRedo('pdf')}
            mobileSheetOpen={mobileSheetOpen}
            onOpenMobileSheet={() => setMobileSheetOpen(true)}
            onCloseMobileSheet={() => setMobileSheetOpen(false)}
          />
        )}

        {state.mode === 'word' && (
          <WordWorkspace
            doc={state.wordDoc}
            onChange={(wordDoc) => setState((prev) => ({ ...prev, wordDoc }))}
            paperRef={wordPaperRef}
            onModeChange={handleModeChange}
            mobileSheetOpen={mobileSheetOpen}
            onOpenMobileSheet={() => setMobileSheetOpen(true)}
            onCloseMobileSheet={() => setMobileSheetOpen(false)}
          />
        )}
      </div>

      <MobileBottomNav activeTab={mobileTab} onSelectTab={handleSelectMobileTab} />

      {/* Desktop Quick Top-Up Modal */}
      {desktopTopUpOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] items-center justify-center p-4"
          onClick={() => setDesktopTopUpOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">Balansni to'ldirish</span>
              <button
                type="button"
                onClick={() => setDesktopTopUpOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <TopUpView
              balance={state.balance}
              tolovgoMode={state.tolovgoMode || 'live'}
              telegramSessionToken={tgSessionToken}
              onTopUp={handleTopUp}
              onNotify={showNotice}
            />
          </div>
        </div>
      )}

      {/* Desktop Quick Profile & Temporary Settings Modal */}
      {desktopProfileOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] items-center justify-center p-4"
          onClick={() => setDesktopProfileOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-slate-900">Profil, Telegram va sozlamalar</span>
              <button
                type="button"
                onClick={() => setDesktopProfileOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ProfileView
              profile={state.profile}
              balance={state.balance}
              pptxCount={state.pptxPages.length}
              pdfCount={state.pdfPages.length}
              isAdmin={isAdmin}
              pricingSettings={pricingSettings}
              botUsername={botUsername}
              telegramUser={telegramUser}
              telegramSessionToken={tgSessionToken}
              onTelegramAuthenticated={(p) => applyTelegramAuth(p, true)}
              onUpdateTelegramPrefs={handleUpdateTelegramPrefs}
              onTelegramLogout={handleTelegramLogout}
              onOpenAdminPanel={() => {
                setDesktopProfileOpen(false);
                setAdminOpen(true);
              }}
              onSaveProfile={handleSaveProfile}
              onOpenTab={() => {
                setDesktopProfileOpen(false);
                setDesktopTopUpOpen(true);
              }}
              savedProjects={savedProjects}
              activeProjectId={activeProjectId}
              syncingProject={syncingProject}
              onSaveProjectNow={() => void syncCurrentProjectNow(undefined, false)}
              onLoadCloudProject={(id) => void handleLoadCloudProject(id)}
              onCreateNewCloudProject={handleCreateNewCloudProject}
              onDeleteCloudProject={(id) => void handleDeleteCloudProject(id)}
            />
          </div>
        </div>
      )}

      {adminOpen && isAdmin && telegramUser && tgSessionToken && (
        <AdminDashboard
          telegramUser={telegramUser}
          telegramSessionToken={tgSessionToken}
          adminToken={adminToken}
          onAdminTokenChange={setAdminToken}
          onPricingUpdated={(nextPricing) => setPricingSettings(nextPricing)}
          onTolovgoModeUpdated={(nextMode) =>
            setState((prev) => ({ ...prev, tolovgoMode: nextMode }))
          }
          onNotify={showNotice}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {notice && (
        <div
          role="status"
          className={`fixed bottom-[82px] md:bottom-4 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-lg text-xs font-medium shadow-md border z-50 transition-opacity whitespace-nowrap ${
            notice.type === 'ok'
              ? 'bg-[#111113] text-white border-zinc-800'
              : 'bg-red-600 text-white border-red-700'
          }`}
        >
          {notice.text}
        </div>
      )}
    </div>
  );
}
