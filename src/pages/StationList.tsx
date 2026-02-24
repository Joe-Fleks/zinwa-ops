import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Plus, CreditCard as Edit, Eye, Filter, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  station_type: string;
  operational_status: string;
  design_capacity_m3_hr: number;
  distance_from_sc_km: number;
  pump_count: number;
  operator_count: number;
}

export default function StationList() {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [filteredStations, setFilteredStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    loadStations();
  }, []);

  useEffect(() => {
    filterStations();
  }, [stations, searchTerm, statusFilter, typeFilter]);

  const loadStations = async () => {
    try {
      setError('');
      const { data: stationsData, error: stationsError } = await supabase
        .from('stations')
        .select('*')
        .order('station_name');

      if (stationsError) {
        throw new Error('Failed to load stations. Please check your internet connection.');
      }

      if (!stationsData) {
        if (stations.length === 0) {
          setStations([]);
        }
        return;
      }

      const stationIds = stationsData.map(s => s.id);

      if (stationIds.length === 0) {
        setStations([]);
        return;
      }

      const { data: pumpingStationsData } = await supabase
        .from('pumping_stations')
        .select('station_id, id')
        .in('station_id', stationIds);

      const pumpIds = (pumpingStationsData || []).map(ps => ps.id);

      const { data: pumpsData } = pumpIds.length > 0
        ? await supabase
            .from('pumps')
            .select('pumping_station_id')
            .in('pumping_station_id', pumpIds)
        : { data: [] };

      const { data: operatorsData } = await supabase
        .from('operators')
        .select('station_id')
        .in('station_id', stationIds);

      const pumpCountByStation: Record<string, number> = {};
      (pumpingStationsData || []).forEach(ps => {
        const pumpCount = (pumpsData || []).filter(p => p.pumping_station_id === ps.id).length;
        pumpCountByStation[ps.station_id] = (pumpCountByStation[ps.station_id] || 0) + pumpCount;
      });

      const operatorCountByStation: Record<string, number> = {};
      (operatorsData || []).forEach(op => {
        operatorCountByStation[op.station_id] = (operatorCountByStation[op.station_id] || 0) + 1;
      });

      const formattedStations = stationsData.map(station => ({
        id: station.id,
        station_code: station.station_code || 'N/A',
        station_name: station.station_name,
        station_type: station.station_type || 'Not specified',
        operational_status: station.operational_status || 'Active',
        design_capacity_m3_hr: station.design_capacity_m3_hr || 0,
        distance_from_sc_km: station.distance_from_sc_km || 0,
        pump_count: pumpCountByStation[station.id] || 0,
        operator_count: operatorCountByStation[station.id] || 0
      }));

      setStations(formattedStations);
    } catch (err: any) {
      console.error('Error loading stations:', err);
      setError(err.message || 'Failed to load stations. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const filterStations = () => {
    let filtered = [...stations];

    if (searchTerm) {
      filtered = filtered.filter(station =>
        station.station_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.station_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.distance_from_sc_km.toString().includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(station => station.operational_status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(station => station.station_type === typeFilter);
    }

    setFilteredStations(filtered);
  };

  const getStatusColor = (status: string) => {
    return status === 'Active'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getTypeColor = (type: string) => {
    if (type === 'Full Treatment') return 'bg-blue-100 text-blue-800';
    if (type === 'Borehole') return 'bg-teal-100 text-teal-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/clearwater')}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Clear Water"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Station Registry <span className="text-base font-normal text-gray-600">(Manage clear water treatment stations)</span>
            </h1>
          </div>
        </div>
        <button
          onClick={() => navigate('/clearwater/stations/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register New Station
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search stations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Decommissioned">Decommissioned</option>
              </select>
            </div>
          </div>

          <div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="all">All Types</option>
                <option value="Full Treatment">Full Treatment</option>
                <option value="Borehole">Borehole</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Network Error</p>
          <p className="text-sm mt-1">{error}</p>
          {stations.length > 0 && (
            <p className="text-sm mt-2">Showing previously loaded stations. Check your connection and try again.</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stations...</p>
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No stations found</h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by registering your first station'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Station Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Station Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance from SC (km)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pumps
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operators
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStations.map((station) => (
                  <tr key={station.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {station.station_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{station.station_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(station.station_type)}`}>
                        {station.station_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(station.operational_status)}`}>
                        {station.operational_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {station.design_capacity_m3_hr > 0
                        ? `${station.design_capacity_m3_hr} m³/hr`
                        : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {station.distance_from_sc_km > 0 ? `${station.distance_from_sc_km} km` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {station.pump_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {station.operator_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/clearwater/stations/${station.id}`)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => navigate(`/clearwater/stations/${station.id}/edit`)}
                          className="text-green-600 hover:text-green-800 transition-colors"
                          title="Edit Station"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredStations.length} of {stations.length} stations
          </span>
          <span>
            {stations.filter(s => s.operational_status === 'Active').length} Active • {' '}
            {stations.filter(s => s.operational_status === 'Decommissioned').length} Decommissioned
          </span>
        </div>
      </div>
    </div>
  );
}
