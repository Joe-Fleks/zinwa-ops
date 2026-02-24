import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const CW_CATEGORIES = ['Domestic', 'School', 'Business', 'Industry', 'Church', 'Parastatal', 'Government', 'Local Government'] as const;
const RW_CATEGORIES = ['A1', 'A2', 'Mine', 'Industry', 'Institution', 'Local Authority'] as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - i);

interface CWRow {
  station_id: string;
  station_name: string;
  clients_domestic: number;
  clients_school: number;
  clients_business: number;
  clients_industry: number;
  clients_church: number;
  clients_parastatal: number;
  clients_government: number;
  clients_other: number;
  total: number;
}

interface RWRow {
  dam_name: string;
  a1: number;
  a2: number;
  mine: number;
  industry: number;
  institution: number;
  local_authority: number;
  total: number;
}

interface ClientsTabProps {
  clientType: 'CW' | 'RW';
}

export default function ClientsTab({ clientType }: ClientsTabProps) {
  const { accessContext } = useAuth();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [cwRows, setCwRows] = useState<CWRow[]>([]);
  const [rwRows, setRwRows] = useState<RWRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<AgGridReact>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (clientType === 'CW') {
        await loadCWClients();
      } else {
        await loadRWClients();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load client data');
    } finally {
      setLoading(false);
    }
  }, [clientType, selectedYear, selectedMonth, accessContext?.scopeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadCWClients = async () => {
    let stationsQuery = supabase
      .from('stations')
      .select('id, station_name, clients_domestic, clients_school, clients_business, clients_industry, clients_church, clients_parastatal, clients_government, clients_other')
      .order('station_name');

    if (accessContext?.isSCScoped && accessContext?.scopeId) {
      stationsQuery = stationsQuery.eq('service_centre_id', accessContext.scopeId);
    }

    const { data: stations, error: stErr } = await stationsQuery;
    if (stErr) throw stErr;
    if (!stations || stations.length === 0) {
      setCwRows([]);
      return;
    }

    const rows: CWRow[] = stations.map(s => {
      const domestic   = s.clients_domestic   || 0;
      const school     = s.clients_school     || 0;
      const business   = s.clients_business   || 0;
      const industry   = s.clients_industry   || 0;
      const church     = s.clients_church     || 0;
      const parastatal = s.clients_parastatal || 0;
      const government = s.clients_government || 0;
      const other      = s.clients_other      || 0;

      return {
        station_id: s.id,
        station_name: s.station_name,
        clients_domestic: domestic,
        clients_school: school,
        clients_business: business,
        clients_industry: industry,
        clients_church: church,
        clients_parastatal: parastatal,
        clients_government: government,
        clients_other: other,
        total: domestic + school + business + industry + church + parastatal + government + other,
      };
    });

    setCwRows(rows);
  };

  const loadRWClients = async () => {
    let damsQuery = supabase
      .from('dams')
      .select('name')
      .order('name');

    if (accessContext?.isSCScoped && accessContext?.scopeId) {
      damsQuery = damsQuery.eq('service_centre_id', accessContext.scopeId);
    }

    const { data: dams, error: dErr } = await damsQuery;
    if (dErr) throw dErr;
    if (!dams || dams.length === 0) {
      setRwRows([]);
      return;
    }

    const damNames = dams.map(d => d.name);

    const selectedDate = new Date(selectedYear, selectedMonth - 1, 15);

    let allocQuery = supabase
      .from('rw_allocations')
      .select('source, category, user_id, agreement_start_date, agreement_expiry_date');

    if (accessContext?.isSCScoped && accessContext?.scopeId) {
      allocQuery = allocQuery.eq('service_centre_id', accessContext.scopeId);
    }

    const { data: allocs, error: aErr } = await allocQuery;
    if (aErr) throw aErr;

    const damCounts = new Map<string, Record<string, number>>();
    for (const name of damNames) {
      damCounts.set(name, { a1: 0, a2: 0, mine: 0, industry: 0, institution: 0, local_authority: 0 });
    }

    for (const a of (allocs || [])) {
      const source = a.source?.trim();
      if (!source || !damNames.includes(source)) continue;

      if (a.agreement_start_date && a.agreement_expiry_date) {
        const start = new Date(a.agreement_start_date);
        const end = new Date(a.agreement_expiry_date);
        if (selectedDate < start || selectedDate > end) continue;
      }

      const counts = damCounts.get(source)!;
      const catKey = mapRWCategory(a.category || '');
      if (catKey) {
        counts[catKey] = (counts[catKey] || 0) + 1;
      }
    }

    const rows: RWRow[] = damNames.map(name => {
      const c = damCounts.get(name)!;
      return {
        dam_name: name,
        a1: c.a1,
        a2: c.a2,
        mine: c.mine,
        industry: c.industry,
        institution: c.institution,
        local_authority: c.local_authority,
        total: c.a1 + c.a2 + c.mine + c.industry + c.institution + c.local_authority,
      };
    });

    setRwRows(rows);
  };

  const cwColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'Station', field: 'station_name', pinned: 'left', minWidth: 200, flex: 1 },
    ...CW_CATEGORIES.map(cat => ({
      headerName: cat,
      field: cat === 'Local Government' ? 'clients_other' : `clients_${cat.toLowerCase()}`,
      type: 'numericColumn' as const,
      width: 110,
      valueFormatter: (p: any) => (p.value || 0).toLocaleString(),
    })),
    {
      headerName: 'Total',
      field: 'total',
      type: 'numericColumn',
      width: 110,
      cellClass: 'font-bold',
      valueFormatter: (p: any) => (p.value || 0).toLocaleString(),
    },
  ], []);

  const rwColumnDefs = useMemo<ColDef[]>(() => [
    { headerName: 'Dam', field: 'dam_name', pinned: 'left', minWidth: 200, flex: 1 },
    ...RW_CATEGORIES.map(cat => ({
      headerName: cat,
      field: mapRWCategory(cat),
      type: 'numericColumn' as const,
      width: 130,
      valueFormatter: (p: any) => (p.value || 0).toLocaleString(),
    })),
    {
      headerName: 'Total',
      field: 'total',
      type: 'numericColumn',
      width: 110,
      cellClass: 'font-bold',
      valueFormatter: (p: any) => (p.value || 0).toLocaleString(),
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    filter: true,
    resizable: true,
    suppressMovable: true,
  }), []);

  const cwTotalsRow = useMemo(() => {
    if (cwRows.length === 0) return null;
    return {
      station_name: 'TOTAL',
      clients_domestic: cwRows.reduce((s, r) => s + r.clients_domestic, 0),
      clients_school: cwRows.reduce((s, r) => s + r.clients_school, 0),
      clients_business: cwRows.reduce((s, r) => s + r.clients_business, 0),
      clients_industry: cwRows.reduce((s, r) => s + r.clients_industry, 0),
      clients_church: cwRows.reduce((s, r) => s + r.clients_church, 0),
      clients_parastatal: cwRows.reduce((s, r) => s + r.clients_parastatal, 0),
      clients_government: cwRows.reduce((s, r) => s + r.clients_government, 0),
      clients_other: cwRows.reduce((s, r) => s + r.clients_other, 0),
      total: cwRows.reduce((s, r) => s + r.total, 0),
    };
  }, [cwRows]);

  const rwTotalsRow = useMemo(() => {
    if (rwRows.length === 0) return null;
    return {
      dam_name: 'TOTAL',
      a1: rwRows.reduce((s, r) => s + r.a1, 0),
      a2: rwRows.reduce((s, r) => s + r.a2, 0),
      mine: rwRows.reduce((s, r) => s + r.mine, 0),
      industry: rwRows.reduce((s, r) => s + r.industry, 0),
      institution: rwRows.reduce((s, r) => s + r.institution, 0),
      local_authority: rwRows.reduce((s, r) => s + r.local_authority, 0),
      total: rwRows.reduce((s, r) => s + r.total, 0),
    };
  }, [rwRows]);

  const pinnedBottomCW = useMemo(() => cwTotalsRow ? [cwTotalsRow] : [], [cwTotalsRow]);
  const pinnedBottomRW = useMemo(() => rwTotalsRow ? [rwTotalsRow] : [], [rwTotalsRow]);

  const typeLabel = clientType === 'CW' ? 'Clear Water' : 'Raw Water';
  const rowData = clientType === 'CW' ? cwRows : rwRows;
  const columnDefs = clientType === 'CW' ? cwColumnDefs : rwColumnDefs;
  const pinnedBottom = clientType === 'CW' ? pinnedBottomCW : pinnedBottomRW;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {MONTHS.map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

        </div>

        <p className="text-sm text-gray-500">
          {typeLabel} client count for {MONTHS[selectedMonth - 1]} {selectedYear}
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg flex items-center gap-2 text-sm bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading {typeLabel.toLowerCase()} clients...</p>
        </div>
      ) : rowData.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <p className="text-sm text-gray-500">No {typeLabel.toLowerCase()} client data found for this period</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              domLayout="autoHeight"
              pinnedBottomRowData={pinnedBottom}
              suppressMovableColumns
              animateRows={false}
              getRowStyle={(params) => {
                if (params.node.rowPinned) {
                  return { fontWeight: '700', backgroundColor: '#EFF6FF', borderTop: '2px solid #93C5FD' };
                }
                return undefined;
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function mapCategoryToField(category: string): string | null {
  const lower = (category || '').trim().toLowerCase();
  if (lower.includes('domestic')) return 'clients_domestic';
  if (lower.includes('school')) return 'clients_school';
  if (lower.includes('business')) return 'clients_business';
  if (lower.includes('industry') || lower.includes('industrial')) return 'clients_industry';
  if (lower.includes('church')) return 'clients_church';
  if (lower.includes('parastatal')) return 'clients_parastatal';
  if (lower.includes('local') && lower.includes('government')) return 'clients_other';
  if (lower.includes('government') || lower.includes('govt')) return 'clients_government';
  if (lower.includes('other')) return 'clients_other';
  if (lower) return 'clients_other';
  return null;
}

function mapRWCategory(category: string): string {
  const lower = (category || '').trim().toLowerCase();
  if (lower === 'a1') return 'a1';
  if (lower === 'a2') return 'a2';
  if (lower === 'mine') return 'mine';
  if (lower === 'industry') return 'industry';
  if (lower === 'institution') return 'institution';
  if (lower === 'local authority') return 'local_authority';
  return 'a1';
}
