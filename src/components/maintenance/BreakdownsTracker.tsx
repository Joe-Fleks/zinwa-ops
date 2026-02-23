import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Pencil, X, Save, Loader2, Trash2, Wrench, ChevronDown, Calendar, Filter } from 'lucide-react';
import { getYesterdayString } from '../../lib/dateUtils';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const IMPACT_OPTIONS = [
  'Stopped pumping',
  'Increased water losses',
  'Lower Operational Efficiency',
  'Not Significant',
] as const;

const CATEGORY_FILTERS = [
  { label: 'Pending', keywords: [] },
  { label: 'All breakdowns', keywords: [] },
  { label: 'Pumps', keywords: ['pump', 'motor', 'impeller', 'bearing', 'starter'] },
  { label: 'Pumping Mains', keywords: ['main', 'pipeline', 'pipe', 'rising main', 'pumping main', 'burst'] },
  { label: 'Reticulation', keywords: ['reticulation', 'distribution', 'network', 'valve', 'meter', 'leak'] },
  { label: 'Storage Facilities', keywords: ['tank', 'reservoir', 'storage', 'dam', 'sump'] },
  { label: 'Vehicle/Bike', keywords: ['vehicle', 'bike', 'car', 'truck', 'motorbike', 'transport'] },
] as const;

type ViewMode = 'date' | 'month';

interface Station {
  id: string;
  station_name: string;
}

interface BreakdownRow {
  id: string | null;
  station_id: string;
  station_name: string;
  date_reported: string;
  date_resolved: string;
  job_card_no: string;
  nature_of_breakdown: string;
  possible_root_cause: string;
  suggested_solutions: string;
  details_of_work: string;
  breakdown_impact: string;
  hours_lost: number;
  time_to_repair_days: number;
  remarks: string;
  is_resolved: boolean;
  _isNew: boolean;
  _isDirty: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYesterdayParts() {
  const yesterday = getYesterdayString();
  const [y, m, d] = yesterday.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function createEmptyRow(): BreakdownRow {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: null,
    station_id: '',
    station_name: '',
    date_reported: today,
    date_resolved: '',
    job_card_no: '',
    nature_of_breakdown: '',
    possible_root_cause: '',
    suggested_solutions: '',
    details_of_work: '',
    breakdown_impact: 'Not Significant',
    hours_lost: 0,
    time_to_repair_days: 0,
    remarks: '',
    is_resolved: false,
    _isNew: true,
    _isDirty: true,
  };
}

function formatDateGB(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB');
}

function getImpactBadge(impact: string): { bg: string; text: string } {
  switch (impact) {
    case 'Stopped pumping': return { bg: '#fef2f2', text: '#b91c1c' };
    case 'Increased water losses': return { bg: '#fff7ed', text: '#c2410c' };
    case 'Lower Operational Efficiency': return { bg: '#fffbeb', text: '#b45309' };
    default: return { bg: '#f3f4f6', text: '#4b5563' };
  }
}

export default function BreakdownsTracker() {
  const { user, accessContext } = useAuth();
  const gridRef = useRef<AgGridReact>(null);
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [editRows, setEditRows] = useState<BreakdownRow[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('Pending');
  const [impactFilter, setImpactFilter] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const yesterdayParts = useMemo(() => getYesterdayParts(), []);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedYear, setSelectedYear] = useState(yesterdayParts.year);
  const [selectedMonth, setSelectedMonth] = useState(yesterdayParts.month);
  const [selectedDay, setSelectedDay] = useState(yesterdayParts.day);

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2019 }, (_, i) => 2020 + i).reverse();
  }, []);

  const daysInSelectedMonth = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  useEffect(() => {
    if (selectedDay > daysInSelectedMonth) {
      setSelectedDay(daysInSelectedMonth);
    }
  }, [daysInSelectedMonth, selectedDay]);

  const dateRange = useMemo(() => {
    if (viewMode === 'date') {
      const ds = buildDateString(selectedYear, selectedMonth, selectedDay);
      return { start: ds, end: ds };
    }
    const lastDay = getDaysInMonth(selectedYear, selectedMonth);
    return {
      start: buildDateString(selectedYear, selectedMonth, 1),
      end: buildDateString(selectedYear, selectedMonth, lastDay),
    };
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'date') {
      const d = new Date(selectedYear, selectedMonth - 1, selectedDay);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  useEffect(() => { loadStations(); }, [accessContext?.scopeId]);
  useEffect(() => { if (stations.length > 0) loadBreakdowns(); }, [stations, dateRange]);

  const loadStations = async () => {
    const allowedSCIds = accessContext?.allowedServiceCentreIds || [];
    if (allowedSCIds.length === 0) { setStations([]); return; }
    let query = supabase.from('stations').select('id, station_name').order('station_name');
    if (allowedSCIds.length <= 50) query = query.in('service_centre_id', allowedSCIds);
    const { data } = await query;
    setStations(data || []);
  };

  const loadBreakdowns = async () => {
    setLoading(true);
    setError('');
    try {
      const allowedSCIds = accessContext?.allowedServiceCentreIds || [];
      if (allowedSCIds.length === 0) { setRows([]); return; }
      const stationMap = new Map(stations.map(s => [s.id, s.station_name]));
      let query = supabase
        .from('station_breakdowns')
        .select('*')
        .gte('date_reported', dateRange.start)
        .lte('date_reported', dateRange.end)
        .order('date_reported', { ascending: false });
      if (allowedSCIds.length <= 50) query = query.in('service_centre_id', allowedSCIds);
      const { data, error: err } = await query;
      if (err) throw err;
      const mapped = (data || []).map((b: any) => ({
        id: b.id,
        station_id: b.station_id,
        station_name: stationMap.get(b.station_id) || 'Unknown',
        date_reported: b.date_reported || '',
        date_resolved: b.date_resolved || '',
        job_card_no: b.job_card_no || '',
        nature_of_breakdown: b.nature_of_breakdown || '',
        possible_root_cause: b.possible_root_cause || '',
        suggested_solutions: b.suggested_solutions || '',
        details_of_work: b.details_of_work || '',
        breakdown_impact: b.breakdown_impact || 'Not Significant',
        hours_lost: b.hours_lost || 0,
        time_to_repair_days: b.time_to_repair_days || 0,
        remarks: b.remarks || '',
        is_resolved: b.is_resolved || false,
        _isNew: false,
        _isDirty: false,
      }));
      setRows(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load breakdowns');
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = useCallback((rowIdx: number, field: string, value: any) => {
    setEditRows(prev => {
      const updated = [...prev];
      const row = { ...updated[rowIdx], [field]: value, _isDirty: true };
      if (field === 'station_id') {
        const st = stations.find(s => s.id === value);
        row.station_name = st?.station_name || '';
      }
      if (field === 'date_resolved' && value) row.is_resolved = true;
      updated[rowIdx] = row;
      return updated;
    });
  }, [stations]);

  const handleAddRow = useCallback(() => {
    setEditRows(prev => [createEmptyRow(), ...prev]);
    if (!editing) {
      setEditRows([createEmptyRow(), ...rows]);
      setEditing(true);
    }
  }, [editing, rows]);

  const removeNewRow = useCallback((idx: number) => {
    setEditRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDelete = async (row: BreakdownRow) => {
    if (!row.id || row._isNew) return;
    if (!window.confirm('Delete this breakdown record? This cannot be undone.')) return;
    setDeletingId(row.id);
    try {
      const { error: err } = await supabase.from('station_breakdowns').delete().eq('id', row.id);
      if (err) throw err;
      setRows(prev => prev.filter(r => r.id !== row.id));
      setEditRows(prev => prev.filter(r => r.id !== row.id));
      setSaveMsg('Breakdown deleted');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const saveRow = async (row: BreakdownRow) => {
    const allowedSCIds = accessContext?.allowedServiceCentreIds || [];
    const serviceCentreId = accessContext?.isSCScoped
      ? accessContext.scopeId
      : allowedSCIds[0] || null;
    const record: any = {
      station_id: row.station_id,
      date_reported: row.date_reported,
      date_resolved: row.date_resolved || null,
      job_card_no: row.job_card_no || '',
      nature_of_breakdown: row.nature_of_breakdown || '',
      possible_root_cause: row.possible_root_cause || '',
      suggested_solutions: row.suggested_solutions || '',
      details_of_work: row.details_of_work || '',
      breakdown_impact: row.breakdown_impact || 'Not Significant',
      hours_lost: row.hours_lost || 0,
      time_to_repair_days: row.time_to_repair_days || 0,
      remarks: row.remarks || '',
      is_resolved: !!row.date_resolved,
      description: row.nature_of_breakdown || '',
    };
    if (row._isNew) {
      record.reported_by = user?.id;
      record.service_centre_id = serviceCentreId;
      const { error } = await supabase.from('station_breakdowns').insert([record]);
      if (error) throw error;
    } else {
      record.updated_at = new Date().toISOString();
      if (row.date_resolved) record.resolved_by = user?.id;
      const { error } = await supabase.from('station_breakdowns').update(record).eq('id', row.id);
      if (error) throw error;
    }
  };

  const handleSave = async () => {
    const dirtyRows = editRows.filter(r => r._isDirty);
    if (dirtyRows.length === 0) { setEditing(false); return; }
    const invalid = dirtyRows.filter(r => !r.station_id || !r.date_reported);
    if (invalid.length > 0) { setError('Station and Date Occurred are required'); return; }
    setSaving(true);
    setError('');
    setSaveMsg('');
    try {
      for (const row of dirtyRows) await saveRow(row);
      setSaveMsg(`${dirtyRows.length} breakdown(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      setEditing(false);
      await loadBreakdowns();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = useCallback(() => {
    setEditRows(rows.map(r => ({ ...r, _isDirty: false })));
    setEditing(true);
  }, [rows]);

  const handleCancel = useCallback(() => {
    setEditRows([]);
    setEditing(false);
    setError('');
  }, []);

  const filteredRows = useMemo(() => {
    const source = editing ? editRows : rows;
    let result = source;

    if (categoryFilter === 'Pending') {
      result = result.filter(r => !r.date_resolved);
    } else if (categoryFilter !== 'All breakdowns') {
      const cat = CATEGORY_FILTERS.find(c => c.label === categoryFilter);
      if (cat && cat.keywords.length > 0) {
        result = result.filter(r => {
          const searchText = `${r.nature_of_breakdown} ${r.possible_root_cause} ${r.suggested_solutions}`.toLowerCase();
          return cat.keywords.some(kw => searchText.includes(kw));
        });
      }
    }

    if (impactFilter) {
      result = result.filter(r => r.breakdown_impact === impactFilter);
    }

    return result;
  }, [rows, editRows, editing, categoryFilter, impactFilter]);

  const scFullName = accessContext?.serviceCentre?.name || '';
  const scName = scFullName.replace(/\s*Service\s+Cent(?:re|er)\s*/i, ' ').trim() + (scFullName ? ' SC' : '');
  const totalSource = editing ? editRows : rows;
  const dirtyCount = editRows.filter(r => r._isDirty).length;
  const stoppedCount = rows.filter(r => r.breakdown_impact === 'Stopped pumping' && !r.date_resolved).length;

  const selectClass = 'appearance-none bg-white border border-gray-300 rounded-md px-2 py-1 pr-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors cursor-pointer hover:border-gray-400';
  const inputCls = 'w-full px-1.5 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 focus:bg-white rounded';

  const ImpactCellRenderer = useCallback((params: any) => {
    const impact = params.value || 'Not Significant';
    const badge = getImpactBadge(impact);
    return (
      <span
        style={{ backgroundColor: badge.bg, color: badge.text }}
        className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      >
        {impact}
      </span>
    );
  }, []);

  const DeleteCellRenderer = useCallback((params: any) => {
    const row = params.data as BreakdownRow;
    if (!row?.id) return null;
    return (
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
        disabled={deletingId === row.id}
        className="text-red-400 hover:text-red-600 disabled:opacity-40 p-0.5"
        title="Delete breakdown"
      >
        {deletingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    );
  }, [deletingId]);

  const agColumnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Station',
      field: 'station_name',
      pinned: 'left',
      width: 160,
      minWidth: 130,
      sortable: true,
      filter: true,
      cellClass: 'font-medium',
    },
    {
      headerName: 'Date Occurred',
      field: 'date_reported',
      width: 120,
      sortable: true,
      filter: true,
      valueFormatter: (p: any) => formatDateGB(p.value),
    },
    {
      headerName: 'Date Resolved',
      field: 'date_resolved',
      width: 120,
      sortable: true,
      filter: true,
      valueFormatter: (p: any) => formatDateGB(p.value),
    },
    {
      headerName: 'Job Card No.',
      field: 'job_card_no',
      width: 110,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Nature of Breakdown',
      field: 'nature_of_breakdown',
      width: 180,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Possible Root Cause',
      field: 'possible_root_cause',
      width: 170,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Suggested Solutions',
      field: 'suggested_solutions',
      width: 170,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Details of Work',
      field: 'details_of_work',
      width: 180,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Breakdown Impact',
      field: 'breakdown_impact',
      width: 170,
      sortable: true,
      filter: true,
      cellRenderer: ImpactCellRenderer,
    },
    {
      headerName: 'Hrs Lost',
      field: 'hours_lost',
      width: 90,
      sortable: true,
      filter: true,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value > 0 ? String(p.value) : '-',
    },
    {
      headerName: 'Repair (Days)',
      field: 'time_to_repair_days',
      width: 110,
      sortable: true,
      filter: true,
      type: 'numericColumn',
      valueFormatter: (p: any) => p.value > 0 ? String(p.value) : '-',
    },
    {
      headerName: 'Remarks',
      field: 'remarks',
      width: 160,
      sortable: true,
      filter: true,
    },
    {
      headerName: '',
      field: '_delete',
      width: 50,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: DeleteCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    },
  ], [ImpactCellRenderer, DeleteCellRenderer]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
  }), []);

  const getRowStyle = useCallback((params: any) => {
    if (!params.data) return {};
    if (params.data.breakdown_impact === 'Stopped pumping' && !params.data.date_resolved) {
      return { backgroundColor: '#fef2f2' };
    }
    return {};
  }, []);

  const getRowId = useCallback((params: any) => {
    return params.data?.id || `new_${params.rowIndex}`;
  }, []);

  type EditColConfig = {
    key: string;
    header: string;
    width: number;
    editRender: (row: BreakdownRow, idx: number) => React.ReactNode;
  };

  const editColumns: EditColConfig[] = useMemo(() => [
    {
      key: 'date_reported', header: 'Date Occurred', width: 115,
      editRender: (r: BreakdownRow, i: number) => <input type="date" value={r.date_reported} onChange={e => handleCellChange(i, 'date_reported', e.target.value)} className={inputCls} />,
    },
    {
      key: 'date_resolved', header: 'Date Resolved', width: 115,
      editRender: (r: BreakdownRow, i: number) => <input type="date" value={r.date_resolved} onChange={e => handleCellChange(i, 'date_resolved', e.target.value)} className={inputCls} />,
    },
    {
      key: 'job_card_no', header: 'Job Card No.', width: 100,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.job_card_no} onChange={e => handleCellChange(i, 'job_card_no', e.target.value)} className={inputCls} />,
    },
    {
      key: 'nature_of_breakdown', header: 'Nature of Breakdown', width: 170,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.nature_of_breakdown} onChange={e => handleCellChange(i, 'nature_of_breakdown', e.target.value)} className={inputCls} />,
    },
    {
      key: 'possible_root_cause', header: 'Possible Root Cause', width: 160,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.possible_root_cause} onChange={e => handleCellChange(i, 'possible_root_cause', e.target.value)} className={inputCls} />,
    },
    {
      key: 'suggested_solutions', header: 'Suggested Solutions', width: 160,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.suggested_solutions} onChange={e => handleCellChange(i, 'suggested_solutions', e.target.value)} className={inputCls} />,
    },
    {
      key: 'details_of_work', header: 'Details of Work', width: 170,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.details_of_work} onChange={e => handleCellChange(i, 'details_of_work', e.target.value)} className={inputCls} />,
    },
    {
      key: 'breakdown_impact', header: 'Breakdown Impact', width: 160,
      editRender: (r: BreakdownRow, i: number) => {
        const colorCls =
          r.breakdown_impact === 'Stopped pumping' ? 'text-red-700 font-medium' :
          r.breakdown_impact === 'Increased water losses' ? 'text-orange-700 font-medium' :
          r.breakdown_impact === 'Lower Operational Efficiency' ? 'text-amber-700 font-medium' : '';
        return (
          <select
            value={r.breakdown_impact}
            onChange={e => handleCellChange(i, 'breakdown_impact', e.target.value)}
            className={`${inputCls} pr-4 ${colorCls}`}
          >
            {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      },
    },
    {
      key: 'hours_lost', header: 'Hrs Lost', width: 80,
      editRender: (r: BreakdownRow, i: number) => (
        <input type="number" value={r.hours_lost ?? 0}
          onChange={e => handleCellChange(i, 'hours_lost', parseFloat(e.target.value) || 0)}
          onFocus={e => { if (e.target.value === '0') e.target.select(); }}
          className={`${inputCls} text-right`} step="0.1" min="0" />
      ),
    },
    {
      key: 'time_to_repair_days', header: 'Repair (Days)', width: 95,
      editRender: (r: BreakdownRow, i: number) => (
        <input type="number" value={r.time_to_repair_days ?? 0}
          onChange={e => handleCellChange(i, 'time_to_repair_days', parseInt(e.target.value) || 0)}
          onFocus={e => { if (e.target.value === '0') e.target.select(); }}
          className={`${inputCls} text-right`} step="1" min="0" />
      ),
    },
    {
      key: 'remarks', header: 'Remarks', width: 150,
      editRender: (r: BreakdownRow, i: number) => <input type="text" value={r.remarks} onChange={e => handleCellChange(i, 'remarks', e.target.value)} className={inputCls} />,
    },
  ], [handleCellChange, inputCls]);

  const STATION_COL_WIDTH = 160;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading breakdowns...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className={selectClass}
            >
              {CATEGORY_FILTERS.map(c => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="w-px h-5 bg-gray-300" />

          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">View by:</span>

          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            <button
              onClick={() => setViewMode('date')}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                viewMode === 'date' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm font-medium transition-colors border-l border-gray-300 ${
                viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Month
            </button>
          </div>

          <div className="relative">
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={selectClass}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className={selectClass}>
              {MONTH_NAMES.map((name, idx) => <option key={idx} value={idx + 1}>{name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {viewMode === 'date' && (
            <div className="relative">
              <select value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))} className={selectClass}>
                {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <div className="w-px h-5 bg-gray-300" />

          <div className="relative">
            <select
              value={impactFilter}
              onChange={e => setImpactFilter(e.target.value)}
              className={`${selectClass} ${impactFilter ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
            >
              <option value="">Filter by impact</option>
              {IMPACT_OPTIONS.map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {stoppedCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-md px-2.5 py-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-semibold text-red-700">
                {stoppedCount} unresolved stopping pumping
              </span>
            </div>
          )}

          <div className="ml-auto text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg whitespace-nowrap">
            {filteredRows.length === totalSource.length
              ? `${totalSource.length} ${totalSource.length === 1 ? 'entry' : 'entries'} for ${periodLabel}`
              : `${filteredRows.length} of ${totalSource.length} entries for ${periodLabel}`
            }
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                <X className="w-4 h-4" />Cancel
              </button>
              <button
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />Add Breakdown
              </button>
              {dirtyCount > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save ({dirtyCount})
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                <Pencil className="w-4 h-4" />Edit
              </button>
              <button
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />Add Breakdown
              </button>
            </>
          )}
        </div>
        {saveMsg && <span className="text-sm text-green-700 font-medium">{saveMsg}</span>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      {filteredRows.length === 0 && !editing ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <Wrench className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          {rows.length > 0 && filteredRows.length === 0 ? (
            <>
              <h3 className="text-base font-medium text-gray-900 mb-1">No matching breakdowns</h3>
              <p className="text-sm text-gray-500">
                {rows.length} breakdown{rows.length !== 1 ? 's' : ''} exist for {periodLabel} but none match the current filters
              </p>
              <button
                onClick={() => { setCategoryFilter('All breakdowns'); setImpactFilter(''); }}
                className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-medium text-gray-900 mb-1">No breakdowns recorded</h3>
              <p className="text-sm text-gray-500">Click "Add Breakdown" to log a new breakdown for {periodLabel}</p>
            </>
          )}
        </div>
      ) : editing ? (
        <div className="overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: 'calc(100vh - 340px)' }}>
          <table className="border-collapse text-xs min-w-max w-full">
            <thead className="sticky top-0 z-20">
              <tr>
                <th
                  className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                  style={{ minWidth: STATION_COL_WIDTH }}
                >
                  Station
                </th>
                {editColumns.map(col => (
                  <th
                    key={col.key}
                    className="bg-gray-100 border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                    style={{ minWidth: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="bg-gray-100 border border-gray-300 px-1 py-2" style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const rowIdx = editRows.indexOf(row);
                return (
                  <tr key={row.id || `new_${rowIdx}`} className="bg-white hover:bg-gray-50 transition-colors">
                    <td
                      className="sticky left-0 z-10 bg-inherit border border-gray-200 px-1 py-0.5"
                      style={{ minWidth: STATION_COL_WIDTH, backgroundColor: 'inherit' }}
                    >
                      <select value={row.station_id} onChange={e => handleCellChange(rowIdx, 'station_id', e.target.value)} className={`${inputCls} pr-4`}>
                        <option value="">Select station...</option>
                        {scName && (
                          <optgroup label={scName}>
                            {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                          </optgroup>
                        )}
                        {!scName && stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                      </select>
                    </td>
                    {editColumns.map(col => (
                      <td key={col.key} className="border border-gray-200 px-1 py-0.5">
                        {col.editRender(row, rowIdx)}
                      </td>
                    ))}
                    <td className="border border-gray-200 px-1 py-0.5 text-center">
                      {row._isNew ? (
                        <button onClick={() => removeNewRow(rowIdx)} className="text-red-400 hover:text-red-600" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="text-red-400 hover:text-red-600 disabled:opacity-40"
                          title="Delete"
                        >
                          {deletingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200"
          style={{ width: '100%' }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={filteredRows}
            columnDefs={agColumnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            getRowStyle={getRowStyle}
            domLayout="autoHeight"
            suppressMovableColumns={true}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            animateRows={true}
          />
        </div>
      )}
    </div>
  );
}
