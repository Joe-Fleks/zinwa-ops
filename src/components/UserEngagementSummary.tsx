import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Users, LogIn, Clock, ChevronDown, ChevronUp, Circle } from 'lucide-react';

type PresenceStatus = 'online' | 'idle' | 'offline';

interface EngagementRow {
  userId: string;
  fullName: string;
  email: string;
  loginCount: number;
  adminActionCount: number;
  lastLoginAt: string | null;
  accountCreated: string;
  isActive: boolean;
  presenceStatus: PresenceStatus;
  lastActiveAt: string | null;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PresenceBadge({ status, lastActiveAt }: { status: PresenceStatus; lastActiveAt: string | null }) {
  if (status === 'online') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
        Online
      </span>
    );
  }
  if (status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        <Circle className="w-2 h-2 fill-amber-400 text-amber-400" />
        Idle
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200" title={lastActiveAt ? new Date(lastActiveAt).toLocaleString() : 'Never seen'}>
      <Circle className="w-2 h-2 fill-gray-300 text-gray-300" />
      {lastActiveAt ? `Last seen ${formatRelativeTime(lastActiveAt)}` : 'Never seen'}
    </span>
  );
}

export default function UserEngagementSummary() {
  const [data, setData] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'loginCount' | 'adminActionCount' | 'lastLoginAt' | 'fullName'>('loginCount');
  const [sortAsc, setSortAsc] = useState(false);

  const resolvePresence = useCallback((lastActiveAt: string | null, isIdle: boolean): PresenceStatus => {
    if (!lastActiveAt) return 'offline';
    const now = Date.now();
    const lastActive = new Date(lastActiveAt).getTime();
    const diffMs = now - lastActive;
    const TWO_MIN = 2 * 60_000;

    if (diffMs <= TWO_MIN && !isIdle) return 'online';
    if (diffMs <= TWO_MIN && isIdle) return 'idle';
    return 'offline';
  }, []);

  const loadEngagementData = useCallback(async () => {
    try {
      const [profilesRes, loginsRes, actionsRes, presenceRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, last_login_at, created_at, is_active'),
        supabase
          .from('user_login_history')
          .select('user_id, logged_in_at')
          .gte('logged_in_at', '2026-01-01T00:00:00Z'),
        supabase
          .from('audit_logs')
          .select('user_id, action_type')
          .gte('created_at', '2026-01-01T00:00:00Z'),
        supabase
          .from('user_presence')
          .select('user_id, last_active_at, is_idle'),
      ]);

      const profiles = profilesRes.data || [];
      const logins = loginsRes.data || [];
      const actions = actionsRes.data || [];
      const presenceData = presenceRes.data || [];

      const presenceMap: Record<string, { last_active_at: string; is_idle: boolean }> = {};
      for (const p of presenceData) {
        presenceMap[p.user_id] = { last_active_at: p.last_active_at, is_idle: p.is_idle };
      }

      const loginCounts: Record<string, number> = {};
      for (const l of logins) {
        loginCounts[l.user_id] = (loginCounts[l.user_id] || 0) + 1;
      }

      const actionCounts: Record<string, number> = {};
      for (const a of actions) {
        actionCounts[a.user_id] = (actionCounts[a.user_id] || 0) + 1;
      }

      const rows: EngagementRow[] = profiles.map((p: any) => {
        const presence = presenceMap[p.id];
        return {
          userId: p.id,
          fullName: p.full_name || 'Unknown',
          email: p.email || '',
          loginCount: loginCounts[p.id] || 0,
          adminActionCount: actionCounts[p.id] || 0,
          lastLoginAt: p.last_login_at || null,
          accountCreated: p.created_at,
          isActive: p.is_active ?? true,
          presenceStatus: resolvePresence(presence?.last_active_at || null, presence?.is_idle ?? false),
          lastActiveAt: presence?.last_active_at || null,
        };
      });

      setData(rows);
    } catch (err) {
      console.error('Failed to load engagement data:', err);
    } finally {
      setLoading(false);
    }
  }, [resolvePresence]);

  useEffect(() => {
    loadEngagementData();
    const refreshInterval = setInterval(() => {
      loadEngagementData();
    }, 30_000);
    return () => clearInterval(refreshInterval);
  }, [loadEngagementData]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'fullName') {
      cmp = a.fullName.localeCompare(b.fullName);
    } else if (sortField === 'loginCount') {
      cmp = a.loginCount - b.loginCount;
    } else if (sortField === 'adminActionCount') {
      cmp = a.adminActionCount - b.adminActionCount;
    } else if (sortField === 'lastLoginAt') {
      const aDate = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
      const bDate = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
      cmp = aDate - bDate;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalLogins = data.reduce((sum, r) => sum + r.loginCount, 0);
  const totalActions = data.reduce((sum, r) => sum + r.adminActionCount, 0);
  const activeUsers = data.filter(r => r.isActive).length;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>
        <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="bg-blue-600 text-white p-2.5 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
            <p className="text-xs text-gray-500">Active Users</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="bg-emerald-600 text-white p-2.5 rounded-lg">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalLogins}</p>
            <p className="text-xs text-gray-500">Total Logins Recorded</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="bg-amber-600 text-white p-2.5 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalActions}</p>
            <p className="text-xs text-gray-500">Admin Actions</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  onClick={() => handleSort('fullName')}
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                >
                  <span className="flex items-center gap-1">
                    User <SortIcon field="fullName" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('loginCount')}
                  className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                >
                  <span className="flex items-center justify-center gap-1">
                    Logins <SortIcon field="loginCount" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('adminActionCount')}
                  className="text-center py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 select-none"
                >
                  <span className="flex items-center justify-center gap-1">
                    Admin Actions <SortIcon field="adminActionCount" />
                  </span>
                </th>

                <th className="text-left py-3 px-4 font-semibold text-gray-700">Account Created</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Activity Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.userId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{row.fullName}</p>
                      <p className="text-xs text-gray-500">{row.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.loginCount > 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {row.loginCount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold ${
                      row.adminActionCount > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {row.adminActionCount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600">
                    {formatDate(row.accountCreated)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <PresenceBadge status={row.presenceStatus} lastActiveAt={row.lastActiveAt} />
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No user data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        Login counts are recorded from the date this feature was enabled. Historical logins before that date are not included.
      </p>
    </div>
  );
}
