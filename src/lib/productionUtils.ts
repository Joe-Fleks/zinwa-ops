export interface Station {
  id: string;
  station_code: string;
  station_name: string;
  station_type: string;
}

export type RowStatus = 'unedited' | 'edited' | 'saved';
export type EntryMode = 'multi-station' | 'single-station';

export interface RowMeta {
  isEdited: boolean;
  isValid: boolean;
  hasSaveError: boolean;
  saveErrorMessage?: string;
}

export interface RowData {
  station_id: string;
  station_name: string;
  date: string;
  cw_volume_m3: number;
  cw_hours_run: number;
  rw_volume_m3: number;
  rw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  reason_for_downtime: string;
  alum_kg: number;
  hth_kg: number;
  activated_carbon_kg: number;
  new_connections: number;
  new_connection_category: string;
  meters_serviced: number;
  notes: string;
  existing_log_id?: string;
  isModified: boolean;
  isTouched: boolean;
  errors: string[];
  meta: RowMeta;
}

export interface DateRangeRowData {
  date: string;
  dateDisplay: string;
  cw_volume_m3: number;
  cw_hours_run: number;
  rw_volume_m3: number;
  rw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  reason_for_downtime: string;
  alum_kg: number;
  hth_kg: number;
  activated_carbon_kg: number;
  new_connections: number;
  new_connection_category: string;
  meters_serviced: number;
  notes: string;
  existing_log_id?: string;
  isModified: boolean;
  isTouched: boolean;
  errors: string[];
  meta: RowMeta;
}

export const isDefaultValues = (row: RowData | DateRangeRowData | Record<string, any>): boolean => {
  return (
    row.cw_volume_m3 === 0 &&
    row.cw_hours_run === 0 &&
    (row.rw_volume_m3 === undefined || row.rw_volume_m3 === 0) &&
    (row.rw_hours_run === undefined || row.rw_hours_run === 0) &&
    row.load_shedding_hours === 0 &&
    row.other_downtime_hours === 0 &&
    row.reason_for_downtime === '' &&
    (row.alum_kg === undefined || row.alum_kg === 0) &&
    (row.hth_kg === undefined || row.hth_kg === 0) &&
    (row.activated_carbon_kg === undefined || row.activated_carbon_kg === 0) &&
    row.new_connections === 0 &&
    row.new_connection_category === '' &&
    row.meters_serviced === 0
  );
};

export const getRowStatus = (row: RowData | DateRangeRowData): RowStatus => {
  if (row.existing_log_id) return 'saved';
  if (isDefaultValues(row)) return 'unedited';
  if (row.isTouched || row.isModified) return 'edited';
  return 'unedited';
};

export const generateDateRange = (fromDate: string, toDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(fromDate);
  const end = new Date(toDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

export const formatDateDisplay = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const validateRow = (row: RowData | DateRangeRowData, isFullTreatment: boolean): string[] => {
  const errors: string[] = [];

  const rw = Number(row.rw_hours_run || 0);
  const cw = Number(row.cw_hours_run || 0);
  const load = Number(row.load_shedding_hours || 0);
  const other = Number(row.other_downtime_hours || 0);

  if (rw < 0 || cw < 0) errors.push('Hours run cannot be negative');
  if (load < 0 || other < 0) errors.push('Downtime hours cannot be negative');
  if (rw > 24 || cw > 24 || load > 24 || other > 24) errors.push('Individual hour fields cannot exceed 24 hours');

  const operational = Math.max(rw, cw);
  const totalUnits = Math.round(operational * 100) + Math.round(load * 100) + Math.round(other * 100);
  if (totalUnits > 2400) errors.push('Operational hours + total downtime cannot exceed 24 hours');

  if (other > 0 && !row.reason_for_downtime?.trim()) {
    errors.push("Downtime reason is required when 'Other Downtime' is entered");
  }
  if (row.cw_volume_m3 === 0 && row.cw_hours_run > 0) errors.push('Warning: CW Volume is 0 but hours run > 0');
  if (isFullTreatment && row.rw_volume_m3 === 0 && row.rw_hours_run > 0) {
    errors.push('Warning: RW Volume is 0 but hours run > 0');
  }
  if (row.cw_volume_m3 < 0 || row.rw_volume_m3 < 0) errors.push('Volumes cannot be negative');
  if (row.new_connections < 0 || row.meters_serviced < 0) errors.push('Connections and meters cannot be negative');

  return errors;
};

export const checkMissingChemicals = (row: RowData | DateRangeRowData): boolean => {
  const cwVol = Number(row.cw_volume_m3 || 0);
  const rwVol = Number(row.rw_volume_m3 || 0);
  const alum = Number(row.alum_kg || 0);
  const hth = Number(row.hth_kg || 0);
  const carbon = Number(row.activated_carbon_kg || 0);
  return (cwVol > 0 || rwVol > 0) && alum === 0 && hth === 0 && carbon === 0;
};

export const buildLogData = (row: RowData | DateRangeRowData, stationId: string, date: string, userId?: string) => ({
  station_id: stationId,
  date,
  cw_volume_m3: row.cw_volume_m3,
  cw_hours_run: row.cw_hours_run,
  rw_volume_m3: row.rw_volume_m3,
  rw_hours_run: row.rw_hours_run,
  load_shedding_hours: row.load_shedding_hours,
  other_downtime_hours: row.other_downtime_hours,
  reason_for_downtime: row.reason_for_downtime,
  alum_kg: row.alum_kg,
  hth_kg: row.hth_kg,
  activated_carbon_kg: row.activated_carbon_kg,
  new_connections: row.new_connections,
  new_connection_category: row.new_connection_category,
  meters_serviced: row.meters_serviced,
  notes: row.notes,
  created_by: userId
});

const defaultMeta: RowMeta = { isEdited: false, isValid: true, hasSaveError: false };

export const createRowData = (station: Station, date: string, existingLog?: any): RowData => ({
  station_id: station.id,
  station_name: station.station_name,
  date,
  cw_volume_m3: existingLog?.cw_volume_m3 || 0,
  cw_hours_run: existingLog?.cw_hours_run || 0,
  rw_volume_m3: existingLog?.rw_volume_m3 || 0,
  rw_hours_run: existingLog?.rw_hours_run || 0,
  load_shedding_hours: existingLog?.load_shedding_hours || 0,
  other_downtime_hours: existingLog?.other_downtime_hours || 0,
  reason_for_downtime: existingLog?.reason_for_downtime || '',
  alum_kg: existingLog?.alum_kg || 0,
  hth_kg: existingLog?.hth_kg || 0,
  activated_carbon_kg: existingLog?.activated_carbon_kg || 0,
  new_connections: existingLog?.new_connections || 0,
  new_connection_category: existingLog?.new_connection_category || '',
  meters_serviced: existingLog?.meters_serviced || 0,
  notes: existingLog?.notes || '',
  existing_log_id: existingLog?.id,
  isModified: false,
  isTouched: false,
  errors: [],
  meta: { ...defaultMeta }
});

export const createDateRangeRowData = (date: string, existingLog?: any): DateRangeRowData => ({
  date,
  dateDisplay: formatDateDisplay(date),
  cw_volume_m3: existingLog?.cw_volume_m3 || 0,
  cw_hours_run: existingLog?.cw_hours_run || 0,
  rw_volume_m3: existingLog?.rw_volume_m3 || 0,
  rw_hours_run: existingLog?.rw_hours_run || 0,
  load_shedding_hours: existingLog?.load_shedding_hours || 0,
  other_downtime_hours: existingLog?.other_downtime_hours || 0,
  reason_for_downtime: existingLog?.reason_for_downtime || '',
  alum_kg: existingLog?.alum_kg || 0,
  hth_kg: existingLog?.hth_kg || 0,
  activated_carbon_kg: existingLog?.activated_carbon_kg || 0,
  new_connections: existingLog?.new_connections || 0,
  new_connection_category: existingLog?.new_connection_category || '',
  meters_serviced: existingLog?.meters_serviced || 0,
  notes: existingLog?.notes || '',
  existing_log_id: existingLog?.id,
  isModified: false,
  isTouched: false,
  errors: [],
  meta: { ...defaultMeta }
});

export const getStatusCounts = (data: (RowData | DateRangeRowData)[]) => {
  const counts = { unedited: 0, edited: 0, saved: 0 };
  data.forEach(row => { counts[getRowStatus(row)]++; });
  return counts;
};
