import { supabase } from './supabase';

export type ChemicalType = 'aluminium_sulphate' | 'hth' | 'activated_carbon';

export const CHEMICAL_OPTIONS: { key: ChemicalType; label: string; shortLabel: string; prodField: string }[] = [
  { key: 'aluminium_sulphate', label: 'Aluminium Sulphate', shortLabel: 'Alum', prodField: 'alum_kg' },
  { key: 'hth', label: 'HTH', shortLabel: 'HTH', prodField: 'hth_kg' },
  { key: 'activated_carbon', label: 'Activated Carbon', shortLabel: 'Act. Carbon', prodField: 'activated_carbon_kg' },
];

export function getChemicalLabel(type: ChemicalType): string {
  return CHEMICAL_OPTIONS.find(c => c.key === type)?.label ?? type;
}

export function getChemicalShortLabel(type: ChemicalType): string {
  return CHEMICAL_OPTIONS.find(c => c.key === type)?.shortLabel ?? type;
}

export function getChemicalProdField(type: ChemicalType): string {
  return CHEMICAL_OPTIONS.find(c => c.key === type)?.prodField ?? '';
}

export interface ChemicalStationRow {
  station_id: string;
  station_name: string;
  balance_id?: string;
  opening_balance: number;
  received: number;
  used: number;
  current_balance: number;
  avg_usage_per_day: number;
  days_remaining: number | null;
  isModified?: boolean;
  isTouched?: boolean;
}

export async function fetchFullTreatmentStations(
  allowedServiceCentreIds: string[]
): Promise<{ id: string; station_name: string; service_centre_id: string }[]> {
  if (allowedServiceCentreIds.length === 0) return [];

  const { data, error } = await supabase
    .from('stations')
    .select('id, station_name, service_centre_id')
    .in('service_centre_id', allowedServiceCentreIds)
    .eq('station_type', 'Full Treatment')
    .order('station_name');

  if (error) throw error;
  return data || [];
}

export async function fetchOpeningBalances(
  stationIds: string[],
  chemicalType: ChemicalType,
  year: number,
  month: number
): Promise<Map<string, { id: string; opening_balance: number }>> {
  if (stationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('chemical_stock_balances')
    .select('id, station_id, opening_balance')
    .in('station_id', stationIds)
    .eq('chemical_type', chemicalType)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;

  const map = new Map<string, { id: string; opening_balance: number }>();
  (data || []).forEach(r => {
    map.set(r.station_id, { id: r.id, opening_balance: Number(r.opening_balance) || 0 });
  });
  return map;
}

export async function fetchPreviousMonthClosingBalances(
  stationIds: string[],
  chemicalType: ChemicalType,
  year: number,
  month: number
): Promise<Map<string, number>> {
  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }

  const prevBalances = await fetchOpeningBalances(stationIds, chemicalType, prevYear, prevMonth);
  const prevReceipts = await fetchReceivedTotals(stationIds, chemicalType, prevYear, prevMonth);
  const prevUsed = await fetchUsedTotals(stationIds, chemicalType, prevYear, prevMonth);

  const map = new Map<string, number>();
  stationIds.forEach(sid => {
    const opening = prevBalances.get(sid)?.opening_balance ?? 0;
    const received = prevReceipts.get(sid) ?? 0;
    const used = prevUsed.get(sid) ?? 0;
    map.set(sid, opening + received - used);
  });
  return map;
}

export async function fetchReceivedTotals(
  stationIds: string[],
  chemicalType: ChemicalType,
  year: number,
  month: number
): Promise<Map<string, number>> {
  if (stationIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('chemical_stock_receipts')
    .select('station_id, quantity, receipt_type')
    .in('station_id', stationIds)
    .eq('chemical_type', chemicalType)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;

  const map = new Map<string, number>();
  (data || []).forEach(r => {
    const current = map.get(r.station_id) || 0;
    const qty = Number(r.quantity) || 0;
    if (r.receipt_type === 'transfer_out') {
      map.set(r.station_id, current - qty);
    } else {
      map.set(r.station_id, current + qty);
    }
  });
  return map;
}

export async function fetchUsedTotals(
  stationIds: string[],
  chemicalType: ChemicalType,
  year: number,
  month: number
): Promise<Map<string, number>> {
  if (stationIds.length === 0) return new Map();

  const prodField = getChemicalProdField(chemicalType);
  if (!prodField) return new Map();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('production_logs')
    .select(`station_id, ${prodField}, date`)
    .in('station_id', stationIds)
    .gte('date', startDate)
    .lt('date', endDate);

  if (error) throw error;

  const map = new Map<string, number>();
  (data || []).forEach((r: any) => {
    const current = map.get(r.station_id) || 0;
    map.set(r.station_id, current + (Number(r[prodField]) || 0));
  });
  return map;
}

export async function fetchProductionDayCount(
  stationIds: string[],
  chemicalType: ChemicalType,
  year: number,
  month: number
): Promise<Map<string, number>> {
  if (stationIds.length === 0) return new Map();

  const prodField = getChemicalProdField(chemicalType);
  if (!prodField) return new Map();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('production_logs')
    .select(`station_id, ${prodField}`)
    .in('station_id', stationIds)
    .gte('date', startDate)
    .lt('date', endDate)
    .gt(prodField, 0);

  if (error) throw error;

  const map = new Map<string, number>();
  (data || []).forEach((r: any) => {
    const current = map.get(r.station_id) || 0;
    map.set(r.station_id, current + 1);
  });
  return map;
}

export async function saveOpeningBalances(
  rows: ChemicalStationRow[],
  serviceCentreId: string,
  chemicalType: ChemicalType,
  year: number,
  month: number,
  userId: string
): Promise<void> {
  for (const row of rows) {
    if (!row.isModified && !row.isTouched) continue;

    if (row.balance_id) {
      const { error } = await supabase
        .from('chemical_stock_balances')
        .update({
          opening_balance: row.opening_balance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.balance_id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('chemical_stock_balances')
        .insert({
          service_centre_id: serviceCentreId,
          station_id: row.station_id,
          chemical_type: chemicalType,
          year,
          month,
          opening_balance: row.opening_balance,
          created_by: userId,
        });
      if (error) throw error;
    }
  }
}

export function isCurrentMonth(year: number, month: number): boolean {
  const now = new Date();
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

export function isPastMonth(year: number, month: number): boolean {
  const now = new Date();
  const current = now.getFullYear() * 12 + now.getMonth();
  const target = year * 12 + (month - 1);
  return target < current;
}

export function getBalanceColumnHeader(year: number, month: number): string {
  const firstDay = `01/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;

  if (isPastMonth(year, month)) {
    const lastDay = new Date(year, month, 0).getDate();
    return `Bal. ${lastDay}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  }

  return `Bal. ${firstDay}`;
}

export function getAvgUsageColumnHeader(year: number, month: number): string {
  if (isPastMonth(year, month)) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[month - 1]} Usage/day`;
  }
  return 'Avg. Usage/day';
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
