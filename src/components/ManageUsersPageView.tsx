import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  User,
  ArrowLeft,
  LogIn,
} from 'lucide-react';
import { fetchWithAuth, clearAuth } from '../utils/auth';

export interface UserItem {
  id: number | string;
  username: string;
  role: string;
  created_at: string;
}

interface ManageUsersPageViewProps {
  onBack: () => void;
  currentUsername: string;
  currentUserId?: string | number;
  initialTab?: string;
  authStatus?: 'checking' | 'authenticated' | 'unauthenticated';
  onUnauthorized?: () => void;
}

export const ManageUsersPageView: React.FC<ManageUsersPageViewProps> = ({
  onBack,
  currentUsername,
  currentUserId,
  authStatus: propAuthStatus,
  onUnauthorized,
}) => {
  const [pageAuthStatus, setPageAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(
    propAuthStatus === 'authenticated' ? 'authenticated' : 'checking'
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
      const res = await fetchWithAuth('/api/auth/users');
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
        setPageAuthStatus('authenticated');
      } else if (res.status === 401) {
        setPageAuthStatus('unauthenticated');
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
    setPageAuthStatus('checking');
    setError(null);
    try {
      const authRes = await fetchWithAuth('/api/auth/me');
      const authData = await authRes.json();
      if (!authRes.ok || !authData.authenticated) {
        setPageAuthStatus('unauthenticated');
        setError('Admin authentication required. Please log in.');
        return;
      }
      setPageAuthStatus('authenticated');
      setError(null);
      await fetchUsers();
    } catch {
      setPageAuthStatus('unauthenticated');
      setError('Admin authentication required. Please log in.');
    }
  }, [fetchUsers]);

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, [checkAuthAndFetchUsers]);

  useEffect(() => {
    if (propAuthStatus && propAuthStatus !== 'checking') {
      setPageAuthStatus(propAuthStatus);
    }
  }, [propAuthStatus]);

  const handleLoginRedirect = () => {
    clearAuth();
    if (onUnauthorized) {
      onUnauthorized();
    }
  };

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
      const res = await fetchWithAuth('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ username: cleanUser, password: newPassword }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setPageAuthStatus('unauthenticated');
        setError('Admin authentication required. Please log in.');
        return;
      }

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

    const confirmDelete = window.confirm(`Are you sure you want to delete user "${user.username}"?`);
    if (!confirmDelete) return;

    setDeletingId(user.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetchWithAuth(`/api/auth/users/${user.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.status === 401) {
        setPageAuthStatus('unauthenticated');
        setError('Admin authentication required. Please log in.');
        return;
      }

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

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-6 animate-fadeIn">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-semibold text-base-content/70 hover:text-primary transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-base-200 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Fleet Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-base-content/60">
            Logged in as: <strong className="text-base-content font-mono">{currentUsername}</strong>
          </span>
        </div>
      </div>

      {/* Main Page Header */}
      <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-xs">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-base-content flex items-center gap-3">
              <span>Manage HealthStream Users</span>
              {pageAuthStatus === 'authenticated' && (
                <span className="badge badge-sm badge-primary badge-outline font-mono">
                  {users.length} {users.length === 1 ? 'user' : 'users'}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-base-content/60 mt-1">
              Control operator credentials, database-backed authentication, and access roles.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {pageAuthStatus === 'checking' ? (
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-12 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <span className="loading loading-spinner loading-md text-primary" />
          <span className="text-xs font-semibold text-base-content/70">
            Verifying administrator authorization &amp; loading user directory...
          </span>
        </div>
      ) : pageAuthStatus === 'unauthenticated' ? (
        <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm space-y-4">
          <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-error font-medium">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="font-bold block">Admin authentication required. Please log in.</span>
                <span className="text-[11px] opacity-80">
                  Your session has expired or is not authorized. Please sign in to manage users.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoginRedirect}
              className="btn btn-error btn-sm gap-1.5 text-xs font-bold shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Alerts / Feedback Banners */}
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center justify-between gap-3 text-xs text-error font-medium">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              {error.toLowerCase().includes('log in') && (
                <button
                  type="button"
                  onClick={handleLoginRedirect}
                  className="btn btn-error btn-xs gap-1 font-bold"
                >
                  <LogIn className="w-3 h-3" />
                  <span>Log In</span>
                </button>
              )}
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2.5 text-xs text-success font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Add User Form Section */}
          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/80">
                Add New HealthStream User
              </h2>
            </div>

            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-semibold text-base-content/70 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>Username</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. jdoe or ops@fleet.net"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  className="input input-bordered w-full text-xs rounded-xl bg-base-200/50 focus:bg-base-100"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-base-content/70 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Password (min 8 chars)</span>
                </label>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  className="input input-bordered w-full text-xs rounded-xl bg-base-200/50 focus:bg-base-100"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSubmitting || !newUsername.trim() || newPassword.length < 8}
                  className="btn btn-primary w-full flex items-center justify-center gap-2 text-xs font-bold rounded-xl shadow-sm"
                >
                  {isSubmitting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create User</span>
                    </>
                  )}
                </button>
              </div>
            </form>
            <p className="text-[11px] text-base-content/50 mt-3">
              All passwords are encrypted with bcrypt (cost factor 10) before storage. Plaintext passwords are never saved.
            </p>
          </div>

          {/* User List Table */}
          <div className="rounded-2xl border border-base-content/10 bg-base-100 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span>Existing Authorized Users ({users.length})</span>
              </h2>
              <button
                onClick={fetchUsers}
                disabled={loading}
                className="btn btn-ghost btn-xs text-base-content/60 hover:text-primary flex items-center gap-1"
                title="Refresh user list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
                      <td colSpan={4} className="text-center py-10 text-base-content/50">
                        <span className="loading loading-spinner loading-sm mr-2" />
                        Loading users...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-base-content/50">
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
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/20 to-indigo-500/20 text-primary font-bold flex items-center justify-center text-xs border border-primary/20">
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
        </div>
      )}
    </div>
  );
};
