import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Save, Download, Edit3, CheckCircle2, AlertCircle, Circle, Edit, ChevronDown, X } from 'lucide-react';
import { ExcelLikeTable } from '../ExcelLikeTable';
import { PasteHandler, FieldConfig } from '../../lib/pasteHandlers';

interface DamSearchSelectProps {
  value: string;
  dams: { name: string }[];
  onChange: (value: string) => void;
}

function DamSearchSelect({ value, dams, onChange }: DamSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dams;
    return dams.filter(d => d.name.toLowerCase().includes(q));
  }, [dams, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ minWidth: '150px' }}>
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full flex items-center justify-between px-2 text-sm border-0 bg-transparent focus:ring-1 focus:ring-blue-500 text-left"
          style={{ height: '28px' }}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-400'}>
            {value || 'Select dam...'}
          </span>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {value && (
              <span onMouseDown={handleClear} className="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5">
                <X className="w-3 h-3" />
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </div>
        </button>
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type to search..."
          className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500 bg-blue-50"
          style={{ height: '28px' }}
        />
      )}
      {open && (
        <div
          className="absolute z-50 bg-white border border-gray-300 rounded shadow-lg"
          style={{ top: '100%', left: 0, minWidth: '200px', maxHeight: '200px', overflowY: 'auto' }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400 italic">No dams found</div>
          ) : (
            filtered.map(dam => (
              <div
                key={dam.name}
                onMouseDown={() => handleSelect(dam.name)}
                className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${value === dam.name ? 'bg-blue-100 font-medium text-blue-800' : 'text-gray-800'}`}
              >
                {dam.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface WaterUser {
  user_id: string;
  client_company_name: string;
}

type CompletionStatus = 'incomplete' | 'partial' | 'complete';

interface RWAllocation {
  allocation_id: string;
  user_id: string;
  client_company_name: string;
  source: string;
  farm_coordinates: string;
  property_name: string;
  address: string;
  district: string;
  province: string;
  category: string;
  hectrage: number;
  crop: string;
  crop_category: string;
  agreement_start_date: string;
  agreement_expiry_date: string;
  agreement_length_months: number | null;
  water_allocated_ml: number;
  service_centre_id: string | null;
  status?: 'saved' | 'modified' | 'new';
  completionStatus?: CompletionStatus;
}

const CATEGORIES = ['A1', 'A2', 'Mine', 'Industry', 'Institution', 'Local Authority'];
const CROP_CATEGORIES = ['Cereals', 'Horticulture', 'Plantations', 'Livestock', 'Aquaculture', 'Crocodile Farming', 'Tobacco/Cotton', 'Pasture/Lawn'];

const calculateCompletionStatus = (allocation: RWAllocation): CompletionStatus => {
  const requiredFields = [
    allocation.source,
    allocation.category,
    allocation.agreement_start_date,
    allocation.agreement_expiry_date
  ];

  const hasWaterAllocated = allocation.water_allocated_ml > 0;
  const allRequiredFilled = requiredFields.every(field => field && field.trim() !== '');

  if (!allRequiredFilled && !hasWaterAllocated) {
    return 'incomplete';
  }

  if (allRequiredFilled && hasWaterAllocated) {
    return 'complete';
  }

  return 'partial';
};

interface Props {
  stationId?: string;
}

export default function RWDatabaseTab({ stationId }: Props) {
  const navigate = useNavigate();
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const [allocations, setAllocations] = useState<RWAllocation[]>([]);
  const [waterUsers, setWaterUsers] = useState<WaterUser[]>([]);
  const [dams, setDams] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const gridRef = useRef<AgGridReact>(null);

  useEffect(() => {
    loadData();
  }, [stationId, accessContext?.scopeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      let damsQuery = supabase
        .from('dams')
        .select('name, service_centre_id')
        .order('name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        damsQuery = damsQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const damsRes = await damsQuery;
      if (damsRes.error) throw damsRes.error;

      let allocationsQuery = supabase
        .from('rw_allocations')
        .select(`
          *,
          water_users!inner(client_company_name)
        `);

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        allocationsQuery = allocationsQuery.eq('service_centre_id', accessContext.scopeId);
      }

      let usersQuery = supabase
        .from('water_users')
        .select('user_id, client_company_name')
        .order('client_company_name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        usersQuery = usersQuery.eq('service_centre_id', accessContext.scopeId);
      }

      const [allocationsRes, usersRes] = await Promise.all([
        allocationsQuery,
        usersQuery
      ]);

      if (allocationsRes.error) throw allocationsRes.error;
      if (usersRes.error) throw usersRes.error;

      const existingAllocations = (allocationsRes.data || []).map(a => {
        let recalculatedMonths = a.agreement_length_months;
        if (a.agreement_start_date && a.agreement_expiry_date) {
          const startDate = new Date(a.agreement_start_date);
          const expiryDate = new Date(a.agreement_expiry_date);
          const yearDiff = expiryDate.getFullYear() - startDate.getFullYear();
          const monthDiff = expiryDate.getMonth() - startDate.getMonth();
          recalculatedMonths = (yearDiff * 12) + monthDiff + 1;
        }

        return {
          ...a,
          client_company_name: a.water_users.client_company_name,
          agreement_length_months: recalculatedMonths,
          status: 'saved' as const,
          completionStatus: calculateCompletionStatus(a)
        };
      });

      const allUsers = usersRes.data || [];
      const allocatedUserIds = new Set(existingAllocations.map(a => a.user_id));

      const placeholderAllocations: RWAllocation[] = allUsers
        .filter(user => !allocatedUserIds.has(user.user_id))
        .map(user => ({
          allocation_id: crypto.randomUUID(),
          user_id: user.user_id,
          client_company_name: user.client_company_name,
          source: '',
          farm_coordinates: '',
          property_name: '',
          address: '',
          district: '',
          province: 'Mash West',
          category: '',
          hectrage: 0,
          crop: '',
          crop_category: '',
          agreement_start_date: '',
          agreement_expiry_date: '',
          agreement_length_months: null,
          water_allocated_ml: 0,
          service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
          status: 'new' as const,
          completionStatus: 'incomplete' as CompletionStatus
        }));

      const allAllocations = [...existingAllocations, ...placeholderAllocations];

      allAllocations.sort((a, b) =>
        a.client_company_name.localeCompare(b.client_company_name)
      );

      setAllocations(allAllocations);
      setWaterUsers(allUsers);
      setDams(damsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (allocation_id: string, field: keyof RWAllocation, value: any) => {
    setAllocations(prev => prev.map(a => {
      if (a.allocation_id === allocation_id) {
        const updated = { ...a, [field]: value };

        if (updated.status === 'saved') {
          updated.status = 'modified';
        }

        if (field === 'agreement_start_date' || field === 'agreement_expiry_date') {
          if (updated.agreement_start_date && updated.agreement_expiry_date) {
            const startDate = new Date(updated.agreement_start_date);
            const expiryDate = new Date(updated.agreement_expiry_date);
            const yearDiff = expiryDate.getFullYear() - startDate.getFullYear();
            const monthDiff = expiryDate.getMonth() - startDate.getMonth();
            const totalMonths = (yearDiff * 12) + monthDiff + 1;
            updated.agreement_length_months = totalMonths > 0 ? totalMonths : 0;
          } else {
            updated.agreement_length_months = null;
          }
        }

        updated.completionStatus = calculateCompletionStatus(updated);

        return updated;
      }
      return a;
    }));
  };

  const rwDbPasteFields: FieldConfig[] = [
    { name: 'source', type: 'string' },
    { name: 'farm_coordinates', type: 'string' },
    { name: 'property_name', type: 'string' },
    { name: 'address', type: 'string' },
    { name: 'district', type: 'string' },
    { name: 'province', type: 'string' },
    { name: 'category', type: 'string' },
    { name: 'hectrage', type: 'number' },
    { name: 'crop', type: 'string' },
    { name: 'crop_category', type: 'string' },
    { name: 'agreement_start_date', type: 'string' },
    { name: 'agreement_expiry_date', type: 'string' },
    { name: '_skip_length', type: 'string' },
    { name: 'water_allocated_ml', type: 'number' },
  ];

  const handleTablePaste = useCallback(async (rowIndex: number, colIndex: number, clipboardText: string) => {
    const adjustedColIndex = colIndex - 1;
    if (adjustedColIndex < 0) {
      return { successCount: 0, errorCount: 0, message: 'Cannot paste into read-only column' };
    }

    const pasteHandler = new PasteHandler(
      {
        isEditMode: mode === 'edit',
        onUpdate: (idx: number, field: string, value: any) => {
          if (field === '_skip_length') return;
          if (idx >= 0 && idx < allocations.length) {
            handleInputChange(allocations[idx].allocation_id, field as keyof RWAllocation, value || null);
          }
        },
      },
      rwDbPasteFields,
      (idx: number) => idx >= 0 && idx < allocations.length,
    );
    return pasteHandler.handlePaste(clipboardText, rowIndex, adjustedColIndex);
  }, [allocations, mode]);

  const handleSaveAll = async () => {
    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    const modifiedAllocations = allocations.filter(a => a.status === 'modified' || a.status === 'new');

    if (modifiedAllocations.length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      return;
    }

    for (const a of modifiedAllocations) {
      if (!a.user_id) {
        setMessage({ type: 'error', text: 'Client/Company Name is required' });
        return;
      }
      if (a.water_allocated_ml < 0) {
        setMessage({ type: 'error', text: 'Water allocated cannot be negative' });
        return;
      }
      if (a.agreement_start_date && a.agreement_expiry_date) {
        if (new Date(a.agreement_expiry_date) < new Date(a.agreement_start_date)) {
          setMessage({ type: 'error', text: 'Agreement expiry must be after start date' });
          return;
        }
      }
    }

    setSaving(true);
    setMessage(null);

    try {
      for (const a of modifiedAllocations) {
        const payload = {
          user_id: a.user_id,
          station_id: stationId || null,
          service_centre_id: accessContext?.isSCScoped ? accessContext?.scopeId : null,
          source: a.source || null,
          farm_coordinates: a.farm_coordinates || null,
          property_name: a.property_name || null,
          address: a.address || null,
          district: a.district || null,
          province: a.province || 'Mash West',
          category: a.category || null,
          hectrage: a.hectrage || null,
          crop: a.crop || null,
          crop_category: a.crop_category || null,
          agreement_start_date: a.agreement_start_date || null,
          agreement_expiry_date: a.agreement_expiry_date || null,
          agreement_length_months: a.agreement_length_months,
          water_allocated_ml: a.water_allocated_ml || 0,
          created_by: a.status === 'new' ? user.id : undefined
        };

        if (a.status === 'new') {
          const { error } = await supabase
            .from('rw_allocations')
            .insert({ ...payload, allocation_id: a.allocation_id });

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('rw_allocations')
            .update(payload)
            .eq('allocation_id', a.allocation_id);

          if (error) throw error;
        }
      }

      setMessage({ type: 'success', text: `Successfully saved ${modifiedAllocations.length} allocation(s)` });
      await loadData();
      setMode('view');
    } catch (error: any) {
      console.error('Error saving allocations:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save allocations' });
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = () => {
    const headers = ['STATUS', 'CLIENT/COMPANY', 'SOURCE', 'FARM COORDINATES', 'PROPERTY NAME', 'ADDRESS', 'DISTRICT', 'PROVINCE', 'CATEGORY', 'HECTRAGE', 'CROP', 'CROP CATEGORY', 'START DATE', 'EXPIRY DATE', 'LENGTH (MONTHS)', 'WATER ALLOCATED (ML)'];

    const rows = allocations.map(a => [
      a.completionStatus,
      a.client_company_name,
      a.source,
      a.farm_coordinates,
      a.property_name,
      a.address,
      a.district,
      a.province,
      a.category,
      a.hectrage,
      a.crop,
      a.crop_category,
      a.agreement_start_date,
      a.agreement_expiry_date,
      a.agreement_length_months ?? '',
      a.water_allocated_ml
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rw_database_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const StatusIconRenderer = (props: ICellRendererParams) => {
    const status = props.data?.completionStatus;
    if (!status) return null;

    const config = {
      incomplete: { icon: Circle, color: 'text-red-500', tooltip: 'RW data not yet completed' },
      partial: { icon: Edit, color: 'text-amber-500', tooltip: 'Partially completed RW data' },
      complete: { icon: CheckCircle2, color: 'text-green-500', tooltip: 'RW data complete' }
    };

    const { icon: Icon, color, tooltip } = config[status];

    return (
      <div className="flex items-center justify-center h-full" title={tooltip}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
    );
  };

  const ClientNameRenderer = (props: ICellRendererParams) => {
    const allocation = props.data;
    if (!allocation) return null;

    if (allocation.status === 'saved' && allocation.user_id) {
      return (
        <button
          onClick={() => navigate(`/rawwater/client/${allocation.user_id}`)}
          className="text-left w-full text-blue-600 hover:text-blue-900 font-medium hover:underline transition-colors"
        >
          {allocation.client_company_name}
        </button>
      );
    }

    return <span>{allocation.client_company_name}</span>;
  };

  const columnDefs: ColDef[] = useMemo(() => [
    {
      headerName: 'Status',
      field: 'completionStatus',
      cellRenderer: StatusIconRenderer,
      width: 80,
      pinned: 'left',
      sortable: true,
      filter: true
    },
    {
      headerName: 'Client / Company',
      field: 'client_company_name',
      cellRenderer: ClientNameRenderer,
      width: 220,
      pinned: 'left',
      sort: 'asc'
    },
    {
      headerName: 'Source',
      field: 'source',
      width: 180
    },
    {
      headerName: 'Farm Coordinates',
      field: 'farm_coordinates',
      width: 180
    },
    {
      headerName: 'Property Name',
      field: 'property_name',
      width: 180
    },
    {
      headerName: 'Address',
      field: 'address',
      width: 220
    },
    {
      headerName: 'District',
      field: 'district',
      width: 150
    },
    {
      headerName: 'Province',
      field: 'province',
      width: 150
    },
    {
      headerName: 'Category',
      field: 'category',
      width: 150
    },
    {
      headerName: 'Hectrage',
      field: 'hectrage',
      type: 'numericColumn',
      width: 120
    },
    {
      headerName: 'Crop',
      field: 'crop',
      width: 150
    },
    {
      headerName: 'Crop Category',
      field: 'crop_category',
      width: 180
    },
    {
      headerName: 'Start Date',
      field: 'agreement_start_date',
      width: 140
    },
    {
      headerName: 'Expiry Date',
      field: 'agreement_expiry_date',
      width: 140
    },
    {
      headerName: 'Length (months)',
      field: 'agreement_length_months',
      type: 'numericColumn',
      width: 140,
      cellStyle: { backgroundColor: '#F9FAFB' }
    },
    {
      headerName: 'Water Allocated (ML)',
      field: 'water_allocated_ml',
      type: 'numericColumn',
      width: 160
    }
  ], [StatusIconRenderer, ClientNameRenderer, navigate]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true
  }), []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading RW database...</p>
      </div>
    );
  }

  if (dams.length === 0) {
    return (
      <div className="bg-blue-50 rounded-lg shadow-sm p-12 text-center border border-blue-200">
        <AlertCircle className="w-16 h-16 text-blue-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No dams registered</h3>
        <p className="text-gray-600">This service centre has no dams. Register dams first to manage water allocations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-lg font-bold text-gray-900">RW Database</p>
        <div className="flex gap-3">
          {mode === 'view' ? (
            <>
              <button
                onClick={() => setMode('edit')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Edit Database
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSaveAll}
                disabled={saving || allocations.filter(a => a.status !== 'saved').length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save All'}
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => {
                  setMode('view');
                  loadData();
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
            rowData={allocations}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            onGridReady={(params: GridReadyEvent) => params.api}
            pagination={true}
            paginationPageSize={20}
            suppressMovableColumns={false}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            animateRows={true}
            enableRangeSelection={true}
          />
        </div>
      )}

      {mode === 'edit' && (
        <div className="overflow-auto" style={{ height: 'calc(100vh - 250px)' }}>
          <ExcelLikeTable className="w-full border-collapse bg-white shadow-sm" onPaste={handleTablePaste}>
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Client / Company</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Source</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Farm Coords</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Property Name</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Address</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">District</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Province</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Category</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Hectrage</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Crop</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Crop Category</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Start Date</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Expiry Date</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left bg-gray-100">Length (mo)</th>
                <th className="border border-gray-300 px-2 py-1 text-xs font-extrabold text-gray-700 text-left">Water (ML)</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((allocation) => (
                <tr
                  key={allocation.allocation_id}
                  className={
                    allocation.status === 'new' ? 'bg-blue-50' :
                    allocation.status === 'modified' ? 'bg-yellow-50' : ''
                  }
                >
                  <td className="border border-gray-300 p-0">
                    <span className="px-2 text-sm block h-7 flex items-center" style={{ minWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {allocation.client_company_name}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <DamSearchSelect
                      value={allocation.source || ''}
                      dams={dams}
                      onChange={(val) => handleInputChange(allocation.allocation_id, 'source', val)}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.farm_coordinates || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'farm_coordinates', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '140px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.property_name || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'property_name', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '150px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.address || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'address', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '180px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.district || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'district', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.province || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'province', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <select
                      value={allocation.category || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'category', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    >
                      <option value="">Select...</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={allocation.hectrage || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'hectrage', e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '100px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={allocation.crop || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'crop', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <select
                      value={allocation.crop_category || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'crop_category', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '150px', height: '28px' }}
                    >
                      <option value="">Select...</option>
                      {CROP_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="date"
                      value={allocation.agreement_start_date || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'agreement_start_date', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="date"
                      value={allocation.agreement_expiry_date || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'agreement_expiry_date', e.target.value)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '130px', height: '28px' }}
                    />
                  </td>
                  <td className="border border-gray-300 p-0 bg-gray-50">
                    <span className="px-2 text-sm block text-center h-7 flex items-center" style={{ minWidth: '80px' }}>
                      {allocation.agreement_length_months ?? '-'}
                    </span>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={allocation.water_allocated_ml || ''}
                      onChange={(e) => handleInputChange(allocation.allocation_id, 'water_allocated_ml', e.target.value ? parseFloat(e.target.value) : 0)}
                      className="w-full px-2 text-sm border-0 focus:ring-1 focus:ring-blue-500"
                      style={{ minWidth: '120px', height: '28px' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </ExcelLikeTable>
        </div>
      )}
    </div>
  );
}
