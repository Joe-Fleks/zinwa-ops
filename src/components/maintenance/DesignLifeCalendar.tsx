import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Zap, CircleDot } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { StationOption, DesignLifeAlert, EquipmentCategory } from './equipmentConfig';

interface Props {
  stations: StationOption[];
  allowedSCIds: string[];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const CATEGORY_ICONS: Record<EquipmentCategory, React.ReactNode> = {
  pumps: <Zap className="w-3.5 h-3.5" />,
  motors: <CircleDot className="w-3.5 h-3.5" />,
  bearings: <Clock className="w-3.5 h-3.5" />,
};

const CATEGORY_COLORS: Record<EquipmentCategory, { bg: string; text: string; border: string }> = {
  pumps: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  motors: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  bearings: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  pumps: 'Pump',
  motors: 'Motor',
  bearings: 'Bearing',
};

export default function DesignLifeCalendar({ stations, allowedSCIds }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [alerts, setAlerts] = useState<DesignLifeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, [allowedSCIds, year]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year + 1}-01-01`;
      const stMap = new Map(stations.map(s => [s.id, s.station_name]));

      const tables: { table: string; category: EquipmentCategory; labelField: string }[] = [
        { table: 'equipment_pumps', category: 'pumps', labelField: 'pump_use' },
        { table: 'equipment_motors', category: 'motors', labelField: 'motor_use' },
        { table: 'equipment_bearings', category: 'bearings', labelField: 'parent_equipment' },
      ];

      const allAlerts: DesignLifeAlert[] = [];
      const today = new Date();

      for (const { table, category, labelField } of tables) {
        let q = supabase
          .from(table)
          .select(`id, station_id, tag_number, ${labelField}, manufacturer, model, design_life_expiry, condition`)
          .not('design_life_expiry', 'is', null)
          .gte('design_life_expiry', yearStart)
          .lt('design_life_expiry', yearEnd)
          .neq('condition', 'Decommissioned');

        if (allowedSCIds.length > 0 && allowedSCIds.length <= 50) {
          q = q.in('service_centre_id', allowedSCIds);
        }

        const { data } = await q;
        if (!data) continue;

        for (const row of data) {
          const expDate = new Date(row.design_life_expiry + 'T12:00:00');
          const diffDays = Math.round((expDate.getTime() - today.getTime()) / 86400000);
          const label = (row as any)[labelField] || '';
          const desc = [label, row.manufacturer, row.model].filter(Boolean).join(' - ');

          allAlerts.push({
            equipmentType: category,
            equipmentLabel: desc || CATEGORY_LABELS[category],
            stationName: stMap.get(row.station_id) || 'Unknown',
            tagNumber: row.tag_number || '',
            expiryDate: row.design_life_expiry,
            daysRemaining: diffDays,
          });
        }
      }

      allAlerts.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
      setAlerts(allAlerts);
    } catch (err) {
      console.error('Failed to load design life alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const alertsByMonth = useMemo(() => {
    const map = new Map<number, DesignLifeAlert[]>();
    for (let m = 0; m < 12; m++) map.set(m, []);
    for (const a of alerts) {
      const d = new Date(a.expiryDate + 'T12:00:00');
      const m = d.getMonth();
      map.get(m)?.push(a);
    }
    return map;
  }, [alerts]);

  const currentMonthAlerts = useMemo(() => {
    const now = new Date();
    if (now.getFullYear() !== year) return [];
    return alertsByMonth.get(now.getMonth()) || [];
  }, [alertsByMonth, year]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading design life calendar...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {currentMonthAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900 text-sm">
              Equipment reaching design life in {MONTH_NAMES[new Date().getMonth()]}
            </h3>
            <span className="ml-auto bg-amber-200 text-amber-900 rounded-full px-2 py-0.5 text-xs font-bold">{currentMonthAlerts.length}</span>
          </div>
          <div className="space-y-2">
            {currentMonthAlerts.map((a, i) => {
              const colors = CATEGORY_COLORS[a.equipmentType];
              return (
                <div key={i} className={`flex items-center gap-3 ${colors.bg} border ${colors.border} rounded-md px-3 py-2`}>
                  <span className={colors.text}>{CATEGORY_ICONS[a.equipmentType]}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-semibold ${colors.text}`}>{CATEGORY_LABELS[a.equipmentType]}</span>
                    <span className="text-xs text-gray-600 ml-2">{a.equipmentLabel}</span>
                    {a.tagNumber && <span className="text-[10px] text-gray-400 ml-1 font-mono">({a.tagNumber})</span>}
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">{a.stationName}</span>
                  <span className={`text-xs font-bold whitespace-nowrap ${a.daysRemaining < 0 ? 'text-red-700' : a.daysRemaining <= 30 ? 'text-amber-700' : 'text-gray-600'}`}>
                    {a.daysRemaining < 0 ? `${Math.abs(a.daysRemaining)}d overdue` : `${a.daysRemaining}d left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setYear(y => y - 1)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <h2 className="text-lg font-bold text-gray-900">{year} Design Life Calendar</h2>
        <button onClick={() => setYear(y => y + 1)} className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        {(['pumps', 'motors', 'bearings'] as EquipmentCategory[]).map(cat => {
          const c = CATEGORY_COLORS[cat];
          return (
            <div key={cat} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${c.bg} border ${c.border}`} />
              {CATEGORY_LABELS[cat]}s
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 ml-4">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          Overdue
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, m) => {
          const monthAlerts = alertsByMonth.get(m) || [];
          const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === m;
          return (
            <div
              key={m}
              className={`border rounded-lg overflow-hidden ${isCurrentMonth ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}
            >
              <div className={`px-3 py-2 text-sm font-semibold flex items-center justify-between ${isCurrentMonth ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-700'}`}>
                <span>{MONTH_NAMES[m]}</span>
                {monthAlerts.length > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${monthAlerts.some(a => a.daysRemaining < 0) ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800'}`}>
                    {monthAlerts.length}
                  </span>
                )}
              </div>
              <div className="px-2 py-2 min-h-[60px]">
                {monthAlerts.length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic text-center py-2">No expirations</p>
                ) : (
                  <div className="space-y-1">
                    {monthAlerts.map((a, i) => {
                      const colors = a.daysRemaining < 0
                        ? { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' }
                        : CATEGORY_COLORS[a.equipmentType];
                      return (
                        <div key={i} className={`flex items-center gap-1.5 ${colors.bg} border ${colors.border} rounded px-2 py-1`}>
                          <span className={colors.text}>{CATEGORY_ICONS[a.equipmentType]}</span>
                          <div className="flex-1 min-w-0 truncate">
                            <span className={`text-[10px] font-medium ${colors.text}`}>{a.stationName}</span>
                            {a.tagNumber && <span className="text-[10px] text-gray-400 ml-1">#{a.tagNumber}</span>}
                          </div>
                          <span className={`text-[10px] font-bold flex-shrink-0 ${a.daysRemaining < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                            {a.expiryDate.slice(5)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {alerts.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CalendarEmpty />
          <p className="text-sm mt-2">No equipment design life expirations found for {year}.</p>
          <p className="text-xs text-gray-400 mt-1">Add equipment with installation dates and design life to see the calendar populate.</p>
        </div>
      )}
    </div>
  );
}

function CalendarEmpty() {
  return (
    <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
