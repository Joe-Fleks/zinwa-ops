import { Target, Lightbulb, AlertCircle, Rocket, User as UserIcon, Mail, Shield, MapPin, RefreshCw, Phone, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ProfileUpdateModal from '../components/ProfileUpdateModal';

export default function About() {
  const { user, profile, roles, accessContext, refreshUserData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUserData();
    } finally {
      setRefreshing(false);
    }
  };

  const primaryRole = roles?.[0];
  const scopeLabel = accessContext?.serviceCentre?.name?.replace(/Service Centre?/gi, 'SC') ||
                     accessContext?.catchment?.name ||
                     (accessContext?.isNationalScoped ? 'National' : 'System');

  const adminRoles = roles?.filter(r => r.name === 'Admin' || r.name === 'Director' || r.name === 'CEO');
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          About This System <span className="text-base font-normal text-gray-600">(Murombedzi SC Operations Management Platform)</span>
        </h1>
      </div>

      {user && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="w-[104px] h-[104px] rounded-full overflow-hidden bg-blue-600 shadow-md ring-2 ring-gray-100">
                {profile?.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white text-3xl font-bold leading-none">{initials}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900 truncate">{profile?.full_name || 'Not set'}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      {primaryRole?.description || primaryRole?.name || 'No role'}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{scopeLabel}</span>
                    {adminRoles && adminRoles.length > 0 && (
                      <span className="inline-flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{adminRoles.map(r => r.description || r.name).join(', ')}</span>
                    )}
                  </div>
                  {profile?.tagline && (
                    <p className="mt-1.5 text-sm text-gray-500 italic line-clamp-2">{profile.tagline}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Update Profile
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    title="Refresh profile data"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-8 gap-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-600 min-w-0">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{user.email || 'Not set'}</span>
                </div>
                {profile?.contact_number_1 && (
                  <div className="flex items-center gap-2 text-gray-600 min-w-0">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{profile.contact_number_1}</span>
                  </div>
                )}
                {profile?.contact_number_2 && (
                  <div className="flex items-center gap-2 text-gray-600 min-w-0">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{profile.contact_number_2}</span>
                  </div>
                )}
                {!profile?.contact_number_1 && !profile?.contact_number_2 && (
                  <div className="flex items-center gap-2 text-gray-300 min-w-0 ml-auto">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span className="italic text-xs">No contacts added</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showProfileModal && profile && (
            <ProfileUpdateModal
              profile={profile}
              onClose={() => setShowProfileModal(false)}
              onSaved={refreshUserData}
            />
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Background</h2>
        <p className="text-gray-700 leading-relaxed">
          The ZINWA Operations Management System is a purpose-built internal
          platform designed to streamline and enhance operational decision-making for water utility
          services. This system serves as a complementary tool to the existing Sage finance system,
          focusing exclusively on operational data management, analytics, and performance monitoring.
        </p>
        <p className="text-gray-700 leading-relaxed mt-4">
          Managing multiple water treatment stations, raw water sources, and maintenance operations
          requires structured data collection and real-time visibility. This platform centralizes
          operational information, making it accessible to engineers, supervisors, technicians, and
          management staff across the service center.
        </p>
      </div>

      <div className="bg-blue-50 rounded-lg shadow-sm border border-blue-200 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">Reporting Period Guidelines</h2>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <span className="font-medium">Current Day:</span> Displays yesterday's data (to ensure complete 24-hour records)
          </p>
          <p>
            <span className="font-medium">Week:</span> Friday to Thursday (aligns with operational reporting cycles)
          </p>
          <p>
            <span className="font-medium">Month/Quarter/Year:</span> Standard calendar periods
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Target className="w-7 h-7 text-blue-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Objectives</h2>
        </div>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-1 mt-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-gray-700">
              Provide a centralized platform for recording and monitoring daily production data
              across all clear water stations
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-1 mt-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-gray-700">
              Enable real-time visibility into equipment status, maintenance schedules, and
              operational performance metrics
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-1 mt-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-gray-700">
              Support data-driven decision making through analytics, trends, and performance indicators
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-1 mt-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-gray-700">
              Improve accountability and transparency in operations management and resource allocation
            </span>
          </li>
          <li className="flex items-start gap-3">
            <div className="bg-blue-600 rounded-full p-1 mt-1">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            <span className="text-gray-700">
              Generate operational insights for finance staff without duplicating billing functionality
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-100 p-2 rounded-lg">
            <AlertCircle className="w-7 h-7 text-amber-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Scope and Limitations</h2>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">What This System Does:</h3>
            <ul className="space-y-2 ml-4">
              <li className="text-gray-700">• Tracks clear water production volumes and station performance</li>
              <li className="text-gray-700">• Monitors raw water abstraction from dams and allocations to users</li>
              <li className="text-gray-700">• Manages equipment registers and maintenance history</li>
              <li className="text-gray-700">• Provides operational analytics and derived financial metrics</li>
              <li className="text-gray-700">• Supports role-based access for different user types</li>
            </ul>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-medium text-gray-900 mb-2">What This System Does NOT Do:</h3>
            <ul className="space-y-2 ml-4">
              <li className="text-gray-700">• Customer billing or invoice generation (handled by Sage)</li>
              <li className="text-gray-700">• Financial accounting or ledger management</li>
              <li className="text-gray-700">• Automated meter reading or SCADA integration (planned for future)</li>
              <li className="text-gray-700">• External customer-facing services or portals</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-100 p-2 rounded-lg">
            <Rocket className="w-7 h-7 text-green-600" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Future Vision</h2>
        </div>
        <p className="text-gray-700 leading-relaxed mb-4">
          As the Murombedzi SC Operations platform evolves, planned enhancements include:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-blue-600" strokeWidth={2.5} />
              <h3 className="font-medium text-blue-900">AI-Powered Analytics</h3>
            </div>
            <p className="text-sm text-blue-800">
              Predictive maintenance alerts, anomaly detection, and optimization recommendations
              using machine learning
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-green-600" strokeWidth={2.5} />
              <h3 className="font-medium text-green-900">Google Sheets Integration</h3>
            </div>
            <p className="text-sm text-green-800">
              Seamless data import/export with Google Sheets for field data collection and
              reporting flexibility
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-purple-600" strokeWidth={2.5} />
              <h3 className="font-medium text-purple-900">Mobile Application</h3>
            </div>
            <p className="text-sm text-purple-800">
              Native mobile apps for field technicians to log data and access information on-site
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-orange-600" strokeWidth={2.5} />
              <h3 className="font-medium text-orange-900">SCADA Integration</h3>
            </div>
            <p className="text-sm text-orange-800">
              Real-time sensor data integration for automated monitoring and control
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Version 1.0 | Built for ZINWA | 2026
        </p>
        <p className="text-sm text-gray-600 text-center mt-2">
          Developed by Joseph Mufaro Mlambo
        </p>
      </div>
    </div>
  );
}
