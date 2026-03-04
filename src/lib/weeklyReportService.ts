import { supabase } from './supabase';
import { getWeekDateRangeForWeekNumber } from './dateUtils';
import { fetchWeeklyReportData, type WeeklyReportData } from './metrics/weeklyReportMetrics';
import type { ScopeFilter } from './metricsConfig';

export interface WeeklyReportRecord {
  id: string;
  service_centre_id: string;
  week_number: number;
  year: number;
  report_type: 'friday' | 'tuesday';
  period_start: string;
  period_end: string;
  report_data: WeeklyReportData;
  status: 'ready' | 'downloaded';
  generated_at: string;
  downloaded_at: string | null;
}

export function getFridayWeekDateRange(weekNumber: number, year: number): { start: string; end: string } {
  return getWeekDateRangeForWeekNumber(weekNumber, year);
}

export function getTuesdayWeekDateRange(weekNumber: number, year: number): { start: string; end: string } {
  const fridayRange = getWeekDateRangeForWeekNumber(weekNumber, year);
  const fridayStart = new Date(fridayRange.start + 'T12:00:00');

  const tuesdayStart = new Date(fridayStart);
  tuesdayStart.setDate(fridayStart.getDate() + 4);

  const mondayEnd = new Date(tuesdayStart);
  mondayEnd.setDate(tuesdayStart.getDate() + 6);

  return {
    start: tuesdayStart.toISOString().split('T')[0],
    end: mondayEnd.toISOString().split('T')[0],
  };
}

export async function fetchPendingWeeklyReports(
  serviceCentreId: string
): Promise<WeeklyReportRecord[]> {
  const { data, error } = await supabase
    .from('weekly_reports')
    .select('id, service_centre_id, week_number, year, report_type, period_start, period_end, report_data, status, generated_at, downloaded_at')
    .eq('service_centre_id', serviceCentreId)
    .eq('status', 'ready')
    .order('generated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as WeeklyReportRecord[];
}

export async function markReportDownloaded(
  reportId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('weekly_reports')
    .update({
      status: 'downloaded',
      downloaded_at: new Date().toISOString(),
      downloaded_by: userId,
    })
    .eq('id', reportId);

  if (error) throw error;
}

export async function generateAndSaveWeeklyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday'
): Promise<WeeklyReportRecord | null> {
  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id, status')
    .eq('service_centre_id', serviceCentreId)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .eq('report_type', reportType)
    .maybeSingle();

  if (existing) return null;

  const dateRange = reportType === 'friday'
    ? getFridayWeekDateRange(weekNumber, year)
    : getTuesdayWeekDateRange(weekNumber, year);

  const reportData = await fetchWeeklyReportData(
    scope, dateRange, weekNumber, year, reportType, serviceCentreName
  );

  const { data, error } = await supabase
    .from('weekly_reports')
    .insert({
      service_centre_id: serviceCentreId,
      week_number: weekNumber,
      year,
      report_type: reportType,
      period_start: dateRange.start,
      period_end: dateRange.end,
      report_data: reportData,
      status: 'ready',
    })
    .select('id, service_centre_id, week_number, year, report_type, period_start, period_end, report_data, status, generated_at, downloaded_at')
    .single();

  if (error) throw error;
  return data as WeeklyReportRecord;
}

export async function refreshWeeklyReportData(
  scope: ScopeFilter,
  reportId: string,
  serviceCentreName: string,
  weekNumber: number,
  year: number,
  reportType: 'friday' | 'tuesday',
  periodStart: string,
  periodEnd: string
): Promise<WeeklyReportData> {
  const dateRange = { start: periodStart, end: periodEnd };
  const reportData = await fetchWeeklyReportData(
    scope, dateRange, weekNumber, year, reportType, serviceCentreName
  );

  const { error } = await supabase
    .from('weekly_reports')
    .update({ report_data: reportData, generated_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) throw error;
  return reportData;
}

export interface MissingLogsInfo {
  reportType: 'friday' | 'tuesday';
  reportLabel: string;
  checkDate: string;
  checkDateLabel: string;
  totalStations: number;
  loggedCount: number;
  missingStations: { id: string; name: string }[];
}

export interface WeeklyReportTriggerResult {
  triggered: boolean;
  reportType?: string;
  missingLogs?: MissingLogsInfo;
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fetchStationsWithLogStatus(
  serviceCentreId: string,
  checkDate: string
): Promise<{ stations: { id: string; name: string }[]; loggedIds: Set<string> }> {
  const stationsRes = await supabase
    .from('stations')
    .select('id, station_name')
    .eq('service_centre_id', serviceCentreId)
    .in('station_type', ['Full Treatment', 'Borehole']);

  if (stationsRes.error || !stationsRes.data?.length) return { stations: [], loggedIds: new Set() };

  const stations = stationsRes.data.map(s => ({ id: s.id, name: s.station_name }));
  const stationIds = stations.map(s => s.id);

  const { data: logs } = await supabase
    .from('production_logs')
    .select('station_id')
    .in('station_id', stationIds)
    .eq('date', checkDate);

  const loggedIds = new Set((logs || []).map((l: { station_id: string }) => l.station_id));
  return { stations, loggedIds };
}

function computeWeekNumber(referenceDate: Date): number {
  const daysFromFriday = (referenceDate.getDay() + 2) % 7;
  const currentWeekStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate() - daysFromFriday,
    12, 0, 0
  );

  const firstFridayOfYear = new Date(referenceDate.getFullYear(), 0, 1, 12, 0, 0);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);
  const daysDifference = Math.round((currentWeekStart.getTime() - firstFridayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(daysDifference / 7) + 1);
}

export async function checkAndTriggerWeeklyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string
): Promise<WeeklyReportTriggerResult> {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const canTriggerFriday = dayOfWeek >= 5 || dayOfWeek <= 1;
  const canTriggerTuesday = dayOfWeek >= 2 && dayOfWeek <= 4;

  if (canTriggerTuesday) {
    const result = await tryGenerateTuesdayReport(scope, serviceCentreId, serviceCentreName, today);
    if (result.triggered || result.missingLogs) return result;
  }

  if (canTriggerFriday) {
    const result = await tryGenerateFridayReport(scope, serviceCentreId, serviceCentreName, today);
    if (result.triggered || result.missingLogs) return result;
  }

  return { triggered: false };
}

async function tryGenerateFridayReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  today: Date
): Promise<WeeklyReportTriggerResult> {
  const dayOfWeek = today.getDay();
  const daysAfterFriday = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
  const lastFriday = new Date(today);
  lastFriday.setDate(today.getDate() - daysAfterFriday);

  const thursday = new Date(lastFriday);
  thursday.setDate(lastFriday.getDate() - 1);
  const thursdayStr = toLocalDateString(thursday);

  const reportingDate = thursday;
  const weekNumber = computeWeekNumber(reportingDate);

  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('service_centre_id', serviceCentreId)
    .eq('week_number', weekNumber)
    .eq('year', reportingDate.getFullYear())
    .eq('report_type', 'friday')
    .maybeSingle();

  if (existing) return { triggered: false };

  const { stations, loggedIds } = await fetchStationsWithLogStatus(serviceCentreId, thursdayStr);
  if (stations.length === 0) return { triggered: false };

  const missingStations = stations.filter(s => !loggedIds.has(s.id));

  if (missingStations.length > 0) {
    return {
      triggered: false,
      missingLogs: {
        reportType: 'friday',
        reportLabel: `End of Week Report — Week ${weekNumber}, ${reportingDate.getFullYear()}`,
        checkDate: thursdayStr,
        checkDateLabel: new Date(thursdayStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }),
        totalStations: stations.length,
        loggedCount: loggedIds.size,
        missingStations,
      },
    };
  }

  const result = await generateAndSaveWeeklyReport(
    scope, serviceCentreId, serviceCentreName, weekNumber, reportingDate.getFullYear(), 'friday'
  );

  return { triggered: result !== null, reportType: result ? 'friday' : undefined };
}

async function tryGenerateTuesdayReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  today: Date
): Promise<WeeklyReportTriggerResult> {
  const dayOfWeek = today.getDay();
  const daysAfterTuesday = dayOfWeek >= 2 ? dayOfWeek - 2 : dayOfWeek + 5;
  const lastTuesday = new Date(today);
  lastTuesday.setDate(today.getDate() - daysAfterTuesday);

  const monday = new Date(lastTuesday);
  monday.setDate(lastTuesday.getDate() - 1);
  const mondayStr = toLocalDateString(monday);

  const weekNumber = computeWeekNumber(lastTuesday);
  const prevWeekNum = weekNumber > 1 ? weekNumber - 1 : 1;
  const prevWeekYear = weekNumber > 1 ? lastTuesday.getFullYear() : lastTuesday.getFullYear() - 1;

  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('service_centre_id', serviceCentreId)
    .eq('week_number', prevWeekNum)
    .eq('year', prevWeekYear)
    .eq('report_type', 'tuesday')
    .maybeSingle();

  if (existing) return { triggered: false };

  const { stations, loggedIds } = await fetchStationsWithLogStatus(serviceCentreId, mondayStr);
  if (stations.length === 0) return { triggered: false };

  const missingStations = stations.filter(s => !loggedIds.has(s.id));

  if (missingStations.length > 0) {
    return {
      triggered: false,
      missingLogs: {
        reportType: 'tuesday',
        reportLabel: `Mid-week Report — Week ${prevWeekNum}, ${prevWeekYear}`,
        checkDate: mondayStr,
        checkDateLabel: new Date(mondayStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }),
        totalStations: stations.length,
        loggedCount: loggedIds.size,
        missingStations,
      },
    };
  }

  const result = await generateAndSaveWeeklyReport(
    scope, serviceCentreId, serviceCentreName, prevWeekNum, prevWeekYear, 'tuesday'
  );

  return { triggered: result !== null, reportType: result ? 'tuesday' : undefined };
}
