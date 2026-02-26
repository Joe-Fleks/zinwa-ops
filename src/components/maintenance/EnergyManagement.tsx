import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus, Pencil, Save, X, Trash2, Loader2, Zap, ChevronDown, ChevronRight,
  Gauge, DollarSign, AlertTriangle, Cable,
} from 'lucide-react';

interface Station {
  id: string;
  station_name: string;
  service_centre_id: string;
}

interface Motor {
  id: string;
  station_id: string;
  tag_number: string;
  motor_use: string;
  kw_rating: number;
  manufacturer: string;
  model: string;
  duty_status: string;
}

interface EnergyMeter {
  id: string;
  station_id: string;
  service_centre_id: string;
  meter_number: string;
  meter_name: string;
  account_number: string;
  tariff_rate_per_kwh: number;
}

interface MeterEquipmentLink {
  id: string;
  meter_id: string;
  motor_id: string;
}

interface EnergyBill {
  id: string;
  meter_id: string;
  year: number;
  month: number;
  actual_bill_amount: number;
  actual_kwh: number;
  notes: string;
}

interface ProductionHours {
  station_id: string;
  cw_hours_run: number;
  rw_hours_run: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number, decimals = 0): string {
  return Number(n).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function EnergyManagement() {
  const { user, accessContext } = useAuth();

  const [stations, setStations] = useState<Station[]>([]);
  const [motors, setMotors] = useState<Motor[]>([]);
  const [meters, setMeters] = useState<EnergyMeter[]>([]);
  const [meterLinks, setMeterLinks] = useState<MeterEquipmentLink[]>([]);
  const [bills, setBills] = useState<EnergyBill[]>([]);
  const [prodHours, setProdHours] = useState<ProductionHours[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const [showMeterForm, setShowMeterForm] = useState(false);
  const [editingMeter, setEditingMeter] = useState<EnergyMeter | null>(null);
  const [meterForm, setMeterForm] = useState({
    station_id: '', meter_number: '', meter_name: '', account_number: '', tariff_rate_per_kwh: 0,
  });

  const [expandedMeterId, setExpandedMeterId] = useState<string | null>(null);
  const [editingBillMeterId, setEditingBillMeterId] = useState<string | null>(null);
  const [billForm, setBillForm] = useState({ actual_bill_amount: 0, actual_kwh: 0, notes: '' });

  const [assignMotorMeterId, setAssignMotorMeterId] = useState<string | null>(null);
  const [selectedMotorId, setSelectedMotorId] = useState('');

  const allowedSCIds = useMemo(
    () => accessContext?.allowedServiceCentreIds || [],
    [accessContext]
  );
  const serviceCentreId = useMemo(
    () => (accessContext?.scopeType === 'service_centre' ? accessContext.scopeId : null) || allowedSCIds[0] || null,
    [accessContext, allowedSCIds]
  );

  const availableYears = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: current - 2019 }, (_, i) => 2020 + i).reverse();
  }, []);

  const loadData = useCallback(async () => {
    if (allowedSCIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      let stQ = supabase.from('stations').select('id, station_name, service_centre_id').order('station_name');
      if (allowedSCIds.length <= 50) stQ = stQ.in('service_centre_id', allowedSCIds);
      const { data: stData } = await stQ;
      const stList = stData || [];
      setStations(stList);
      const stationIds = stList.map(s => s.id);

      let motorQ = supabase.from('equipment_motors').select('id, station_id, tag_number, motor_use, kw_rating, manufacturer, model, duty_status').order('tag_number');
      if (allowedSCIds.length <= 50) motorQ = motorQ.in('service_centre_id', allowedSCIds);
      const { data: motorData } = await motorQ;
      setMotors(motorData || []);

      let meterQ = supabase.from('energy_meters').select('*').order('meter_name');
      if (allowedSCIds.length <= 50) meterQ = meterQ.in('service_centre_id', allowedSCIds);
      const { data: meterData } = await meterQ;
      setMeters(meterData || []);

      const meterIds = (meterData || []).map(m => m.id);

      if (meterIds.length > 0) {
        const { data: linkData } = await supabase
          .from('energy_meter_equipment').select('*').in('meter_id', meterIds);
        setMeterLinks(linkData || []);

        const { data: billData } = await supabase
          .from('energy_bills').select('*').in('meter_id', meterIds)
          .eq('year', selectedYear).eq('month', selectedMonth);
        setBills(billData || []);
      } else {
        setMeterLinks([]);
        setBills([]);
      }

      if (stationIds.length > 0) {
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const endDay = new Date(selectedYear, selectedMonth, 0).getDate();
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        const { data: logData } = await supabase
          .from('production_logs')
          .select('station_id, cw_hours_run, rw_hours_run')
          .in('station_id', stationIds)
          .gte('date', startDate)
          .lte('date', endDate);

        const aggMap = new Map<string, { cw: number; rw: number }>();
        for (const log of (logData || [])) {
          const ex = aggMap.get(log.station_id) || { cw: 0, rw: 0 };
          ex.cw += Number(log.cw_hours_run) || 0;
          ex.rw += Number(log.rw_hours_run) || 0;
          aggMap.set(log.station_id, ex);
        }
        const hrs: ProductionHours[] = [];
        for (const [sid, v] of aggMap) {
          hrs.push({ station_id: sid, cw_hours_run: v.cw, rw_hours_run: v.rw });
        }
        setProdHours(hrs);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load energy data');
    } finally {
      setLoading(false);
    }
  }, [allowedSCIds, selectedYear, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s])), [stations]);
  const motorMap = useMemo(() => new Map(motors.map(m => [m.id, m])), [motors]);

  const hoursMap = useMemo(() => {
    const m = new Map<string, { cw: number; rw: number }>();
    for (const h of prodHours) m.set(h.station_id, { cw: h.cw_hours_run, rw: h.rw_hours_run });
    return m;
  }, [prodHours]);

  const computeEstimatedKWh = useCallback((meterId: string) => {
    const linkedMotorIds = meterLinks.filter(l => l.meter_id === meterId).map(l => l.motor_id);
    const meter = meters.find(m => m.id === meterId);
    if (!meter) return 0;
    const stHours = hoursMap.get(meter.station_id);
    if (!stHours) return 0;

    let totalKWh = 0;
    for (const mid of linkedMotorIds) {
      const motor = motorMap.get(mid);
      if (!motor) continue;
      const kw = Number(motor.kw_rating) || 0;
      const isRW = motor.motor_use === 'RW Pump';
      const hours = isRW ? stHours.rw : stHours.cw;
      totalKWh += kw * hours;
    }
    return totalKWh;
  }, [meterLinks, meters, hoursMap, motorMap]);

  const computeEstimatedCost = useCallback((meterId: string) => {
    const meter = meters.find(m => m.id === meterId);
    if (!meter) return 0;
    return computeEstimatedKWh(meterId) * (Number(meter.tariff_rate_per_kwh) || 0);
  }, [meters, computeEstimatedKWh]);

  const handleSaveMeter = async () => {
    if (!user || !serviceCentreId) return;
    if (!meterForm.station_id || !meterForm.meter_number) {
      setError('Station and meter number are required'); return;
    }
    setSaving(true);
    setError('');
    try {
      const record = {
        station_id: meterForm.station_id,
        service_centre_id: serviceCentreId,
        meter_number: meterForm.meter_number,
        meter_name: meterForm.meter_name,
        account_number: meterForm.account_number,
        tariff_rate_per_kwh: meterForm.tariff_rate_per_kwh,
        updated_at: new Date().toISOString(),
      };

      if (editingMeter) {
        const { error: err } = await supabase.from('energy_meters').update(record).eq('id', editingMeter.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('energy_meters').insert([{ ...record, created_by: user.id }]);
        if (err) throw err;
      }
      setShowMeterForm(false);
      setEditingMeter(null);
      setMeterForm({ station_id: '', meter_number: '', meter_name: '', account_number: '', tariff_rate_per_kwh: 0 });
      setSaveMsg('Meter saved');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to save meter');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeter = async (meterId: string) => {
    if (!confirm('Delete this meter and all associated bills and equipment links?')) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from('energy_meters').delete().eq('id', meterId);
      if (err) throw err;
      setSaveMsg('Meter deleted');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to delete meter');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignMotor = async (meterId: string) => {
    if (!selectedMotorId) return;
    setSaving(true);
    try {
      const { error: err } = await supabase.from('energy_meter_equipment').insert([{
        meter_id: meterId,
        motor_id: selectedMotorId,
      }]);
      if (err) throw err;
      setAssignMotorMeterId(null);
      setSelectedMotorId('');
      setSaveMsg('Motor assigned to meter');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to assign motor');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMotorLink = async (linkId: string) => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from('energy_meter_equipment').delete().eq('id', linkId);
      if (err) throw err;
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to remove motor link');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBill = async (meterId: string) => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const existing = bills.find(b => b.meter_id === meterId);
      const record = {
        meter_id: meterId,
        year: selectedYear,
        month: selectedMonth,
        actual_bill_amount: billForm.actual_bill_amount,
        actual_kwh: billForm.actual_kwh,
        notes: billForm.notes,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: err } = await supabase.from('energy_bills').update(record).eq('id', existing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('energy_bills').insert([{ ...record, created_by: user.id }]);
        if (err) throw err;
      }
      setEditingBillMeterId(null);
      setSaveMsg('Bill saved');
      setTimeout(() => setSaveMsg(''), 2000);
      await loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  const openEditMeter = (meter: EnergyMeter) => {
    setEditingMeter(meter);
    setMeterForm({
      station_id: meter.station_id,
      meter_number: meter.meter_number,
      meter_name: meter.meter_name,
      account_number: meter.account_number,
      tariff_rate_per_kwh: meter.tariff_rate_per_kwh,
    });
    setShowMeterForm(true);
  };

  const openNewMeter = () => {
    setEditingMeter(null);
    setMeterForm({ station_id: '', meter_number: '', meter_name: '', account_number: '', tariff_rate_per_kwh: 0 });
    setShowMeterForm(true);
  };

  const openBillEdit = (meterId: string) => {
    const existing = bills.find(b => b.meter_id === meterId);
    setBillForm({
      actual_bill_amount: existing?.actual_bill_amount || 0,
      actual_kwh: existing?.actual_kwh || 0,
      notes: existing?.notes || '',
    });
    setEditingBillMeterId(meterId);
  };

  const metersByStation = useMemo(() => {
    const grouped = new Map<string, EnergyMeter[]>();
    for (const m of meters) {
      const list = grouped.get(m.station_id) || [];
      list.push(m);
      grouped.set(m.station_id, list);
    }
    return grouped;
  }, [meters]);

  const stationsWithMeters = useMemo(() => {
    const stIds = new Set(meters.map(m => m.station_id));
    return stations.filter(s => stIds.has(s.id));
  }, [stations, meters]);

  const totals = useMemo(() => {
    let estKWh = 0, estCost = 0, actBill = 0, actKWh = 0;
    for (const m of meters) {
      estKWh += computeEstimatedKWh(m.id);
      estCost += computeEstimatedCost(m.id);
      const bill = bills.find(b => b.meter_id === m.id);
      if (bill) {
        actBill += Number(bill.actual_bill_amount) || 0;
        actKWh += Number(bill.actual_kwh) || 0;
      }
    }
    return { estKWh, estCost, actBill, actKWh };
  }, [meters, bills, computeEstimatedKWh, computeEstimatedCost]);

  const variancePct = totals.estCost > 0
    ? ((totals.actBill - totals.estCost) / totals.estCost) * 100
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading energy data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {saveMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-xs">{saveMsg}</div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="flex-1" />
        <button onClick={openNewMeter}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-300 hover:bg-blue-400 text-blue-900 text-xs font-semibold rounded transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Meter
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={<Zap className="w-4 h-4 text-amber-600" />} label="Est. Consumption" value={`${fmt(totals.estKWh, 0)} kWh`} />
        <SummaryCard icon={<DollarSign className="w-4 h-4 text-green-600" />} label="Est. Cost" value={`$${fmt(totals.estCost, 2)}`} />
        <SummaryCard icon={<DollarSign className="w-4 h-4 text-blue-600" />} label="Actual ZESA Bill" value={`$${fmt(totals.actBill, 2)}`} />
        <SummaryCard
          icon={<Gauge className="w-4 h-4 text-gray-600" />}
          label="Variance"
          value={`${variancePct >= 0 ? '+' : ''}${fmt(variancePct, 1)}%`}
          valueColor={Math.abs(variancePct) <= 10 ? 'text-green-700' : Math.abs(variancePct) <= 25 ? 'text-amber-700' : 'text-red-700'}
        />
      </div>

      {meters.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Cable className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No energy meters registered</p>
          <p className="text-xs mt-1">Click "Add Meter" to register a ZESA meter and assign equipment to it.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stationsWithMeters.map(station => {
            const stMeters = metersByStation.get(station.id) || [];
            return (
              <div key={station.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">{station.station_name}</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {stMeters.map(meter => {
                    const isExpanded = expandedMeterId === meter.id;
                    const links = meterLinks.filter(l => l.meter_id === meter.id);
                    const estKWh = computeEstimatedKWh(meter.id);
                    const estCost = computeEstimatedCost(meter.id);
                    const bill = bills.find(b => b.meter_id === meter.id);
                    const actAmt = Number(bill?.actual_bill_amount) || 0;
                    const actKWh = Number(bill?.actual_kwh) || 0;
                    const meterVariance = estCost > 0 ? ((actAmt - estCost) / estCost) * 100 : 0;
                    const stHours = hoursMap.get(meter.station_id);
                    const totalHrs = (stHours?.cw || 0) + (stHours?.rw || 0);
                    const isAssigning = assignMotorMeterId === meter.id;
                    const isEditingBill = editingBillMeterId === meter.id;
                    const stMotors = motors.filter(m => m.station_id === meter.station_id);
                    const assignedMotorIds = new Set(links.map(l => l.motor_id));
                    const unassignedMotors = stMotors.filter(m => !assignedMotorIds.has(m.id));

                    return (
                      <div key={meter.id}>
                        <div
                          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => setExpandedMeterId(isExpanded ? null : meter.id)}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                          <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800">{meter.meter_name || meter.meter_number}</span>
                              {meter.meter_name && <span className="text-[10px] text-gray-400">#{meter.meter_number}</span>}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {links.length} motor{links.length !== 1 ? 's' : ''} linked | {fmt(totalHrs, 1)} hrs run | Tariff: ${fmt(meter.tariff_rate_per_kwh, 4)}/kWh
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-right flex-shrink-0">
                            <div>
                              <div className="text-[10px] text-gray-400 uppercase">Estimated</div>
                              <div className="text-xs font-semibold text-gray-700">${fmt(estCost, 2)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-gray-400 uppercase">Actual</div>
                              <div className="text-xs font-semibold text-gray-700">{actAmt > 0 ? `$${fmt(actAmt, 2)}` : '---'}</div>
                            </div>
                            {actAmt > 0 && (
                              <div>
                                <div className="text-[10px] text-gray-400 uppercase">Var.</div>
                                <div className={`text-xs font-bold ${Math.abs(meterVariance) <= 10 ? 'text-green-600' : Math.abs(meterVariance) <= 25 ? 'text-amber-600' : 'text-red-600'}`}>
                                  {meterVariance >= 0 ? '+' : ''}{fmt(meterVariance, 1)}%
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button onClick={() => openEditMeter(meter)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors">
                                <Pencil className="w-3 h-3" /> Edit Meter
                              </button>
                              <button onClick={() => handleDeleteMeter(meter.id)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                              <button onClick={() => openBillEdit(meter.id)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors">
                                <DollarSign className="w-3 h-3" /> {bill ? 'Edit' : 'Add'} Bill
                              </button>
                              <button onClick={() => { setAssignMotorMeterId(isAssigning ? null : meter.id); setSelectedMotorId(''); }}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                                <Plus className="w-3 h-3" /> Assign Motor
                              </button>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center">
                              <MiniStat label="Est. kWh" value={fmt(estKWh, 0)} />
                              <MiniStat label="Est. Cost" value={`$${fmt(estCost, 2)}`} />
                              <MiniStat label="Actual kWh" value={actKWh > 0 ? fmt(actKWh, 0) : '---'} />
                              <MiniStat label="Actual Bill" value={actAmt > 0 ? `$${fmt(actAmt, 2)}` : '---'} />
                            </div>

                            {isEditingBill && (
                              <div className="bg-white border border-gray-200 rounded p-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700">ZESA Bill - {MONTH_SHORT[selectedMonth - 1]} {selectedYear}</p>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-medium">Bill Amount ($)</label>
                                    <input type="number" step="0.01" value={billForm.actual_bill_amount || ''}
                                      onChange={e => setBillForm(p => ({ ...p, actual_bill_amount: Number(e.target.value) || 0 }))}
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-medium">Actual kWh</label>
                                    <input type="number" step="0.01" value={billForm.actual_kwh || ''}
                                      onChange={e => setBillForm(p => ({ ...p, actual_kwh: Number(e.target.value) || 0 }))}
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-medium">Notes</label>
                                    <input type="text" value={billForm.notes}
                                      onChange={e => setBillForm(p => ({ ...p, notes: e.target.value }))}
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                                  </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button onClick={() => handleSaveBill(meter.id)} disabled={saving}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-semibold rounded disabled:opacity-50">
                                    <Save className="w-3 h-3" /> Save
                                  </button>
                                  <button onClick={() => setEditingBillMeterId(null)}
                                    className="px-2.5 py-1 text-[10px] text-gray-600 hover:text-gray-900">Cancel</button>
                                </div>
                              </div>
                            )}

                            {isAssigning && (
                              <div className="bg-white border border-blue-200 rounded p-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-700">Assign Motor to Meter</p>
                                {unassignedMotors.length === 0 ? (
                                  <p className="text-xs text-gray-500">All motors at this station are already assigned to this meter.</p>
                                ) : (
                                  <div className="flex gap-2 items-end">
                                    <select value={selectedMotorId} onChange={e => setSelectedMotorId(e.target.value)}
                                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                                      <option value="">Select motor...</option>
                                      {unassignedMotors.map(m => (
                                        <option key={m.id} value={m.id}>
                                          {m.tag_number || 'No tag'} - {m.motor_use} ({m.kw_rating} kW) [{m.duty_status}]
                                        </option>
                                      ))}
                                    </select>
                                    <button onClick={() => handleAssignMotor(meter.id)} disabled={!selectedMotorId || saving}
                                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded disabled:opacity-50">
                                      Assign
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {links.length > 0 && (
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1.5">Linked Motors</p>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Tag</th>
                                      <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Use</th>
                                      <th className="text-right px-2 py-1.5 font-semibold text-gray-600">kW</th>
                                      <th className="text-left px-2 py-1.5 font-semibold text-gray-600">Status</th>
                                      <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Hours</th>
                                      <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Est. kWh</th>
                                      <th className="text-right px-2 py-1.5 font-semibold text-gray-600">Est. Cost</th>
                                      <th className="w-8"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {links.map((link, li) => {
                                      const motor = motorMap.get(link.motor_id);
                                      if (!motor) return null;
                                      const kw = Number(motor.kw_rating) || 0;
                                      const isRW = motor.motor_use === 'RW Pump';
                                      const hrs = isRW ? (stHours?.rw || 0) : (stHours?.cw || 0);
                                      const mkwh = kw * hrs;
                                      const mcost = mkwh * (Number(meter.tariff_rate_per_kwh) || 0);
                                      return (
                                        <tr key={link.id} className={li % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                          <td className="px-2 py-1.5 font-medium">{motor.tag_number || '—'}</td>
                                          <td className="px-2 py-1.5">{motor.motor_use}</td>
                                          <td className="px-2 py-1.5 text-right">{fmt(kw, 1)}</td>
                                          <td className="px-2 py-1.5">{motor.duty_status}</td>
                                          <td className="px-2 py-1.5 text-right">{fmt(hrs, 1)}</td>
                                          <td className="px-2 py-1.5 text-right">{fmt(mkwh, 0)}</td>
                                          <td className="px-2 py-1.5 text-right">${fmt(mcost, 2)}</td>
                                          <td className="px-2 py-1.5 text-center">
                                            <button onClick={() => handleRemoveMotorLink(link.id)} title="Remove"
                                              className="text-red-400 hover:text-red-600">
                                              <X className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showMeterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowMeterForm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-800">{editingMeter ? 'Edit Meter' : 'Add Energy Meter'}</h3>
              <button onClick={() => setShowMeterForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Station *</label>
                <select value={meterForm.station_id} onChange={e => setMeterForm(p => ({ ...p, station_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                  <option value="">Select station...</option>
                  {stations.map(s => <option key={s.id} value={s.id}>{s.station_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Meter Number *</label>
                  <input type="text" value={meterForm.meter_number}
                    onChange={e => setMeterForm(p => ({ ...p, meter_number: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" placeholder="e.g., 04123456789" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Meter Name</label>
                  <input type="text" value={meterForm.meter_name}
                    onChange={e => setMeterForm(p => ({ ...p, meter_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" placeholder="e.g., Main Pump House" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Account Number</label>
                  <input type="text" value={meterForm.account_number}
                    onChange={e => setMeterForm(p => ({ ...p, account_number: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tariff Rate ($/kWh)</label>
                  <input type="number" step="0.0001" value={meterForm.tariff_rate_per_kwh || ''}
                    onChange={e => setMeterForm(p => ({ ...p, tariff_rate_per_kwh: Number(e.target.value) || 0 }))}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" placeholder="0.1350" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200">
              <button onClick={() => setShowMeterForm(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={handleSaveMeter} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {editingMeter ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-gray-500 uppercase font-semibold">{label}</span>
      </div>
      <p className={`text-sm font-bold ${valueColor || 'text-gray-800'}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-100 rounded px-2 py-1.5">
      <div className="text-[9px] text-gray-400 uppercase font-semibold">{label}</div>
      <div className="text-xs font-bold text-gray-700 mt-0.5">{value}</div>
    </div>
  );
}
