import { Trash2 } from 'lucide-react';
import {
  PumpRow, StationOption, PUMP_TYPES, PUMP_USES, DUTY_STATUSES, CONDITIONS,
} from '../equipmentConfig';

const inputCls = 'w-full px-1.5 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 focus:bg-white rounded';
const selectCls = 'w-full px-1 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-blue-400 focus:bg-white rounded cursor-pointer';

function conditionBadge(c: string) {
  const map: Record<string, string> = {
    Good: 'bg-green-100 text-green-800',
    Fair: 'bg-amber-100 text-amber-800',
    Poor: 'bg-red-100 text-red-800',
    Decommissioned: 'bg-gray-200 text-gray-600',
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[c] || 'bg-gray-100 text-gray-600'}`}>{c}</span>;
}

function expiryBadge(dateStr: string) {
  if (!dateStr) return <span className="text-gray-400 text-xs">--</span>;
  const today = new Date();
  const exp = new Date(dateStr + 'T12:00:00');
  const diffDays = Math.round((exp.getTime() - today.getTime()) / 86400000);
  let cls = 'bg-green-50 text-green-700 border-green-200';
  if (diffDays < 0) cls = 'bg-red-100 text-red-800 border-red-300';
  else if (diffDays <= 90) cls = 'bg-amber-50 text-amber-800 border-amber-200';
  else if (diffDays <= 365) cls = 'bg-blue-50 text-blue-700 border-blue-200';
  return <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>{dateStr}</span>;
}

interface Props {
  rows: PumpRow[];
  stations: StationOption[];
  editing: boolean;
  editRows: PumpRow[];
  onCellChange: (idx: number, field: string, value: any) => void;
  onDelete: (row: PumpRow) => void;
}

export default function PumpsTable({ rows, stations, editing, editRows, onCellChange, onDelete }: Props) {
  if (!editing && rows.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No pump records found. Click "Edit / Add Equipment" to add pumps.</div>;
  }

  const headers = ['Station', 'Tag #', 'Manufacturer', 'Model', 'S/N', 'Type', 'Use', 'Duty', 'Head (m)', 'Q (m\u00B3/hr)', 'RPM', 'Stages', 'Installed', 'Life (yrs)', 'Expiry', 'Condition', 'Notes'];

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
          {(rows as PumpRow[]).map(row => {
            const idx = editRows.indexOf(row);
            const realIdx = idx >= 0 ? idx : editRows.findIndex(r => r.id === row.id);
            if (realIdx < 0) return null;
            return (
              <tr key={row.id || `new_${realIdx}`} className={`border-b border-gray-100 ${row._isNew ? 'bg-blue-50/50' : row._isDirty ? 'bg-amber-50/50' : 'hover:bg-gray-50'}`}>
                <td className="px-1 py-0.5 text-center">
                  <button onClick={() => onDelete(row)} className="text-gray-400 hover:text-red-500 transition-colors p-0.5" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.station_id} onChange={e => onCellChange(realIdx, 'station_id', e.target.value)} className={selectCls} style={{ minWidth: 130 }}>
                    <option value="">Select...</option>
                    {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input value={row.tag_number} onChange={e => onCellChange(realIdx, 'tag_number', e.target.value)} className={inputCls} style={{ minWidth: 80 }} /></td>
                <td className="px-1 py-0.5"><input value={row.manufacturer} onChange={e => onCellChange(realIdx, 'manufacturer', e.target.value)} className={inputCls} style={{ minWidth: 100 }} /></td>
                <td className="px-1 py-0.5"><input value={row.model} onChange={e => onCellChange(realIdx, 'model', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5"><input value={row.serial_number} onChange={e => onCellChange(realIdx, 'serial_number', e.target.value)} className={inputCls} style={{ minWidth: 90 }} /></td>
                <td className="px-1 py-0.5">
                  <select value={row.pump_type} onChange={e => onCellChange(realIdx, 'pump_type', e.target.value)} className={selectCls} style={{ minWidth: 110 }}>
                    <option value="">Select...</option>
                    {PUMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.pump_use} onChange={e => onCellChange(realIdx, 'pump_use', e.target.value)} className={selectCls} style={{ minWidth: 100 }}>
                    <option value="">Select...</option>
                    {PUMP_USES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <select value={row.duty_status} onChange={e => onCellChange(realIdx, 'duty_status', e.target.value)} className={selectCls} style={{ minWidth: 75 }}>
                    <option value="">--</option>
                    {DUTY_STATUSES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td className="px-1 py-0.5"><input type="number" value={row.head_m || ''} onChange={e => onCellChange(realIdx, 'head_m', e.target.value ? parseFloat(e.target.value) : 0)} className={inputCls} style={{ minWidth: 60 }} /></td>
                <td className="px-1 py-0.5"><input type="number" value={row.flow_rate_m3_hr || ''} onChange={e => onCellChange(realIdx, 'flow_rate_m3_hr', e.target.value ? parseFloat(e.target.value) : 0)} className={inputCls} style={{ minWidth: 70 }} /></td>
                <td className="px-1 py-0.5"><input type="number" value={row.speed_rpm || ''} onChange={e => onCellChange(realIdx, 'speed_rpm', e.target.value ? parseInt(e.target.value) : 0)} className={inputCls} style={{ minWidth: 60 }} /></td>
                <td className="px-1 py-0.5"><input type="number" value={row.stages || ''} onChange={e => onCellChange(realIdx, 'stages', e.target.value ? parseInt(e.target.value) : 1)} className={inputCls} style={{ minWidth: 50 }} /></td>
                <td className="px-1 py-0.5"><input type="date" value={row.installation_date} onChange={e => onCellChange(realIdx, 'installation_date', e.target.value)} className={inputCls} style={{ minWidth: 115 }} /></td>
                <td className="px-1 py-0.5"><input type="number" value={row.design_life_years || ''} onChange={e => onCellChange(realIdx, 'design_life_years', e.target.value ? parseInt(e.target.value) : 0)} className={inputCls} style={{ minWidth: 55 }} /></td>
                <td className="px-1 py-0.5 bg-gray-50"><span className="text-xs text-gray-600 whitespace-nowrap">{row.design_life_expiry || '--'}</span></td>
                <td className="px-1 py-0.5">
                  <select value={row.condition} onChange={e => onCellChange(realIdx, 'condition', e.target.value)} className={selectCls} style={{ minWidth: 90 }}>
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
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
            <td className="px-3 py-2 text-gray-600 font-mono">{row.tag_number || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.manufacturer || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.model || '--'}</td>
            <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">{row.serial_number || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.pump_type || '--'}</td>
            <td className="px-3 py-2 text-gray-700">{row.pump_use || '--'}</td>
            <td className="px-3 py-2">{row.duty_status ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.duty_status === 'Duty' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>{row.duty_status}</span> : '--'}</td>
            <td className="px-3 py-2 text-right text-gray-700">{row.head_m || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-700">{row.flow_rate_m3_hr || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-700">{row.speed_rpm || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-700">{row.stages || '--'}</td>
            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.installation_date || '--'}</td>
            <td className="px-3 py-2 text-right text-gray-600">{row.design_life_years || '--'}</td>
            <td className="px-3 py-2 whitespace-nowrap">{expiryBadge(row.design_life_expiry)}</td>
            <td className="px-3 py-2">{conditionBadge(row.condition)}</td>
            <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{row.notes || '--'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
