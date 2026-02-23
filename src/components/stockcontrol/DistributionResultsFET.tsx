import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ArrowRightLeft } from 'lucide-react';
import type { StationDistributionData } from '../../lib/chemicalDistributionService';

interface DistributionResultsFETProps {
  stations: StationDistributionData[];
  targetDays: number;
  varianceTolerancePct: number;
  unallocatedKg: number;
}

function fmtNum(v: number | null | undefined, decimals: number = 1): string {
  if (v === null || v === undefined) return '-';
  if (v === 0) return '0';
  return v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

function getDaysBadgeColor(days: number, targetDays: number, tolerancePct: number): string {
  if (targetDays <= 0) return 'text-gray-700 bg-gray-100';
  const lower = targetDays * (1 - tolerancePct / 100);
  const upper = targetDays * (1 + tolerancePct / 100);
  if (days >= lower && days <= upper) return 'text-teal-700 bg-teal-50';
  if (days < lower) return 'text-red-700 bg-red-50';
  return 'text-amber-700 bg-amber-50';
}

export default function DistributionResultsFET({
  stations,
  targetDays,
  varianceTolerancePct,
  unallocatedKg,
}: DistributionResultsFETProps) {
  const totals = useMemo(() => {
    const totalBalance = stations.reduce((s, r) => s + r.current_balance_kg, 0);
    const totalDailyUsage = stations.reduce((s, r) => s + r.projected_daily_usage_kg, 0);
    const totalAllocated = stations.reduce((s, r) => s + r.allocated_kg, 0);
    const avgDaysBefore = stations.length > 0
      ? stations.reduce((s, r) => s + r.days_remaining_before, 0) / stations.length
      : 0;
    const avgDaysAfter = stations.length > 0
      ? stations.reduce((s, r) => s + r.days_remaining_after, 0) / stations.length
      : 0;
    return { totalBalance, totalDailyUsage, totalAllocated, avgDaysBefore, avgDaysAfter };
  }, [stations]);

  const lowerBound = targetDays * (1 - varianceTolerancePct / 100);
  const upperBound = targetDays * (1 + varianceTolerancePct / 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <span className="text-xs text-gray-500 block">Target Equalization</span>
          <span className="text-xl font-bold text-gray-900">{fmtNum(targetDays)} days</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <span className="text-xs text-gray-500 block">Tolerance Band</span>
          <span className="text-xl font-bold text-gray-900">{fmtNum(lowerBound, 0)} - {fmtNum(upperBound, 0)} days</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
          <span className="text-xs text-gray-500 block">Total Allocated</span>
          <span className="text-xl font-bold text-gray-900">{fmtNum(totals.totalAllocated)} kg</span>
        </div>
        <div className={`border rounded-lg px-4 py-3 ${unallocatedKg > 0.5 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <span className="text-xs text-gray-500 block">Unallocated</span>
          <span className={`text-xl font-bold ${unallocatedKg > 0.5 ? 'text-amber-700' : 'text-gray-900'}`}>
            {fmtNum(unallocatedKg)} kg
          </span>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 shadow-sm" style={{ maxHeight: 'calc(100vh - 440px)' }}>
        <table className="w-full border-collapse bg-white">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 text-left" style={{ minWidth: '160px' }}>
                Station
              </th>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '90px' }}>
                Balance (kg)
              </th>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '100px' }}>
                Usage (kg/day)
              </th>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 text-right" style={{ minWidth: '90px' }}>
                Days Before
              </th>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-gray-700 text-center" style={{ minWidth: '30px' }}>
                <ArrowRightLeft className="w-3.5 h-3.5 text-gray-500 mx-auto" />
              </th>
              <th className="border-b border-r border-gray-200 px-3 py-2.5 text-xs font-bold text-teal-700 text-right bg-teal-50/50" style={{ minWidth: '110px' }}>
                Allocate (kg)
              </th>
              <th className="border-b border-gray-200 px-3 py-2.5 text-xs font-bold text-teal-700 text-right bg-teal-50/50" style={{ minWidth: '100px' }}>
                Days After
              </th>
            </tr>
          </thead>
          <tbody>
            {stations.map(st => {
              const daysBadge = getDaysBadgeColor(st.days_remaining_after, targetDays, varianceTolerancePct);
              const isOffline = st.projected_daily_usage_kg <= 0;

              return (
                <tr key={st.station_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="border-b border-r border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{st.station_name}</span>
                      {st.downtime_flagged && (
                        <span className="flex-shrink-0" title="Downtime flagged - user confirmed rate">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                      {st.user_confirmed_offline_days && st.user_confirmed_offline_days > 0 ? (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {st.user_confirmed_offline_days}d offline
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 text-right">
                    <span className="text-sm font-mono text-gray-700">{fmtNum(st.current_balance_kg)}</span>
                  </td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 text-right">
                    <span className={`text-sm font-mono ${isOffline ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                      {isOffline ? 'offline' : fmtNum(st.projected_daily_usage_kg)}
                    </span>
                  </td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 text-right">
                    <span className="text-sm font-mono text-gray-500">{fmtNum(st.days_remaining_before)}</span>
                  </td>
                  <td className="border-b border-r border-gray-200 px-1 py-2 text-center">
                    <span className="text-gray-300">-</span>
                  </td>
                  <td className="border-b border-r border-gray-200 px-3 py-2 text-right bg-teal-50/30">
                    <span className="text-sm font-mono font-semibold text-teal-800">
                      {st.allocated_kg > 0 ? `+${fmtNum(st.allocated_kg)}` : fmtNum(st.allocated_kg)}
                    </span>
                  </td>
                  <td className="border-b border-gray-200 px-3 py-2 text-right bg-teal-50/30">
                    {isOffline ? (
                      <span className="text-sm font-mono text-gray-400 italic">-</span>
                    ) : (
                      <span className={`inline-flex items-center gap-1 text-sm font-mono font-semibold px-2 py-0.5 rounded ${daysBadge}`}>
                        {st.days_remaining_after >= lowerBound && st.days_remaining_after <= upperBound && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {fmtNum(st.days_remaining_after)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <td className="border-r border-gray-200 px-3 py-2.5">
                <span className="text-sm font-bold text-gray-900">Total / Average</span>
              </td>
              <td className="border-r border-gray-200 px-3 py-2.5 text-right">
                <span className="text-sm font-mono font-bold">{fmtNum(totals.totalBalance)}</span>
              </td>
              <td className="border-r border-gray-200 px-3 py-2.5 text-right">
                <span className="text-sm font-mono font-bold">{fmtNum(totals.totalDailyUsage)}</span>
              </td>
              <td className="border-r border-gray-200 px-3 py-2.5 text-right">
                <span className="text-sm font-mono font-bold text-gray-500">avg {fmtNum(totals.avgDaysBefore)}</span>
              </td>
              <td className="border-r border-gray-200 px-1 py-2.5" />
              <td className="border-r border-gray-200 px-3 py-2.5 text-right bg-teal-50/30">
                <span className="text-sm font-mono font-bold text-teal-800">{fmtNum(totals.totalAllocated)}</span>
              </td>
              <td className="px-3 py-2.5 text-right bg-teal-50/30">
                <span className="text-sm font-mono font-bold text-teal-800">avg {fmtNum(totals.avgDaysAfter)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
