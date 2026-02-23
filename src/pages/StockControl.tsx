import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FlaskConical, Fuel, ChevronDown } from 'lucide-react';
import ChemicalsTab from '../components/stockcontrol/ChemicalsTab';
import FuelTab from '../components/stockcontrol/FuelTab';
import { CHEMICAL_OPTIONS } from '../lib/chemicalStockService';
import type { ChemicalType } from '../lib/chemicalStockService';

type TabKey = 'chemicals' | 'fuel';
export type FuelType = 'diesel' | 'petrol';

const FUEL_OPTIONS: { key: FuelType; label: string }[] = [
  { key: 'diesel', label: 'Diesel' },
  { key: 'petrol', label: 'Petrol' },
];

export default function StockControl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>('chemicals');
  const [selectedFuel, setSelectedFuel] = useState<FuelType>('diesel');
  const [selectedChemical, setSelectedChemical] = useState<ChemicalType>('aluminium_sulphate');
  const [showFuelDropdown, setShowFuelDropdown] = useState(false);
  const [showChemicalDropdown, setShowChemicalDropdown] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const chemicalParam = searchParams.get('chemical');
    const fuelParam = searchParams.get('fuel');

    if (tabParam && ['chemicals', 'fuel'].includes(tabParam)) {
      setActiveTab(tabParam as TabKey);
    } else if (!tabParam) {
      setActiveTab('chemicals');
    }

    if (chemicalParam && CHEMICAL_OPTIONS.some(c => c.key === chemicalParam)) {
      setSelectedChemical(chemicalParam as ChemicalType);
    }

    if (fuelParam && FUEL_OPTIONS.some(f => f.key === fuelParam)) {
      setSelectedFuel(fuelParam as FuelType);
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        <div className="relative">
          <button
            onClick={() => { setShowChemicalDropdown(!showChemicalDropdown); setShowFuelDropdown(false); }}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'chemicals'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Chemicals
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
          {showChemicalDropdown && (
            <div className="absolute left-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-56 mt-1">
              {CHEMICAL_OPTIONS.map((option, idx) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSelectedChemical(option.key);
                    setActiveTab('chemicals');
                    setSearchParams({ tab: 'chemicals', chemical: option.key });
                    setShowChemicalDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 ${
                    idx === 0 ? 'rounded-t-lg' : ''
                  } ${
                    idx === CHEMICAL_OPTIONS.length - 1 ? 'rounded-b-lg' : 'border-b border-gray-200'
                  }`}
                >
                  <span className="hidden lg:inline">{option.label}</span>
                  <span className="lg:hidden">{option.shortLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setShowFuelDropdown(!showFuelDropdown); setShowChemicalDropdown(false); }}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'fuel'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Fuel className="w-5 h-5" />
              Fuel
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>
          {showFuelDropdown && (
            <div className="absolute left-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48 mt-1">
              {FUEL_OPTIONS.map((option, idx) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSelectedFuel(option.key);
                    setActiveTab('fuel');
                    setSearchParams({ tab: 'fuel', fuel: option.key });
                    setShowFuelDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 ${
                    idx === 0 ? 'rounded-t-lg' : ''
                  } ${
                    idx === FUEL_OPTIONS.length - 1 ? 'rounded-b-lg' : 'border-b border-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'chemicals' && <ChemicalsTab chemicalType={selectedChemical} />}
      {activeTab === 'fuel' && <FuelTab fuelType={selectedFuel} />}
    </div>
  );
}
