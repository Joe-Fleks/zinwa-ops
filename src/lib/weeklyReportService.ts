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

export async function checkAndTriggerWeeklyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string
): Promise<{ triggered: boolean; reportType?: string }> {
  const today = new Date();
  const dayOfWeek = today.getDay();

  const isFriday = dayOfWeek === 5;
  const isTuesday = dayOfWeek === 2;

  if (!isFriday && !isTuesday) return { triggered: false };

  if (isFriday) {
    const result = await tryGenerateFridayReport(scope, serviceCentreId, serviceCentreName, today);
    if (result) return { triggered: true, reportType: 'friday' };
  }

  if (isTuesday) {
    const result = await tryGenerateTuesdayReport(scope, serviceCentreId, serviceCentreName, today);
    if (result) return { triggered: true, reportType: 'tuesday' };
  }

  return { triggered: false };
}

async function tryGenerateFridayReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  today: Date
): Promise<boolean> {
  const thursday = new Date(today);
  thursday.setDate(today.getDate() - 1);
  const thursdayStr = thursday.toISOString().split('T')[0];

  const stationsRes = await supabase
    .from('stations')
    .select('id')
    .eq('service_centre_id', serviceCentreId);

  if (stationsRes.error || !stationsRes.data?.length) return false;

  const stationIds = stationsRes.data.map(s => s.id);
  const { count } = await supabase
    .from('production_logs')
    .select('id', { count: 'exact', head: true })
    .in('station_id', stationIds)
    .eq('date', thursdayStr);

  if (!count || count < stationIds.length) return false;

  const reportingDate = thursday;
  const daysFromFriday = (reportingDate.getDay() + 2) % 7;
  const currentWeekStart = new Date(reportingDate);
  currentWeekStart.setDate(reportingDate.getDate() - daysFromFriday);

  const firstFridayOfYear = new Date(reportingDate.getFullYear(), 0, 1, 12, 0, 0);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);
  const daysDifference = Math.floor((currentWeekStart.getTime() - firstFridayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.floor(daysDifference / 7) + 1);

  const result = await generateAndSaveWeeklyReport(
    scope, serviceCentreId, serviceCentreName, weekNumber, reportingDate.getFullYear(), 'friday'
  );

  return result !== null;
}

async function tryGenerateTuesdayReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  today: Date
): Promise<boolean> {
  const monday = new Date(today);
  monday.setDate(today.getDate() - 1);
  const mondayStr = monday.toISOString().split('T')[0];

  const stationsRes = await supabase
    .from('stations')
    .select('id')
    .eq('service_centre_id', serviceCentreId);

  if (stationsRes.error || !stationsRes.data?.length) return false;

  const stationIds = stationsRes.data.map(s => s.id);
  const { count } = await supabase
    .from('production_logs')
    .select('id', { count: 'exact', head: true })
    .in('station_id', stationIds)
    .eq('date', mondayStr);

  if (!count || count < stationIds.length) return false;

  const daysFromFriday = (today.getDay() + 2) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - daysFromFriday);

  const firstFridayOfYear = new Date(today.getFullYear(), 0, 1, 12, 0, 0);
  const firstDayOfWeek = firstFridayOfYear.getDay();
  const daysToFirstFriday = firstDayOfWeek <= 5 ? 5 - firstDayOfWeek : 12 - firstDayOfWeek;
  firstFridayOfYear.setDate(firstFridayOfYear.getDate() + daysToFirstFriday);
  const daysDifference = Math.floor((currentWeekStart.getTime() - firstFridayOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.max(1, Math.floor(daysDifference / 7) + 1);

  const prevWeekNum = weekNumber > 1 ? weekNumber - 1 : 1;
  const prevWeekYear = weekNumber > 1 ? today.getFullYear() : today.getFullYear() - 1;

  const result = await generateAndSaveWeeklyReport(
    scope, serviceCentreId, serviceCentreName, prevWeekNum, prevWeekYear, 'tuesday'
  );

  return result !== null;
}
