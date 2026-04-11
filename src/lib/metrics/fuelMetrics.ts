import type { ScopeFilter } from '../metricsConfig';
import { queryFuelControlCards } from '../dataAccessLayer';

export type FuelType = 'diesel' | 'petrol';

export interface FuelPeriodRow {
  fuelType: FuelType;
  opening: number;
  received: number;
  issued: number;
  closing: number;
  label: string;
}

export interface FuelAnalysisTable {
  diesel: FuelPeriodRow[];
  petrol: FuelPeriodRow[];
}

function quarterLabel(q: number, year: number): string {
  return `Q${q} ${year}`;
}

function monthLabel(month: number, year: number): string {
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[month]} ${year}`;
}

function buildRow(
  fuelType: FuelType,
  rows: any[],
  label: string,
): FuelPeriodRow {
  if (rows.length === 0) {
    return { fuelType, opening: 0, received: 0, issued: 0, closing: 0, label };
  }

  const sorted = [...rows].sort((a, b) => {
    const dateA = a.entry_date || '';
    const dateB = b.entry_date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const openingRow = sorted.find(r => r.is_opening_balance);
  const opening = openingRow ? Number(openingRow.balance) : 0;

  let received = 0;
  let issued = 0;
  for (const r of sorted) {
    if (r.is_opening_balance) continue;
    received += Number(r.receipts) || 0;
    issued += Number(r.issues) || 0;
  }

  const lastRow = sorted[sorted.length - 1];
  const closing = lastRow ? Number(lastRow.balance) : 0;

  return { fuelType, opening, received, issued, closing, label };
}

export async function fetchFuelWeeklyAnalysis(
  scope: ScopeFilter,
  dateStart: string,
  dateEnd: string,
  weekLabel: string,
): Promise<FuelAnalysisTable> {
  const serviceCentreId: string | null = scope.isSCScoped ? scope.scopeId : null;

  const results = await Promise.all(
    (['diesel', 'petrol'] as FuelType[]).map(async (ft) => {
      const data = await queryFuelControlCards({
        fuelType: ft,
        year: 0,
        dateStart,
        dateEnd,
        serviceCentreId,
        fields: 'entry_date, is_opening_balance, receipts, issues, balance, sort_order',
      });
      return { ft, data };
    })
  );

  const diesel = buildRow('diesel', results.find(r => r.ft === 'diesel')!.data, weekLabel);
  const petrol = buildRow('petrol', results.find(r => r.ft === 'petrol')!.data, weekLabel);
  return { diesel: [diesel], petrol: [petrol] };
}

export async function fetchFuelMonthlyAnalysis(
  scope: ScopeFilter,
  year: number,
  month: number,
): Promise<FuelAnalysisTable> {
  const serviceCentreId: string | null = scope.isSCScoped ? scope.scopeId : null;
  const label = monthLabel(month, year);

  const results = await Promise.all(
    (['diesel', 'petrol'] as FuelType[]).map(async (ft) => {
      const data = await queryFuelControlCards({
        fuelType: ft,
        year,
        month,
        serviceCentreId,
        fields: 'entry_date, is_opening_balance, receipts, issues, balance, sort_order',
      });
      return { ft, data };
    })
  );

  const diesel = buildRow('diesel', results.find(r => r.ft === 'diesel')!.data, label);
  const petrol = buildRow('petrol', results.find(r => r.ft === 'petrol')!.data, label);
  return { diesel: [diesel], petrol: [petrol] };
}

export async function fetchFuelQuarterlyAnalysis(
  scope: ScopeFilter,
  year: number,
): Promise<FuelAnalysisTable> {
  const serviceCentreId: string | null = scope.isSCScoped ? scope.scopeId : null;

  const results = await Promise.all(
    (['diesel', 'petrol'] as FuelType[]).map(async (ft) => {
      const data = await queryFuelControlCards({
        fuelType: ft,
        year,
        serviceCentreId,
        fields: 'entry_date, is_opening_balance, receipts, issues, balance, sort_order, month',
      });
      return { ft, data };
    })
  );

  const QUARTER_MONTHS: Record<number, number[]> = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12],
  };

  const diesel: FuelPeriodRow[] = [];
  const petrol: FuelPeriodRow[] = [];

  for (let q = 1; q <= 4; q++) {
    const months = QUARTER_MONTHS[q];
    const label = quarterLabel(q, year);

    for (const { ft, data } of results) {
      const qData = data.filter((r: any) => months.includes(Number(r.month)));
      const row = buildRow(ft as FuelType, qData, label);
      if (ft === 'diesel') diesel.push(row);
      else petrol.push(row);
    }
  }

  return { diesel, petrol };
}

export interface FuelFullAnalysis {
  weekly: FuelAnalysisTable | null;
  monthly: FuelAnalysisTable;
  quarterly: FuelAnalysisTable;
}

export async function fetchFuelAnalysis(
  scope: ScopeFilter,
  year: number,
  month: number,
  weekDateStart?: string,
  weekDateEnd?: string,
  weekLabel?: string,
): Promise<FuelFullAnalysis> {
  const [monthly, quarterly, weekly] = await Promise.all([
    fetchFuelMonthlyAnalysis(scope, year, month),
    fetchFuelQuarterlyAnalysis(scope, year),
    weekDateStart && weekDateEnd && weekLabel
      ? fetchFuelWeeklyAnalysis(scope, weekDateStart, weekDateEnd, weekLabel)
      : Promise.resolve(null),
  ]);
  return { weekly, monthly, quarterly };
}
