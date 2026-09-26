import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  X as CloseIcon, 
  KeyRound, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  ShieldAlert, 
  Lock,
  User,
  Calendar,
  Sliders,
  Clock
} from 'lucide-react';
import { PollingSettingsSection } from './PollingSettingsSection';

export interface UserItem {
  id: number | string;
  username: string;
  role: string;
  created_at: string;
}

interface ManageUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername: string;
  currentUserId?: string | number;
  initialTab?: 'users' | 'polling';
  authStatus?: 'checking' | 'authenticated' | 'unauthenticated';
}

export const ManageUsersModal: React.FC<ManageUsersModalProps> = ({
  isOpen,
  onClose,
  currentUsername,
  currentUserId,
  initialTab = 'users',
  authStatus: propAuthStatus,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'polling'>(initialTab);
  const [modalAuthStatus, setModalAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    propAuthStatus || 'checking'
  );
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New user form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/users', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      } else if (res.status === 401) {
        setModalAuthStatus('unauthenticated');
        setError('Admin authentication required. Please log in.');
      } else {
        setError(data.message || 'Failed to fetch user list.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with user service.');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAuthAndFetchUsers = useCallback(async () => {
    setModalAuthStatus('checking');
    setError(null);
    try {
      const authRes = await fetch('/api/auth/me', { credentials: 'include' });
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) {
        setModalAuthStatus('unauthenticated');
        setError('Admin authentication required. Please log in.');
        return;
      }
      setModalAuthStatus('authenticated');
      setError(null);
      await fetchUsers();
    } catch {
      setModalAuthStatus('unauthenticated');
      setError('Admin authentication required. Please log in.');
    }
  }, [fetchUsers]);

  useEffect(() => {
    if (isOpen) {
      checkAuthAndFetchUsers();
      setNewUsername('');
      setNewPassword('');
      setError(null);
      setSuccessMsg(null);
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, checkAuthAndFetchUsers, initialTab]);

  useEffect(() => {
    if (propAuthStatus) {
      setModalAuthStatus(propAuthStatus);
    }
  }, [propAuthStatus]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim();
    if (!cleanUser) {
      setError('Username cannot be empty.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password: newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`User "${cleanUser}" registered successfully!`);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        setError(data.message || 'Failed to create user.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (
      user.username.toLowerCase() === currentUsername.toLowerCase() ||
      (currentUserId && String(user.id) === String(currentUserId))
    ) {
      setError('You cannot delete your own currently logged-in account.');
      return;
    }

    const confirm = window.confirm(`Are you sure you want to delete user "${user.username}"?`);
    if (!confirm) return;

    setDeletingId(user.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/auth/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(`User "${user.username}" removed successfully.`);
        fetchUsers();
      } else {
        setError(data.message || 'Failed to delete user.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error deleting user.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-base-100 rounded-2xl shadow-2xl border border-base-content/10 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-base-content/10 bg-base-200/50 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              {activeTab === 'users' ? <Users className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-base-content flex items-center gap-2">
                <span>{activeTab === 'users' ? 'Manage NOC Users' : 'SNMP Polling Settings'}</span>
                {activeTab === 'users' && (
                  <span className="badge badge-sm badge-primary badge-outline font-mono">
                    {users.length} {users.length === 1 ? 'user' : 'users'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-base-content/60">
                {activeTab === 'users'
                  ? 'Control operator credentials, database-backed authentication, and access roles.'
                  : 'Configure background SNMP sweep cadence and scheduler presets in real-time.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-base-300/60 p-1 rounded-xl border border-base-content/10">
              <button
                type="button"
                onClick={() => { setActiveTab('users'); setError(null); setSuccessMsg(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'users'
                    ? 'bg-base-100 text-primary shadow-sm font-bold'
                    : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('polling'); setError(null); setSuccessMsg(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'polling'
                    ? 'bg-base-100 text-primary shadow-sm font-bold'
                    : 'text-base-content/60 hover:text-base-content'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Polling Settings</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content"
              title="Close modal"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alerts / Feedback Banners (shown for User management) */}
        {activeTab === 'users' && error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-error/10 border border-error/20 flex items-center gap-2.5 text-xs text-error font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'users' && successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2.5 text-xs text-success font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'polling' ? (
            <PollingSettingsSection 
              parentAuthStatus={modalAuthStatus}
              onBackToUsers={() => { setActiveTab('users'); setError(null); }} 
            />
          ) : (
            <>
              {/* Add User Form Section */}
              <div className="bg-base-200/60 p-4 sm:p-5 rounded-xl border border-base-content/10">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/80">
                Add New NOC User
              </h3>
            </div>

            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-semibold text-base-content/70 mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-primary" />
                  <span>Username</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. jdoe or ops@fleet.net"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="input input-bordered input-sm w-full text-xs bg-base-100"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-base-content/70 mb-1 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-primary" />
                  <span>Password (min 8 chars)</span>
                </label>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="input input-bordered input-sm w-full text-xs bg-base-100"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !newUsername.trim() || newPassword.length < 8}
                  className="btn btn-primary btn-sm w-full flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            <p className="text-[10px] text-base-content/50 mt-2">
              All passwords are encrypted with bcrypt (cost factor 10) before storage. Plaintext passwords are never saved.
            </p>
          </div>

          {/* User List Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" />
                <span>Existing Authorized Users</span>
              </h3>
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="btn btn-ghost btn-xs text-base-content/60 hover:text-primary flex items-center gap-1"
                title="Refresh user list"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="border border-base-content/10 rounded-xl overflow-hidden bg-base-100">
              <table className="table table-sm w-full">
                <thead className="bg-base-200/80 text-[11px] font-bold text-base-content/70 uppercase">
                  <tr>
                    <th>Operator</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-content/5 text-xs">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-base-content/50">
                        <span className="loading loading-spinner loading-sm mr-2" />
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-base-content/50">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const isCurrentUser =
                        user.username.toLowerCase() === currentUsername.toLowerCase() ||
                        (currentUserId && String(user.id) === String(currentUserId));

                      return (
                        <tr key={user.id} className="hover:bg-base-200/30 transition-colors">
                          <td>
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-base-content">
                                  {user.username}
                                </span>
                                {isCurrentUser && (
                                  <span className="ml-2 badge badge-xs badge-success gap-1 font-mono">
                                    You (Active)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-sm badge-neutral font-mono uppercase text-[10px]">
                              {user.role || 'admin'}
                            </span>
                          </td>
                          <td className="text-base-content/60 text-[11px]">
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleDeleteUser(user)}
                              disabled={isCurrentUser || deletingId === user.id}
                              className={`btn btn-xs ${
                                isCurrentUser
                                  ? 'btn-disabled opacity-30 cursor-not-allowed'
                                  : 'btn-ghost text-error hover:bg-error/10'
                              }`}
                              title={
                                isCurrentUser
                                  ? 'Cannot delete your own active session account'
                                  : `Delete user ${user.username}`
                              }
                            >
                              {deletingId === user.id ? (
                                <span className="loading loading-spinner loading-xs" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Status / Navigation to Polling Settings */}
          <div className="p-3.5 rounded-xl bg-base-200/50 border border-base-content/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-base-content">
                  SNMP Polling Frequency Settings
                </span>
                <p className="text-[11px] text-base-content/60">
                  Background telemetry sweep interval is configurable live from the Polling Settings tab.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('polling')}
              className="btn btn-xs btn-outline btn-primary shrink-0 self-start sm:self-auto"
            >
              Configure Polling
            </button>
          </div>
        </>
      )}
    </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-base-content/10 bg-base-200/50 flex items-center justify-between text-xs text-base-content/60">
          <span>Logged in as: <strong className="text-base-content font-mono">{currentUsername}</strong></span>
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
