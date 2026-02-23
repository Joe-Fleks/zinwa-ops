import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle2, Save, X, Pencil, Plus, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface TariffRow {
  id: string;
  tariff_type: string;
  band_label: string;
  band_min_m3: number;
  band_max_m3: number | null;
  tariff_usd_per_m3: number;
  sort_order: number;
}

interface EditRow extends TariffRow {
  isNew?: boolean;
  isModified?: boolean;
  isDeleted?: boolean;
}

const TARIFF_EDIT_ROLES = ['CEO', 'Director', 'Global Admin'];

interface TariffsTabProps {
  tariffType: 'CW' | 'RW';
}

export default function TariffsTab({ tariffType }: TariffsTabProps) {
  const { roles } = useAuth();
  const [rows, setRows] = useState<TariffRow[]>([]);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const gridRef = useRef<AgGridReact>(null);

  const canEdit = useMemo(() => {
    return roles.some(r => TARIFF_EDIT_ROLES.includes(r.name));
  }, [roles]);

  const loadTariffs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tariffs')
        .select('*')
        .eq('tariff_type', tariffType)
        .order('sort_order');

      if (error) throw error;
      setRows(data || []);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to load tariffs' });
    } finally {
      setLoading(false);
    }
  }, [tariffType]);

  useEffect(() => {
    loadTariffs();
    setEditing(false);
    setMessage(null);
  }, [loadTariffs]);

  const handleEdit = () => {
    setEditRows(rows.map(r => ({ ...r })));
    setEditing(true);
    setMessage(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditRows([]);
    setMessage(null);
  };

  const handleFieldChange = (index: number, field: keyof EditRow, value: any) => {
    setEditRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, isModified: true };
      return updated;
    });
  };

  const handleAddRow = () => {
    const maxSort = editRows.length > 0 ? Math.max(...editRows.map(r => r.sort_order)) : 0;
    setEditRows(prev => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        tariff_type: tariffType,
        band_label: '',
        band_min_m3: 0,
        band_max_m3: null,
        tariff_usd_per_m3: 0,
        sort_order: maxSort + 1,
        isNew: true,
        isModified: true,
      },
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setEditRows(prev => {
      const updated = [...prev];
      if (updated[index].isNew) {
        updated.splice(index, 1);
      } else {
        updated[index] = { ...updated[index], isDeleted: true };
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const toDelete = editRows.filter(r => r.isDeleted && !r.isNew);
      const toUpsert = editRows.filter(r => !r.isDeleted && r.isModified);
      const toInsert = toUpsert.filter(r => r.isNew);
      const toUpdate = toUpsert.filter(r => !r.isNew);

      for (const row of toDelete) {
        const { error } = await supabase.from('tariffs').delete().eq('id', row.id);
        if (error) throw error;
      }

      for (const row of toInsert) {
        const { error } = await supabase.from('tariffs').insert({
          tariff_type: row.tariff_type,
          band_label: row.band_label,
          band_min_m3: row.band_min_m3,
          band_max_m3: row.band_max_m3,
          tariff_usd_per_m3: row.tariff_usd_per_m3,
          sort_order: row.sort_order,
        });
        if (error) throw error;
      }

      for (const row of toUpdate) {
        const { error } = await supabase.from('tariffs').update({
          band_label: row.band_label,
          band_min_m3: row.band_min_m3,
          band_max_m3: row.band_max_m3,
          tariff_usd_per_m3: row.tariff_usd_per_m3,
          sort_order: row.sort_order,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id);
        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Tariffs saved successfully' });
      setEditing(false);
      await loadTariffs();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save tariffs' });
    } finally {
      setSaving(false);
    }
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Consumption (m\u00B3)',
      field: 'band_label',
      flex: 1,
      minWidth: 180,
      cellClass: 'font-medium',
    },
    {
      headerName: 'Tariff (USD/m\u00B3)',
      field: 'tariff_usd_per_m3',
      type: 'numericColumn',
      minWidth: 160,
      valueFormatter: (params: any) => {
        if (params.value === null || params.value === undefined) return '-';
        return params.value.toFixed(2);
      },
      cellClass: 'font-semibold',
    },
  ], []);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: false,
    filter: false,
    resizable: true,
    suppressMovable: true,
  }), []);

  const typeLabel = tariffType === 'CW' ? 'Clear Water' : 'Raw Water';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-500">Tariffs reset to the first band at the beginning of each month.</p>
        </div>

        {canEdit && !editing && (
          <button
            onClick={handleEdit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading tariffs...</p>
        </div>
      ) : editing ? (
        <TariffEditForm
          rows={editRows}
          onChange={handleFieldChange}
          onAdd={handleAddRow}
          onDelete={handleDeleteRow}
        />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <p className="text-sm text-gray-500">No {typeLabel} tariffs configured yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Zinwa {typeLabel} Tariff Bands</p>
          </div>
          <div className="ag-theme-alpine" style={{ width: '100%' }}>
            <AgGridReact
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              domLayout="autoHeight"
              getRowId={(params) => params.data.id}
              suppressMovableColumns
              animateRows={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface TariffEditFormProps {
  rows: EditRow[];
  onChange: (index: number, field: keyof EditRow, value: any) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
}

function TariffEditForm({ rows, onChange, onAdd, onDelete }: TariffEditFormProps) {
  const visibleRows = rows.filter(r => !r.isDeleted);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Band Label</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Min (m&#179;)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Max (m&#179;)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tariff (USD/m&#179;)</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
              <th className="px-4 py-2.5 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleRows.map((row) => {
              const actualIndex = rows.indexOf(row);
              return (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.band_label}
                      onChange={e => onChange(actualIndex, 'band_label', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.band_min_m3}
                      onChange={e => onChange(actualIndex, 'band_min_m3', Number(e.target.value))}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.band_max_m3 ?? ''}
                      onChange={e => onChange(actualIndex, 'band_max_m3', e.target.value === '' ? null : Number(e.target.value))}
                      placeholder="Unlimited"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.tariff_usd_per_m3}
                      onChange={e => onChange(actualIndex, 'tariff_usd_per_m3', Number(e.target.value))}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.sort_order}
                      onChange={e => onChange(actualIndex, 'sort_order', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onDelete(actualIndex)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      title="Remove band"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Band
      </button>
    </div>
  );
}
