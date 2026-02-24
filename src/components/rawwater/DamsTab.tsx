import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Plus, Save, Edit3, CheckCircle2, AlertCircle } from 'lucide-react';
import { ExcelLikeTable } from '../ExcelLikeTable';
import { PasteHandler, FieldConfig } from '../../lib/pasteHandlers';

interface Dam {
  id: string;
  dam_code: string | null;
  name: string;
  full_supply_capacity_ml: number | null;
  ten_percent_yield_ml: number | null;
  location: string | null;
  purposes: string[] | null;
  bailiff: string | null;
  river: string | null;
  coordinates: string | null;
  dam_type: string | null;
  year_constructed: number | null;
  spillway_type: string | null;
  owner: string | null;
  operational_status: string | null;
  service_centre_id: string | null;
  status?: 'saved' | 'modified' | 'new';
}

const DAM_PURPOSES = [
  'Domestic Water Supply',
  'Irrigation',
  'Recreation & Tourism',
  'Power Generation',
  'Industry',
  'Aquaculture',
  'Flood Control'
];

export default function DamsTab() {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const [dams, setDams] = useState<Dam[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => {
    loadDams();
  }, [accessContext?.scopeId]);

  const loadDams = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('dams')
        .select('*')
        .order('name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDams((data || []).map(d => ({ ...d, status: 'saved' as const })));
    } catch (error) {
      console.error('Error loading dams:', error);
      setMessage({ type: 'error', text: 'Failed to load dams' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    const newDam: Dam = {
      id: crypto.randomUUID(),
      dam_code: null,
      name: '',
      full_supply_capacity_ml: null,
      ten_percent_yield_ml: null,
      location: null,
      purposes: null,
      bailiff: null,
      river: null,
      coordinates: null,
      dam_type: null,
      year_constructed: null,
      spillway_type: null,
      owner: null,
      operational_status: 'Active',
      service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
      status: 'new'
    };

    setDams([newDam, ...dams]);
  };

  const handleInputChange = (id: string, field: keyof Dam, value: any) => {
    setDams(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        if (updated.status === 'saved') {
          updated.status = 'modified';
        }
        return updated;
      }
      return d;
    }));
  };

  const handlePurposesChange = (id: string, purpose: string) => {
    setDams(prev => prev.map(d => {
      if (d.id === id) {
        const currentPurposes = d.purposes || [];
        const updated = { ...d };

        if (currentPurposes.includes(purpose)) {
          updated.purposes = currentPurposes.filter(p => p !== purpose);
        } else {
          updated.purposes = [...currentPurposes, purpose];
        }

        if (updated.purposes.length === 0) {
          updated.purposes = null;
        }

        if (updated.status === 'saved') {
          updated.status = 'modified';
        }

        return updated;
      }
      return d;
    }));
  };

  const damPasteFields: FieldConfig[] = [
    { name: 'dam_code', type: 'string' },
    { name: 'name', type: 'string' },
    { name: 'location', type: 'string' },
    { name: 'full_supply_capacity_ml', type: 'number' },
    { name: 'ten_percent_yield_ml', type: 'number' },
    { name: 'river', type: 'string' },
    { name: 'bailiff', type: 'string' },
    { name: 'purposes', type: 'string' },
    { name: 'coordinates', type: 'string' },
    { name: 'dam_type', type: 'string' },
    { name: 'year_constructed', type: 'integer' },
    { name: 'spillway_type', type: 'string' },
    { name: 'owner', type: 'string' },
    { name: 'operational_status', type: 'string' },
  ];

  const handleTablePaste = useCallback(async (rowIndex: number, colIndex: number, clipboardText: string) => {
    const pasteHandler = new PasteHandler(
      {
        isEditMode: mode === 'edit',
        onUpdate: (idx: number, field: string, value: any) => {
          if (idx >= 0 && idx < dams.length) {
            const dam = dams[idx];
            if (field === 'purposes' && typeof value === 'string') {
              const parsed = value.split(',').map(s => s.trim()).filter(Boolean);
              handleInputChange(dam.id, field as keyof Dam, parsed.length > 0 ? parsed : null);
            } else {
              handleInputChange(dam.id, field as keyof Dam, value || null);
            }
          }
        },
      },
      damPasteFields,
      (idx: number) => idx >= 0 && idx < dams.length,
    );
    return pasteHandler.handlePaste(clipboardText, rowIndex, colIndex);
  }, [dams, mode]);

  const handleSaveAll = async () => {
    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    const modifiedDams = dams.filter(d => d.status === 'modified' || d.status === 'new');

    if (modifiedDams.length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      return;
    }

    for (const d of modifiedDams) {
      if (!d.name || !d.name.trim()) {
        setMessage({ type: 'error', text: 'Dam name is required' });
        return;
      }
    }

    const damCodesInUse = new Map<string, string>();
    for (const d of dams) {
      if (d.dam_code && d.dam_code.trim()) {
        const code = d.dam_code.toUpperCase().trim();
        if (damCodesInUse.has(code)) {
          setMessage({ type: 'error', text: `Duplicate dam code "${code}" found for dams: "${damCodesInUse.get(code)}" and "${d.name}"` });
          return;
        }
        damCodesInUse.set(code, d.name);
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      for (const d of modifiedDams) {
        const payload = {
          dam_code: d.dam_code && d.dam_code.trim() ? d.dam_code.toUpperCase().trim() : null,
          name: d.name.trim(),
          full_supply_capacity_ml: d.full_supply_capacity_ml,
          ten_percent_yield_ml: d.ten_percent_yield_ml,
          location: d.location,
          purposes: d.purposes,
          bailiff: d.bailiff,
          river: d.river,
          coordinates: d.coordinates,
          dam_type: d.dam_type,
          year_constructed: d.year_constructed,
          spillway_type: d.spillway_type,
          owner: d.owner,
          operational_status: d.operational_status || 'Active',
          service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
          created_by: d.status === 'new' ? user.id : undefined
        };

        if (d.status === 'new') {
          const { error } = await supabase
            .from('dams')
            .insert({ ...payload, id: d.id });

          if (error) {
            if (error.code === '23505') {
              if (error.message.includes('dam_code')) {
                throw new Error(`Dam code "${payload.dam_code}" already exists in the database`);
              } else {
                throw new Error('A dam with this information already exists');
              }
            }
            throw error;
          }
        } else {
          const { error } = await supabase
            .from('dams')
            .update(payload)
            .eq('id', d.id);

          if (error) {
            if (error.code === '23505') {
              if (error.message.includes('dam_code')) {
                throw new Error(`Dam code "${payload.dam_code}" already exists in the database`);
              } else {
                throw new Error('A dam with this information already exists');
              }
            }
            throw error;
          }
        }
      }

      setMessage({ type: 'success', text: `Successfully saved ${modifiedDams.length} dam(s)` });
      await loadDams();
      setMode('view');
    } catch (error: any) {
      console.error('Error saving dams:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save dams' });
    } finally {
      setSaving(false);
    }
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Dam Code',
      field: 'dam_code',
      width: 120,
      cellStyle: { textTransform: 'uppercase' }
    },
    {
      headerName: 'Dam Name',
      field: 'name',
      width: 200
    },
    {
      headerName: 'Location',
      field: 'location',
      width: 180
    },
    {
      headerName: 'Full Capacity (ML)',
      field: 'full_supply_capacity_ml',
      width: 150,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toLocaleString() : ''
    },
    {
      headerName: '10% Yield (ML)',
      field: 'ten_percent_yield_ml',
      width: 130,
      type: 'numericColumn',
      valueFormatter: (params) => params.value ? params.value.toLocaleString() : ''
    },
    {
      headerName: 'River',
      field: 'river',
      width: 150
    },
    {
      headerName: 'Bailiff',
      field: 'bailiff',
      width: 150
    },
    {
      headerName: 'Purposes',
      field: 'purposes',
      width: 250,
      valueFormatter: (params) => {
        if (Array.isArray(params.value) && params.value.length > 0) {
          return params.value.join(', ');
        }
        return '';
      }
    },
    {
      headerName: 'Coordinates',
      field: 'coordinates',
      width: 150
    },
    {
      headerName: 'Dam Type',
      field: 'dam_type',
      width: 130
    },
    {
      headerName: 'Year Constructed',
      field: 'year_constructed',
      width: 140,
      type: 'numericColumn'
    },
    {
      headerName: 'Spillway Type',
      field: 'spillway_type',
      width: 140
    },
    {
      headerName: 'Owner',
      field: 'owner',
      width: 150
    },
    {
      headerName: 'Status',
      field: 'operational_status',
      width: 120
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
        <p className="text-gray-600">Loading dams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Dams</h2>
        <div className="flex gap-3">
          {mode === 'view' ? (
            <>
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Database
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAddNew}
                className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Row
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || dams.filter(d => d.status !== 'saved').length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save All'}
              </button>
              <button
                onClick={() => {
                  setMode('view');
                  loadDams();
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
        <div className="ag-theme-alpine" style={{ height: 'calc(100vh - 250px)', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={dams}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={20}
            suppressMovableColumns={false}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            animateRows={true}
          />
        </div>
      )}

      {mode === 'edit' && (
        <div className="overflow-auto" style={{ height: 'calc(100vh - 250px)' }}>
          <ExcelLikeTable className="w-full border-collapse bg-white shadow-sm" onPaste={handleTablePaste}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Dam Code</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Dam Name *</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Location</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Capacity (ML)</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">10% Yield (ML)</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">River</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Bailiff</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Purposes</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Coordinates</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Dam Type</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Year Built</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Spillway Type</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Owner</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {dams.map((dam) => {
                const hasDuplicateCode = dam.dam_code && dam.dam_code.trim() &&
                  dams.filter(d => d.dam_code && d.dam_code.trim().toUpperCase() === dam.dam_code.trim().toUpperCase()).length > 1;

                return (
                  <tr
                    key={dam.id}
                    className={
                      dam.status === 'new' ? 'bg-blue-50' :
                      dam.status === 'modified' ? 'bg-yellow-50' : ''
                    }
                  >
                    <td className="border border-gray-300 p-0">
                      <input
                        type="text"
                        value={dam.dam_code || ''}
                        onChange={(e) => handleInputChange(dam.id, 'dam_code', e.target.value)}
                        className={`w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500 uppercase ${
                          hasDuplicateCode ? 'bg-red-100' : ''
                        }`}
                        style={{ minWidth: '100px', height: '28px' }}
                      />
                    </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.name || ''}
                      onChange={(e) => handleInputChange(dam.id, 'name', e.target.value)}
                      className={`w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500 ${
                        dam.status === 'new' && !dam.name ? 'bg-red-100' : ''
                      }`}
                      style={{ minWidth: '180px', height: '28px' }}
                      required
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.location || ''}
                      onChange={(e) => handleInputChange(dam.id, 'location', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '150px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={dam.full_supply_capacity_ml || ''}
                      onChange={(e) => handleInputChange(dam.id, 'full_supply_capacity_ml', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={dam.ten_percent_yield_ml || ''}
                      onChange={(e) => handleInputChange(dam.id, 'ten_percent_yield_ml', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.river || ''}
                      onChange={(e) => handleInputChange(dam.id, 'river', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.bailiff || ''}
                      onChange={(e) => handleInputChange(dam.id, 'bailiff', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <div className="relative group h-7 flex items-center">
                      <div className="px-2 text-sm cursor-pointer hover:bg-gray-50 w-full h-full flex items-center" style={{ minWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dam.purposes && dam.purposes.length > 0 ? dam.purposes.join(', ') : 'Select...'}
                      </div>
                      <div className="hidden group-hover:block absolute z-20 bg-white border border-gray-300 shadow-lg p-2 rounded" style={{ minWidth: '300px' }}>
                        <div className="grid grid-cols-2 gap-1">
                          {DAM_PURPOSES.map((purpose) => (
                            <label key={purpose} className="flex items-center gap-1 text-xs hover:bg-gray-50 p-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(dam.purposes || []).includes(purpose)}
                                onChange={() => handlePurposesChange(dam.id, purpose)}
                                className="w-3 h-3"
                              />
                              <span>{purpose}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.coordinates || ''}
                      onChange={(e) => handleInputChange(dam.id, 'coordinates', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.dam_type || ''}
                      onChange={(e) => handleInputChange(dam.id, 'dam_type', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '110px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={dam.year_constructed || ''}
                      onChange={(e) => handleInputChange(dam.id, 'year_constructed', e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '100px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.spillway_type || ''}
                      onChange={(e) => handleInputChange(dam.id, 'spillway_type', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={dam.owner || ''}
                      onChange={(e) => handleInputChange(dam.id, 'owner', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <select
                      value={dam.operational_status || 'Active'}
                      onChange={(e) => handleInputChange(dam.id, 'operational_status', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '28px' }}
                    >
                      <option value="Active">Active</option>
                      <option value="Under Construction">Under Construction</option>
                      <option value="Decommissioned">Decommissioned</option>
                      <option value="Under Repair">Under Repair</option>
                    </select>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </ExcelLikeTable>
        </div>
      )}
    </div>
  );
}
