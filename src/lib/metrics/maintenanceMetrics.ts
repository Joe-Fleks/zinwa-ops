import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo, THRESHOLDS } from '../metricsConfig';
import { applyScopeToQuery, fetchAllRows } from './scopeFilter';
import {
  isStationNonFunctional,
  computeDowntime,
  computeCapacityVariancePct,
  computePumpRate,
} from './coreCalculations';

export interface NonFunctionalSummary {
  nonFunctionalCount: number;
  totalStations: number;
  savedRecordsCount: number;
  savedPercentage: number;
  nonFunctionalPercentage: number;
  date: string;
}

export interface DowntimeStationMetrics {
  stationId: string;
  stationName: string;
  totalDowntime: number;
  loadSheddingHours: number;
  otherDowntimeHours: number;
  severity: 'normal' | 'warning' | 'critical';
}

export interface CapacityVarianceStationMetrics {
  stationId: string;
  stationName: string;
  designCapacity: number;
  cwCurrentFlow: number | null;
  rwCurrentFlow: number | null;
  cwVariancePct: number | null;
  rwVariancePct: number | null;
}

export async function fetchNonFunctionalSummary(
  scope: ScopeFilter,
  date: string
): Promise<NonFunctionalSummary> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, target_daily_hours, cw_pump_rate_m3_hr, service_centre_id');

  stationsQuery = applyScopeToQuery(stationsQuery, scope);
  const { data: allStations, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const stations = allStations || [];
  const totalStations = stations.length;

  if (totalStations === 0) {
    return { nonFunctionalCount: 0, totalStations: 0, savedRecordsCount: 0, savedPercentage: 0, nonFunctionalPercentage: 0, date };
  }

  const stationIds = stations.map(s => s.id);

  const [logsRes, breakdownsRes] = await Promise.all([
    supabase
      .from('production_logs')
      .select('station_id, cw_volume_m3, cw_hours_run')
      .in('station_id', stationIds)
      .eq('date', date),
    supabase
      .from('station_breakdowns')
      .select('station_id')
      .in('station_id', stationIds)
      .eq('breakdown_impact', 'Stopped pumping')
      .eq('is_resolved', false)
      .lte('date_reported', date),
  ]);

  if (logsRes.error) throw logsRes.error;
  if (breakdownsRes.error) throw breakdownsRes.error;

  const stoppingBreakdownIds = new Set(
    (breakdownsRes.data || []).map((b: any) => b.station_id)
  );

  const logsByStation = new Map<string, any>();
  for (const log of (logsRes.data || [])) {
    logsByStation.set(log.station_id, log);
  }

  const savedRecordsCount = logsByStation.size;
  let nonFunctionalCount = 0;

  for (const station of stations) {
    const log = logsByStation.get(station.id);
    if (!log) continue;

    const nonFunc = isStationNonFunctional({
      cwVolume: Number(log.cw_volume_m3 || 0),
      cwHours: Number(log.cw_hours_run || 0),
      targetDailyHours: Number((station as any).target_daily_hours || 0),
      pumpRate: Number((station as any).cw_pump_rate_m3_hr || 0),
      hasStoppingBreakdown: stoppingBreakdownIds.has(station.id),
    });

    if (nonFunc) nonFunctionalCount++;
  }

  return {
    nonFunctionalCount,
    totalStations,
    savedRecordsCount,
    savedPercentage: totalStations > 0 ? roundTo((savedRecordsCount / totalStations) * 100, 0) : 0,
    nonFunctionalPercentage: savedRecordsCount > 0 ? roundTo((nonFunctionalCount / savedRecordsCount) * 100, 0) : 0,
    date,
  };
}

export async function fetchDowntimeByStation(
  scope: ScopeFilter,
  dateStart: string,
  dateEnd: string
): Promise<DowntimeStationMetrics[]> {
  let query = supabase
    .from('production_logs')
    .select('station_id, load_shedding_hours, other_downtime_hours, stations!inner(station_name, service_centre_id)')
    .gte('date', dateStart)
    .lte('date', dateEnd);

  query = applyScopeToQuery(query, scope, 'stations.service_centre_id');
  const data = await fetchAllRows(query);

  const stationMap = new Map<string, { name: string; ls: number; other: number }>();
  for (const log of data) {
    const sid = log.station_id;
    const existing = stationMap.get(sid) || { name: (log.stations as any)?.station_name || '', ls: 0, other: 0 };
    existing.ls += Number(log.load_shedding_hours) || 0;
    existing.other += Number(log.other_downtime_hours) || 0;
    stationMap.set(sid, existing);
  }

  return Array.from(stationMap.entries())
    .map(([stationId, d]) => {
      const total = d.ls + d.other;
      let severity: 'normal' | 'warning' | 'critical' = 'normal';
      if (total > THRESHOLDS.CRITICAL_DOWNTIME_WEEKLY_HOURS) severity = 'critical';
      else if (total > THRESHOLDS.HIGH_DOWNTIME_WEEKLY_HOURS) severity = 'warning';

      return {
        stationId,
        stationName: d.name,
        totalDowntime: roundTo(total, 1),
        loadSheddingHours: roundTo(d.ls, 1),
        otherDowntimeHours: roundTo(d.other, 1),
        severity,
      };
    })
    .sort((a, b) => b.totalDowntime - a.totalDowntime);
}

export async function fetchCapacityVarianceMetrics(
  scope: ScopeFilter,
  dateStart: string,
  dateEnd: string
): Promise<CapacityVarianceStationMetrics[]> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, station_type, design_capacity_m3_hr, service_centre_id');

  stationsQuery = applyScopeToQuery(stationsQuery, scope);
  const { data: stations, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  if (!stations || stations.length === 0) return [];

  const ids = stations.map(s => s.id);
  const logs = await fetchAllRows(
    supabase
      .from('production_logs')
      .select('station_id, rw_volume_m3, rw_hours_run, cw_volume_m3, cw_hours_run')
      .in('station_id', ids)
      .gte('date', dateStart)
      .lte('date', dateEnd)
  );

  const aggMap = new Map<string, { rwVol: number; rwHrs: number; cwVol: number; cwHrs: number }>();
  for (const log of logs) {
    const existing = aggMap.get(log.station_id) || { rwVol: 0, rwHrs: 0, cwVol: 0, cwHrs: 0 };
    existing.rwVol += Number(log.rw_volume_m3) || 0;
    existing.rwHrs += Number(log.rw_hours_run) || 0;
    existing.cwVol += Number(log.cw_volume_m3) || 0;
    existing.cwHrs += Number(log.cw_hours_run) || 0;
    aggMap.set(log.station_id, existing);
  }

  return stations.map(station => {
    const agg = aggMap.get(station.id);
    const dc = Number(station.design_capacity_m3_hr) || 0;
    const rwFlow = agg ? computePumpRate(agg.rwVol, agg.rwHrs) : null;
    const cwFlow = agg ? computePumpRate(agg.cwVol, agg.cwHrs) : null;

    return {
      stationId: station.id,
      stationName: station.station_name,
      designCapacity: dc,
      cwCurrentFlow: cwFlow,
      rwCurrentFlow: rwFlow,
      cwVariancePct: computeCapacityVariancePct(cwFlow, dc),
      rwVariancePct: computeCapacityVariancePct(rwFlow, dc),
    };
  });
}
