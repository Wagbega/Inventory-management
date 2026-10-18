import React from 'react';
import {
  LayoutDashboard,
  Radio,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  Truck,
  Barcode,
  Receipt,
  Settings,
  Plus,
  ScanLine,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  Users,
  Shield,
  Briefcase,
  Lock,
  LogOut,
  KeyRound,
  Sun,
  Moon,
  ShoppingBag,
  Calculator,
  X,
} from 'lucide-react';
import { ViewTab, AppUser, AppSettings } from '../types';
import { AppLogo } from './AppLogo';

interface NavigationSidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  lowStockCount: number;
  pendingPOCount: number;
  totalItemsCount: number;
  receiptsCount?: number;
  activeRepDispatchesCount?: number;
  currentUser?: AppUser;
  settings?: AppSettings;
  onToggleTheme?: () => void;
  onOpenAddItem: () => void;
  onOpenScanner: () => void;
  onOpenSettings: () => void;
  onOpenPOSRegister?: () => void;
  onOpenChangePassword?: () => void;
  onSignOut?: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
  lowStockCount,
  pendingPOCount,
  totalItemsCount,
  receiptsCount,
  activeRepDispatchesCount,
  currentUser,
  settings,
  onToggleTheme,
  onOpenAddItem,
  onOpenScanner,
  onOpenSettings,
  onOpenPOSRegister,
  onOpenChangePassword,
  onSignOut,
}) => {
  const isAdmin = currentUser ? currentUser.role === 'admin' : true;

  const handleAction = (callback: () => void) => {
    callback();
    if (onCloseMobile) onCloseMobile();
  };

  const navItems = [
    {
      id: 'dashboard' as ViewTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'live_monitor' as ViewTab,
      label: 'Supervisor Monitor',
      icon: Radio,
      badge: 'LIVE',
      isLiveBadge: true,
    },
    {
      id: 'pos_action' as any,
      label: 'POS Register (F3)',
      icon: ShoppingBag,
      badge: null,
      isPOSTrigger: true,
    },
    {
      id: 'inventory' as ViewTab,
      label: 'Inventory Items',
      icon: Boxes,
      badge: totalItemsCount > 0 ? totalItemsCount : null,
      alertBadge: lowStockCount > 0 ? lowStockCount : null,
    },
    {
      id: 'movements' as ViewTab,
      label: 'Stock Ledger',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'receipts' as ViewTab,
      label: 'Receipts & POS Slips',
      icon: Receipt,
      badge: receiptsCount && receiptsCount > 0 ? receiptsCount : null,
    },
    {
      id: 'sales_recap' as ViewTab,
      label: 'Daily Sales & Expenses',
      icon: Calculator,
      badge: null,
    },
    {
      id: 'sales_rep_dispatch' as ViewTab,
      label: 'Field Sales Reps',
      icon: Truck,
      badge: activeRepDispatchesCount && activeRepDispatchesCount > 0 ? activeRepDispatchesCount : null,
    },
    {
      id: 'purchase_orders' as ViewTab,
      label: 'Purchase Orders',
      icon: ShoppingCart,
      badge: pendingPOCount > 0 ? pendingPOCount : null,
    },
    {
      id: 'suppliers' as ViewTab,
      label: 'Suppliers',
      icon: Truck,
      badge: null,
    },
    {
      id: 'team' as ViewTab,
      label: 'Team & RBAC Roles',
      icon: Users,
      badge: null,
    },
    {
      id: 'barcode_studio' as ViewTab,
      label: 'Barcode Studio',
      icon: Barcode,
      badge: null,
    },
    {
      id: 'settings_action' as any,
      label: 'Dev',
      icon: Lock,
      badge: 'Protected',
      isSettingsTrigger: true,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Top Header & Actions Section */}
      <div className="p-2 space-y-2.5 shrink-0 border-b border-black/[0.05] dark:border-white/[0.05]">
        {/* Mobile Header / Desktop Collapse toggle */}
        <div className="flex items-center justify-between px-1.5 py-0.5">
          <div className="flex items-center space-x-2">
            <div className="md:hidden">
              <AppLogo
                customLogoUrl={settings?.customLogoUrl}
                className="w-5 h-5"
                alt={settings?.companyName || 'Inventory'}
              />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isOpenMobile ? 'Navigation' : (!isCollapsed ? 'Workspace' : '')}
            </span>
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            id="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden md:flex p-1 rounded hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          {onCloseMobile && (
            <button
              id="sidebar-mobile-close-btn"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] cursor-pointer"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-1.5">
          {isAdmin ? (
            <button
              id="sidebar-btn-add-item"
              onClick={() => handleAction(onOpenAddItem)}
              className="w-full flex items-center justify-center space-x-2 py-2 md:py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg md:rounded-md font-medium text-xs shadow-xs transition-all cursor-pointer min-h-[38px] md:min-h-0"
              title="Add New Inventory Item (Ctrl+N)"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {(!isCollapsed || isOpenMobile) && <span>New Item</span>}
            </button>
          ) : (
            <button
              id="sidebar-btn-add-item-disabled"
              disabled
              className="w-full flex items-center justify-center space-x-2 py-2 md:py-1.5 px-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg md:rounded-md font-medium text-xs border border-black/[0.05] dark:border-white/[0.05] cursor-not-allowed min-h-[38px] md:min-h-0"
              title="Admin account required to add inventory items"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {(!isCollapsed || isOpenMobile) && <span>New Item (Admin)</span>}
            </button>
          )}

          <button
            id="sidebar-btn-scan-barcode"
            onClick={() => handleAction(onOpenScanner)}
            className="w-full flex items-center justify-center space-x-2 py-2 md:py-1.5 px-2.5 bg-black/[0.05] dark:bg-white/[0.06] hover:bg-black/[0.09] dark:hover:bg-white/[0.1] active:scale-[0.99] text-slate-800 dark:text-slate-200 rounded-lg md:rounded-md font-medium text-xs border border-black/[0.06] dark:border-white/[0.06] transition-all cursor-pointer min-h-[38px] md:min-h-0"
            title="Scan Barcode / QR Code"
          >
            <ScanLine className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            {(!isCollapsed || isOpenMobile) && <span>Quick Scanner</span>}
          </button>
        </div>
      </div>

      {/* Middle Scrollable Navigation List */}
      <nav className="flex-1 overflow-y-auto min-h-0 px-2 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const showLabel = !isCollapsed || isOpenMobile;

          return (
            <button
              key={item.id}
              id={`sidebar-nav-${item.id}`}
              onClick={() => {
                if ((item as any).isSettingsTrigger) {
                  handleAction(onOpenSettings);
                } else if ((item as any).isPOSTrigger) {
                  if (onOpenPOSRegister) {
                    handleAction(onOpenPOSRegister);
                  } else {
                    handleAction(() => onSelectTab('receipts'));
                  }
                } else {
                  handleAction(() => onSelectTab(item.id));
                }
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2.5 md:py-2 rounded-lg md:rounded-md text-xs font-normal transition-colors relative cursor-pointer min-h-[40px] md:min-h-0 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200/60 dark:border-blue-900/60'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
              }`}
              title={item.label}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 dark:bg-blue-400 rounded-r" />
              )}

              <div className="flex items-center space-x-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                {showLabel && <span className="truncate">{item.label}</span>}
              </div>

              {showLabel && (
                <div className="flex items-center space-x-1 shrink-0 ml-1">
                  {item.alertBadge ? (
                    <span className="flex items-center space-x-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold rounded-full border border-amber-500/30">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      <span>{item.alertBadge}</span>
                    </span>
                  ) : (item as any).isLiveBadge ? (
                    <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold rounded-full border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>LIVE</span>
                    </span>
                  ) : item.badge !== null ? (
                    <span className="px-1.5 py-0.5 bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400 text-[10px] font-mono rounded">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section: Profile, Theme, Settings */}
      <div className="p-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1.5 shrink-0 bg-[#f9f9f9]/90 dark:bg-[#1a1a1a]/90">
        {/* User Account / Sign Out Block */}
        {currentUser && (
          <div
            className={`rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05] p-2 md:p-1.5 flex items-center ${
              isCollapsed && !isOpenMobile ? 'justify-center' : 'justify-between'
            }`}
          >
            <div
              className="flex items-center space-x-2 truncate cursor-pointer flex-1 min-w-0"
              onClick={() => handleAction(() => onSelectTab('team'))}
              title={`Active Profile: ${currentUser.name} (${currentUser.role}). Click to view team settings.`}
            >
              <div
                className={`w-7 h-7 md:w-6 md:h-6 rounded-full flex items-center justify-center font-bold text-xs md:text-[10px] text-white shrink-0 shadow-xs ${
                  currentUser.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'
                }`}
              >
                {currentUser.name.charAt(0)}
              </div>
              {(!isCollapsed || isOpenMobile) && (
                <div className="truncate text-left min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {currentUser.role === 'admin' ? 'Administrator' : 'Sales Manager'}
                  </div>
                </div>
              )}
            </div>

            {(!isCollapsed || isOpenMobile) && (
              <div className="flex items-center space-x-1 shrink-0 ml-1">
                {onOpenChangePassword && (
                  <button
                    id="sidebar-btn-change-password"
                    onClick={() => handleAction(onOpenChangePassword)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                    title={currentUser.role === 'admin' ? 'Change Admin Password / PIN' : 'Change Password / PIN'}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                )}

                {onSignOut && (
                  <button
                    id="sidebar-btn-signout"
                    onClick={() => handleAction(onSignOut)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Sign Out / Lock Session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            id="sidebar-btn-theme"
            onClick={onToggleTheme}
            className="w-full flex items-center space-x-2.5 px-2.5 py-2 md:py-1.5 rounded-lg md:rounded-md text-xs text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={settings?.theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {settings?.theme === 'dark' ? (
              <Sun className="w-4 h-4 shrink-0 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
            )}
            {(!isCollapsed || isOpenMobile) && (
              <span>{settings?.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            )}
          </button>
        )}

        {/* Dev button */}
        <button
          id="sidebar-btn-settings"
          onClick={() => handleAction(onOpenSettings)}
          className="w-full flex items-center space-x-2.5 px-2.5 py-2 md:py-1.5 rounded-lg md:rounded-md text-xs text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Dev (Cloud Password Protected)"
        >
          <Lock className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400" />
          {(!isCollapsed || isOpenMobile) && <span>Dev</span>}
        </button>

        {/* Status indicator */}
        {(!isCollapsed || isOpenMobile) && (
          <div className="px-2.5 py-1 rounded bg-black/[0.02] dark:bg-white/[0.02] text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Session Secure</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">RBAC Active</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop & Tablet Static Dock Sidebar (Screens >= 768px / md:) */}
      <aside
        id="app-navigation-sidebar"
        className={`hidden md:flex h-[calc(100vh-2.5rem)] bg-[#f9f9f9]/85 dark:bg-[#1a1a1a]/85 border-r border-black/[0.08] dark:border-white/[0.08] flex-col justify-between transition-all duration-200 ease-in-out select-none fluent-acrylic z-30 shrink-0 ${
          isCollapsed ? 'w-14' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile Backdrop Overlay & Drawer (Screens < 768px / md:) */}
      {isOpenMobile && (
        <div
          id="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in transition-opacity"
        />
      )}

      <aside
        id="app-navigation-sidebar-mobile"
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-full bg-[#fbfbfb] dark:bg-[#1c1c1c] border-r border-black/[0.1] dark:border-white/[0.1] shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out select-none md:hidden ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
};
