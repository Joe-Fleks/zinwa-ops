import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { getYesterdayString, canEditProductionLog, getEditableUntilDate, formatDateForDisplay } from '../lib/dateUtils';
import { handleKeyNavigation, excelCellClassName, excelTableClassName, excelHeaderClassName } from '../lib/excelFormUtils';
import { navigateBack } from '../lib/navigationUtils';

interface FormData {
  date: string;
  cw_volume_m3: string;
  cw_hours_run: string;
  rw_volume_m3: string;
  rw_hours_run: string;
  load_shedding_hours: string;
  other_downtime_hours: string;
  reason_for_downtime: string;
  alum_kg: string;
  hth_kg: string;
  activated_carbon_kg: string;
  new_connections: string;
  new_connection_category: string;
  meters_serviced: string;
  notes: string;
}

export default function ProductionLogFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const stationId = searchParams.get('stationId');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stationType, setStationType] = useState<string>('');
  const [stationName, setStationName] = useState<string>('');
  const [targetDailyHours, setTargetDailyHours] = useState<number>(0);
  const [formData, setFormData] = useState<FormData>({
    date: getYesterdayString(),
    cw_volume_m3: '',
    cw_hours_run: '',
    rw_volume_m3: '',
    rw_hours_run: '',
    load_shedding_hours: '0',
    other_downtime_hours: '0',
    reason_for_downtime: '',
    alum_kg: '0',
    hth_kg: '0',
    activated_carbon_kg: '0',
    new_connections: '0',
    new_connection_category: '',
    meters_serviced: '0',
    notes: ''
  });
  const [isDateEditable, setIsDateEditable] = useState(true);

  const isEditMode = !!id;

  useEffect(() => {
    if (stationId) {
      loadStation();
    }
  }, [stationId]);

  useEffect(() => {
    if (id) {
      loadLog();
    }
  }, [id]);

  useEffect(() => {
    setIsDateEditable(canEditProductionLog(formData.date));
  }, [formData.date]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [location]);

  const loadStation = async () => {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('station_type, station_name, target_daily_hours')
        .eq('id', stationId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStationType(data.station_type || '');
        setStationName(data.station_name || '');
        setTargetDailyHours(data.target_daily_hours || 0);
      }
    } catch (error) {
      console.error('Error loading station:', error);
    }
  };

  const loadLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('production_logs')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          date: data.date,
          cw_volume_m3: data.cw_volume_m3 != null ? String(data.cw_volume_m3) : '',
          cw_hours_run: data.cw_hours_run != null ? String(data.cw_hours_run) : '',
          rw_volume_m3: data.rw_volume_m3 != null ? String(data.rw_volume_m3) : '',
          rw_hours_run: data.rw_hours_run != null ? String(data.rw_hours_run) : '',
          load_shedding_hours: data.load_shedding_hours != null ? String(data.load_shedding_hours) : '0',
          other_downtime_hours: data.other_downtime_hours != null ? String(data.other_downtime_hours) : '0',
          reason_for_downtime: data.reason_for_downtime || '',
          alum_kg: data.alum_kg != null ? String(data.alum_kg) : '0',
          hth_kg: data.hth_kg != null ? String(data.hth_kg) : '0',
          activated_carbon_kg: data.activated_carbon_kg != null ? String(data.activated_carbon_kg) : '0',
          new_connections: data.new_connections != null ? String(data.new_connections) : '0',
          new_connection_category: data.new_connection_category || '',
          meters_serviced: data.meters_serviced != null ? String(data.meters_serviced) : '0',
          notes: data.notes || ''
        });
      }
    } catch (error) {
      console.error('Error loading log:', error);
      setError('Failed to load production log');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigateBack(navigate, location, '/clearwater?tab=production');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isDateEditable) {
      setError(`Production logs for ${formatDateForDisplay(formData.date)} cannot be edited. Logs become available for editing on ${formatDateForDisplay(getEditableUntilDate(formData.date))}.`);
      return;
    }

    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    setSaving(true);
    setError('');

    try {
      const logData = {
        station_id: stationId || (id ? undefined : ''),
        date: formData.date,
        cw_volume_m3: parseFloat(formData.cw_volume_m3) || 0,
        cw_hours_run: parseFloat(formData.cw_hours_run) || 0,
        rw_volume_m3: parseFloat(formData.rw_volume_m3) || 0,
        rw_hours_run: parseFloat(formData.rw_hours_run) || 0,
        load_shedding_hours: parseFloat(formData.load_shedding_hours) || 0,
        other_downtime_hours: parseFloat(formData.other_downtime_hours) || 0,
        reason_for_downtime: formData.reason_for_downtime,
        alum_kg: parseFloat(formData.alum_kg) || 0,
        hth_kg: parseFloat(formData.hth_kg) || 0,
        activated_carbon_kg: parseFloat(formData.activated_carbon_kg) || 0,
        new_connections: parseInt(formData.new_connections) || 0,
        new_connection_category: formData.new_connection_category || null,
        meters_serviced: parseInt(formData.meters_serviced) || 0,
        notes: formData.notes,
        created_by: user?.id
      };

      if (isEditMode && id) {
        const { error: updateError } = await supabase
          .from('production_logs')
          .update(logData)
          .eq('id', id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('production_logs')
          .insert([logData]);

        if (insertError) {
          if (insertError.message?.includes('duplicate key')) {
            throw new Error('A production log already exists for this station and date.');
          }
          throw insertError;
        }
      }

      handleBack();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the production log');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isBoreholeStation = stationType === 'Borehole';

  const cwVolume = parseFloat(formData.cw_volume_m3) || 0;
  const cwHours = parseFloat(formData.cw_hours_run) || 0;
  const cwPumpRate = cwHours > 0 ? (cwVolume / cwHours).toFixed(2) : null;

  const rwVolume = parseFloat(formData.rw_volume_m3) || 0;
  const rwHours = parseFloat(formData.rw_hours_run) || 0;
  const rwPumpRate = rwHours > 0 ? (rwVolume / rwHours).toFixed(2) : null;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading production log...</p>
      </div>
    );
  }

  const fields = [
    { key: 'date', label: 'Date', type: 'date', required: true, col: 0 },
    ...(!isBoreholeStation ? [
      { key: 'rw_volume_m3', label: 'RW Volume (m³)', type: 'number', step: '0.01', col: 0 },
      { key: 'rw_hours_run', label: 'RW Hours Run', type: 'number', step: '0.1', min: '0', max: '24', col: 0 }
    ] : []),
    { key: 'cw_volume_m3', label: 'CW Volume (m³)', type: 'number', step: '0.01', required: true, col: 0 },
    { key: 'cw_hours_run', label: 'CW Hours Run', type: 'number', step: '0.1', min: '0', max: '24', required: true, col: 0 },
    { key: 'target_hours_display', label: 'Target Daily Operating Hours', type: 'display', col: 0, displayValue: targetDailyHours },
    { key: 'load_shedding_hours', label: 'Load Shedding Hours', type: 'number', step: '0.1', min: '0', max: '24', col: 0 },
    { key: 'other_downtime_hours', label: 'Other Downtime Hours', type: 'number', step: '0.1', min: '0', max: '24', col: 0 },
    { key: 'reason_for_downtime', label: 'Reason for Downtime', type: 'text', col: 0 },
    { key: 'alum_kg', label: 'Alum Used (kg)', type: 'number', step: '0.01', col: 0 },
    { key: 'hth_kg', label: 'HTH Used (kg)', type: 'number', step: '0.01', col: 0 },
    { key: 'activated_carbon_kg', label: 'Activated Carbon (kg)', type: 'number', step: '0.01', col: 0 },
    { key: 'new_connections', label: 'New Connections', type: 'number', step: '1', min: '0', col: 0 },
    { key: 'new_connection_category', label: 'New Connection Category', type: 'text', col: 0 },
    { key: 'meters_serviced', label: 'Meters Serviced', type: 'number', step: '1', min: '0', col: 0 },
    { key: 'notes', label: 'Notes', type: 'textarea', col: 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Back to previous page (ESC)"
        >
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit' : 'Add'} Production Log
          </h1>
          <p className="text-gray-600 mt-1">
            {stationName && <span className="font-medium">{stationName}</span>}
            {isEditMode ? ' - Update production log entry' : ' - Record daily production data'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {!isDateEditable && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Cannot Edit This Date</p>
              <p className="text-sm text-amber-800 mt-1">
                Production logs for {formatDateForDisplay(formData.date)} cannot be edited today. Logs become editable starting {formatDateForDisplay(getEditableUntilDate(formData.date))}.
              </p>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit(e as any);
                  }}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed ml-4"
                >
                  <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className={excelTableClassName}>
              <thead>
                <tr>
                  <th className={excelHeaderClassName}>Field</th>
                  <th className={excelHeaderClassName}>Value</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => (
                  <tr key={field.key} className="bg-white hover:bg-gray-50">
                    <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </td>
                    <td className="px-3 py-2 border border-gray-300">
                      {field.type === 'display' ? (
                        <div className="px-3 py-2 bg-gray-50 rounded border border-gray-200 text-gray-700 font-medium">
                          {field.displayValue} hours
                        </div>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          disabled={!isDateEditable}
                          value={formData[field.key as keyof FormData]}
                          onChange={(e) => handleChange(field.key as keyof FormData, e.target.value)}
                          onKeyDown={(e) => handleKeyNavigation(e, idx, field.col, fields.length, 1)}
                          data-row={idx}
                          data-col={field.col}
                          rows={3}
                          className={`${excelCellClassName} ${!isDateEditable ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                        />
                      ) : (
                        <input
                          disabled={!isDateEditable}
                          type={field.type}
                          value={formData[field.key as keyof FormData]}
                          onChange={(e) => handleChange(field.key as keyof FormData, e.target.value)}
                          onKeyDown={(e) => handleKeyNavigation(e, idx, field.col, fields.length, 1)}
                          onFocus={(e) => e.target.select()}
                          data-row={idx}
                          data-col={field.col}
                          required={field.required}
                          step={(field as any).step}
                          min={(field as any).min}
                          max={(field as any).max}
                          className={`${excelCellClassName} ${!isDateEditable ? 'bg-gray-100 cursor-not-allowed opacity-60' : ''}`}
                        />
                      )}
                      {field.key === 'cw_hours_run' && cwPumpRate && (
                        <p className="mt-1 text-xs text-gray-600">
                          Pump rate: <span className="font-semibold text-blue-600">{cwPumpRate} m³/hr</span>
                        </p>
                      )}
                      {field.key === 'rw_hours_run' && rwPumpRate && (
                        <p className="mt-1 text-xs text-gray-600">
                          Pump rate: <span className="font-semibold text-blue-600">{rwPumpRate} m³/hr</span>
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Use Arrow keys (↑↓) to navigate between fields, Tab to move forward, Shift+Tab to move backward, ESC to go back
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isDateEditable}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {saving ? (isEditMode ? 'Updating...' : 'Saving...') : (isEditMode ? 'Update Log' : 'Save Log')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
