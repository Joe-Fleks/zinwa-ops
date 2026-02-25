import { useEffect, useState, useMemo } from 'react';
import { Droplets, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveScopeFilter, fetchNRWMetrics, fetchNRWByMonth } from '../../lib/metrics';
import type { NRWSummaryMetrics, NRWMonthResult } from '../../lib/metrics';
import { applyScopeToQuery } from '../../lib/metrics/scopeFilter';
import { supabase } from '../../lib/supabase';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
];

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtCurrency(n: number): string {
  if (n === 0) return '—';
  return `$${fmt(n, 0)}`;
}

function pctColor(pct: number): string {
  if (pct > 20) return 'text-red-600';
  if (pct > 10) return 'text-amber-600';
  return 'text-green-700';
}

function pctBg(pct: number): string {
  if (pct > 20) return 'bg-red-50 border-red-200';
  if (pct > 10) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

function NRWBar({ pct }: { pct: number | null }) {
  if (pct === null) return <div className="h-1.5 bg-gray-100 rounded-full w-full" />;
  const clampedPct = Math.min(pct, 100);
  const color = pct > 20 ? 'bg-red-400' : pct > 10 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${clampedPct}%` }} />
    </div>
  );
}

interface QuarterNRWSummary {
  quarterLabel: string;
  months: number[];
  summary: NRWSummaryMetrics | null;
}

export default function NRWDashboardKPI() {
  const { accessContext } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQIdx = Math.max(0, Math.ceil(currentMonth / 3) - 1);

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedQuarterIdx, setSelectedQuarterIdx] = useState(currentQIdx);

  const [monthlySummary, setMonthlySummary] = useState<NRWSummaryMetrics | null>(null);
  const [monthResults, setMonthResults] = useState<Map<string, NRWMonthResult> | null>(null);
  const [quarterSummaries, setQuarterSummaries] = useState<QuarterNRWSummary[]>([]);
  const [yearlySummary, setYearlySummary] = useState<NRWSummaryMetrics | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tariffBands, setTariffBands] = useState<any[]>([]);
  const [stationIds, setStationIds] = useState<string[]>([]);

  const scName = accessContext?.serviceCentre?.name ?? null;

  useEffect(() => {
    if (!accessContext) return;
    const scope = resolveScopeFilter(accessContext);

    supabase
      .from('tariffs')
      .select('band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order, category')
      .eq('tariff_type', 'CW')
      .order('sort_order')
      .then(({ data }) => setTariffBands(data || []));

    let sq = supabase.from('stations').select('id');
    sq = applyScopeToQuery(sq, scope);
    sq.then(({ data }) => setStationIds((data || []).map((s: any) => s.id)));
  }, [accessContext]);

  const activeMonths = useMemo(() => {
    if (selectedYear < currentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
    return Array.from({ length: currentMonth }, (_, i) => i + 1);
  }, [selectedYear, currentYear, currentMonth]);

  useEffect(() => {
    if (!accessContext || tariffBands === null || stationIds.length === 0) return;
    const scope = resolveScopeFilter(accessContext);
    setLoading(true);
    setError(null);

    if (viewMode === 'monthly') {
      Promise.all([
        fetchNRWMetrics(scope, selectedYear, [selectedMonth], tariffBands),
        fetchNRWByMonth(stationIds, selectedYear, [selectedMonth - 1]),
      ])
        .then(([summary, monthData]) => {
          setMonthlySummary(summary);
          setMonthResults(monthData);
        })
        .catch(e => setError(e.message || 'Failed to load'))
        .finally(() => setLoading(false));
    } else if (viewMode === 'quarterly') {
      const quarterMonths = QUARTERS[selectedQuarterIdx].months.filter(m => {
        if (selectedYear < currentYear) return true;
        return m <= currentMonth;
      });
      fetchNRWMetrics(scope, selectedYear, quarterMonths, tariffBands)
        .then(summary => {
          const entry: QuarterNRWSummary = {
            quarterLabel: QUARTERS[selectedQuarterIdx].label,
            months: quarterMonths,
            summary,
          };
          setQuarterSummaries([entry]);
        })
        .catch(e => setError(e.message || 'Failed to load'))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetchNRWMetrics(scope, selectedYear, activeMonths, tariffBands),
        stationIds.length > 0
          ? fetchNRWByMonth(stationIds, selectedYear, activeMonths.map(m => m - 1))
          : Promise.resolve(new Map<string, NRWMonthResult>()),
      ])
        .then(([summary, monthData]) => {
          setYearlySummary(summary);
          setMonthResults(monthData);
        })
        .catch(e => setError(e.message || 'Failed to load'))
        .finally(() => setLoading(false));
    }
  }, [accessContext, selectedYear, selectedMonth, selectedQuarterIdx, viewMode, activeMonths.length, stationIds.length, tariffBands.length]);

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2020);

  const monthlyRows = useMemo(() => {
    if (!monthResults || viewMode !== 'yearly') return [];
    return activeMonths.map(m => {
      const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
      const res = monthResults.get(key);
      return {
        label: MONTH_LABELS[m - 1],
        monthKey: key,
        prodVol: res?.prodVolume ?? 0,
        salesVol: res?.salesVolume ?? 0,
        lossVol: res?.lossVolume ?? 0,
        nrwPct: res?.nrwPct ?? null,
      };
    }).reverse();
  }, [monthResults, activeMonths, selectedYear, viewMode]);

  const summaryLabel = (mode: ViewMode, year: number, month?: number, quarterIdx?: number) => {
    const base = scName ? `${scName} SC` : 'SC';
    if (mode === 'monthly' && month !== undefined) {
      return `${base} — ${MONTH_LABELS[month - 1]} ${year} Summary`;
    }
    if (mode === 'quarterly' && quarterIdx !== undefined) {
      return `${base} — ${QUARTERS[quarterIdx].label} ${year} Summary`;
    }
    return `${base} — ${year} YTD Summary`;
  };

  const activeSummary = viewMode === 'monthly' ? monthlySummary
    : viewMode === 'quarterly' ? (quarterSummaries[0]?.summary ?? null)
    : yearlySummary;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Droplets className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-800">Non-Revenue Water (NRW)</h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['monthly', 'quarterly', 'yearly'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                viewMode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {viewMode === 'monthly' && (
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MONTH_LABELS.map((lbl, i) => (
                <option key={i + 1} value={i + 1} disabled={i + 1 > currentMonth && selectedYear === currentYear}>{lbl}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {viewMode === 'quarterly' && (
          <div className="relative">
            <select
              value={selectedQuarterIdx}
              onChange={e => setSelectedQuarterIdx(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {QUARTERS.map((q, i) => (
                <option key={i} value={i}>{q.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {!loading && !error && activeSummary && (
        <div className="space-y-4">
          <div className={`rounded-lg border p-3 ${pctBg(activeSummary.totalLossPct)}`}>
            <p className="text-[11px] font-bold text-gray-600 uppercase mb-2">
              {summaryLabel(viewMode, selectedYear, selectedMonth, selectedQuarterIdx)}
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Total NRW Loss</p>
                <p className={`text-xl font-bold ${pctColor(activeSummary.totalLossPct)}`}>
                  {fmt(activeSummary.totalLossPct, 1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Loss Volume</p>
                <p className="text-sm font-bold text-gray-800">{fmt(activeSummary.totalLossVol)} m³</p>
              </div>
            </div>
            <NRWBar pct={activeSummary.totalLossPct} />
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Produced</p>
                <p className="text-xs font-semibold text-gray-700">{fmt(activeSummary.totalCWVolume)} m³</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Sold</p>
                <p className="text-xs font-semibold text-gray-700">{fmt(activeSummary.totalSalesVolume)} m³</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Est. Financial Loss</p>
                <p className="text-xs font-semibold text-red-700">
                  {fmtCurrency(activeSummary.totalFinancialLoss)}
                </p>
              </div>
            </div>
          </div>

          {(viewMode === 'monthly' || viewMode === 'quarterly') && activeSummary.stations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Station Breakdown</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Station</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">NRW %</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Loss (m³)</th>
                      <th className="text-right px-2 py-2 font-semibold text-red-700">Est. Loss ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSummary.stations.map((st, i) => (
                      <tr key={st.stationId} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[120px]">{st.stationName}</td>
                        <td className="px-2 py-2 text-right">
                          <span className={`font-semibold ${pctColor(st.totalLossPct)}`}>{fmt(st.totalLossPct, 1)}%</span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmt(st.totalLossVol)}</td>
                        <td className="px-2 py-2 text-right">
                          <span className={st.estimatedFinancialLoss > 0 ? 'text-red-700 font-semibold' : 'text-gray-300'}>
                            {fmtCurrency(st.estimatedFinancialLoss)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'yearly' && monthlyRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Month over Month — {selectedYear}</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Month</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Prod (m³)</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Sales (m³)</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Loss (m³)</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">NRW %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRows.map((row, i) => (
                      <tr key={row.monthKey} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-3 py-2 font-medium text-gray-700">{row.label}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{row.prodVol > 0 ? fmt(row.prodVol) : '—'}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{row.salesVol > 0 ? fmt(row.salesVol) : '—'}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{row.lossVol > 0 ? fmt(row.lossVol) : '—'}</td>
                        <td className="px-2 py-2 text-right">
                          {row.nrwPct !== null ? (
                            <span className={`font-semibold ${pctColor(row.nrwPct)}`}>{fmt(row.nrwPct, 1)}%</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewMode === 'yearly' && yearlySummary && yearlySummary.stations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Station Breakdown — {selectedYear} YTD</p>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-2 font-semibold text-gray-600">Station</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">NRW %</th>
                      <th className="text-right px-2 py-2 font-semibold text-gray-600">Loss (m³)</th>
                      <th className="text-right px-2 py-2 font-semibold text-red-700">Est. Loss ($)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlySummary.stations.map((st, i) => (
                      <tr key={st.stationId} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                        <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[120px]">{st.stationName}</td>
                        <td className="px-2 py-2 text-right">
                          <span className={`font-semibold ${pctColor(st.totalLossPct)}`}>{fmt(st.totalLossPct, 1)}%</span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmt(st.totalLossVol)}</td>
                        <td className="px-2 py-2 text-right">
                          <span className={st.estimatedFinancialLoss > 0 ? 'text-red-700 font-semibold' : 'text-gray-300'}>
                            {fmtCurrency(st.estimatedFinancialLoss)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && !activeSummary && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Droplets className="w-8 h-8 mb-2 text-gray-200" />
          <p className="text-xs">No data available</p>
        </div>
      )}
    </div>
  );
}
