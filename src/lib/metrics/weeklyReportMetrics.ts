import { supabase } from '../supabase';
import type { ScopeFilter, DateRange } from '../metricsConfig';
import { roundTo, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';
import {
  computeDowntime,
  computeProductionEfficiency,
  computePumpRate,
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
  isChemicalLowStock,
} from './coreCalculations';

export interface WeeklyStationProduction {
  stationId: string;
  stationName: string;
  stationType: string;
  logCount: number;
  cwVolume: number;
  rwVolume: number;
  cwHours: number;
  rwHours: number;
  loadSheddingHours: number;
  otherDowntimeHours: number;
  totalDowntime: number;
  efficiency: number;
  cwPumpRate: number | null;
  rwPumpRate: number | null;
  newConnections: number;
}

export interface WeeklyProductionSummary {
  totalCWVolume: number;
  totalRWVolume: number;
  totalCWHours: number;
  totalRWHours: number;
  totalLoadShedding: number;
  totalOtherDowntime: number;
  totalDowntime: number;
  stationCount: number;
  logCount: number;
  avgEfficiency: number;
  avgCWPumpRate: number | null;
  avgRWPumpRate: number | null;
  totalNewConnections: number;
  stations: WeeklyStationProduction[];
}

export interface WeeklyBreakdown {
  stationName: string;
  component: string;
  description: string;
  dateReported: string;
  isResolved: boolean;
  dateResolved: string | null;
  impact: string;
}

export interface WeeklyChemicalSummary {
  chemicalType: string;
  label: string;
  totalUsed: number;
  totalBalance: number;
  lowStockCount: number;
  lowStockStations: Array<{ stationName: string; daysRemaining: number }>;
}

export interface WeeklyNonFunctionalDay {
  date: string;
  nonFunctionalCount: number;
  totalLogged: number;
}

export interface WeeklyReportData {
  serviceCentreName: string;
  serviceCentreId: string;
  weekNumber: number;
  year: number;
  reportType: 'friday' | 'tuesday';
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  production: WeeklyProductionSummary;
  breakdowns: WeeklyBreakdown[];
  chemicals: WeeklyChemicalSummary[];
  nonFunctionalByDay: WeeklyNonFunctionalDay[];
  totalExpectedLogs: number;
  totalActualLogs: number;
  completionPct: number;
}

export async function fetchWeeklyReportData(
  scope: ScopeFilter,
  dateRange: DateRange,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday',
  serviceCentreName: string
): Promise<WeeklyReportData> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, station_type, service_centre_id');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);

  const { data: stations, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const allStations = stations || [];
  const stationIds = allStations.map(s => s.id);
  const stationMap = new Map(allStations.map(s => [s.id, s]));

  if (stationIds.length === 0) {
    return buildEmptyReport(scope.scopeId || '', serviceCentreName, weekNumber, year, reportType, dateRange);
  }

  const [logsRes, breakdownsRes, balancesRes, receiptsRes] = await Promise.all([
    supabase
      .from('production_logs')
      .select('station_id, date, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, alum_kg, hth_kg, activated_carbon_kg, new_connections')
      .in('station_id', stationIds)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true }),
    supabase
      .from('station_breakdowns')
      .select('station_id, nature_of_breakdown, description, date_reported, is_resolved, date_resolved, breakdown_impact')
      .in('station_id', stationIds)
      .gte('date_reported', dateRange.start)
      .lte('date_reported', dateRange.end),
    supabase
      .from('chemical_stock_balances')
      .select('station_id, chemical_type, opening_balance, year, month')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon']),
    supabase
      .from('chemical_stock_receipts')
      .select('station_id, chemical_type, quantity, receipt_type, year, month')
      .in('station_id', stationIds)
      .in('chemical_type', ['aluminium_sulphate', 'hth', 'activated_carbon']),
  ]);

  const logs = logsRes.data || [];

  const stationAgg = new Map<string, {
    cwVol: number; rwVol: number; cwHrs: number; rwHrs: number;
    ls: number; other: number; count: number; connections: number;
    alumUsed: number; hthUsed: number; acUsed: number;
  }>();

  for (const log of logs) {
    const sid = log.station_id;
    const existing = stationAgg.get(sid) || {
      cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0,
      ls: 0, other: 0, count: 0, connections: 0,
      alumUsed: 0, hthUsed: 0, acUsed: 0,
    };
    existing.cwVol += Number(log.cw_volume_m3) || 0;
    existing.rwVol += Number(log.rw_volume_m3) || 0;
    existing.cwHrs += Number(log.cw_hours_run) || 0;
    existing.rwHrs += Number(log.rw_hours_run) || 0;
    existing.ls += Number(log.load_shedding_hours) || 0;
    existing.other += Number(log.other_downtime_hours) || 0;
    existing.count++;
    existing.connections += Number(log.new_connections) || 0;
    existing.alumUsed += Number(log.alum_kg) || 0;
    existing.hthUsed += Number(log.hth_kg) || 0;
    existing.acUsed += Number(log.activated_carbon_kg) || 0;
    stationAgg.set(sid, existing);
  }

  const stationMetrics: WeeklyStationProduction[] = [];
  let totalCWVol = 0, totalRWVol = 0, totalCWHrs = 0, totalRWHrs = 0;
  let totalLS = 0, totalOther = 0, totalLogCount = 0, totalConnections = 0;

  for (const station of allStations) {
    const agg = stationAgg.get(station.id);
    if (!agg) continue;
    const downtime = agg.ls + agg.other;
    stationMetrics.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      logCount: agg.count,
      cwVolume: roundTo(agg.cwVol, 2),
      rwVolume: roundTo(agg.rwVol, 2),
      cwHours: roundTo(agg.cwHrs, 2),
      rwHours: roundTo(agg.rwHrs, 2),
      loadSheddingHours: roundTo(agg.ls, 1),
      otherDowntimeHours: roundTo(agg.other, 1),
      totalDowntime: roundTo(downtime, 1),
      efficiency: computeProductionEfficiency(agg.cwHrs, agg.count),
      cwPumpRate: computePumpRate(agg.cwVol, agg.cwHrs),
      rwPumpRate: computePumpRate(agg.rwVol, agg.rwHrs),
      newConnections: agg.connections,
    });
    totalCWVol += agg.cwVol;
    totalRWVol += agg.rwVol;
    totalCWHrs += agg.cwHrs;
    totalRWHrs += agg.rwHrs;
    totalLS += agg.ls;
    totalOther += agg.other;
    totalLogCount += agg.count;
    totalConnections += agg.connections;
  }

  stationMetrics.sort((a, b) => b.cwVolume - a.cwVolume);

  const production: WeeklyProductionSummary = {
    totalCWVolume: roundTo(totalCWVol, 2),
    totalRWVolume: roundTo(totalRWVol, 2),
    totalCWHours: roundTo(totalCWHrs, 2),
    totalRWHours: roundTo(totalRWHrs, 2),
    totalLoadShedding: roundTo(totalLS, 2),
    totalOtherDowntime: roundTo(totalOther, 2),
    totalDowntime: roundTo(totalLS + totalOther, 2),
    stationCount: stationMetrics.length,
    logCount: totalLogCount,
    avgEfficiency: computeProductionEfficiency(totalCWHrs, totalLogCount),
    avgCWPumpRate: computePumpRate(totalCWVol, totalCWHrs),
    avgRWPumpRate: computePumpRate(totalRWVol, totalRWHrs),
    totalNewConnections: totalConnections,
    stations: stationMetrics,
  };

  const breakdowns: WeeklyBreakdown[] = (breakdownsRes.data || []).map((b: any) => ({
    stationName: stationMap.get(b.station_id)?.station_name || 'Unknown',
    component: b.nature_of_breakdown || '',
    description: b.description || '',
    dateReported: b.date_reported,
    isResolved: !!b.is_resolved,
    dateResolved: b.date_resolved || null,
    impact: b.breakdown_impact || '',
  }));

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const chemicals: WeeklyChemicalSummary[] = [];
  const chemLabels: Record<string, string> = {
    aluminium_sulphate: 'Aluminium Sulphate',
    hth: 'HTH (Calcium Hypochlorite)',
    activated_carbon: 'Activated Carbon',
  };

  for (const chemType of CHEMICAL_TYPES) {
    const prodField = CHEMICAL_PROD_FIELDS[chemType];
    let totalUsed = 0;
    let totalBalance = 0;
    const lowStockStations: Array<{ stationName: string; daysRemaining: number }> = [];

    for (const station of allStations) {
      if (station.station_type !== 'Full Treatment') continue;
      const sid = station.id;

      const balRow = (balancesRes.data || []).find(
        (r: any) => r.station_id === sid && r.chemical_type === chemType &&
          r.year === currentYear && r.month === currentMonth
      );
      const opening = balRow ? Number(balRow.opening_balance) : 0;

      const stationReceipts = (receiptsRes.data || []).filter(
        (r: any) => r.station_id === sid && r.chemical_type === chemType &&
          r.year === currentYear && r.month === currentMonth
      );
      const received = computeReceiptTotal(stationReceipts);

      let used = 0;
      let prodDays = 0;
      for (const log of logs) {
        if (log.station_id !== sid) continue;
        const val = Number((log as any)[prodField]) || 0;
        used += val;
        if (val > 0) prodDays++;
      }

      const balance = computeChemicalBalance(opening, received, used);
      const avgUsage = computeAvgUsagePerDay(used, prodDays);
      const daysRemaining = computeDaysRemaining(balance, avgUsage);

      totalUsed += used;
      totalBalance += balance > 0 ? balance : 0;

      if (daysRemaining !== null && isChemicalLowStock(daysRemaining)) {
        lowStockStations.push({
          stationName: station.station_name,
          daysRemaining: Math.round(daysRemaining),
        });
      }
    }

    lowStockStations.sort((a, b) => a.daysRemaining - b.daysRemaining);

    chemicals.push({
      chemicalType: chemType,
      label: chemLabels[chemType] || chemType,
      totalUsed: roundTo(totalUsed, 1),
      totalBalance: roundTo(totalBalance, 1),
      lowStockCount: lowStockStations.length,
      lowStockStations,
    });
  }

  const datesByDay = new Map<string, string[]>();
  for (const log of logs) {
    const existing = datesByDay.get(log.date) || [];
    existing.push(log.station_id);
    datesByDay.set(log.date, existing);
  }

  const nonFunctionalByDay: WeeklyNonFunctionalDay[] = Array.from(datesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stationIds]) => ({
      date,
      nonFunctionalCount: 0,
      totalLogged: stationIds.length,
    }));

  const periodDays = Math.round(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000
  ) + 1;
  const totalExpectedLogs = allStations.length * periodDays;
  const completionPct = totalExpectedLogs > 0
    ? roundTo((totalLogCount / totalExpectedLogs) * 100, 1)
    : 0;

  return {
    serviceCentreName,
    serviceCentreId: scope.scopeId || '',
    weekNumber,
    year,
    reportType,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    generatedAt: new Date().toISOString(),
    production,
    breakdowns,
    chemicals,
    nonFunctionalByDay,
    totalExpectedLogs,
    totalActualLogs: totalLogCount,
    completionPct,
  };
}

function buildEmptyReport(
  serviceCentreId: string,
  serviceCentreName: string,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday',
  dateRange: DateRange
): WeeklyReportData {
  return {
    serviceCentreName,
    serviceCentreId,
    weekNumber,
    year,
    reportType,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    generatedAt: new Date().toISOString(),
    production: {
      totalCWVolume: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0,
      totalLoadShedding: 0, totalOtherDowntime: 0, totalDowntime: 0,
      stationCount: 0, logCount: 0, avgEfficiency: 0,
      avgCWPumpRate: null, avgRWPumpRate: null, totalNewConnections: 0, stations: [],
    },
    breakdowns: [],
    chemicals: [],
    nonFunctionalByDay: [],
    totalExpectedLogs: 0,
    totalActualLogs: 0,
    completionPct: 0,
  };
}
