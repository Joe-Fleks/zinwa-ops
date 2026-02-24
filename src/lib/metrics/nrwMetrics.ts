import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo, getPreviousMonthPeriod, CATEGORY_DAILY_DEMAND_M3, CLIENT_CATEGORIES } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';
import {
  computeNRWLosses,
  computeTotalClients,
  type StationClientFields,
} from './coreCalculations';
import { calcRevenueForVolume, buildCategoryTariffMap, type TariffBand } from '../nrwCalculations';


export interface NRWStationMetrics {
  stationId: string;
  stationName: string;
  stationType: string;
  rwVolume: number;
  cwVolume: number;
  salesVolume: number;
  stationLossVol: number;
  stationLossPct: number;
  distributionLossVol: number;
  distributionLossPct: number;
  totalLossVol: number;
  totalLossPct: number;
  estimatedFinancialLoss: number;
  totalClients: number;
}

export interface NRWSummaryMetrics {
  totalRWVolume: number;
  totalCWVolume: number;
  totalSalesVolume: number;
  stationLossVol: number;
  stationLossPct: number;
  distributionLossVol: number;
  distributionLossPct: number;
  totalLossVol: number;
  totalLossPct: number;
  totalFinancialLoss: number;
  stationCount: number;
  stations: NRWStationMetrics[];
}

export async function fetchNRWMetrics(
  scope: ScopeFilter,
  year: number,
  months: number[],
  tariffBands: TariffBand[]
): Promise<NRWSummaryMetrics> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, station_type, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other, service_centre_id')
    .order('station_name');

  stationsQuery = applyScopeToQuery(stationsQuery, scope);
  const { data: stationsData, error: stErr } = await stationsQuery;
  if (stErr) throw stErr;

  const stations = stationsData || [];
  if (stations.length === 0) {
    return emptyNRWSummary();
  }

  const stationIds = stations.map((s: any) => s.id);

  const prodMonthPairs = months.map(m => getPreviousMonthPeriod(year, m));
  let allProdLogs: any[] = [];
  for (const p of prodMonthPairs) {
    const startDate = `${p.year}-${String(p.month).padStart(2, '0')}-01`;
    const endDate = new Date(p.year, p.month, 0).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('production_logs')
      .select('station_id, rw_volume_m3, cw_volume_m3')
      .in('station_id', stationIds)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;
    allProdLogs = allProdLogs.concat(data || []);
  }

  let allSalesRecords: any[] = [];
  for (const m of months) {
    const { data, error } = await supabase
      .from('sales_records')
      .select('station_id, returns_volume_m3, sage_sales_volume_m3')
      .in('station_id', stationIds)
      .eq('year', year)
      .eq('month', m);
    if (error) throw error;
    allSalesRecords = allSalesRecords.concat(data || []);
  }

  const { data: cwClientsData } = await supabase
    .from('cw_clients_monthly')
    .select('station_id, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other')
    .in('station_id', stationIds)
    .eq('year', year)
    .in('month', months);

  const cwClientsMap = new Map<string, StationClientFields>();
  for (const c of (cwClientsData || [])) {
    const existing = cwClientsMap.get(c.station_id);
    if (!existing) {
      cwClientsMap.set(c.station_id, {
        clients_domestic: c.clients_domestic || 0,
        clients_school: c.clients_school || 0,
        clients_business: c.clients_business || 0,
        clients_industry: c.clients_industry || 0,
        clients_church: c.clients_church || 0,
        clients_parastatal: c.clients_parastatal || 0,
        clients_government: c.clients_government || 0,
        clients_other: c.clients_other || 0,
      });
    } else {
      existing.clients_domestic += c.clients_domestic || 0;
      existing.clients_school += c.clients_school || 0;
      existing.clients_business += c.clients_business || 0;
      existing.clients_industry += c.clients_industry || 0;
      existing.clients_church += c.clients_church || 0;
      existing.clients_parastatal += c.clients_parastatal || 0;
      existing.clients_government += c.clients_government || 0;
      existing.clients_other += c.clients_other || 0;
    }
  }

  const prodByStation = new Map<string, { rw: number; cw: number }>();
  for (const log of allProdLogs) {
    const existing = prodByStation.get(log.station_id) || { rw: 0, cw: 0 };
    existing.rw += Number(log.rw_volume_m3) || 0;
    existing.cw += Number(log.cw_volume_m3) || 0;
    prodByStation.set(log.station_id, existing);
  }

  const salesByStation = new Map<string, number>();
  for (const rec of allSalesRecords) {
    const sage = Number(rec.sage_sales_volume_m3) || 0;
    const returns = Number(rec.returns_volume_m3) || 0;
    const salesVol = sage > 0 ? sage : returns;
    salesByStation.set(rec.station_id, (salesByStation.get(rec.station_id) || 0) + salesVol);
  }

  const stationMetrics: NRWStationMetrics[] = stations.map((station: any) => {
    const prod = prodByStation.get(station.id) || { rw: 0, cw: 0 };
    const salesVol = salesByStation.get(station.id) || 0;
    const isBorehole = station.station_type === 'Borehole';

    const monthlyClients = cwClientsMap.get(station.id);
    const monthlyTotal = monthlyClients ? computeTotalClients(monthlyClients) : 0;
    const clientData: StationClientFields = (monthlyClients && monthlyTotal > 0) ? monthlyClients : station;
    const totalClients = computeTotalClients(clientData);

    const losses = computeNRWLosses(prod.rw, prod.cw, salesVol, isBorehole);
    const estLoss = computeEstFinancialLoss(losses.totalLossVol, clientData, tariffBands);

    return {
      stationId: station.id,
      stationName: station.station_name,
      stationType: station.station_type,
      rwVolume: prod.rw,
      cwVolume: prod.cw,
      salesVolume: salesVol,
      ...losses,
      estimatedFinancialLoss: estLoss,
      totalClients,
    };
  });

  stationMetrics.sort((a, b) => b.estimatedFinancialLoss - a.estimatedFinancialLoss);

  const totalRW = stationMetrics.reduce((s, r) => s + r.rwVolume, 0);
  const totalCW = stationMetrics.reduce((s, r) => s + r.cwVolume, 0);
  const totalSales = stationMetrics.reduce((s, r) => s + r.salesVolume, 0);
  const stLossVol = stationMetrics.reduce((s, r) => s + r.stationLossVol, 0);
  const distLossVol = stationMetrics.reduce((s, r) => s + r.distributionLossVol, 0);
  const totLossVol = stationMetrics.reduce((s, r) => s + r.totalLossVol, 0);
  const totFinLoss = stationMetrics.reduce((s, r) => s + r.estimatedFinancialLoss, 0);

  const surfaceRWVol = stationMetrics
    .filter(r => r.stationType !== 'Borehole')
    .reduce((s, r) => s + r.rwVolume, 0);
  const boreholeCWVol = stationMetrics
    .filter(r => r.stationType === 'Borehole')
    .reduce((s, r) => s + r.cwVolume, 0);
  const totalNRWDenominator = surfaceRWVol + boreholeCWVol;

  return {
    totalRWVolume: totalRW,
    totalCWVolume: totalCW,
    totalSalesVolume: totalSales,
    stationLossVol: stLossVol,
    stationLossPct: totalRW > 0 ? roundTo((stLossVol / totalRW) * 100, 1) : 0,
    distributionLossVol: distLossVol,
    distributionLossPct: totalCW > 0 ? roundTo((distLossVol / totalCW) * 100, 1) : 0,
    totalLossVol: totLossVol,
    totalLossPct: totalNRWDenominator > 0 ? roundTo((totLossVol / totalNRWDenominator) * 100, 1) : 0,
    totalFinancialLoss: totFinLoss,
    stationCount: stationMetrics.length,
    stations: stationMetrics,
  };
}

const CLIENT_TO_TARIFF_CATEGORY: Record<string, string> = {
  clients_domestic: 'Domestic',
  clients_school: 'Institutions',
  clients_business: 'Business',
  clients_industry: 'Industry',
  clients_church: 'Institutions',
  clients_parastatal: 'Parastatal',
  clients_government: 'Government',
  clients_other: 'Domestic',
};

function computeEstFinancialLoss(
  lostVolume: number,
  clientData: StationClientFields,
  bands: TariffBand[]
): number {
  if (lostVolume <= 0 || bands.length === 0) return 0;

  const totalClients = computeTotalClients(clientData);
  if (totalClients <= 0) return 0;

  const categoryMap = buildCategoryTariffMap(bands);
  const hasCategories = categoryMap.size > 1 || !categoryMap.has('Default');

  let totalDailyDemand = 0;
  for (const cat of CLIENT_CATEGORIES) {
    const count = Number((clientData as any)[cat]) || 0;
    totalDailyDemand += count * (CATEGORY_DAILY_DEMAND_M3[cat] || 0);
  }
  if (totalDailyDemand <= 0) return 0;

  let totalRevenueLoss = 0;
  for (const cat of CLIENT_CATEGORIES) {
    const count = Number((clientData as any)[cat]) || 0;
    if (count <= 0) continue;

    const categoryDailyDemand = count * (CATEGORY_DAILY_DEMAND_M3[cat] || 0);
    const demandShare = categoryDailyDemand / totalDailyDemand;
    const categoryLostVolume = lostVolume * demandShare;
    const lostPerConnection = categoryLostVolume / count;

    let catBands: TariffBand[];
    if (hasCategories) {
      const tariffCat = CLIENT_TO_TARIFF_CATEGORY[cat];
      catBands = categoryMap.get(tariffCat) || categoryMap.get('Domestic') || bands;
    } else {
      catBands = bands;
    }

    const revenuePerConnection = calcRevenueForVolume(lostPerConnection, catBands);
    totalRevenueLoss += revenuePerConnection * count;
  }

  return totalRevenueLoss;
}

function emptyNRWSummary(): NRWSummaryMetrics {
  return {
    totalRWVolume: 0, totalCWVolume: 0, totalSalesVolume: 0,
    stationLossVol: 0, stationLossPct: 0, distributionLossVol: 0, distributionLossPct: 0,
    totalLossVol: 0, totalLossPct: 0, totalFinancialLoss: 0, stationCount: 0, stations: [],
  };
}

export interface NRWMonthResult {
  monthKey: string;
  prodVolume: number;
  salesVolume: number;
  lossVolume: number;
  nrwPct: number | null;
}

export function aggregateNRWByQuarter(
  monthResults: Map<string, NRWMonthResult>,
  year: number
): Map<string, number | null> {
  const quarterMap = new Map<string, number | null>();
  const quarterLabels = ['Q1', 'Q2', 'Q3', 'Q4'];

  for (let q = 0; q < 4; q++) {
    let totalDenom = 0;
    let totalLoss = 0;
    for (let m = q * 3; m < q * 3 + 3; m++) {
      const key = `${year}-${String(m + 1).padStart(2, '0')}`;
      const res = monthResults.get(key);
      if (res) {
        totalDenom += res.prodVolume;
        totalLoss += res.lossVolume;
      }
    }
    quarterMap.set(
      quarterLabels[q],
      totalDenom > 0 ? roundTo((totalLoss / totalDenom) * 100, 1) : null
    );
  }

  return quarterMap;
}

export async function fetchNRWByMonth(
  stationIds: string[],
  year: number,
  monthIndices: number[]
): Promise<Map<string, NRWMonthResult>> {
  const result = new Map<string, NRWMonthResult>();
  if (stationIds.length === 0 || monthIndices.length === 0) return result;

  const { data: stationTypesData } = await supabase
    .from('stations')
    .select('id, station_type')
    .in('id', stationIds);

  const boreholeSet = new Set(
    (stationTypesData || []).filter((s: any) => s.station_type === 'Borehole').map((s: any) => s.id)
  );
  const boreholeIds = stationIds.filter(id => boreholeSet.has(id));
  const surfaceIds = stationIds.filter(id => !boreholeSet.has(id));

  for (const monthIdx of monthIndices) {
    const salesMonthNum = monthIdx + 1;
    const salesMonthKey = `${year}-${String(salesMonthNum).padStart(2, '0')}`;

    const prevPeriod = getPreviousMonthPeriod(year, salesMonthNum);
    const prodStart = `${prevPeriod.year}-${String(prevPeriod.month).padStart(2, '0')}-01`;
    const prodEnd = new Date(prevPeriod.year, prevPeriod.month, 0).toISOString().split('T')[0];

    const queries: Promise<any>[] = [
      supabase.from('sales_records')
        .select('station_id, sage_sales_volume_m3, returns_volume_m3')
        .in('station_id', stationIds)
        .eq('year', year)
        .eq('month', salesMonthNum),
      surfaceIds.length > 0
        ? supabase.from('production_logs')
            .select('station_id, rw_volume_m3')
            .in('station_id', surfaceIds)
            .gte('date', prodStart)
            .lte('date', prodEnd)
        : Promise.resolve({ data: [] }),
      boreholeIds.length > 0
        ? supabase.from('production_logs')
            .select('station_id, cw_volume_m3')
            .in('station_id', boreholeIds)
            .gte('date', prodStart)
            .lte('date', prodEnd)
        : Promise.resolve({ data: [] }),
    ];

    const [{ data: salesData }, { data: rwProdData }, { data: cwProdData }] = await Promise.all(queries);

    const rwByStation = new Map<string, number>();
    for (const r of (rwProdData || [])) {
      rwByStation.set(r.station_id, (rwByStation.get(r.station_id) || 0) + (Number(r.rw_volume_m3) || 0));
    }
    const cwByStation = new Map<string, number>();
    for (const r of (cwProdData || [])) {
      cwByStation.set(r.station_id, (cwByStation.get(r.station_id) || 0) + (Number(r.cw_volume_m3) || 0));
    }

    const salesByStation = new Map<string, number>();
    for (const r of (salesData || [])) {
      const sage = Number(r.sage_sales_volume_m3) || 0;
      const ret = Number(r.returns_volume_m3) || 0;
      salesByStation.set(r.station_id, (salesByStation.get(r.station_id) || 0) + (sage > 0 ? sage : ret));
    }

    let totalNRWDenominator = 0;
    let totalLossVol = 0;
    for (const id of surfaceIds) {
      const rw = rwByStation.get(id) || 0;
      const sales = salesByStation.get(id) || 0;
      totalNRWDenominator += rw;
      totalLossVol += Math.max(0, rw - sales);
    }
    for (const id of boreholeIds) {
      const cw = cwByStation.get(id) || 0;
      const sales = salesByStation.get(id) || 0;
      totalNRWDenominator += cw;
      totalLossVol += Math.max(0, cw - sales);
    }

    const totalSalesVol = [...salesByStation.values()].reduce((s, v) => s + v, 0);
    const nrwPct = totalNRWDenominator > 0 ? roundTo((totalLossVol / totalNRWDenominator) * 100, 1) : null;

    result.set(salesMonthKey, { monthKey: salesMonthKey, prodVolume: totalNRWDenominator, salesVolume: totalSalesVol, lossVolume: totalLossVol, nrwPct });
  }

  return result;
}
