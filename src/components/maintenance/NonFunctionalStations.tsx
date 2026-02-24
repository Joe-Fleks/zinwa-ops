import { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { Loader2, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getYesterdayString } from '../../lib/dateUtils';
import { THRESHOLDS } from '../../lib/metricsConfig';
import { fetchDailyDemandByStationId } from '../../lib/metrics/demandMetrics';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

type ViewMode = 'date' | 'month';

interface StationRow {
  id: string;
  station_name: string;
  target_daily_hours: number;
  cw_pump_rate_m3_hr: number | null;
  service_centre_id: string | null;
}

interface ProductionLog {
  station_id: string;
  cw_volume_m3: number;
  cw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  reason_for_downtime: string | null;
}

interface DisplayRow {
  station_name: string;
  downtime_reason: string;
  hours_lost: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getYesterdayParts() {
  const yesterday = getYesterdayString();
  const [y, m, d] = yesterday.split('-').map(Number);
  return { year: y, month: m, day: d, dateString: yesterday };
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function buildDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthRange(year: number, month: number) {
  const lastDay = getDaysInMonth(year, month);
  return {
    start: buildDateString(year, month, 1),
    end: buildDateString(year, month, lastDay),
    daysInMonth: lastDay,
  };
}

function CompactTracker({ label, value, total, barColor, textColor, bgColor }: {
  label: string;
  value: number;
  total: number;
  barColor: string;
  textColor: string;
  bgColor: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`rounded border px-2 py-1 flex items-center gap-2 ${bgColor}`}>
      <p className={`text-xs font-medium whitespace-nowrap ${textColor}`}>
        {label}: <span className="font-semibold">{value}/{total}</span> ({pct}%)
      </p>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden ml-auto" style={{ width: '40%' }}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusTrackers({ savedCount, totalCount, nonFunctionalCount, unrealizedDemandPct, periodLabel }: {
  savedCount: number;
  totalCount: number;
  nonFunctionalCount: number;
  unrealizedDemandPct: number;
  periodLabel: string;
}) {
  const savedPct = totalCount > 0 ? Math.round((savedCount / totalCount) * 100) : 0;
  const allSaved = savedCount === totalCount && totalCount > 0;
  const noneSaved = savedCount === 0;

  let savedBar = 'bg-amber-500';
  let savedText = 'text-amber-700';
  let savedBg = 'border-amber-200 bg-amber-50';
  if (allSaved) {
    savedBar = 'bg-emerald-500'; savedText = 'text-emerald-700'; savedBg = 'border-emerald-200 bg-emerald-50';
  } else if (noneSaved) {
    savedBar = 'bg-red-400'; savedText = 'text-red-700'; savedBg = 'border-red-200 bg-red-50';
  } else if (savedPct >= 75) {
    savedBar = 'bg-blue-500'; savedText = 'text-blue-700'; savedBg = 'border-blue-200 bg-blue-50';
  }

  const metPct = 100 - unrealizedDemandPct;

  let demandSeverityBorder = 'border-emerald-200';
  let demandSeverityBg = 'bg-emerald-50';
  let demandSeverityText = 'text-emerald-700';
  let demandSeveritySubText = 'text-emerald-600';
  let demandMetBar = 'bg-emerald-500';
  let demandUnmetBar = 'bg-emerald-200';
  let demandSeverityLabel = 'Low impact';

  if (unrealizedDemandPct >= 50) {
    demandSeverityBorder = 'border-red-200';
    demandSeverityBg = 'bg-red-50';
    demandSeverityText = 'text-red-700';
    demandSeveritySubText = 'text-red-600';
    demandMetBar = 'bg-red-500';
    demandUnmetBar = 'bg-red-200';
    demandSeverityLabel = 'Critical impact';
  } else if (unrealizedDemandPct >= 25) {
    demandSeverityBorder = 'border-orange-200';
    demandSeverityBg = 'bg-orange-50';
    demandSeverityText = 'text-orange-700';
    demandSeveritySubText = 'text-orange-600';
    demandMetBar = 'bg-orange-500';
    demandUnmetBar = 'bg-orange-200';
    demandSeverityLabel = 'High impact';
  } else if (unrealizedDemandPct > 0) {
    demandSeverityBorder = 'border-amber-200';
    demandSeverityBg = 'bg-amber-50';
    demandSeverityText = 'text-amber-700';
    demandSeveritySubText = 'text-amber-600';
    demandMetBar = 'bg-amber-500';
    demandUnmetBar = 'bg-amber-200';
    demandSeverityLabel = 'Moderate impact';
  }

  return (
    <div className="space-y-1.5">
      <CompactTracker
        label={`Saved records for ${periodLabel}`}
        value={savedCount}
        total={totalCount}
        barColor={savedBar}
        textColor={savedText}
        bgColor={savedBg}
      />
      {savedCount > 0 && nonFunctionalCount > 0 && (
        <div className={`rounded border px-3 py-2 flex items-center gap-3 ${demandSeverityBorder} ${demandSeverityBg}`}>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${demandSeverityText}`}>
              {nonFunctionalCount} out of {totalCount} stations not producing
            </p>
            <p className={`text-xs mt-0.5 ${demandSeveritySubText} opacity-80`}>
              {unrealizedDemandPct}% of daily demand
            </p>
          </div>
          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden" style={{ width: '30%' }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${demandMetBar}`}
              style={{ width: `${unrealizedDemandPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ savedCount, totalCount, periodLabel }: {
  savedCount: number;
  totalCount: number;
  periodLabel: string;
}) {
  const allSaved = savedCount === totalCount && totalCount > 0;
  const noneSaved = savedCount === 0;

  if (allSaved) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-green-200 p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-green-700 font-medium">All stations are functional</p>
        <p className="text-xs text-gray-400 mt-1">
          All {totalCount} stations have saved records with production above threshold for {periodLabel}
        </p>
      </div>
    );
  }

  if (noneSaved) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-5 h-5 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 font-medium">No production records saved yet</p>
        <p className="text-xs text-gray-400 mt-1">
          None of the {totalCount} station{totalCount !== 1 ? 's' : ''} have saved production data for {periodLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-8 text-center">
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-sm text-blue-700 font-medium">No downtime issues among saved records</p>
      <p className="text-xs text-gray-400 mt-1">
        {savedCount} of {totalCount} stations have saved data -- remaining stations have not yet been updated for {periodLabel}
      </p>
    </div>
  );
}

export default function NonFunctionalStations() {
  const { accessContext } = useAuth();
  const yesterdayParts = useMemo(() => getYesterdayParts(), []);

  const [selectedYear, setSelectedYear] = useState(yesterdayParts.year);
  const [selectedMonth, setSelectedMonth] = useState(yesterdayParts.month);
  const [selectedDay, setSelectedDay] = useState<number>(yesterdayParts.day);
  const [viewMode, setViewMode] = useState<ViewMode>('date');

  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [totalStationCount, setTotalStationCount] = useState(0);
  const [savedStationCount, setSavedStationCount] = useState(0);
  const [nonFunctionalCount, setNonFunctionalCount] = useState(0);
  const [unrealizedDemandPct, setUnrealizedDemandPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 2019 }, (_, i) => 2020 + i).reverse();
  }, []);

  const daysInSelectedMonth = useMemo(
    () => getDaysInMonth(selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );

  const availableDays = useMemo(
    () => Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1),
    [daysInSelectedMonth]
  );

  useEffect(() => {
    if (selectedDay > daysInSelectedMonth) {
      setSelectedDay(daysInSelectedMonth);
    }
  }, [daysInSelectedMonth, selectedDay]);

  const dateRange = useMemo(() => {
    if (viewMode === 'date') {
      const ds = buildDateString(selectedYear, selectedMonth, selectedDay);
      return { start: ds, end: ds, daysInMonth: 1 };
    }
    return buildMonthRange(selectedYear, selectedMonth);
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  const periodLabel = useMemo(() => {
    if (viewMode === 'date') {
      const d = new Date(selectedYear, selectedMonth - 1, selectedDay);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
  }, [viewMode, selectedYear, selectedMonth, selectedDay]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const allowedSCIds = accessContext?.allowedServiceCentreIds || [];
      if (allowedSCIds.length === 0) {
        setRows([]);
        setTotalStationCount(0);
        setSavedStationCount(0);
        setNonFunctionalCount(0);
        setLoading(false);
        return;
      }

      let stationQuery = supabase
        .from('stations')
        .select('id, station_name, target_daily_hours, cw_pump_rate_m3_hr, service_centre_id');

      if (allowedSCIds.length <= 50) {
        stationQuery = stationQuery.in('service_centre_id', allowedSCIds);
      }

      const { data: stations, error: stationErr } = await stationQuery;
      if (stationErr) throw stationErr;
      if (!stations || stations.length === 0) {
        setRows([]);
        setTotalStationCount(0);
        setSavedStationCount(0);
        setNonFunctionalCount(0);
        setLoading(false);
        return;
      }

      const filteredStations: StationRow[] = stations.filter(
        (s: any) => allowedSCIds.includes(s.service_centre_id)
      );

      const stationIds = filteredStations.map(s => s.id);

      const { data: logs, error: logErr } = await supabase
        .from('production_logs')
        .select('station_id, cw_volume_m3, cw_hours_run, load_shedding_hours, other_downtime_hours, reason_for_downtime')
        .in('station_id', stationIds)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (logErr) throw logErr;

      const { data: breakdowns } = await supabase
        .from('station_breakdowns')
        .select('station_id')
        .in('station_id', stationIds)
        .eq('breakdown_impact', 'Stopped pumping')
        .eq('is_resolved', false)
        .lte('date_reported', dateRange.end);

      const stoppingBreakdownStationIds = new Set(
        (breakdowns || []).map((b: any) => b.station_id)
      );

      const logsByStation = new Map<string, ProductionLog[]>();
      for (const log of (logs || [])) {
        const arr = logsByStation.get(log.station_id) || [];
        arr.push(log);
        logsByStation.set(log.station_id, arr);
      }

      setTotalStationCount(filteredStations.length);
      setSavedStationCount(logsByStation.size);

      const displayRows: DisplayRow[] = [];

      for (const station of filteredStations) {
        const stationLogs = logsByStation.get(station.id);
        if (!stationLogs || stationLogs.length === 0) continue;

        const totalCWVolume = stationLogs.reduce((sum, l) => sum + Number(l.cw_volume_m3 || 0), 0);
        const totalCWHours = stationLogs.reduce((sum, l) => sum + Number(l.cw_hours_run || 0), 0);
        const totalLoadShedding = stationLogs.reduce((sum, l) => sum + Number(l.load_shedding_hours || 0), 0);
        const totalOtherDowntime = stationLogs.reduce((sum, l) => sum + Number(l.other_downtime_hours || 0), 0);

        const currentFlow = totalCWHours > 0 ? totalCWVolume / totalCWHours : (station.cw_pump_rate_m3_hr || 0);
        const targetHours = Number(station.target_daily_hours || 0);
        const expectedVolume = targetHours * currentFlow * dateRange.daysInMonth;
        const threshold = expectedVolume * THRESHOLDS.NON_FUNCTIONAL_VOLUME_PCT;

        const isZeroVolume = totalCWVolume === 0;
        const isBelowThreshold = expectedVolume > 0 && totalCWVolume < threshold;
        const hasStoppingBreakdown = stoppingBreakdownStationIds.has(station.id);

        if (!isZeroVolume && !isBelowThreshold && !hasStoppingBreakdown) continue;

        if (totalLoadShedding > 0) {
          displayRows.push({
            station_name: station.station_name,
            downtime_reason: 'Load shedding',
            hours_lost: Math.round(totalLoadShedding * 100) / 100,
          });
        }

        const otherReasons = new Map<string, number>();
        for (const log of stationLogs) {
          const hrs = Number(log.other_downtime_hours || 0);
          if (hrs <= 0) continue;
          const reason = (log.reason_for_downtime || '').trim() || 'Other downtime (unspecified)';
          otherReasons.set(reason, (otherReasons.get(reason) || 0) + hrs);
        }

        for (const [reason, hours] of otherReasons) {
          displayRows.push({
            station_name: station.station_name,
            downtime_reason: reason,
            hours_lost: Math.round(hours * 100) / 100,
          });
        }

        if (totalLoadShedding === 0 && totalOtherDowntime === 0 && !hasStoppingBreakdown) {
          displayRows.push({
            station_name: station.station_name,
            downtime_reason: isZeroVolume ? 'No production recorded' : `Below ${THRESHOLDS.NON_FUNCTIONAL_VOLUME_PCT * 100}% capacity threshold`,
            hours_lost: 0,
          });
        }

        if (hasStoppingBreakdown && totalLoadShedding === 0 && totalOtherDowntime === 0) {
          displayRows.push({
            station_name: station.station_name,
            downtime_reason: 'Unresolved breakdown (pumping stopped)',
            hours_lost: 0,
          });
        }
      }

      const uniqueNonFunctional = new Set(displayRows.map(r => r.station_name));
      setNonFunctionalCount(uniqueNonFunctional.size);

      const nonFunctionalStationIds = filteredStations
        .filter(s => uniqueNonFunctional.has(s.station_name))
        .map(s => s.id);

      const { totalDailyDemandM3, demandByStationId } = await fetchDailyDemandByStationId(
        stationIds,
        selectedYear,
        selectedMonth
      );

      const nonFunctionalDailyDemand = nonFunctionalStationIds.reduce(
        (sum, id) => sum + (demandByStationId.get(id) || 0),
        0
      );

      setUnrealizedDemandPct(
        totalDailyDemandM3 > 0 ? Math.round((nonFunctionalDailyDemand / totalDailyDemandM3) * 100) : 0
      );

      displayRows.sort((a, b) => a.station_name.localeCompare(b.station_name) || b.hours_lost - a.hours_lost);
      setRows(displayRows);
    } catch (err: any) {
      console.error('Error loading non-functional stations:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [accessContext, dateRange]);

  useEffect(() => {
    if (!accessContext) return;
    loadData();
  }, [accessContext, loadData]);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Station',
      field: 'station_name',
      minWidth: 200,
      flex: 2,
      pinned: 'left',
      sortable: true,
      filter: true,
      cellClass: 'font-medium',
    },
    {
      headerName: 'Downtime Reason',
      field: 'downtime_reason',
      minWidth: 220,
      flex: 3,
      sortable: true,
      filter: true,
    },
    {
      headerName: 'Hours Lost',
      field: 'hours_lost',
      minWidth: 120,
      flex: 1,
      sortable: true,
      filter: true,
      type: 'numericColumn',
      valueFormatter: (params: any) => {
        const val = params.value;
        if (val === 0 || val == null) return '-';
        return val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      },
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    editable: false,
    suppressMovable: true,
  }), []);

  const selectClass = 'appearance-none bg-white border border-gray-300 rounded-md px-2 py-1 pr-6 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors cursor-pointer hover:border-gray-400';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">View by:</span>
          </div>

          <div className="flex gap-0.5 bg-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('date')}
              className={`px-3 py-1 text-sm font-semibold rounded transition-all ${
                viewMode === 'date'
                  ? 'bg-blue-300 text-blue-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm font-semibold rounded transition-all ${
                viewMode === 'month'
                  ? 'bg-blue-300 text-blue-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Month
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={selectClass}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className={selectClass}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx + 1}>{name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {viewMode === 'date' && (
              <div className="relative">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className={selectClass}
                >
                  {availableDays.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="ml-auto text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
            {nonFunctionalCount} {nonFunctionalCount === 1 ? 'station' : 'stations'}
          </div>
        </div>
      </div>

      {!loading && !error && <StatusTrackers
        savedCount={savedStationCount}
        totalCount={totalStationCount}
        nonFunctionalCount={nonFunctionalCount}
        unrealizedDemandPct={unrealizedDemandPct}
        periodLabel={periodLabel}
      />}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-3" />
          <span className="text-gray-500">Loading non-functional stations...</span>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          savedCount={savedStationCount}
          totalCount={totalStationCount}
          periodLabel={periodLabel}
        />
      ) : (
        <div className="ag-theme-alpine rounded-lg overflow-hidden border border-gray-200" style={{ width: '100%' }}>
          <AgGridReact
            rowData={rows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
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
