import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { X, RefreshCw } from 'lucide-react';
import { handleKeyNavigation } from '../../lib/excelFormUtils';

interface Dam {
  id: string;
  dam_code: string;
  name: string;
  full_supply_capacity_ml: number;
}

interface MonthlyCapacityFormProps {
  onClose: () => void;
  onSuccess: () => void;
  selectedDamId?: string;
  editData?: {
    id: string;
    dam_id: string;
    month_year: string;
    current_capacity_ml: number;
    notes: string | null;
  };
}

export default function MonthlyCapacityForm({ onClose, onSuccess, selectedDamId, editData }: MonthlyCapacityFormProps) {
  const { user } = useAuth();
  const { isOnline, showOfflineWarning } = useNetwork();
  const [dams, setDams] = useState<Dam[]>([]);
  const [formData, setFormData] = useState({
    dam_id: editData?.dam_id || selectedDamId || '',
    month_year: editData?.month_year ? editData.month_year.substring(0, 7) : '2026-01',
    current_capacity_ml: editData?.current_capacity_ml?.toString() || '',
    notes: editData?.notes || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isEditMode = !!editData;

  useEffect(() => {
    fetchDams();
  }, []);

  const fetchDams = async () => {
    const { data, error } = await supabase
      .from('dams')
      .select('id, dam_code, name, full_supply_capacity_ml')
      .order('name');

    if (data && !error) {
      setDams(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isOnline) {
      showOfflineWarning();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const monthYearDate = `${formData.month_year}-01`;

      if (isEditMode && editData) {
        const { error: updateError } = await supabase
          .from('dam_monthly_capacities')
          .update({
            dam_id: formData.dam_id,
            month_year: monthYearDate,
            current_capacity_ml: parseFloat(formData.current_capacity_ml),
            notes: formData.notes || null
          })
          .eq('id', editData.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('dam_monthly_capacities')
          .insert([{
            dam_id: formData.dam_id,
            month_year: monthYearDate,
            current_capacity_ml: parseFloat(formData.current_capacity_ml),
            notes: formData.notes || null,
            recorded_by: user?.id
          }]);

        if (insertError) {
          if (insertError.message.includes('unique')) {
            throw new Error('A capacity reading for this dam and month already exists');
          }
          throw insertError;
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the capacity reading');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, currentRow: number) => {
    const totalRows = 4;
    handleKeyNavigation(e, currentRow, 0, totalRows, 1);
  };

  const selectedDam = dams.find(d => d.id === formData.dam_id);
  const percentageFull = selectedDam && formData.current_capacity_ml
    ? ((parseFloat(formData.current_capacity_ml) / selectedDam.full_supply_capacity_ml) * 100).toFixed(2)
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b bg-blue-50">
          <h2 className="text-2xl font-bold text-gray-800">
            {isEditMode ? 'Edit' : 'Add'} Monthly Capacity Reading
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

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
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed ml-4"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                    Field
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900">
                    Select Dam <span className="text-red-500">*</span>
                  </td>
                  <td className="px-3 py-2 border border-gray-300">
                    <select
                      name="dam_id"
                      required
                      value={formData.dam_id}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 0)}
                      data-row={0}
                      data-col={0}
                      disabled={isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Select a Dam --</option>
                      {dams.map(dam => (
                        <option key={dam.id} value={dam.id}>
                          {dam.dam_code} - {dam.name} (FSC: {dam.full_supply_capacity_ml} ML)
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900">
                    Month & Year <span className="text-red-500">*</span>
                  </td>
                  <td className="px-3 py-2 border border-gray-300">
                    <input
                      type="month"
                      name="month_year"
                      required
                      min="2026-01"
                      value={formData.month_year}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 1)}
                      data-row={1}
                      data-col={0}
                      disabled={isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900">
                    Current Capacity (ML) <span className="text-red-500">*</span>
                  </td>
                  <td className="px-3 py-2 border border-gray-300">
                    <input
                      type="number"
                      name="current_capacity_ml"
                      required
                      step="0.01"
                      min="0"
                      value={formData.current_capacity_ml}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 2)}
                      onFocus={(e) => e.target.select()}
                      data-row={2}
                      data-col={0}
                      placeholder="e.g., 1200.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {percentageFull && (
                      <p className="mt-1 text-xs text-gray-600">
                        This represents <span className="font-semibold text-blue-600">{percentageFull}%</span> of full supply capacity
                      </p>
                    )}
                  </td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="px-3 py-2 border border-gray-300 font-medium text-gray-900 align-top">
                    Notes
                  </td>
                  <td className="px-3 py-2 border border-gray-300">
                    <textarea
                      name="notes"
                      rows={3}
                      value={formData.notes}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, 3)}
                      data-row={3}
                      data-col={0}
                      placeholder="Any additional information about this reading..."
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Use Arrow keys (↑↓) to navigate between fields, Tab to move forward, Shift+Tab to move backward
            </p>
          </div>

          <div className="flex justify-end gap-4 pt-6 border-t mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-300 text-blue-900 rounded-lg hover:bg-blue-400 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              {loading ? (isEditMode ? 'Updating...' : 'Adding...') : (isEditMode ? 'Update Reading' : 'Add Reading')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
