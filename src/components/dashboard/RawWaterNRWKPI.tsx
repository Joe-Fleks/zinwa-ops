import { useEffect, useState } from 'react';
import { Droplets, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveScopeFilter, fetchRWNRWMetrics } from '../../lib/metrics';
import type { RWNRWSummaryMetrics, RWNRWDamMetrics } from '../../lib/metrics';

const MONTH_LABELS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmt(n: number, decimals = 2): string {
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
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const color = pct > 20 ? 'bg-red-400' : pct > 10 ? 'bg-amber-400' : 'bg-green-400';
  return (
    <div className="h-1.5 bg-gray-100 rounded-full w-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${clampedPct}%` }} />
    </div>
  );
}

export default function RawWaterNRWKPI() {
  const { accessContext } = useAuth();
  const now = new Date();

  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<RWNRWSummaryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scName = accessContext?.serviceCentre?.name ?? null;

  useEffect(() => {
    loadData();
  }, [accessContext?.scopeType, accessContext?.scopeId, selectedYear, selectedMonth]);

  const loadData = async () => {
    if (!accessContext) return;
    setLoading(true);
    setError(null);

    try {
      const scope = await resolveScopeFilter(accessContext.scopeType, accessContext.scopeId);
      const data = await fetchRWNRWMetrics(scope, selectedYear, selectedMonth);
      setSummary(data);
    } catch (err: any) {
      console.error('RW NRW KPI error:', err);
      setError(err.message || 'Failed to load RW NRW data');
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (dir: -1 | 1) => {
    let newMonth = selectedMonth + dir;
    let newYear = selectedYear;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const completeDams = summary?.dams.filter(d => d.hasCompleteData) || [];
  const incompleteDams = summary?.dams.filter(d => !d.hasCompleteData) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-800">Raw Water NRW</h3>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-0.5">
          <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-white rounded transition-colors">
            <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <span className="text-xs font-semibold text-gray-700 min-w-[100px] text-center">
            {MONTH_LABELS[selectedMonth]} {selectedYear}
          </span>
          <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-white rounded transition-colors">
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-xs text-gray-500">Loading RW NRW...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500 text-xs">{error}</div>
      ) : !summary || summary.totalDams === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Droplets className="w-8 h-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No dams with capacities found</p>
          <p className="text-xs text-gray-400 mt-1">Dams need a Full Supply Capacity to calculate NRW.</p>
        </div>
      ) : (
        <>
          <div className={`rounded-lg border px-4 py-3 ${summary.nrwPct !== null ? pctBg(summary.nrwPct) : summary.damsWithData > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                {scName ? `${scName} — SC Summary` : 'Summary'}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {summary.totalAgreements} agreement{summary.totalAgreements !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-500">
                  {summary.damsWithData}/{summary.totalDams} dams with data
                </span>
              </div>
            </div>

            {summary.nrwPct !== null ? (
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-2xl font-bold ${pctColor(summary.nrwPct)}`}>
                  {summary.nrwPct.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500">RW NRW</span>
              </div>
            ) : summary.damsWithData > 0 ? (
              <div className="mb-2">
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${summary.totalNRWVolumeMl > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {fmt(summary.totalNRWVolumeMl)} ML
                  </span>
                  <span className="text-xs text-gray-500">NRW Volume</span>
                </div>
                {summary.totalChangeMl <= 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Dam levels rose this month — NRW % not applicable</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-2">Insufficient data for this month</p>
            )}

            <NRWBar pct={summary.nrwPct} />

            {summary.damsWithData > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Opening Level</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{fmt(summary.totalOpeningMl)} ML</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Closing Level</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{fmt(summary.totalClosingMl)} ML</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Water Left Dam</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{fmt(summary.totalChangeMl)} ML</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">RW Sales</span>
                  <span className="font-semibold text-gray-700 tabular-nums">{fmt(summary.totalRWSalesMl)} ML</span>
                </div>
                <div className="flex justify-between col-span-2 border-t border-gray-200 pt-1 mt-1">
                  <span className="text-gray-600 font-medium">NRW Volume</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums ${summary.totalNRWVolumeMl > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {fmt(summary.totalNRWVolumeMl)} ML
                    </span>
                    {summary.nrwPct !== null && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${summary.nrwPct > 20 ? 'bg-red-100 text-red-700' : summary.nrwPct > 10 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {summary.nrwPct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {completeDams.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Per Dam Breakdown</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {completeDams.map((dam) => (
                  <DamNRWRow key={dam.damId} dam={dam} />
                ))}
              </div>
            </div>
          )}

          {incompleteDams.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-400 mt-3 mb-1">
                {incompleteDams.length} dam{incompleteDams.length > 1 ? 's' : ''} missing level data
              </p>
              <div className="flex flex-wrap gap-1">
                {incompleteDams.map(d => (
                  <span key={d.damId} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {d.damName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DamNRWRow({ dam }: { dam: RWNRWDamMetrics }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${dam.nrwPct !== null ? pctBg(dam.nrwPct) : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {dam.damCode && <span className="text-[10px] font-mono text-gray-400">{dam.damCode}</span>}
          <span className="text-xs font-semibold text-gray-800">{dam.damName}</span>
          <span className="text-[10px] text-gray-400 tabular-nums">{dam.agreementCount} agmt{dam.agreementCount !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {dam.nrwVolumeMl !== null && (
            <span className={`text-[10px] font-medium tabular-nums ${dam.nrwVolumeMl > 0 ? 'text-red-500' : 'text-gray-500'}`}>
              {fmt(dam.nrwVolumeMl)} ML
            </span>
          )}
          {dam.nrwPct !== null ? (
            <span className={`text-sm font-bold ${pctColor(dam.nrwPct)}`}>
              {dam.nrwPct.toFixed(1)}%
            </span>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          )}
        </div>
      </div>
      <NRWBar pct={dam.nrwPct} />
      <div className="grid grid-cols-5 gap-x-2 mt-1.5 text-[10px]">
        <div>
          <span className="text-gray-400 block">Open</span>
          <span className="text-gray-700 font-medium tabular-nums">
            {dam.openingLevelMl !== null ? `${fmt(dam.openingLevelMl)}` : '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Close</span>
          <span className="text-gray-700 font-medium tabular-nums">
            {dam.closingLevelMl !== null ? `${fmt(dam.closingLevelMl)}` : '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Left Dam</span>
          <span className="text-gray-700 font-medium tabular-nums">
            {dam.changeMl !== null ? `${fmt(dam.changeMl)}` : '-'}
          </span>
        </div>
        <div>
          <span className="text-gray-400 block">Sales</span>
          <span className="text-gray-700 font-medium tabular-nums">{fmt(dam.rwSalesMl)}</span>
        </div>
        <div>
          <span className="text-gray-400 block">NRW Vol</span>
          <span className={`font-medium tabular-nums ${dam.nrwVolumeMl !== null && dam.nrwVolumeMl > 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {dam.nrwVolumeMl !== null ? fmt(dam.nrwVolumeMl) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
