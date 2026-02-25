import { supabase } from '../supabase';
import type { ScopeFilter, DateRange } from '../metricsConfig';
import { roundTo, CHEMICAL_PROD_FIELDS, CHEMICAL_TYPES } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';
import {
  computeProductionEfficiency,
  computePumpRate,
  computeChemicalBalance,
  computeReceiptTotal,
  computeAvgUsagePerDay,
  computeDaysRemaining,
  isChemicalLowStock,
} from './coreCalculations';

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export interface WeeklyStationProduction {
  stationId: string;
  stationName: string;
  stationType: string;
  logCount: number;
  cwVolume: number;
  cwVolumeYTD: number;
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
  breakdownHoursLost: number;
}

export interface WeeklyProductionSummary {
  totalCWVolume: number;
  totalCWVolumeYTD: number;
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
  cwWeeklyTarget: number;
  cwPerformancePct: number | null;
  totalBreakdownHoursLost: number;
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
  hoursLost: number;
}

export interface WeeklyChemicalSummary {
  chemicalType: string;
  label: string;
  totalUsed: number;
  totalBalance: number;
  usedPerM3: number | null;
  lowStockCount: number;
  lowStockStations: Array<{ stationName: string; daysRemaining: number }>;
}

export interface WeeklyNonFunctionalDay {
  date: string;
  nonFunctionalCount: number;
  totalLogged: number;
}

export interface CapacityUtilizationStation {
  stationId: string;
  stationName: string;
  stationType: string;
  installedCapacity: number;
  weeklyRWCapacity: number | null;
  weeklyCWCapacity: number | null;
  ytdRWCapacity: number | null;
  ytdCWCapacity: number | null;
}

export interface CapacityUtilizationSummary {
  rwInstalledTotal: number;
  rwWeeklyActualTotal: number | null;
  rwYtdAvgTotal: number | null;
  cwInstalledTotal: number;
  cwWeeklyActualTotal: number | null;
  cwYtdAvgTotal: number | null;
  stations: CapacityUtilizationStation[];
}

export interface PowerSupplyStation {
  stationId: string;
  stationName: string;
  requiredHours: number;
  actualHoursRun: number;
  powerAvailabilityPct: number;
}

export interface PowerSupplySummary {
  totalRequiredHours: number;
  totalActualHours: number;
  overallAvailabilityPct: number;
  stations: PowerSupplyStation[];
}

export interface ConnectionStation {
  stationId: string;
  stationName: string;
  currentConnections: number;
  newConnectionsThisWeek: number;
  newTotal: number;
  ytdNewConnections: number;
}

export interface ConnectionsSummary {
  totalCurrentConnections: number;
  totalNewThisWeek: number;
  totalNewTotal: number;
  totalYTDNew: number;
  stations: ConnectionStation[];
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
  capacityUtilization: CapacityUtilizationSummary;
  powerSupply: PowerSupplySummary;
  connections: ConnectionsSummary;
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
    .select('id, station_name, station_type, service_centre_id, design_capacity_m3_hr, target_daily_hours, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);

  const { data: stations, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const allStations = stations || [];
  const stationIds = allStations.map(s => s.id);
  const stationMap = new Map(allStations.map(s => [s.id, s]));

  if (stationIds.length === 0) {
    return buildEmptyReport(scope.scopeId || '', serviceCentreName, weekNumber, year, reportType, dateRange);
  }

  const ytdStart = `${year}-01-01`;

  const [logsRes, breakdownsRes, balancesRes, receiptsRes, targetsRes, ytdLogsRes] = await Promise.all([
    supabase
      .from('production_logs')
      .select('station_id, date, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, load_shedding_hours, other_downtime_hours, alum_kg, hth_kg, activated_carbon_kg, new_connections')
      .in('station_id', stationIds)
      .gte('date', dateRange.start)
      .lte('date', dateRange.end)
      .order('date', { ascending: true }),
    supabase
      .from('station_breakdowns')
      .select('station_id, nature_of_breakdown, description, date_reported, is_resolved, date_resolved, breakdown_impact, hours_lost')
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
    supabase
      .from('cw_production_targets')
      .select('station_id, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec')
      .in('station_id', stationIds)
      .eq('year', year),
    supabase
      .from('production_logs')
      .select('station_id, cw_volume_m3, rw_volume_m3, cw_hours_run, rw_hours_run, new_connections')
      .in('station_id', stationIds)
      .gte('date', ytdStart)
      .lte('date', dateRange.end),
  ]);

  const logs = logsRes.data || [];
  const ytdPriorLogs = ytdLogsRes.data || [];

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

  const ytdFullAgg = new Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>();
  for (const log of ytdPriorLogs) {
    const sid = log.station_id;
    const existing = ytdFullAgg.get(sid) || { cwVol: 0, rwVol: 0, cwHrs: 0, rwHrs: 0, connections: 0 };
    existing.cwVol += Number(log.cw_volume_m3) || 0;
    existing.rwVol += Number(log.rw_volume_m3) || 0;
    existing.cwHrs += Number(log.cw_hours_run) || 0;
    existing.rwHrs += Number(log.rw_hours_run) || 0;
    existing.connections += Number(log.new_connections) || 0;
    ytdFullAgg.set(sid, existing);
  }

  const breakdownHoursLostByStation = new Map<string, number>();
  for (const b of (breakdownsRes.data || [])) {
    if (b.breakdown_impact === 'Stopped pumping') {
      const sid = b.station_id;
      breakdownHoursLostByStation.set(sid, (breakdownHoursLostByStation.get(sid) || 0) + (Number(b.hours_lost) || 0));
    }
  }

  const stationMetrics: WeeklyStationProduction[] = [];
  let totalCWVol = 0, totalRWVol = 0, totalCWHrs = 0, totalRWHrs = 0;
  let totalLS = 0, totalOther = 0, totalLogCount = 0, totalConnections = 0;
  let totalBreakdownHoursLost = 0;

  for (const station of allStations) {
    const agg = stationAgg.get(station.id);
    if (!agg) continue;
    const downtime = agg.ls + agg.other;
    const ytdFull = ytdFullAgg.get(station.id);
    const cwVolumeYTD = roundTo(ytdFull?.cwVol || 0, 0);
    const stBreakdownHrs = roundTo(breakdownHoursLostByStation.get(station.id) || 0, 1);
    stationMetrics.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      logCount: agg.count,
      cwVolume: roundTo(agg.cwVol, 0),
      cwVolumeYTD,
      rwVolume: roundTo(agg.rwVol, 0),
      cwHours: roundTo(agg.cwHrs, 2),
      rwHours: roundTo(agg.rwHrs, 2),
      loadSheddingHours: roundTo(agg.ls, 1),
      otherDowntimeHours: roundTo(agg.other, 1),
      totalDowntime: roundTo(downtime, 1),
      efficiency: computeProductionEfficiency(agg.cwHrs, agg.count),
      cwPumpRate: computePumpRate(agg.cwVol, agg.cwHrs),
      rwPumpRate: computePumpRate(agg.rwVol, agg.rwHrs),
      newConnections: agg.connections,
      breakdownHoursLost: stBreakdownHrs,
    });
    totalCWVol += agg.cwVol;
    totalRWVol += agg.rwVol;
    totalCWHrs += agg.cwHrs;
    totalRWHrs += agg.rwHrs;
    totalLS += agg.ls;
    totalOther += agg.other;
    totalLogCount += agg.count;
    totalConnections += agg.connections;
    totalBreakdownHoursLost += stBreakdownHrs;
  }

  stationMetrics.sort((a, b) => b.cwVolume - a.cwVolume);

  const periodDays = Math.round(
    (new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000
  ) + 1;

  const cwWeeklyTarget = computeCWWeeklyTarget(targetsRes.data || [], dateRange, periodDays);
  const cwPerformancePct = cwWeeklyTarget > 0 ? roundTo((totalCWVol / cwWeeklyTarget) * 100, 1) : null;

  let totalCWVolYTD = 0;
  for (const [, ytdEntry] of ytdFullAgg) {
    totalCWVolYTD += ytdEntry.cwVol;
  }

  const production: WeeklyProductionSummary = {
    totalCWVolume: roundTo(totalCWVol, 2),
    totalCWVolumeYTD: roundTo(totalCWVolYTD, 0),
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
    cwWeeklyTarget: roundTo(cwWeeklyTarget, 0),
    cwPerformancePct,
    totalBreakdownHoursLost: roundTo(totalBreakdownHoursLost, 1),
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
    hoursLost: Number(b.hours_lost) || 0,
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

    const usedPerM3 = totalUsed > 0 && totalCWVol > 0
      ? roundTo((totalUsed * 1000) / totalCWVol, 2)
      : null;

    chemicals.push({
      chemicalType: chemType,
      label: chemLabels[chemType] || chemType,
      totalUsed: roundTo(totalUsed, 1),
      totalBalance: roundTo(totalBalance, 1),
      usedPerM3,
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
    .map(([date, sIds]) => ({
      date,
      nonFunctionalCount: 0,
      totalLogged: sIds.length,
    }));

  const capacityUtilization = buildCapacityUtilization(allStations, stationAgg, ytdFullAgg);
  const powerSupply = buildPowerSupply(allStations, stationAgg, periodDays);
  const connections = buildConnections(allStations, stationAgg, ytdFullAgg);

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
    capacityUtilization,
    powerSupply,
    connections,
    totalExpectedLogs,
    totalActualLogs: totalLogCount,
    completionPct,
  };
}

function computeCWWeeklyTarget(
  targetsData: any[],
  dateRange: DateRange,
  periodDays: number
): number {
  if (targetsData.length === 0) return 0;

  const startDate = new Date(dateRange.start + 'T12:00:00');
  const endDate = new Date(dateRange.end + 'T12:00:00');

  const daysByMonth = new Map<number, number>();
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const mIdx = d.getMonth();
    daysByMonth.set(mIdx, (daysByMonth.get(mIdx) || 0) + 1);
  }

  let weeklyTarget = 0;
  for (const [mIdx, daysInWeek] of daysByMonth.entries()) {
    const monthKey = MONTH_KEYS[mIdx];
    const daysInMonth = new Date(startDate.getFullYear(), mIdx + 1, 0).getDate();
    let monthTarget = 0;
    for (const t of targetsData) {
      monthTarget += Number(t[monthKey]) || 0;
    }
    weeklyTarget += (monthTarget / daysInMonth) * daysInWeek;
  }

  return weeklyTarget;
}

type StationRow = any;
type AggMap = Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; [k: string]: any }>;

function buildCapacityUtilization(
  allStations: StationRow[],
  weekAgg: AggMap,
  ytdFullAgg: Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>
): CapacityUtilizationSummary {
  const stationsResult: CapacityUtilizationStation[] = [];
  let rwInstalledTotal = 0, cwInstalledTotal = 0;
  let rwWeeklyNumer = 0, rwWeeklyDenom = 0;
  let cwWeeklyNumer = 0, cwWeeklyDenom = 0;
  let rwYtdNumer = 0, rwYtdDenom = 0;
  let cwYtdNumer = 0, cwYtdDenom = 0;

  for (const station of allStations) {
    const installed = Number(station.design_capacity_m3_hr) || 0;
    const agg = weekAgg.get(station.id);
    const ytd = ytdFullAgg.get(station.id);

    const weekCW = agg && agg.cwHrs > 0 ? roundTo(agg.cwVol / agg.cwHrs, 2) : null;
    const weekRW = (station.station_type === 'Full Treatment' && agg && agg.rwHrs > 0)
      ? roundTo(agg.rwVol / agg.rwHrs, 2) : null;

    const ytdCWVol = ytd?.cwVol || 0;
    const ytdCWHrs = ytd?.cwHrs || 0;
    const ytdRWVol = ytd?.rwVol || 0;
    const ytdRWHrs = ytd?.rwHrs || 0;

    const ytdCW = ytdCWHrs > 0 ? roundTo(ytdCWVol / ytdCWHrs, 2) : null;
    const ytdRW = (station.station_type === 'Full Treatment' && ytdRWHrs > 0)
      ? roundTo(ytdRWVol / ytdRWHrs, 2) : null;

    if (station.station_type === 'Full Treatment') {
      rwInstalledTotal += installed;
      if (agg && agg.rwHrs > 0) { rwWeeklyNumer += agg.rwVol; rwWeeklyDenom += agg.rwHrs; }
      if (ytdRWHrs > 0) { rwYtdNumer += ytdRWVol; rwYtdDenom += ytdRWHrs; }
    }
    cwInstalledTotal += installed;
    if (agg && agg.cwHrs > 0) { cwWeeklyNumer += agg.cwVol; cwWeeklyDenom += agg.cwHrs; }
    if (ytdCWHrs > 0) { cwYtdNumer += ytdCWVol; cwYtdDenom += ytdCWHrs; }

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      installedCapacity: installed,
      weeklyRWCapacity: weekRW,
      weeklyCWCapacity: weekCW,
      ytdRWCapacity: ytdRW,
      ytdCWCapacity: ytdCW,
    });
  }

  stationsResult.sort((a, b) => b.installedCapacity - a.installedCapacity);

  return {
    rwInstalledTotal: roundTo(rwInstalledTotal, 2),
    rwWeeklyActualTotal: rwWeeklyDenom > 0 ? roundTo(rwWeeklyNumer / rwWeeklyDenom, 2) : null,
    rwYtdAvgTotal: rwYtdDenom > 0 ? roundTo(rwYtdNumer / rwYtdDenom, 2) : null,
    cwInstalledTotal: roundTo(cwInstalledTotal, 2),
    cwWeeklyActualTotal: cwWeeklyDenom > 0 ? roundTo(cwWeeklyNumer / cwWeeklyDenom, 2) : null,
    cwYtdAvgTotal: cwYtdDenom > 0 ? roundTo(cwYtdNumer / cwYtdDenom, 2) : null,
    stations: stationsResult,
  };
}

function buildPowerSupply(
  allStations: StationRow[],
  weekAgg: AggMap,
  periodDays: number
): PowerSupplySummary {
  const stationsResult: PowerSupplyStation[] = [];
  let totalRequired = 0, totalActual = 0;

  for (const station of allStations) {
    const targetDaily = Number(station.target_daily_hours) || 0;
    const required = targetDaily * periodDays;
    const agg = weekAgg.get(station.id);
    const actual = agg ? agg.cwHrs : 0;
    const availability = required > 0 ? roundTo((actual / required) * 100, 1) : 0;

    totalRequired += required;
    totalActual += actual;

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      requiredHours: roundTo(required, 1),
      actualHoursRun: roundTo(actual, 1),
      powerAvailabilityPct: availability,
    });
  }

  stationsResult.sort((a, b) => a.powerAvailabilityPct - b.powerAvailabilityPct);

  return {
    totalRequiredHours: roundTo(totalRequired, 1),
    totalActualHours: roundTo(totalActual, 1),
    overallAvailabilityPct: totalRequired > 0 ? roundTo((totalActual / totalRequired) * 100, 1) : 0,
    stations: stationsResult,
  };
}

function buildConnections(
  allStations: StationRow[],
  weekAgg: AggMap,
  ytdFullAgg: Map<string, { cwVol: number; rwVol: number; cwHrs: number; rwHrs: number; connections: number }>
): ConnectionsSummary {
  const stationsResult: ConnectionStation[] = [];
  let totalCurrent = 0, totalNewWeek = 0, totalYTD = 0;

  for (const station of allStations) {
    const currentConns =
      (Number(station.clients_domestic) || 0) +
      (Number(station.clients_school) || 0) +
      (Number(station.clients_business) || 0) +
      (Number(station.clients_industry) || 0) +
      (Number(station.clients_church) || 0) +
      (Number(station.clients_parastatal) || 0) +
      (Number(station.clients_government) || 0) +
      (Number(station.clients_other) || 0);

    const agg = weekAgg.get(station.id);
    const newWeek = agg?.connections || 0;
    const ytdEntry = ytdFullAgg.get(station.id);
    const ytdNew = ytdEntry?.connections || 0;

    totalCurrent += currentConns;
    totalNewWeek += newWeek;
    totalYTD += ytdNew;

    stationsResult.push({
      stationId: station.id,
      stationName: station.station_name,
      currentConnections: currentConns,
      newConnectionsThisWeek: newWeek,
      newTotal: currentConns + newWeek,
      ytdNewConnections: ytdNew,
    });
  }

  stationsResult.sort((a, b) => b.newConnectionsThisWeek - a.newConnectionsThisWeek);

  return {
    totalCurrentConnections: totalCurrent,
    totalNewThisWeek: totalNewWeek,
    totalNewTotal: totalCurrent + totalNewWeek,
    totalYTDNew: totalYTD,
    stations: stationsResult,
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
      totalCWVolume: 0, totalCWVolumeYTD: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0,
      totalLoadShedding: 0, totalOtherDowntime: 0, totalDowntime: 0,
      stationCount: 0, logCount: 0, avgEfficiency: 0,
      avgCWPumpRate: null, avgRWPumpRate: null, totalNewConnections: 0,
      cwWeeklyTarget: 0, cwPerformancePct: null, totalBreakdownHoursLost: 0, stations: [],
    },
    breakdowns: [],
    chemicals: [],
    nonFunctionalByDay: [],
    capacityUtilization: {
      rwInstalledTotal: 0, rwWeeklyActualTotal: null, rwYtdAvgTotal: null,
      cwInstalledTotal: 0, cwWeeklyActualTotal: null, cwYtdAvgTotal: null,
      stations: [],
    },
    powerSupply: {
      totalRequiredHours: 0, totalActualHours: 0, overallAvailabilityPct: 0, stations: [],
    },
    connections: {
      totalCurrentConnections: 0, totalNewThisWeek: 0, totalNewTotal: 0, totalYTDNew: 0, stations: [],
    },
    totalExpectedLogs: 0,
    totalActualLogs: 0,
    completionPct: 0,
  };
}
