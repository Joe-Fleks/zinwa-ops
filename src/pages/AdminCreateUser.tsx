import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ScopeType } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, AlertCircle } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { fetchCatchments, fetchServiceCentresByCatchment, Catchment, ServiceCentre } from '../lib/scopeUtils';
import { getAllowedScopesForRole, isRoleScopeCompatible } from '../lib/rbacMatrix';

interface Role {
  id: string;
  name: string;
}

export default function AdminCreateUser() {
  const { hasPermission, accessContext } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [catchments, setCatchments] = useState<Catchment[]>([]);
  const [serviceCentres, setServiceCentres] = useState<ServiceCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role_id: '',
    scope_type: 'SC' as ScopeType,
    catchment_id: '',
    service_centre_id: '',
  });

  useEffect(() => {
    if (!hasPermission('manage_users')) {
      navigate('/admin/users');
      return;
    }
    loadInitialData();
  }, [hasPermission]);

  const loadInitialData = async () => {
    try {
      const [rolesData, catchmentsData] = await Promise.all([
        supabase.from('roles').select('id, name').order('name'),
        fetchCatchments(),
      ]);

      if (rolesData.error) throw rolesData.error;
      setRoles(rolesData.data || []);
      setCatchments(catchmentsData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load initial data');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (form.catchment_id) {
      loadServiceCentres();
    } else {
      setServiceCentres([]);
      setForm(prev => ({ ...prev, service_centre_id: '' }));
    }
  }, [form.catchment_id]);

  const loadServiceCentres = async () => {
    if (!form.catchment_id) return;
    const data = await fetchServiceCentresByCatchment(form.catchment_id);
    setServiceCentres(data);
  };

  const selectedRole = roles.find(r => r.id === form.role_id);
  const allowedScopes = selectedRole ? getAllowedScopesForRole(selectedRole.name) : [];
  const isScopeAllowed = allowedScopes.includes(form.scope_type);

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    const newScope = role ? getAllowedScopesForRole(role.name)[0] : 'SC';

    setForm(prev => ({
      ...prev,
      role_id: roleId,
      scope_type: newScope as ScopeType,
      catchment_id: '',
      service_centre_id: '',
    }));
  };

  const handleScopeChange = (scope: ScopeType) => {
    setForm(prev => ({
      ...prev,
      scope_type: scope,
      catchment_id: '',
      service_centre_id: '',
    }));
  };

  const canSubmit = () => {
    if (!form.email || !form.full_name || !form.role_id) return false;
    if (!isScopeAllowed) return false;

    if (form.scope_type === 'SC' && !form.service_centre_id) return false;
    if (form.scope_type === 'CATCHMENT' && !form.catchment_id) return false;

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session not found. Please log in again.');
      }

      if (!session.access_token) {
        throw new Error('Access token not available. Please log in again.');
      }

      let scopeId: string | undefined;
      if (form.scope_type === 'SC') {
        scopeId = form.service_centre_id || undefined;
      } else if (form.scope_type === 'CATCHMENT') {
        scopeId = form.catchment_id || undefined;
      }

      const payload = {
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name,
        role_id: form.role_id,
        scope_type: form.scope_type,
        scope_id: scopeId,
      };

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`;
      const authHeader = `Bearer ${session.access_token}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'X-Client-Info': 'supabase-js-react',
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(payload),
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (result.code === 'EMAIL_EXISTS') {
          throw new Error('This email address is already registered');
        } else if (result.code === 'NOT_ALLOWED') {
          throw new Error('You do not have permission to create users');
        } else if (result.code === 'INVALID_REQUEST') {
          throw new Error('Invalid request: ' + result.error);
        }
        throw new Error(result.error || 'Failed to create user');
      }

      setTempPassword(result.temp_password || '');
      setShowPasswordModal(true);
      setSuccess(true);
      setForm({ email: '', full_name: '', role_id: '', scope_type: 'SC', catchment_id: '', service_centre_id: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Create User" backTo="/admin/users" icon={<Users className="w-5 h-5 text-blue-600" />} />
        <div className="text-center py-12 text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Create User" backTo="/admin/users" icon={<Users className="w-5 h-5 text-blue-600" />} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
              disabled={creating}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
              disabled={creating}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <select
            required
            value={form.role_id}
            onChange={e => handleRoleChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creating}
          >
            <option value="">Select Role</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Role determines available scope options</p>
        </div>

        {form.role_id && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Scope Assignment</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scope Level</label>
              <div className="space-y-2">
                {allowedScopes.map(scope => (
                  <label key={scope} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      checked={form.scope_type === scope}
                      onChange={() => handleScopeChange(scope)}
                      className="w-4 h-4"
                      disabled={creating}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {scope === 'SC' && 'Service Centre'}
                      {scope === 'CATCHMENT' && 'Catchment'}
                      {scope === 'NATIONAL' && 'National'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {form.scope_type !== 'NATIONAL' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Catchment</label>
                <select
                  required={form.scope_type !== 'NATIONAL'}
                  value={form.catchment_id}
                  onChange={e => setForm({ ...form, catchment_id: e.target.value, service_centre_id: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                >
                  <option value="">Select Catchment</option>
                  {catchments.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {form.scope_type === 'SC' && form.catchment_id && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Centre</label>
                <select
                  required
                  value={form.service_centre_id}
                  onChange={e => setForm({ ...form, service_centre_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={creating}
                >
                  <option value="">Select Service Centre</option>
                  {serviceCentres.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-xs text-blue-800">
            A temporary password will be generated and displayed after user creation. The user will be required to change it on first login.
          </p>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            disabled={creating}
            className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit() || creating}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              canSubmit() && !creating
                ? 'bg-blue-300 text-blue-900 hover:bg-blue-400'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-green-900">User Created Successfully</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-700 text-sm">
                The user account has been created. Share this temporary password with the user. They will be required to change it on first login.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 font-medium mb-2">Temporary Password</p>
                <div className="bg-white border border-amber-300 rounded p-3 font-mono text-sm text-gray-900 break-all">
                  {tempPassword}
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  alert('Password copied to clipboard');
                }}
                className="w-full bg-blue-300 text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-400 transition font-medium text-sm"
              >
                Copy Password
              </button>

              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  navigate('/admin/users', { state: { showSuccess: true } });
                }}
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
