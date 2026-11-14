import React, { useState, useMemo } from 'react';
import {
  Users,
  Shield,
  Briefcase,
  Trash2,
  Edit2,
  CheckCircle2,
  Lock,
  KeyRound,
  Mail,
  Phone,
  AlertCircle,
  LogOut,
  AlertTriangle,
  Search,
  Check,
  UserPlus,
  Eye,
  EyeOff,
  Key,
  Building2,
} from 'lucide-react';
import { AppUser, UserRole } from '../types';
import { PinPromptModal } from './PinPromptModal';

interface TeamManagementViewProps {
  users: AppUser[];
  currentUser: AppUser;
  onSwitchUser: (user: AppUser) => void;
  onAddUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => void;
  onEditUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onSignOut?: () => void;
}

export const TeamManagementView: React.FC<TeamManagementViewProps> = ({
  users,
  currentUser,
  onSwitchUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
  onSignOut,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  // Quick Password Change Modal for Admin
  const [passwordModalUser, setPasswordModalUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'supervisor' | 'sales_manager'>('all');

  // PIN Prompt Modal State for Admin Account Switching
  const [pinPromptTarget, setPinPromptTarget] = useState<AppUser | null>(null);

  // Inline Feedback Toast Message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State for Add / Edit
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [role, setRole] = useState<UserRole>('supervisor');
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);

  const handleRequestSwitchUser = (targetUser: AppUser) => {
    if (targetUser.id === currentUser.id) return;

    if (targetUser.status === 'inactive') {
      setFeedback({
        type: 'error',
        message: `Cannot switch to ${targetUser.name}: This account is inactive.`,
      });
      return;
    }

    // If target user is an admin (or has a pin configured), require security PIN verification
    if (targetUser.role === 'admin' || (targetUser.pin && targetUser.pin.trim() !== '')) {
      setPinPromptTarget(targetUser);
    } else {
      // Non-admin with no PIN can switch directly
      onSwitchUser(targetUser);
      setFeedback({
        type: 'success',
        message: `Switched active session to ${targetUser.name} (Sales Manager).`,
      });
    }
  };

  const openAddModal = () => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Admin privileges are required to create staff accounts.' });
      return;
    }
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('');
    setLocation('Branch Station');
    setRole('supervisor');
    setPin('');
    setStatus('active');
    setFormError(null);
    setShowFormPassword(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (user: AppUser) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Admin privileges are required to modify staff profiles.' });
      return;
    }
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone || '');
    setLocation(user.location || '');
    setRole(user.role);
    setPin(user.pin || '');
    setStatus(user.status);
    setFormError(null);
    setShowFormPassword(false);
    setIsAddModalOpen(true);
  };

  const openPasswordModal = (user: AppUser) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Only Administrators have authority to set user passwords.' });
      return;
    }
    setPasswordModalUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowPasswordInModal(false);
  };

  const handleSaveUserPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser) return;
    setPasswordError(null);

    const cleanPass = newPassword.trim();
    if (!cleanPass) {
      setPasswordError('Please enter a new password or security PIN.');
      return;
    }
    if (cleanPass.length < 4) {
      setPasswordError('Password or PIN must be at least 4 characters long.');
      return;
    }
    if (cleanPass !== confirmPassword.trim()) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    onEditUser({
      ...passwordModalUser,
      pin: cleanPass,
    });

    setFeedback({
      type: 'success',
      message: `Password for "${passwordModalUser.name}" has been updated successfully.`,
    });
    setPasswordModalUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleOpenDeleteModal = (user: AppUser) => {
    if (!isAdmin) {
      setFeedback({ type: 'error', message: 'Only Administrators have authority to remove staff members.' });
      return;
    }

    // Check if this is the sole admin in the system
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      setFeedback({
        type: 'error',
        message: 'Cannot delete the only remaining Administrator. Please assign another Admin first.',
      });
      return;
    }

    setDeleteTarget(user);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const targetName = deleteTarget.name;
    onDeleteUser(deleteTarget.id);
    setDeleteTarget(null);
    setFeedback({
      type: 'success',
      message: `Staff member "${targetName}" was successfully removed.`,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isAdmin) {
      setFormError('Only administrators have permission to add or modify staff members.');
      return;
    }

    if (!name.trim() || !email.trim()) {
      setFormError('Please provide a valid Name and Email address.');
      return;
    }

    if (pin.trim() && pin.trim().length < 4) {
      setFormError('Password or Security PIN must be at least 4 characters long.');
      return;
    }

    if (role === 'admin' && !pin.trim() && !editingUser?.pin) {
      setFormError('Administrator accounts require a password or security PIN (minimum 4 characters).');
      return;
    }

    if (editingUser) {
      onEditUser({
        ...editingUser,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        role,
        pin: pin.trim() || editingUser.pin || undefined,
        status,
      });
      setFeedback({ type: 'success', message: `Staff profile for "${name.trim()}" updated successfully.` });
    } else {
      onAddUser({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        role,
        pin: pin.trim() || undefined,
        status,
      });
      const roleTitle = role === 'admin' ? 'Administrator' : role === 'supervisor' ? 'Supervisor' : 'Sales Rep';
      setFeedback({ type: 'success', message: `New ${roleTitle} "${name.trim()}" created successfully.` });
    }

    setIsAddModalOpen(false);
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.phone && u.phone.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole = roleFilter === 'all' || u.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, roleFilter]);

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const supervisorCount = users.filter((u) => u.role === 'supervisor').length;
  const salesRepCount = users.filter((u) => u.role === 'sales_manager').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#f7f7f8] dark:bg-[#1e1e1e] p-3 sm:p-5 lg:p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Top Banner Alert Feedback */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-fade-in shadow-xs ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs px-2 py-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer font-bold shrink-0 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header & Primary Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Team & Role-Based Access Control (RBAC)
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure system permissions, register supervisor accounts with branch locations, and switch active profiles.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin ? (
              <button
                id="team-btn-add-staff"
                onClick={openAddModal}
                className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                <span>Add Staff / Supervisor</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium">
                <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>Admin Privileges Required to Modify Staff</span>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3.5">
          <div className="bg-white dark:bg-[#252525] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Staff</div>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{users.length}</div>
          </div>
          <div className="bg-white dark:bg-[#252525] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Administrators</div>
            <div className="text-xl sm:text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">{adminCount}</div>
          </div>
          <div className="bg-white dark:bg-[#252525] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Supervisors</div>
            <div className="text-xl sm:text-2xl font-bold text-sky-700 dark:text-sky-300 mt-1">{supervisorCount}</div>
          </div>
          <div className="bg-white dark:bg-[#252525] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Sales Managers</div>
            <div className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{salesRepCount}</div>
          </div>
          <div className="bg-white dark:bg-[#252525] p-3.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] shadow-xs">
            <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Active Status</div>
            <div className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{activeCount}</div>
          </div>
        </div>

        {/* Active User Switcher Bar */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold flex items-center justify-center text-sm shadow-xs">
                {currentUser.name.charAt(0)}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#252525] ${
                  currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'supervisor' ? 'bg-sky-600' : 'bg-blue-600'
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    currentUser.role === 'admin'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                      : currentUser.role === 'supervisor'
                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {currentUser.role === 'admin' ? 'Administrator' : currentUser.role === 'supervisor' ? 'Supervisor' : 'Sales Manager'}
                </span>
                {currentUser.location && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium flex items-center space-x-1">
                    <Building2 className="w-2.5 h-2.5" />
                    <span>{currentUser.location}</span>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                Active Session: {currentUser.email} {currentUser.phone ? `• ${currentUser.phone}` : ''}
              </div>
            </div>
          </div>

          {/* Quick Switch Button Strip */}
          <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] text-slate-500 mr-1 hidden sm:inline shrink-0 font-medium">Switch To:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {users.map((u) => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleRequestSwitchUser(u)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#333] dark:hover:bg-[#444] text-slate-700 dark:text-slate-200 border border-black/[0.06] dark:border-white/[0.06]'
                    }`}
                  >
                    {u.role === 'admin' ? (
                      <Shield className="w-3 h-3 text-purple-400" />
                    ) : u.role === 'supervisor' ? (
                      <Eye className="w-3 h-3 text-sky-400" />
                    ) : (
                      <Briefcase className="w-3 h-3 text-blue-400" />
                    )}
                    <span>{u.name.split(' ')[0]}</span>
                    {isCurrent && <span className="text-[9px] opacity-80 font-bold">(Active)</span>}
                  </button>
                );
              })}

              {onSignOut && (
                <button
                  id="team-btn-signout"
                  onClick={onSignOut}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Sign out of current account and lock terminal"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Staff Directory Main Card */}
        <div className="bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
          {/* Controls Toolbar (Search & Filters) */}
          <div className="p-3.5 sm:p-4 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <h2 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                Staff Directory ({filteredUsers.length} of {users.length})
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Search Bar */}
              <div className="relative flex-1 sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search staff name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#1a1a1a] border border-black/[0.08] dark:border-white/[0.08] rounded-lg outline-none focus:border-blue-500"
                />
              </div>

              {/* Role Filter Tabs */}
              <div className="flex items-center space-x-1 bg-black/[0.04] dark:bg-white/[0.04] p-0.5 rounded-lg text-xs self-start sm:self-auto">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'all'
                      ? 'bg-white dark:bg-[#333] text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRoleFilter('admin')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'admin'
                      ? 'bg-white dark:bg-[#333] text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Admins
                </button>
                <button
                  onClick={() => setRoleFilter('supervisor')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'supervisor'
                      ? 'bg-white dark:bg-[#333] text-sky-700 dark:text-sky-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Supervisors
                </button>
                <button
                  onClick={() => setRoleFilter('sales_manager')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    roleFilter === 'sales_manager'
                      ? 'bg-white dark:bg-[#333] text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Sales Reps
                </button>
              </div>
            </div>
          </div>

          {/* 1. Desktop Tabular View (Large screens >= 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[760px]">
              <thead className="bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-black/[0.08] dark:border-white/[0.08] font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-3.5">Staff Member</th>
                  <th className="p-3.5">System Role</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5">Security PIN</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {filteredUsers.map((user) => {
                  const isUserAdmin = user.role === 'admin';
                  const isSupervisor = user.role === 'supervisor';
                  const isCurrent = user.id === currentUser.id;

                  return (
                    <tr
                      key={user.id}
                      className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors ${
                        isCurrent ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 ${
                              isUserAdmin ? 'bg-purple-600' : isSupervisor ? 'bg-sky-600' : 'bg-blue-600'
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{user.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full font-medium">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 text-[10px] text-slate-400">
                              <span>{user.email}</span>
                              {user.location && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-500 dark:text-slate-400 flex items-center space-x-0.5 font-medium">
                                    <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                    <span>{user.location}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
                            isUserAdmin
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : isSupervisor
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          }`}
                        >
                          {isUserAdmin ? <Shield className="w-3.5 h-3.5" /> : isSupervisor ? <Eye className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                          <span>{isUserAdmin ? 'Administrator' : isSupervisor ? 'Supervisor' : 'Sales Manager'}</span>
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-600 dark:text-slate-300 text-xs">
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center space-x-1 text-[11px] text-slate-500 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-mono text-slate-500">
                        {user.pin ? (
                          <span className="flex items-center space-x-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            <KeyRound className="w-3 h-3 text-amber-500" />
                            <span>PIN Protected</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">None</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            user.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {!isCurrent && (
                            <button
                              onClick={() => handleRequestSwitchUser(user)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[11px] font-medium transition-colors cursor-pointer mr-1"
                              title="Log in as this user"
                            >
                              Switch
                            </button>
                          )}

                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => openPasswordModal(user)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                                title="Set / Reset User Password or Security PIN"
                              >
                                <Key className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => openEditModal(user)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                                title="Edit staff profile"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                id={`delete-user-btn-${user.id}`}
                                onClick={() => handleOpenDeleteModal(user)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                title="Delete staff account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span title="Admin Only" className="text-slate-300 dark:text-slate-600 p-1">
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 2. Responsive Mobile & Tablet Cards View (Screens < 1024px) */}
          <div className="block lg:hidden p-3 space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No staff members found matching your search.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isUserAdmin = user.role === 'admin';
                const isSupervisor = user.role === 'supervisor';
                const isCurrent = user.id === currentUser.id;

                return (
                  <div
                    key={user.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-blue-50/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 shadow-xs'
                        : 'bg-white dark:bg-[#202020] border-black/[0.08] dark:border-white/[0.08]'
                    }`}
                  >
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 ${
                            isUserAdmin ? 'bg-purple-600' : isSupervisor ? 'bg-sky-600' : 'bg-blue-600'
                          }`}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{user.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-full font-semibold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{user.email}</div>
                          {user.location && (
                            <div className="flex items-center space-x-1 text-[11px] text-sky-700 dark:text-sky-300 font-medium mt-0.5">
                              <Building2 className="w-3 h-3 text-sky-500 shrink-0" />
                              <span>{user.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          isUserAdmin
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                            : isSupervisor
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        {isUserAdmin ? <Shield className="w-3 h-3" /> : isSupervisor ? <Eye className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                        <span>{isUserAdmin ? 'Admin' : isSupervisor ? 'Supervisor' : 'Sales Rep'}</span>
                      </span>
                    </div>

                    {/* Contact & Status Details */}
                    <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-black/[0.05] dark:border-white/[0.05] flex-wrap gap-2">
                      <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-300">
                        {user.phone ? (
                          <a
                            href={`tel:${user.phone}`}
                            className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>{user.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">No phone</span>
                        )}

                        {user.pin && (
                          <span className="flex items-center space-x-1 text-amber-600 dark:text-amber-400">
                            <KeyRound className="w-3 h-3 shrink-0" />
                            <span>PIN Set</span>
                          </span>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          user.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Action Controls Row */}
                    <div className="mt-3 pt-2.5 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                      {!isCurrent ? (
                        <button
                          onClick={() => handleRequestSwitchUser(user)}
                          className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold text-center cursor-pointer transition-colors"
                        >
                          Switch To Account
                        </button>
                      ) : (
                        <div className="flex-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center space-x-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Currently Active</span>
                        </div>
                      )}

                      {isAdmin && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openPasswordModal(user)}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center space-x-1"
                            title="Set / Reset Password or PIN"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>PIN</span>
                          </button>

                          <button
                            onClick={() => openEditModal(user)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center space-x-1"
                            title="Edit staff details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          <button
                            id={`mobile-delete-user-btn-${user.id}`}
                            onClick={() => handleOpenDeleteModal(user)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center space-x-1"
                            title="Delete staff account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. In-App Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center space-x-3 bg-rose-50/70 dark:bg-rose-950/30">
              <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-rose-900 dark:text-rose-200">
                  Delete Staff Account
                </h3>
                <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                  Confirm permanent removal of team member
                </p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                  <span>{deleteTarget.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      deleteTarget.role === 'admin'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {deleteTarget.role === 'admin' ? 'Administrator' : 'Sales Manager'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{deleteTarget.email}</div>
                {deleteTarget.phone && <div className="text-[11px] text-slate-500">{deleteTarget.phone}</div>}
              </div>

              <p className="leading-relaxed">
                Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">{deleteTarget.name}</strong>? 
                Their recorded inventory operations and POS receipts will remain safely in the audit ledger, but their login credentials will be revoked.
              </p>

              {deleteTarget.id === currentUser.id && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 font-medium">
                  ⚠️ Note: You are deleting your currently active account. You will be automatically switched to the primary administrator upon deletion.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-user"
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Staff Member</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Add / Edit Staff Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {editingUser ? 'Edit Staff Member' : 'Add New Sales Manager / Staff'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Role-Based Access Control configuration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sandra Mensah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="+234 803 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Password / Security PIN {role === 'admin' ? <span className="text-rose-500 font-normal text-[11px]">(Required, min 4 chars)</span> : <span className="text-slate-400 font-normal text-[11px]">(Optional, min 4 chars)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showFormPassword ? 'text' : 'password'}
                      maxLength={64}
                      placeholder={role === 'admin' ? 'Set Admin Password / PIN' : 'Set User Password / PIN'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 pr-9 font-mono outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword(!showFormPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    System Role & Authority <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none cursor-pointer"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Assigned Location / Branch
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lagos Island Hub, Ikeja Branch"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Account Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 outline-none cursor-pointer"
                >
                  <option value="active">Active (Permitted to sign in & operate)</option>
                  <option value="inactive">Inactive (Suspended account)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  {editingUser ? 'Save Staff Changes' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Dedicated Quick Set Password / PIN Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-amber-50/70 dark:bg-amber-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100">
                    Set User Password / PIN
                  </h3>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                    Administrator Security Credential Management
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPasswordModalUser(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserPassword} className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                  {passwordModalUser.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {passwordModalUser.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {passwordModalUser.email} • {passwordModalUser.role === 'admin' ? 'Admin' : 'Sales Rep'}
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-medium flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  New Password / PIN <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPasswordInModal ? 'text' : 'password'}
                    required
                    maxLength={64}
                    placeholder="Enter new password or PIN (min 4 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 pr-9 font-mono outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPasswordInModal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Confirm Password / PIN <span className="text-rose-500">*</span>
                </label>
                <input
                  type={showPasswordInModal ? 'text' : 'password'}
                  required
                  maxLength={64}
                  placeholder="Re-enter password to confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-3 py-2 font-mono outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Security PIN Verification Modal for Switching to Administrator */}
      <PinPromptModal
        isOpen={Boolean(pinPromptTarget)}
        targetUser={pinPromptTarget}
        onClose={() => setPinPromptTarget(null)}
        onSuccess={(authenticatedUser) => {
          onSwitchUser(authenticatedUser);
          setFeedback({
            type: 'success',
            message: `Admin authentication successful. Switched to ${authenticatedUser.name}.`,
          });
        }}
      />
    </div>
  );
};
