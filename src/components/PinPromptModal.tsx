import React, { useState, useEffect, useRef } from 'react';
import { Shield, KeyRound, AlertCircle, X, Check, Lock } from 'lucide-react';
import { AppUser } from '../types';

interface PinPromptModalProps {
  isOpen: boolean;
  targetUser: AppUser | null;
  onClose: () => void;
  onSuccess: (user: AppUser) => void;
  onPlaySound?: () => void;
  onPlayError?: () => void;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  targetUser,
  onClose,
  onSuccess,
  onPlaySound,
  onPlayError,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, targetUser]);

  if (!isOpen || !targetUser) return null;

  const requiredPin = targetUser.pin || '123456';
  const isAdmin = targetUser.role === 'admin';

  const handleKeyClick = (digit: string) => {
    setPin((prev) => prev + digit);
    setError(null);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const enteredClean = pin.trim();

    if (!enteredClean) {
      setError('Please enter the Administrator password / security PIN.');
      if (onPlayError) onPlayError();
      return;
    }

    if (enteredClean !== requiredPin.trim()) {
      setError('Incorrect password / PIN. Admin privileges denied.');
      setPin('');
      if (onPlayError) onPlayError();
      inputRef.current?.focus();
      return;
    }

    // Success
    if (onPlaySound) onPlaySound();
    onSuccess(targetUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-white dark:bg-[#202020] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-purple-50/70 dark:bg-purple-950/30">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-purple-950 dark:text-purple-100">
                Admin Authentication Required
              </h3>
              <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                Security password verification for Administrator access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Target Profile Summary */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
              {targetUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                {targetUser.name}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{targetUser.email}</div>
              <div className="mt-0.5 inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <Lock className="w-2.5 h-2.5" />
                <span>Password Protected</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 rounded-lg text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Password / PIN Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <KeyRound className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Enter Admin Password / Security PIN</span>
              </span>
            </label>

            <div className="relative">
              <input
                ref={inputRef}
                id="modal-admin-pin-input"
                type="password"
                maxLength={64}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="Enter password or PIN"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-black/[0.1] dark:border-white/[0.1] rounded-xl px-4 py-2.5 text-center text-base tracking-widest font-mono outline-none focus:border-purple-500 dark:focus:border-purple-400"
              />
            </div>
          </div>

          {/* Touch Number Pad for Tablet & Mobile Convenience */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyClick(digit)}
                className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold transition-colors cursor-pointer active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-semibold transition-colors cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyClick('0')}
              className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold transition-colors cursor-pointer active:scale-95"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 text-xs font-semibold transition-colors cursor-pointer"
            >
              ⌫
            </button>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-admin-pin"
              type="submit"
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Authenticate & Switch</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
