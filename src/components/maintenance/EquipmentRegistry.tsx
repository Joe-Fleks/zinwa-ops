import { useState, useEffect, useCallback, useMemo } from 'react';
import { Cog, Plus, Save, X, CalendarClock, ChevronDown, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import {
  EquipmentCategory, EQUIPMENT_CATEGORIES, TABLE_NAMES,
  StationOption, ServiceCentreOption, PumpRow, MotorRow, BearingRow, VehicleRow, BikeRow,
  computeDesignLifeExpiry, createEmptyPump, createEmptyMotor, createEmptyBearing,
  createEmptyVehicle, createEmptyBike, shortenSCName,
} from './equipmentConfig';
import PumpsTable from './tables/PumpsTable';
import MotorsTable from './tables/MotorsTable';
import BearingsTable from './tables/BearingsTable';
import VehiclesTable from './tables/VehiclesTable';
import BikesTable from './tables/BikesTable';
import DesignLifeCalendar from './DesignLifeCalendar';

type ViewMode = 'registry' | 'calendar';

const DATE_FIELDS = ['installation_date', 'design_life_expiry', 'zinara_expiry', 'insurance_expiry', 'fitness_expiry'];
const SC_CATEGORIES: EquipmentCategory[] = ['vehicles'];

export default function EquipmentRegistry() {
  const { user, accessContext } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();

  const [category, setCategory] = useState<EquipmentCategory>('pumps');
  const [viewMode, setViewMode] = useState<ViewMode>('registry');
  const [stations, setStations] = useState<StationOption[]>([]);
  const [serviceCentres, setServiceCentres] = useState<ServiceCentreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [stationFilter, setStationFilter] = useState('');
  const [scFilter, setSCFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [pumps, setPumps] = useState<PumpRow[]>([]);
  const [motors, setMotors] = useState<MotorRow[]>([]);
  const [bearings, setBearings] = useState<BearingRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [bikes, setBikes] = useState<BikeRow[]>([]);
  const [editPumps, setEditPumps] = useState<PumpRow[]>([]);
  const [editMotors, setEditMotors] = useState<MotorRow[]>([]);
  const [editBearings, setEditBearings] = useState<BearingRow[]>([]);
  const [editVehicles, setEditVehicles] = useState<VehicleRow[]>([]);
  const [editBikes, setEditBikes] = useState<BikeRow[]>([]);

  const allowedSCIds = useMemo(() => accessContext?.allowedServiceCentreIds || [], [accessContext]);
  const serviceCentreId = accessContext?.isSCScoped ? accessContext.scopeId : null;

  const isSCCategory = SC_CATEGORIES.includes(category);

  useEffect(() => {
    loadStations();
    loadServiceCentres();
  }, [allowedSCIds]);

  useEffect(() => {
    if (isSCCategory) {
      if (serviceCentres.length > 0) loadEquipment();
    } else {
      if (stations.length > 0) loadEquipment();
    }
  }, [stations, serviceCentres, category]);

  const loadStations = async () => {
    if (allowedSCIds.length === 0) { setStations([]); return; }
    let q = supabase.from('stations').select('id, station_name, service_centre_id').order('station_name');
    if (allowedSCIds.length <= 50) q = q.in('service_centre_id', allowedSCIds);
    const { data } = await q;
    setStations((data || []).map(s => ({ id: s.id, station_name: s.station_name })));
  };

  const loadServiceCentres = async () => {
    if (allowedSCIds.length === 0) { setServiceCentres([]); return; }
    let q = supabase.from('service_centres').select('id, name').order('name');
    if (allowedSCIds.length <= 50) q = q.in('id', allowedSCIds);
    const { data } = await q;
    setServiceCentres((data || []).map(sc => ({
      id: sc.id,
      name: sc.name,
      short_name: shortenSCName(sc.name),
    })));
  };

  const loadEquipment = async () => {
    setLoading(true);
    setError('');
    try {
      const table = TABLE_NAMES[category];
      let q = supabase.from(table).select('*').order('created_at', { ascending: false });
      if (allowedSCIds.length <= 50 && allowedSCIds.length > 0) {
        q = q.in('service_centre_id', allowedSCIds);
      }
      const { data, error: err } = await q;
      if (err) throw err;

      if (category === 'vehicles') {
        const scMap = new Map(serviceCentres.map(sc => [sc.id, sc.short_name]));
        const rows = (data || []).map((r: any) => ({
          ...r,
          sc_name: scMap.get(r.service_centre_id) || 'Unknown',
          zinara_expiry: r.zinara_expiry || '',
          _isNew: false,
          _isDirty: false,
        }));
        setVehicles(rows);
      } else if (category === 'bikes') {
        const stMap = new Map(stations.map(s => [s.id, s.station_name]));
        const rows = (data || []).map((r: any) => ({
          ...r,
          station_name: stMap.get(r.station_id) || 'Unknown',
          zinara_expiry: r.zinara_expiry || '',
          _isNew: false,
          _isDirty: false,
        }));
        setBikes(rows);
      } else {
        const stMap = new Map(stations.map(s => [s.id, s.station_name]));
        const rows = (data || []).map((r: any) => ({
          ...r,
          station_name: stMap.get(r.station_id) || 'Unknown',
          installation_date: r.installation_date || '',
          design_life_expiry: r.design_life_expiry || '',
          _isNew: false,
          _isDirty: false,
        }));
        if (category === 'pumps') setPumps(rows);
        else if (category === 'motors') setMotors(rows);
        else setBearings(rows);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  const syncVehicleBreakdowns = async (dirtyVehicles: VehicleRow[]) => {
    if (!user) return;
    const scId = serviceCentreId || allowedSCIds[0] || null;
    if (!scId) return;

    for (const v of dirtyVehicles) {
      if (!v.id && v._isNew) continue;
      const vehicleId = v.id;

      const { data: existing } = await supabase
        .from('station_breakdowns')
        .select('id, is_resolved')
        .eq('vehicle_id', vehicleId)
        .eq('is_resolved', false)
        .maybeSingle();

      if (v.status === 'Non-Runner' && !existing) {
        const { data: anyStation } = await supabase
          .from('stations')
          .select('id')
          .eq('service_centre_id', scId)
          .limit(1)
          .maybeSingle();
        if (!anyStation) continue;

        await supabase.from('station_breakdowns').insert([{
          station_id: anyStation.id,
          vehicle_id: vehicleId,
          date_reported: new Date().toISOString().split('T')[0],
          nature_of_breakdown: `Vehicle ${v.number_plate || 'Unknown'} - Non-Runner`,
          breakdown_impact: 'Not Significant',
          description: `Vehicle ${v.number_plate || ''} (${v.make} ${v.model}) marked as Non-Runner`,
          is_resolved: false,
          reported_by: user.id,
          service_centre_id: scId,
        }]);
      } else if (v.status === 'Runner' && existing) {
        await supabase.from('station_breakdowns').update({
          is_resolved: true,
          date_resolved: new Date().toISOString().split('T')[0],
          resolved_by: user.id,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
      }
    }
  };

  const handleAddRow = useCallback(() => {
    const startEdit = (setter: any, factory: () => any, current: any[]) => {
      if (!editing) {
        setter([factory(), ...current]);
        setEditing(true);
      } else {
        setter((prev: any[]) => [factory(), ...prev]);
      }
    };
    if (category === 'vehicles') startEdit(setEditVehicles, () => createEmptyVehicle(serviceCentreId), vehicles);
    else if (category === 'bikes') startEdit(setEditBikes, () => createEmptyBike(serviceCentreId), bikes);
    else if (category === 'pumps') startEdit(setEditPumps, () => createEmptyPump(serviceCentreId), pumps);
    else if (category === 'motors') startEdit(setEditMotors, () => createEmptyMotor(serviceCentreId), motors);
    else startEdit(setEditBearings, () => createEmptyBearing(serviceCentreId), bearings);
  }, [editing, category, pumps, motors, bearings, vehicles, bikes, serviceCentreId]);

  const handleCellChange = useCallback((rowIdx: number, field: string, value: any) => {
    const updater = (prev: any[]) => {
      const updated = [...prev];
      const row = { ...updated[rowIdx], [field]: value, _isDirty: true };

      if (category === 'vehicles' && field === 'service_centre_id') {
        const sc = serviceCentres.find(s => s.id === value);
        row.sc_name = sc?.short_name || '';
      }

      if (!isSCCategory && field === 'station_id') {
        const st = stations.find(s => s.id === value);
        row.station_name = st?.station_name || '';
        if (serviceCentreId) row.service_centre_id = serviceCentreId;
      }

      if (field === 'installation_date' || field === 'design_life_years') {
        const instDate = field === 'installation_date' ? value : row.installation_date;
        const lifeYrs = field === 'design_life_years' ? Number(value) : row.design_life_years;
        row.design_life_expiry = computeDesignLifeExpiry(instDate, lifeYrs);
      }

      updated[rowIdx] = row;
      return updated;
    };

    if (category === 'pumps') setEditPumps(updater);
    else if (category === 'motors') setEditMotors(updater);
    else if (category === 'bearings') setEditBearings(updater);
    else if (category === 'vehicles') setEditVehicles(updater);
    else setEditBikes(updater);
  }, [stations, serviceCentres, category, serviceCentreId, isSCCategory]);

  const handleDeleteRow = useCallback(async (row: any) => {
    if (row._isNew) {
      const remover = (prev: any[]) => prev.filter(r => r !== row);
      if (category === 'pumps') setEditPumps(remover);
      else if (category === 'motors') setEditMotors(remover);
      else if (category === 'bearings') setEditBearings(remover);
      else if (category === 'vehicles') setEditVehicles(remover);
      else setEditBikes(remover);
      return;
    }
    if (!row.id) return;
    if (!window.confirm('Delete this equipment record? This cannot be undone.')) return;
    if (!isOnline) { showOfflineWarning(); return; }

    try {
      const { error: err } = await supabase.from(TABLE_NAMES[category]).delete().eq('id', row.id);
      if (err) throw err;
      const remover = (prev: any[]) => prev.filter(r => r.id !== row.id);
      if (category === 'pumps') { setPumps(remover); setEditPumps(remover); }
      else if (category === 'motors') { setMotors(remover); setEditMotors(remover); }
      else if (category === 'bearings') { setBearings(remover); setEditBearings(remover); }
      else if (category === 'vehicles') { setVehicles(remover); setEditVehicles(remover); }
      else { setBikes(remover); setEditBikes(remover); }
      setSaveMsg('Record deleted');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }, [category, isOnline]);

  const handleSave = async () => {
    if (!isOnline) { showOfflineWarning(); return; }
    if (!user) { setError('Not authenticated'); return; }

    const rows: any[] =
      category === 'pumps' ? editPumps :
      category === 'motors' ? editMotors :
      category === 'bearings' ? editBearings :
      category === 'vehicles' ? editVehicles :
      editBikes;
    const dirtyRows = rows.filter(r => r._isDirty);
    if (dirtyRows.length === 0) { setEditing(false); return; }

    if (isSCCategory) {
      const invalid = dirtyRows.filter(r => !r.service_centre_id);
      if (invalid.length > 0) { setError('Service Centre is required for all vehicle records'); return; }
    } else {
      const invalid = dirtyRows.filter(r => !r.station_id);
      if (invalid.length > 0) { setError('Station is required for all records'); return; }
    }

    setSaving(true);
    setError('');
    try {
      const table = TABLE_NAMES[category];
      const savedIds: string[] = [];
      for (const row of dirtyRows) {
        const { _isNew, _isDirty, station_name, sc_name, id, ...fields } = row;
        if (!isSCCategory) {
          fields.service_centre_id = serviceCentreId || fields.service_centre_id;
        }
        fields.updated_at = new Date().toISOString();

        for (const df of DATE_FIELDS) {
          if (df in fields && fields[df] === '') fields[df] = null;
        }

        if (_isNew) {
          fields.created_by = user.id;
          const { data: inserted, error: err } = await supabase.from(table).insert([fields]).select('id').maybeSingle();
          if (err) throw err;
          if (inserted) savedIds.push(inserted.id);
        } else {
          const { error: err } = await supabase.from(table).update(fields).eq('id', id);
          if (err) throw err;
          savedIds.push(id);
        }
      }

      if (category === 'vehicles') {
        await loadEquipment();
        const updatedVehicles: VehicleRow[] = [];
        for (const row of dirtyRows) {
          const vid = row.id || savedIds.shift();
          if (vid) updatedVehicles.push({ ...row, id: vid });
        }
        await syncVehicleBreakdowns(updatedVehicles);
      }

      setSaveMsg(`${dirtyRows.length} record(s) saved`);
      setTimeout(() => setSaveMsg(''), 3000);
      setEditing(false);
      await loadEquipment();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    setEditPumps([...pumps]);
    setEditMotors([...motors]);
    setEditBearings([...bearings]);
    setEditVehicles([...vehicles]);
    setEditBikes([...bikes]);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setError('');
  };

  const currentRows = useMemo(() => {
    let source: any[];
    if (editing) {
      source =
        category === 'pumps' ? editPumps :
        category === 'motors' ? editMotors :
        category === 'bearings' ? editBearings :
        category === 'vehicles' ? editVehicles :
        editBikes;
    } else {
      source =
        category === 'pumps' ? pumps :
        category === 'motors' ? motors :
        category === 'bearings' ? bearings :
        category === 'vehicles' ? vehicles :
        bikes;
    }

    let filtered = source;

    if (category === 'vehicles') {
      if (scFilter) filtered = filtered.filter(r => r.service_centre_id === scFilter);
      if (statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
    } else {
      if (stationFilter) filtered = filtered.filter(r => r.station_id === stationFilter);
      if (category === 'bikes' && statusFilter) filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (conditionFilter) filtered = filtered.filter(r => r.condition === conditionFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => {
        let searchable: string;
        if (category === 'vehicles') {
          searchable = [r.number_plate, r.make, r.model, r.sc_name, r.vehicle_type, r.assigned_to || ''].join(' ').toLowerCase();
        } else if (category === 'bikes') {
          searchable = [r.number_plate, r.make, r.model, r.station_name, r.bike_type, r.assigned_to || ''].join(' ').toLowerCase();
        } else {
          searchable = [r.tag_number, r.manufacturer, r.model, r.station_name, (r as any).serial_number || ''].join(' ').toLowerCase();
        }
        return searchable.includes(q);
      });
    }
    return filtered;
  }, [editing, category, pumps, motors, bearings, vehicles, bikes, editPumps, editMotors, editBearings, editVehicles, editBikes, stationFilter, scFilter, conditionFilter, statusFilter, searchQuery]);

  const totalCount =
    category === 'pumps' ? pumps.length :
    category === 'motors' ? motors.length :
    category === 'bearings' ? bearings.length :
    category === 'vehicles' ? vehicles.length :
    bikes.length;

  const showStatusFilter = category === 'vehicles' || category === 'bikes';

  const lightBlueSelect = 'appearance-none pl-3 pr-8 py-2 border border-blue-200 rounded-lg text-sm bg-blue-50 text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-blue-50 border border-blue-200 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('registry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'registry' ? 'bg-white text-gray-900 shadow-sm' : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              <Cog className="w-4 h-4" />
              <span className="hidden sm:inline">Equipment DB</span>
              <span className="sm:hidden">DB</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-blue-700 hover:text-blue-900'
              }`}
            >
              <CalendarClock className="w-4 h-4" />
              <span className="hidden sm:inline">Design Life Calendar</span>
              <span className="sm:hidden">Calendar</span>
            </button>
          </div>
        </div>

        {viewMode === 'registry' && (
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button onClick={handleAddRow} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">
                  <Plus className="w-4 h-4" /> Add
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <X className="w-4 h-4" /> Cancel
                </button>
              </>
            ) : (
              <button onClick={handleStartEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">
                <Plus className="w-4 h-4" /> Edit / Add Equipment
              </button>
            )}
            {saveMsg && <span className="text-sm text-green-700 font-medium">{saveMsg}</span>}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {viewMode === 'calendar' && <DesignLifeCalendar stations={stations} allowedSCIds={allowedSCIds} />}

      {viewMode === 'registry' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
              {EQUIPMENT_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => { setCategory(cat.key); setEditing(false); setStationFilter(''); setSCFilter(''); setStatusFilter(''); }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    category === cat.key
                      ? 'bg-blue-600 text-white'
                      : 'text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={category === 'vehicles' ? 'Search plate, make...' : category === 'bikes' ? 'Search plate, make...' : 'Search tag, model...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 border border-blue-200 rounded-lg text-sm w-48 bg-blue-50 text-blue-900 placeholder-blue-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {category === 'vehicles' ? (
              <div className="relative">
                <select value={scFilter} onChange={e => setSCFilter(e.target.value)} className={lightBlueSelect}>
                  <option value="">All Service Centres</option>
                  {serviceCentres.map(sc => <option key={sc.id} value={sc.id}>{sc.short_name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
              </div>
            ) : (
              <div className="relative">
                <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className={lightBlueSelect}>
                  <option value="">All Stations</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
              </div>
            )}

            {showStatusFilter && (
              <div className="relative">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={lightBlueSelect}>
                  <option value="">All Statuses</option>
                  <option value="Runner">Runner</option>
                  <option value="Non-Runner">Non-Runner</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
              </div>
            )}

            <div className="relative">
              <select value={conditionFilter} onChange={e => setConditionFilter(e.target.value)} className={lightBlueSelect}>
                <option value="">All Conditions</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
            </div>

            <span className="text-xs text-gray-500">
              {currentRows.length} of {totalCount} record(s)
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Loading equipment...</p>
            </div>
          ) : (
            <div className="overflow-auto border border-gray-200 rounded-lg" style={{ maxHeight: 'calc(100vh - 340px)' }}>
              {category === 'pumps' && (
                <PumpsTable rows={currentRows as PumpRow[]} stations={stations} editing={editing} editRows={editPumps} onCellChange={handleCellChange} onDelete={handleDeleteRow} />
              )}
              {category === 'motors' && (
                <MotorsTable rows={currentRows as MotorRow[]} stations={stations} editing={editing} editRows={editMotors} onCellChange={handleCellChange} onDelete={handleDeleteRow} />
              )}
              {category === 'bearings' && (
                <BearingsTable rows={currentRows as BearingRow[]} stations={stations} editing={editing} editRows={editBearings} onCellChange={handleCellChange} onDelete={handleDeleteRow} />
              )}
              {category === 'vehicles' && (
                <VehiclesTable rows={currentRows as VehicleRow[]} serviceCentres={serviceCentres} editing={editing} editRows={editVehicles} onCellChange={handleCellChange} onDelete={handleDeleteRow} />
              )}
              {category === 'bikes' && (
                <BikesTable rows={currentRows as BikeRow[]} stations={stations} editing={editing} editRows={editBikes} onCellChange={handleCellChange} onDelete={handleDeleteRow} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
