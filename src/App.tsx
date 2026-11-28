import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Headphones,
  Loader2,
  Megaphone,
  Radio,
  Send,
  Shield,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AiGeneratedPayload, AiServicesView } from './components/AiServicesView';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { MobileBottomNav } from './components/MobileBottomNav';
import {
  BalanceView,
  FilesAndOpsView,
  HomeView,
  ProfileView,
  SupportClientPanel,
  TopUpView,
} from './components/MobileViews';
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
  ManagerPermission,
  MandatoryChannelPublic,
  MobileTab,
  PdfOrientation,
  ProjectSummary,
  SiteConfigSettings,
  SlaydCanvaState,
  StaffRole,
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
import { triggerSafeFileDownload } from './utils/safeDownload';
import {
  adminGetStatus,
  adminLogout,
  checkTelegramSubscriptionStatus,
  deleteCloudProject,
  fetchAppPricing,
  fetchCloudProjects,
  fetchTelegramAccountMe,
  getTelegramAuthHeaders,
  loadCloudProject,
  logTelegramActivity,
  saveAndSendUserFile,
  saveCloudProfile,
  sendProjectPptxFallbackToBot,
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
    // Security: Never trust browser localStorage for balance or transactions.
    // Balance only loads from server DB/KV via TolovGo, Promo codes, or Admin/Manager.
    return {
      mode: parsed.mode || fallback.mode,
      docTitle: parsed.docTitle ?? fallback.docTitle,
      pptxPages: pptxPages?.length ? pptxPages : fallback.pptxPages,
      activePptxId: parsed.activePptxId || pptxPages?.[0]?.id || fallback.activePptxId,
      pdfPages: pdfPages?.length ? pdfPages : fallback.pdfPages,
      pdfOrientation: parsed.pdfOrientation || fallback.pdfOrientation,
      activePdfId: parsed.activePdfId || pdfPages?.[0]?.id || fallback.activePdfId,
      wordDoc: parsed.wordDoc?.html !== undefined ? parsed.wordDoc : fallback.wordDoc,
      balance: 0,
      transactions: [],
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
  const [desktopFilesOpen, setDesktopFilesOpen] = useState(false);
  const [desktopSupportOpen, setDesktopSupportOpen] = useState(false);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [tgSessionToken, setTgSessionToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole>('user');
  const [managerPermissions, setManagerPermissions] = useState<ManagerPermission[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [pricingSettings, setPricingSettings] = useState<AppPricingSettings>(DEFAULT_PRICING_SETTINGS);
  const [siteConfig, setSiteConfig] = useState<SiteConfigSettings>({
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
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [inTelegramWebApp, setInTelegramWebApp] = useState(false);
  const [authBooting, setAuthBooting] = useState(true);
  const [showStaffGateLogin, setShowStaffGateLogin] = useState(false);
  const [staffLoginNonce, setStaffLoginNonce] = useState('');
  const [waitingStaffAuth, setWaitingStaffAuth] = useState(false);
  const [staffGateError, setStaffGateError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [savedProjects, setSavedProjects] = useState<ProjectSummary[]>([]);
  const [syncingProject, setSyncingProject] = useState(false);
  const [missingSubChannels, setMissingSubChannels] = useState<MandatoryChannelPublic[]>([]);
  const [checkingSub, setCheckingSub] = useState(false);
  const [impersonationRestore, setImpersonationRestore] = useState<{
    user: TelegramUser;
    sessionToken: string;
    adminToken: string | null;
    isAdmin: boolean;
    isManager: boolean;
    staffRole: StaffRole;
    managerPermissions: ManagerPermission[];
  } | null>(null);

  const wordPaperRef = useRef<HTMLDivElement | null>(null);
  const hydratedCloudUserRef = useRef<string | null>(null);
  const skipNextAutoSyncRef = useRef(false);

  useEffect(() => {
    let active = true;
    const webApp = (window as TelegramWebAppWindow).Telegram?.WebApp;
    setInTelegramWebApp(
      Boolean(webApp?.initData || (webApp as { initDataUnsafe?: { user?: unknown } } | undefined)?.initDataUnsafe?.user)
    );

    const bytes = new Uint8Array(9);
    window.crypto.getRandomValues(bytes);
    setStaffLoginNonce(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));

    void fetchAppPricing().then((res) => {
      if (!active || !res) return;
      if (res.pricing) setPricingSettings(res.pricing);
      if (res.botUsername) setBotUsername(res.botUsername);
      if (res.siteConfig) setSiteConfig((prev) => ({ ...prev, ...res.siteConfig }));
      if (res.tolovgoMode === 'test' || res.tolovgoMode === 'live') {
        setState((prev) => ({ ...prev, tolovgoMode: res.tolovgoMode }));
      }
    });

    void fetch('/api/telegram/config')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          cfg: {
            configured?: boolean;
            botUsername?: string | null;
            telegramOnlyMode?: boolean;
            supportUsername?: string;
          } | null
        ) => {
          if (!active || !cfg) return;
          setTelegramConfigured(Boolean(cfg.configured));
          if (cfg.botUsername) setBotUsername(cfg.botUsername);
          setSiteConfig((prev) => ({
            ...prev,
            telegramOnlyMode:
              typeof cfg.telegramOnlyMode === 'boolean'
                ? cfg.telegramOnlyMode
                : prev.telegramOnlyMode,
            supportUsername:
              typeof cfg.supportUsername === 'string'
                ? cfg.supportUsername
                : prev.supportUsername,
          }));
        }
      )
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Persist workspace ONLY to localStorage (never persist session tokens, balance, or transactions)
  useEffect(() => {
    try {
      const { balance: _b, transactions: _t, ...workspaceOnly } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceOnly));
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
        missingChannels?: MandatoryChannelPublic[];
        kvConfigured?: boolean;
        isAdmin?: boolean;
        isManager?: boolean;
        isSupport?: boolean;
        staffRole?: StaffRole;
        managerPermissions?: ManagerPermission[];
      },
      announce = true
    ) => {
      const adminFlag = Boolean(payload.isAdmin || payload.user.isAdmin || payload.staffRole === 'super_admin');
      const managerFlag = Boolean(!adminFlag && (payload.isManager || payload.staffRole === 'manager'));
      const supportFlag = Boolean(
        !adminFlag && !managerFlag && (payload.isSupport || payload.staffRole === 'support')
      );
      const resolvedRole: StaffRole = adminFlag
        ? 'super_admin'
        : managerFlag
          ? 'manager'
          : supportFlag
            ? 'support'
            : 'user';

      setIsAdmin(adminFlag);
      setIsManager(managerFlag);
      setStaffRole(resolvedRole);
      setManagerPermissions(
        Array.isArray(payload.managerPermissions) ? payload.managerPermissions : []
      );
      setWaitingStaffAuth(false);
      setStaffGateError(null);

      setTelegramUser({
        ...payload.user,
        autoSendFiles: payload.account?.autoSendFiles ?? payload.user.autoSendFiles ?? true,
        notifyOnActivity: payload.account?.notifyOnActivity ?? payload.user.notifyOnActivity ?? true,
        referralCount: payload.account?.referralCount ?? payload.user.referralCount ?? 0,
        isBanned: payload.account?.isBanned ?? payload.user.isBanned ?? false,
        isAdmin: adminFlag,
        isManager: managerFlag,
        isSupport: supportFlag,
        staffRole: resolvedRole,
        managerPermissions: payload.managerPermissions,
      });
      setTgSessionToken(payload.sessionToken);

      // Restore 15-day Admin/Manager/Support session cookie if already unlocked
      if (adminFlag || managerFlag || supportFlag) {
        setMissingSubChannels([]);
        void adminGetStatus(payload.sessionToken).then((st) => {
          if (!('error' in st) && st.adminUnlocked && st.adminToken) {
            setAdminToken(st.adminToken);
          }
        });
      } else if (Array.isArray(payload.missingChannels)) {
        setMissingSubChannels(payload.missingChannels);
      } else {
        void checkTelegramSubscriptionStatus(payload.sessionToken).then((subRes) => {
          if (subRes.ok) {
            setMissingSubChannels(subRes.subscribed ? [] : subRes.missingChannels);
          }
        });
      }

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

        const nextBalance = payload.account ? payload.account.balance : 0;
        const nextTransactions = payload.account ? payload.account.transactions.slice(0, 60) : [];

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

  // Telegram WebApp / Magic Link (?tg_auth=) / Existing 15-Day HttpOnly Session Cookie Auto-Auth
  useEffect(() => {
    let active = true;
    const bootTelegramAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const tgAuthToken = url.searchParams.get('tg_auth');
        if (tgAuthToken) {
          url.searchParams.delete('tg_auth');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          try {
            const res = await fetch('/api/telegram/auth/verify', {
              method: 'POST',
              credentials: 'same-origin',
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
              isManager?: boolean;
              isSupport?: boolean;
              staffRole?: StaffRole;
              managerPermissions?: ManagerPermission[];
            };
            if (active && res.ok && data.user && data.sessionToken) {
              applyTelegramAuth(
                {
                  user: data.user,
                  sessionToken: data.sessionToken,
                  account: data.account,
                  kvConfigured: data.kvConfigured,
                  isAdmin: data.isAdmin,
                  isManager: data.isManager,
                  isSupport: data.isSupport,
                  staffRole: data.staffRole,
                  managerPermissions: data.managerPermissions,
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
            setInTelegramWebApp(true);
            try {
              const res = await fetch('/api/telegram/auth/webapp', {
                method: 'POST',
                credentials: 'same-origin',
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
                isManager?: boolean;
                isSupport?: boolean;
                staffRole?: StaffRole;
                managerPermissions?: ManagerPermission[];
              };
              if (active && res.ok && data.user && data.sessionToken) {
                applyTelegramAuth(
                  {
                    user: data.user,
                    sessionToken: data.sessionToken,
                    account: data.account,
                    kvConfigured: data.kvConfigured,
                    isAdmin: data.isAdmin,
                    isManager: data.isManager,
                    isSupport: data.isSupport,
                    staffRole: data.staffRole,
                    managerPermissions: data.managerPermissions,
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
          const res = await fetch('/api/telegram/me', { credentials: 'same-origin' });
          if (!res.ok || !active) return;
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            user?: TelegramUser;
            sessionToken?: string;
            account?: TelegramAccountResponse;
            missingChannels?: MandatoryChannelPublic[];
            kvConfigured?: boolean;
            isAdmin?: boolean;
            isManager?: boolean;
            isSupport?: boolean;
            staffRole?: StaffRole;
            managerPermissions?: ManagerPermission[];
          };
          if (active && data.user && data.sessionToken) {
            applyTelegramAuth(
              {
                user: data.user,
                sessionToken: data.sessionToken,
                account: data.account,
                missingChannels: data.missingChannels,
                kvConfigured: data.kvConfigured,
                isAdmin: data.isAdmin,
                isManager: data.isManager,
                isSupport: data.isSupport,
                staffRole: data.staffRole,
                managerPermissions: data.managerPermissions,
              },
              false
            );
          }
        } catch {
          // Not logged in yet
        }
      } finally {
        if (active) setAuthBooting(false);
      }
    };

    void bootTelegramAuth();
    return () => {
      active = false;
    };
  }, [applyTelegramAuth]);

  // Poll Staff Browser Auth when Telegram-Only mode is active
  useEffect(() => {
    if (!waitingStaffAuth || !staffLoginNonce || telegramUser) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/telegram/auth/poll?nonce=${encodeURIComponent(staffLoginNonce)}`
        );
        const data = (await res.json().catch(() => ({}))) as {
          authenticated?: boolean;
          telegramOnly?: boolean;
          error?: string;
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
        if (!active) return;
        if (res.status === 403 && data.telegramOnly) {
          setWaitingStaffAuth(false);
          setStaffGateError(
            data.error ||
              "Bu hisob oddiy foydalanuvchi hisoblanadi. Telegram ilovasidagi bot orqali kiring."
          );
          return;
        }
        if (res.ok && data.authenticated && data.user && data.sessionToken) {
          setWaitingStaffAuth(false);
          applyTelegramAuth(
            {
              user: data.user,
              sessionToken: data.sessionToken,
              account: data.account,
              kvConfigured: data.kvConfigured,
              isAdmin: data.isAdmin,
              isManager: data.isManager,
              isSupport: data.isSupport,
              staffRole: data.staffRole,
              managerPermissions: data.managerPermissions,
            },
            true
          );
        }
      } catch {
        // Ignore transient network errors
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [waitingStaffAuth, staffLoginNonce, telegramUser, applyTelegramAuth]);

  useEffect(() => {
    const onSubRequired = (ev: Event) => {
      const detail = (ev as CustomEvent<MandatoryChannelPublic[]>).detail;
      if (Array.isArray(detail) && detail.length > 0) {
        setMissingSubChannels(detail);
      }
    };
    window.addEventListener('slaydcanva:subscription-required', onSubRequired);
    return () => window.removeEventListener('slaydcanva:subscription-required', onSubRequired);
  }, []);

  const handleRecheckSubscription = useCallback(async () => {
    if (!tgSessionToken || checkingSub) return;
    setCheckingSub(true);
    try {
      const res = await checkTelegramSubscriptionStatus(tgSessionToken);
      if (!res.ok) {
        showNotice('err', res.error || 'Obunani tekshirib bo‘lmadi.');
        return;
      }
      setMissingSubChannels(res.subscribed ? [] : res.missingChannels);
      if (res.subscribed) {
        showNotice('ok', 'Barcha majburiy kanallarga obuna tasdiqlandi!');
      } else {
        showNotice('err', "Hali barcha kanallarga a'zo bo'lmagansiz.");
      }
    } finally {
      setCheckingSub(false);
    }
  }, [tgSessionToken, checkingSub, showNotice]);

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
    async (
      blob: Blob,
      fileName: string,
      baseMessage: string,
      meta?: { serviceId?: string; serviceTitle?: string; triggerDownload?: boolean }
    ) => {
      let serverDownloadPath: string | undefined;
      let sentTg = false;
      let tooLarge = false;

      if (tgSessionToken) {
        const res = await saveAndSendUserFile({
          blob,
          fileName,
          sessionToken: tgSessionToken,
          caption: `📄 ${fileName} — SlaydCanva`,
          serviceId: meta?.serviceId,
          serviceTitle: meta?.serviceTitle,
          sendToTelegram: telegramUser?.autoSendFiles !== false,
        });
        if (res.ok) {
          serverDownloadPath = res.downloadPath;
          sentTg = Boolean(res.sentToTelegram);
          setFilesRefreshKey((k) => k + 1);
        } else if (res.tooLarge) {
          tooLarge = true;
        }
      }

      let downloadFailed = false;
      if (meta?.triggerDownload !== false) {
        try {
          await triggerSafeFileDownload({
            fileName,
            blob,
            serverDownloadPath,
          });
        } catch {
          downloadFailed = true;
        }
      }

      if (downloadFailed && tgSessionToken && !sentTg && !tooLarge) {
        const forceRes = await saveAndSendUserFile({
          blob,
          fileName,
          sessionToken: tgSessionToken,
          caption: `📄 ${fileName} — SlaydCanva (avtomatik yuborildi)`,
          serviceId: meta?.serviceId,
          serviceTitle: meta?.serviceTitle,
          sendToTelegram: true,
          forceTelegram: true,
        });
        if (forceRes.ok) {
          sentTg = Boolean(forceRes.sentToTelegram);
          serverDownloadPath = forceRes.downloadPath || serverDownloadPath;
          setFilesRefreshKey((k) => k + 1);
        }
      }

      if (downloadFailed && sentTg) {
        showNotice('ok', "Yuklab olishda muammo bo'ldi — fayl Telegram botingizga yuborildi.");
      } else if (sentTg) {
        showNotice('ok', `${baseMessage} Fayllarim va Telegramga saqlandi.`);
      } else if (tooLarge) {
        showNotice('ok', `${baseMessage} (15 MB dan katta — serverga yuklanmadi).`);
      } else if (serverDownloadPath) {
        showNotice('ok', `${baseMessage} Fayllarim bo'limiga saqlandi.`);
      } else if (downloadFailed) {
        showNotice('err', "Yuklab olishda xatolik yuz berdi.");
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
        const res = await exportToPptx(state.pptxPages, state.docTitle, {
          download: false,
          sessionToken: tgSessionToken,
        });
        await deliverExportToTelegram(res.blob, res.fileName, 'PPTX fayli tayyor.', {
          serviceTitle: 'Taqdimot (PPTX)',
          triggerDownload: true,
        });
      } else if (state.mode === 'word') {
        const res = await exportToDocx(state.wordDoc, state.docTitle, { download: false });
        await deliverExportToTelegram(res.blob, res.fileName, 'Word (.docx) fayli tayyor.', {
          serviceTitle: 'Hujjat (Word)',
          triggerDownload: true,
        });
      } else {
        const res = await exportCanvasPagesToPdf(
          state.pdfPages,
          state.docTitle,
          'pdf',
          state.pdfOrientation,
          { download: false }
        );
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli tayyor.', {
          serviceTitle: 'PDF hujjat',
          triggerDownload: true,
        });
      }
    } catch {
      if (state.mode === 'pptx' && tgSessionToken) {
        const fallbackRes = await sendProjectPptxFallbackToBot({
          sessionToken: tgSessionToken,
          projectId: activeProjectId,
          title: state.docTitle,
          pages: state.pptxPages,
          serviceTitle: 'Taqdimot (PPTX)',
          caption: `📄 ${state.docTitle || 'Taqdimot'} — PPTX shaklida yuborildi`,
        });
        if (fallbackRes.ok && fallbackRes.sentToTelegram) {
          setFilesRefreshKey((k) => k + 1);
          showNotice('ok', "Yuklab olishda muammo bo'ldi — tizim PPTX faylni Telegram botingizga yubordi.");
          return;
        }
      }
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
        const res = await exportCanvasPagesToPdf(state.pptxPages, state.docTitle, 'pptx', 'landscape', {
          download: false,
        });
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli tayyor.', {
          serviceTitle: 'Taqdimot (PDF)',
          triggerDownload: true,
        });
      } else if (state.mode === 'word' && wordPaperRef.current) {
        const res = await exportWordElementToPdf(wordPaperRef.current, state.docTitle, {
          download: false,
        });
        await deliverExportToTelegram(res.blob, res.fileName, 'PDF fayli tayyor.', {
          serviceTitle: 'Akademik ish (PDF)',
          triggerDownload: true,
        });
      } else {
        showNotice('ok', 'PDF fayli tayyor.');
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
          const res = await exportCanvasPageToPng(active, state.docTitle, 'pptx', 'landscape', {
            download: false,
          });
          await deliverExportToTelegram(res.blob, res.fileName, 'PNG rasm tayyor.', {
            serviceTitle: 'Slayd rasmi (PNG)',
            triggerDownload: true,
          });
        }
      } else {
        const active =
          state.pdfPages.find((p) => p.id === state.activePdfId) || state.pdfPages[0];
        if (active) {
          const res = await exportCanvasPageToPng(active, state.docTitle, 'pdf', state.pdfOrientation, {
            download: false,
          });
          await deliverExportToTelegram(res.blob, res.fileName, 'PNG rasm tayyor.', {
            serviceTitle: 'Sahifa rasmi (PNG)',
            triggerDownload: true,
          });
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

  const syncAuthoritativeBalanceFromServer = useCallback(async () => {
    if (!tgSessionToken) return;
    const me = await fetchTelegramAccountMe(tgSessionToken);
    if (me?.account) {
      setState((prev) => ({
        ...prev,
        balance: me.account!.balance,
        transactions: me.account!.transactions.slice(0, 60),
      }));
    }
    if (me && Array.isArray(me.missingChannels)) {
      setMissingSubChannels(
        me.isAdmin || me.isManager || me.isSupport ? [] : me.missingChannels
      );
    }
  }, [tgSessionToken]);

  const handleTopUp = (
    amount: number,
    method: string,
    externalOrderId?: string,
    serverBalance?: number
  ) => {
    // Only TolovGo server-verified payments can credit balance
    if (!externalOrderId) {
      showNotice('err', "Balans faqat TolovGo to'lovi orqali serverda to'ldiriladi.");
      return;
    }
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    const txId = `tolovgo_${externalOrderId}`;

    setState((prev) => {
      const nextTransactions = prev.transactions.some((t) => t.id === txId)
        ? prev.transactions
        : [
            {
              id: txId,
              title: `Balans to'ldirish (#${externalOrderId})`,
              method,
              amount,
              date: dateStr,
            },
            ...prev.transactions,
          ];
      return {
        ...prev,
        balance: typeof serverBalance === 'number' ? serverBalance : prev.balance,
        transactions: nextTransactions,
      };
    });

    if (typeof serverBalance !== 'number') {
      void syncAuthoritativeBalanceFromServer();
    }
    showNotice('ok', `${formatSom(amount)} TolovGo orqali balansga qo'shildi.`);
    setDesktopTopUpOpen(false);
    if (mobileTab === 'topup') {
      setMobileTab('balance');
    }
  };

  const handlePromoRedeemed = (bonusAmount: number, serverBalance: number, code: string) => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    setState((prev) => ({
      ...prev,
      balance: serverBalance,
      transactions: [
        {
          id: `promo_${code}_${Date.now()}`,
          title: `Promokod: ${code}`,
          method: 'Promokod',
          amount: bonusAmount,
          date: dateStr,
        },
        ...prev.transactions,
      ],
    }));
    void syncAuthoritativeBalanceFromServer();
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
        credentials: 'same-origin',
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
      await Promise.all([
        fetch('/api/telegram/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: getTelegramAuthHeaders(tgSessionToken),
        }),
        adminLogout(tgSessionToken),
      ]);
    } catch {
      // Ignore
    }
    hydratedCloudUserRef.current = null;
    setImpersonationRestore(null);
    setSavedProjects([]);
    setActiveProjectId('');
    setIsAdmin(false);
    setIsManager(false);
    setStaffRole('user');
    setManagerPermissions([]);
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

  const handleImpersonateUser = useCallback(
    (payload: {
      user: TelegramUser;
      sessionToken: string;
      account?: TelegramAccountResponse;
    }) => {
      if (telegramUser && tgSessionToken && !impersonationRestore) {
        setImpersonationRestore({
          user: telegramUser,
          sessionToken: tgSessionToken,
          adminToken,
          isAdmin,
          isManager,
          staffRole,
          managerPermissions,
        });
      }
      skipNextAutoSyncRef.current = true;
      hydratedCloudUserRef.current = null;
      setPptxHistory({ past: [], future: [] });
      setPdfHistory({ past: [], future: [] });
      setSavedProjects([]);
      setActiveProjectId('');
      setState(createInitialState());
      setAdminOpen(false);
      setDesktopProfileOpen(false);
      setDesktopSupportOpen(false);
      setDesktopTopUpOpen(false);
      applyTelegramAuth(
        {
          user: payload.user,
          sessionToken: payload.sessionToken,
          account: payload.account,
          isAdmin: false,
          isManager: false,
          isSupport: false,
          staffRole: 'user',
          managerPermissions: [],
          missingChannels: [],
        },
        false
      );
      setFilesRefreshKey((k) => k + 1);
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setDesktopFilesOpen(true);
      } else {
        setMobileTab('files');
      }
      showNotice('ok', `Masofaviy kirish: ${payload.user.firstName} hisobiga kirildi.`);
    },
    [
      telegramUser,
      tgSessionToken,
      impersonationRestore,
      adminToken,
      isAdmin,
      isManager,
      staffRole,
      managerPermissions,
      applyTelegramAuth,
      showNotice,
    ]
  );

  const handleExitImpersonation = useCallback(() => {
    if (!impersonationRestore) return;
    const restore = impersonationRestore;
    setImpersonationRestore(null);
    skipNextAutoSyncRef.current = true;
    hydratedCloudUserRef.current = null;
    setPptxHistory({ past: [], future: [] });
    setPdfHistory({ past: [], future: [] });
    setSavedProjects([]);
    setActiveProjectId('');
    setState(createInitialState());
    setDesktopFilesOpen(false);
    setDesktopProfileOpen(false);
    applyTelegramAuth(
      {
        user: restore.user,
        sessionToken: restore.sessionToken,
        isAdmin: restore.isAdmin,
        isManager: restore.isManager,
        isSupport: restore.staffRole === 'support',
        staffRole: restore.staffRole,
        managerPermissions: restore.managerPermissions,
      },
      false
    );
    setAdminToken(restore.adminToken);
    setAdminOpen(true);
    void fetchTelegramAccountMe(restore.sessionToken).then((me) => {
      if (me?.ok && me.account) {
        setState((prev) => ({
          ...prev,
          balance: me.account!.balance,
          transactions: me.account!.transactions.slice(0, 60),
        }));
      }
    });
    showNotice('ok', 'Admin hisobingizga qaytdingiz.');
  }, [impersonationRestore, applyTelegramAuth, showNotice]);

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
    const prevSnapshot = stateRef.current;

    if (result.targetMode === 'pptx') {
      setPptxHistory((h) => ({
        past: [...h.past.slice(-29), prevSnapshot.pptxPages],
        future: [],
      }));
    } else if (result.targetMode === 'pdf') {
      setPdfHistory((h) => ({
        past: [...h.past.slice(-29), prevSnapshot.pdfPages],
        future: [],
      }));
    }

    const nextPptxPages = result.targetMode === 'pptx' ? result.pages : prevSnapshot.pptxPages;
    const nextPdfPages = result.targetMode === 'pdf' ? result.pages : prevSnapshot.pdfPages;
    const nextWordDoc =
      result.targetMode === 'word' && result.wordDoc ? result.wordDoc : prevSnapshot.wordDoc;
    const nextPdfOrientation = result.pdfOrientation || prevSnapshot.pdfOrientation;

    let nextProjectId = activeProjectId;
    if (telegramUser && tgSessionToken) {
      nextProjectId = `proj_${telegramUser.telegramId}_${Date.now().toString(36)}`;
      skipNextAutoSyncRef.current = true;
      setActiveProjectId(nextProjectId);
    }

    setState((prev) => ({
      ...prev,
      mode: result.targetMode,
      docTitle: result.docTitle,
      pptxPages: nextPptxPages,
      activePptxId:
        result.targetMode === 'pptx' ? result.pages[0]?.id || prev.activePptxId : prev.activePptxId,
      pdfPages: nextPdfPages,
      activePdfId:
        result.targetMode === 'pdf' ? result.pages[0]?.id || prev.activePdfId : prev.activePdfId,
      wordDoc: nextWordDoc,
      pdfOrientation: nextPdfOrientation,
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
      const shouldSendToTg = telegramUser?.autoSendFiles !== false;
      const projectIdToSave = nextProjectId || (telegramUser ? `proj_${telegramUser.telegramId}_main` : '');
      void (async () => {
        if (projectIdToSave) {
          const syncRes = await syncCloudProject(
            {
              id: projectIdToSave,
              title: result.docTitle || 'Yangi loyiha',
              mode: result.targetMode,
              pptxPages: nextPptxPages,
              pdfPages: nextPdfPages,
              pdfOrientation: nextPdfOrientation,
              wordDoc: nextWordDoc,
              tolovgoMode: prevSnapshot.tolovgoMode || 'live',
            },
            tokenSnapshot
          );
          if (syncRes.ok && syncRes.project) {
            setSavedProjects((prev) => [
              syncRes.project!,
              ...prev.filter((p) => p.id !== syncRes.project!.id),
            ]);
          }
        }

        await logTelegramActivity(
          `${result.serviceTitle}: ${result.docTitle}`,
          'AI Xizmat',
          result.serverCharged ? 0 : -result.price,
          tokenSnapshot
        );
        let deliveredToBot = false;
        try {
          let exported: { blob: Blob; fileName: string } | null = null;
          if (result.targetMode === 'pptx') {
            exported = await exportToPptx(result.pages, result.docTitle, {
              download: false,
              sessionToken: tokenSnapshot,
            });
          } else if (result.targetMode === 'word' && result.wordDoc) {
            exported = await exportToDocx(result.wordDoc, result.docTitle, {
              download: false,
            });
          } else if (result.targetMode === 'pdf') {
            exported = await exportCanvasPagesToPdf(
              result.pages,
              result.docTitle,
              'pdf',
              nextPdfOrientation,
              { download: false }
            );
          }

          if (exported) {
            const savedRes = await saveAndSendUserFile({
              blob: exported.blob,
              fileName: exported.fileName,
              sessionToken: tokenSnapshot,
              caption: `✨ ${result.serviceTitle}: ${result.docTitle}`,
              serviceId: result.serviceId,
              serviceTitle: result.serviceTitle,
              sendToTelegram: result.targetMode === 'pptx' ? true : shouldSendToTg,
              forceTelegram: result.targetMode === 'pptx',
            });
            if (savedRes.ok) {
              setFilesRefreshKey((k) => k + 1);
              deliveredToBot = Boolean(savedRes.sentToTelegram);
              if (savedRes.sentToTelegram) {
                showNotice('ok', `${result.serviceTitle} Fayllarim va Telegram botga yuborildi.`);
              } else {
                showNotice('ok', `${result.serviceTitle} Fayllarim bo'limiga saqlandi.`);
              }
            } else if (!savedRes.skipped && savedRes.error && result.targetMode !== 'pptx') {
              showNotice('err', savedRes.error);
            }
          }
        } catch {
          if (result.targetMode !== 'pptx') {
            showNotice('err', "Faylni eksport qilib saqlashda xatolik yuz berdi.");
          }
        }

        if (result.targetMode === 'pptx' && !deliveredToBot && result.pages.length > 0) {
          const fallbackRes = await sendProjectPptxFallbackToBot({
            sessionToken: tokenSnapshot,
            projectId: projectIdToSave,
            title: result.docTitle,
            pages: result.pages,
            caption: `✨ ${result.serviceTitle}: ${result.docTitle}`,
            serviceId: result.serviceId,
            serviceTitle: result.serviceTitle,
          });
          if (fallbackRes.ok) {
            setFilesRefreshKey((k) => k + 1);
            if (fallbackRes.sentToTelegram) {
              showNotice('ok', `${result.serviceTitle} PPTX shaklida Telegram botingizga yuborildi.`);
            } else {
              showNotice('ok', `${result.serviceTitle} PPTX shaklida Fayllarim bo'limiga saqlandi.`);
            }
          } else {
            showNotice('err', fallbackRes.error || "PPTX faylini saqlash va botga yuborishda xatolik.");
          }
        }
      })();
    }
  };

  const isStaffMember = isAdmin || isManager || staffRole === 'support';
  const telegramOnlyBlocked =
    !authBooting &&
    telegramConfigured &&
    (siteConfig.telegramOnlyMode ?? true) &&
    !inTelegramWebApp &&
    !isStaffMember &&
    !impersonationRestore;

  if (telegramOnlyBlocked) {
    const botHandle = botUsername || 'SlaydCanvaBot';
    return (
      <div className="min-h-screen w-screen bg-[#111113] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="aspect-video w-full bg-zinc-950 overflow-hidden relative">
            <img
              src="/assets/bot-welcome.jpg"
              alt="SlaydCanva Telegram Bot"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-red-400">
                Faqat Telegram Ilovasi (Mini App)
              </div>
              <h1 className="font-display text-lg font-bold text-white leading-snug">
                SlaydCanva endi faqat Telegram bot ichida ochiladi
              </h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Xavfsizlik va barcha taqdimot fayllaringiz Telegramda saqlanishi uchun ilovani bot orqali ishga tushiring:
              </p>
            </div>

            <ol className="space-y-1.5 text-xs text-zinc-300 bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5">
              <li>1. Quyidagi tugma orqali Telegram botni oching (@{botHandle})</li>
              <li>2. Botga «Start» bosing va yo‘riqnomani ko‘ring</li>
              <li>3. Pastdagi «🚀 Ilovani ochish» tugmasini bosing</li>
            </ol>

            <a
              href={`https://t.me/${botHandle}?start=webapp`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Telegramda Botni Ochish</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setShowStaffGateLogin((v) => !v);
                  setStaffGateError(null);
                }}
                className="w-full text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center justify-center gap-1.5 py-1"
              >
                <Shield className="w-3.5 h-3.5 text-red-400" />
                <span>Xodim / Admin / Support CRM kirishi</span>
              </button>

              {showStaffGateLogin && (
                <div className="mt-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 text-xs">
                  <p className="text-zinc-400 leading-relaxed">
                    Admin, Menejer va Support xodimlari kompyuter brauzeridan CRM paneliga kirish uchun botdan tasdiqlash tugmasini bosing:
                  </p>
                  {staffGateError && (
                    <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-[11px]">
                      {staffGateError}
                    </div>
                  )}
                  <a
                    href={`https://t.me/${botHandle}?start=auth_${staffLoginNonce}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setStaffGateError(null);
                      setWaitingStaffAuth(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center justify-center gap-1.5"
                  >
                    {waitingStaffAuth ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                        <span>Bot tasdig‘i kutilmoqda...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-3.5 h-3.5 text-red-400" />
                        <span>Bot orqali Xodim sifatida kirish</span>
                      </>
                    )}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F4F4F6]">
      {impersonationRestore && telegramUser && (
        <div className="shrink-0 bg-[#111113] border-b border-red-600/60 text-white px-3 md:px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-50">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="truncate">
              Masofaviy boshqaruv:{' '}
              <strong className="font-semibold text-white">{telegramUser.firstName}</strong>
              {' · '}
              <span className="font-mono text-zinc-300">ID {telegramUser.telegramId}</span>
              {' · '}
              <span className="font-mono text-emerald-400">{formatSom(state.balance)}</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                  setDesktopFilesOpen(true);
                } else {
                  setMobileTab('files');
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium inline-flex items-center gap-1"
            >
              <FolderOpen className="w-3 h-3 text-red-400" />
              <span>Fayllari</span>
            </button>
            <button
              type="button"
              onClick={handleExitImpersonation}
              className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Admin hisobga qaytish</span>
            </button>
          </div>
        </div>
      )}

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
        onOpenFiles={() => setDesktopFilesOpen(true)}
        onOpenSupport={() => setDesktopSupportOpen(true)}
        isAdmin={isStaffMember}
        staffRole={staffRole}
        onOpenAdminPanel={() => setAdminOpen(true)}
        telegramUser={telegramUser}
        isExporting={isExporting}
      />

      {siteConfig.maintenanceMode && !isStaffMember && !impersonationRestore && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            {siteConfig.maintenanceMessage ||
              'Saytda texnik yangilanish ishlari olib borilmoqda. Tez orada davom etamiz.'}
          </span>
        </div>
      )}

      {!siteConfig.maintenanceMode && siteConfig.announcementBanner && (
        <div className="shrink-0 bg-[#111113] border-b border-zinc-800 px-4 py-1.5 text-xs text-zinc-200 flex items-center justify-center gap-2">
          <Megaphone className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="truncate">{siteConfig.announcementBanner}</span>
        </div>
      )}

      {/* Mobile Secondary Views (Bosh sahifa, Fayllar va Amaliyotlar, Balans to'ldirish, Balans, Profil) */}
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
          {mobileTab === 'files' && (
            <FilesAndOpsView
              telegramSessionToken={tgSessionToken}
              telegramUser={telegramUser}
              botUsername={botUsername}
              savedProjects={savedProjects}
              activeProjectId={activeProjectId}
              transactions={state.transactions}
              syncingProject={syncingProject}
              refreshKey={filesRefreshKey}
              onNotify={showNotice}
              onSaveProjectNow={() => void syncCurrentProjectNow(undefined, false)}
              onLoadCloudProject={(id) => void handleLoadCloudProject(id)}
              onDeleteCloudProject={(id) => void handleDeleteCloudProject(id)}
              onSendCurrentToTelegram={() => void handleExportPrimary()}
              onOpenEditor={handleOpenEditorMode}
              onOpenTab={handleSelectMobileTab}
            />
          )}
          {mobileTab === 'topup' && (
            <TopUpView
              balance={state.balance}
              tolovgoMode={state.tolovgoMode || 'live'}
              telegramSessionToken={tgSessionToken}
              onTopUp={handleTopUp}
              onPromoRedeemed={handlePromoRedeemed}
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
              isAdmin={isStaffMember}
              staffRole={staffRole}
              pricingSettings={pricingSettings}
              botUsername={botUsername}
              supportUsername={siteConfig.supportUsername}
              onNotify={showNotice}
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
            telegramSessionToken={state.telegramSessionToken}
            docTitle={state.docTitle}
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
            telegramSessionToken={state.telegramSessionToken}
            docTitle={state.docTitle}
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
              onPromoRedeemed={handlePromoRedeemed}
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
              isAdmin={isStaffMember}
              staffRole={staffRole}
              pricingSettings={pricingSettings}
              botUsername={botUsername}
              supportUsername={siteConfig.supportUsername}
              onNotify={showNotice}
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

      {/* Desktop Fayllarim Modal */}
      {desktopFilesOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] items-center justify-center p-4"
          onClick={() => setDesktopFilesOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-red-600" />
                <span>Fayllarim (Saqlangan ishlar)</span>
              </span>
              <button
                type="button"
                onClick={() => setDesktopFilesOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FilesAndOpsView
                telegramSessionToken={tgSessionToken}
                telegramUser={telegramUser}
                botUsername={botUsername}
                savedProjects={savedProjects}
                activeProjectId={activeProjectId}
                transactions={state.transactions}
                syncingProject={syncingProject}
                refreshKey={filesRefreshKey}
                onNotify={showNotice}
                onSaveProjectNow={() => void syncCurrentProjectNow(undefined, false)}
                onLoadCloudProject={(id) => {
                  void handleLoadCloudProject(id);
                  setDesktopFilesOpen(false);
                }}
                onDeleteCloudProject={(id) => void handleDeleteCloudProject(id)}
                onSendCurrentToTelegram={() => void handleExportPrimary()}
                onOpenEditor={(m) => {
                  handleOpenEditorMode(m);
                  setDesktopFilesOpen(false);
                }}
                onOpenTab={(t) => {
                  setDesktopFilesOpen(false);
                  if (t === 'topup') setDesktopTopUpOpen(true);
                  else if (t === 'profile' || t === 'balance') setDesktopProfileOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Support & Help Modal */}
      {desktopSupportOpen && (
        <div
          className="hidden md:flex fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] items-center justify-center p-4"
          onClick={() => setDesktopSupportOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-red-600" />
                <span>Support va Yordam Markazi</span>
              </span>
              <button
                type="button"
                onClick={() => setDesktopSupportOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <SupportClientPanel
                telegramSessionToken={tgSessionToken}
                telegramUser={telegramUser}
                botUsername={botUsername}
                supportUsername={siteConfig.supportUsername}
                compact
                onNotify={showNotice}
              />
            </div>
          </div>
        </div>
      )}

      {telegramUser && !isStaffMember && !impersonationRestore && missingSubChannels.length > 0 && (
        <div className="fixed inset-0 z-55 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#111113] text-white px-5 py-4 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-snug">Majburiy obuna talab etiladi</h2>
                <p className="text-[11px] text-zinc-400">
                  Ilovadan to‘liq foydalanish uchun quyidagi kanallarga a’zo bo‘ling
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {missingSubChannels.map((ch, idx) => (
                  <a
                    key={ch.id}
                    href={ch.inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-red-500 hover:bg-red-50/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-900 truncate">
                        {idx + 1}. {ch.title}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 truncate">
                        {ch.chatId}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                      <span>Obuna bo‘lish</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>

              <button
                type="button"
                disabled={checkingSub}
                onClick={() => void handleRecheckSubscription()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#111113] hover:bg-zinc-800 disabled:opacity-55 text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                {checkingSub ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>{checkingSub ? 'Tekshirilmoqda...' : 'Obunani tekshirish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && isStaffMember && telegramUser && tgSessionToken && (
        <AdminDashboard
          telegramUser={telegramUser}
          telegramSessionToken={tgSessionToken}
          adminToken={adminToken}
          staffRole={staffRole}
          initialPermissions={managerPermissions}
          onAdminTokenChange={setAdminToken}
          onPricingUpdated={(nextPricing) => setPricingSettings(nextPricing)}
          onTolovgoModeUpdated={(nextMode) =>
            setState((prev) => ({ ...prev, tolovgoMode: nextMode }))
          }
          onSiteConfigUpdated={(nextCfg) => setSiteConfig(nextCfg)}
          onImpersonateUser={handleImpersonateUser}
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
