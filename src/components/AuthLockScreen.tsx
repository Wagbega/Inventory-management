import React, { useState } from 'react';
import {
  Boxes,
  Shield,
  Briefcase,
  Lock,
  KeyRound,
  LogIn,
  Eye,
  EyeOff,
  UserCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Clock,
  Laptop,
} from 'lucide-react';
import { AppUser, AppSettings } from '../types';

interface AuthLockScreenProps {
  users: AppUser[];
  settings: AppSettings;
  onSignIn: (user: AppUser) => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({
  users,
  settings,
  onSignIn,
}) => {
  // Active users only for sign-in
  const activeUsers = users.filter((u) => u.status === 'active');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    activeUsers[0]?.id || users[0]?.id || ''
  );
  const [enteredPin, setEnteredPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [isManualMode, setIsManualMode] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);

  const handleUserSelect = (user: AppUser) => {
    setSelectedUserId(user.id);
    setEnteredPin('');
    setErrorMessage(null);
  };

  const handleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    let targetUser: AppUser | undefined;

    if (isManualMode) {
      if (!manualEmail.trim()) {
        setErrorMessage('Please enter your staff email address.');
        return;
      }
      targetUser = users.find(
        (u) => u.email.toLowerCase() === manualEmail.trim().toLowerCase()
      );
      if (!targetUser) {
        setErrorMessage('No staff account found with this email address.');
        return;
      }
    } else {
      targetUser = selectedUser;
    }

    if (!targetUser) {
      setErrorMessage('Please select a user account to sign in.');
      return;
    }

    if (targetUser.status === 'inactive') {
      setErrorMessage('This account is inactive. Please contact an administrator.');
      return;
    }

    // Verify Password / PIN: required if account has a PIN/password configured
    if (targetUser.pin && targetUser.pin.trim() !== '') {
      const requiredPass = targetUser.pin.trim();
      if (!enteredPin.trim()) {
        setErrorMessage(
          targetUser.role === 'admin'
            ? 'Please enter the Administrator password / PIN.'
            : 'Please enter your password / security PIN.'
        );
        return;
      }
      if (enteredPin.trim() !== requiredPass) {
        setErrorMessage('Incorrect password or PIN. Please verify and try again.');
        return;
      }
    }

    // Successful login
    onSignIn(targetUser);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 text-slate-100 p-4 select-none overflow-y-auto">
      {/* Subtle Windows Desktop Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#10192e] to-slate-900 pointer-events-none" />
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

      {/* Top Bar / App Brand Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Boxes className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-200 tracking-tight">
            {settings.companyName}
          </span>
          <span className="text-slate-500">• {settings.warehouseName}</span>
        </div>

        <div className="flex items-center space-x-2 text-[11px] bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60 backdrop-blur-xs">
          <Laptop className="w-3.5 h-3.5 text-blue-400" />
          <span>Windows Station Secure Terminal</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800/80 shadow-2xl rounded-2xl p-6 sm:p-8 backdrop-blur-md flex flex-col space-y-6 my-auto">
        {/* Header Icon & Title */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 mb-1">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Staff Sign In & Terminal Lock
          </h1>
          <p className="text-xs text-slate-400">
            Sign in as an Administrator or Sales Manager to access inventory, sales, and ledger tools.
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg text-xs animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* User Selection Cards / Tiles */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
            Select User Account
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {users.map((u) => {
              const isSelected = !isManualMode && u.id === selectedUserId;
              const isAdmin = u.role === 'admin';

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setIsManualMode(false);
                    handleUserSelect(u);
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                      : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white ${
                        isAdmin ? 'bg-purple-600' : 'bg-blue-600'
                      }`}
                    >
                      {u.name.charAt(0)}
                    </div>
                    {isSelected && (
                      <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-xs text-white truncate">
                      {u.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mb-1">
                      {u.email.split('@')[0]}
                    </div>
                    <span
                      className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isAdmin
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      {isAdmin ? (
                        <Shield className="w-2.5 h-2.5" />
                      ) : (
                        <Briefcase className="w-2.5 h-2.5" />
                      )}
                      <span>{isAdmin ? 'Admin' : 'Sales'}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN / Password Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          {selectedUser && (
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${
                    selectedUser.role === 'admin' ? 'bg-purple-600' : 'bg-blue-600'
                  }`}
                >
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    {selectedUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {selectedUser.role === 'admin'
                      ? 'Administrator (Full Master Access)'
                      : 'Sales Manager (POS Sales & Catalog)'}
                  </div>
                </div>
              </div>

              {selectedUser.pin && (
                <div className="text-[10px] bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded font-mono">
                  PIN Protected
                </div>
              )}
            </div>
          )}

          {/* Security Password / PIN Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                <span>Password / Security PIN</span>
              </label>
              {selectedUser?.pin ? (
                <span className="text-[10px] text-slate-400 font-mono">
                  Authentication Required
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">
                  No password required
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="login-input-pin"
                type={showPin ? 'text' : 'password'}
                maxLength={64}
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value)}
                placeholder={
                  selectedUser?.pin
                    ? selectedUser.role === 'admin'
                      ? 'Enter Administrator password or PIN'
                      : 'Enter staff password or PIN'
                    : 'Click Sign In to continue'
                }
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 font-mono outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="login-btn-submit"
              type="submit"
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>
                Sign In as {selectedUser ? selectedUser.name.split(' ')[0] : 'Staff'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-800 text-center text-[11px] text-slate-500">
          Role-Based Access Control • Local Station Session Security
        </div>
      </div>
    </div>
  );
};
