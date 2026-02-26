import { Trash2 } from 'lucide-react';
import {
  BikeRow, StationOption, BIKE_TYPES, BIKE_FUEL_TYPES,
  VEHICLE_STATUSES, CONDITIONS,
} from '../equipmentConfig';

const inputCls = 'w-full px-1.5 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 focus:bg-white rounded';
const selectCls = 'w-full px-1 py-1 text-xs border-0 bg-blue-50 focus:ring-1 focus:ring-blue-400 focus:bg-white rounded cursor-pointer';

function conditionBadge(c: string) {
  const map: Record<string, string> = {
    Good: 'bg-green-100 text-green-800',
    Fair: 'bg-amber-100 text-amber-800',
    Poor: 'bg-red-100 text-red-800',
    Decommissioned: 'bg-gray-200 text-gray-600',
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[c] || 'bg-gray-100 text-gray-600'}`}>{c}</span>;
}

function statusBadge(s: string) {
  const cls = s === 'Runner' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{s}</span>;
}

function expiryDateBadge(dateStr: string) {
  if (!dateStr) return <span className="text-gray-400 text-xs">--</span>;
  const today = new Date();
  const exp = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000);
  let cls = 'bg-green-50 text-green-700 border-green-200';
  if (diffDays < 0) cls = 'bg-red-100 text-red-800 border-red-300';
  else if (diffDays <= 30) cls = 'bg-red-50 text-red-700 border-red-200';
  else if (diffDays <= 90) cls = 'bg-amber-50 text-amber-800 border-amber-200';
  return <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>{dateStr}</span>;
}

interface Props {
  rows: BikeRow[];
  stations: StationOption[];
  editing: boolean;
  editRows: BikeRow[];
  onCellChange: (idx: number, field: string, value: any) => void;
  onDelete: (row: BikeRow) => void;
}

export default function BikesTable({ rows, stations, editing, editRows, onCellChange, onDelete }: Props) {
  if (!editing && rows.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No bike records found. Click "Edit / Add Equipment" to add motorbikes or bicycles.</div>;
  }

  const headers = [
    'Station', 'Type', 'Make', 'Model', 'Plate #', 'Engine #', 'Chassis #',
    'Year', 'Fuel', 'Odometer (km)', 'Status', 'ZINARA Exp.',
    'Condition', 'Condition Notes', 'Assigned To', 'Notes',
  ];

  if (editing) {
    return (
      <table className="border-collapse text-xs min-w-max w-full">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-1 py-2 text-left font-semibold text-gray-600 w-8"></th>
            {headers.map(h => (
              <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows as BikeRow[]).map(row => {
            const idx = editRows.indexOf(row);
            const realIdx = idx >= 0 ? idx : editRows.findIndex(r => r.id === row.id);
            if (realIdx < 0) return null;
            return (
              <tr key={row.id || `new_${realIdx}`} className={`border-b border-gray-100 ${row._isNew ? 'bg-blue-50/50' : row._isDirty ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}>
                <td className="px-1 py-0.5 text-center">
                  <button onClick={() => onDelete(row)} className="text-gray-400 hover:text-red-500 transition-colors p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.station_id} onChange={e => onCellChange(realIdx, 'station_id', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
                    <option value="">Select...</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.bike_type} onChange={e => onCellChange(realIdx, 'bike_type', e.target.value)} className={selectCls} style={{ minWidth: 90 }}>
                    {BIKE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input value={row.make} onChange={e => onCellChange(realIdx, 'make', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5"><input value={row.model} onChange={e => onCellChange(realIdx, 'model', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5"><input value={row.number_plate} onChange={e => onCellChange(realIdx, 'number_plate', e.target.value.toUpperCase())} className={inputCls} style={{ minWidth: 90 }} placeholder="Motorbikes only" /></td>
                <td className="px-1 py-0.5"><input value={row.engine_number} onChange={e => onCellChange(realIdx, 'engine_number', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5"><input value={row.chassis_number} onChange={e => onCellChange(realIdx, 'chassis_number', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5"><input type="number" value={row.year_of_manufacture || ''} onChange={e => onCellChange(realIdx, 'year_of_manufacture', e.target.value ? parseInt(e.target.value) : 0)} className={inputCls} style={{ minWidth: 60 }} /></td>
                <td className="px-1 py-0.5">
                  <select value={row.fuel_type} onChange={e => onCellChange(realIdx, 'fuel_type', e.target.value)} className={selectCls} style={{ minWidth: 70 }}>
                    {BIKE_FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input type="number" value={row.odometer_km || ''} onChange={e => onCellChange(realIdx, 'odometer_km', e.target.value ? parseFloat(e.target.value) : 0)} className={inputCls} style={{ minWidth: 70 }} /></td>
                <td className="px-1 py-0.5">
                  <select value={row.status} onChange={e => onCellChange(realIdx, 'status', e.target.value)} className={selectCls} style={{ minWidth: 90 }}>
                    {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input type="date" value={row.zinara_expiry} onChange={e => onCellChange(realIdx, 'zinara_expiry', e.target.value)} className={inputCls} style={{ minWidth: 115 }} /></td>
                <td className="px-1 py-0.5">
                  <select value={row.condition} onChange={e => onCellChange(realIdx, 'condition', e.target.value)} className={selectCls} style={{ minWidth: 90 }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input value={row.condition_comment} onChange={e => onCellChange(realIdx, 'condition_comment', e.target.value)} className={inputCls} style={{ minWidth: 150 }} placeholder="Describe condition..." /></td>
                <td className="px-1 py-0.5"><input value={row.assigned_to} onChange={e => onCellChange(realIdx, 'assigned_to', e.target.value)} className={inputCls} style={{ minWidth: 100 }} /></td>
                <td className="px-1 py-0.5"><input value={row.notes} onChange={e => onCellChange(realIdx, 'notes', e.target.value)} className={inputCls} style={{ minWidth: 100 }} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  return (
    <table className="border-collapse text-xs min-w-max w-full">
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-50 border-b border-gray-200">
          {headers.map(h => (
            <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}>
            <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{row.station_name}</td>
            <td className="px-3 py-2">{row.bike_type === 'Motorbike' ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Motorbike</span> : <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">Bicycle</span>}</td>
            <td className="px-3 py-2 text-gray-700">{row.make || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.model || '--'}</td>
            <td className="px-3 py-2 text-gray-900 font-mono font-semibold">{row.number_plate || '--'}</td>
            <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{row.engine_number || '--'}</td>
            <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{row.chassis_number || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{row.year_of_manufacture || '--'}</td>
            <td className="px-3 py-2 text-gray-600">{row.fuel_type || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-700">{row.odometer_km ? Number(row.odometer_km).toLocaleString() : '--'}</td>
            <td className="px-3 py-2">{statusBadge(row.status)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{expiryDateBadge(row.zinara_expiry)}</td>
            <td className="px-3 py-2">{conditionBadge(row.condition)}</td>
            <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{row.condition_comment || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.assigned_to || '--'}</td>
            <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{row.notes || '--'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
