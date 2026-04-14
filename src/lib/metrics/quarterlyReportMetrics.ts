import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo, buildMonthDateRange } from '../metricsConfig';
import { fetchAllRows } from './scopeFilter';
import { fetchMonthlyReportData } from './monthlyReportMetrics';
import type {
  MonthlyProductionSummary, MonthlySalesSummary, MonthlyNRWSummary,
  MonthlyChemicalSummary, MonthlyBreakdown, ProductionVsTarget,
  ProductionVsTargetStation, KPISummaryAnalysis, KPIWorstStation,
} from './monthlyReportMetrics';
import { fetchMonthlyEnergySummary } from './energyMetrics';
import type { MonthlyEnergySummary, EnergyStationSummary } from './energyMetrics';
import { fetchRWMonthlyDamReport, fetchRWAgreementStats } from './rwAllocationMetrics';
import type { RWMonthlyDamReport, RWAgreementStats } from './rwAllocationMetrics';
import { queryStationsByScope } from '../dataAccessLayer';

export interface RWBailiffSummary {
  bailiff: string;
  dams: Array<{ damId: string; damName: string; damCode: string | null; allocationVolume: number; targetVolume: number; salesVolume: number; agreementCount: number }>;
  totalAllocation: number;
  totalTarget: number;
  totalSales: number;
  totalAgreements: number;
  salesVsTargetPct: number | null;
  salesVsAllocationPct: number | null;
}

export interface QuarterlyEnergyData {
  totalEstimatedKWh: number;
  totalEstimatedCost: number;
  totalActualBill: number;
  totalActualKWh: number;
  overallVariancePct: number | null;
  stations: Array<{ stationId: string; stationName: string; totalEstKWh: number; totalEstCost: number; totalActBill: number; totalActKWh: number }>;
  monthlyBreakdown: Array<{ month: number; monthName: string; totalEstKWh: number; totalEstCost: number; totalActBill: number }>;
}

export interface QuarterlyReportData {
  serviceCentreName: string;
  serviceCentreId: string;
  quarterLabel: string;
  generatedAt: string;
  quarter: number;
  year: number;
  months: number[];
  monthNames: string[];
  production: MonthlyProductionSummary;
  sales: MonthlySalesSummary;
  nrw: MonthlyNRWSummary;
  chemicals: MonthlyChemicalSummary[];
  breakdowns: MonthlyBreakdown[];
  productionVsTarget: ProductionVsTarget;
  energy: QuarterlyEnergyData;
  rwDamReport: RWMonthlyDamReport[];
  rwBailiffSummary: RWBailiffSummary[];
  rwAgreementStats: RWAgreementStats;
  totalExpectedLogs: number;
  totalActualLogs: number;
  completionPct: number;
  kpiAnalysis: KPISummaryAnalysis;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export function getQuarterMonths(quarter: number): number[] {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

function buildQuarterDateRange(year: number, quarter: number): { start: string; end: string } {
  const months = getQuarterMonths(quarter);
  const startRange = buildMonthDateRange(year, months[0]);
  const endRange = buildMonthDateRange(year, months[2]);
  return { start: startRange.start, end: endRange.end };
}

export async function fetchQuarterlyReportData(
  scope: ScopeFilter, year: number, quarter: number, serviceCentreName: string
): Promise<QuarterlyReportData> {
  const months = getQuarterMonths(quarter);
  const monthNames = months.map(m => MONTH_NAMES[m]);
  const allStations = await queryStationsByScope({ scope, fields: 'id, station_name, station_type, service_centre_id' });
  const stationIds = allStations.map((s: any) => s.id);

  if (stationIds.length === 0) {
    return buildEmptyQuarterlyReport(scope.scopeId || '', serviceCentreName, year, quarter);
  }

  const [month1Data, month2Data, month3Data] = await Promise.all([
    fetchMonthlyReportData(scope, year, months[0], serviceCentreName),
    fetchMonthlyReportData(scope, year, months[1], serviceCentreName),
    fetchMonthlyReportData(scope, year, months[2], serviceCentreName),
  ]);
  const monthlyReports = [month1Data, month2Data, month3Data];

  const production = mergeProduction(monthlyReports.map(r => r.production));
  const sales = mergeSales(monthlyReports.map(r => r.sales));
  const nrw = mergeNRW(monthlyReports.map(r => r.nrw));
  const chemicals = mergeChemicals(monthlyReports.map(r => r.chemicals));
  const breakdowns = mergeBreakdowns(monthlyReports.map(r => r.breakdowns));

  const cwProdTargets = await fetchAllRows(
    supabase.from('cw_production_targets')
      .select('station_id, year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec')
      .in('station_id', stationIds).eq('year', year)
  );
  const productionVsTarget = buildProductionVsTarget(production, cwProdTargets, months);

  const [energy1, energy2, energy3] = await Promise.all([
    fetchMonthlyEnergySummary(scope, year, months[0]),
    fetchMonthlyEnergySummary(scope, year, months[1]),
    fetchMonthlyEnergySummary(scope, year, months[2]),
  ]);
  const energy = mergeQuarterlyEnergy([energy1, energy2, energy3], months);

  const [rwDam1, rwDam2, rwDam3] = await Promise.all([
    fetchRWMonthlyDamReport(scope, year, months[0]),
    fetchRWMonthlyDamReport(scope, year, months[1]),
    fetchRWMonthlyDamReport(scope, year, months[2]),
  ]);
  const rwDamReport = mergeRWDamReports([rwDam1, rwDam2, rwDam3]);
  const rwBailiffSummary = buildBailiffSummary(rwDamReport);
  const rwAgreementStats = await fetchRWAgreementStats(scope, year, months[2]);

  const totalExpectedLogs = monthlyReports.reduce((s, r) => s + r.totalExpectedLogs, 0);
  const totalActualLogs = monthlyReports.reduce((s, r) => s + r.totalActualLogs, 0);
  const completionPct = totalExpectedLogs > 0 ? roundTo((totalActualLogs / totalExpectedLogs) * 100, 1) : 0;

  const nrwStationBreakdown: Array<{ stationName: string; totalLossPct: number; totalLossVol: number }> = [];
  for (const station of production.stations) {
    const stSales = sales.stations.find(s => s.stationId === station.stationId);
    const salesVol = stSales ? stSales.effectiveSalesVolume : 0;
    const isBorehole = station.stationType === 'Borehole';
    const denominator = isBorehole ? station.cwVolume : station.rwVolume;
    const lossVol = denominator - salesVol;
    const lossPct = denominator > 0 ? roundTo((lossVol / denominator) * 100, 1) : 0;
    if (denominator > 0) nrwStationBreakdown.push({ stationName: station.stationName, totalLossPct: lossPct, totalLossVol: lossVol });
  }

  const kpiAnalysis = computeKPISummaryAnalysis(production.stations, sales.stations, nrwStationBreakdown, breakdowns);
  const quarterLabel = `Q${quarter} ${year} (${monthNames.join(', ')})`;

  return {
    serviceCentreName, serviceCentreId: scope.scopeId || '', quarterLabel,
    generatedAt: new Date().toISOString(), quarter, year, months, monthNames,
    production, sales, nrw, chemicals, breakdowns, productionVsTarget, energy,
    rwDamReport, rwBailiffSummary, rwAgreementStats,
    totalExpectedLogs, totalActualLogs, completionPct, kpiAnalysis,
  };
}

function mergeProduction(reports: MonthlyProductionSummary[]): MonthlyProductionSummary {
  const stationMap = new Map<string, { stationId: string; stationName: string; stationType: string; logCount: number; cwVolume: number; rwVolume: number; cwHours: number; rwHours: number; loadSheddingHours: number; otherDowntimeHours: number; newConnections: number }>();

  for (const report of reports) {
    for (const st of report.stations) {
      const ex = stationMap.get(st.stationId);
      if (ex) {
        ex.logCount += st.logCount; ex.cwVolume += st.cwVolume; ex.rwVolume += st.rwVolume;
        ex.cwHours += st.cwHours; ex.rwHours += st.rwHours;
        ex.loadSheddingHours += st.loadSheddingHours; ex.otherDowntimeHours += st.otherDowntimeHours;
        ex.newConnections += st.newConnections;
      } else {
        stationMap.set(st.stationId, {
          stationId: st.stationId, stationName: st.stationName, stationType: st.stationType,
          logCount: st.logCount, cwVolume: st.cwVolume, rwVolume: st.rwVolume,
          cwHours: st.cwHours, rwHours: st.rwHours,
          loadSheddingHours: st.loadSheddingHours, otherDowntimeHours: st.otherDowntimeHours,
          newConnections: st.newConnections,
        });
      }
    }
  }

  const stations = Array.from(stationMap.values()).map(s => ({
    stationId: s.stationId, stationName: s.stationName, stationType: s.stationType,
    logCount: s.logCount, cwVolume: roundTo(s.cwVolume, 0), rwVolume: roundTo(s.rwVolume, 0),
    cwHours: roundTo(s.cwHours, 1), rwHours: roundTo(s.rwHours, 1),
    loadSheddingHours: roundTo(s.loadSheddingHours, 1), otherDowntimeHours: roundTo(s.otherDowntimeHours, 1),
    totalDowntime: roundTo(s.loadSheddingHours + s.otherDowntimeHours, 1),
    efficiency: s.logCount > 0 ? roundTo((s.cwHours / (s.logCount * 24)) * 100, 1) : 0,
    cwPumpRate: s.cwHours > 0 ? roundTo(s.cwVolume / s.cwHours, 1) : null,
    rwPumpRate: s.rwHours > 0 ? roundTo(s.rwVolume / s.rwHours, 1) : null,
    newConnections: s.newConnections,
  }));
  stations.sort((a, b) => b.cwVolume - a.cwVolume);

  const totCWVol = stations.reduce((s, st) => s + st.cwVolume, 0);
  const totRWVol = stations.reduce((s, st) => s + st.rwVolume, 0);
  const totCWHrs = stations.reduce((s, st) => s + st.cwHours, 0);
  const totRWHrs = stations.reduce((s, st) => s + st.rwHours, 0);
  const totLS = stations.reduce((s, st) => s + st.loadSheddingHours, 0);
  const totOther = stations.reduce((s, st) => s + st.otherDowntimeHours, 0);
  const totLogCount = stations.reduce((s, st) => s + st.logCount, 0);
  const totConn = stations.reduce((s, st) => s + st.newConnections, 0);
  const totBreakdownHrs = reports.reduce((s, r) => s + r.totalBreakdownHoursLost, 0);

  return {
    totalCWVolume: roundTo(totCWVol, 0), totalRWVolume: roundTo(totRWVol, 0),
    totalCWHours: roundTo(totCWHrs, 1), totalRWHours: roundTo(totRWHrs, 1),
    totalLoadShedding: roundTo(totLS, 1), totalOtherDowntime: roundTo(totOther, 1),
    totalDowntime: roundTo(totLS + totOther, 1), stationCount: stations.length,
    logCount: totLogCount,
    avgEfficiency: totLogCount > 0 ? roundTo((totCWHrs / (totLogCount * 24)) * 100, 1) : 0,
    avgCWPumpRate: totCWHrs > 0 ? roundTo(totCWVol / totCWHrs, 1) : null,
    totalNewConnections: totConn, totalBreakdownHoursLost: roundTo(totBreakdownHrs, 1), stations,
  };
}

function mergeSales(reports: MonthlySalesSummary[]): MonthlySalesSummary {
  const stationMap = new Map<string, { stationId: string; stationName: string; stationType: string; returnsVolume: number; sageSalesVolume: number; effectiveSalesVolume: number; targetVolume: number; usingSageData: boolean }>();

  for (const report of reports) {
    for (const st of report.stations) {
      const ex = stationMap.get(st.stationId);
      if (ex) {
        ex.returnsVolume += st.returnsVolume; ex.sageSalesVolume += st.sageSalesVolume;
        ex.effectiveSalesVolume += st.effectiveSalesVolume; ex.targetVolume += st.targetVolume;
        if (st.usingSageData) ex.usingSageData = true;
      } else {
        stationMap.set(st.stationId, { stationId: st.stationId, stationName: st.stationName, stationType: st.stationType, returnsVolume: st.returnsVolume, sageSalesVolume: st.sageSalesVolume, effectiveSalesVolume: st.effectiveSalesVolume, targetVolume: st.targetVolume, usingSageData: st.usingSageData });
      }
    }
  }

  const stations = Array.from(stationMap.values()).map(s => ({
    stationId: s.stationId, stationName: s.stationName, stationType: s.stationType,
    returnsVolume: roundTo(s.returnsVolume, 0), sageSalesVolume: roundTo(s.sageSalesVolume, 0),
    effectiveSalesVolume: roundTo(s.effectiveSalesVolume, 0), targetVolume: roundTo(s.targetVolume, 0),
    varianceM3: roundTo(s.effectiveSalesVolume - s.targetVolume, 0),
    achievementPct: s.targetVolume > 0 ? roundTo((s.effectiveSalesVolume / s.targetVolume) * 100, 1) : null,
    usingSageData: s.usingSageData,
  }));
  stations.sort((a, b) => b.effectiveSalesVolume - a.effectiveSalesVolume);

  const totEff = stations.reduce((s, st) => s + st.effectiveSalesVolume, 0);
  const totTgt = stations.reduce((s, st) => s + st.targetVolume, 0);
  return {
    totalEffectiveSalesVolume: roundTo(totEff, 0), totalTargetVolume: roundTo(totTgt, 0),
    overallVarianceM3: roundTo(totEff - totTgt, 0),
    overallAchievementPct: totTgt > 0 ? roundTo((totEff / totTgt) * 100, 1) : null,
    stationsWithSage: stations.filter(s => s.usingSageData).length,
    stationsWithReturnsOnly: stations.filter(s => !s.usingSageData).length, stations,
  };
}

function mergeNRW(reports: MonthlyNRWSummary[]): MonthlyNRWSummary {
  const rw = reports.reduce((s, r) => s + r.totalRWVolume, 0);
  const cw = reports.reduce((s, r) => s + r.totalCWVolume, 0);
  const sales = reports.reduce((s, r) => s + r.totalSalesVolume, 0);
  const stLoss = reports.reduce((s, r) => s + r.stationLossVol, 0);
  const distLoss = reports.reduce((s, r) => s + r.distributionLossVol, 0);
  const totLoss = reports.reduce((s, r) => s + r.totalLossVol, 0);
  return {
    totalRWVolume: roundTo(rw, 0), totalCWVolume: roundTo(cw, 0), totalSalesVolume: roundTo(sales, 0),
    stationLossVol: roundTo(stLoss, 0), stationLossPct: rw > 0 ? roundTo((stLoss / rw) * 100, 1) : 0,
    distributionLossVol: roundTo(distLoss, 0), distributionLossPct: cw > 0 ? roundTo((distLoss / cw) * 100, 1) : 0,
    totalLossVol: roundTo(totLoss, 0),
    totalLossPct: (rw + cw) > 0 ? roundTo((totLoss / (rw + cw)) * 100, 1) : 0,
  };
}

function mergeChemicals(reports: MonthlyChemicalSummary[][]): MonthlyChemicalSummary[] {
  if (reports.length === 0) return [];
  const month1 = reports[0];
  const month3 = reports[reports.length - 1];
  const chemTypes = new Set<string>();
  for (const mc of reports) for (const c of mc) chemTypes.add(c.chemicalType);

  const result: MonthlyChemicalSummary[] = [];
  for (const chemType of chemTypes) {
    const m1 = month1.find(c => c.chemicalType === chemType);
    const m3 = month3.find(c => c.chemicalType === chemType);
    let totalUsed = 0, totalReceived = 0;
    const stAgg = new Map<string, { stationName: string; opening: number; received: number; used: number; closing: number; cwVolume: number }>();

    for (const mc of reports) {
      const chem = mc.find(c => c.chemicalType === chemType);
      if (!chem) continue;
      totalUsed += chem.totalUsed;
      totalReceived += chem.totalReceived;
      for (const st of chem.stations) {
        const ex = stAgg.get(st.stationName);
        if (ex) { ex.used += st.used; ex.received += st.received; ex.cwVolume += st.cwVolume; }
        else stAgg.set(st.stationName, { stationName: st.stationName, opening: st.opening, received: st.received, used: st.used, closing: st.closing, cwVolume: st.cwVolume });
      }
    }

    if (m3) for (const st of m3.stations) { const a = stAgg.get(st.stationName); if (a) a.closing = st.closing; }

    const stationRows = Array.from(stAgg.values()).map(s => {
      const usedPerM3 = s.used > 0 && s.cwVolume > 0 ? roundTo((s.used * 1000) / s.cwVolume, 2) : null;
      const avgUsage = s.used > 0 ? s.used / 90 : 0;
      const daysRemaining = avgUsage > 0 && s.closing > 0 ? roundTo(s.closing / avgUsage, 0) : null;
      return { stationName: s.stationName, opening: roundTo(s.opening, 1), received: roundTo(s.received, 1), used: roundTo(s.used, 1), closing: roundTo(s.closing, 1), daysRemaining, usedPerM3, cwVolume: roundTo(s.cwVolume, 0) };
    });

    const lowStockStations = stationRows
      .filter(s => s.daysRemaining !== null && s.daysRemaining <= 10)
      .map(s => ({ stationName: s.stationName, daysRemaining: Math.round(s.daysRemaining!) }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    const totalOpening = m1 ? m1.totalOpening : 0;
    const totalClosing = m3 ? m3.totalClosingBalance : 0;
    const totalCWVol = stationRows.reduce((s, r) => s + r.cwVolume, 0);

    result.push({
      chemicalType: chemType, label: m1?.label || m3?.label || chemType,
      totalOpening: roundTo(totalOpening, 1), totalReceived: roundTo(totalReceived, 1),
      totalUsed: roundTo(totalUsed, 1), totalClosingBalance: roundTo(totalClosing, 1),
      usedPerM3: totalUsed > 0 && totalCWVol > 0 ? roundTo((totalUsed * 1000) / totalCWVol, 2) : null,
      lowStockCount: lowStockStations.length, lowStockStations, stations: stationRows,
    });
  }
  return result;
}

function mergeBreakdowns(reports: MonthlyBreakdown[][]): MonthlyBreakdown[] {
  const seen = new Set<string>();
  const result: MonthlyBreakdown[] = [];
  for (const mb of reports) {
    for (const b of mb) {
      const key = `${b.stationName}|${b.component}|${b.dateReported}`;
      if (!seen.has(key)) { seen.add(key); result.push(b); }
    }
  }
  return result;
}

function buildProductionVsTarget(production: MonthlyProductionSummary, cwProdTargets: any[], months: number[]): ProductionVsTarget {
  const targetMap = new Map<string, number>();
  for (const t of cwProdTargets) {
    let qt = 0;
    for (const m of months) qt += Number((t as any)[MONTH_KEYS[m - 1]]) || 0;
    targetMap.set(t.station_id, qt);
  }

  const stations: ProductionVsTargetStation[] = [];
  let totActual = 0, totTarget = 0;
  for (const st of production.stations) {
    const target = targetMap.get(st.stationId) || 0;
    const variance = roundTo(st.cwVolume - target, 0);
    stations.push({ stationId: st.stationId, stationName: st.stationName, actualProduction: st.cwVolume, targetProduction: target, variance, achievementPct: target > 0 ? roundTo((st.cwVolume / target) * 100, 1) : null });
    totActual += st.cwVolume; totTarget += target;
  }
  return {
    stations, totalActualProduction: roundTo(totActual, 0), totalTargetProduction: roundTo(totTarget, 0),
    totalVariance: roundTo(totActual - totTarget, 0),
    totalAchievementPct: totTarget > 0 ? roundTo((totActual / totTarget) * 100, 1) : null,
  };
}

function mergeQuarterlyEnergy(energies: MonthlyEnergySummary[], months: number[]): QuarterlyEnergyData {
  const stMap = new Map<string, { stationId: string; stationName: string; totalEstKWh: number; totalEstCost: number; totalActBill: number; totalActKWh: number }>();
  for (const e of energies) {
    for (const st of e.stations) {
      const ex = stMap.get(st.stationId);
      if (ex) { ex.totalEstKWh += st.totalEstKWh; ex.totalEstCost += st.totalEstCost; ex.totalActBill += st.totalActBill; ex.totalActKWh += st.totalActKWh; }
      else stMap.set(st.stationId, { stationId: st.stationId, stationName: st.stationName, totalEstKWh: st.totalEstKWh, totalEstCost: st.totalEstCost, totalActBill: st.totalActBill, totalActKWh: st.totalActKWh });
    }
  }

  const stations = Array.from(stMap.values()).map(s => ({ stationId: s.stationId, stationName: s.stationName, totalEstKWh: roundTo(s.totalEstKWh, 0), totalEstCost: roundTo(s.totalEstCost, 2), totalActBill: roundTo(s.totalActBill, 2), totalActKWh: roundTo(s.totalActKWh, 0) }));
  const monthlyBreakdown = energies.map((e, i) => ({ month: months[i], monthName: MONTH_NAMES[months[i]], totalEstKWh: e.totalEstimatedKWh, totalEstCost: e.totalEstimatedCost, totalActBill: e.totalActualBill }));

  const totEstKWh = energies.reduce((s, e) => s + e.totalEstimatedKWh, 0);
  const totEstCost = energies.reduce((s, e) => s + e.totalEstimatedCost, 0);
  const totActBill = energies.reduce((s, e) => s + e.totalActualBill, 0);
  const totActKWh = energies.reduce((s, e) => s + e.totalActualKWh, 0);

  return {
    totalEstimatedKWh: roundTo(totEstKWh, 0), totalEstimatedCost: roundTo(totEstCost, 2),
    totalActualBill: roundTo(totActBill, 2), totalActualKWh: roundTo(totActKWh, 0),
    overallVariancePct: totEstCost > 0 ? roundTo(((totActBill - totEstCost) / totEstCost) * 100, 1) : null,
    stations, monthlyBreakdown,
  };
}

function mergeRWDamReports(reports: RWMonthlyDamReport[][]): RWMonthlyDamReport[] {
  const damMap = new Map<string, RWMonthlyDamReport>();
  for (const mr of reports) {
    for (const dam of mr) {
      const ex = damMap.get(dam.damId);
      if (ex) {
        ex.allocationVolume += dam.allocationVolume; ex.targetVolume += dam.targetVolume;
        ex.salesVolume += dam.salesVolume; ex.agreementCount = Math.max(ex.agreementCount, dam.agreementCount);
      } else {
        damMap.set(dam.damId, { damId: dam.damId, damName: dam.damName, damCode: dam.damCode, bailiff: dam.bailiff, allocationVolume: dam.allocationVolume, targetVolume: dam.targetVolume, salesVolume: dam.salesVolume, agreementCount: dam.agreementCount });
      }
    }
  }
  return Array.from(damMap.values()).sort((a, b) => a.damName.localeCompare(b.damName));
}

function buildBailiffSummary(dams: RWMonthlyDamReport[]): RWBailiffSummary[] {
  const bailiffMap = new Map<string, RWMonthlyDamReport[]>();
  for (const dam of dams) {
    const b = dam.bailiff || 'Unassigned';
    const list = bailiffMap.get(b) || [];
    list.push(dam);
    bailiffMap.set(b, list);
  }

  const result: RWBailiffSummary[] = [];
  for (const [bailiff, bDams] of bailiffMap) {
    const damEntries = bDams.map(d => ({ damId: d.damId, damName: d.damName, damCode: d.damCode, allocationVolume: d.allocationVolume, targetVolume: d.targetVolume, salesVolume: d.salesVolume, agreementCount: d.agreementCount }));
    const totAlloc = bDams.reduce((s, d) => s + d.allocationVolume, 0);
    const totTgt = bDams.reduce((s, d) => s + d.targetVolume, 0);
    const totSales = bDams.reduce((s, d) => s + d.salesVolume, 0);
    const totAgr = bDams.reduce((s, d) => s + d.agreementCount, 0);
    result.push({
      bailiff, dams: damEntries,
      totalAllocation: roundTo(totAlloc, 2), totalTarget: roundTo(totTgt, 2), totalSales: roundTo(totSales, 2),
      totalAgreements: totAgr,
      salesVsTargetPct: totTgt > 0 ? roundTo((totSales / totTgt) * 100, 1) : null,
      salesVsAllocationPct: totAlloc > 0 ? roundTo((totSales / totAlloc) * 100, 1) : null,
    });
  }
  return result.sort((a, b) => a.bailiff.localeCompare(b.bailiff));
}

function computeKPISummaryAnalysis(
  productionStations: MonthlyProductionSummary['stations'],
  salesStations: MonthlySalesSummary['stations'],
  nrwStations: Array<{ stationName: string; totalLossPct: number; totalLossVol: number }>,
  breakdowns: MonthlyBreakdown[]
): KPISummaryAnalysis {
  let worstNRW: KPIWorstStation | null = null;
  if (nrwStations.length > 0) {
    const w = nrwStations.reduce((a, b) => b.totalLossPct > a.totalLossPct ? b : a);
    if (w.totalLossPct > 0) worstNRW = { stationName: w.stationName, value: w.totalLossPct, unit: '%', context: `${w.totalLossVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 lost` };
  }

  let worstSalesAchievement: KPIWorstStation | null = null;
  const eligSales = salesStations.filter(s => s.targetVolume > 0 && s.achievementPct !== null);
  if (eligSales.length > 0) {
    const w = eligSales.reduce((a, b) => (b.achievementPct! < a.achievementPct! ? b : a));
    worstSalesAchievement = { stationName: w.stationName, value: w.achievementPct!, unit: '%', context: `${w.varianceM3 < 0 ? '' : '+'}${w.varianceM3.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 vs target` };
  }

  let worstEfficiency: KPIWorstStation | null = null;
  const eligEff = productionStations.filter(s => s.cwHours > 0);
  if (eligEff.length > 0) {
    const w = eligEff.reduce((a, b) => b.efficiency < a.efficiency ? b : a);
    worstEfficiency = { stationName: w.stationName, value: roundTo(w.efficiency, 1), unit: '%', context: `${w.cwVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })} m\u00b3 produced` };
  }

  let worstDowntime: KPIWorstStation | null = null;
  const eligDt = productionStations.filter(s => s.totalDowntime > 0);
  if (eligDt.length > 0) {
    const w = eligDt.reduce((a, b) => b.totalDowntime > a.totalDowntime ? b : a);
    worstDowntime = { stationName: w.stationName, value: roundTo(w.totalDowntime, 1), unit: 'hrs', context: `${roundTo(w.loadSheddingHours, 1)} hrs load shedding, ${roundTo(w.otherDowntimeHours, 1)} hrs other` };
  }

  let worstFinancialLoss: KPIWorstStation | null = null;
  if (nrwStations.length > 0) {
    const w = nrwStations.reduce((a, b) => b.totalLossVol > a.totalLossVol ? b : a);
    if (w.totalLossVol > 0) worstFinancialLoss = { stationName: w.stationName, value: w.totalLossVol, unit: 'm\u00b3', context: `Highest unaccounted water volume` };
  }

  let mostBreakdowns: KPIWorstStation | null = null;
  if (breakdowns.length > 0) {
    const countByStation = new Map<string, number>();
    for (const b of breakdowns) countByStation.set(b.stationName, (countByStation.get(b.stationName) || 0) + 1);
    let topStation = '', topCount = 0;
    for (const [name, count] of countByStation) if (count > topCount) { topStation = name; topCount = count; }
    const openCount = breakdowns.filter(b => b.stationName === topStation && !b.isResolved).length;
    mostBreakdowns = { stationName: topStation, value: topCount, unit: 'breakdown(s)', context: `${openCount} unresolved` };
  }

  return { worstNRW, worstSalesAchievement, worstEfficiency, worstDowntime, worstFinancialLoss, mostBreakdowns };
}

function buildEmptyQuarterlyReport(serviceCentreId: string, serviceCentreName: string, year: number, quarter: number): QuarterlyReportData {
  const months = getQuarterMonths(quarter);
  const monthNames = months.map(m => MONTH_NAMES[m]);
  return {
    serviceCentreName, serviceCentreId,
    quarterLabel: `Q${quarter} ${year} (${monthNames.join(', ')})`,
    generatedAt: new Date().toISOString(), quarter, year, months, monthNames,
    production: { totalCWVolume: 0, totalRWVolume: 0, totalCWHours: 0, totalRWHours: 0, totalLoadShedding: 0, totalOtherDowntime: 0, totalDowntime: 0, stationCount: 0, logCount: 0, avgEfficiency: 0, avgCWPumpRate: null, totalNewConnections: 0, totalBreakdownHoursLost: 0, stations: [] },
    sales: { totalEffectiveSalesVolume: 0, totalTargetVolume: 0, overallVarianceM3: 0, overallAchievementPct: null, stationsWithSage: 0, stationsWithReturnsOnly: 0, stations: [] },
    nrw: { totalRWVolume: 0, totalCWVolume: 0, totalSalesVolume: 0, stationLossVol: 0, stationLossPct: 0, distributionLossVol: 0, distributionLossPct: 0, totalLossVol: 0, totalLossPct: 0 },
    chemicals: [], breakdowns: [],
    productionVsTarget: { stations: [], totalActualProduction: 0, totalTargetProduction: 0, totalVariance: 0, totalAchievementPct: null },
    energy: { totalEstimatedKWh: 0, totalEstimatedCost: 0, totalActualBill: 0, totalActualKWh: 0, overallVariancePct: null, stations: [], monthlyBreakdown: [] },
    rwDamReport: [], rwBailiffSummary: [],
    rwAgreementStats: { totalActiveInYear: 0, expiredInMonth: 0, expiringNextMonth: 0, currentlyActive: 0 },
    totalExpectedLogs: 0, totalActualLogs: 0, completionPct: 0,
    kpiAnalysis: { worstNRW: null, worstSalesAchievement: null, worstEfficiency: null, worstDowntime: null, worstFinancialLoss: null, mostBreakdowns: null },
  };
}
