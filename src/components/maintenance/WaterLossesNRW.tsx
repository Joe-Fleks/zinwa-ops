import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Pencil, X, Save, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  estimateFinancialLoss,
  getStationTotalClients,
  getPreviousMonth,
} from '../../lib/nrwCalculations';
import type { TariffBand, StationClients } from '../../lib/nrwCalculations';
import { THRESHOLDS } from '../../lib/metricsConfig';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const QUARTERS = [
  { label: 'Q1 (Jan-Mar)', months: [1, 2, 3] },
  { label: 'Q2 (Apr-Jun)', months: [4, 5, 6] },
  { label: 'Q3 (Jul-Sep)', months: [7, 8, 9] },
  { label: 'Q4 (Oct-Dec)', months: [10, 11, 12] },
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

interface StationData {
  id: string;
  station_name: string;
  station_type: string;
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
}

interface NRWRow {
  station_id: string;
  station_name: string;
  station_type: string;
  rw_volume: number;
  cw_volume: number;
  sales_volume: number;
  station_loss_vol: number;
  station_loss_pct: number;
  distribution_loss_vol: number;
  distribution_loss_pct: number;
  total_loss_vol: number;
  total_loss_pct: number;
  est_financial_loss: number;
  station_loss_comment: string;
  distribution_loss_comment: string;
  total_clients: number;
  commentId: string | null;
  commentModified: boolean;
}

interface TotalsComment {
  station_loss_comment: string;
  distribution_loss_comment: string;
  modified: boolean;
}

type FilterMode = 'month' | 'quarter' | 'year';

function abbreviateSCName(name: string): string {
  return name.replace(/Service\s+Cent(er|re)/gi, 'SC');
}

export default function WaterLossesNRW() {
  const { user, accessContext } = useAuth();

  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedQuarter, setSelectedQuarter] = useState(0);

  const [stations, setStations] = useState<StationData[]>([]);
  const [nrwRows, setNrwRows] = useState<NRWRow[]>([]);
  const [tariffBands, setTariffBands] = useState<TariffBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [totalsComment, setTotalsComment] = useState<TotalsComment>({
    station_loss_comment: '',
    distribution_loss_comment: '',
    modified: false,
  });

  const scName = abbreviateSCName(accessContext?.serviceCentre?.name || 'SC');

  const selectedMonths = useMemo(() => {
    if (filterMode === 'month') return [selectedMonth];
    if (filterMode === 'quarter') return QUARTERS[selectedQuarter].months;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [filterMode, selectedMonth, selectedQuarter]);

  useEffect(() => {
    loadStations();
    loadTariffs();
  }, [accessContext?.scopeId]);

  useEffect(() => {
    if (stations.length > 0 && tariffBands.length > 0) {
      loadNRWData();
    }
  }, [stations, tariffBands, selectedYear, selectedMonths]);

  const loadStations = async () => {
    try {
      let query = supabase
        .from('stations')
        .select('id, station_name, station_type, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other, service_centre_id')
        .order('station_name');

      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
  };

  const loadTariffs = async () => {
    try {
      const { data, error } = await supabase
        .from('tariffs')
        .select('band_min_m3, band_max_m3, tariff_usd_per_m3, sort_order, category')
        .eq('tariff_type', 'CW')
        .order('sort_order');

      if (error) throw error;
      setTariffBands(data || []);
    } catch (error) {
      console.error('Error fetching tariffs:', error);
    }
  };

  const loadNRWData = async () => {
    setLoading(true);
    try {
      const stationIds = stations.map(s => s.id);

      const prodMonthPairs: { year: number; month: number }[] = [];
      const salesMonthPairs: { year: number; month: number }[] = [];

      for (const m of selectedMonths) {
        const prev = getPreviousMonth(selectedYear, m);
        prodMonthPairs.push(prev);
        salesMonthPairs.push({ year: selectedYear, month: m });
      }

      const prodDateRanges = prodMonthPairs.map(p => {
        const startDate = `${p.year}-${String(p.month).padStart(2, '0')}-01`;
        const endDate = new Date(p.year, p.month, 0).toISOString().split('T')[0];
        return { startDate, endDate };
      });

      let allProdLogs: any[] = [];
      for (const range of prodDateRanges) {
        const { data, error } = await supabase
          .from('production_logs')
          .select('station_id, rw_volume_m3, cw_volume_m3')
          .in('station_id', stationIds)
          .gte('date', range.startDate)
          .lte('date', range.endDate);

        if (error) throw error;
        allProdLogs = allProdLogs.concat(data || []);
      }

      let allSalesRecords: any[] = [];
      for (const sp of salesMonthPairs) {
        const { data, error } = await supabase
          .from('sales_records')
          .select('station_id, returns_volume_m3, sage_sales_volume_m3')
          .in('station_id', stationIds)
          .eq('year', sp.year)
          .eq('month', sp.month);

        if (error) throw error;
        allSalesRecords = allSalesRecords.concat(data || []);
      }

      const { data: commentsData, error: commentsError } = await supabase
        .from('nrw_comments')
        .select('*')
        .in('station_id', stationIds)
        .eq('year', selectedYear)
        .in('month', selectedMonths);

      if (commentsError) throw commentsError;

      const { data: cwClientsData } = await supabase
        .from('cw_clients_monthly')
        .select('station_id, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other')
        .in('station_id', stationIds)
        .eq('year', selectedYear)
        .in('month', selectedMonths);

      const cwClientsMap = new Map<string, StationClients>();
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

      const scId = accessContext?.isSCScoped ? accessContext.scopeId : null;
      const totalsMonth = filterMode === 'month' ? selectedMonth : selectedMonths[0];
      let totalsQuery = supabase
        .from('nrw_totals_comments')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', totalsMonth);

      if (scId) {
        totalsQuery = totalsQuery.eq('service_centre_id', scId);
      } else {
        totalsQuery = totalsQuery.is('service_centre_id', null);
      }

      const { data: totalsCommentData } = await totalsQuery.maybeSingle();
      setTotalsComment({
        station_loss_comment: totalsCommentData?.station_loss_comment || '',
        distribution_loss_comment: totalsCommentData?.distribution_loss_comment || '',
        modified: false,
      });

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
        const existing = salesByStation.get(rec.station_id) || 0;
        salesByStation.set(rec.station_id, existing + salesVol);
      }

      const commentMap = new Map<string, any>();
      for (const c of (commentsData || [])) {
        const key = c.station_id;
        const existing = commentMap.get(key);
        if (!existing) {
          commentMap.set(key, c);
        }
      }

      const rows: NRWRow[] = stations.map(station => {
        const prod = prodByStation.get(station.id) || { rw: 0, cw: 0 };
        const salesVol = salesByStation.get(station.id) || 0;
        const monthlyClients = cwClientsMap.get(station.id);
        const monthlyTotal = monthlyClients ? getStationTotalClients(monthlyClients) : 0;
        const clientData: StationClients = (monthlyClients && monthlyTotal > 0) ? monthlyClients : station;
        const totalClients = getStationTotalClients(clientData);
        const isBorehole = station.station_type === 'Borehole';

        const stationLossVol = isBorehole ? 0 : Math.max(0, prod.rw - prod.cw);
        const stationLossPct = isBorehole ? 0 : (prod.rw > 0 ? (stationLossVol / prod.rw) * 100 : 0);

        const distLossVol = Math.max(0, prod.cw - salesVol);
        const distLossPct = prod.cw > 0 ? (distLossVol / prod.cw) * 100 : 0;

        const totalLossVol = isBorehole ? distLossVol : Math.max(0, prod.rw - salesVol);
        const totalLossPct = isBorehole
          ? (prod.cw > 0 ? (totalLossVol / prod.cw) * 100 : 0)
          : (prod.rw > 0 ? (totalLossVol / prod.rw) * 100 : 0);

        const estLoss = estimateFinancialLoss(totalLossVol, clientData, tariffBands);

        const comment = commentMap.get(station.id);

        return {
          station_id: station.id,
          station_name: station.station_name,
          station_type: station.station_type,
          rw_volume: prod.rw,
          cw_volume: prod.cw,
          sales_volume: salesVol,
          station_loss_vol: stationLossVol,
          station_loss_pct: stationLossPct,
          distribution_loss_vol: distLossVol,
          distribution_loss_pct: distLossPct,
          total_loss_vol: totalLossVol,
          total_loss_pct: totalLossPct,
          est_financial_loss: estLoss,
          station_loss_comment: comment?.station_loss_comment || '',
          distribution_loss_comment: comment?.distribution_loss_comment || '',
          total_clients: totalClients,
          commentId: comment?.id || null,
          commentModified: false,
        };
      });

      rows.sort((a, b) => b.est_financial_loss - a.est_financial_loss);

      setNrwRows(rows);
    } catch (error: any) {
      console.error('Error loading NRW data:', error);
      setMessage({ type: 'error', text: 'Failed to load water losses data' });
    } finally {
      setLoading(false);
    }
  };

  const handleCommentChange = (stationId: string, field: 'station_loss_comment' | 'distribution_loss_comment', value: string) => {
    setNrwRows(prev => prev.map(r =>
      r.station_id === stationId ? { ...r, [field]: value, commentModified: true } : r
    ));
  };

  const handleTotalsCommentChange = (field: 'station_loss_comment' | 'distribution_loss_comment', value: string) => {
    setTotalsComment(prev => ({ ...prev, [field]: value, modified: true }));
  };

  const handleSaveComments = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const modified = nrwRows.filter(r => r.commentModified);
      for (const row of modified) {
        const month = filterMode === 'month' ? selectedMonth : selectedMonths[0];
        const upsertData = {
          station_id: row.station_id,
          year: selectedYear,
          month,
          station_loss_comment: row.station_loss_comment,
          distribution_loss_comment: row.distribution_loss_comment,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('nrw_comments')
          .upsert(upsertData, { onConflict: 'station_id,year,month' });

        if (error) throw error;
      }

      if (totalsComment.modified) {
        const scId = accessContext?.isSCScoped ? accessContext.scopeId : null;
        const month = filterMode === 'month' ? selectedMonth : selectedMonths[0];
        const { error } = await supabase
          .from('nrw_totals_comments')
          .upsert({
            service_centre_id: scId,
            year: selectedYear,
            month,
            station_loss_comment: totalsComment.station_loss_comment,
            distribution_loss_comment: totalsComment.distribution_loss_comment,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'service_centre_id,year,month' });

        if (error) throw error;
      }

      const totalSaved = modified.length + (totalsComment.modified ? 1 : 0);
      setMessage({ type: 'success', text: `${totalSaved} comment(s) saved` });
      setEditing(false);
      await loadNRWData();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save comments' });
    } finally {
      setSaving(false);
    }
  };

  const fullTreatmentRows = useMemo(() => nrwRows.filter(r => r.station_type === 'Full Treatment'), [nrwRows]);
  const boreholeRows = useMemo(() => nrwRows.filter(r => r.station_type === 'Borehole'), [nrwRows]);

  const combinedTotal = useMemo(() => {
    const totalRW = nrwRows.reduce((s, r) => s + r.rw_volume, 0);
    const totalCW = nrwRows.reduce((s, r) => s + r.cw_volume, 0);

    const stationLossVol = nrwRows.reduce((s, r) => s + r.station_loss_vol, 0);
    const stationLossPct = totalRW > 0 ? (stationLossVol / totalRW) * 100 : 0;

    const distLossVol = nrwRows.reduce((s, r) => s + r.distribution_loss_vol, 0);
    const distLossPct = totalCW > 0 ? (distLossVol / totalCW) * 100 : 0;

    const totalLossVol = nrwRows.reduce((s, r) => s + r.total_loss_vol, 0);
    const surfaceRWVol = nrwRows.filter(r => r.station_type !== 'Borehole').reduce((s, r) => s + r.rw_volume, 0);
    const boreholeCWVol = nrwRows.filter(r => r.station_type === 'Borehole').reduce((s, r) => s + r.cw_volume, 0);
    const nrwDenominator = surfaceRWVol + boreholeCWVol;
    const totalLossPct = nrwDenominator > 0 ? (totalLossVol / nrwDenominator) * 100 : 0;

    const totalFinLoss = nrwRows.reduce((s, r) => s + r.est_financial_loss, 0);

    return { stationLossVol, stationLossPct, distLossVol, distLossPct, totalLossVol, totalLossPct, totalFinLoss };
  }, [nrwRows]);

  const periodLabel = useMemo(() => {
    if (filterMode === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
    if (filterMode === 'quarter') return `${QUARTERS[selectedQuarter].label} ${selectedYear}`;
    return `${selectedYear}`;
  }, [filterMode, selectedMonth, selectedQuarter, selectedYear]);

  const hasModifiedComments = nrwRows.some(r => r.commentModified) || totalsComment.modified;

  if (loading && stations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading water losses data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-lg font-bold text-gray-900">Non-Revenue Water Losses</p>
        <p className="text-sm text-gray-600 mt-1">
          Station losses = RW - CW volumes. Distribution losses = CW - Sales (with billing lag). Sorted by estimated financial loss.
        </p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value as FilterMode)}
            disabled={editing}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="year">Annual</option>
          </select>

          {filterMode === 'month' && (
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              disabled={editing}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {MONTHS.map((m, idx) => (
                <option key={idx} value={idx + 1}>{m}</option>
              ))}
            </select>
          )}

          {filterMode === 'quarter' && (
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value))}
              disabled={editing}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              {QUARTERS.map((q, idx) => (
                <option key={idx} value={idx}>{q.label}</option>
              ))}
            </select>
          )}

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            disabled={editing}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {editing && <span className="text-xs text-gray-500 italic">Filters locked while editing</span>}
        </div>

        <div className="flex items-center gap-2">
          {!editing ? (
            <button
              onClick={() => { setEditing(true); setMessage(null); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-300 text-blue-900 rounded-lg text-sm font-medium hover:bg-blue-400 transition-colors disabled:opacity-50"
            >
              <Pencil className="w-4 h-4" />
              Edit Comments
            </button>
          ) : (
            <>
              <button
                onClick={() => { setEditing(false); loadNRWData(); setMessage(null); }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveComments}
                disabled={saving || !hasModifiedComments}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-300 text-blue-900 rounded-lg text-sm font-medium hover:bg-blue-400 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading water losses data...</p>
        </div>
      ) : (
        <>
          {fullTreatmentRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Full Treatment Stations</p>
              <NRWTable
                rows={fullTreatmentRows}
                showStationLoss
                editing={editing}
                onCommentChange={handleCommentChange}
              />
            </div>
          )}

          {boreholeRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Borehole Stations</p>
              <NRWTable
                rows={boreholeRows}
                showStationLoss={false}
                editing={editing}
                onCommentChange={handleCommentChange}
              />
            </div>
          )}

          {nrwRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">{scName} Total</p>
              <CombinedTotalsTable
                totals={combinedTotal}
                totalsComment={totalsComment}
                editing={editing}
                onTotalsCommentChange={handleTotalsCommentChange}
              />
            </div>
          )}

          {fullTreatmentRows.length === 0 && boreholeRows.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
              <p className="text-sm text-gray-500">No station data found for the selected period</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface NRWTableProps {
  rows: NRWRow[];
  showStationLoss: boolean;
  editing: boolean;
  onCommentChange: (stationId: string, field: 'station_loss_comment' | 'distribution_loss_comment', value: string) => void;
}

function NRWTable({ rows, showStationLoss, editing, onCommentChange }: NRWTableProps) {
  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const fmtPct = (v: number) => v.toFixed(1) + '%';
  const fmtUsd = (v: number) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pctBadge = (v: number) => {
    let cls = 'bg-green-100 text-green-800';
    if (v >= THRESHOLDS.NRW_HIGH_LOSS_PCT) cls = 'bg-red-100 text-red-800';
    else if (v >= THRESHOLDS.NRW_MODERATE_LOSS_PCT) cls = 'bg-amber-100 text-amber-800';
    return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{fmtPct(v)}</span>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">
              Station
            </th>
            {showStationLoss && (
              <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-red-50">
                Station Losses
              </th>
            )}
            <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-amber-50">
              Distribution Losses
            </th>
            <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 bg-blue-50">
              Total Losses
            </th>
          </tr>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            {showStationLoss && (
              <>
                <th className="px-3 py-1.5 text-right whitespace-nowrap bg-red-50">Vol (m&#179;)</th>
                <th className="px-3 py-1.5 text-right whitespace-nowrap bg-red-50">%</th>
                <th className="px-3 py-1.5 text-left whitespace-nowrap border-r border-gray-200 bg-red-50 min-w-[120px]">Comment</th>
              </>
            )}
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-amber-50">Vol (m&#179;)</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-amber-50">%</th>
            <th className="px-3 py-1.5 text-left whitespace-nowrap border-r border-gray-200 bg-amber-50 min-w-[120px]">Comment</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50">Vol (m&#179;)</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50">%</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50 min-w-[140px]">Est. Financial Loss (US$)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(row => (
            <tr key={row.station_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap border-r border-gray-100 sticky left-0 bg-white z-10">
                {row.station_name}
              </td>
              {showStationLoss && (
                <>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(row.station_loss_vol)}</td>
                  <td className="px-3 py-2 text-right">{pctBadge(row.station_loss_pct)}</td>
                  <td className="px-3 py-2 border-r border-gray-100">
                    {editing ? (
                      <input
                        type="text"
                        value={row.station_loss_comment}
                        onChange={e => onCommentChange(row.station_id, 'station_loss_comment', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Add comment..."
                      />
                    ) : (
                      <span className="text-xs text-gray-500">{row.station_loss_comment || '-'}</span>
                    )}
                  </td>
                </>
              )}
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(row.distribution_loss_vol)}</td>
              <td className="px-3 py-2 text-right">{pctBadge(row.distribution_loss_pct)}</td>
              <td className="px-3 py-2 border-r border-gray-100">
                {editing ? (
                  <input
                    type="text"
                    value={row.distribution_loss_comment}
                    onChange={e => onCommentChange(row.station_id, 'distribution_loss_comment', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add comment..."
                  />
                ) : (
                  <span className="text-xs text-gray-500">{row.distribution_loss_comment || '-'}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(row.total_loss_vol)}</td>
              <td className="px-3 py-2 text-right">{pctBadge(row.total_loss_pct)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{fmtUsd(row.est_financial_loss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CombinedTotalsTableProps {
  totals: {
    stationLossVol: number;
    stationLossPct: number;
    distLossVol: number;
    distLossPct: number;
    totalLossVol: number;
    totalLossPct: number;
    totalFinLoss: number;
  };
  totalsComment: TotalsComment;
  editing: boolean;
  onTotalsCommentChange: (field: 'station_loss_comment' | 'distribution_loss_comment', value: string) => void;
}

function CombinedTotalsTable({ totals, totalsComment, editing, onTotalsCommentChange }: CombinedTotalsTableProps) {
  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  const fmtPct = (v: number) => v.toFixed(1) + '%';
  const fmtUsd = (v: number) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const pctBadge = (v: number) => {
    let cls = 'bg-green-100 text-green-800';
    if (v >= THRESHOLDS.NRW_HIGH_LOSS_PCT) cls = 'bg-red-100 text-red-800';
    else if (v >= THRESHOLDS.NRW_MODERATE_LOSS_PCT) cls = 'bg-amber-100 text-amber-800';
    return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{fmtPct(v)}</span>;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th rowSpan={2} className="px-3 py-2 text-left font-semibold text-gray-700 border-r border-gray-200 whitespace-nowrap sticky left-0 bg-gray-50 z-10 min-w-[160px]">
              &nbsp;
            </th>
            <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-red-50">
              Station Losses
            </th>
            <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-amber-50">
              Distribution Losses
            </th>
            <th colSpan={3} className="px-3 py-1.5 text-center font-semibold text-gray-700 bg-blue-50">
              Total Losses
            </th>
          </tr>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-red-50">Vol (m&#179;)</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-red-50">%</th>
            <th className="px-3 py-1.5 text-left whitespace-nowrap border-r border-gray-200 bg-red-50 min-w-[120px]">Comment</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-amber-50">Vol (m&#179;)</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-amber-50">%</th>
            <th className="px-3 py-1.5 text-left whitespace-nowrap border-r border-gray-200 bg-amber-50 min-w-[120px]">Comment</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50">Vol (m&#179;)</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50">%</th>
            <th className="px-3 py-1.5 text-right whitespace-nowrap bg-blue-50 min-w-[140px]">Est. Financial Loss (US$)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-blue-50 font-bold border-t-2 border-blue-300">
            <td className="px-3 py-2.5 text-gray-900 whitespace-nowrap border-r border-blue-200 sticky left-0 bg-blue-50 z-10">
              Combined Total
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmt(totals.stationLossVol)}</td>
            <td className="px-3 py-2.5 text-right">{pctBadge(totals.stationLossPct)}</td>
            <td className="px-3 py-2.5 border-r border-blue-200">
              {editing ? (
                <input
                  type="text"
                  value={totalsComment.station_loss_comment}
                  onChange={e => onTotalsCommentChange('station_loss_comment', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Add comment..."
                />
              ) : (
                <span className="text-xs text-gray-600">{totalsComment.station_loss_comment || '-'}</span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmt(totals.distLossVol)}</td>
            <td className="px-3 py-2.5 text-right">{pctBadge(totals.distLossPct)}</td>
            <td className="px-3 py-2.5 border-r border-blue-200">
              {editing ? (
                <input
                  type="text"
                  value={totalsComment.distribution_loss_comment}
                  onChange={e => onTotalsCommentChange('distribution_loss_comment', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Add comment..."
                />
              ) : (
                <span className="text-xs text-gray-600">{totalsComment.distribution_loss_comment || '-'}</span>
              )}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmt(totals.totalLossVol)}</td>
            <td className="px-3 py-2.5 text-right">{pctBadge(totals.totalLossPct)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmtUsd(totals.totalFinLoss)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
