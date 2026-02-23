export interface TariffBand {
  band_min_m3: number;
  band_max_m3: number | null;
  tariff_usd_per_m3: number;
  sort_order: number;
}

export interface StationClients {
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
}

const CATEGORY_DAILY_DEMAND_M3: Record<keyof StationClients, number> = {
  clients_domestic: 0.5,
  clients_school: 5.0,
  clients_business: 2.0,
  clients_industry: 15.0,
  clients_church: 0.5,
  clients_parastatal: 10.0,
  clients_government: 5.0,
  clients_other: 5.0,
};

const CATEGORIES = Object.keys(CATEGORY_DAILY_DEMAND_M3) as (keyof StationClients)[];

export function calcRevenueForVolume(volume: number, bands: TariffBand[]): number {
  if (volume <= 0 || bands.length === 0) return 0;

  const sorted = [...bands].sort((a, b) => a.sort_order - b.sort_order);
  let revenue = 0;
  let remaining = volume;

  for (const band of sorted) {
    if (remaining <= 0) break;
    const bandSize = band.band_max_m3 !== null
      ? band.band_max_m3 - band.band_min_m3 + 1
      : remaining;
    const consumed = Math.min(remaining, bandSize);
    revenue += consumed * band.tariff_usd_per_m3;
    remaining -= consumed;
  }

  return revenue;
}

export function estimateFinancialLoss(
  lostVolume: number,
  stationClients: StationClients,
  bands: TariffBand[],
  daysInPeriod: number = 30
): number {
  if (lostVolume <= 0 || bands.length === 0) return 0;

  const totalClients = getStationTotalClients(stationClients);
  if (totalClients <= 0) return 0;

  let totalDailyDemand = 0;
  for (const cat of CATEGORIES) {
    const count = stationClients[cat] || 0;
    if (count > 0) {
      totalDailyDemand += count * CATEGORY_DAILY_DEMAND_M3[cat];
    }
  }

  if (totalDailyDemand <= 0) return 0;

  let totalRevenueLoss = 0;

  for (const cat of CATEGORIES) {
    const count = stationClients[cat] || 0;
    if (count <= 0) continue;

    const categoryDailyDemand = count * CATEGORY_DAILY_DEMAND_M3[cat];
    const demandShare = categoryDailyDemand / totalDailyDemand;
    const categoryLostVolume = lostVolume * demandShare;
    const lostPerConnection = categoryLostVolume / count;
    const revenuePerConnection = calcRevenueForVolume(lostPerConnection, bands);
    totalRevenueLoss += revenuePerConnection * count;
  }

  return totalRevenueLoss;
}

export function getStationTotalClients(station: {
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
}): number {
  return (
    (station.clients_domestic || 0) +
    (station.clients_school || 0) +
    (station.clients_business || 0) +
    (station.clients_industry || 0) +
    (station.clients_church || 0) +
    (station.clients_parastatal || 0) +
    (station.clients_government || 0) +
    (station.clients_other || 0)
  );
}

export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}
