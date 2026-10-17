import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Shield,
  Lock,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import { AppUser } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: AppUser | null;
  currentUser: AppUser | null;
  onSavePassword: (userId: string, newPass: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  onSavePassword,
}) => {
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !targetUser) return null;

  const isSelf = currentUser?.id === targetUser.id;
  const isSuperAdmin = currentUser?.role === 'admin';
  const hasExistingPin = Boolean(targetUser.pin && targetUser.pin.trim() !== '');

  // Calculate simple password strength
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'None', color: 'bg-slate-200 dark:bg-slate-700', score: 0 };
    if (pass.length < 4) return { label: 'Too Short', color: 'bg-rose-500', score: 1 };
    let score = 1;
    if (pass.length >= 6) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { label: 'Basic (min 4)', color: 'bg-amber-500', score: 2 };
    if (score === 3) return { label: 'Good', color: 'bg-blue-500', score: 3 };
    return { label: 'Strong', color: 'bg-emerald-500', score: 4 };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If changing own password and had existing password, verify current password
    if (isSelf && hasExistingPin) {
      if (!currentPasswordInput) {
        setErrorMessage('Please enter your current password / PIN.');
        return;
      }
      if (currentPasswordInput.trim() !== targetUser.pin?.trim()) {
        setErrorMessage('Current password does not match. Please verify and try again.');
        return;
      }
    }

    const cleanNewPass = newPassword.trim();
    if (!cleanNewPass) {
      setErrorMessage('Please enter a new password or security PIN.');
      return;
    }

    if (cleanNewPass.length < 4) {
      setErrorMessage('Password must be at least 4 characters long.');
      return;
    }

    if (cleanNewPass !== confirmPassword.trim()) {
      setErrorMessage('Passwords do not match. Please re-type to confirm.');
      return;
    }

    onSavePassword(targetUser.id, cleanNewPass);
    setIsSuccess(true);

    setTimeout(() => {
      setIsSuccess(false);
      handleClose();
    }, 1400);
  };

  const handleClose = () => {
    setCurrentPasswordInput('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMessage(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-white dark:bg-[#202020] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <span>{isSelf ? 'Change Admin Password / PIN' : `Set Password for ${targetUser.name}`}</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {targetUser.role === 'admin' ? 'Master Administrator Security Credentials' : 'Staff Security Authentication'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3 animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Password Updated Successfully!
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The new security password / PIN is now active for {targetUser.name}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
            {/* Target User Info Badge */}
            <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06]">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0">
                {targetUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {targetUser.name}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 truncate">
                  <span>{targetUser.email}</span>
                  <span>•</span>
                  <span className="capitalize font-medium text-purple-600 dark:text-purple-400">
                    {targetUser.role === 'admin' ? 'Administrator' : 'Sales Manager'}
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Active
              </span>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-tight">{errorMessage}</span>
              </div>
            )}

            {/* Current Password Field (when changing own password and has existing pin) */}
            {isSelf && hasExistingPin && (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password / PIN <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter current password or PIN"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 pr-10 outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-[#252525] transition-all font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* New Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  New Password / PIN <span className="text-rose-500">*</span>
                </label>
                {newPassword && (
                  <span className="text-[10px] font-medium text-slate-400">
                    Strength: <strong className="text-slate-700 dark:text-slate-200">{strength.label}</strong>
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password or PIN (min 4 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 pr-10 outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-[#252525] transition-all font-mono"
                  autoFocus={!isSelf || !hasExistingPin}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password strength bar */}
              {newPassword && (
                <div className="grid grid-cols-4 gap-1 mt-1.5">
                  <div className={`h-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`h-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`h-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`h-1 rounded-full ${strength.score >= 4 ? strength.color : 'bg-slate-200 dark:bg-slate-700'}`} />
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">
                Can be numeric PIN (e.g. 123456) or alphanumeric password (e.g. Admin2026!).
              </p>
            </div>

            {/* Confirm New Password Input */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter password to confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 pr-10 outline-none focus:border-purple-500 focus:bg-white dark:focus:bg-[#252525] transition-all font-mono"
                />
                {confirmPassword && newPassword === confirmPassword && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Save New Password</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
