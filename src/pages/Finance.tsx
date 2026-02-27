import { useState, useEffect, useRef } from 'react';
import { Banknote, Users, ChevronDown, Receipt } from 'lucide-react';
import TariffsTab from '../components/finance/TariffsTab';
import ClientsTab from '../components/finance/ClientsTab';

type TabKey = 'clients' | 'tariffs' | 'collections';
type ClientsSub = 'CW' | 'RW';
type TariffsSub = 'CW' | 'RW';

const CLIENTS_OPTIONS: { value: ClientsSub; label: string }[] = [
  { value: 'CW', label: 'CW Clients' },
  { value: 'RW', label: 'RW Clients' },
];

const TARIFFS_OPTIONS: { value: TariffsSub; label: string }[] = [
  { value: 'CW', label: 'CW Tariffs' },
  { value: 'RW', label: 'RW Tariffs' },
];

export default function Finance() {
  const [activeTab, setActiveTab] = useState<TabKey>('clients');
  const [clientsSub, setClientsSub] = useState<ClientsSub>('CW');
  const [tariffsSub, setTariffsSub] = useState<TariffsSub>('CW');
  const [openDropdown, setOpenDropdown] = useState<TabKey | null>(null);
  const clientsRef = useRef<HTMLDivElement>(null);
  const tariffsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        openDropdown === 'clients' && clientsRef.current && !clientsRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
      if (
        openDropdown === 'tariffs' && tariffsRef.current && !tariffsRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const clientsLabel = CLIENTS_OPTIONS.find(o => o.value === clientsSub)?.label || 'Clients';
  const tariffsLabel = TARIFFS_OPTIONS.find(o => o.value === tariffsSub)?.label || 'Tariffs';

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        <div className="relative" ref={clientsRef}>
          <button
            onClick={() => {
              if (activeTab === 'clients') {
                setOpenDropdown(openDropdown === 'clients' ? null : 'clients');
              } else {
                setActiveTab('clients');
                setOpenDropdown(null);
              }
            }}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'clients'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <span>{clientsLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === 'clients' ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openDropdown === 'clients' && (
            <div className="absolute left-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48 mt-1">
              {CLIENTS_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setClientsSub(opt.value);
                    setActiveTab('clients');
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium ${
                    clientsSub === opt.value ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                  } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === CLIENTS_OPTIONS.length - 1 ? 'rounded-b-lg' : 'border-b border-gray-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={tariffsRef}>
          <button
            onClick={() => {
              if (activeTab === 'tariffs') {
                setOpenDropdown(openDropdown === 'tariffs' ? null : 'tariffs');
              } else {
                setActiveTab('tariffs');
                setOpenDropdown(null);
              }
            }}
            className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === 'tariffs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              <span>{tariffsLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openDropdown === 'tariffs' ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {openDropdown === 'tariffs' && (
            <div className="absolute left-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-48 mt-1">
              {TARIFFS_OPTIONS.map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTariffsSub(opt.value);
                    setActiveTab('tariffs');
                    setOpenDropdown(null);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm font-medium ${
                    tariffsSub === opt.value ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
                  } ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === TARIFFS_OPTIONS.length - 1 ? 'rounded-b-lg' : 'border-b border-gray-200'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setActiveTab('collections');
            setOpenDropdown(null);
          }}
          className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
            activeTab === 'collections'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            <span>Collections</span>
          </div>
        </button>
      </div>

      {activeTab === 'clients' && <ClientsTab clientType={clientsSub} />}
      {activeTab === 'tariffs' && <TariffsTab tariffType={tariffsSub} />}
      {activeTab === 'collections' && (
        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
          <div className="text-center text-gray-500">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-lg font-medium">Collections</p>
            <p className="text-sm mt-1">This section is under development</p>
          </div>
        </div>
      )}
    </div>
  );
}
