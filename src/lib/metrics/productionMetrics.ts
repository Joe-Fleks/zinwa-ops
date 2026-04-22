import { supabase } from '../supabase';
import type { ScopeFilter, DateRange } from '../metricsConfig';
import { roundTo } from '../metricsConfig';
import { applyScopeToQuery, fetchAllRows } from './scopeFilter';
import {
  computeProductionEfficiency,
  computePumpRate,
  computeDowntime,
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

  const logs = await fetchAllRows(query);
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

  const data = await fetchAllRows(query);

  const stationMap = new Map<string, {
    name: string; cwVol: number; rwVol: number; cwHrs: number; rwHrs: number;
    downtime: number; count: number;
  }>();

  for (const l of data) {
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

export interface LabourStationMetrics {
  stationId: string;
  stationName: string;
  cwVolume: number;
  rwVolume: number;
  totalVolume: number;
  operatorCount: number;
  m3PerOperator: number | null;
}

export interface LabourSummaryMetrics {
  totalVolume: number;
  totalOperators: number;
  scM3PerOperator: number | null;
  stations: LabourStationMetrics[];
}

export async function fetchLabourMetrics(
  scope: ScopeFilter,
  year: number,
  months: number[]
): Promise<LabourSummaryMetrics> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, operator_count, service_centre_id')
    .order('station_name');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);
  const { data: stationsData, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;
  const stations = stationsData || [];
  if (stations.length === 0) return { totalVolume: 0, totalOperators: 0, scM3PerOperator: null, stations: [] };

  const stationIds = stations.map((s: any) => s.id);

  const volByStation = new Map<string, { cw: number; rw: number }>();
  for (const m of months) {
    const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
    const endDate = new Date(year, m, 0).toISOString().split('T')[0];
    const data = await fetchAllRows(
      supabase
        .from('production_logs')
        .select('station_id, cw_volume_m3, rw_volume_m3')
        .in('station_id', stationIds)
        .gte('date', startDate)
        .lte('date', endDate)
    );
    for (const log of data) {
      const existing = volByStation.get(log.station_id) || { cw: 0, rw: 0 };
      existing.cw += Number(log.cw_volume_m3) || 0;
      existing.rw += Number(log.rw_volume_m3) || 0;
      volByStation.set(log.station_id, existing);
    }
  }

  const stationMetrics: LabourStationMetrics[] = stations.map((s: any) => {
    const vol = volByStation.get(s.id) || { cw: 0, rw: 0 };
    const totalVol = vol.cw + vol.rw;
    const ops = Number(s.operator_count) || 0;
    return {
      stationId: s.id,
      stationName: s.station_name,
      cwVolume: roundTo(vol.cw, 0),
      rwVolume: roundTo(vol.rw, 0),
      totalVolume: roundTo(totalVol, 0),
      operatorCount: ops,
      m3PerOperator: ops > 0 && totalVol > 0 ? roundTo(totalVol / ops, 1) : null,
    };
  }).sort((a, b) => {
    if (a.m3PerOperator === null && b.m3PerOperator === null) return 0;
    if (a.m3PerOperator === null) return 1;
    if (b.m3PerOperator === null) return -1;
    return a.m3PerOperator - b.m3PerOperator;
  });

  const totalVol = stationMetrics.reduce((s, r) => s + r.totalVolume, 0);
  const totalOps = stationMetrics.reduce((s, r) => s + r.operatorCount, 0);

  return {
    totalVolume: totalVol,
    totalOperators: totalOps,
    scM3PerOperator: totalOps > 0 && totalVol > 0 ? roundTo(totalVol / totalOps, 1) : null,
    stations: stationMetrics,
  };
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export interface YTDProductionStation {
  stationId: string;
  stationName: string;
  ytdProduction: number;
  ytdTarget: number;
  variance: number;
  achievementPct: number | null;
}

export interface YTDProductionSummary {
  stations: YTDProductionStation[];
  totalYTDProduction: number;
  totalYTDTarget: number;
  totalVariance: number;
  totalAchievementPct: number | null;
  monthlyBreakdown: Array<{
    monthIndex: number;
    monthKey: string;
    production: number;
    target: number;
  }>;
}

export async function fetchYTDProduction(
  scope: ScopeFilter,
  year: number,
  throughMonth: number,
  stationId?: string,
  proRateCurrentMonth?: { day: number; daysInMonth: number }
): Promise<YTDProductionSummary> {
  const ytdStart = `${year}-01-01`;
  const endMonth = throughMonth + 2;
  const endYear = endMonth > 12 ? year + 1 : year;
  const endMon = endMonth > 12 ? endMonth - 12 : endMonth;
  const ytdEnd = `${endYear}-${String(endMon).padStart(2, '0')}-01`;

  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, service_centre_id')
    .order('station_name');
  if (stationId) {
    stationsQuery = stationsQuery.eq('id', stationId);
  } else {
    stationsQuery = applyScopeToQuery(stationsQuery, scope);
  }
  const { data: stationsData, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;
  const allStations = stationsData || [];
  if (allStations.length === 0) {
    return { stations: [], totalYTDProduction: 0, totalYTDTarget: 0, totalVariance: 0, totalAchievementPct: null, monthlyBreakdown: [] };
  }

  const stationIds = allStations.map(s => s.id);

  const [prodLogs, targets] = await Promise.all([
    fetchAllRows(
      supabase
        .from('production_logs')
        .select('id, station_id, date, cw_volume_m3')
        .in('station_id', stationIds)
        .gte('date', ytdStart)
        .lt('date', ytdEnd)
        .order('date', { ascending: true })
        .order('station_id', { ascending: true })
        .order('id', { ascending: true })
    ),
    fetchAllRows(
      supabase
        .from('cw_production_targets')
        .select('station_id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec')
        .in('station_id', stationIds)
        .eq('year', year)
        .order('station_id', { ascending: true })
    ),
  ]);

  const ytdByStation = new Map<string, number>();
  const monthlyProdMap = new Map<number, number>();
  const seenLogIds = new Set<string>();

  for (const log of prodLogs) {
    if (log.id) {
      if (seenLogIds.has(log.id)) continue;
      seenLogIds.add(log.id);
    }
    const vol = Number(log.cw_volume_m3) || 0;
    ytdByStation.set(log.station_id, (ytdByStation.get(log.station_id) || 0) + vol);
    const mIdx = parseInt((log.date as string).split('-')[1]) - 1;
    monthlyProdMap.set(mIdx, (monthlyProdMap.get(mIdx) || 0) + vol);
  }

  const targetsByStation = new Map<string, number>();
  const monthlyTargetMap = new Map<number, number>();

  for (const t of targets) {
    let ytdTarget = 0;
    for (let m = 0; m <= throughMonth; m++) {
      let val = Number((t as any)[MONTH_KEYS[m]]) || 0;
      if (m === throughMonth && proRateCurrentMonth) {
        val = val * (proRateCurrentMonth.day / proRateCurrentMonth.daysInMonth);
      }
      ytdTarget += val;
      monthlyTargetMap.set(m, (monthlyTargetMap.get(m) || 0) + val);
    }
    targetsByStation.set(
      t.station_id,
      (targetsByStation.get(t.station_id) || 0) + ytdTarget
    );
  }

  const stations: YTDProductionStation[] = [];
  let totalProd = 0, totalTarget = 0;

  for (const station of allStations) {
    const ytdProd = roundTo(ytdByStation.get(station.id) || 0, 0);
    const ytdTgt = roundTo(targetsByStation.get(station.id) || 0, 0);
    const variance = roundTo(ytdProd - ytdTgt, 0);
    const achievement = ytdTgt > 0 ? roundTo((ytdProd / ytdTgt) * 100, 1) : null;

    stations.push({
      stationId: station.id,
      stationName: station.station_name,
      ytdProduction: ytdProd,
      ytdTarget: ytdTgt,
      variance,
      achievementPct: achievement,
    });

    totalProd += ytdProd;
    totalTarget += ytdTgt;
  }

  stations.sort((a, b) => (a.achievementPct ?? 999) - (b.achievementPct ?? 999));

  const monthlyBreakdown: YTDProductionSummary['monthlyBreakdown'] = [];
  for (let m = 0; m <= throughMonth; m++) {
    monthlyBreakdown.push({
      monthIndex: m,
      monthKey: `${year}-${String(m + 1).padStart(2, '0')}`,
      production: Math.round(monthlyProdMap.get(m) || 0),
      target: Math.round(monthlyTargetMap.get(m) || 0),
    });
  }

  return {
    stations,
    totalYTDProduction: roundTo(totalProd, 0),
    totalYTDTarget: roundTo(totalTarget, 0),
    totalVariance: roundTo(totalProd - totalTarget, 0),
    totalAchievementPct: totalTarget > 0 ? roundTo((totalProd / totalTarget) * 100, 1) : null,
    monthlyBreakdown,
  };
}
