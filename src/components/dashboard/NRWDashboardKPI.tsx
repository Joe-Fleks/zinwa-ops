import { useEffect, useState, useMemo } from 'react';
import { Droplets, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveScopeFilter, fetchNRWMetrics, fetchNRWByMonth, aggregateNRWByQuarter } from '../../lib/metrics';
import type { NRWSummaryMetrics, NRWMonthResult } from '../../lib/metrics';
import { applyScopeToQuery } from '../../lib/metrics/scopeFilter';
import { supabase } from '../../lib/supabase';
import { roundTo } from '../../lib/metricsConfig';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type ViewMode = 'monthly' | 'quarterly' | 'yearly';

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

export default function NRWDashboardKPI() {
  const { accessContext } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [summary, setSummary] = useState<NRWSummaryMetrics | null>(null);
  const [monthResults, setMonthResults] = useState<Map<string, NRWMonthResult> | null>(null);
  const [quarterResults, setQuarterResults] = useState<Map<string, number | null> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tariffBands, setTariffBands] = useState<any[]>([]);
  const [stationIds, setStationIds] = useState<string[]>([]);

  const activeMonths = useMemo(() => {
    if (selectedYear < currentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
    return Array.from({ length: currentMonth }, (_, i) => i + 1);
  }, [selectedYear, currentYear, currentMonth]);

  useEffect(() => {
    if (!accessContext) return;
    const scope = resolveScopeFilter(accessContext);
    let q = supabase.from('tariffs').select('category, lower_limit, upper_limit, rate_per_m3').eq('is_active', true);
    q = applyScopeToQuery(q, scope);
    q.then(({ data }) => setTariffBands(data || []));

    let sq = supabase.from('stations').select('id');
    sq = applyScopeToQuery(sq, scope);
    sq.then(({ data }) => setStationIds((data || []).map((s: any) => s.id)));
  }, [accessContext]);

  useEffect(() => {
    if (!accessContext || tariffBands === null) return;
    const scope = resolveScopeFilter(accessContext);
    setLoading(true);
    setError(null);

    const months = activeMonths;

    Promise.all([
      fetchNRWMetrics(scope, selectedYear, months, tariffBands),
      stationIds.length > 0
        ? fetchNRWByMonth(stationIds, selectedYear, months.map(m => m - 1))
        : Promise.resolve(new Map<string, NRWMonthResult>()),
    ])
      .then(([summaryData, monthData]) => {
        setSummary(summaryData);
        setMonthResults(monthData);
        setQuarterResults(aggregateNRWByQuarter(monthData, selectedYear));
      })
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessContext, selectedYear, activeMonths.length, stationIds.length, tariffBands.length]);

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2020);

  const monthlyRows = useMemo(() => {
    if (!monthResults) return [];
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
  }, [monthResults, activeMonths, selectedYear]);

  const quarterlyRows = useMemo(() => {
    if (!quarterResults) return [];
    return ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({
      label: q,
      pct: quarterResults.get(q) ?? null,
    })).reverse();
  }, [quarterResults]);

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

      {!loading && !error && summary && (
        <div className="space-y-4">
          <div className={`rounded-lg border p-3 ${pctBg(summary.totalLossPct)}`}>
            <p className="text-[11px] font-bold text-gray-600 uppercase mb-2">
              {viewMode === 'yearly' ? `${selectedYear} YTD` : viewMode === 'quarterly' ? 'Period' : 'Period'} Summary
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Total NRW Loss</p>
                <p className={`text-xl font-bold ${pctColor(summary.totalLossPct)}`}>
                  {fmt(summary.totalLossPct, 1)}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">Loss Volume</p>
                <p className="text-sm font-bold text-gray-800">{fmt(summary.totalLossVol)} m³</p>
              </div>
            </div>
            <NRWBar pct={summary.totalLossPct} />
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200">
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Produced</p>
                <p className="text-xs font-semibold text-gray-700">{fmt(summary.totalCWVolume)} m³</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Sold</p>
                <p className="text-xs font-semibold text-gray-700">{fmt(summary.totalSalesVolume)} m³</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500">Est. Loss</p>
                <p className="text-xs font-semibold text-red-700">
                  {summary.totalFinancialLoss > 0 ? `$${fmt(summary.totalFinancialLoss, 0)}` : '—'}
                </p>
              </div>
            </div>
          </div>

          {viewMode === 'monthly' && monthlyRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Monthly Trend ({selectedYear})</p>
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

          {viewMode === 'quarterly' && quarterlyRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Quarterly NRW ({selectedYear})</p>
              <div className="grid grid-cols-2 gap-2">
                {quarterlyRows.reverse().map(row => (
                  <div key={row.label} className={`rounded-lg border p-3 ${row.pct !== null ? pctBg(row.pct) : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-[11px] font-bold text-gray-600 mb-1">{row.label}</p>
                    <p className={`text-lg font-bold ${row.pct !== null ? pctColor(row.pct) : 'text-gray-300'}`}>
                      {row.pct !== null ? `${fmt(row.pct, 1)}%` : 'No data'}
                    </p>
                    {row.pct !== null && <NRWBar pct={row.pct} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'yearly' && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Station Breakdown</p>
              {summary.stations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No station data</p>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Station</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-600">NRW %</th>
                        <th className="text-right px-2 py-2 font-semibold text-gray-600">Loss Vol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.stations.map((st, i) => (
                        <tr key={st.stationId} className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                          <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[120px]">{st.stationName}</td>
                          <td className="px-2 py-2 text-right">
                            <span className={`font-semibold ${pctColor(st.totalLossPct)}`}>{fmt(st.totalLossPct, 1)}%</span>
                          </td>
                          <td className="px-2 py-2 text-right text-gray-600">{fmt(st.totalLossVol)} m³</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && !error && !summary && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Droplets className="w-8 h-8 mb-2 text-gray-200" />
          <p className="text-xs">No data available</p>
        </div>
      )}
    </div>
  );
}
