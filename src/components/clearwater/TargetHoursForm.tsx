import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNetwork } from '../../contexts/NetworkContext';
import { Save, Clock, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

interface Station {
  id: string;
  station_name: string;
  station_type: string;
  target_daily_hours: number;
}

interface TargetHoursFormProps {
  onClose: () => void;
}

export default function TargetHoursForm({ onClose }: TargetHoursFormProps) {
  const { isOnline, showOfflineWarning } = useNetwork();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [modifiedStations, setModifiedStations] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    try {
      const { data, error } = await supabase
        .from('stations')
        .select('id, station_name, station_type, target_daily_hours')
        .order('station_name');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      console.error('Error loading stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHoursChange = (stationId: string, value: string) => {
    const numValue = parseFloat(value) || 0;

    setStations(prev =>
      prev.map(s =>
        s.id === stationId ? { ...s, target_daily_hours: numValue } : s
      )
    );

    setModifiedStations(prev => new Set(prev).add(stationId));
  };

  const handleSaveAll = async () => {
    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      const updates = stations
        .filter(s => modifiedStations.has(s.id))
        .map(s => ({
          id: s.id,
          target_daily_hours: s.target_daily_hours
        }));

      for (const update of updates) {
        const { error } = await supabase
          .from('stations')
          .update({ target_daily_hours: update.target_daily_hours })
          .eq('id', update.id);

        if (error) throw error;
      }

      setSaveStatus({
        type: 'success',
        message: `Successfully updated ${updates.length} station(s)`
      });
      setModifiedStations(new Set());

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error saving target hours:', error);
      setSaveStatus({
        type: 'error',
        message: error.message || 'Failed to save target hours'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startIndex: number) => {
    try {
      console.log('[TargetHoursForm] Paste event triggered at startIndex:', startIndex);
      e.preventDefault();

      const pastedText = e.clipboardData?.getData('text');
      if (!pastedText) {
        console.warn('[TargetHoursForm] Paste warning: no clipboard data');
        return;
      }

      console.log('[TargetHoursForm] Pasted text length:', pastedText.length);

      const lines = pastedText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) {
        console.warn('[TargetHoursForm] Paste warning: no lines to paste');
        return;
      }

      console.log('[TargetHoursForm] Paste lines parsed:', lines.length);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      lines.forEach((line, lineIndex) => {
        try {
          const targetIndex = startIndex + lineIndex;
          if (targetIndex >= stations.length) {
            console.debug('[TargetHoursForm] Paste: target index out of bounds -', targetIndex);
            skipCount++;
            return;
          }

          const value = line.trim().replace(/,/g, '');
          const numValue = parseFloat(value);

          if (isNaN(numValue)) {
            console.debug('[TargetHoursForm] Paste: invalid number value -', value);
            skipCount++;
            return;
          }

          if (numValue < 0 || numValue > 24) {
            console.warn('[TargetHoursForm] Paste: value out of range (0-24) -', numValue);
            skipCount++;
            return;
          }

          const station = stations[targetIndex];
          if (!station) {
            console.error('[TargetHoursForm] Paste error: station not found at index', targetIndex);
            errorCount++;
            return;
          }

          handleHoursChange(station.id, numValue.toString());
          successCount++;
        } catch (lineError) {
          console.error('[TargetHoursForm] Paste error processing line:', lineError);
          errorCount++;
        }
      });

      console.log('[TargetHoursForm] Paste completed - Success:', successCount, 'Skipped:', skipCount, 'Errors:', errorCount);
    } catch (error) {
      console.error('[TargetHoursForm] Paste error (critical):', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.querySelector(`[data-row="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.querySelector(`[data-row="${index - 1}"]`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.querySelector(`[data-row="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      } else {
        handleSaveAll();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to CW Stations"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Target Daily Operating Hours <span className="text-base font-normal text-gray-600">(Set target daily operating hours for each station)</span>
            </h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || modifiedStations.size === 0}
            className="flex items-center gap-2 px-6 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save All Changes
              </>
            )}
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
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

      {modifiedStations.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-900">
            {modifiedStations.size} station(s) modified - Remember to save your changes
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading stations...</p>
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stations found</h3>
            <p className="text-gray-600">Register stations first to set target hours</p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Station Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target Daily Operating Hours
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stations.map((station, index) => (
                  <tr
                    key={station.id}
                    className={`${
                      modifiedStations.has(station.id) ? 'bg-yellow-50' : ''
                    } hover:bg-gray-50 transition-colors`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {station.station_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {station.station_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.1"
                        value={station.target_daily_hours || 0}
                        onChange={(e) => handleHoursChange(station.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onPaste={(e) => handlePaste(e, index)}
                        onFocus={(e) => e.target.select()}
                        data-row={index}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="0.0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
