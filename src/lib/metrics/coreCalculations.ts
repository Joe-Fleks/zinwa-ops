import {
  CATEGORY_DAILY_DEMAND_M3,
  CLIENT_CATEGORIES,
  THRESHOLDS,
  roundTo,
} from '../metricsConfig';

export interface StationClientFields {
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
}

export function computeTotalClients(station: Partial<StationClientFields>): number {
  return CLIENT_CATEGORIES.reduce(
    (sum, cat) => sum + (Number((station as any)[cat]) || 0),
    0
  );
}

export function computeDowntime(
  loadSheddingHours: number | null | undefined,
  otherDowntimeHours: number | null | undefined
): number {
  return (Number(loadSheddingHours) || 0) + (Number(otherDowntimeHours) || 0);
}

export function computeChemicalBalance(
  opening: number,
  received: number,
  used: number
): number {
  return opening + received - used;
}

export function computeReceiptTotal(
  receipts: Array<{ quantity: number | string; receipt_type: string }>
): number {
  let total = 0;
  for (const r of receipts) {
    const qty = Number(r.quantity) || 0;
    if (r.receipt_type === 'transfer_out') {
      total -= qty;
    } else {
      total += qty;
    }
  }
  return total;
}

export function computeAvgUsagePerDay(totalUsed: number, productionDays: number): number {
  return productionDays > 0 ? totalUsed / productionDays : 0;
}

export function computeDaysRemaining(balance: number, avgUsagePerDay: number): number | null {
  if (avgUsagePerDay <= 0 || balance <= 0) return null;
  return roundTo(balance / avgUsagePerDay, 1);
}

export function isChemicalLowStock(daysRemaining: number | null): boolean {
  return daysRemaining !== null && daysRemaining <= THRESHOLDS.CHEMICAL_LOW_STOCK_DAYS;
}

export function isChemicalCriticalStock(daysRemaining: number | null): boolean {
  return daysRemaining !== null && daysRemaining <= THRESHOLDS.CHEMICAL_CRITICAL_STOCK_DAYS;
}

export interface NonFunctionalInput {
  cwVolume: number;
  cwHours: number;
  targetDailyHours: number;
  pumpRate: number;
  hasStoppingBreakdown: boolean;
}

export function isStationNonFunctional(input: NonFunctionalInput): boolean {
  const { cwVolume, cwHours, targetDailyHours, pumpRate, hasStoppingBreakdown } = input;

  if (cwVolume === 0) return true;
  if (hasStoppingBreakdown) return true;

  const currentFlow = cwHours > 0 ? cwVolume / cwHours : pumpRate;
  const expectedVolume = targetDailyHours * currentFlow;
  const threshold = expectedVolume * THRESHOLDS.NON_FUNCTIONAL_VOLUME_PCT;

  return expectedVolume > 0 && cwVolume < threshold;
}

export interface NRWLossResult {
  stationLossVol: number;
  stationLossPct: number;
  distributionLossVol: number;
  distributionLossPct: number;
  totalLossVol: number;
  totalLossPct: number;
}

export function computeNRWLosses(
  rwVolume: number,
  cwVolume: number,
  salesVolume: number,
  isBorehole: boolean
): NRWLossResult {
  const stationLossVol = isBorehole ? 0 : Math.max(0, rwVolume - cwVolume);
  const stationLossPct = isBorehole ? 0 : (rwVolume > 0 ? (stationLossVol / rwVolume) * 100 : 0);

  const distributionLossVol = Math.max(0, cwVolume - salesVolume);
  const distributionLossPct = cwVolume > 0 ? (distributionLossVol / cwVolume) * 100 : 0;

  const totalLossVol = isBorehole ? distributionLossVol : Math.max(0, rwVolume - salesVolume);
  const totalLossPct = isBorehole
    ? (cwVolume > 0 ? (totalLossVol / cwVolume) * 100 : 0)
    : (rwVolume > 0 ? (totalLossVol / rwVolume) * 100 : 0);

  return { stationLossVol, stationLossPct, distributionLossVol, distributionLossPct, totalLossVol, totalLossPct };
}

export function computeProductionEfficiency(totalHours: number, logCount: number): number {
  const potentialHours = logCount * 24;
  return potentialHours > 0 ? roundTo((totalHours / potentialHours) * 100, 1) : 0;
}

export function computeCapacityVariancePct(
  actualFlow: number | null,
  designCapacity: number
): number | null {
  if (actualFlow === null || designCapacity <= 0) return null;
  return roundTo(((actualFlow - designCapacity) / designCapacity) * 100, 1);
}

export function computePumpRate(volume: number, hours: number): number | null {
  if (hours <= 0) return null;
  return roundTo(volume / hours, 2);
}

export interface BreakdownRecord {
  station_id: string;
  date_reported: string;
  date_resolved: string | null;
  is_resolved: boolean;
  breakdown_impact: string;
}

export function computeBreakdownHoursLostForPeriod(
  breakdowns: BreakdownRecord[],
  logs: Array<{ station_id: string; date: string; cw_hours_run?: number }>,
  stations: Array<{ id: string; target_daily_hours: number }>,
  periodStart: string,
  periodEnd: string
): Map<string, number> {
  const stoppedBreakdowns = breakdowns.filter(
    b => b.breakdown_impact === 'Stopped pumping'
  );
  if (stoppedBreakdowns.length === 0) return new Map();

  const targetMap = new Map(stations.map(s => [s.id, Number(s.target_daily_hours) || 0]));

  const logHoursMap = new Map<string, number>();
  for (const log of logs) {
    const key = `${log.station_id}|${log.date}`;
    logHoursMap.set(key, (logHoursMap.get(key) || 0) + (Number(log.cw_hours_run) || 0));
  }

  const result = new Map<string, number>();

  for (const bd of stoppedBreakdowns) {
    const sid = bd.station_id;
    if (!sid) continue;
    const targetHrs = targetMap.get(sid);
    if (!targetHrs || targetHrs <= 0) continue;

    const bdStart = bd.date_reported;
    const bdEnd = bd.is_resolved && bd.date_resolved ? bd.date_resolved : periodEnd;

    const effectiveStart = bdStart > periodStart ? bdStart : periodStart;
    const effectiveEnd = bdEnd < periodEnd ? bdEnd : periodEnd;

    if (effectiveStart > effectiveEnd) continue;

    const cursor = new Date(effectiveStart + 'T12:00:00');
    const endDate = new Date(effectiveEnd + 'T12:00:00');

    while (cursor <= endDate) {
      const dateStr = cursor.toISOString().split('T')[0];
      const logKey = `${sid}|${dateStr}`;
      const hoursRun = logHoursMap.get(logKey) || 0;
      const lostThisDay = Math.max(0, targetHrs - hoursRun);

      result.set(sid, (result.get(sid) || 0) + lostThisDay);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return result;
}

export function computeCategoryDailyDemand(
  station: Partial<StationClientFields>
): number {
  return CLIENT_CATEGORIES.reduce((sum, cat) => {
    const count = Number((station as any)[cat]) || 0;
    const demand = CATEGORY_DAILY_DEMAND_M3[cat] || 0;
    return sum + count * demand;
  }, 0);
}
