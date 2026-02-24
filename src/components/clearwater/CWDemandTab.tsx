import { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchDemandByStation, DEMAND_CATEGORY_LABELS } from '../../lib/metrics/demandMetrics';
import { CATEGORY_DAILY_DEMAND_M3, CLIENT_CATEGORIES } from '../../lib/metricsConfig';
import type { DemandSummary } from '../../lib/metrics/demandMetrics';
import { Loader2 } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmt(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function CWDemandTab() {
  const { accessContext } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<DemandSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [accessContext?.scopeId, year, month]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchDemandByStation(
        accessContext?.scopeId || null,
        accessContext?.isSCScoped || false,
        year,
        month
      );
      setSummary(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load demand data');
    } finally {
      setLoading(false);
    }
  };

  const columnDefs = useMemo(() => {
    const cols: any[] = [
      {
        headerName: 'Station',
        field: 'stationName',
        pinned: 'left',
        minWidth: 180,
        flex: 2,
        cellStyle: { fontWeight: 600, color: '#1e293b' },
      },
    ];

    for (const cat of CLIENT_CATEGORIES) {
      cols.push({
        headerName: DEMAND_CATEGORY_LABELS[cat] || cat,
        field: cat,
        width: 100,
        type: 'numericColumn',
        valueFormatter: (p: any) => p.value != null ? fmt(p.value) : '0',
        cellStyle: { color: '#374151' },
      });
    }

    cols.push(
      {
        headerName: 'Total Clients',
        field: 'totalClients',
        width: 120,
        type: 'numericColumn',
        valueFormatter: (p: any) => fmt(p.value),
        cellStyle: { fontWeight: 600, color: '#1e293b' },
      },
      {
        headerName: 'Daily Demand (m³)',
        field: 'dailyDemandM3',
        width: 150,
        type: 'numericColumn',
        valueFormatter: (p: any) => fmt(p.value, 1),
        cellStyle: { fontWeight: 600, color: '#1d4ed8' },
      },
      {
        headerName: 'Monthly Demand (m³)',
        field: 'monthlyDemandM3',
        width: 160,
        type: 'numericColumn',
        valueFormatter: (p: any) => fmt(p.value, 0),
        cellStyle: { fontWeight: 600, color: '#1d4ed8' },
      },
      {
        headerName: 'Yearly Demand (m³)',
        field: 'yearlyDemandM3',
        width: 160,
        type: 'numericColumn',
        valueFormatter: (p: any) => fmt(p.value, 0),
        cellStyle: { fontWeight: 600, color: '#0f766e' },
      }
    );

    return cols;
  }, []);

  const pinnedBottomRow = useMemo(() => {
    if (!summary) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const totals: Record<string, any> = {
      stationName: 'SC Total',
      totalClients: summary.scTotalClients,
      dailyDemandM3: summary.scDailyDemandM3,
      monthlyDemandM3: summary.scMonthlyDemandM3,
      yearlyDemandM3: summary.scDailyDemandM3 * 365,
    };
    for (const cat of CLIENT_CATEGORIES) {
      totals[cat] = summary.stationRows.reduce((s, r) => s + (r as any)[cat], 0);
    }
    return [totals];
  }, [summary, year, month]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    suppressMovable: false,
    editable: false,
  }), []);

  const currentYear = now.getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">CW Demand Estimates</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Daily demand computed from client database using standard per-category consumption rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Month</label>
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Year</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-blue-800 uppercase mb-2">Per-Category Daily Consumption Rates</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {CLIENT_CATEGORIES.map(cat => (
            <span key={cat} className="text-xs text-blue-700">
              <span className="font-medium">{DEMAND_CATEGORY_LABELS[cat]}:</span>{' '}
              {CATEGORY_DAILY_DEMAND_M3[cat]} m³/day
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading demand data...</span>
        </div>
      ) : summary && summary.stationRows.length > 0 ? (
        <>
          <div className="ag-theme-alpine" style={{ height: Math.min(600, 56 + summary.stationRows.length * 42 + 56) }}>
            <AgGridReact
              rowData={summary.stationRows.map(r => ({
                ...r,
                stationName: r.stationName,
                yearlyDemandM3: r.dailyDemandM3 * 365,
              }))}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              pinnedBottomRowData={pinnedBottomRow}
              suppressCellFocus
              suppressRowClickSelection
              getRowStyle={(params) => {
                if (params.node.rowPinned === 'bottom') {
                  return { background: '#f0f9ff', fontWeight: '700', borderTop: '2px solid #bfdbfe' };
                }
                return undefined;
              }}
              domLayout="autoHeight"
            />
          </div>

          <p className="text-xs text-gray-400">
            * Client counts include base station figures plus cumulative new connections recorded up to {MONTHS[month - 1]} {year}.
            Demand rates are estimates based on standard per-category usage.
          </p>
        </>
      ) : !loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No station data found for the selected scope.
        </div>
      ) : null}
    </div>
  );
}
