import React from 'react';
import {
  Download,
  FileText,
  FileType2,
  Headphones,
  ImageDown,
  Loader2,
  Presentation,
  RotateCcw,
  Shield,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import { formatSom } from '../data/defaults';
import { DesktopView, MobileTab, StaffRole, TelegramUser, WorkspaceMode } from '../types/editor';
import { BrandLogo } from './BrandLogo';

interface TopBarProps {
  mode: WorkspaceMode;
  desktopView: DesktopView;
  onDesktopViewChange: (view: DesktopView) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  mobileTab: MobileTab;
  mobileServiceOpen?: boolean;
  balance: number;
  docTitle: string;
  onTitleChange: (title: string) => void;
  onExportPrimary: () => void;
  onExportSecondaryPdf?: () => void;
  onExportPng?: () => void;
  onResetCurrent: () => void;
  onOpenTopUp?: () => void;
  onOpenProfile?: () => void;
  onOpenSupport?: () => void;
  isAdmin?: boolean;
  staffRole?: StaffRole;
  onOpenAdminPanel?: () => void;
  telegramUser?: TelegramUser | null;
  isExporting: boolean;
}

const MOBILE_TAB_TITLES: Record<MobileTab, string> = {
  home: 'Bosh sahifa',
  files: 'Fayllar va Amaliyotlar',
  editor: 'Slayd qilish',
  topup: "Balans to'ldirish",
  balance: 'Balans',
  profile: 'Profil',
};

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  desktopView,
  onDesktopViewChange,
  onModeChange,
  mobileTab,
  mobileServiceOpen = false,
  balance,
  docTitle,
  onTitleChange,
  onExportPrimary,
  onExportSecondaryPdf,
  onExportPng,
  onResetCurrent,
  onOpenTopUp,
  onOpenProfile,
  onOpenSupport,
  isAdmin = false,
  staffRole = 'user',
  onOpenAdminPanel,
  telegramUser,
  isExporting,
}) => {
  const primaryLabel =
    mode === 'pptx' ? 'PPTX yuklash' : mode === 'word' ? 'Word yuklash' : 'PDF yuklash';

  const mobileShortLabel =
    mode === 'pptx' ? 'PPTX' : mode === 'word' ? 'Word' : 'PDF';

  return (
    <header className="h-[48px] md:h-[54px] shrink-0 bg-[#111113] text-white border-b border-zinc-800 px-3 md:px-4 flex items-center justify-between gap-3 md:gap-5 z-20">
      {/* Zone 1: Brand Logo + Wordmark + Document Name */}
      <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => onDesktopViewChange('services')}
          className="flex items-center gap-2 shrink-0 focus:outline-none"
        >
          <BrandLogo className="w-7 h-7 md:w-8 md:h-8 shrink-0" />
          <span className="font-display text-[16px] md:text-[17px] font-bold tracking-tight text-white whitespace-nowrap">
            Slayd<span className="text-red-500">Canva</span>
          </span>
        </button>

        <span className="h-4 w-px bg-zinc-700 shrink-0" aria-hidden="true" />

        <input
          type="text"
          value={docTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Hujjat nomi"
          placeholder="Hujjat nomi"
          className={`${
            mobileTab === 'editor' ? 'block' : 'hidden md:block'
          } text-sm font-medium text-zinc-200 bg-transparent border border-transparent hover:border-zinc-700 focus:border-red-500 focus:bg-zinc-900 rounded-md px-2 py-1 w-32 sm:w-44 md:w-48 truncate outline-none transition-colors placeholder:text-zinc-500`}
        />

        {mobileTab !== 'editor' && (
          <span className="md:hidden text-xs font-medium text-zinc-400 truncate">
            {mobileServiceOpen ? 'AI Xizmatlar' : MOBILE_TAB_TITLES[mobileTab]}
          </span>
        )}
      </div>

      {/* Zone 2: Mode Switcher (Desktop) */}
      <nav
        aria-label="Muhit tanlash"
        className="hidden md:flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg shrink-0"
      >
        <button
          type="button"
          onClick={() => onDesktopViewChange('services')}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            desktopView === 'services'
              ? 'bg-red-600 text-white shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Xizmatlar</span>
        </button>

        <span className="h-3.5 w-px bg-zinc-700 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={() => {
            onDesktopViewChange('editor');
            onModeChange('pptx');
          }}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            desktopView === 'editor' && mode === 'pptx'
              ? 'bg-white text-zinc-950 shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <Presentation className="w-3.5 h-3.5" />
          <span>Slayd · PPTX</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onDesktopViewChange('editor');
            onModeChange('word');
          }}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            desktopView === 'editor' && mode === 'word'
              ? 'bg-white text-zinc-950 shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Hujjat · Word</span>
        </button>

        <button
          type="button"
          onClick={() => {
            onDesktopViewChange('editor');
            onModeChange('pdf');
          }}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
            desktopView === 'editor' && mode === 'pdf'
              ? 'bg-white text-zinc-950 shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/70'
          }`}
        >
          <FileType2 className="w-3.5 h-3.5" />
          <span>PDF</span>
        </button>
      </nav>

      {/* Zone 3: Primary Export & Reset / Balance */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {desktopView === 'services' ? (
          <div className="hidden md:flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenTopUp}
              title="Balansni to'ldirish"
              className="flex items-center gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-200 transition-colors"
            >
              <Wallet className="w-3.5 h-3.5 text-red-500" />
              <span className="font-mono tabular-nums font-semibold">
                {formatSom(balance)}
              </span>
            </button>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                title="Profil, Telegram va sozlamalar"
                className="flex items-center gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-300 hover:text-white transition-colors"
              >
                {telegramUser ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="max-w-[110px] truncate">
                      {telegramUser.username ? `@${telegramUser.username}` : telegramUser.firstName}
                    </span>
                  </>
                ) : (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span>Telegram · Profil</span>
                  </>
                )}
              </button>
            )}
            {onOpenSupport && (
              <button
                type="button"
                onClick={onOpenSupport}
                title="Support va Yordam"
                className="flex items-center gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md px-2.5 py-1.5 text-zinc-300 hover:text-white transition-colors"
              >
                <Headphones className="w-3.5 h-3.5 text-red-500" />
                <span>Support</span>
              </button>
            )}
            {(isAdmin || staffRole === 'super_admin' || staffRole === 'manager' || staffRole === 'support') &&
              onOpenAdminPanel && (
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  title={
                    staffRole === 'support'
                      ? 'Support CRM Boshqaruv Paneli'
                      : staffRole === 'manager'
                        ? 'Menejer CRM Boshqaruv Paneli'
                        : 'Admin CRM Boshqaruv Paneli'
                  }
                  className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-500 border border-red-500 rounded-md px-2.5 py-1.5 text-white font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>
                    {staffRole === 'support'
                      ? 'Support · CRM'
                      : staffRole === 'manager'
                        ? 'Menejer · CRM'
                        : 'Admin · CRM'}
                  </span>
                </button>
              )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onResetCurrent}
              title="Joriy muhitni boshlang'ich holatga qaytarish"
              className={`${
                mobileTab === 'editor' ? 'flex' : 'hidden md:flex'
              } items-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors whitespace-nowrap shrink-0`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tozalash</span>
            </button>

            {mode !== 'word' && onExportPng && (
              <button
                type="button"
                disabled={isExporting}
                onClick={onExportPng}
                title="Joriy sahifani PNG rasm sifatida yuklash"
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <ImageDown className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            )}

            {mode !== 'pdf' && onExportSecondaryPdf && (
              <button
                type="button"
                disabled={isExporting}
                onClick={onExportSecondaryPdf}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-md transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            )}

            <button
              type="button"
              disabled={isExporting}
              onClick={onExportPrimary}
              className={`${
                mobileTab === 'editor' ? 'flex' : 'hidden md:flex'
              } items-center gap-1.5 px-3 md:px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded-md transition-colors disabled:opacity-60 whitespace-nowrap shrink-0`}
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="md:hidden">{mobileShortLabel}</span>
              <span className="hidden md:inline">{primaryLabel}</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
