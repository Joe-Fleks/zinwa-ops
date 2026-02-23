import { useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Loader2,
  Calculator,
  Save,
  RotateCcw,
  Package,
  FlaskConical,
  Download,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CHEMICAL_OPTIONS, getChemicalLabel, getChemicalShortLabel } from '../lib/chemicalStockService';
import type { ChemicalType } from '../lib/chemicalStockService';
import {
  buildDistributionData,
  runEqualization,
  saveDistribution,
} from '../lib/chemicalDistributionService';
import type { StationDistributionData, DistributionResult } from '../lib/chemicalDistributionService';
import DowntimeConfirmationModal from '../components/stockcontrol/DowntimeConfirmationModal';
import DistributionResultsFET from '../components/stockcontrol/DistributionResultsFET';

type Phase = 'input' | 'downtime-confirm' | 'results';

export default function ChemicalDistributor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, accessContext } = useAuth();

  const chemParam = searchParams.get('chemical') as ChemicalType | null;
  const [selectedChemical, setSelectedChemical] = useState<ChemicalType>(
    chemParam && CHEMICAL_OPTIONS.some(c => c.key === chemParam) ? chemParam : 'aluminium_sulphate'
  );
  const [newStockKg, setNewStockKg] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [distData, setDistData] = useState<DistributionResult | null>(null);
  const [targetDays, setTargetDays] = useState(0);
  const [unallocated, setUnallocated] = useState(0);
  const [flaggedStations, setFlaggedStations] = useState<StationDistributionData[]>([]);

  const allowedScIds = accessContext?.allowedServiceCentreIds ?? [];
  const serviceCentreId = accessContext?.scopeType === 'SC' ? accessContext.scopeId : null;

  const goBack = () => {
    const basePath = location.pathname.replace(/\/chemical-distributor.*$/, '');
    navigate(`${basePath}?tab=chemicals&chemical=${selectedChemical}`);
  };

  const handleCalculate = useCallback(async () => {
    if (allowedScIds.length === 0) return;
    const stockVal = parseFloat(newStockKg) || 0;
    if (stockVal < 0) {
      setMessage({ type: 'error', text: 'New stock quantity cannot be negative' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const data = await buildDistributionData(allowedScIds, selectedChemical, stockVal);
      setDistData(data);

      if (data.stations.length > 0) {
        setFlaggedStations(data.stations);
        setPhase('downtime-confirm');
      } else {
        setMessage({ type: 'error', text: 'No stations found for distribution' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to calculate distribution' });
    } finally {
      setLoading(false);
    }
  }, [allowedScIds, selectedChemical, newStockKg]);

  const handleDowntimeConfirm = useCallback((confirmations: Map<string, { rate: number; offlineDays: number }>) => {
    if (!distData) return;

    const updatedStations = distData.stations.map(s => {
      const conf = confirmations.get(s.station_id);
      if (conf) {
        return {
          ...s,
          user_confirmed_rate_kg: conf.rate,
          user_confirmed_offline_days: conf.offlineDays,
        };
      }
      return s;
    });

    const stockVal = parseFloat(newStockKg) || 0;
    const result = runEqualization(updatedStations, stockVal, distData.variance_tolerance_pct);

    setDistData(prev => prev ? {
      ...prev,
      stations: result.stations,
      target_equalization_days: result.targetDays,
      unallocated_kg: result.unallocated,
    } : null);
    setTargetDays(result.targetDays);
    setUnallocated(result.unallocated);
    setPhase('results');
  }, [distData, newStockKg]);

  const handleReset = () => {
    setPhase('input');
    setDistData(null);
    setTargetDays(0);
    setUnallocated(0);
    setFlaggedStations([]);
    setMessage(null);
  };

  const handleExport = () => {
    if (!distData) return;
    const label = getChemicalLabel(selectedChemical);
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2,'0')}-${(today.getMonth()+1).toString().padStart(2,'0')}-${today.getFullYear()}`;

    const headers = ['Station', 'Balance (kg)', 'Usage (kg/day)', 'Days Before', 'Allocate (kg)', 'Days After'];
    const dataRows = distData.stations.map(s => [
      s.station_name,
      s.current_balance_kg.toFixed(1),
      s.projected_daily_usage_kg <= 0 ? 'offline' : s.projected_daily_usage_kg.toFixed(1),
      s.days_remaining_before.toFixed(1),
      s.allocated_kg.toFixed(1),
      s.projected_daily_usage_kg <= 0 ? '-' : s.days_remaining_after.toFixed(1),
    ]);

    const totalBalance = distData.stations.reduce((s, r) => s + r.current_balance_kg, 0);
    const totalUsage = distData.stations.reduce((s, r) => s + r.projected_daily_usage_kg, 0);
    const totalAllocated = distData.stations.reduce((s, r) => s + r.allocated_kg, 0);
    const avgBefore = distData.stations.length > 0
      ? (distData.stations.reduce((s, r) => s + r.days_remaining_before, 0) / distData.stations.length).toFixed(1)
      : '0';
    const avgAfter = distData.stations.length > 0
      ? (distData.stations.reduce((s, r) => s + r.days_remaining_after, 0) / distData.stations.length).toFixed(1)
      : '0';

    const summaryRows = [
      [],
      ['Summary'],
      ['Target Equalization Days', targetDays.toFixed(1)],
      ['Total Allocated (kg)', totalAllocated.toFixed(1)],
      ['Unallocated (kg)', unallocated.toFixed(1)],
    ];

    const csvLines = [
      [`${label} Distribution Plan - ${dateStr}`],
      notes ? [`Notes: ${notes}`] : [],
      [],
      headers,
      ...dataRows,
      ['Total / Average', totalBalance.toFixed(1), totalUsage.toFixed(1), `avg ${avgBefore}`, totalAllocated.toFixed(1), `avg ${avgAfter}`],
      ...summaryRows,
    ].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.replace(/\s+/g, '_')}_Distribution_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!user || !serviceCentreId || !distData) return;
    setSaving(true);
    setMessage(null);

    try {
      await saveDistribution(
        serviceCentreId,
        selectedChemical,
        user.id,
        distData.stations,
        distData.total_available_stock,
        targetDays,
        distData.variance_tolerance_pct,
        notes
      );
      setMessage({ type: 'success', text: 'Distribution plan saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save distribution plan' });
    } finally {
      setSaving(false);
    }
  };

  const label = getChemicalLabel(selectedChemical);
  const shortLabel = getChemicalShortLabel(selectedChemical);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Stock Control
        </button>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Chemical Distributor</h1>
              <p className="text-sm text-gray-500">
                Equalize chemical stock across stations using target operating hours and design capacity
              </p>
            </div>
          </div>
          {phase === 'results' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Recalculate
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Plan
              </button>
            </div>
          )}
        </div>
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {phase === 'input' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-900">Distribution Parameters</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select the chemical type and enter the total new stock to distribute
            </p>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Chemical Type</label>
                <div className="relative">
                  <FlaskConical className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <select
                    value={selectedChemical}
                    onChange={(e) => setSelectedChemical(e.target.value as ChemicalType)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 appearance-none bg-white"
                  >
                    {CHEMICAL_OPTIONS.map(opt => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Stock to Distribute (kg)</label>
                <div className="relative">
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newStockKg}
                    onChange={(e) => setNewStockKg(e.target.value)}
                    placeholder="Enter quantity in kilograms"
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  The algorithm pools existing station balances + this new stock, then equalizes days remaining.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Monthly distribution for February 2026"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <h3 className="text-xs font-semibold text-blue-800 mb-1">How the algorithm works</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>1. Default daily usage = 30-day historical average (calculated from days with both CW {'>'} 0 and RW {'>'} 0)</li>
                <li>2. You can review and adjust the daily usage rate for each station before distribution</li>
                <li>3. Stations with {'>'}50% downtime in the past 48 hours are highlighted for your attention</li>
                <li>4. Stock is distributed to equalize "days remaining" across all stations (water-filling method)</li>
                <li>5. A variance tolerance of {selectedChemical === 'aluminium_sulphate' ? '5%' : '10%'} is applied for practical splitting</li>
              </ul>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
            <button
              onClick={handleCalculate}
              disabled={loading || allowedScIds.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              Calculate Distribution
            </button>
          </div>
        </div>
      )}

      {phase === 'downtime-confirm' && flaggedStations.length > 0 && (
        <DowntimeConfirmationModal
          stations={flaggedStations}
          onConfirm={handleDowntimeConfirm}
          onCancel={handleReset}
        />
      )}

      {phase === 'results' && distData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
              <FlaskConical className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-teal-50 text-teal-700">
              <Package className="w-3 h-3" /> New stock: {parseFloat(newStockKg) || 0} kg
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700">
              Tolerance: {distData.variance_tolerance_pct}%
            </span>
            {distData.stations.some(s => s.downtime_flagged) && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700">
                {distData.stations.filter(s => s.downtime_flagged).length} station(s) downtime-confirmed
              </span>
            )}
          </div>

          <DistributionResultsFET
            stations={distData.stations}
            targetDays={targetDays}
            varianceTolerancePct={distData.variance_tolerance_pct}
            unallocatedKg={unallocated}
          />

          {notes && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-gray-600">Notes: </span>
              <span className="text-xs text-gray-700">{notes}</span>
            </div>
          )}
        </div>
      )}

      {phase === 'input' && !loading && allowedScIds.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
          <p className="text-sm text-gray-500">No service centre access configured. Please contact your administrator.</p>
        </div>
      )}
    </div>
  );
}
