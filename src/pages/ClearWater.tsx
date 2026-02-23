import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings, ClipboardList, TrendingUp, Target, ChevronDown } from 'lucide-react';
import CWStationsTab from '../components/clearwater/CWStationsTab';
import ProductionDataTab from '../components/clearwater/ProductionDataTab';
import SalesDataTab from '../components/clearwater/SalesDataTab';
import CWTargetsTab from '../components/clearwater/CWTargetsTab';
import CWDemandTab from '../components/clearwater/CWDemandTab';

type TargetsSubTab = 'production' | 'sales' | 'outputs' | 'demand';

export default function ClearWater() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'stations' | 'production' | 'sales' | 'targets'>('production');
  const [activeTargetsSubTab, setActiveTargetsSubTab] = useState<TargetsSubTab>('production');
  const [showTargetsDropdown, setShowTargetsDropdown] = useState(false);

  const salesFilter = (searchParams.get('filter') === 'pending' ? 'pending' : 'all') as 'all' | 'pending';

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['stations', 'production', 'sales', 'targets'].includes(tabParam)) {
      setActiveTab(tabParam as 'stations' | 'production' | 'sales' | 'targets');
    } else if (!tabParam) {
      setActiveTab('production');
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('stations');
            setSearchParams({ tab: 'stations' });
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'stations'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            CW Stations
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('production');
            setSearchParams({ tab: 'production' });
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'production'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Production Data
          </div>
        </button>
        <button
          onClick={() => {
            setActiveTab('sales');
            setSearchParams({ tab: 'sales' });
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'sales'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Sales Data
          </div>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowTargetsDropdown(!showTargetsDropdown)}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'targets'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              CW Targets
            </div>
          </button>
          {showTargetsDropdown && (
            <div className="absolute left-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48 mt-1">
              <button
                onClick={() => {
                  setActiveTargetsSubTab('production');
                  setActiveTab('targets');
                  setSearchParams({ tab: 'targets' });
                  setShowTargetsDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 text-sm font-medium text-gray-700 rounded-t-lg"
              >
                Production Targets
              </button>
              <button
                onClick={() => {
                  setActiveTargetsSubTab('sales');
                  setActiveTab('targets');
                  setSearchParams({ tab: 'targets' });
                  setShowTargetsDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 text-sm font-medium text-gray-700"
              >
                Sales Targets
              </button>
              <button
                onClick={() => {
                  setActiveTargetsSubTab('outputs');
                  setActiveTab('targets');
                  setSearchParams({ tab: 'targets' });
                  setShowTargetsDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 text-sm font-medium text-gray-700"
              >
                Outputs
              </button>
              <button
                onClick={() => {
                  setActiveTargetsSubTab('demand');
                  setActiveTab('targets');
                  setSearchParams({ tab: 'targets' });
                  setShowTargetsDropdown(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 rounded-b-lg"
              >
                CW Demand
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'stations' && <CWStationsTab />}
      {activeTab === 'production' && <ProductionDataTab />}
      {activeTab === 'sales' && <SalesDataTab initialFilter={salesFilter} />}
      {activeTab === 'targets' && activeTargetsSubTab !== 'demand' && (
        <CWTargetsTab activeSubTab={activeTargetsSubTab} />
      )}
      {activeTab === 'targets' && activeTargetsSubTab === 'demand' && <CWDemandTab />}
    </div>
  );
}
