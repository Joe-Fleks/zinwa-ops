import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database, Target, Waves, Users, TrendingUp } from 'lucide-react';
import WaterUsersTab from '../components/rawwater/WaterUsersTab';
import RWDatabaseTab from '../components/rawwater/RWDatabaseTab';
import RWSalesTab from '../components/rawwater/RWSalesTab';
import RWTargetsTab from '../components/rawwater/RWTargetsTab';
import DamsTab from '../components/rawwater/DamsTab';

export default function RawWater() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessContext } = useAuth();
  const [view, setView] = useState<'dams' | 'users' | 'database' | 'sales' | 'targets'>('database');
  const [showTargetsMenu, setShowTargetsMenu] = useState(false);
  const [targetsSubView, setTargetsSubView] = useState<'sales' | 'outputs'>('sales');


  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setView('dams')}
          className={`px-6 py-3 font-medium transition-colors ${
            view === 'dams'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Waves className="w-5 h-5" />
            Dams
          </div>
        </button>
        <button
          onClick={() => setView('users')}
          className={`px-6 py-3 font-medium transition-colors ${
            view === 'users'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Water Users
          </div>
        </button>
        <button
          onClick={() => setView('database')}
          className={`px-6 py-3 font-medium transition-colors ${
            view === 'database'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            RW Database
          </div>
        </button>
        <button
          onClick={() => setView('sales')}
          className={`px-6 py-3 font-medium transition-colors ${
            view === 'sales'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            RW Sales
          </div>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowTargetsMenu(!showTargetsMenu)}
            className={`px-6 py-3 font-medium transition-colors ${
              view === 'targets'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              RW Targets
            </div>
          </button>
          {showTargetsMenu && (
            <div className="absolute right-0 top-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 w-40">
              <button
                onClick={() => {
                  setTargetsSubView('sales');
                  setView('targets');
                  setShowTargetsMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-200 text-sm font-medium text-gray-700 rounded-t-lg"
              >
                RW Sales Targets
              </button>
              <button
                onClick={() => {
                  setTargetsSubView('outputs');
                  setView('targets');
                  setShowTargetsMenu(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 rounded-b-lg"
              >
                Outputs
              </button>
            </div>
          )}
        </div>
      </div>

      {view === 'dams' ? (
        <DamsTab />
      ) : view === 'users' ? (
        <WaterUsersTab />
      ) : view === 'database' ? (
        <RWDatabaseTab />
      ) : view === 'sales' ? (
        <RWSalesTab />
      ) : view === 'targets' ? (
        <RWTargetsTab subView={targetsSubView} />
      ) : null}

    </div>
  );
}

