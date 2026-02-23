import { supabase } from '../supabase';
import type { ScopeFilter, DateRange } from '../metricsConfig';
import { roundTo } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';
import {
  computeDowntime,
  computeProductionEfficiency,
  computePumpRate,
} from './coreCalculations';

export interface ProductionSummaryMetrics {
  totalCWVolume: number;
  totalRWVolume: number;
  totalCWHours: number;
  totalRWHours: number;
  totalDowntime: number;
  totalLoadShedding: number;
  totalOtherDowntime: number;
  stationCount: number;
  logCount: number;
  avgEfficiency: number;
  avgCWPumpRate: number | null;
  avgRWPumpRate: number | null;
}

export interface StationProductionMetrics {
  stationId: string;
  stationName: string;
  cwVolume: number;
  rwVolume: number;
  cwHours: number;
  rwHours: number;
  downtime: number;
  logCount: number;
  efficiency: number;
  cwPumpRate: number | null;
  rwPumpRate: number | null;
}

export async function fetchProductionSummary(
  scope: ScopeFilter,
  dateRange: DateRange
): Promise<ProductionSummaryMetrics> {
  let query = supabase
    .from('production_logs')
    .select('station_id, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, stations!inner(service_centre_id)')
    .gte('date', dateRange.start)
    .lt('date', dateRange.end);

  query = applyScopeToQuery(query, scope, 'stations.service_centre_id');

  const { data, error } = await query;
  if (error) throw error;

  const logs = data || [];
  if (logs.length === 0) {
    return {
      totalCWVolume: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0,
      totalDowntime: 0, totalLoadShedding: 0, totalOtherDowntime: 0,
      stationCount: 0, logCount: 0, avgEfficiency: 0,
      avgCWPumpRate: null, avgRWPumpRate: null,
    };
  }

  const uniqueStations = new Set(logs.map((l: any) => l.station_id));
  let totalCWVol = 0, totalRWVol = 0, totalCWHrs = 0, totalRWHrs = 0;
  let totalLS = 0, totalOther = 0;

  for (const l of logs) {
    totalCWVol += Number(l.cw_volume_m3) || 0;
    totalRWVol += Number(l.rw_volume_m3) || 0;
    totalCWHrs += Number(l.cw_hours_run) || 0;
    totalRWHrs += Number(l.rw_hours_run) || 0;
    totalLS += Number(l.load_shedding_hours) || 0;
    totalOther += Number(l.other_downtime_hours) || 0;
  }

  const totalDown = totalLS + totalOther;

  return {
    totalCWVolume: roundTo(totalCWVol, 2),
    totalRWVolume: roundTo(totalRWVol, 2),
    totalCWHours: roundTo(totalCWHrs, 2),
    totalRWHours: roundTo(totalRWHrs, 2),
    totalDowntime: roundTo(totalDown, 2),
    totalLoadShedding: roundTo(totalLS, 2),
    totalOtherDowntime: roundTo(totalOther, 2),
    stationCount: uniqueStations.size,
    logCount: logs.length,
    avgEfficiency: computeProductionEfficiency(totalCWHrs, logs.length),
    avgCWPumpRate: computePumpRate(totalCWVol, totalCWHrs),
    avgRWPumpRate: computePumpRate(totalRWVol, totalRWHrs),
  };
}

export async function fetchStationProductionMetrics(
  scope: ScopeFilter,
  dateRange: DateRange
): Promise<StationProductionMetrics[]> {
  let query = supabase
    .from('production_logs')
    .select('station_id, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, stations!inner(station_name, service_centre_id)')
    .gte('date', dateRange.start)
    .lt('date', dateRange.end);

  query = applyScopeToQuery(query, scope, 'stations.service_centre_id');

  const { data, error } = await query;
  if (error) throw error;

  const stationMap = new Map<string, {
    name: string; cwVol: number; rwVol: number; cwHrs: number; rwHrs: number;
    downtime: number; count: number;
  }>();

  for (const l of (data || [])) {
    const sid = l.station_id;
    const existing = stationMap.get(sid) || {
      name: (l.stations as any)?.station_name || '',
      cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0, downtime: 0, count: 0,
    };

    existing.cwVol += Number(l.cw_volume_m3) || 0;
    existing.rwVol += Number(l.rw_volume_m3) || 0;
    existing.cwHrs += Number(l.cw_hours_run) || 0;
    existing.rwHrs += Number(l.rw_hours_run) || 0;
    existing.downtime += computeDowntime(l.load_shedding_hours, l.other_downtime_hours);
    existing.count++;
    stationMap.set(sid, existing);
  }

  return Array.from(stationMap.entries()).map(([stationId, d]) => ({
    stationId,
    stationName: d.name,
    cwVolume: roundTo(d.cwVol, 2),
    rwVolume: roundTo(d.rwVol, 2),
    cwHours: roundTo(d.cwHrs, 2),
    rwHours: roundTo(d.rwHrs, 2),
    downtime: roundTo(d.downtime, 2),
    logCount: d.count,
    efficiency: computeProductionEfficiency(d.cwHrs, d.count),
    cwPumpRate: computePumpRate(d.cwVol, d.cwHrs),
    rwPumpRate: computePumpRate(d.rwVol, d.rwHrs),
  }));
}
