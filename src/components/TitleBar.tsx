import React, { useState } from 'react';
import {
  Minus,
  Square,
  Search,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  ShoppingBag,
  Menu,
  Shield,
  Briefcase,
  Eye,
  Radio,
  LogOut,
  KeyRound,
  X,
} from 'lucide-react';
import { AppSettings, AppUser } from '../types';
import { AppLogo } from './AppLogo';

interface TitleBarProps {
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  currentUser?: AppUser;
  onOpenTeamView?: () => void;
  onOpenLiveMonitor?: () => void;
  onlineLocationsCount?: number;
  onOpenChangePassword?: () => void;
  onSignOut?: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenDesktopGuide?: () => void;
  onOpenScanner: () => void;
  onOpenPOSRegister?: () => void;
  onRefreshData?: () => void;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  settings,
  onUpdateSettings,
  currentUser,
  onOpenTeamView,
  onOpenLiveMonitor,
  onlineLocationsCount,
  onOpenChangePassword,
  onSignOut,
  searchQuery,
  onSearchChange,
  onOpenScanner,
  onOpenPOSRegister,
  onRefreshData,
  onToggleMobileMenu,
  isMobileMenuOpen,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowMessage, setWindowMessage] = useState<string | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const showWindowToast = (msg: string) => {
    setWindowMessage(msg);
    setTimeout(() => setWindowMessage(null), 2500);
  };

  return (
    <header
      id="app-windows-titlebar"
      className="h-10 select-none bg-[#fbfbfb]/90 dark:bg-[#1f1f1f]/90 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between px-2 sm:px-3 text-xs font-normal text-slate-700 dark:text-slate-300 z-50 sticky top-0 fluent-mica"
    >
      {/* Left: Mobile Menu Button & App Identity */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
        {onToggleMobileMenu && (
          <button
            id="titlebar-mobile-menu-btn"
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-md md:hidden hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            title="Toggle Navigation Menu"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <AppLogo
          customLogoUrl={settings.customLogoUrl}
          className="w-5 h-5"
          alt={settings.companyName || 'Inventory'}
        />
        <span className="font-semibold text-slate-900 dark:text-slate-100 text-[13px] tracking-tight truncate max-w-[120px] sm:max-w-[180px]">
          {settings.companyName || 'Inventory'}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline-block truncate max-w-[120px]">
          — {settings.warehouseName}
        </span>
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 relative hidden md:block">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          id="titlebar-global-search"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search items, SKU, categories, bins... (Ctrl+F)"
          className="w-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] focus:bg-white dark:focus:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] focus:border-blue-500 dark:focus:border-blue-400 rounded-md pl-8 pr-12 py-1 text-xs outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 bg-black/[0.04] dark:bg-white/[0.08] px-1.5 py-0.5 rounded border border-black/[0.05] dark:border-white/[0.05]">
          Ctrl+K
        </kbd>
      </div>

      {/* Right: User Status, Quick Controls & Windows Controls */}
      <div className="flex items-center space-x-1.5">
        {/* Real-time Multi-Location Live Status Button */}
        {onOpenLiveMonitor && (
          <button
            onClick={onOpenLiveMonitor}
            className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-[11px] font-semibold transition-colors cursor-pointer mr-1"
            title="Open real-time supervisor activity monitor"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <Radio className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>{onlineLocationsCount && onlineLocationsCount > 1 ? `${onlineLocationsCount} Stations Live` : 'Live Monitor'}</span>
          </button>
        )}

        {/* User Role Status Pill */}
        {currentUser && (
          <div className="flex items-center space-x-1 mr-1">
            <button
              id="titlebar-user-badge"
              onClick={onOpenTeamView}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.06] text-[11px] transition-colors cursor-pointer"
              title={`Logged in as ${currentUser.name} (${currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'supervisor' ? 'Supervisor' : 'Sales Manager'}). Click to manage team.`}
            >
              {currentUser.role === 'admin' ? (
                <Shield className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              ) : currentUser.role === 'supervisor' ? (
                <Eye className="w-3 h-3 text-sky-600 dark:text-sky-400" />
              ) : (
                <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              )}
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[90px] sm:max-w-[130px]">
                {currentUser.name.split(' ')[0]}
              </span>
              <span
                className={`px-1.5 py-0.2 text-[9px] rounded font-bold uppercase tracking-wider ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                    : currentUser.role === 'supervisor'
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {currentUser.role === 'admin' ? 'Admin' : currentUser.role === 'supervisor' ? 'Supervisor' : 'Sales'}
              </span>
            </button>

            {onOpenChangePassword && (
              <button
                id="titlebar-btn-change-password"
                onClick={onOpenChangePassword}
                className="p-1 rounded text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 border border-transparent hover:border-purple-200 dark:hover:border-purple-900 transition-colors cursor-pointer"
                title={currentUser.role === 'admin' ? 'Change Admin Password / PIN' : 'Change Password / PIN'}
              >
                <KeyRound className="w-3.5 h-3.5" />
              </button>
            )}

            {onSignOut && (
              <button
                id="titlebar-btn-signout"
                onClick={onSignOut}
                className="p-1 rounded text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
                title="Sign Out / Lock Station (Ctrl+L)"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Refresh button */}
        {onRefreshData && (
          <button
            id="titlebar-btn-refresh"
            onClick={onRefreshData}
            title="Refresh Inventory"
            className="p-1.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 active:scale-95 transition-transform"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* POS Register Quick Launcher */}
        {onOpenPOSRegister && (
          <button
            id="titlebar-btn-pos-register"
            onClick={onOpenPOSRegister}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors border border-emerald-200/70 dark:border-emerald-850 cursor-pointer"
            title="Open POS Register & Sales Terminal (F3)"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold hidden md:inline">POS (F3)</span>
          </button>
        )}

        {/* Sound toggle */}
        <button
          id="titlebar-btn-sound"
          onClick={() => onUpdateSettings({ enableSoundEffects: !settings.enableSoundEffects })}
          title={settings.enableSoundEffects ? 'Audio Feedback Enabled' : 'Audio Feedback Muted'}
          className="p-1.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400"
        >
          {settings.enableSoundEffects ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
        </button>

        {/* Dark/Light mode switcher */}
        <button
          id="titlebar-btn-theme"
          onClick={() => {
            const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
            onUpdateSettings({ theme: nextTheme });
            if (nextTheme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }}
          title="Toggle Windows Dark / Light Theme"
          className="p-1.5 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400"
        >
          {settings.theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        <div className="w-[1px] h-4 bg-black/[0.1] dark:bg-white/[0.1] mx-1" />

        {/* Windows 11 Native-Style Window Buttons */}
        <div className="flex items-center -mr-1">
          <button
            id="win-btn-minimize"
            onClick={() => showWindowToast('App minimized to Windows taskbar simulation')}
            title="Minimize"
            className="w-8 h-8 flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:bg-black/[0.1] text-slate-600 dark:text-slate-400 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            id="win-btn-maximize"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Restore Window' : 'Maximize Window'}
            className="w-8 h-8 flex items-center justify-center hover:bg-black/[0.06] dark:hover:bg-white/[0.08] active:bg-black/[0.1] text-slate-600 dark:text-slate-400 transition-colors"
          >
            {isFullscreen ? <Square className="w-2.5 h-2.5" /> : <Maximize2 className="w-3 h-3" />}
          </button>
          <button
            id="win-btn-close"
            onClick={() => showWindowToast('Use browser tab or Window close button to exit application')}
            title="Close"
            className="w-8 h-8 flex items-center justify-center hover:bg-red-600 hover:text-white active:bg-red-700 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Window notification toast */}
      {windowMessage && (
        <div className="absolute bottom--8 right-4 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-1.5 rounded shadow-lg text-[11px] font-medium z-50 animate-fade-in">
          {windowMessage}
        </div>
      )}
    </header>
  );
};

