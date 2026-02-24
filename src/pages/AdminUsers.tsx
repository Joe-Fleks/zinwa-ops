import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ScopeType } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, Shield, CheckCircle, XCircle, Star, Plus, RotateCcw, MapPin, Building2, AlertCircle, ArrowLeft } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  force_password_reset?: boolean;
  roles?: Array<{ id: string; name: string }>;
  scope_type?: ScopeType;
  scope_name?: string;
}

export default function AdminUsers() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(location.state?.showSuccess || false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetUserName, setResetUserName] = useState('');

  useEffect(() => {
    if (!hasPermission('manage_users')) {
      setError('Access denied. You do not have permission to manage users.');
      setLoading(false);
      return;
    }
    loadUsers();
    if (showSuccess) {
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [hasPermission]);

  const loadUsers = async () => {
    try {
      const { data, error: err } = await supabase
        .from('user_profiles')
        .select(`
          id,
          email,
          full_name,
          is_active,
          force_password_reset,
          created_at,
          user_roles(
            role_id,
            scope_type,
            scope_id,
            effective_to,
            roles!inner(id, name)
          )
        `)
        .order('created_at', { ascending: false });

      if (err) throw err;

      const processedUsers: User[] = [];

      for (const u of data || []) {
        const activeRole = u.user_roles?.find((ur: any) => ur.effective_to === null);
        let scopeName = '';

        if (activeRole?.scope_type === 'NATIONAL') {
          scopeName = 'National';
        } else if (activeRole?.scope_type === 'CATCHMENT' && activeRole?.scope_id) {
          const { data: catchment } = await supabase
            .from('catchments')
            .select('name')
            .eq('id', activeRole.scope_id)
            .maybeSingle();
          scopeName = catchment?.name || 'Unknown Catchment';
        } else if (activeRole?.scope_type === 'SC' && activeRole?.scope_id) {
          const { data: sc } = await supabase
            .from('service_centres')
            .select('name')
            .eq('id', activeRole.scope_id)
            .maybeSingle();
          scopeName = sc?.name || 'Unknown SC';
        }

        processedUsers.push({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          is_active: u.is_active,
          force_password_reset: u.force_password_reset,
          created_at: u.created_at,
          roles: u.user_roles
            ?.filter((ur: any) => ur.effective_to === null)
            .map((ur: any) => ur.roles)
            .filter(Boolean) || [],
          scope_type: activeRole?.scope_type,
          scope_name: scopeName,
        });
      }

      setUsers(processedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase
        .from('user_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (err) throw err;

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleResetPassword = async (userId: string, userName: string) => {
    setResetPasswordLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session not found. Please log in again.');
      }

      if (!session.access_token) {
        throw new Error('Access token not available. Please log in again.');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`;
      const authHeader = `Bearer ${session.access_token}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'X-Client-Info': 'supabase-js-react',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ target_user_id: userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setResetPassword(result.temp_password);
      setResetUserName(userName);
      setShowPasswordModal(true);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setResetPasswordLoading(null);
    }
  };

  if (!hasPermission('manage_users')) {
    return (
      <div className="space-y-6">
        <PageHeader title="User Management" backTo="/admin" icon={<Users className="w-5 h-5 text-blue-600" />} />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          You do not have permission to access this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Administration</span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <PageHeader title="User Management" backTo="/admin" icon={<Users className="w-5 h-5 text-blue-600" />} />
        <button
          onClick={() => navigate('/admin/users/create')}
          className="flex items-center gap-2 bg-blue-300 text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-400 transition"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm font-medium">User created successfully</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Roles</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Scope</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 font-medium">{user.full_name}</td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role.id}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                role.name === 'Global Admin'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {role.name === 'Global Admin' ? (
                                <Star className="w-3 h-3 fill-current" />
                              ) : (
                                <Shield className="w-3 h-3" />
                              )}
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-xs">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {user.scope_name ? (
                        <div className="flex items-center gap-1.5">
                          {user.scope_type === 'NATIONAL' ? (
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          ) : user.scope_type === 'CATCHMENT' ? (
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-gray-600" />
                          )}
                          <span className={`text-xs font-medium ${
                            user.scope_type === 'NATIONAL' ? 'text-emerald-700' :
                            user.scope_type === 'CATCHMENT' ? 'text-blue-700' : 'text-gray-700'
                          }`}>
                            {user.scope_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {user.is_active ? (
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500">
                          <XCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Inactive</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleUserActive(user.id, user.is_active)}
                          className={`text-xs px-3 py-1 rounded transition-colors ${
                            user.is_active
                              ? 'bg-blue-300 text-blue-900 hover:bg-blue-400'
                              : 'bg-blue-300 text-blue-900 hover:bg-blue-400'
                          }`}
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.id, user.full_name)}
                          disabled={resetPasswordLoading === user.id}
                          className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-300 text-blue-900 hover:bg-blue-400 rounded transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {resetPasswordLoading === user.id ? 'Resetting...' : 'Reset Password'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">Info:</span> To assign roles and scopes to users, please use the Roles Management section or contact your system administrator.
        </p>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-orange-900">Password Reset</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 text-sm">
                Password reset for <span className="font-semibold">{resetUserName}</span>. Share this temporary password with the user. They will be required to change it on next login.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-medium mb-2">Temporary Password</p>
                <div className="bg-white border border-amber-300 rounded p-3 font-mono text-sm text-gray-900 break-all">
                  {resetPassword}
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(resetPassword);
                  alert('Password copied to clipboard');
                }}
                className="w-full bg-blue-300 text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-400 transition font-medium text-sm"
              >
                Copy Password
              </button>

              <button
                onClick={() => setShowPasswordModal(false)}
                className="w-full bg-gray-100 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
