import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Plus, Save, CreditCard as Edit3, CheckCircle2, AlertCircle, Users, X } from 'lucide-react';
import { ExcelLikeTable } from '../ExcelLikeTable';
import { PasteHandler, FieldConfig } from '../../lib/pasteHandlers';
import TableColumnSearch from '../TableColumnSearch';

interface WaterUser {
  user_id: string;
  station_id: string | null;
  client_company_name: string;
  national_id_no: string;
  account_no: string;
  contact_1: string;
  contact_2: string;
  email: string;
  service_centre_id: string | null;
  status?: 'saved' | 'modified' | 'new';
}

interface Props {
  stationId?: string;
}

export default function WaterUsersTab({ stationId }: Props) {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const [users, setUsers] = useState<WaterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkAddCount, setBulkAddCount] = useState('5');
  const gridRef = useRef<AgGridReact>(null);

  const searchColumns = useMemo(() => [
    { label: 'Client / Company Name', field: 'client_company_name' },
    { label: 'National ID No.', field: 'national_id_no' },
    { label: 'Account No.', field: 'account_no' },
    { label: 'Contact 1', field: 'contact_1' },
    { label: 'Contact 2', field: 'contact_2' },
    { label: 'Email', field: 'email' },
  ], []);

  const handleFilterChange = useCallback((field: string, value: string) => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.setFilterModel(null);
    if (value) {
      const filterInstance = api.getFilterInstance(field);
      if (filterInstance) {
        filterInstance.setModel({ type: 'contains', filter: value });
        api.onFilterChanged();
      }
    }
  }, []);

  const handleFilterClear = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    api.setFilterModel(null);
    api.onFilterChanged();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [stationId, accessContext?.scopeId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('water_users')
        .select('*')
        .order('client_company_name');

      if (stationId) {
        query = query.eq('station_id', stationId);
      }

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setUsers((data || []).map(u => ({ ...u, status: 'saved' as const })));
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Failed to load water users' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newUser: WaterUser = {
      user_id: crypto.randomUUID(),
      station_id: stationId || null,
      client_company_name: '',
      national_id_no: '',
      account_no: '',
      contact_1: '',
      contact_2: '',
      email: '',
      service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
      status: 'new'
    };

    setUsers([newUser, ...users]);
  };

  const handleAddMultiple = () => {
    const count = parseInt(bulkAddCount);
    if (isNaN(count) || count < 1 || count > 100) {
      setMessage({ type: 'error', text: 'Please enter a number between 1 and 100' });
      return;
    }

    const newUsers: WaterUser[] = [];
    for (let i = 0; i < count; i++) {
      newUsers.push({
        user_id: crypto.randomUUID(),
        station_id: stationId || null,
        client_company_name: '',
        national_id_no: '',
        account_no: '',
        contact_1: '',
        contact_2: '',
        email: '',
        service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
        status: 'new'
      });
    }

    setUsers([...newUsers, ...users]);
    setShowBulkAddModal(false);
    setBulkAddCount('5');
  };

  const handleInputChange = (user_id: string, field: keyof WaterUser, value: any) => {
    setUsers(prev => prev.map(u => {
      if (u.user_id === user_id) {
        const updated = { ...u, [field]: value };
        if (updated.status === 'saved') {
          updated.status = 'modified';
        }
        return updated;
      }
      return u;
    }));
  };

  const waterUserPasteFields: FieldConfig[] = [
    { name: 'client_company_name', type: 'string' },
    { name: 'national_id_no', type: 'string' },
    { name: 'account_no', type: 'string' },
    { name: 'contact_1', type: 'string' },
    { name: 'contact_2', type: 'string' },
    { name: 'email', type: 'string' },
  ];

  const handleTablePaste = useCallback(async (rowIndex: number, colIndex: number, clipboardText: string) => {
    const pasteHandler = new PasteHandler(
      {
        isEditMode: mode === 'edit',
        onUpdate: (idx: number, field: string, value: any) => {
          if (idx >= 0 && idx < users.length) {
            handleInputChange(users[idx].user_id, field as keyof WaterUser, value || '');
          }
        },
      },
      waterUserPasteFields,
      (idx: number) => idx >= 0 && idx < users.length,
    );
    return pasteHandler.handlePaste(clipboardText, rowIndex, colIndex);
  }, [users, mode]);

  const validateEmail = (email: string): boolean => {
    if (!email) return true;
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSaveAll = async () => {
    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    const modifiedUsers = users.filter(u => u.status === 'modified' || u.status === 'new');

    if (modifiedUsers.length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      return;
    }

    for (const u of modifiedUsers) {
      if (!u.client_company_name || !u.client_company_name.trim()) {
        setMessage({ type: 'error', text: 'Client/Company Name is required' });
        return;
      }
      if (u.email && !validateEmail(u.email)) {
        setMessage({ type: 'error', text: 'Invalid email format' });
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      for (const u of modifiedUsers) {
        const payload = {
          station_id: u.station_id,
          client_company_name: u.client_company_name,
          national_id_no: u.national_id_no || null,
          account_no: u.account_no,
          contact_1: u.contact_1 || null,
          contact_2: u.contact_2 || null,
          email: u.email || null,
          service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
          created_by: u.status === 'new' ? user.id : undefined
        };

        if (u.status === 'new') {
          const { error } = await supabase
            .from('water_users')
            .insert({ ...payload, user_id: u.user_id });

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('water_users')
            .update(payload)
            .eq('user_id', u.user_id);

          if (error) throw error;
        }
      }

      setMessage({ type: 'success', text: `Successfully saved ${modifiedUsers.length} user(s)` });
      await loadUsers();
      setMode('view');
    } catch (error: any) {
      console.error('Error saving users:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save users' });
    } finally {
      setSaving(false);
    }
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Client / Company Name',
      field: 'client_company_name',
      width: 250,
      pinned: 'left'
    },
    {
      headerName: 'National ID No.',
      field: 'national_id_no',
      width: 180
    },
    {
      headerName: 'Account No.',
      field: 'account_no',
      width: 150
    },
    {
      headerName: 'Contact 1',
      field: 'contact_1',
      width: 150
    },
    {
      headerName: 'Contact 2',
      field: 'contact_2',
      width: 150
    },
    {
      headerName: 'Email',
      field: 'email',
      width: 220
    }
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true
  }), []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading water users...</p>
      </div>
    );
  }

  if (users.length === 0 && !stationId && mode === 'view') {
    return (
      <div className="bg-blue-50 rounded-lg shadow-sm p-12 text-center border border-blue-200">
        <Users className="w-16 h-16 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No water users registered</h3>
        <p className="text-gray-600 mb-4">Click "Edit" to register water users for this service centre.</p>
        <button
          onClick={() => setMode('edit')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Water Users</h2>
        <div className="flex gap-3">
          {mode === 'view' ? (
            <>
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New User
              </button>
              <button
                onClick={() => setShowBulkAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
              >
                <Users className="w-4 h-4" />
                Add Multiple Users
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || users.filter(u => u.status !== 'saved').length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save All'}
              </button>
              <button
                onClick={() => {
                  setMode('view');
                  loadUsers();
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {mode === 'view' && (
        <>
        <TableColumnSearch
          columns={searchColumns}
          onFilterChange={handleFilterChange}
          onClear={handleFilterClear}
        />
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 300px)', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={users}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={20}
            suppressMovableColumns={false}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            animateRows={true}
            enableRangeSelection={true}
          />
        </div>
        </>
      )}

      {mode === 'edit' && (
        <div className="overflow-auto" style={{ height: 'calc(100vh - 250px)' }}>
          <ExcelLikeTable className="w-full border-collapse bg-white shadow-sm" onPaste={handleTablePaste}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">Client / Company Name *</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">National ID No.</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">Account No.</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">Contact 1</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">Contact 2</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-black text-gray-700 text-left">Email</th>
              </tr>
            </thead>
            <tbody>
              {users.map((waterUser) => (
                <tr
                  key={waterUser.user_id}
                  className={
                    waterUser.status === 'new' ? 'bg-blue-50' :
                    waterUser.status === 'modified' ? 'bg-yellow-50' : ''
                  }
                >
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="text"
                      value={waterUser.client_company_name || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'client_company_name', e.target.value)}
                      className={`w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500 ${
                        waterUser.status === 'new' && !waterUser.client_company_name ? 'bg-red-100' : ''
                      }`}
                      style={{ minWidth: '220px', height: '24px' }}
                      required
                    />
                  </td>
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="text"
                      value={waterUser.national_id_no || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'national_id_no', e.target.value)}
                      className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '150px', height: '24px' }}
                    />
                  </td>
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="text"
                      value={waterUser.account_no || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'account_no', e.target.value)}
                      className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '24px' }}
                    />
                  </td>
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="text"
                      value={waterUser.contact_1 || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'contact_1', e.target.value)}
                      className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '24px' }}
                    />
                  </td>
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="text"
                      value={waterUser.contact_2 || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'contact_2', e.target.value)}
                      className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '24px' }}
                    />
                  </td>
                  <td className="border border-gray-300 py-0 px-1">
                    <input
                      type="email"
                      value={waterUser.email || ''}
                      onChange={(e) => handleInputChange(waterUser.user_id, 'email', e.target.value)}
                      className="w-full px-2 py-0.5 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '200px', height: '24px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </ExcelLikeTable>
        </div>
      )}

      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Multiple Users</h3>
              <button
                onClick={() => setShowBulkAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="bulkCount" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of users to add (1-100)
                </label>
                <input
                  id="bulkCount"
                  type="number"
                  min="1"
                  max="100"
                  value={bulkAddCount}
                  onChange={(e) => setBulkAddCount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBulkAddModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMultiple}
                  className="px-4 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors"
                >
                  Add Users
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
