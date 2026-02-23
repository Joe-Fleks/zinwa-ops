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

export function computeCategoryDailyDemand(
  station: Partial<StationClientFields>
): number {
  return CLIENT_CATEGORIES.reduce((sum, cat) => {
    const count = Number((station as any)[cat]) || 0;
    const demand = CATEGORY_DAILY_DEMAND_M3[cat] || 0;
    return sum + count * demand;
  }, 0);
}
