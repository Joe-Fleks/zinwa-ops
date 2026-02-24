import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, AlertCircle, CheckCircle, Search, ChevronDown, ArrowUpRight, Users, ArrowRight, LogOut, Pause, AlertTriangle, Plus } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { validateRoleScope } from '../lib/rbacMatrix';
import { fetchCatchments, fetchServiceCentresByCatchment, fetchCatchmentById, ServiceCentre, Catchment } from '../lib/scopeUtils';

interface UserRole {
  user_id: string;
  user_email: string;
  user_name: string;
  is_active: boolean;
  role_id: string;
  role_name: string;
  scope_type: 'SC' | 'CATCHMENT' | 'NATIONAL';
  scope_id: string | null;
  scope_name: string | null;
  authority_rank: number;
  system_rank: number;
  effective_from: string;
  effective_to: string | null;
}

interface Role {
  id: string;
  name: string;
  authority_rank: number;
}

type ActionModal = 'promote' | 'demote' | 'transfer' | 'assign' | 'retire' | 'suspend' | 'resign' | null;

export default function RoleManagement() {
  const { hasPermission, user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRole[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catchments, setCatchments] = useState<Catchment[]>([]);
  const [serviceCentres, setServiceCentres] = useState<ServiceCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [activeModal, setActiveModal] = useState<ActionModal>(null);
  const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Promote/Demote
  const [selectedRoleForPromotion, setSelectedRoleForPromotion] = useState<string>('');
  const [selectedRoleForDemotion, setSelectedRoleForDemotion] = useState<string>('');

  // Transfer
  const [transferCatchmentId, setTransferCatchmentId] = useState<string>('');
  const [transferSCId, setTransferSCId] = useState<string>('');
  const [transferSCsForCatchment, setTransferSCsForCatchment] = useState<ServiceCentre[]>([]);

  // Assign (new role and/or location)
  const [assignCatchmentId, setAssignCatchmentId] = useState<string>('');
  const [assignSCId, setAssignSCId] = useState<string>('');
  const [assignSCsForCatchment, setAssignSCsForCatchment] = useState<ServiceCentre[]>([]);
  const [assignRoleId, setAssignRoleId] = useState<string>('');
  const [assignmentValidationError, setAssignmentValidationError] = useState('');

  useEffect(() => {
    if (!hasPermission('manage_roles')) {
      navigate('/admin');
      return;
    }
    loadData();
  }, [hasPermission]);

  useEffect(() => {
    if (transferCatchmentId) {
      loadServiceCentresForTransfer(transferCatchmentId);
    }
  }, [transferCatchmentId]);

  useEffect(() => {
    if (assignCatchmentId) {
      loadServiceCentresForAssignment(assignCatchmentId);
    }
  }, [assignCatchmentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, catchmentsRes, scRes] = await Promise.all([
        supabase
          .from('user_roles')
          .select(`
            user_id,
            role_id,
            scope_type,
            scope_id,
            effective_from,
            effective_to,
            user_profiles!inner(id, email, full_name, is_active),
            roles!inner(id, name, authority_rank, system_rank)
          `)
          .is('effective_to', null)
          .order('user_id'),
        supabase
          .from('roles')
          .select('id, name, authority_rank')
          .order('authority_rank', { ascending: false }),
        fetchCatchments(),
        supabase
          .from('service_centres')
          .select('*')
          .eq('is_active', true)
          .order('name')
      ]);

      if (usersRes.error) throw usersRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const transformedUsers: UserRole[] = [];
      for (const ur of usersRes.data || []) {
        let scopeName = null;
        if (ur.scope_id) {
          if (ur.scope_type === 'SC') {
            const scRes = await supabase
              .from('service_centres')
              .select('name')
              .eq('id', ur.scope_id)
              .maybeSingle();
            scopeName = scRes.data?.name || ur.scope_id;
          } else if (ur.scope_type === 'CATCHMENT') {
            const catchRes = await supabase
              .from('catchments')
              .select('name')
              .eq('id', ur.scope_id)
              .maybeSingle();
            scopeName = catchRes.data?.name || ur.scope_id;
          }
        }

        transformedUsers.push({
          user_id: ur.user_id,
          user_email: (ur.user_profiles as any).email,
          user_name: (ur.user_profiles as any).full_name,
          is_active: (ur.user_profiles as any).is_active,
          role_id: ur.role_id,
          role_name: (ur.roles as any).name,
          scope_type: ur.scope_type,
          scope_id: ur.scope_id,
          scope_name: scopeName,
          authority_rank: (ur.roles as any).authority_rank,
          system_rank: (ur.roles as any).system_rank,
          effective_from: ur.effective_from,
          effective_to: ur.effective_to,
        });
      }

      setUsers(transformedUsers);
      setRoles(rolesRes.data || []);
      setCatchments(catchmentsRes);
      setServiceCentres(scRes.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadServiceCentresForTransfer = async (catchmentId: string) => {
    const scs = await fetchServiceCentresByCatchment(catchmentId);
    setTransferSCsForCatchment(scs);
    setTransferSCId('');
  };

  const loadServiceCentresForAssignment = async (catchmentId: string) => {
    const scs = await fetchServiceCentresByCatchment(catchmentId);
    setAssignSCsForCatchment(scs);
    setAssignSCId('');
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.role_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && u.is_active) ||
                         (filterStatus === 'inactive' && !u.is_active);
    return matchesSearch && matchesStatus;
  });

  const handlePromote = async () => {
    if (!selectedUser || !currentUser?.id || !selectedRoleForPromotion) return;

    try {
      setConfirming(true);
      const newRole = roles.find(r => r.id === selectedRoleForPromotion);
      if (!newRole) throw new Error('Target role not found');
      if (newRole.authority_rank <= selectedUser.authority_rank) {
        throw new Error('Selected role must have higher rank than current role');
      }

      // Validate role-scope compatibility
      const validation = validateRoleScope(newRole.name, selectedUser.scope_type);
      if (!validation.valid) throw new Error(validation.error);

      // Retire old role
      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      // Assign new role with same scope
      await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: newRole.id,
          scope_type: selectedUser.scope_type,
          scope_id: selectedUser.scope_id,
          effective_from: new Date().toISOString(),
          assigned_by: currentUser.id,
        });

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'ROLE_PROMOTED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { role: selectedUser.role_name, rank: selectedUser.authority_rank, reason: actionReason },
        new_value: { role: newRole.name, rank: newRole.authority_rank },
      });

      setSuccess(`${selectedUser.user_name} promoted from ${selectedUser.role_name} to ${newRole.name}`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote user');
    } finally {
      setConfirming(false);
    }
  };

  const handleDemote = async () => {
    if (!selectedUser || !currentUser?.id || !selectedRoleForDemotion) return;

    try {
      setConfirming(true);
      const newRole = roles.find(r => r.id === selectedRoleForDemotion);
      if (!newRole) throw new Error('Target role not found');
      if (newRole.authority_rank >= selectedUser.authority_rank) {
        throw new Error('Selected role must have lower rank than current role');
      }

      // Validate role-scope compatibility
      const validation = validateRoleScope(newRole.name, selectedUser.scope_type);
      if (!validation.valid) throw new Error(validation.error);

      // Retire old role
      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      // Assign new role with same scope
      await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: newRole.id,
          scope_type: selectedUser.scope_type,
          scope_id: selectedUser.scope_id,
          effective_from: new Date().toISOString(),
          assigned_by: currentUser.id,
        });

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'ROLE_DEMOTED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { role: selectedUser.role_name, rank: selectedUser.authority_rank, reason: actionReason },
        new_value: { role: newRole.name, rank: newRole.authority_rank },
      });

      setSuccess(`${selectedUser.user_name} demoted from ${selectedUser.role_name} to ${newRole.name}`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to demote user');
    } finally {
      setConfirming(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedUser || !currentUser?.id) return;

    try {
      setConfirming(true);

      let newScopeId: string | null = null;
      let newScopeName: string = '';

      // For SC-scoped users, transfer within SC scope
      if (selectedUser.scope_type === 'SC') {
        if (!transferSCId) throw new Error('Please select a Service Centre');

        const newSC = serviceCentres.find(sc => sc.id === transferSCId);
        if (!newSC) throw new Error('Service Centre not found');

        newScopeId = transferSCId;
        newScopeName = newSC.name;
      }
      // For CATCHMENT-scoped users, transfer within CATCHMENT scope
      else if (selectedUser.scope_type === 'CATCHMENT') {
        if (!transferCatchmentId) throw new Error('Please select a Catchment');

        const newCatchment = catchments.find(c => c.id === transferCatchmentId);
        if (!newCatchment) throw new Error('Catchment not found');

        newScopeId = transferCatchmentId;
        newScopeName = newCatchment.name;
      }
      else {
        throw new Error('Transfer not available for National-scoped roles');
      }

      // Retire old role
      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      // Assign same role to new location
      await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: selectedUser.role_id,
          scope_type: selectedUser.scope_type,
          scope_id: newScopeId,
          effective_from: new Date().toISOString(),
          assigned_by: currentUser.id,
        });

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'ROLE_TRANSFERRED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { scope: selectedUser.scope_name, scope_id: selectedUser.scope_id, scope_type: selectedUser.scope_type, reason: actionReason },
        new_value: { scope: newScopeName, scope_id: newScopeId, scope_type: selectedUser.scope_type },
      });

      setSuccess(`${selectedUser.user_name} transferred to ${newScopeName}`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer user');
    } finally {
      setConfirming(false);
    }
  };

  const handleAssignNewRole = async () => {
    if (!selectedUser || !currentUser?.id || !assignRoleId) return;

    try {
      setConfirming(true);
      setAssignmentValidationError('');

      const newRole = roles.find(r => r.id === assignRoleId);
      if (!newRole) throw new Error('Role not found');

      // Determine new scope based on selected location
      let newScopeType: 'SC' | 'CATCHMENT' | 'NATIONAL' = selectedUser.scope_type;
      let newScopeId: string | null = selectedUser.scope_id;

      if (assignSCId) {
        newScopeType = 'SC';
        newScopeId = assignSCId;
      } else if (assignCatchmentId) {
        newScopeType = 'CATCHMENT';
        newScopeId = assignCatchmentId;
      }

      // Validate role-scope compatibility
      const validation = validateRoleScope(newRole.name, newScopeType);
      if (!validation.valid) {
        setAssignmentValidationError(validation.error);
        throw new Error(validation.error);
      }

      // Retire old role
      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      // Assign new role with new scope
      await supabase
        .from('user_roles')
        .insert({
          user_id: selectedUser.user_id,
          role_id: newRole.id,
          scope_type: newScopeType,
          scope_id: newScopeId,
          effective_from: new Date().toISOString(),
          assigned_by: currentUser.id,
        });

      // Log action
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'ROLE_ASSIGNED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { role: selectedUser.role_name, scope: selectedUser.scope_name, scope_type: selectedUser.scope_type, reason: actionReason },
        new_value: { role: newRole.name, scope: assignSCId ? (serviceCentres.find(sc => sc.id === assignSCId)?.name || assignSCId) : (catchments.find(c => c.id === assignCatchmentId)?.name || 'National'), scope_type: newScopeType },
      });

      setSuccess(`${selectedUser.user_name} assigned to ${newRole.name}`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign new role');
    } finally {
      setConfirming(false);
    }
  };

  const handleRetire = async () => {
    if (!selectedUser || !currentUser?.id) return;

    try {
      setConfirming(true);

      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'ROLE_RETIRED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { role: selectedUser.role_name, reason: actionReason },
        new_value: { role: null },
      });

      setSuccess(`${selectedUser.user_name}'s role has been retired`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retire role');
    } finally {
      setConfirming(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedUser || !currentUser?.id) return;

    try {
      setConfirming(true);

      await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', selectedUser.user_id);

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'USER_SUSPENDED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { is_active: true, reason: actionReason },
        new_value: { is_active: false },
      });

      setSuccess(`${selectedUser.user_name} has been suspended`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suspend user');
    } finally {
      setConfirming(false);
    }
  };

  const handleResign = async () => {
    if (!selectedUser || !currentUser?.id) return;

    try {
      setConfirming(true);

      await supabase
        .from('user_roles')
        .update({ effective_to: new Date().toISOString() })
        .eq('user_id', selectedUser.user_id)
        .is('effective_to', null);

      await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', selectedUser.user_id);

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action_type: 'USER_RESIGNED',
        entity_type: 'user',
        entity_id: selectedUser.user_id,
        previous_value: { is_active: true, role: selectedUser.role_name, reason: actionReason },
        new_value: { is_active: false, role: null },
      });

      setSuccess(`${selectedUser.user_name} has been removed from the system`);
      resetModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process resignation');
    } finally {
      setConfirming(false);
    }
  };

  const resetModal = () => {
    setActiveModal(null);
    setSelectedUser(null);
    setActionReason('');
    setSelectedRoleForPromotion('');
    setSelectedRoleForDemotion('');
    setTransferCatchmentId('');
    setTransferSCId('');
    setAssignCatchmentId('');
    setAssignSCId('');
    setAssignRoleId('');
    setAssignmentValidationError('');
  };

  if (!hasPermission('manage_roles')) {
    return (
      <div className="space-y-6">
        <PageHeader title="Role Management" icon={null} />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          You do not have permission to manage roles.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Administration</span>
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Personnel Management</h1>
        <p className="text-gray-600 mt-2">Manage user roles and assignments with standardized actions</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Users</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="text-center py-12 text-gray-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            Loading personnel data...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Name / Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Current Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Scope</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.user_name}</p>
                        <p className="text-xs text-gray-500">{user.user_email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{user.role_name}</p>
                        <p className="text-xs text-gray-500">Rank: {user.authority_rank}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-gray-900">{user.scope_name || `${user.scope_type}`}</p>
                      <p className="text-xs text-gray-500">{user.scope_type}</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        user.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedRoleForPromotion('');
                            setActiveModal('promote');
                          }}
                          className="p-1 hover:bg-blue-50 text-blue-600 rounded transition"
                          title="Promote to higher rank"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedRoleForDemotion('');
                            setActiveModal('demote');
                          }}
                          className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition"
                          title="Demote to lower rank"
                        >
                          <ArrowUpRight className="w-4 h-4 transform rotate-180" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setTransferCatchmentId('');
                            setTransferSCId('');
                            setActionReason('');
                            setActiveModal('transfer');
                          }}
                          disabled={user.scope_type === 'NATIONAL'}
                          className="p-1 hover:bg-teal-50 text-teal-600 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Transfer to different location"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setAssignCatchmentId('');
                            setAssignSCId('');
                            setAssignRoleId('');
                            setActionReason('');
                            setAssignmentValidationError('');
                            setActiveModal('assign');
                          }}
                          className="p-1 hover:bg-cyan-50 text-cyan-600 rounded transition"
                          title="Assign new role or location"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setActionReason('');
                            setActiveModal('retire');
                          }}
                          className="p-1 hover:bg-orange-50 text-orange-600 rounded transition"
                          title="Retire role"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setActionReason('');
                            setActiveModal('suspend');
                          }}
                          disabled={!user.is_active}
                          className="p-1 hover:bg-yellow-50 text-yellow-600 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Suspend account"
                        >
                          <Pause className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setActionReason('');
                            setActiveModal('resign');
                          }}
                          className="p-1 hover:bg-red-50 text-red-600 rounded transition"
                          title="Remove from system"
                        >
                          <AlertTriangle className="w-4 h-4" />
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

      {/* PROMOTE MODAL */}
      {activeModal === 'promote' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Promote User</h2>
              <p className="text-sm text-gray-600 mt-1">Current: {selectedUser.role_name} (Rank {selectedUser.authority_rank})</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select New Role</label>
                <select
                  value={selectedRoleForPromotion}
                  onChange={(e) => setSelectedRoleForPromotion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a role...</option>
                  {roles.filter(r => r.authority_rank > selectedUser.authority_rank).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rank: {r.authority_rank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Performance excellence..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handlePromote}
                disabled={confirming || !selectedRoleForPromotion}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Promote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEMOTE MODAL */}
      {activeModal === 'demote' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Demote User</h2>
              <p className="text-sm text-gray-600 mt-1">Current: {selectedUser.role_name} (Rank {selectedUser.authority_rank})</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select New Role</label>
                <select
                  value={selectedRoleForDemotion}
                  onChange={(e) => setSelectedRoleForDemotion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a role...</option>
                  {roles.filter(r => r.authority_rank < selectedUser.authority_rank).map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rank: {r.authority_rank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Role adjustment, Performance concerns..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleDemote}
                disabled={confirming || !selectedRoleForDemotion}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Demote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {activeModal === 'transfer' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Transfer User</h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedUser.scope_type === 'SC' ? 'Transfer to another Service Centre' : 'Transfer to another Catchment'}
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  {selectedUser.scope_type === 'SC'
                    ? 'Role stays the same, transfer to a different Service Centre. Select catchment, then service centre.'
                    : 'Role stays the same, transfer to a different Catchment.'}
                </p>
              </div>

              {selectedUser.scope_type === 'SC' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current: {selectedUser.scope_name}</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Catchment</label>
                    <select
                      value={transferCatchmentId}
                      onChange={(e) => setTransferCatchmentId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select catchment...</option>
                      {catchments.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Service Centre</label>
                    <select
                      value={transferSCId}
                      onChange={(e) => setTransferSCId(e.target.value)}
                      disabled={!transferCatchmentId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                    >
                      <option value="">Select service centre...</option>
                      {transferSCsForCatchment.map(sc => (
                        <option key={sc.id} value={sc.id}>{sc.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : selectedUser.scope_type === 'CATCHMENT' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current: {selectedUser.scope_name}</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Catchment</label>
                    <select
                      value={transferCatchmentId}
                      onChange={(e) => setTransferCatchmentId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select catchment...</option>
                      {catchments.filter(c => c.id !== selectedUser.scope_id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Operational need, Staff rotation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={confirming || (selectedUser.scope_type === 'SC' && !transferSCId) || (selectedUser.scope_type === 'CATCHMENT' && !transferCatchmentId)}
                className="px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN NEW ROLE MODAL */}
      {activeModal === 'assign' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Assign New Role</h2>
              <p className="text-sm text-gray-600 mt-1">Change role and/or location</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Role</label>
                <select
                  value={assignRoleId}
                  onChange={(e) => setAssignRoleId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select new role...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} (Rank: {r.authority_rank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Catchment (Optional)</label>
                <select
                  value={assignCatchmentId}
                  onChange={(e) => setAssignCatchmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">No change</option>
                  {catchments.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {assignCatchmentId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Service Centre in {catchments.find(c => c.id === assignCatchmentId)?.name}</label>
                  <select
                    value={assignSCId}
                    onChange={(e) => setAssignSCId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="">Select service centre...</option>
                    {assignSCsForCatchment.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {assignmentValidationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{assignmentValidationError}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., New assignment, Role change..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleAssignNewRole}
                disabled={confirming || !assignRoleId}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETIRE MODAL */}
      {activeModal === 'retire' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Retire Role</h2>
              <p className="text-sm text-gray-600 mt-1">End role assignment</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  This retires the role but keeps the account active.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Rotation, New assignment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleRetire}
                disabled={confirming}
                className="px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Retire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {activeModal === 'suspend' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Suspend Account</h2>
              <p className="text-sm text-gray-600 mt-1">Disable user login</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Account disabled but role stays assigned for reactivation.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Leave of absence, Investigation..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={confirming}
                className="px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESIGN MODAL */}
      {activeModal === 'resign' && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Remove User</h2>
              <p className="text-sm text-gray-600 mt-1">Permanent removal from system</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  This retires the role AND disables the account. User cannot login.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g., Resignation, Termination..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-sm"
                  rows={3}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={confirming}
              >
                Cancel
              </button>
              <button
                onClick={handleResign}
                disabled={confirming}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {confirming ? 'Processing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
