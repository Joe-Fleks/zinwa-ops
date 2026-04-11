import { supabase } from '../supabase';
import { CATEGORY_DAILY_DEMAND_M3, CLIENT_CATEGORIES } from '../metricsConfig';
import { computeCategoryDailyDemand } from './coreCalculations';
import { fetchAllRows } from './scopeFilter';

export interface StationDemandRow {
  stationId: string;
  stationName: string;
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
  totalClients: number;
  dailyDemandM3: number;
  monthlyDemandM3: number;
}

export interface DemandSummary {
  stationRows: StationDemandRow[];
  scTotalClients: number;
  scDailyDemandM3: number;
  scMonthlyDemandM3: number;
}

export const DEMAND_CATEGORY_LABELS: Record<string, string> = {
  clients_domestic: 'Domestic',
  clients_school: 'School',
  clients_business: 'Business',
  clients_industry: 'Industry',
  clients_church: 'Church',
  clients_parastatal: 'Parastatal',
  clients_government: 'Government',
  clients_other: 'Local Government',
};

export async function fetchDemandByStation(
  scopeId: string | null,
  isSCScoped: boolean,
  year: number,
  month: number
): Promise<DemandSummary> {
  const clientFields = CLIENT_CATEGORIES.join(', ');

  let stationQuery = supabase
    .from('stations')
    .select(`id, station_name, ${clientFields}`)
    .order('station_name');

  if (isSCScoped && scopeId) {
    stationQuery = stationQuery.eq('service_centre_id', scopeId);
  }

  const { data: stationsData, error: stationsError } = await stationQuery;
  if (stationsError) throw stationsError;
  const stations = stationsData || [];

  if (stations.length === 0) {
    return { stationRows: [], scTotalClients: 0, scDailyDemandM3: 0, scMonthlyDemandM3: 0 };
  }

  const stationIds = stations.map((s: any) => s.id);

  const baseYear = 2026;
  const baseMonth = 1;
  const startDate = `${baseYear}-${String(baseMonth).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-01`;
  const endYear = month + 1 > 12 ? year + 1 : year;
  const endDateStr = `${endYear}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-01`;

  const logsData = await fetchAllRows(
    supabase
      .from('production_logs')
      .select('station_id, new_connections, new_connection_category')
      .in('station_id', stationIds)
      .gte('date', startDate)
      .lt('date', endDateStr)
      .gt('new_connections', 0)
  );

  const newConnectionsByStation = new Map<string, Record<string, number>>();
  for (const log of logsData) {
    const field = mapCategoryToField(log.new_connection_category);
    if (!field) continue;
    const existing = newConnectionsByStation.get(log.station_id) || {};
    existing[field] = (existing[field] || 0) + (Number(log.new_connections) || 0);
    newConnectionsByStation.set(log.station_id, existing);
  }

  const daysInMonth = new Date(year, month, 0).getDate();

  const stationRows: StationDemandRow[] = stations.map((s: any) => {
    const increments = newConnectionsByStation.get(s.id) || {};
    const clientCounts: Record<string, number> = {};

    for (const cat of CLIENT_CATEGORIES) {
      clientCounts[cat] = (Number(s[cat]) || 0) + (increments[cat] || 0);
    }

    const dailyDemandM3 = computeCategoryDailyDemand(clientCounts as any);
    const totalClients = CLIENT_CATEGORIES.reduce((sum, cat) => sum + clientCounts[cat], 0);

    return {
      stationId: s.id,
      stationName: s.station_name,
      clients_domestic: clientCounts.clients_domestic,
      clients_school: clientCounts.clients_school,
      clients_business: clientCounts.clients_business,
      clients_industry: clientCounts.clients_industry,
      clients_church: clientCounts.clients_church,
      clients_parastatal: clientCounts.clients_parastatal,
      clients_government: clientCounts.clients_government,
      clients_other: clientCounts.clients_other,
      totalClients,
      dailyDemandM3,
      monthlyDemandM3: dailyDemandM3 * daysInMonth,
    };
  });

  const scDailyDemandM3 = stationRows.reduce((sum, r) => sum + r.dailyDemandM3, 0);
  const scTotalClients = stationRows.reduce((sum, r) => sum + r.totalClients, 0);

  return {
    stationRows,
    scTotalClients,
    scDailyDemandM3,
    scMonthlyDemandM3: scDailyDemandM3 * daysInMonth,
  };
}

export async function fetchDailyDemandByStationId(
  stationIds: string[],
  year: number,
  month: number
): Promise<{ totalDailyDemandM3: number; demandByStationId: Map<string, number> }> {
  if (stationIds.length === 0) {
    return { totalDailyDemandM3: 0, demandByStationId: new Map() };
  }

  const clientFields = CLIENT_CATEGORIES.join(', ');
  const { data: stationsData, error } = await supabase
    .from('stations')
    .select(`id, station_name, ${clientFields}`)
    .in('id', stationIds);

  if (error) throw error;
  const stations = stationsData || [];

  const baseYear = 2026;
  const baseMonth = 1;
  const startDate = `${baseYear}-${String(baseMonth).padStart(2, '0')}-01`;
  const endYear = month + 1 > 12 ? year + 1 : year;
  const endDateStr = `${endYear}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-01`;

  const logsData = await fetchAllRows(
    supabase
      .from('production_logs')
      .select('station_id, new_connections, new_connection_category')
      .in('station_id', stationIds)
      .gte('date', startDate)
      .lt('date', endDateStr)
      .gt('new_connections', 0)
  );

  const newConnectionsByStation = new Map<string, Record<string, number>>();
  for (const log of logsData) {
    const field = mapCategoryToField(log.new_connection_category);
    if (!field) continue;
    const existing = newConnectionsByStation.get(log.station_id) || {};
    existing[field] = (existing[field] || 0) + (Number(log.new_connections) || 0);
    newConnectionsByStation.set(log.station_id, existing);
  }

  const demandByStationId = new Map<string, number>();
  let totalDailyDemandM3 = 0;

  for (const s of stations) {
    const increments = newConnectionsByStation.get(s.id) || {};
    const clientCounts: Record<string, number> = {};
    for (const cat of CLIENT_CATEGORIES) {
      clientCounts[cat] = (Number((s as any)[cat]) || 0) + (increments[cat] || 0);
    }
    const dailyDemandM3 = computeCategoryDailyDemand(clientCounts as any);
    demandByStationId.set(s.id, dailyDemandM3);
    totalDailyDemandM3 += dailyDemandM3;
  }

  return { totalDailyDemandM3, demandByStationId };
}

function mapCategoryToField(category: string | null | undefined): string | null {
  if (!category) return null;
  const c = category.toLowerCase().trim();
  if (c === 'domestic') return 'clients_domestic';
  if (c === 'school') return 'clients_school';
  if (c === 'business') return 'clients_business';
  if (c === 'industry' || c === 'industrial') return 'clients_industry';
  if (c === 'church') return 'clients_church';
  if (c === 'parastatal') return 'clients_parastatal';
  if (c === 'local government') return 'clients_other';
  if (c === 'government' || c === 'govt') return 'clients_government';
  return 'clients_other';
}
