import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Calendar, Edit2, Trash2, Plus, Filter, Search, Grid3x3 } from 'lucide-react';
import ProductionLogForm from '../components/ProductionLogForm';

interface Station {
  id: string;
  station_code: string;
  station_name: string;
}

interface ProductionLog {
  id: string;
  station_id: string;
  date: string;
  cw_volume_m3: number;
  cw_hours_run: number;
  rw_volume_m3: number;
  rw_hours_run: number;
  load_shedding_hours: number;
  other_downtime_hours: number;
  reason_for_downtime: string;
  alum_kg: number;
  hth_kg: number;
  activated_carbon_kg: number;
  new_connections: number;
  meters_serviced: number;
  notes: string;
  stations: Station;
}

export default function ProductionDataManager() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | undefined>(undefined);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [filterStation, setFilterStation] = useState<string>('all');
  const [searchDate, setSearchDate] = useState<string>('');

  useEffect(() => {
    loadStations();
    loadLogs();
  }, [filterStation, searchDate]);

  const loadStations = async () => {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('id, station_code, station_name')
        .order('station_name');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error loading stations:', error);
    }
  };

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('production_logs')
        .select(`
          *,
          stations (
            id,
            station_code,
            station_name
          )
        `)
        .order('date', { ascending: false })
        .limit(100);

      if (filterStation !== 'all') {
        query = query.eq('station_id', filterStation);
      }

      if (searchDate) {
        query = query.eq('date', searchDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = () => {
    if (!selectedStationId && stations.length > 0) {
      setSelectedStationId(stations[0].id);
    }
    setEditingLogId(undefined);
    setShowForm(true);
  };

  const handleEditLog = (log: ProductionLog) => {
    setSelectedStationId(log.station_id);
    setEditingLogId(log.id);
    setShowForm(true);
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('Are you sure you want to delete this production log?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('production_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;
      loadLogs();
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('Failed to delete production log');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingLogId(undefined);
  };

  const handleFormSave = () => {
    loadLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Production Data Manager <span className="text-base font-normal text-gray-600">(Centralized access to all production logs)</span>
          </h1>
          <p className="text-sm text-blue-600 mt-1">
            Note: Current day data represents yesterday's production (data entry occurs the following day)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/clearwater/production/bulk')}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            <Grid3x3 className="w-5 h-5" />
            Bulk Production Entry
          </button>
          <button
            onClick={handleAddLog}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Single Log
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Filter by Station
            </label>
            <select
              value={filterStation}
              onChange={(e) => setFilterStation(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Stations</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.station_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search by Date
            </label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Station for New Log
            </label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.station_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {searchDate || filterStation !== 'all' ? (
          <button
            onClick={() => {
              setSearchDate('');
              setFilterStation('all');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 mb-4"
          >
            Clear Filters
          </button>
        ) : null}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading production logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No production logs found</h3>
            <p className="text-gray-600">Add your first production log to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Station</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">RW Volume</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CW Volume</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CW Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Downtime</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alum (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">HTH (kg)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => {
                  const downtime =
                    Number(log.load_shedding_hours || 0) +
                    Number(log.other_downtime_hours || 0);

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(log.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{log.stations.station_name}</div>
                        <div className="text-xs text-gray-500">{log.stations.station_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(log.rw_volume_m3 || 0).toLocaleString()} m³
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(log.cw_volume_m3 || 0).toLocaleString()} m³
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(log.cw_hours_run || 0).toFixed(1)} hrs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {downtime.toFixed(1)} hrs
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(log.alum_kg || 0).toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Number(log.hth_kg || 0).toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditLog(log)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-600">
          Showing {logs.length} production log{logs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {showForm && selectedStationId && (
        <ProductionLogForm
          stationId={selectedStationId}
          logId={editingLogId}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
