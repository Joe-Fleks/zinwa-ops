import { useEffect, useState, useMemo } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveScopeFilter, fetchLabourMetrics } from '../../lib/metrics';
import type { LabourSummaryMetrics } from '../../lib/metrics';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = [
  { label: 'Q1 (Jan–Mar)', months: [1, 2, 3] },
  { label: 'Q2 (Apr–Jun)', months: [4, 5, 6] },
  { label: 'Q3 (Jul–Sep)', months: [7, 8, 9] },
  { label: 'Q4 (Oct–Dec)', months: [10, 11, 12] },
];

type FilterMode = 'monthly' | 'quarterly' | 'yearly';

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtRate(n: number | null): string {
  if (n === null) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

function RateBar({ value, max }: { value: number | null; max: number }) {
  if (value === null || max === 0) return <div className="h-1.5 bg-gray-100 rounded-full w-full" />;
  const pct = Math.min((value / max) * 100, 100);
  const color = pct < 33 ? 'bg-red-400' : pct < 66 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function LabourKPI() {
  const { accessContext } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQ = Math.max(0, Math.ceil(currentMonth / 3) - 1);

  const [filterMode, setFilterMode] = useState<FilterMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQ);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState<LabourSummaryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scName = accessContext?.serviceCentre?.name ?? null;

  const months: number[] = useMemo(() => {
    if (filterMode === 'monthly') return [selectedMonth];
    if (filterMode === 'quarterly') return QUARTERS[selectedQuarter].months;
    const active = selectedYear < currentYear
      ? Array.from({ length: 12 }, (_, i) => i + 1)
      : Array.from({ length: currentMonth }, (_, i) => i + 1);
    return active;
  }, [filterMode, selectedMonth, selectedQuarter, selectedYear, currentYear, currentMonth]);

  const periodLabel = useMemo(() => {
    if (filterMode === 'monthly') return `${MONTH_LABELS[selectedMonth - 1]} ${selectedYear}`;
    if (filterMode === 'quarterly') return `${QUARTERS[selectedQuarter].label.split(' ')[0]} ${selectedYear}`;
    return `${selectedYear} YTD`;
  }, [filterMode, selectedMonth, selectedQuarter, selectedYear]);

  const summaryLabel = useMemo(() => {
    const base = scName ? `${scName} SC` : 'SC';
    return `${base} — ${periodLabel} Summary`;
  }, [scName, periodLabel]);

  useEffect(() => {
    if (!accessContext) return;
    const scope = resolveScopeFilter(accessContext);
    setLoading(true);
    setError(null);
    fetchLabourMetrics(scope, selectedYear, months)
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessContext, selectedYear, months.join(',')]);

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear].filter(y => y >= 2020);
  const maxRate = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.stations.map(s => s.m3PerOperator ?? 0));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-4 h-4 text-cyan-600" />
        <h3 className="text-sm font-bold text-gray-800">Labour Productivity</h3>
        <span className="text-xs text-gray-500">m³ per operator</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['monthly', 'quarterly', 'yearly'] as FilterMode[]).map(m => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                filterMode === m
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {filterMode === 'monthly' && (
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
            >
              {MONTH_LABELS.map((lbl, i) => (
                <option key={i + 1} value={i + 1} disabled={i + 1 > currentMonth && selectedYear === currentYear}>{lbl}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {filterMode === 'quarterly' && (
          <div className="relative">
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
            className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
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
          <span className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {!loading && !error && data && (
        <div className="space-y-3">
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
            <p className="text-[11px] font-bold text-cyan-700 uppercase mb-2">{summaryLabel}</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Volume</p>
                <p className="text-base font-bold text-gray-800">{fmt(data.totalVolume)}</p>
                <p className="text-[10px] text-gray-400">m³</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">Total Operators</p>
                <p className="text-base font-bold text-gray-800">{data.totalOperators}</p>
                <p className="text-[10px] text-gray-400">staff</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500 mb-0.5">SC Average</p>
                <p className="text-base font-bold text-cyan-700">{fmtRate(data.scM3PerOperator)}</p>
                <p className="text-[10px] text-gray-400">m³/operator</p>
              </div>
            </div>
          </div>

          {data.stations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No data for this period</div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Station</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">Vol (m³)</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">Operators</th>
                    <th className="text-right px-2 py-2 font-semibold text-cyan-700">m³/Operator</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stations.map((st, i) => (
                    <tr
                      key={st.stationId}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[120px]">{st.stationName}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{fmt(st.totalVolume)}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{st.operatorCount > 0 ? st.operatorCount : '—'}</td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-semibold ${st.m3PerOperator !== null ? 'text-cyan-700' : 'text-gray-300'}`}>
                            {fmtRate(st.m3PerOperator)}
                          </span>
                          {st.m3PerOperator !== null && <RateBar value={st.m3PerOperator} max={maxRate} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-gray-400">
            Sorted by lowest m³/operator first · operator_count from station registry
          </p>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <Users className="w-8 h-8 mb-2 text-gray-200" />
          <p className="text-xs">No data available</p>
        </div>
      )}
    </div>
  );
}
