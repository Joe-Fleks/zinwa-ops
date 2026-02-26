import { supabase } from '../supabase';
import type { ScopeFilter } from '../metricsConfig';
import { roundTo, buildMonthDateRange } from '../metricsConfig';
import { applyScopeToQuery } from './scopeFilter';

export interface EnergyMeterSummary {
  meterId: string;
  stationName: string;
  meterNumber: string;
  meterName: string;
  tariffRate: number;
  linkedMotors: number;
  estimatedKWh: number;
  estimatedCost: number;
  actualBillAmount: number;
  actualKWh: number;
  variancePct: number | null;
}

export interface EnergyStationSummary {
  stationId: string;
  stationName: string;
  meters: EnergyMeterSummary[];
  totalEstKWh: number;
  totalEstCost: number;
  totalActBill: number;
  totalActKWh: number;
}

export interface MonthlyEnergySummary {
  totalEstimatedKWh: number;
  totalEstimatedCost: number;
  totalActualBill: number;
  totalActualKWh: number;
  overallVariancePct: number | null;
  stations: EnergyStationSummary[];
}

export async function fetchMonthlyEnergySummary(
  scope: ScopeFilter,
  year: number,
  month: number
): Promise<MonthlyEnergySummary> {
  let stationsQuery = supabase
    .from('stations')
    .select('id, station_name, service_centre_id');
  stationsQuery = applyScopeToQuery(stationsQuery, scope);
  const { data: stationsData } = await stationsQuery;
  const allStations = stationsData || [];
  const stationIds = allStations.map(s => s.id);
  const stationMap = new Map(allStations.map(s => [s.id, s]));

  if (stationIds.length === 0) return emptyEnergySummary();

  const allowedSCIds = [...new Set(allStations.map(s => s.service_centre_id))];

  const [metersRes, motorsRes, logsRes] = await Promise.all([
    supabase.from('energy_meters').select('*').in('service_centre_id', allowedSCIds),
    supabase.from('equipment_motors').select('id, station_id, motor_use, kw_rating').in('service_centre_id', allowedSCIds),
    (() => {
      const dateRange = buildMonthDateRange(year, month);
      return supabase.from('production_logs')
        .select('station_id, cw_hours_run, rw_hours_run')
        .in('station_id', stationIds)
        .gte('date', dateRange.start)
        .lt('date', dateRange.end);
    })(),
  ]);

  const meters = metersRes.data || [];
  const motorsList = motorsRes.data || [];
  const motorMap = new Map(motorsList.map(m => [m.id, m]));

  const meterIds = meters.map(m => m.id);

  let links: any[] = [];
  let bills: any[] = [];
  if (meterIds.length > 0) {
    const [linksRes, billsRes] = await Promise.all([
      supabase.from('energy_meter_equipment').select('*').in('meter_id', meterIds),
      supabase.from('energy_bills').select('*').in('meter_id', meterIds).eq('year', year).eq('month', month),
    ]);
    links = linksRes.data || [];
    bills = billsRes.data || [];
  }

  const hoursAgg = new Map<string, { cw: number; rw: number }>();
  for (const log of (logsRes.data || [])) {
    const ex = hoursAgg.get(log.station_id) || { cw: 0, rw: 0 };
    ex.cw += Number(log.cw_hours_run) || 0;
    ex.rw += Number(log.rw_hours_run) || 0;
    hoursAgg.set(log.station_id, ex);
  }

  const linksByMeter = new Map<string, string[]>();
  for (const l of links) {
    const list = linksByMeter.get(l.meter_id) || [];
    list.push(l.motor_id);
    linksByMeter.set(l.meter_id, list);
  }
  const billByMeter = new Map<string, any>();
  for (const b of bills) billByMeter.set(b.meter_id, b);

  const stationGrouped = new Map<string, EnergyMeterSummary[]>();

  for (const meter of meters) {
    const st = stationMap.get(meter.station_id);
    if (!st) continue;

    const motorIds = linksByMeter.get(meter.id) || [];
    const stHrs = hoursAgg.get(meter.station_id) || { cw: 0, rw: 0 };
    const tariff = Number(meter.tariff_rate_per_kwh) || 0;

    let estKWh = 0;
    for (const mid of motorIds) {
      const motor = motorMap.get(mid);
      if (!motor) continue;
      const kw = Number(motor.kw_rating) || 0;
      const hrs = motor.motor_use === 'RW Pump' ? stHrs.rw : stHrs.cw;
      estKWh += kw * hrs;
    }

    const estCost = estKWh * tariff;
    const bill = billByMeter.get(meter.id);
    const actBill = bill ? Number(bill.actual_bill_amount) || 0 : 0;
    const actKWh = bill ? Number(bill.actual_kwh) || 0 : 0;
    const variancePct = estCost > 0 ? roundTo(((actBill - estCost) / estCost) * 100, 1) : null;

    const meterSummary: EnergyMeterSummary = {
      meterId: meter.id,
      stationName: st.station_name,
      meterNumber: meter.meter_number,
      meterName: meter.meter_name,
      tariffRate: tariff,
      linkedMotors: motorIds.length,
      estimatedKWh: roundTo(estKWh, 0),
      estimatedCost: roundTo(estCost, 2),
      actualBillAmount: roundTo(actBill, 2),
      actualKWh: roundTo(actKWh, 0),
      variancePct,
    };

    const list = stationGrouped.get(meter.station_id) || [];
    list.push(meterSummary);
    stationGrouped.set(meter.station_id, list);
  }

  const stationSummaries: EnergyStationSummary[] = [];
  let grandEstKWh = 0, grandEstCost = 0, grandActBill = 0, grandActKWh = 0;

  for (const [sid, meterList] of stationGrouped) {
    const st = stationMap.get(sid);
    if (!st) continue;
    let tEstKWh = 0, tEstCost = 0, tActBill = 0, tActKWh = 0;
    for (const m of meterList) {
      tEstKWh += m.estimatedKWh;
      tEstCost += m.estimatedCost;
      tActBill += m.actualBillAmount;
      tActKWh += m.actualKWh;
    }
    stationSummaries.push({
      stationId: sid,
      stationName: st.station_name,
      meters: meterList,
      totalEstKWh: roundTo(tEstKWh, 0),
      totalEstCost: roundTo(tEstCost, 2),
      totalActBill: roundTo(tActBill, 2),
      totalActKWh: roundTo(tActKWh, 0),
    });
    grandEstKWh += tEstKWh;
    grandEstCost += tEstCost;
    grandActBill += tActBill;
    grandActKWh += tActKWh;
  }

  stationSummaries.sort((a, b) => b.totalEstCost - a.totalEstCost);

  return {
    totalEstimatedKWh: roundTo(grandEstKWh, 0),
    totalEstimatedCost: roundTo(grandEstCost, 2),
    totalActualBill: roundTo(grandActBill, 2),
    totalActualKWh: roundTo(grandActKWh, 0),
    overallVariancePct: grandEstCost > 0 ? roundTo(((grandActBill - grandEstCost) / grandEstCost) * 100, 1) : null,
    stations: stationSummaries,
  };
}

function emptyEnergySummary(): MonthlyEnergySummary {
  return {
    totalEstimatedKWh: 0,
    totalEstimatedCost: 0,
    totalActualBill: 0,
    totalActualKWh: 0,
    overallVariancePct: null,
    stations: [],
  };
}
