import { useState } from 'react';
import { AlertTriangle, X, Check, Clock, Power, Wrench, Calculator } from 'lucide-react';
import type { StationDistributionData, SuggestedRate } from '../../lib/chemicalDistributionService';

interface DowntimeConfirmationModalProps {
  stations: StationDistributionData[];
  onConfirm: (confirmations: Map<string, { rate: number; offlineDays: number }>) => void;
  onCancel: () => void;
}

export default function DowntimeConfirmationModal({
  stations,
  onConfirm,
  onCancel,
}: DowntimeConfirmationModalProps) {
  const [confirmations, setConfirmations] = useState<Map<string, { rate: number; offlineDays: number }>>(
    () => {
      const map = new Map();
      for (const st of stations) {
        const historicalAvg = st.suggested_rates.find(r => r.basis === '30-day historical average daily usage');
        const defaultRate = historicalAvg || st.suggested_rates.find(r => r.value > 0);
        map.set(st.station_id, {
          rate: defaultRate?.value ?? st.projected_daily_usage_kg,
          offlineDays: 0,
        });
      }
      return map;
    }
  );

  const [customRates, setCustomRates] = useState<Map<string, string>>(() => new Map());
  const [expandedStation, setExpandedStation] = useState<string | null>(
    stations.length === 1 ? stations[0].station_id : null
  );

  const handleSelectRate = (stationId: string, rate: number) => {
    setConfirmations(prev => {
      const next = new Map(prev);
      const existing = next.get(stationId) || { rate: 0, offlineDays: 0 };
      next.set(stationId, { ...existing, rate });
      return next;
    });
    setCustomRates(prev => {
      const next = new Map(prev);
      next.delete(stationId);
      return next;
    });
  };

  const handleCustomRate = (stationId: string, value: string) => {
    setCustomRates(prev => {
      const next = new Map(prev);
      next.set(stationId, value);
      return next;
    });
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0) {
      setConfirmations(prev => {
        const next = new Map(prev);
        const existing = next.get(stationId) || { rate: 0, offlineDays: 0 };
        next.set(stationId, { ...existing, rate: parsed });
        return next;
      });
    }
  };

  const handleOfflineDays = (stationId: string, days: number) => {
    setConfirmations(prev => {
      const next = new Map(prev);
      const existing = next.get(stationId) || { rate: 0, offlineDays: 0 };
      next.set(stationId, { ...existing, offlineDays: Math.max(0, days) });
      return next;
    });
  };

  const isSelectedRate = (stationId: string, rateValue: number): boolean => {
    const conf = confirmations.get(stationId);
    if (!conf) return false;
    if (customRates.has(stationId)) return false;
    return Math.abs(conf.rate - rateValue) < 0.01;
  };

  const downtimeFlaggedCount = stations.filter(s => s.downtime_flagged).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border-2 border-teal-500">
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-teal-500 bg-gradient-to-r from-teal-50 to-blue-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
              <Calculator className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Confirm Daily Usage Rates</h2>
              <p className="text-xs text-gray-600">
                {stations.length} station{stations.length !== 1 ? 's' : ''} ready for distribution
                {downtimeFlaggedCount > 0 && ` (${downtimeFlaggedCount} with high downtime)`}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-teal-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100">
          <p className="text-xs text-blue-800">
            Review and adjust the daily consumption rates below. The 30-day average (based on days with production) is pre-selected.
            {downtimeFlaggedCount > 0 && ' Stations with high downtime are highlighted.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5 bg-gray-50">
          {stations.map(st => {
            const conf = confirmations.get(st.station_id);
            const isExpanded = expandedStation === st.station_id;
            const hasHighDowntime = st.downtime_flagged;

            return (
              <div
                key={st.station_id}
                className={`border-2 rounded-lg overflow-hidden transition-all ${
                  hasHighDowntime
                    ? 'border-amber-400 bg-amber-50/50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  onClick={() => setExpandedStation(isExpanded ? null : st.station_id)}
                  className={`w-full flex items-center justify-between px-3 py-2 transition-colors text-left ${
                    hasHighDowntime
                      ? 'bg-amber-50 hover:bg-amber-100'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {hasHighDowntime && (
                      <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{st.station_name}</span>
                      <div className="flex items-center gap-2.5 text-xs text-gray-600 mt-0.5">
                        {hasHighDowntime && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <Clock className="w-3 h-3" />
                            {st.downtime_pct_48h}% downtime
                          </span>
                        )}
                        <span>Balance: {st.current_balance_kg} kg</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conf && (
                      <span className="text-xs font-medium text-teal-700 bg-teal-100 px-2 py-1 rounded border border-teal-200">
                        {conf.rate} kg/day
                        {conf.offlineDays > 0 ? ` + ${conf.offlineDays}d offline` : ''}
                      </span>
                    )}
                    <svg
                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className={`px-3 py-3 space-y-3 border-t-2 ${
                    hasHighDowntime ? 'border-amber-200 bg-white' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-100 rounded px-2 py-1.5">
                        <span className="text-gray-600 block text-[10px]">Design Capacity</span>
                        <span className="font-semibold text-gray-900">{st.design_capacity_m3_hr} m3/h</span>
                      </div>
                      <div className="bg-gray-100 rounded px-2 py-1.5">
                        <span className="text-gray-600 block text-[10px]">Target Hours</span>
                        <span className="font-semibold text-gray-900">{st.target_daily_hours} h/day</span>
                      </div>
                      <div className="bg-gray-100 rounded px-2 py-1.5">
                        <span className="text-gray-600 block text-[10px]">Current Balance</span>
                        <span className="font-semibold text-gray-900">{st.current_balance_kg} kg</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Select consumption rate (click to confirm)
                      </label>
                      <div className="space-y-1">
                        {st.suggested_rates.map((suggestion: SuggestedRate, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectRate(st.station_id, suggestion.value)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded border transition-all text-left ${
                              isSelectedRate(st.station_id, suggestion.value)
                                ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                                : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelectedRate(st.station_id, suggestion.value)
                                  ? 'border-teal-600 bg-teal-600'
                                  : 'border-gray-300'
                              }`}>
                                {isSelectedRate(st.station_id, suggestion.value) && (
                                  <Check className="w-2.5 h-2.5 text-white" />
                                )}
                              </div>
                              <span className="text-sm font-semibold text-gray-900">{suggestion.label}</span>
                            </div>
                            <span className="text-[11px] text-gray-500 max-w-[55%] text-right leading-tight">{suggestion.basis}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Or enter custom rate (kg/day)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="e.g. 25.5"
                        value={customRates.get(st.station_id) ?? ''}
                        onChange={(e) => handleCustomRate(st.station_id, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      />
                    </div>

                    <div className="border-t border-gray-200 pt-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Wrench className="w-3 h-3 text-gray-500" />
                        <label className="text-xs font-semibold text-gray-700">
                          Days station will remain offline (maintenance)
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={conf?.offlineDays ?? 0}
                          onChange={(e) => handleOfflineDays(st.station_id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                        <span className="text-xs text-gray-500">days (0 = resuming immediately)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t-2 border-teal-500 bg-gradient-to-r from-teal-50 to-blue-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(confirmations)}
            className="px-5 py-2 text-sm font-medium text-blue-900 bg-blue-200 rounded-lg hover:bg-blue-300 transition-colors shadow-md hover:shadow-lg"
          >
            Confirm & Calculate Distribution
          </button>
        </div>
      </div>
    </div>
  );
}
