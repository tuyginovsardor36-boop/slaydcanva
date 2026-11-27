import React from 'react';
import { FolderOpen, Home, Plus, User, Wallet } from 'lucide-react';
import { MobileTab } from '../types/editor';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <div className="md:hidden shrink-0 px-3 pt-1 pb-[max(10px,env(safe-area-inset-bottom))] bg-transparent pointer-events-none z-30">
      {/* Ovalsimon romka (Obsidian outer oval frame matching brand logo) */}
      <nav
        aria-label="Mobil navigatsiya"
        className="pointer-events-auto max-w-[420px] mx-auto rounded-full bg-[#111113]/95 backdrop-blur-md border border-zinc-800 shadow-lg px-2 py-1.5 grid grid-cols-5 items-center"
      >
        {/* 1. Bosh sahifa */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-pressed={activeTab === 'home'}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <span
            className={`w-11 h-7 rounded-full border flex items-center justify-center transition-colors ${
              activeTab === 'home'
                ? 'bg-white border-white text-zinc-950'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Home className="w-4 h-4" />
          </span>
          <span
            className={`text-[10px] font-medium leading-none truncate max-w-full ${
              activeTab === 'home' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            Bosh sahifa
          </span>
        </button>

        {/* 2. Fayllar va Amaliyotlar (Telegramda saqlanadi) */}
        <button
          type="button"
          onClick={() => onSelectTab('files')}
          aria-pressed={activeTab === 'files'}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <span
            className={`w-11 h-7 rounded-full border flex items-center justify-center transition-colors ${
              activeTab === 'files'
                ? 'bg-white border-white text-zinc-950'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
          </span>
          <span
            className={`text-[10px] font-medium leading-none truncate max-w-full ${
              activeTab === 'files' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            Fayllarim
          </span>
        </button>

        {/* 3. Balans to'ldirish (Markaziy qizil ovalsimon tugma) */}
        <button
          type="button"
          onClick={() => onSelectTab('topup')}
          aria-pressed={activeTab === 'topup'}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <span
            className={`w-13 h-8 rounded-full border flex items-center justify-center shadow-xs transition-colors ${
              activeTab === 'topup'
                ? 'bg-red-500 border-red-400 text-white ring-2 ring-red-500/40'
                : 'bg-red-600 border-red-500 text-white'
            }`}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
          </span>
          <span
            className={`text-[10px] font-semibold leading-none truncate max-w-full ${
              activeTab === 'topup' ? 'text-red-400' : 'text-red-500'
            }`}
          >
            To'ldirish
          </span>
        </button>

        {/* 4. Balans */}
        <button
          type="button"
          onClick={() => onSelectTab('balance')}
          aria-pressed={activeTab === 'balance'}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <span
            className={`w-11 h-7 rounded-full border flex items-center justify-center transition-colors ${
              activeTab === 'balance'
                ? 'bg-white border-white text-zinc-950'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <Wallet className="w-4 h-4" />
          </span>
          <span
            className={`text-[10px] font-medium leading-none truncate max-w-full ${
              activeTab === 'balance' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            Balans
          </span>
        </button>

        {/* 5. Profil */}
        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          aria-pressed={activeTab === 'profile'}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <span
            className={`w-11 h-7 rounded-full border flex items-center justify-center transition-colors ${
              activeTab === 'profile'
                ? 'bg-white border-white text-zinc-950'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400'
            }`}
          >
            <User className="w-4 h-4" />
          </span>
          <span
            className={`text-[10px] font-medium leading-none truncate max-w-full ${
              activeTab === 'profile' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            Profil
          </span>
        </button>
      </nav>
    </div>
  );
};
