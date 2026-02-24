import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2, AlertCircle, CheckCircle2, Save, X, Pencil, Plus, Trash2, Info } from 'lucide-react';

interface TariffRow {
  id: string;
  tariff_type: string;
  category: string | null;
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

const CW_CATEGORIES = ['Domestic', 'Government', 'Parastatal', 'Business', 'Industry', 'Institutions', 'Mines'];

const CW_CATEGORY_COLORS: Record<string, string> = {
  Domestic:     'bg-blue-50 border-blue-200',
  Government:   'bg-emerald-50 border-emerald-200',
  Parastatal:   'bg-teal-50 border-teal-200',
  Business:     'bg-amber-50 border-amber-200',
  Industry:     'bg-orange-50 border-orange-200',
  Institutions: 'bg-sky-50 border-sky-200',
  Mines:        'bg-slate-50 border-slate-200',
};

const CW_HEADER_COLORS: Record<string, string> = {
  Domestic:     'bg-blue-100 text-blue-800',
  Government:   'bg-emerald-100 text-emerald-800',
  Parastatal:   'bg-teal-100 text-teal-800',
  Business:     'bg-amber-100 text-amber-800',
  Industry:     'bg-orange-100 text-orange-800',
  Institutions: 'bg-sky-100 text-sky-800',
  Mines:        'bg-slate-100 text-slate-800',
};

export default function TariffsTab({ tariffType }: TariffsTabProps) {
  const { roles } = useAuth();
  const [rows, setRows] = useState<TariffRow[]>([]);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        .order('category')
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

  const handleAddRow = (category?: string) => {
    const maxSort = editRows.filter(r => r.category === (category || null)).length;
    setEditRows(prev => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        tariff_type: tariffType,
        category: category || null,
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
          category: row.category,
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
          category: row.category,
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

  const typeLabel = tariffType === 'CW' ? 'Clear Water' : 'Raw Water';

  const byCategory = useMemo(() => {
    const map = new Map<string, TariffRow[]>();
    for (const row of rows) {
      const cat = row.category || 'Other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    return map;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400" />
          <p className="text-sm text-gray-500">Official ZINWA tariffs effective June 1, 2023.</p>
        </div>

        {canEdit && !editing && (
          <button
            onClick={handleEdit}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            Edit Tariffs
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-200 text-blue-900 rounded-lg text-sm font-medium hover:bg-blue-300 transition-colors disabled:opacity-60"
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
          tariffType={tariffType}
          onChange={handleFieldChange}
          onAdd={handleAddRow}
          onDelete={handleDeleteRow}
        />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
          <p className="text-sm text-gray-500">No {typeLabel} tariffs configured yet</p>
        </div>
      ) : tariffType === 'CW' ? (
        <CWTariffDisplay byCategory={byCategory} />
      ) : (
        <RWTariffDisplay rows={rows} />
      )}
    </div>
  );
}

function CWTariffDisplay({ byCategory }: { byCategory: Map<string, TariffRow[]> }) {
  const categoriesInOrder = CW_CATEGORIES.filter(c => byCategory.has(c));
  const otherCategories = Array.from(byCategory.keys()).filter(c => !CW_CATEGORIES.includes(c));
  const allCategories = [...categoriesInOrder, ...otherCategories];

  const isFlat = (rows: TariffRow[]) => rows.length === 1 && rows[0].band_label === 'Flat Rate';

  const bandedCategories = allCategories.filter(c => !isFlat(byCategory.get(c) || []));
  const flatCategories = allCategories.filter(c => isFlat(byCategory.get(c) || []));

  const globalBands = useMemo(() => {
    const set = new Set<string>();
    for (const cat of bandedCategories) {
      for (const r of (byCategory.get(cat) || [])) set.add(r.band_label);
    }
    const arr = Array.from(set);
    const catRows = byCategory.get(bandedCategories[0]) || [];
    arr.sort((a, b) => {
      const ai = catRows.findIndex(r => r.band_label === a);
      const bi = catRows.findIndex(r => r.band_label === b);
      return ai - bi;
    });
    return arr;
  }, [bandedCategories, byCategory]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Clear Water Tariffs (USD/m³)</p>
          <span className="text-xs text-gray-400 font-medium">Effective June 1, 2023</span>
        </div>

        {bandedCategories.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap w-36">
                    Band (m³)
                  </th>
                  {bandedCategories.map(cat => (
                    <th key={cat} className={`px-4 py-2.5 text-center text-xs font-bold uppercase whitespace-nowrap ${CW_HEADER_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>
                      {cat === 'Institutions' ? 'Schools & Churches' : cat}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {globalBands.map((bandLabel, idx) => (
                  <tr key={bandLabel} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap text-xs">
                      {bandLabel}
                    </td>
                    {bandedCategories.map(cat => {
                      const catRows = byCategory.get(cat) || [];
                      const band = catRows.find(r => r.band_label === bandLabel);
                      return (
                        <td key={cat} className="px-4 py-2 text-center tabular-nums">
                          {band ? (
                            <span className="font-semibold text-gray-800">${band.tariff_usd_per_m3.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {flatCategories.length > 0 && (
          <div className={`${bandedCategories.length > 0 ? 'border-t border-gray-200' : ''}`}>
            <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Flat Rate Categories</p>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {flatCategories.map(cat => {
                const row = (byCategory.get(cat) || [])[0];
                return (
                  <div key={cat} className={`rounded-lg border px-4 py-3 ${CW_CATEGORY_COLORS[cat] || 'bg-gray-50 border-gray-200'}`}>
                    <p className={`text-xs font-bold uppercase mb-1 ${CW_HEADER_COLORS[cat]?.split(' ')[1] || 'text-gray-700'}`}>{cat}</p>
                    <p className="text-lg font-bold text-gray-900">${row.tariff_usd_per_m3.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">per m³</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 italic px-1">
        Tariff bands apply progressively per connection per month. Industry and Mines apply a flat rate on total consumption.
      </p>
    </div>
  );
}

function RWTariffDisplay({ rows }: { rows: TariffRow[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Raw Water Tariffs</p>
        <span className="text-xs text-gray-400 font-medium">Effective June 1, 2023</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
            <th className="px-5 py-2.5 text-left font-semibold">Category</th>
            <th className="px-5 py-2.5 text-right font-semibold">Tariff (USD / ML)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
              <td className="px-5 py-2.5 font-medium text-gray-800">{row.category || row.band_label}</td>
              <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                ${(row.tariff_usd_per_m3 * 1000).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TariffEditFormProps {
  rows: EditRow[];
  tariffType: 'CW' | 'RW';
  onChange: (index: number, field: keyof EditRow, value: any) => void;
  onAdd: (category?: string) => void;
  onDelete: (index: number) => void;
}

function TariffEditForm({ rows, tariffType, onChange, onAdd, onDelete }: TariffEditFormProps) {
  const visibleRows = rows.filter(r => !r.isDeleted);

  const byCategory = useMemo(() => {
    const map = new Map<string, { row: EditRow; idx: number }[]>();
    rows.forEach((row, idx) => {
      if (row.isDeleted) return;
      const cat = row.category || '_no_cat';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ row, idx });
    });
    return map;
  }, [rows]);

  if (tariffType === 'CW') {
    const categories = CW_CATEGORIES.filter(c => byCategory.has(c));
    const otherCats = Array.from(byCategory.keys()).filter(c => !CW_CATEGORIES.includes(c) && c !== '_no_cat');
    const allCats = [...categories, ...otherCats];

    return (
      <div className="space-y-4">
        {allCats.map(cat => (
          <div key={cat} className={`rounded-lg border overflow-hidden ${CW_CATEGORY_COLORS[cat] || 'bg-gray-50 border-gray-200'}`}>
            <div className={`px-4 py-2 flex items-center justify-between ${CW_HEADER_COLORS[cat] || 'bg-gray-100 text-gray-700'}`}>
              <span className="text-xs font-bold uppercase">{cat === 'Institutions' ? 'Institutions / Schools & Churches' : cat}</span>
              <button
                onClick={() => onAdd(cat)}
                className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100 transition-opacity"
              >
                <Plus className="w-3 h-3" />
                Add Band
              </button>
            </div>
            <EditBandTable
              entries={byCategory.get(cat) || []}
              onChange={onChange}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Band Label</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tariff (USD/m³)</th>
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
                      value={row.category || ''}
                      onChange={e => onChange(actualIndex, 'category', e.target.value || null)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={row.band_label}
                      onChange={e => onChange(actualIndex, 'band_label', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.00001"
                      value={row.tariff_usd_per_m3}
                      onChange={e => onChange(actualIndex, 'tariff_usd_per_m3', Number(e.target.value))}
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={row.sort_order}
                      onChange={e => onChange(actualIndex, 'sort_order', Number(e.target.value))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => onDelete(actualIndex)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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
        onClick={() => onAdd()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Row
      </button>
    </div>
  );
}

function EditBandTable({
  entries,
  onChange,
  onDelete,
}: {
  entries: { row: EditRow; idx: number }[];
  onChange: (index: number, field: keyof EditRow, value: any) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <table className="w-full text-sm bg-white">
      <thead>
        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
          <th className="px-4 py-2 text-left">Band Label</th>
          <th className="px-4 py-2 text-right">Min (m³)</th>
          <th className="px-4 py-2 text-right">Max (m³)</th>
          <th className="px-4 py-2 text-right">Tariff (USD/m³)</th>
          <th className="px-4 py-2 text-right">Order</th>
          <th className="px-4 py-2 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {entries.map(({ row, idx }) => (
          <tr key={row.id} className="hover:bg-gray-50">
            <td className="px-4 py-1.5">
              <input
                type="text"
                value={row.band_label}
                onChange={e => onChange(idx, 'band_label', e.target.value)}
                className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-4 py-1.5">
              <input
                type="number"
                value={row.band_min_m3}
                onChange={e => onChange(idx, 'band_min_m3', Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-4 py-1.5">
              <input
                type="number"
                value={row.band_max_m3 ?? ''}
                onChange={e => onChange(idx, 'band_max_m3', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="Unlimited"
                className="w-20 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-500 placeholder:text-gray-300"
              />
            </td>
            <td className="px-4 py-1.5">
              <input
                type="number"
                step="0.01"
                value={row.tariff_usd_per_m3}
                onChange={e => onChange(idx, 'tariff_usd_per_m3', Number(e.target.value))}
                className="w-24 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-4 py-1.5">
              <input
                type="number"
                value={row.sort_order}
                onChange={e => onChange(idx, 'sort_order', Number(e.target.value))}
                className="w-14 px-2 py-1 border border-gray-200 rounded text-xs text-right focus:ring-1 focus:ring-blue-500"
              />
            </td>
            <td className="px-4 py-1.5">
              <button
                onClick={() => onDelete(idx)}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
