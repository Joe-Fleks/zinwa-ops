import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Pencil, X, Plus, Save, Loader2, Building2 } from 'lucide-react';
import {
  COLUMN_GROUPS, createEmptyRow,
  type StationRow, type ColDef,
} from '../../lib/stationFATConfig';

export default function StationRegistryFAT() {
  const { user, accessContext } = useAuth();
  const [rows, setRows] = useState<StationRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const allColumns = useMemo(() =>
    COLUMN_GROUPS.flatMap(g => g.columns.map(col => ({ col, group: g }))),
    []
  );

  useEffect(() => { loadStations(); }, [accessContext?.scopeId]);

  const loadStations = async () => {
    setLoading(true);
    setError('');
    try {
      let query = supabase.from('stations').select('*').order('station_name');
      if (accessContext?.isSCScoped && accessContext?.scopeId) {
        query = query.eq('service_centre_id', accessContext.scopeId);
      }
      const { data: stations, error: err } = await query;
      if (err) throw err;
      if (!stations || stations.length === 0) { setRows([]); return; }

      const ids = stations.map(s => s.id);
      const [psRes, tuRes, assetRes, labRes, spareRes] = await Promise.all([
        supabase.from('pumping_stations').select('*').in('station_id', ids),
        supabase.from('treatment_units').select('*').in('station_id', ids),
        supabase.from('station_assets').select('station_id').in('station_id', ids),
        supabase.from('lab_equipment').select('station_id').in('station_id', ids),
        supabase.from('spare_parts').select('station_id').in('station_id', ids),
      ]);

      const psMap = new Map<string, any[]>();
      psRes.data?.forEach(ps => {
        const list = psMap.get(ps.station_id) || [];
        list.push(ps);
        psMap.set(ps.station_id, list);
      });
      const tuMap = new Map<string, any>();
      tuRes.data?.forEach(t => tuMap.set(t.station_id, t));

      const countEntries = (data: any[] | null) => {
        const m = new Map<string, number>();
        data?.forEach(r => m.set(r.station_id, (m.get(r.station_id) || 0) + 1));
        return m;
      };
      const assetCounts = countEntries(assetRes.data);
      const labCounts = countEntries(labRes.data);
      const spareCounts = countEntries(spareRes.data);

      setRows(stations.map(s => {
        const psList = psMap.get(s.id) || [];
        const rwPs = psList.find(p => p.pumping_station_type === 'RW');
        const cwPs = psList.find(p => p.pumping_station_type === 'CW');
        const bPs = psList.find(p => ['Booster', 'Mid-Booster'].includes(p.pumping_station_type));
        const tu = tuMap.get(s.id);
        return {
          id: s.id,
          station_code: s.station_code || '', station_name: s.station_name || '',
          station_type: s.station_type || '', operational_status: s.operational_status || 'Active',
          design_capacity_m3_hr: s.design_capacity_m3_hr || 0,
          location_coordinates: s.location_coordinates || '', distance_from_sc_km: s.distance_from_sc_km || 0,
          commissioning_date: s.commissioning_date || '', notes: s.notes || '',
          ps_rw_description: rwPs?.description || '', ps_rw_main_diameter: rwPs?.pumping_main_diameter || '',
          ps_rw_main_distance_m: rwPs?.pumping_main_distance_m || 0, ps_rw_main_material: rwPs?.pumping_main_material || '',
          ps_cw_description: cwPs?.description || '', ps_cw_main_diameter: cwPs?.pumping_main_diameter || '',
          ps_cw_main_distance_m: cwPs?.pumping_main_distance_m || 0, ps_cw_main_material: cwPs?.pumping_main_material || '',
          ps_booster_description: bPs?.description || '', ps_booster_main_diameter: bPs?.pumping_main_diameter || '',
          ps_booster_main_distance_m: bPs?.pumping_main_distance_m || 0, ps_booster_main_material: bPs?.pumping_main_material || '',
          operator_count: s.operator_count || 0,
          rw_abstraction_type: tu?.rw_abstraction_type || '',
          sedimentation_tank_size_m3: tu?.sedimentation_tank_size_m3 || 0,
          filter_type: tu?.filter_type || '', filter_size: tu?.filter_size || '',
          backwash_tank_size_m3: tu?.backwash_tank_size_m3 || 0, backwash_system_type: tu?.backwash_system_type || '',
          clients_domestic: s.clients_domestic || 0, clients_school: s.clients_school || 0,
          clients_business: s.clients_business || 0, clients_industry: s.clients_industry || 0,
          clients_church: s.clients_church || 0, clients_parastatal: s.clients_parastatal || 0,
          clients_government: s.clients_government || 0, clients_other: s.clients_other || 0,
          assets_count: assetCounts.get(s.id) || 0, lab_equipment_count: labCounts.get(s.id) || 0,
          spare_parts_count: spareCounts.get(s.id) || 0,
          _isNew: false, _isDirty: false,
          _ps_rw_id: rwPs?.id || null, _ps_cw_id: cwPs?.id || null,
          _ps_booster_id: bPs?.id || null, _treatment_id: tu?.id || null,
        };
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to load stations');
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = useCallback((rowIdx: number, field: string, value: any) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIdx] = { ...updated[rowIdx], [field]: value, _isDirty: true };
      return updated;
    });
  }, []);

  const handleAddStation = useCallback(() => {
    setRows(prev => [createEmptyRow(), ...prev]);
    if (!editing) setEditing(true);
  }, [editing]);

  const removeNewRow = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const saveRow = async (row: StationRow): Promise<string> => {
    const stationData: any = {
      station_code: row.station_code || null, station_name: row.station_name,
      station_type: row.station_type || null, operational_status: row.operational_status || 'Active',
      design_capacity_m3_hr: row.design_capacity_m3_hr || null,
      location_coordinates: row.location_coordinates || null,
      distance_from_sc_km: row.distance_from_sc_km || null,
      commissioning_date: row.commissioning_date || null, notes: row.notes || null,
      operator_count: row.operator_count || 0,
      clients_domestic: row.clients_domestic || 0, clients_school: row.clients_school || 0,
      clients_business: row.clients_business || 0, clients_industry: row.clients_industry || 0,
      clients_church: row.clients_church || 0, clients_parastatal: row.clients_parastatal || 0,
      clients_government: row.clients_government || 0, clients_other: row.clients_other || 0,
      service_centre_id: accessContext?.isSCScoped ? accessContext.scopeId : null,
    };

    let stationId: string;
    if (row._isNew) {
      stationData.created_by = user?.id;
      const { data, error } = await supabase.from('stations').insert([stationData]).select().single();
      if (error) throw error;
      stationId = data.id;
    } else {
      stationData.updated_at = new Date().toISOString();
      const { error } = await supabase.from('stations').update(stationData).eq('id', row.id);
      if (error) throw error;
      stationId = row.id!;
    }

    const psTypes = [
      { prefix: 'ps_rw', type: 'RW', idField: '_ps_rw_id' as const },
      { prefix: 'ps_cw', type: 'CW', idField: '_ps_cw_id' as const },
      { prefix: 'ps_booster', type: 'Booster', idField: '_ps_booster_id' as const },
    ];
    for (const ps of psTypes) {
      const desc = (row as any)[`${ps.prefix}_description`];
      const diam = (row as any)[`${ps.prefix}_main_diameter`];
      const dist = (row as any)[`${ps.prefix}_main_distance_m`];
      const mat = (row as any)[`${ps.prefix}_main_material`];
      if (desc || diam || dist || mat) {
        const rec = {
          station_id: stationId, pumping_station_type: ps.type,
          description: desc || null, pumping_main_diameter: diam || null,
          pumping_main_distance_m: dist || null, pumping_main_material: mat || null,
        };
        const existingId = (row as any)[ps.idField];
        if (existingId) {
          await supabase.from('pumping_stations').update(rec).eq('id', existingId);
        } else {
          await supabase.from('pumping_stations').insert([rec]);
        }
      }
    }

    const treatmentData = {
      rw_abstraction_type: row.rw_abstraction_type || null,
      sedimentation_tank_size_m3: row.sedimentation_tank_size_m3 || null,
      filter_type: row.filter_type || null, filter_size: row.filter_size || null,
      backwash_tank_size_m3: row.backwash_tank_size_m3 || null,
      backwash_system_type: row.backwash_system_type || null,
    };
    if (Object.values(treatmentData).some(v => v)) {
      if (row._treatment_id) {
        await supabase.from('treatment_units').update({ ...treatmentData, station_id: stationId }).eq('id', row._treatment_id);
      } else {
        await supabase.from('treatment_units').insert([{ ...treatmentData, station_id: stationId }]);
      }
    }
    return stationId;
  };

  const handleSave = async () => {
    const dirtyRows = rows.filter(r => r._isDirty);
    if (dirtyRows.length === 0) return;
    const invalidRows = dirtyRows.filter(r => !r.station_name.trim());
    if (invalidRows.length > 0) {
      setError('Station name is required for all rows');
      return;
    }
    setSaving(true);
    setError('');
    setSaveMsg('');
    try {
      for (const row of dirtyRows) {
        await saveRow(row);
      }
      setSaveMsg(`${dirtyRows.length} station(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      await loadStations();
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEdit = async () => {
    if (editing) {
      const hasDirty = rows.some(r => r._isDirty);
      if (hasDirty) await handleSave();
      setEditing(false);
    } else {
      setEditing(true);
    }
  };

  const dirtyCount = rows.filter(r => r._isDirty).length;

  const displayValue = (row: any, col: ColDef) => {
    if (col.type === 'readonly' && col.calculate) return col.calculate(row);
    const val = row[col.field];
    if (val === null || val === undefined || val === '') return '-';
    if (col.type === 'number') return val === 0 ? '-' : Number(val).toLocaleString();
    if (col.type === 'integer') return val;
    if (col.type === 'date' && val) {
      try { return new Date(val + 'T00:00:00').toLocaleDateString(); } catch { return val; }
    }
    return val;
  };

  const renderEditCell = (row: StationRow, col: ColDef, rowIdx: number) => {
    const val = (row as any)[col.field];
    const cls = 'w-full px-1 py-0.5 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 focus:bg-white rounded';

    if (col.type === 'readonly') {
      return <span className="text-xs text-gray-500 px-1">{col.calculate ? col.calculate(row) : val}</span>;
    }
    if (col.type === 'select') {
      return (
        <select value={val || ''} onChange={e => handleCellChange(rowIdx, col.field, e.target.value)} className={cls}>
          <option value="">-</option>
          {col.options!.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (col.type === 'date') {
      return <input type="date" value={val || ''} onChange={e => handleCellChange(rowIdx, col.field, e.target.value)} className={cls} />;
    }
    if (col.type === 'number' || col.type === 'integer') {
      return (
        <input
          type="number"
          value={val ?? 0}
          onChange={e => {
            const v = col.type === 'integer' ? (parseInt(e.target.value) || 0) : (parseFloat(e.target.value) || 0);
            handleCellChange(rowIdx, col.field, v);
          }}
          onFocus={e => { if (e.target.value === '0') e.target.select(); }}
          className={`${cls} text-right`}
          step={col.type === 'integer' ? 1 : 0.01}
        />
      );
    }
    return <input type="text" value={val || ''} onChange={e => handleCellChange(rowIdx, col.field, e.target.value)} className={cls} />;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading stations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={handleToggleEdit} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editing ? 'bg-gray-700 text-white hover:bg-gray-800' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {editing ? <><X className="w-4 h-4" />Done Editing</> : <><Pencil className="w-4 h-4" />Edit</>}
          </button>
          <button onClick={handleAddStation} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <Plus className="w-4 h-4" />Add Station
          </button>
          {editing && dirtyCount > 0 && (
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save ({dirtyCount})
            </button>
          )}
        </div>
        {saveMsg && <span className="text-sm text-green-700 font-medium">{saveMsg}</span>}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <Building2 className="w-14 h-14 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No stations registered</h3>
          <p className="text-sm text-gray-500">Click "Add Station" to register your first station</p>
        </div>
      ) : (
        <div className="overflow-auto border border-gray-200 rounded-lg shadow-sm" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          <table className="border-collapse text-xs min-w-max">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-gray-100 border border-gray-300 px-2 py-1.5 text-left font-bold text-gray-700 whitespace-nowrap" rowSpan={2} style={{ minWidth: 170 }}>
                  Station Name
                </th>
                {COLUMN_GROUPS.map(g => (
                  <th key={g.key} colSpan={g.columns.length} className={`${g.bgClass} border border-gray-300 px-2 py-1 text-center font-bold ${g.headerTextClass} whitespace-nowrap text-[11px] tracking-wide`}>
                    {g.label}
                  </th>
                ))}
                {editing && <th className="bg-gray-100 border border-gray-300 px-1 py-1" rowSpan={2} style={{ width: 40 }}></th>}
              </tr>
              <tr>
                {allColumns.map(({ col, group }) => (
                  <th key={col.field} className={`${group.bgClass} border border-gray-300 px-1 py-1 text-left font-semibold text-gray-600 whitespace-nowrap`} style={{ minWidth: col.width || 80 }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={row.id || `new_${rowIdx}`}
                  className={`${row._isNew ? 'bg-blue-50/60' : row._isDirty ? 'bg-amber-50/60' : 'hover:bg-gray-50'} transition-colors`}
                >
                  <td className="sticky left-0 z-10 border border-gray-200 px-2 py-1 font-medium whitespace-nowrap bg-white">
                    {editing ? (
                      <input
                        type="text"
                        value={row.station_name}
                        onChange={e => handleCellChange(rowIdx, 'station_name', e.target.value)}
                        placeholder="Station name..."
                        className="w-full px-1 py-0.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 font-medium"
                        style={{ minWidth: 155 }}
                      />
                    ) : (
                      <span className="text-gray-900">{row.station_name || '-'}</span>
                    )}
                  </td>
                  {allColumns.map(({ col }) => (
                    <td key={col.field} className="border border-gray-200 px-0.5 py-0.5">
                      {editing ? renderEditCell(row, col, rowIdx) : (
                        <span className={`px-1 text-xs ${col.type === 'number' || col.type === 'integer' || col.type === 'readonly' ? 'text-right block' : ''} text-gray-700`}>
                          {displayValue(row, col)}
                        </span>
                      )}
                    </td>
                  ))}
                  {editing && (
                    <td className="border border-gray-200 px-1 py-0.5 text-center">
                      {row._isNew && (
                        <button onClick={() => removeNewRow(rowIdx)} className="text-red-400 hover:text-red-600" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
