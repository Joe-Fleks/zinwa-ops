import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef, GridApi } from 'ag-grid-community';
import { Loader2, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getYesterdayString } from '../../lib/dateUtils';
import UndoRedoButtons from '../../components/UndoRedoButtons';

ModuleRegistry.registerModules([AllCommunityModule]);

type ViewMode = 'date' | 'month';

interface Station {
  id: string;
  station_name: string;
  station_type: string;
  design_capacity_m3_hr: number;
  service_centre_id: string;
}

interface VarianceRow {
  station_id: string;
  station_name: string;
  design_capacity: number;
  rw_current_flow: number | null;
  cw_current_flow: number | null;
  rw_variance_pct: number | null;
  cw_variance_pct: number | null;
  variance_pct: number | null;
  mtd_change_pct: number | null;
  ytd_change_pct: number | null;
  comment: string;
}

type FlowAgg = { rwVol: number; rwHrs: number; cwVol: number; cwHrs: number };

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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

const flowFmt = (p: any) => (p.value == null || p.value === 0) ? '-' : p.value.toFixed(1);

const varianceFmt = (p: any) => {
  if (p.value == null) return '-';
  return `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`;
};

const varianceStyle = (p: any) => {
  if (p.value == null) return { color: '#9ca3af' };
  if (p.value >= -10) return { color: '#059669', backgroundColor: '#ecfdf5', fontWeight: 600 };
  if (p.value >= -25) return { color: '#d97706', backgroundColor: '#fffbeb', fontWeight: 600 };
  return { color: '#dc2626', backgroundColor: '#fef2f2', fontWeight: 600 };
};

const trendFmt = (p: any) => {
  if (p.value == null) return 'N/A';
  const arrow = p.value > 0.5 ? '\u2191 ' : p.value < -0.5 ? '\u2193 ' : '\u2192 ';
  return `${arrow}${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`;
};

const trendStyle = (p: any) => {
  if (p.value == null) return { color: '#9ca3af' };
  if (p.value > 0.5) return { color: '#059669', fontWeight: 500 };
  if (p.value < -0.5) return { color: '#dc2626', fontWeight: 500 };
  return { color: '#6b7280' };
};

function SectionHeader({ title, count, colorClass }: {
  title: string; count: number; colorClass: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
        {count} station{count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

function VarianceSummaryBar({ ftRows, bhRows }: { ftRows: VarianceRow[]; bhRows: VarianceRow[] }) {
  const all = [...ftRows, ...bhRows];
  const withData = all.filter(r => r.variance_pct !== null);
  const atCapacity = withData.filter(r => r.variance_pct! >= -10).length;
  const belowThreshold = withData.filter(r => r.variance_pct! < -25).length;
  const moderate = withData.length - atCapacity - belowThreshold;

  if (withData.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-medium text-emerald-700">
          At capacity ({'>'}= -10%): {atCapacity}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs font-medium text-amber-700">
          Moderate (-10% to -25%): {moderate}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded px-3 py-1.5">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <span className="text-xs font-medium text-red-700">
          Below threshold ({'<'} -25%): {belowThreshold}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-3 py-1.5 ml-auto">
        <span className="text-xs font-medium text-gray-600">
          {withData.length} of {all.length} with production data
        </span>
      </div>
    </div>
  );
}

export default function CapacityVariance() {
  const { user, accessContext } = useAuth();
  const yp = useMemo(() => getYesterdayParts(), []);
  const ftGridRef = useRef<AgGridReact>(null);
  const bhGridRef = useRef<AgGridReact>(null);
  const [ftGridApi, setFtGridApi] = useState<GridApi | null>(null);
  const [bhGridApi, setBhGridApi] = useState<GridApi | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedYear, setSelectedYear] = useState(yp.year);
  const [selectedMonth, setSelectedMonth] = useState(yp.month);
  const [selectedDay, setSelectedDay] = useState(yp.day);
  const [ftRows, setFtRows] = useState<VarianceRow[]>([]);
  const [bhRows, setBhRows] = useState<VarianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    return Array.from({ length: cur - 2019 }, (_, i) => 2020 + i).reverse();
  }, []);

  const daysInMonth = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  );

  useEffect(() => {
    if (selectedDay > daysInMonth) setSelectedDay(daysInMonth);
  }, [daysInMonth, selectedDay]);

  const dateRange = useMemo(() => {
    if (viewMode === 'date') {
      const ds = buildDate(selectedYear, selectedMonth, selectedDay);
      return { start: ds, end: ds };
    }
    return {
      start: buildDate(selectedYear, selectedMonth, 1),
      end: buildDate(selectedYear, selectedMonth, getDaysInMonth(selectedYear, selectedMonth)),
    };
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'date') {
      return new Date(selectedYear, selectedMonth - 1, selectedDay)
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const scIds = accessContext?.allowedServiceCentreIds || [];
      if (!scIds.length) {
        setFtRows([]); setBhRows([]); setLoading(false); return;
      }

      let sq = supabase.from('stations')
        .select('id, station_name, station_type, design_capacity_m3_hr, service_centre_id');
      if (scIds.length <= 50) sq = sq.in('service_centre_id', scIds);

      const { data: rawSt, error: stErr } = await sq;
      if (stErr) throw stErr;

      const stations: Station[] = (rawSt || []).filter(
        (s: any) => scIds.includes(s.service_centre_id)
      );

      if (!stations.length) {
        setFtRows([]); setBhRows([]); setLoading(false); return;
      }

      const ids = stations.map(s => s.id);

      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const prevMonthYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const prevMonthStart = buildDate(prevMonthYear, prevMonth, 1);
      const janStart = buildDate(selectedYear, 1, 1);
      const queryStart = prevMonthStart < janStart ? prevMonthStart : janStart;

      const [logsResult, commentsResult] = await Promise.all([
        supabase.from('production_logs')
          .select('station_id, date, rw_volume_m3, rw_hours_run, cw_volume_m3, cw_hours_run')
          .in('station_id', ids)
          .gte('date', queryStart)
          .lte('date', dateRange.end),
        supabase.from('capacity_variance_comments')
          .select('station_id, comment')
          .in('station_id', ids)
          .eq('period_year', selectedYear)
          .eq('period_month', selectedMonth),
      ]);

      if (logsResult.error) throw logsResult.error;

      const commentMap = new Map<string, string>(
        (commentsResult.data || []).map((c: any) => [c.station_id, c.comment])
      );

      const monthly = new Map<string, Map<string, FlowAgg>>();
      const period = new Map<string, FlowAgg>();

      for (const log of (logsResult.data || [])) {
        const monthKey = log.date.substring(0, 7);

        if (!monthly.has(log.station_id)) monthly.set(log.station_id, new Map());
        const sm = monthly.get(log.station_id)!;
        if (!sm.has(monthKey)) sm.set(monthKey, { rwVol: 0, rwHrs: 0, cwVol: 0, cwHrs: 0 });
        const agg = sm.get(monthKey)!;
        agg.rwVol += Number(log.rw_volume_m3 || 0);
        agg.rwHrs += Number(log.rw_hours_run || 0);
        agg.cwVol += Number(log.cw_volume_m3 || 0);
        agg.cwHrs += Number(log.cw_hours_run || 0);

        if (log.date >= dateRange.start && log.date <= dateRange.end) {
          if (!period.has(log.station_id)) {
            period.set(log.station_id, { rwVol: 0, rwHrs: 0, cwVol: 0, cwHrs: 0 });
          }
          const pd = period.get(log.station_id)!;
          pd.rwVol += Number(log.rw_volume_m3 || 0);
          pd.rwHrs += Number(log.rw_hours_run || 0);
          pd.cwVol += Number(log.cw_volume_m3 || 0);
          pd.cwHrs += Number(log.cw_hours_run || 0);
        }
      }

      const curMK = `${selectedYear}-${pad2(selectedMonth)}`;
      const prevMK = `${prevMonthYear}-${pad2(prevMonth)}`;
      const janMK = `${selectedYear}-01`;

      const buildRow = (station: Station): VarianceRow => {
        const pd = period.get(station.id);
        const rwFlow = pd && pd.rwHrs > 0 ? pd.rwVol / pd.rwHrs : null;
        const cwFlow = pd && pd.cwHrs > 0 ? pd.cwVol / pd.cwHrs : null;
        const dc = Number(station.design_capacity_m3_hr || 0);
        const rwVPct = rwFlow !== null && dc > 0 ? ((rwFlow - dc) / dc) * 100 : null;
        const cwVPct = cwFlow !== null && dc > 0 ? ((cwFlow - dc) / dc) * 100 : null;
        const vPct = cwVPct;

        const sm = monthly.get(station.id);
        const curAgg = sm?.get(curMK);
        const prevAgg = sm?.get(prevMK);
        const janAgg = sm?.get(janMK);

        const curFlow = curAgg && curAgg.cwHrs > 0 ? curAgg.cwVol / curAgg.cwHrs : null;
        const prevFlow = prevAgg && prevAgg.cwHrs > 0 ? prevAgg.cwVol / prevAgg.cwHrs : null;
        const janFlow = janAgg && janAgg.cwHrs > 0 ? janAgg.cwVol / janAgg.cwHrs : null;

        const mtd = curFlow !== null && prevFlow !== null && prevFlow > 0
          ? ((curFlow - prevFlow) / prevFlow) * 100 : null;
        const ytd = curFlow !== null && janFlow !== null && janFlow > 0 && selectedMonth > 1
          ? ((curFlow - janFlow) / janFlow) * 100 : null;

        return {
          station_id: station.id,
          station_name: station.station_name,
          design_capacity: dc,
          rw_current_flow: rwFlow,
          cw_current_flow: cwFlow,
          rw_variance_pct: rwVPct,
          cw_variance_pct: cwVPct,
          variance_pct: vPct,
          mtd_change_pct: mtd,
          ytd_change_pct: ytd,
          comment: commentMap.get(station.id) || '',
        };
      };

      setFtRows(stations.filter(s => s.station_type === 'Full Treatment').map(buildRow));
      setBhRows(stations.filter(s => s.station_type === 'Borehole').map(buildRow));
    } catch (err: any) {
      setError(err.message || 'Failed to load capacity variance data');
    } finally {
      setLoading(false);
    }
  }, [accessContext, dateRange, selectedYear, selectedMonth]);

  useEffect(() => {
    if (accessContext) loadData();
  }, [accessContext, loadData]);

  const handleCellValueChanged = useCallback(async (event: any) => {
    if (!user || event.colDef.field !== 'comment') return;
    const row = event.data as VarianceRow;
    try {
      await supabase.from('capacity_variance_comments').upsert({
        station_id: row.station_id,
        period_year: selectedYear,
        period_month: selectedMonth,
        comment: event.newValue || '',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'station_id,period_year,period_month' });
    } catch (err) {
      console.error('Comment save failed:', err);
    }
  }, [user, selectedYear, selectedMonth]);

  const commentColDef: ColDef = {
    headerName: 'Comment on Variance',
    field: 'comment',
    minWidth: 220,
    flex: 3,
    editable: true,
    cellStyle: { backgroundColor: '#f8fafc', cursor: 'text' },
    tooltipValueGetter: () => 'Double-click to edit',
  };

  const trendCols: ColDef[] = [
    { headerName: 'MTD', field: 'mtd_change_pct', minWidth: 105, flex: 1, valueFormatter: trendFmt, cellStyle: trendStyle, headerTooltip: 'Month-to-Date: change from previous month' },
    { headerName: 'YTD', field: 'ytd_change_pct', minWidth: 105, flex: 1, valueFormatter: trendFmt, cellStyle: trendStyle, headerTooltip: 'Year-to-Date: change from January' },
  ];

  const rwVarianceCol: ColDef = {
    headerName: 'RW Cap. Var.',
    field: 'rw_variance_pct',
    minWidth: 115,
    flex: 1,
    valueFormatter: varianceFmt,
    cellStyle: varianceStyle,
    headerTooltip: 'Raw Water capacity variance vs design capacity',
  };

  const cwVarianceCol: ColDef = {
    headerName: 'CW Cap. Var.',
    field: 'cw_variance_pct',
    minWidth: 115,
    flex: 1,
    valueFormatter: varianceFmt,
    cellStyle: varianceStyle,
    headerTooltip: 'Clear Water capacity variance vs design capacity',
  };

  const ftColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'Station', field: 'station_name', minWidth: 180, flex: 2, pinned: 'left', cellClass: 'font-medium' },
    { headerName: 'Design Cap. (m\u00B3/hr)', field: 'design_capacity', minWidth: 145, flex: 1, type: 'numericColumn', valueFormatter: flowFmt },
    { headerName: 'RW Flow (m\u00B3/hr)', field: 'rw_current_flow', minWidth: 135, flex: 1, type: 'numericColumn', valueFormatter: flowFmt },
    rwVarianceCol,
    { headerName: 'CW Flow (m\u00B3/hr)', field: 'cw_current_flow', minWidth: 135, flex: 1, type: 'numericColumn', valueFormatter: flowFmt },
    cwVarianceCol,
    ...trendCols,
    commentColDef,
  ], []);

  const bhColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'Station', field: 'station_name', minWidth: 180, flex: 2, pinned: 'left', cellClass: 'font-medium' },
    { headerName: 'Design Cap. (m\u00B3/hr)', field: 'design_capacity', minWidth: 145, flex: 1, type: 'numericColumn', valueFormatter: flowFmt },
    { headerName: 'CW Flow (m\u00B3/hr)', field: 'cw_current_flow', minWidth: 135, flex: 1, type: 'numericColumn', valueFormatter: flowFmt },
    cwVarianceCol,
    ...trendCols,
    commentColDef,
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    suppressMovable: true,
  }), []);

  const selectClass = 'appearance-none bg-white border border-gray-300 rounded-md px-2 py-1 pr-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors cursor-pointer hover:border-gray-400';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Period:</span>
          </div>

          <div className="flex gap-0.5 bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('date')}
              className={`px-3 py-1 text-sm font-semibold rounded transition-all ${
                viewMode === 'date' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >Date</button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm font-semibold rounded transition-all ${
                viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >Month</button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className={selectClass}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className={selectClass}>
                {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {viewMode === 'date' && (
              <div className="relative">
                <select value={selectedDay} onChange={e => setSelectedDay(Number(e.target.value))} className={selectClass}>
                  {dayOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="ml-auto text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg font-medium">
            {periodLabel}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-3" />
          <span className="text-gray-500">Loading capacity variance data...</span>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : (
        <>
          <VarianceSummaryBar ftRows={ftRows} bhRows={bhRows} />

          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="Full Treatment Stations" count={ftRows.length} colorClass="bg-blue-100 text-blue-700" />
              <UndoRedoButtons gridApi={ftGridApi} />
            </div>
            {ftRows.length > 0 ? (
              <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200">
                <AgGridReact
                  ref={ftGridRef}
                  rowData={ftRows}
                  columnDefs={ftColumnDefs}
                  defaultColDef={defaultColDef}
                  domLayout="autoHeight"
                  suppressMovableColumns={true}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  animateRows={true}
                  getRowId={(p: any) => p.data.station_id}
                  onCellValueChanged={handleCellValueChanged}
                  tooltipShowDelay={300}
                  undoRedoCellEditing={true}
                  undoRedoCellEditingLimit={100}
                  onGridReady={(params) => setFtGridApi(params.api)}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">No Full Treatment stations in your scope</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionHeader title="Borehole Stations" count={bhRows.length} colorClass="bg-teal-100 text-teal-700" />
              <UndoRedoButtons gridApi={bhGridApi} />
            </div>
            {bhRows.length > 0 ? (
              <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200">
                <AgGridReact
                  ref={bhGridRef}
                  rowData={bhRows}
                  columnDefs={bhColumnDefs}
                  defaultColDef={defaultColDef}
                  domLayout="autoHeight"
                  suppressMovableColumns={true}
                  enableCellTextSelection={true}
                  ensureDomOrder={true}
                  animateRows={true}
                  getRowId={(p: any) => p.data.station_id}
                  onCellValueChanged={handleCellValueChanged}
                  tooltipShowDelay={300}
                  undoRedoCellEditing={true}
                  undoRedoCellEditingLimit={100}
                  onGridReady={(params) => setBhGridApi(params.api)}
                />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <p className="text-sm text-gray-400">No Borehole stations in your scope</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
