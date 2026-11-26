import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
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
  formatSom,
  INITIAL_WORD_HTML,
  uid,
} from './data/defaults';
import {
  AiServiceId,
  CanvasPage,
  DesktopView,
  MobileTab,
  PdfOrientation,
  SlaydCanvaState,
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
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const wordPaperRef = useRef<HTMLDivElement | null>(null);

  // Persist workspace to localStorage
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

  const handleExportPrimary = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (state.mode === 'pptx') {
        await exportToPptx(state.pptxPages, state.docTitle);
        showNotice('ok', 'PPTX fayli yuklab olindi.');
      } else if (state.mode === 'word') {
        await exportToDocx(state.wordDoc, state.docTitle);
        showNotice('ok', 'Word (.docx) fayli yuklab olindi.');
      } else {
        await exportCanvasPagesToPdf(
          state.pdfPages,
          state.docTitle,
          'pdf',
          state.pdfOrientation
        );
        showNotice('ok', 'PDF fayli yuklab olindi.');
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
        await exportCanvasPagesToPdf(state.pptxPages, state.docTitle, 'pptx');
      } else if (state.mode === 'word' && wordPaperRef.current) {
        await exportWordElementToPdf(wordPaperRef.current, state.docTitle);
      }
      showNotice('ok', 'PDF fayli yuklab olindi.');
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
          await exportCanvasPageToPng(active, state.docTitle, 'pptx');
        }
      } else {
        const active =
          state.pdfPages.find((p) => p.id === state.activePdfId) || state.pdfPages[0];
        if (active) {
          await exportCanvasPageToPng(active, state.docTitle, 'pdf', state.pdfOrientation);
        }
      }
      showNotice('ok', 'PNG rasm yuklab olindi.');
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
    showNotice('ok', "Profil ma'lumotlari saqlandi.");
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
      balance: Math.max(0, prev.balance - result.price),
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
                onRequestTopUp={() => {
                  setMobileServiceOpen(false);
                  setMobileTab('topup');
                }}
                onGenerated={handleAiGenerated}
              />
            </div>
          )}
          {mobileTab === 'topup' && (
            <TopUpView balance={state.balance} onTopUp={handleTopUp} onNotify={showNotice} />
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
              onSaveProfile={handleSaveProfile}
              onOpenTab={handleSelectMobileTab}
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
            <TopUpView balance={state.balance} onTopUp={handleTopUp} onNotify={showNotice} />
          </div>
        </div>
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
