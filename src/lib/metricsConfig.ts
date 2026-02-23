import type { ScopeType } from './scopeUtils';

export interface ScopeFilter {
  scopeType: ScopeType;
  scopeId: string | null;
  allowedServiceCentreIds: string[];
}

export interface DateRange {
  start: string;
  end: string;
}

export interface MonthPeriod {
  year: number;
  month: number;
}

export const THRESHOLDS = {
  NON_FUNCTIONAL_VOLUME_PCT: 0.25,
  CHEMICAL_LOW_STOCK_DAYS: 10,
  CHEMICAL_CRITICAL_STOCK_DAYS: 5,
  HIGH_DOWNTIME_WEEKLY_HOURS: 24,
  CRITICAL_DOWNTIME_WEEKLY_HOURS: 48,
  DISTRIBUTION_DOWNTIME_FLAG_PCT: 50,
  VARIANCE_TOLERANCE_ALUM_PCT: 5,
  VARIANCE_TOLERANCE_OTHER_PCT: 10,
  PENDING_SHEETS_VISIBILITY_DAY: 5,
  EQUALIZATION_MAX_ITERATIONS: 10,
  PUMP_RATE_LOOKBACK_DAYS: 7,
  HISTORICAL_USAGE_LOOKBACK_DAYS: 30,
  CAPACITY_VARIANCE_AT_CAPACITY_PCT: -10,
  CAPACITY_VARIANCE_BELOW_THRESHOLD_PCT: -25,
  NRW_MODERATE_LOSS_PCT: 10,
  NRW_HIGH_LOSS_PCT: 20,
  FUEL_LOW_BALANCE_LITRES: 100,
} as const;

export const CATEGORY_DAILY_DEMAND_M3: Record<string, number> = {
  clients_domestic: 0.5,
  clients_school: 5.0,
  clients_business: 2.0,
  clients_industry: 15.0,
  clients_church: 0.5,
  clients_parastatal: 10.0,
  clients_government: 5.0,
  clients_other: 5.0,
};

export const CLIENT_CATEGORIES = Object.keys(CATEGORY_DAILY_DEMAND_M3);

export const CHEMICAL_PROD_FIELDS: Record<string, string> = {
  aluminium_sulphate: 'alum_kg',
  hth: 'hth_kg',
  activated_carbon: 'activated_carbon_kg',
};

export const CHEMICAL_TYPES = ['aluminium_sulphate', 'hth', 'activated_carbon'] as const;
export type ChemicalTypeKey = typeof CHEMICAL_TYPES[number];

export function getVarianceTolerancePct(chemicalType: string): number {
  return chemicalType === 'aluminium_sulphate'
    ? THRESHOLDS.VARIANCE_TOLERANCE_ALUM_PCT
    : THRESHOLDS.VARIANCE_TOLERANCE_OTHER_PCT;
}

export function getChemicalProdFieldFromConfig(chemicalType: string): string {
  return CHEMICAL_PROD_FIELDS[chemicalType] || '';
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function buildMonthDateRange(year: number, month: number): DateRange {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return { start: startDate, end: endDate };
}

export function getPreviousMonthPeriod(year: number, month: number): MonthPeriod {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}
