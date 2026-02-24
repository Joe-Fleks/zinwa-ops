import { useState, useEffect, useCallback, useRef, useMemo, forwardRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Pencil, X, Save, Loader2, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import { FET } from '../FET';
import type { FETRef, FETColumn } from '../FET';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef as AgColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Station {
  id: string;
  station_name: string;
}

interface SalesRow {
  station_id: string;
  station_name: string;
  expected_sales_m3: number;
  returns_volume_m3: number;
  sage_sales_volume_m3: number;
  billing_variance_percent: number;
  existing_record_id: string | null;
  isModified: boolean;
  isTouched: boolean;
  errors: string[];
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

const SALES_COLUMNS: FETColumn[] = [
  { header: 'Returns (m\u00B3)', field: 'returns_volume_m3', type: 'number', minWidth: 140 },
  { header: 'Sage Sales (m\u00B3)', field: 'sage_sales_volume_m3', type: 'number', minWidth: 150 },
];

const calcVariance = (returns: number, sage: number): number => {
  if (returns === 0 && sage === 0) return 0;
  const base = Math.max(returns, sage);
  if (base === 0) return 0;
  return Math.round((Math.abs(returns - sage) / base) * 10000) / 100;
};

const isDefaultRow = (row: Record<string, any>): boolean => {
  return row.returns_volume_m3 === 0 && row.sage_sales_volume_m3 === 0 && !row.existing_record_id;
};

export interface SalesDataTabProps {
  initialFilter?: 'all' | 'pending';
}

export default function SalesDataTab({ initialFilter = 'all' }: SalesDataTabProps) {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const fetRef = useRef<FETRef>(null);

  const [stations, setStations] = useState<Station[]>([]);
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [pendingStationIds, setPendingStationIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [viewFilter, setViewFilter] = useState<'all' | 'pending'>(initialFilter);

  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);

  useEffect(() => {
    fetchStations();
  }, [accessContext?.scopeId]);

  useEffect(() => {
    if (stations.length > 0) {
      loadSalesData();
    }
  }, [stations, selectedYear, selectedMonth]);

  useEffect(() => {
    setViewFilter(initialFilter);
  }, [initialFilter]);

  const fetchStations = async () => {
    try {
      let query = supabase
        .from('stations')
        .select('id, station_name, service_centre_id')
        .order('station_name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error fetching stations:', error);
      setMessage({ type: 'error', text: 'Failed to load stations' });
    }
  };

  const loadSalesData = async () => {
    setLoading(true);
    try {
      const stationIds = stations.map(s => s.id);

      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
      const prevMonthEnd = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;

      const [recordsRes, prevProdRes] = await Promise.all([
        supabase
          .from('sales_records')
          .select('id, station_id, returns_volume_m3, sage_sales_volume_m3')
          .eq('year', selectedYear)
          .eq('month', selectedMonth)
          .in('station_id', stationIds),
        supabase
          .from('production_logs')
          .select('station_id, cw_volume_m3')
          .in('station_id', stationIds)
          .gte('date', prevMonthStart)
          .lt('date', prevMonthEnd),
      ]);

      if (recordsRes.error) throw recordsRes.error;

      const recordMap = new Map(
        (recordsRes.data || []).map(r => [r.station_id, r])
      );

      const prevProdByStation = new Map<string, number>();
      for (const log of (prevProdRes.data || [])) {
        const existing = prevProdByStation.get(log.station_id) || 0;
        prevProdByStation.set(log.station_id, existing + Number(log.cw_volume_m3 || 0));
      }

      const newPendingIds = new Set<string>();
      const salesRows: SalesRow[] = stations.map(station => {
        const record = recordMap.get(station.id);
        const returns = record ? Number(record.returns_volume_m3) : 0;
        const sage = record ? Number(record.sage_sales_volume_m3) : 0;

        const prevCwVolume = prevProdByStation.get(station.id) || 0;
        if (!record && prevCwVolume > 0) {
          newPendingIds.add(station.id);
        }

        const expectedSales = Math.round(prevCwVolume * 0.75);

        return {
          station_id: station.id,
          station_name: station.station_name,
          expected_sales_m3: expectedSales,
          returns_volume_m3: returns,
          sage_sales_volume_m3: sage,
          billing_variance_percent: calcVariance(returns, sage),
          existing_record_id: record?.id || null,
          isModified: false,
          isTouched: false,
          errors: [],
        };
      });

      setRows(salesRows);
      setPendingStationIds(newPendingIds);
    } catch (error) {
      console.error('Error loading sales data:', error);
      setMessage({ type: 'error', text: 'Failed to load sales records' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = useCallback((index: number, field: string, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      (row as any)[field] = value;
      row.isTouched = true;
      row.isModified = true;

      const returns = Number(row.returns_volume_m3) || 0;
      const sage = Number(row.sage_sales_volume_m3) || 0;
      row.billing_variance_percent = calcVariance(returns, sage);

      updated[index] = row;
      return updated;
    });
  }, []);

  const handleSave = async () => {
    if (!user) return;
    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    fetRef.current?.flushPendingEdits();

    const dirtyRows = rows.filter(r => r.isModified || r.isTouched);
    if (dirtyRows.length === 0) {
      setMessage({ type: 'error', text: 'No changes to save' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const upserts = dirtyRows.map(row => ({
        station_id: row.station_id,
        year: selectedYear,
        month: selectedMonth,
        returns_volume_m3: row.returns_volume_m3,
        sage_sales_volume_m3: row.sage_sales_volume_m3,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from('sales_records')
        .upsert(upserts, { onConflict: 'station_id,year,month' });

      if (error) throw error;

      setMessage({ type: 'success', text: `${dirtyRows.length} record(s) saved successfully` });
      await loadSalesData();
      setEditing(false);
    } catch (error: any) {
      console.error('Error saving sales data:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save records' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setMessage(null);
    loadSalesData();
  };

  const filteredRows = useMemo(() => {
    if (viewFilter === 'pending') {
      return rows.filter(r => pendingStationIds.has(r.station_id));
    }
    return rows;
  }, [rows, viewFilter, pendingStationIds]);

  const dirtyCount = rows.filter(r => r.isModified || r.isTouched).length;
  const pendingCount = pendingStationIds.size;
  const totalCount = stations.length;

  if (loading && stations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading sales data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-lg font-bold text-gray-900">Sales Records</p>
        <p className="text-sm text-gray-600 mt-1">
          Enter returns from meter readings and SAGE billing volumes. Billing variance is calculated automatically.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            disabled={editing}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {MONTHS.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            disabled={editing}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 border border-gray-300">
            <Filter className="w-3.5 h-3.5 text-gray-500 ml-1" />
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Stations
            </button>
            <button
              onClick={() => setViewFilter('pending')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                viewFilter === 'pending'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Returns
              {pendingCount > 0 && (
                <span className={`inline-flex items-center justify-center w-4 h-4 text-xs rounded-full font-bold ${
                  viewFilter === 'pending' ? 'bg-blue-400 text-white' : 'bg-amber-200 text-amber-800'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {editing && (
            <span className="text-xs text-gray-500 italic">
              Filters locked while editing
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => { setEditing(true); setMessage(null); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || dirtyCount === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-200 text-blue-900 rounded-lg text-sm font-medium hover:bg-blue-300 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
              </button>
            </>
          )}
        </div>
      </div>


      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading sales data...</p>
        </div>
      ) : stations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <h3 className="text-base font-medium text-gray-900 mb-1">No stations found</h3>
          <p className="text-sm text-gray-500">Register stations in the CW Stations tab first</p>
        </div>
      ) : viewFilter === 'pending' && filteredRows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">All returns submitted</h3>
          <p className="text-sm text-gray-500">No stations are pending returns for this month.</p>
        </div>
      ) : editing ? (
        <>
          <SalesEditTable
            ref={fetRef}
            rows={filteredRows}
            onUpdate={(index, field, value) => {
              const actualIndex = rows.findIndex(r => r.station_id === filteredRows[index].station_id);
              if (actualIndex !== -1) handleUpdate(actualIndex, field, value);
            }}
          />
          <ScTotalBar rows={filteredRows} />
        </>
      ) : (
        <SalesReadTable rows={filteredRows} />
      )}
    </div>
  );
}

interface SalesEditTableProps {
  rows: SalesRow[];
  onUpdate: (index: number, field: string, value: any) => void;
}

const SalesEditTable = forwardRef<FETRef, SalesEditTableProps>(
  ({ rows, onUpdate }, ref) => {
    return (
      <FET
        ref={ref}
        data={rows}
        columns={SALES_COLUMNS}
        labelColumn={{ header: 'Station', field: 'station_name', minWidth: 180 }}
        onUpdate={onUpdate}
        rowKey={(row) => row.station_id}
        isDefaultRow={isDefaultRow}
        savedField="existing_record_id"
        errorsField="errors"
        touchedField="isTouched"
        modifiedField="isModified"
        height="calc(100vh - 380px)"
      />
    );
  }
);

const VarianceCellRenderer = (params: any) => {
  const value = params.value;
  const hasData = params.data?.existing_record_id || params.data?.returns_volume_m3 > 0 || params.data?.sage_sales_volume_m3 > 0;
  if (!hasData) return <span className="text-gray-400">-</span>;

  let colorClass = 'bg-green-100 text-green-800';
  if (value >= 10) {
    colorClass = 'bg-red-100 text-red-800';
  } else if (value >= 5) {
    colorClass = 'bg-amber-100 text-amber-800';
  }

  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {value.toFixed(1)}%
    </span>
  );
};

const numberFormatter = (params: any) => {
  if (params.value === null || params.value === undefined) return '-';
  return params.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function SalesReadTable({ rows }: { rows: SalesRow[] }) {
  const columnDefs = useMemo<AgColDef[]>(() => [
    {
      headerName: 'Station',
      field: 'station_name',
      pinned: 'left',
      minWidth: 200,
      flex: 1,
      cellClass: 'font-medium',
    },
    {
      headerName: 'Expected Sales (m\u00B3)',
      field: 'expected_sales_m3',
      type: 'numericColumn',
      minWidth: 170,
      valueFormatter: (params: any) => {
        if (params.node?.rowPinned === 'bottom') return '-';
        if (!params.value && params.value !== 0) return '-';
        if (params.value === 0) return '-';
        return params.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      },
      cellStyle: { color: '#6b7280', fontStyle: 'italic' },
    },
    {
      headerName: 'Returns (m\u00B3)',
      field: 'returns_volume_m3',
      type: 'numericColumn',
      minWidth: 140,
      valueFormatter: numberFormatter,
    },
    {
      headerName: 'Sage Sales (m\u00B3)',
      field: 'sage_sales_volume_m3',
      type: 'numericColumn',
      minWidth: 150,
      valueFormatter: numberFormatter,
    },
    {
      headerName: 'Billing Variance (%)',
      field: 'billing_variance_percent',
      minWidth: 160,
      cellRenderer: VarianceCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end' },
    },
  ], []);

  const defaultColDef = useMemo<AgColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    suppressMovable: true,
  }), []);

  const pinnedBottomRowData = useMemo(() => {
    const totalReturns = rows.reduce((sum, r) => sum + (r.returns_volume_m3 || 0), 0);
    const totalSage = rows.reduce((sum, r) => sum + (r.sage_sales_volume_m3 || 0), 0);
    return [{
      station_id: '__sc_total__',
      station_name: 'SC Total',
      expected_sales_m3: 0,
      returns_volume_m3: totalReturns,
      sage_sales_volume_m3: totalSage,
      billing_variance_percent: calcVariance(totalReturns, totalSage),
      existing_record_id: '__total__',
    }];
  }, [rows]);

  const getRowStyle = useCallback((params: any) => {
    const row = params.data;
    if (!row) return {};
    if (params.node.rowPinned === 'bottom') {
      return { background: '#eff6ff', fontWeight: '700', borderTop: '2px solid #93c5fd' };
    }
    const hasData = row.existing_record_id || row.returns_volume_m3 > 0 || row.sage_sales_volume_m3 > 0;
    if (!hasData) return { background: '#f9fafb', color: '#9ca3af' };
    return {};
  }, []);

  return (
    <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: 'calc(100vh - 380px)', width: '100%' }}>
      <AgGridReact
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={(params) => params.data.station_id}
        getRowStyle={getRowStyle}
        pinnedBottomRowData={pinnedBottomRowData}
        suppressDragLeaveHidesColumns
        suppressMovableColumns
        animateRows={false}
        domLayout="normal"
      />
    </div>
  );
}

function ScTotalBar({ rows }: { rows: SalesRow[] }) {
  const totalReturns = rows.reduce((sum, r) => sum + (r.returns_volume_m3 || 0), 0);
  const totalSage = rows.reduce((sum, r) => sum + (r.sage_sales_volume_m3 || 0), 0);
  const totalVariance = calcVariance(totalReturns, totalSage);

  let varianceColor = 'text-green-700 bg-green-100';
  if (totalVariance >= 10) varianceColor = 'text-red-700 bg-red-100';
  else if (totalVariance >= 5) varianceColor = 'text-amber-700 bg-amber-100';

  return (
    <div className="flex items-center gap-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-800">
      <span className="min-w-[120px]">SC Total</span>
      <span className="tabular-nums">
        Returns: {totalReturns.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m&#179;
      </span>
      <span className="tabular-nums">
        Sage Sales: {totalSage.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m&#179;
      </span>
      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${varianceColor}`}>
        Variance: {totalVariance.toFixed(1)}%
      </span>
    </div>
  );
}
