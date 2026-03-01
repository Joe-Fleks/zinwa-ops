import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft } from 'lucide-react';
import UserEngagementSummary from '../components/UserEngagementSummary';

interface AuditLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  previous_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: string;
  user_id: string;
}

export default function AuditLogs() {
  const { hasPermission, accessContext } = useAuth();
  const navigate = useNavigate();
  const isGlobalAdmin = (accessContext?.userSystemRank ?? 0) >= 100;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedActionType, setSelectedActionType] = useState('');
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!hasPermission('manage_users')) {
      navigate('/admin');
      return;
    }
    loadLogs();
    loadActionTypes();
  }, [hasPermission, selectedActionType]);

  const loadActionTypes = async () => {
    try {
      const { data } = await supabase
        .from('audit_logs')
        .select('action_type')
        .order('action_type');

      const uniqueTypes = [...new Set(data?.map(l => l.action_type) || [])];
      setActionTypes(uniqueTypes as string[]);
    } catch (err) {
      console.error('Failed to load action types:', err);
    }
  };

  const loadLogs = async () => {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedActionType) {
        query = query.eq('action_type', selectedActionType);
      }

      const { data, error: err } = await query;

      if (err) throw err;
      setLogs(data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Administration</span>
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">System activity and change history</p>
      </div>

      {isGlobalAdmin && <UserEngagementSummary />}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Action Type</label>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="text-center py-8 text-gray-600">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-600">No audit logs found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date/Time</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Action Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Entity Type</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Entity ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900 whitespace-nowrap text-xs">{formatDate(log.created_at)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                        {log.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 text-xs">{log.entity_type}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs font-mono">{log.entity_id || '-'}</td>
                    <td className="py-3 px-4 text-gray-600 text-xs">
                      {log.new_value && Object.keys(log.new_value).length > 0 ? (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:text-blue-700 underline">View</summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto max-w-md">
                            {JSON.stringify(log.new_value, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
