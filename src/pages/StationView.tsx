import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, CreditCard as Edit, Droplets, Users, Wrench, FlaskConical, Package, RefreshCw } from 'lucide-react';
import { calculateAndUpdatePumpRates } from '../lib/pumpRateCalculator';
import { formatDateTime } from '../lib/dateUtils';

interface Station {
  id: string;
  station_code: string;
  station_name: string;
  station_type: string;
  operational_status: string;
  design_capacity_m3_hr: number;
  location_coordinates: string;
  distance_from_sc_km: number;
  commissioning_date: string;
  notes: string;
  created_at: string;
  target_daily_hours: number;
  cw_pump_rate_m3_hr: number;
  rw_pump_rate_m3_hr: number;
  pump_rates_last_updated: string;
}

export default function StationView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pumpCount, setPumpCount] = useState(0);
  const [operatorCount, setOperatorCount] = useState(0);
  const [equipmentCount, setEquipmentCount] = useState(0);
  const [sparePartsCount, setSparePartsCount] = useState(0);
  const [updatingPumpRates, setUpdatingPumpRates] = useState(false);

  useEffect(() => {
    if (id) {
      loadStationData();
    }
  }, [id]);

  const loadStationData = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: stationData, error: stationError } = await supabase
        .from('stations')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (stationError) throw new Error('Failed to load station data. Please check your internet connection.');
      if (!stationData) throw new Error('Station not found');

      setStation(stationData);

      const { data: pumpingStationsData } = await supabase
        .from('pumping_stations')
        .select('id')
        .eq('station_id', id);

      const pumpingStationIds = (pumpingStationsData || []).map(ps => ps.id);

      if (pumpingStationIds.length > 0) {
        const { data: pumpsData } = await supabase
          .from('pumps')
          .select('id')
          .in('pumping_station_id', pumpingStationIds);

        setPumpCount((pumpsData || []).length);
      }

      const { data: operatorsData } = await supabase
        .from('operators')
        .select('id')
        .eq('station_id', id);

      setOperatorCount((operatorsData || []).length);

      const { data: equipmentData } = await supabase
        .from('lab_equipment')
        .select('id')
        .eq('station_id', id);

      setEquipmentCount((equipmentData || []).length);

      const { data: sparePartsData } = await supabase
        .from('spare_parts')
        .select('id')
        .eq('station_id', id);

      setSparePartsCount((sparePartsData || []).length);

    } catch (err: any) {
      setError(err.message || 'Failed to load station data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePumpRates = async () => {
    setUpdatingPumpRates(true);
    try {
      const result = await calculateAndUpdatePumpRates();
      if (result.success) {
        alert(result.message);
        loadStationData();
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Failed to update pump rates');
    } finally {
      setUpdatingPumpRates(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading station details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/clearwater')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Clear Water
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Error Loading Station</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/clearwater')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Clear Water
        </button>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          Station not found
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    return status === 'Active'
      ? 'bg-green-100 text-green-800 border-green-200'
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/clearwater')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Clear Water
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleUpdatePumpRates}
            disabled={updatingPumpRates}
            className="flex items-center gap-2 px-4 py-2 bg-blue-200 text-blue-900 rounded-lg hover:bg-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 ${updatingPumpRates ? 'animate-spin' : ''}`} />
            {updatingPumpRates ? 'Updating...' : 'Update Pump Rates'}
          </button>
          <button
            onClick={() => navigate(`/clearwater/stations/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Edit Station
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{station.station_name}</h1>
            <p className="text-gray-600 mt-1">Station Code: {station.station_code || 'Not set'}</p>
          </div>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(station.operational_status)}`}>
            {station.operational_status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Station Type</label>
            <p className="text-gray-900">{station.station_type || 'Not specified'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Design Capacity</label>
            <p className="text-gray-900">
              {station.design_capacity_m3_hr ? `${station.design_capacity_m3_hr} m³/hr` : 'Not set'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Target Daily Operating Hours</label>
            <p className="text-gray-900">
              {station.target_daily_hours ? `${station.target_daily_hours} hours/day` : 'Not set'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">CW Pump Rate (Current)</label>
            <p className="text-gray-900">
              {station.cw_pump_rate_m3_hr ? `${station.cw_pump_rate_m3_hr} m³/hr` : 'Not calculated yet'}
            </p>
            {station.pump_rates_last_updated && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {formatDateTime(station.pump_rates_last_updated)}
              </p>
            )}
          </div>

          {station.station_type === 'Full Treatment' && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">RW Pump Rate (Current)</label>
              <p className="text-gray-900">
                {station.rw_pump_rate_m3_hr ? `${station.rw_pump_rate_m3_hr} m³/hr` : 'Not calculated yet'}
              </p>
              {station.pump_rates_last_updated && (
                <p className="text-xs text-gray-500 mt-1">
                  Last updated: {formatDateTime(station.pump_rates_last_updated)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Location Coordinates</label>
            <p className="text-gray-900">{station.location_coordinates || 'Not set'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Distance from SC (km)</label>
            <p className="text-gray-900">{station.distance_from_sc_km ? `${station.distance_from_sc_km} km` : 'Not set'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Commissioning Date</label>
            <p className="text-gray-900">
              {station.commissioning_date
                ? new Date(station.commissioning_date).toLocaleDateString()
                : 'Not set'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Created On</label>
            <p className="text-gray-900">
              {formatDateTime(station.created_at)}
            </p>
          </div>

          {station.notes && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
              <p className="text-gray-900 whitespace-pre-wrap">{station.notes}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Droplets className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pumpCount}</p>
              <p className="text-sm text-gray-600">Pumps</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{operatorCount}</p>
              <p className="text-sm text-gray-600">Operators</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{equipmentCount}</p>
              <p className="text-sm text-gray-600">Lab Equipment</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{sparePartsCount}</p>
              <p className="text-sm text-gray-600">Spare Parts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg">
          <p className="text-sm">
            To add or modify pumps, operators, equipment, and other details, click the "Edit Station" button above.
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium mb-1">About Pump Rates</p>
          <p className="text-sm">
            Current pump rates (CW and RW) are calculated automatically from the previous week's production data using the formula: Sum of produced water ÷ Sum of hours run. Click "Update Pump Rates" to recalculate based on the latest data.
          </p>
        </div>
      </div>
    </div>
  );
}
