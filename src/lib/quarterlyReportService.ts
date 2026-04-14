import { supabase } from './supabase';
import { fetchQuarterlyReportData, type QuarterlyReportData, getQuarterMonths } from './metrics/quarterlyReportMetrics';
import type { ScopeFilter } from './metricsConfig';

export interface QuarterlyReportRecord {
  id: string;
  service_centre_id: string;
  quarter: number;
  year: number;
  report_data: QuarterlyReportData;
  status: 'ready' | 'downloaded';
  generated_at: string;
  downloaded_at: string | null;
}

export async function fetchPendingQuarterlyReports(
  serviceCentreId: string
): Promise<QuarterlyReportRecord[]> {
  const { data, error } = await supabase
    .from('quarterly_reports')
    .select('id, service_centre_id, quarter, year, report_data, status, generated_at, downloaded_at')
    .eq('service_centre_id', serviceCentreId)
    .eq('status', 'ready')
    .order('generated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as QuarterlyReportRecord[];
}

export async function fetchAllQuarterlyReports(
  serviceCentreId: string
): Promise<QuarterlyReportRecord[]> {
  const { data, error } = await supabase
    .from('quarterly_reports')
    .select('id, service_centre_id, quarter, year, report_data, status, generated_at, downloaded_at')
    .eq('service_centre_id', serviceCentreId)
    .order('generated_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data || []) as QuarterlyReportRecord[];
}

export async function markQuarterlyReportDownloaded(
  reportId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('quarterly_reports')
    .update({
      status: 'downloaded',
      downloaded_at: new Date().toISOString(),
      downloaded_by: userId,
    })
    .eq('id', reportId);

  if (error) throw error;
}

export async function generateAndSaveQuarterlyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string,
  year: number,
  quarter: number
): Promise<QuarterlyReportRecord | null> {
  const { data: existing } = await supabase
    .from('quarterly_reports')
    .select('id, status')
    .eq('service_centre_id', serviceCentreId)
    .eq('quarter', quarter)
    .eq('year', year)
    .maybeSingle();

  if (existing) return null;

  const reportData = await fetchQuarterlyReportData(scope, year, quarter, serviceCentreName);

  const { data, error } = await supabase
    .from('quarterly_reports')
    .insert({
      service_centre_id: serviceCentreId,
      quarter,
      year,
      report_data: reportData,
      status: 'ready',
    })
    .select('id, service_centre_id, quarter, year, report_data, status, generated_at, downloaded_at')
    .single();

  if (error) throw error;
  return data as QuarterlyReportRecord;
}

export async function refreshQuarterlyReportData(
  scope: ScopeFilter,
  reportId: string,
  serviceCentreName: string,
  year: number,
  quarter: number
): Promise<QuarterlyReportData> {
  const reportData = await fetchQuarterlyReportData(scope, year, quarter, serviceCentreName);

  const { error } = await supabase
    .from('quarterly_reports')
    .update({ report_data: reportData, generated_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) throw error;
  return reportData;
}

function getMostRecentCompletedQuarter(today: Date): { quarter: number; year: number } | null {
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  if (currentMonth >= 4) {
    return { quarter: Math.floor((currentMonth - 1) / 3), year: currentYear };
  }
  return { quarter: 4, year: currentYear - 1 };
}

export async function checkAndTriggerQuarterlyReport(
  scope: ScopeFilter,
  serviceCentreId: string,
  serviceCentreName: string
): Promise<{ triggered: boolean; quarter?: number; year?: number }> {
  const today = new Date();
  const result = getMostRecentCompletedQuarter(today);
  if (!result) return { triggered: false };

  const { quarter: prevQuarter, year: prevYear } = result;

  const { data: existing } = await supabase
    .from('quarterly_reports')
    .select('id')
    .eq('service_centre_id', serviceCentreId)
    .eq('quarter', prevQuarter)
    .eq('year', prevYear)
    .maybeSingle();

  if (existing) return { triggered: false };

  const stationsRes = await supabase
    .from('stations')
    .select('id')
    .eq('service_centre_id', serviceCentreId);

  if (stationsRes.error || !stationsRes.data?.length) return { triggered: false };

  const stationIds = stationsRes.data.map(s => s.id);
  const months = getQuarterMonths(prevQuarter);

  let totalExpected = 0;
  let totalCount = 0;

  for (const month of months) {
    const daysInMonth = new Date(prevYear, month, 0).getDate();
    totalExpected += stationIds.length * daysInMonth;

    const { count } = await supabase
      .from('production_logs')
      .select('id', { count: 'exact', head: true })
      .in('station_id', stationIds)
      .gte('date', `${prevYear}-${String(month).padStart(2, '0')}-01`)
      .lte('date', `${prevYear}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`);

    totalCount += count || 0;
  }

  const coveragePct = totalExpected > 0 ? (totalCount / totalExpected) * 100 : 0;
  if (coveragePct < 50) return { triggered: false };

  const generated = await generateAndSaveQuarterlyReport(
    scope, serviceCentreId, serviceCentreName, prevYear, prevQuarter
  );

  return generated ? { triggered: true, quarter: prevQuarter, year: prevYear } : { triggered: false };
}
