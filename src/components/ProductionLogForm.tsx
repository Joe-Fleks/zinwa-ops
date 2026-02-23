import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getYesterdayString } from '../lib/dateUtils';
import { handleKeyNavigation, excelCellClassName, excelTableClassName, excelHeaderClassName } from '../lib/excelFormUtils';
import { CLIENT_CATEGORIES } from '../lib/stationFATConfig';

interface ProductionLogFormProps {
  stationId: string;
  logId?: string;
  onClose: () => void;
  onSave: () => void;
}

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


export default function ProductionLogForm({ stationId, logId, onClose, onSave }: ProductionLogFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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

  useEffect(() => {
    loadStation();
  }, [stationId]);

  useEffect(() => {
    if (logId) {
      loadLog();
    }
  }, [logId]);

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
        .eq('id', logId)
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
      setSaveStatus({ type: 'error', message: 'Failed to load production log' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);

    try {
      const logData = {
        station_id: stationId,
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

      if (logId) {
        const { error } = await supabase
          .from('production_logs')
          .update(logData)
          .eq('id', logId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('production_logs')
          .insert([logData]);

        if (error) throw error;
      }

      setSaveStatus({ type: 'success', message: 'Production log saved successfully!' });
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    } catch (error: any) {
      console.error('Error saving log:', error);
      if (error.message?.includes('duplicate key')) {
        setSaveStatus({ type: 'error', message: 'A production log already exists for this station and date.' });
      } else {
        setSaveStatus({ type: 'error', message: error.message || 'Failed to save production log' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isBoreholeStation = stationType === 'Borehole';

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
    ...(!isBoreholeStation ? [
      { key: 'alum_kg', label: 'Alum (kg)', type: 'number', step: '0.1', col: 0 },
      { key: 'hth_kg', label: 'HTH (kg)', type: 'number', step: '0.1', col: 0 },
      { key: 'activated_carbon_kg', label: 'Activated Carbon (kg)', type: 'number', step: '0.1', col: 0 }
    ] : []),
    { key: 'new_connections', label: 'New Connections', type: 'number', min: '0', col: 0 },
    { key: 'new_connection_category', label: 'Connection Category', type: 'select', col: 0 },
    { key: 'meters_serviced', label: 'Meters Serviced', type: 'number', min: '0', col: 0 },
    { key: 'notes', label: 'Notes', type: 'text', col: 0 }
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-gray-200 rounded-t-lg z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {logId ? 'Edit Production Log' : 'Add Production Log'}
            </h2>
            {stationName && (
              <p className="text-sm text-gray-600 mt-1">
                {stationName}
                {logId && formData.date && ` - ${new Date(formData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
            {saveStatus && (
              <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
                saveStatus.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {saveStatus.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className={`text-sm ${
                  saveStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {saveStatus.message}
                </p>
              </div>
            )}

            <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
              <table className={excelTableClassName}>
                <thead className="sticky top-0 bg-blue-50 z-10">
                  <tr>
                    <th className={`${excelHeaderClassName} w-1/3`}>Field</th>
                    <th className={excelHeaderClassName}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </td>
                      <td className="border border-gray-300 p-0">
                        {(field as any).type === 'display' ? (
                          <div className="px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200">
                            {(field as any).displayValue || 0} hours
                          </div>
                        ) : (field as any).type === 'select' ? (
                          <select
                            value={formData[field.key as keyof FormData]}
                            onChange={(e) => handleChange(field.key as keyof FormData, e.target.value)}
                            onKeyDown={(e) => handleKeyNavigation(e, index, 0, fields.length, 1)}
                            data-row={index}
                            data-col={0}
                            className={excelCellClassName}
                          >
                            <option value="">Select category...</option>
                            {CLIENT_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={(field as any).type}
                            value={formData[field.key as keyof FormData]}
                            onChange={(e) => handleChange(field.key as keyof FormData, e.target.value)}
                            onKeyDown={(e) => handleKeyNavigation(e, index, 0, fields.length, 1)}
                            onFocus={(e) => e.target.select()}
                            data-row={index}
                            data-col={0}
                            step={(field as any).step}
                            min={(field as any).min}
                            max={(field as any).max}
                            required={(field as any).required}
                            className={excelCellClassName}
                            placeholder={(field as any).type === 'text' ? `Enter ${field.label.toLowerCase()}...` : ''}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> Use Arrow keys (↑↓←→) to navigate between fields, Enter to move down, Tab to move to next field
              </p>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {logId ? 'Update Log' : 'Save Log'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
