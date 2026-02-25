import { supabase } from './supabase';
import { fetchMonthlyReportData, type MonthlyReportData } from './metrics/monthlyReportMetrics';
import type { ScopeFilter } from './metricsConfig';

export interface MonthlyReportRecord {
  id: string;
  service_centre_id: string;
  month: number;
  year: number;
  report_data: MonthlyReportData;
  status: 'ready' | 'downloaded';
  generated_at: string;
  downloaded_at: string | null;
}

export async function fetchPendingMonthlyReports(
  serviceCentreId: string
): Promise<MonthlyReportRecord[]> {
  const { data, error } = await supabase
    .from('monthly_reports')
    .select('id, service_centre_id, month, year, report_data, status, generated_at, downloaded_at')
    .eq('service_centre_id', serviceCentreId)
    .eq('status', 'ready')
    .order('generated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as MonthlyReportRecord[];
}

export async function markMonthlyReportDownloaded(
  reportId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('monthly_reports')
    .update({
      status: 'downloaded',
      downloaded_at: new Date().toISOString(),
      downloaded_by: userId,
    })
    .eq('id', reportId);

  if (error) throw error;
}

export async function generateAndSaveMonthlyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  year: number,
  month: number
): Promise<MonthlyReportRecord | null> {
  const { data: existing } = await supabase
    .from('monthly_reports')
    .select('id, status')
    .eq('service_centre_id', serviceCentreId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle();

  if (existing) return null;

  const reportData = await fetchMonthlyReportData(scope, year, month, serviceCentreName);

  const { data, error } = await supabase
    .from('monthly_reports')
    .insert({
      service_centre_id: serviceCentreId,
      month,
      year,
      report_data: reportData,
      status: 'ready',
    })
    .select('id, service_centre_id, month, year, report_data, status, generated_at, downloaded_at')
    .single();

  if (error) throw error;
  return data as MonthlyReportRecord;
}

export async function refreshMonthlyReportData(
  scope: ScopeFilter,
  reportId: string,
  serviceCentreName: string,
  year: number,
  month: number
): Promise<MonthlyReportData> {
  const reportData = await fetchMonthlyReportData(scope, year, month, serviceCentreName);

  const { error } = await supabase
    .from('monthly_reports')
    .update({ report_data: reportData, generated_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) throw error;
  return reportData;
}

export async function checkAndTriggerMonthlyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string
): Promise<{ triggered: boolean; month?: number; year?: number }> {
  const today = new Date();
  const currentDay = today.getDate();

  if (currentDay < 2) return { triggered: false };

  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonth = prevMonthDate.getMonth() + 1;
  const prevYear = prevMonthDate.getFullYear();

  const { data: existing } = await supabase
    .from('monthly_reports')
    .select('id')
    .eq('service_centre_id', serviceCentreId)
    .eq('month', prevMonth)
    .eq('year', prevYear)
    .maybeSingle();

  if (existing) return { triggered: false };

  const stationsRes = await supabase
    .from('stations')
    .select('id')
    .eq('service_centre_id', serviceCentreId);

  if (stationsRes.error || !stationsRes.data?.length) return { triggered: false };

  const stationIds = stationsRes.data.map(s => s.id);
  const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  const expectedLogs = stationIds.length * daysInPrevMonth;

  const { count } = await supabase
    .from('production_logs')
    .select('id', { count: 'exact', head: true })
    .in('station_id', stationIds)
    .gte('date', `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`)
    .lte('date', `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(daysInPrevMonth).padStart(2, '0')}`);

  const coveragePct = expectedLogs > 0 ? ((count || 0) / expectedLogs) * 100 : 0;
  if (coveragePct < 100) return { triggered: false };

  const result = await generateAndSaveMonthlyReport(
    scope, serviceCentreId, serviceCentreName, prevYear, prevMonth
  );

  return result ? { triggered: true, month: prevMonth, year: prevYear } : { triggered: false };
}
