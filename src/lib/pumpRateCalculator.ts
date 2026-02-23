import { supabase } from './supabase';

export async function calculateAndUpdatePumpRates() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const { data: productionLogs, error: logsError } = await supabase
      .from('production_logs')
      .select('station_id, cw_volume_m3, cw_hours_run, rw_volume_m3, rw_hours_run')
      .gte('date', oneWeekAgoStr)
      .lte('date', todayStr);

    if (logsError) throw logsError;

    const stationData = new Map<string, {
      cwVolume: number;
      cwHours: number;
      rwVolume: number;
      rwHours: number;
    }>();

    for (const log of productionLogs || []) {
      const existing = stationData.get(log.station_id) || {
        cwVolume: 0,
        cwHours: 0,
        rwVolume: 0,
        rwHours: 0
      };

      stationData.set(log.station_id, {
        cwVolume: existing.cwVolume + (log.cw_volume_m3 || 0),
        cwHours: existing.cwHours + (log.cw_hours_run || 0),
        rwVolume: existing.rwVolume + (log.rw_volume_m3 || 0),
        rwHours: existing.rwHours + (log.rw_hours_run || 0)
      });
    }

    const { data: stations, error: stationsError } = await supabase
      .from('stations')
      .select('id, station_type');

    if (stationsError) throw stationsError;

    const updates: Array<{
      id: string;
      cw_pump_rate_m3_hr: number | null;
      rw_pump_rate_m3_hr: number | null;
      pump_rates_last_updated: string;
    }> = [];

    for (const station of stations || []) {
      const data = stationData.get(station.id);

      if (data) {
        const cwPumpRate = data.cwHours > 0 ? data.cwVolume / data.cwHours : null;
        const rwPumpRate =
          station.station_type === 'Full Treatment' && data.rwHours > 0
            ? data.rwVolume / data.rwHours
            : null;

        updates.push({
          id: station.id,
          cw_pump_rate_m3_hr: cwPumpRate ? Math.round(cwPumpRate * 100) / 100 : null,
          rw_pump_rate_m3_hr: rwPumpRate ? Math.round(rwPumpRate * 100) / 100 : null,
          pump_rates_last_updated: new Date().toISOString()
        });
      }
    }

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('stations')
        .update({
          cw_pump_rate_m3_hr: update.cw_pump_rate_m3_hr,
          rw_pump_rate_m3_hr: update.rw_pump_rate_m3_hr,
          pump_rates_last_updated: update.pump_rates_last_updated
        })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating pump rates for station ${update.id}:`, updateError);
      }
    }

    return {
      success: true,
      updatedCount: updates.length,
      message: `Successfully updated pump rates for ${updates.length} station(s)`
    };
  } catch (error: any) {
    console.error('Error calculating pump rates:', error);
    return {
      success: false,
      updatedCount: 0,
      message: error.message || 'Failed to calculate pump rates'
    };
  }
}

export async function getStationPumpRates(stationId: string) {
  try {
    const { data, error } = await supabase
      .from('stations')
      .select('cw_pump_rate_m3_hr, rw_pump_rate_m3_hr, pump_rates_last_updated, station_type')
      .eq('id', stationId)
      .single();

    if (error) throw error;

    return {
      cwPumpRate: data.cw_pump_rate_m3_hr,
      rwPumpRate: data.rw_pump_rate_m3_hr,
      lastUpdated: data.pump_rates_last_updated,
      stationType: data.station_type
    };
  } catch (error) {
    console.error('Error fetching pump rates:', error);
    return null;
  }
}
