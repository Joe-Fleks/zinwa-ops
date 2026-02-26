import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Save, X, Pencil, Trash2, Loader2, AlertTriangle, Filter } from 'lucide-react';

interface Station { id: string; station_name: string; service_centre_id: string; }

interface TreatmentRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string;
  component_type: string;
  component_name: string;
  filter_type: string;
  filter_count: number;
  filter_length_m: number;
  filter_width_m: number;
  filter_depth_m: number;
  media_type: string;
  media_depth_m: number;
  estimated_media_qty_tonnes: number;
  last_resanding_date: string;
  resanding_interval_months: number;
  next_resanding_date: string;
  sedimentation_tank_count: number;
  sedimentation_length_m: number;
  sedimentation_width_m: number;
  sedimentation_depth_m: number;
  clarifier_type: string;
  clarifier_count: number;
  clarifier_diameter_m: number;
  chemical_house_capacity: string;
  condition: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

const COMPONENT_TYPES = ['Filter', 'Sedimentation', 'Clarifier', 'Chemical House', 'Other'];
const FILTER_TYPES = ['Rapid Gravity', 'Slow Sand', 'Pressure', 'Multi-Media'];
const MEDIA_TYPES = ['Sand', 'Anthracite', 'Gravel', 'GAC', 'Multi-Media'];
const CONDITIONS = ['Good', 'Fair', 'Poor', 'Needs Resanding', 'Decommissioned'];
const CLARIFIER_TYPES = ['Conventional', 'Tube Settler', 'Lamella', 'Solids Contact', 'DAF'];

function createEmpty(scId: string): TreatmentRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: scId,
    component_type: 'Filter', component_name: '', filter_type: '', filter_count: 0,
    filter_length_m: 0, filter_width_m: 0, filter_depth_m: 0,
    media_type: 'Sand', media_depth_m: 0, estimated_media_qty_tonnes: 0,
    last_resanding_date: '', resanding_interval_months: 60, next_resanding_date: '',
    sedimentation_tank_count: 0, sedimentation_length_m: 0, sedimentation_width_m: 0, sedimentation_depth_m: 0,
    clarifier_type: '', clarifier_count: 0, clarifier_diameter_m: 0,
    chemical_house_capacity: '', condition: 'Good', notes: '',
    _isNew: true, _isDirty: true,
  };
}

function computeNextResanding(lastDate: string, intervalMonths: number): string {
  if (!lastDate || !intervalMonths) return '';
  const d = new Date(lastDate + 'T12:00:00');
  d.setMonth(d.getMonth() + intervalMonths);
  return d.toISOString().split('T')[0];
}

function computeMediaQty(count: number, length: number, width: number, depth: number): number {
  if (!count || !length || !width || !depth) return 0;
  const volumeM3 = count * length * width * depth;
  return Math.round(volumeM3 * 1.5 * 10) / 10;
}

function resandingStatus(nextDate: string): { label: string; color: string } | null {
  if (!nextDate) return null;
  const today = new Date();
  const next = new Date(nextDate + 'T12:00:00');
  const diffMs = next.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'OVERDUE', color: 'bg-red-100 text-red-800' };
  if (diffDays <= 90) return { label: `${diffDays}d`, color: 'bg-amber-100 text-amber-800' };
  if (diffDays <= 180) return { label: `${Math.round(diffDays / 30)}mo`, color: 'bg-yellow-100 text-yellow-800' };
  return { label: `${Math.round(diffDays / 30)}mo`, color: 'bg-green-100 text-green-800' };
}

const inputCls = 'w-full border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:border-transparent';

export default function TreatmentInfrastructure() {
  const { user, accessContext } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [rows, setRows] = useState<TreatmentRow[]>([]);
  const [editRows, setEditRows] = useState<TreatmentRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [componentFilter, setComponentFilter] = useState('');

  const allowedSCIds = useMemo(() => accessContext?.allowedServiceCentreIds || [], [accessContext]);
  const scId = useMemo(() => (accessContext?.isSCScoped ? accessContext.scopeId : null) || allowedSCIds[0] || '', [accessContext, allowedSCIds]);

  useEffect(() => { loadData(); }, [allowedSCIds]);

  const loadData = async () => {
    if (allowedSCIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    try {
      let stQ = supabase.from('stations').select('id, station_name, service_centre_id').order('station_name');
      if (allowedSCIds.length <= 50) stQ = stQ.in('service_centre_id', allowedSCIds);
      const { data: stData } = await stQ;
      setStations(stData || []);

      let q = supabase.from('treatment_infrastructure').select('*').order('created_at', { ascending: false });
      if (allowedSCIds.length <= 50) q = q.in('service_centre_id', allowedSCIds);
      const { data, error: err } = await q;
      if (err) throw err;

      const stMap = new Map((stData || []).map(s => [s.id, s.station_name]));
      const mapped = (data || []).map((r: any) => ({
        ...r,
        station_name: stMap.get(r.station_id) || 'Unknown',
        last_resanding_date: r.last_resanding_date || '',
        next_resanding_date: r.next_resanding_date || '',
        _isNew: false, _isDirty: false,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (idx: number, field: string, value: any) => {
    setEditRows(prev => {
      const updated = [...prev];
      const row = { ...updated[idx], [field]: value, _isDirty: true };
      if (field === 'station_id') {
        const st = stations.find(s => s.id === value);
        row.station_name = st?.station_name || '';
        row.service_centre_id = st?.service_centre_id || scId;
      }
      if (field === 'last_resanding_date' || field === 'resanding_interval_months') {
        const ld = field === 'last_resanding_date' ? value : row.last_resanding_date;
        const im = field === 'resanding_interval_months' ? Number(value) : row.resanding_interval_months;
        row.next_resanding_date = computeNextResanding(ld, im);
      }
      if (['filter_count', 'filter_length_m', 'filter_width_m', 'media_depth_m'].includes(field)) {
        const c = field === 'filter_count' ? Number(value) : row.filter_count;
        const l = field === 'filter_length_m' ? Number(value) : row.filter_length_m;
        const w = field === 'filter_width_m' ? Number(value) : row.filter_width_m;
        const d = field === 'media_depth_m' ? Number(value) : row.media_depth_m;
        row.estimated_media_qty_tonnes = computeMediaQty(c, l, w, d);
      }
      updated[idx] = row;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    const dirty = editRows.filter(r => r._isDirty);
    if (dirty.length === 0) { setEditing(false); return; }
    const invalid = dirty.filter(r => !r.station_id);
    if (invalid.length > 0) { setError('Station is required'); return; }
    setSaving(true);
    setError('');
    try {
      for (const row of dirty) {
        const { _isNew, _isDirty, station_name, id, ...fields } = row;
        fields.updated_at = new Date().toISOString() as any;
        for (const df of ['last_resanding_date', 'next_resanding_date']) {
          if ((fields as any)[df] === '') (fields as any)[df] = null;
        }
        if (_isNew) {
          (fields as any).created_by = user.id;
          const { error: err } = await supabase.from('treatment_infrastructure').insert([fields]);
          if (err) throw err;
        } else {
          const { error: err } = await supabase.from('treatment_infrastructure').update(fields).eq('id', id);
          if (err) throw err;
        }
      }
      setSaveMsg(`${dirty.length} record(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      setEditing(false);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: TreatmentRow) => {
    if (row._isNew) { setEditRows(prev => prev.filter(r => r !== row)); return; }
    if (!confirm('Delete this record?')) return;
    try {
      const { error: err } = await supabase.from('treatment_infrastructure').delete().eq('id', row.id);
      if (err) throw err;
      setSaveMsg('Deleted');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const filteredRows = useMemo(() => {
    const source = editing ? editRows : rows;
    let result = source;
    if (stationFilter) result = result.filter(r => r.station_id === stationFilter);
    if (componentFilter) result = result.filter(r => r.component_type === componentFilter);
    return result;
  }, [editing, editRows, rows, stationFilter, componentFilter]);

  const alerts = useMemo(() => {
    return rows.filter(r => r.component_type === 'Filter' && r.next_resanding_date).map(r => {
      const status = resandingStatus(r.next_resanding_date);
      return status && (status.label === 'OVERDUE' || parseInt(status.label) <= 6) ? { ...r, status } : null;
    }).filter(Boolean) as (TreatmentRow & { status: { label: string; color: string } })[];
  }, [rows]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" /><span className="text-sm text-gray-500">Loading...</span></div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {saveMsg && <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-700">{saveMsg}</div>}

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Resanding Alerts</span>
          </div>
          <div className="space-y-1">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.status.color}`}>{a.status.label}</span>
                <span className="font-medium text-gray-800">{a.station_name}</span>
                <span className="text-gray-500">- {a.component_name || a.filter_type} ({a.filter_count} filters)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
          </select>
          <select value={componentFilter} onChange={e => setComponentFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Components</option>
            {COMPONENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditRows(prev => [createEmpty(scId), ...prev]); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100"><Plus className="w-3.5 h-3.5" /> Add</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}</button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50"><X className="w-3.5 h-3.5" /> Cancel</button>
          </div>
        ) : (
          <button onClick={() => { setEditRows([...rows]); setEditing(true); }} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100"><Pencil className="w-3.5 h-3.5" /> Edit / Add</button>
        )}
        <span className="text-[10px] text-gray-500">{filteredRows.length} of {rows.length}</span>
      </div>

      <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        <table className="border-collapse text-xs min-w-max w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              {['Station', 'Component', 'Name', 'Filter Type', 'Count', 'L (m)', 'W (m)', 'D (m)', 'Media', 'Depth (m)', 'Est. Qty (t)', 'Last Resand', 'Interval (mo)', 'Next Resand', 'Status', 'Condition', 'Notes'].map(h => (
                <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
              ))}
              {editing && <th className="border border-gray-200 px-1 py-2 bg-gray-100" />}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={editing ? 18 : 17} className="text-center py-8 text-gray-400">No treatment infrastructure records</td></tr>
            ) : filteredRows.map((row, i) => {
              const idx = editing ? editRows.indexOf(row) : i;
              const rs = resandingStatus(row.next_resanding_date);
              return (
                <tr key={row.id || `new_${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-1 py-0.5 whitespace-nowrap" style={{ minWidth: 140 }}>
                    {editing ? (
                      <select value={row.station_id} onChange={e => handleCellChange(idx, 'station_id', e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                      </select>
                    ) : row.station_name}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.component_type} onChange={e => handleCellChange(idx, 'component_type', e.target.value)} className={inputCls}>
                        {COMPONENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : row.component_type}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input value={row.component_name} onChange={e => handleCellChange(idx, 'component_name', e.target.value)} className={inputCls} /> : row.component_name}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.filter_type} onChange={e => handleCellChange(idx, 'filter_type', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {FILTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : row.filter_type}
                  </td>
                  {['filter_count', 'filter_length_m', 'filter_width_m', 'filter_depth_m'].map(f => (
                    <td key={f} className="border border-gray-200 px-1 py-0.5 text-right">
                      {editing ? <input type="number" step="any" value={(row as any)[f] || ''} onChange={e => handleCellChange(idx, f, Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : ((row as any)[f] || '—')}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.media_type} onChange={e => handleCellChange(idx, 'media_type', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {MEDIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : row.media_type}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" step="any" value={row.media_depth_m || ''} onChange={e => handleCellChange(idx, 'media_depth_m', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.media_depth_m || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right font-medium">
                    {row.estimated_media_qty_tonnes > 0 ? row.estimated_media_qty_tonnes.toFixed(1) : '—'}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input type="date" value={row.last_resanding_date} onChange={e => handleCellChange(idx, 'last_resanding_date', e.target.value)} className={inputCls + ' w-28'} /> : (row.last_resanding_date || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.resanding_interval_months || ''} onChange={e => handleCellChange(idx, 'resanding_interval_months', Number(e.target.value) || 0)} className={inputCls + ' text-right w-14'} /> : (row.resanding_interval_months || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">{row.next_resanding_date || '—'}</td>
                  <td className="border border-gray-200 px-1 py-0.5 text-center">
                    {rs && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rs.color}`}>{rs.label}</span>}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.condition} onChange={e => handleCellChange(idx, 'condition', e.target.value)} className={inputCls}>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : row.condition}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input value={row.notes} onChange={e => handleCellChange(idx, 'notes', e.target.value)} className={inputCls} /> : (row.notes || '—')}
                  </td>
                  {editing && (
                    <td className="border border-gray-200 px-1 py-0.5 text-center">
                      <button onClick={() => handleDelete(row)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
