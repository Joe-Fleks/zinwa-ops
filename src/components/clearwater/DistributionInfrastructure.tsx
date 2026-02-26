import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Save, X, Pencil, Trash2, Loader2, Filter } from 'lucide-react';

interface Station { id: string; station_name: string; service_centre_id: string; }

interface DistInfraRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string;
  asset_type: string;
  asset_name: string;
  diameter_mm: number;
  length_km: number;
  material: string;
  pressure_class: string;
  capacity_m3: number;
  tank_type: string;
  tank_diameter_m: number;
  height_m: number;
  year_installed: number;
  condition: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

const ASSET_TYPES = ['Pumping Main', 'High Level Tank', 'Break Pressure Tank', 'Booster Station'];
const PIPE_MATERIALS = ['uPVC', 'Steel', 'Ductile Iron', 'HDPE', 'AC (Asbestos Cement)', 'GRP'];
const TANK_TYPES = ['Elevated', 'Ground Level', 'Underground', 'Concrete', 'Steel', 'Plastic/Poly'];
const CONDITIONS = ['Good', 'Fair', 'Poor', 'Decommissioned'];
const PRESSURE_CLASSES = ['Class 4', 'Class 6', 'Class 9', 'Class 12', 'Class 16', 'Class 25', 'PN6', 'PN10', 'PN16'];

function createEmpty(scId: string): DistInfraRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: scId,
    asset_type: 'Pumping Main', asset_name: '', diameter_mm: 0, length_km: 0,
    material: '', pressure_class: '', capacity_m3: 0, tank_type: '', tank_diameter_m: 0,
    height_m: 0, year_installed: 0, condition: 'Good', notes: '',
    _isNew: true, _isDirty: true,
  };
}

const inputCls = 'w-full border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:border-transparent';

export default function DistributionInfrastructure() {
  const { user, accessContext } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [rows, setRows] = useState<DistInfraRow[]>([]);
  const [editRows, setEditRows] = useState<DistInfraRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

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

      let q = supabase.from('distribution_infrastructure').select('*').order('created_at', { ascending: false });
      if (allowedSCIds.length <= 50) q = q.in('service_centre_id', allowedSCIds);
      const { data, error: err } = await q;
      if (err) throw err;

      const stMap = new Map((stData || []).map(s => [s.id, s.station_name]));
      setRows((data || []).map((r: any) => ({
        ...r, station_name: stMap.get(r.station_id) || 'Unknown', _isNew: false, _isDirty: false,
      })));
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
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
      updated[idx] = row;
      return updated;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    const dirty = editRows.filter(r => r._isDirty);
    if (dirty.length === 0) { setEditing(false); return; }
    if (dirty.some(r => !r.station_id)) { setError('Station is required'); return; }
    setSaving(true);
    setError('');
    try {
      for (const row of dirty) {
        const { _isNew, _isDirty, station_name, id, ...fields } = row;
        fields.updated_at = new Date().toISOString() as any;
        if (_isNew) {
          (fields as any).created_by = user.id;
          const { error: err } = await supabase.from('distribution_infrastructure').insert([fields]);
          if (err) throw err;
        } else {
          const { error: err } = await supabase.from('distribution_infrastructure').update(fields).eq('id', id);
          if (err) throw err;
        }
      }
      setSaveMsg(`${dirty.length} record(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      setEditing(false);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (row: DistInfraRow) => {
    if (row._isNew) { setEditRows(prev => prev.filter(r => r !== row)); return; }
    if (!confirm('Delete this record?')) return;
    try {
      const { error: err } = await supabase.from('distribution_infrastructure').delete().eq('id', row.id);
      if (err) throw err;
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const filteredRows = useMemo(() => {
    const source = editing ? editRows : rows;
    let result = source;
    if (stationFilter) result = result.filter(r => r.station_id === stationFilter);
    if (typeFilter) result = result.filter(r => r.asset_type === typeFilter);
    return result;
  }, [editing, editRows, rows, stationFilter, typeFilter]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" /><span className="text-sm text-gray-500">Loading...</span></div>;

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-2">{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {saveMsg && <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-700">{saveMsg}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Stations</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Types</option>
            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditRows(prev => [createEmpty(scId), ...prev])} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100"><Plus className="w-3.5 h-3.5" /> Add</button>
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
              {['Station', 'Asset Type', 'Name', 'Dia (mm)', 'Length (km)', 'Material', 'Pressure', 'Cap. (m3)', 'Tank Type', 'Tank Dia (m)', 'Height (m)', 'Year', 'Condition', 'Notes'].map(h => (
                <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
              ))}
              {editing && <th className="border border-gray-200 px-1 py-2 bg-gray-100" />}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={editing ? 15 : 14} className="text-center py-8 text-gray-400">No distribution infrastructure records</td></tr>
            ) : filteredRows.map((row, i) => {
              const idx = editing ? editRows.indexOf(row) : i;
              const isPM = row.asset_type === 'Pumping Main';
              return (
                <tr key={row.id || `new_${i}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-200 px-1 py-0.5" style={{ minWidth: 140 }}>
                    {editing ? (
                      <select value={row.station_id} onChange={e => handleCellChange(idx, 'station_id', e.target.value)} className={inputCls}>
                        <option value="">Select...</option>
                        {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                      </select>
                    ) : row.station_name}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.asset_type} onChange={e => handleCellChange(idx, 'asset_type', e.target.value)} className={inputCls}>
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : row.asset_type}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input value={row.asset_name} onChange={e => handleCellChange(idx, 'asset_name', e.target.value)} className={inputCls} /> : row.asset_name}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.diameter_mm || ''} onChange={e => handleCellChange(idx, 'diameter_mm', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.diameter_mm || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" step="any" value={row.length_km || ''} onChange={e => handleCellChange(idx, 'length_km', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.length_km || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.material} onChange={e => handleCellChange(idx, 'material', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {PIPE_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : row.material}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.pressure_class} onChange={e => handleCellChange(idx, 'pressure_class', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {PRESSURE_CLASSES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : row.pressure_class}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right" style={{ backgroundColor: !isPM && row.capacity_m3 > 0 ? '#EBF5FB' : undefined }}>
                    {editing ? <input type="number" step="any" value={row.capacity_m3 || ''} onChange={e => handleCellChange(idx, 'capacity_m3', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.capacity_m3 || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.tank_type} onChange={e => handleCellChange(idx, 'tank_type', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {TANK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : row.tank_type}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" step="any" value={row.tank_diameter_m || ''} onChange={e => handleCellChange(idx, 'tank_diameter_m', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.tank_diameter_m || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" step="any" value={row.height_m || ''} onChange={e => handleCellChange(idx, 'height_m', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.height_m || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.year_installed || ''} onChange={e => handleCellChange(idx, 'year_installed', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.year_installed || '—')}
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
