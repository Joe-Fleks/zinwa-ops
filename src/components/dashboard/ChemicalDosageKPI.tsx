import { useEffect, useState, useMemo } from 'react';
import { FlaskConical, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveScopeFilter } from '../../lib/metrics';
import { fetchChemicalDosageRates } from '../../lib/metrics/chemicalMetrics';
import type { ChemicalDosageSummary } from '../../lib/metrics/chemicalMetrics';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTERS = [
  { label: 'Q1 (Jan–Mar)', months: [1, 2, 3] },
  { label: 'Q2 (Apr–Jun)', months: [4, 5, 6] },
  { label: 'Q3 (Jul–Sep)', months: [7, 8, 9] },
  { label: 'Q4 (Oct–Dec)', months: [10, 11, 12] },
];

type FilterMode = 'monthly' | 'quarterly' | 'yearly';

function fmt(n: number | null, decimals = 3): string {
  if (n === null) return '—';
  return n.toFixed(decimals);
}

function fmtVol(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function DosageBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <div className="flex flex-col items-end">
      <span className="text-xs font-semibold text-gray-800">{fmt(value)}</span>
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}

export default function ChemicalDosageKPI() {
  const { accessContext } = useAuth();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQ = Math.ceil(currentMonth / 3) - 1;

  const [filterMode, setFilterMode] = useState<FilterMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedQuarter, setSelectedQuarter] = useState(currentQ);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [data, setData] = useState<ChemicalDosageSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const months: number[] | null = useMemo(() => {
    if (filterMode === 'monthly') return [selectedMonth];
    if (filterMode === 'quarterly') return QUARTERS[selectedQuarter].months;
    return null;
  }, [filterMode, selectedMonth, selectedQuarter]);

  useEffect(() => {
    if (!accessContext) return;
    const scope = resolveScopeFilter(accessContext);
    setLoading(true);
    setError(null);
    fetchChemicalDosageRates(scope, selectedYear, months)
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [accessContext, selectedYear, months]);

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].filter(y => y <= currentYear);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FlaskConical className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-bold text-gray-800">Chemical Dosage Rates</h3>
        <span className="text-xs text-gray-500">Full Treatment stations only · kg/m³</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          {(['monthly', 'quarterly', 'yearly'] as FilterMode[]).map(m => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`px-3 py-1.5 font-medium transition-colors capitalize ${
                filterMode === m
                  ? 'bg-teal-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {filterMode === 'monthly' && (
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {MONTH_LABELS.map((lbl, i) => (
                <option key={i + 1} value={i + 1} disabled={i + 1 > currentMonth && selectedYear === currentYear}>{lbl}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        {filterMode === 'quarterly' && (
          <div className="relative">
            <select
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(Number(e.target.value))}
              className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
            >
              {QUARTERS.map((q, i) => (
                <option key={i} value={i}>{q.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>
      )}

      {!loading && !error && data && (
        <div className="space-y-3">
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
            <p className="text-[11px] font-bold text-teal-700 uppercase mb-2">SC Summary</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Alum', value: data.scAlumDosage, color: 'text-blue-700' },
                { label: 'HTH', value: data.scHthDosage, color: 'text-green-700' },
                { label: 'Act. Carbon', value: data.scAcDosage, color: 'text-amber-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
                  <p className={`text-base font-bold ${value !== null ? color : 'text-gray-300'}`}>
                    {value !== null ? fmt(value) : '—'}
                  </p>
                  <p className="text-[10px] text-gray-400">g/m³</p>
                </div>
              ))}
            </div>
          </div>

          {data.stations.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">No data for this period</div>
          ) : (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Station</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">CW Vol (m³)</th>
                    <th className="text-right px-2 py-2 font-semibold text-blue-700">Alum (g/m³)</th>
                    <th className="text-right px-2 py-2 font-semibold text-green-700">HTH (g/m³)</th>
                    <th className="text-right px-2 py-2 font-semibold text-amber-700">AC (g/m³)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stations.map((st, i) => (
                    <tr
                      key={st.stationId}
                      className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-800 truncate max-w-[120px]">{st.stationName}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{fmtVol(st.cwVolume)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={st.alumDosage !== null ? 'text-blue-700 font-semibold' : 'text-gray-300'}>{fmt(st.alumDosage)}</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className={st.hthDosage !== null ? 'text-green-700 font-semibold' : 'text-gray-300'}>{fmt(st.hthDosage)}</span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <span className={st.acDosage !== null ? 'text-amber-700 font-semibold' : 'text-gray-300'}>{fmt(st.acDosage)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-gray-400">
            Dosage rate = kg of chemical per m³ of clear water produced × 1,000 (expressed as g/m³)
          </p>
        </div>
      )}

      {!loading && !error && !data && (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <FlaskConical className="w-8 h-8 mb-2 text-gray-200" />
          <p className="text-xs">No data available</p>
        </div>
      )}
    </div>
  );
}
