import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Save, X, Pencil, Trash2, Loader2, Filter, AlertTriangle } from 'lucide-react';

interface Station { id: string; station_name: string; service_centre_id: string; }

interface NetworkRow {
  id: string | null;
  station_id: string;
  station_name: string;
  service_centre_id: string;
  network_zone: string;
  pipe_material: string;
  nominal_diameter_mm: number;
  length_km: number;
  pressure_class: string;
  installation_year: number;
  condition: string;
  area_served: string;
  population_served: number;
  connections_count: number;
  has_prv: boolean;
  has_meter: boolean;
  leak_frequency: string;
  last_maintenance_date: string;
  notes: string;
  _isNew: boolean;
  _isDirty: boolean;
}

const PIPE_MATERIALS = ['uPVC', 'Steel', 'Ductile Iron', 'HDPE', 'AC (Asbestos Cement)', 'GRP', 'GI (Galvanised Iron)', 'Copper'];
const PRESSURE_CLASSES = ['Class 4', 'Class 6', 'Class 9', 'Class 12', 'Class 16', 'Class 25', 'PN6', 'PN10', 'PN16'];
const CONDITIONS = ['Good', 'Fair', 'Poor', 'Decommissioned'];
const LEAK_FREQUENCIES = ['Low', 'Medium', 'High', 'Critical'];
const COMMON_DIAMETERS = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200, 250, 300, 350, 400, 450, 500, 600];

function createEmpty(scId: string): NetworkRow {
  return {
    id: null, station_id: '', station_name: '', service_centre_id: scId,
    network_zone: '', pipe_material: '', nominal_diameter_mm: 0, length_km: 0,
    pressure_class: '', installation_year: 0, condition: 'Good',
    area_served: '', population_served: 0, connections_count: 0,
    has_prv: false, has_meter: false, leak_frequency: 'Low',
    last_maintenance_date: '', notes: '',
    _isNew: true, _isDirty: true,
  };
}

const inputCls = 'w-full border border-gray-300 rounded px-1.5 py-1 text-xs bg-white focus:ring-1 focus:ring-blue-400 focus:border-transparent';

export default function DistributionNetwork() {
  const { user, accessContext } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [rows, setRows] = useState<NetworkRow[]>([]);
  const [editRows, setEditRows] = useState<NetworkRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');

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

      let q = supabase.from('distribution_network').select('*').order('created_at', { ascending: false });
      if (allowedSCIds.length <= 50) q = q.in('service_centre_id', allowedSCIds);
      const { data, error: err } = await q;
      if (err) throw err;

      const stMap = new Map((stData || []).map(s => [s.id, s.station_name]));
      setRows((data || []).map((r: any) => ({
        ...r,
        station_name: stMap.get(r.station_id) || 'Unknown',
        last_maintenance_date: r.last_maintenance_date || '',
        _isNew: false, _isDirty: false,
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
        if ((fields as any).last_maintenance_date === '') (fields as any).last_maintenance_date = null;
        if (_isNew) {
          (fields as any).created_by = user.id;
          const { error: err } = await supabase.from('distribution_network').insert([fields]);
          if (err) throw err;
        } else {
          const { error: err } = await supabase.from('distribution_network').update(fields).eq('id', id);
          if (err) throw err;
        }
      }
      setSaveMsg(`${dirty.length} record(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      setEditing(false);
      await loadData();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (row: NetworkRow) => {
    if (row._isNew) { setEditRows(prev => prev.filter(r => r !== row)); return; }
    if (!confirm('Delete this record?')) return;
    try {
      const { error: err } = await supabase.from('distribution_network').delete().eq('id', row.id);
      if (err) throw err;
      await loadData();
    } catch (e: any) { setError(e.message); }
  };

  const filteredRows = useMemo(() => {
    const source = editing ? editRows : rows;
    let result = source;
    if (stationFilter) result = result.filter(r => r.station_id === stationFilter);
    if (materialFilter) result = result.filter(r => r.pipe_material === materialFilter);
    if (conditionFilter) result = result.filter(r => r.condition === conditionFilter);
    return result;
  }, [editing, editRows, rows, stationFilter, materialFilter, conditionFilter]);

  const networkStats = useMemo(() => {
    const totalLength = rows.reduce((s, r) => s + (Number(r.length_km) || 0), 0);
    const totalConnections = rows.reduce((s, r) => s + (Number(r.connections_count) || 0), 0);
    const totalPopulation = rows.reduce((s, r) => s + (Number(r.population_served) || 0), 0);
    const poorCount = rows.filter(r => r.condition === 'Poor').length;
    const acCount = rows.filter(r => r.pipe_material.includes('AC')).length;
    return { totalLength: Math.round(totalLength * 100) / 100, totalConnections, totalPopulation, poorCount, acCount };
  }, [rows]);

  const alerts = useMemo(() => {
    const items: { station: string; zone: string; issue: string; color: string }[] = [];
    for (const r of rows) {
      if (r.condition === 'Poor') items.push({ station: r.station_name, zone: r.network_zone || r.area_served, issue: 'Poor condition', color: 'bg-red-100 text-red-800' });
      if (r.leak_frequency === 'Critical') items.push({ station: r.station_name, zone: r.network_zone || r.area_served, issue: 'Critical leak frequency', color: 'bg-red-100 text-red-800' });
      if (r.leak_frequency === 'High') items.push({ station: r.station_name, zone: r.network_zone || r.area_served, issue: 'High leak frequency', color: 'bg-amber-100 text-amber-800' });
      if (r.pipe_material.includes('AC')) items.push({ station: r.station_name, zone: r.network_zone || r.area_served, issue: 'AC pipe (asbestos)', color: 'bg-amber-100 text-amber-800' });
    }
    return items;
  }, [rows]);

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" /><span className="text-sm text-gray-500">Loading...</span></div>;

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 flex items-center gap-2">{error}<button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button></div>}
      {saveMsg && <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-700">{saveMsg}</div>}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-blue-900">{networkStats.totalLength} km</div>
            <div className="text-[10px] text-blue-600 uppercase tracking-wide">Total Network</div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-teal-900">{networkStats.totalConnections.toLocaleString()}</div>
            <div className="text-[10px] text-teal-600 uppercase tracking-wide">Connections</div>
          </div>
          <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-cyan-900">{networkStats.totalPopulation.toLocaleString()}</div>
            <div className="text-[10px] text-cyan-600 uppercase tracking-wide">Pop. Served</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-red-900">{networkStats.poorCount}</div>
            <div className="text-[10px] text-red-600 uppercase tracking-wide">Poor Cond.</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-900">{networkStats.acCount}</div>
            <div className="text-[10px] text-amber-600 uppercase tracking-wide">AC Pipes</div>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-bold text-amber-800">Network Alerts</span>
          </div>
          <div className="space-y-1 max-h-24 overflow-auto">
            {alerts.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${a.color}`}>{a.issue}</span>
                <span className="font-medium text-gray-800">{a.station}</span>
                {a.zone && <span className="text-gray-500">- {a.zone}</span>}
              </div>
            ))}
            {alerts.length > 10 && <div className="text-[10px] text-amber-600">...and {alerts.length - 10} more</div>}
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
          <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Materials</option>
            {PIPE_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} className="border border-gray-200 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">All Conditions</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
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

      <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 'calc(100vh - 380px)' }}>
        <table className="border-collapse text-xs min-w-max w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              {['Station', 'Zone', 'Material', 'Dia (mm)', 'Length (km)', 'Pressure', 'Year', 'Condition', 'Area Served', 'Pop.', 'Conn.', 'PRV', 'Meter', 'Leaks', 'Last Maint.', 'Notes'].map(h => (
                <th key={h} className="border border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
              ))}
              {editing && <th className="border border-gray-200 px-1 py-2 bg-gray-100" />}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={editing ? 17 : 16} className="text-center py-8 text-gray-400">No distribution network records</td></tr>
            ) : filteredRows.map((row, i) => {
              const idx = editing ? editRows.indexOf(row) : i;
              const leakColor = row.leak_frequency === 'Critical' ? 'text-red-700 font-bold' : row.leak_frequency === 'High' ? 'text-amber-700 font-semibold' : '';
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
                    {editing ? <input value={row.network_zone} onChange={e => handleCellChange(idx, 'network_zone', e.target.value)} className={inputCls} placeholder="e.g. Zone A" /> : (row.network_zone || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.pipe_material} onChange={e => handleCellChange(idx, 'pipe_material', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {PIPE_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : row.pipe_material}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? (
                      <select value={row.nominal_diameter_mm || ''} onChange={e => handleCellChange(idx, 'nominal_diameter_mm', Number(e.target.value) || 0)} className={inputCls + ' w-16'}>
                        <option value="">—</option>
                        {COMMON_DIAMETERS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (row.nominal_diameter_mm || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" step="any" value={row.length_km || ''} onChange={e => handleCellChange(idx, 'length_km', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.length_km || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.pressure_class} onChange={e => handleCellChange(idx, 'pressure_class', e.target.value)} className={inputCls}>
                        <option value="">—</option>
                        {PRESSURE_CLASSES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : row.pressure_class}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.installation_year || ''} onChange={e => handleCellChange(idx, 'installation_year', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.installation_year || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? (
                      <select value={row.condition} onChange={e => handleCellChange(idx, 'condition', e.target.value)} className={inputCls}>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className={row.condition === 'Poor' ? 'text-red-700 font-semibold' : ''}>{row.condition}</span>
                    )}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input value={row.area_served} onChange={e => handleCellChange(idx, 'area_served', e.target.value)} className={inputCls} /> : (row.area_served || '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.population_served || ''} onChange={e => handleCellChange(idx, 'population_served', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.population_served ? row.population_served.toLocaleString() : '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-right">
                    {editing ? <input type="number" value={row.connections_count || ''} onChange={e => handleCellChange(idx, 'connections_count', Number(e.target.value) || 0)} className={inputCls + ' text-right w-16'} /> : (row.connections_count ? row.connections_count.toLocaleString() : '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-center">
                    {editing ? (
                      <input type="checkbox" checked={row.has_prv} onChange={e => handleCellChange(idx, 'has_prv', e.target.checked)} className="rounded" />
                    ) : (row.has_prv ? 'Yes' : '—')}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-center">
                    {editing ? (
                      <input type="checkbox" checked={row.has_meter} onChange={e => handleCellChange(idx, 'has_meter', e.target.checked)} className="rounded" />
                    ) : (row.has_meter ? 'Yes' : '—')}
                  </td>
                  <td className={`border border-gray-200 px-1 py-0.5 ${leakColor}`}>
                    {editing ? (
                      <select value={row.leak_frequency} onChange={e => handleCellChange(idx, 'leak_frequency', e.target.value)} className={inputCls}>
                        {LEAK_FREQUENCIES.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    ) : row.leak_frequency}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {editing ? <input type="date" value={row.last_maintenance_date} onChange={e => handleCellChange(idx, 'last_maintenance_date', e.target.value)} className={inputCls + ' w-28'} /> : (row.last_maintenance_date || '—')}
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
