import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Home, Droplets, Waves, Wrench, DollarSign, Package, Shield, Info, LogOut, Wifi, WifiOff } from 'lucide-react';

const middleMenuItems = [
  { path: '/clearwater', label: 'Clear Water', shortLabel: 'CW', icon: Droplets },
  { path: '/rawwater', label: 'Raw Water', shortLabel: 'RW', icon: Waves },
  { path: '/maintenance', label: 'Maintenance', shortLabel: 'Maint', icon: Wrench },
  { path: '/finance', label: 'Finance', shortLabel: 'Fin', icon: DollarSign },
  { path: '/stock-control', label: 'Stock Control', shortLabel: 'Stock', icon: Package },
];

const adminMenuItems = [
  { path: '/admin', label: 'Administration', shortLabel: 'Admin', icon: Shield, permission: 'manage_users' },
];

function getScopePrefix(accessContext: ReturnType<typeof useAuth>['accessContext']): string {
  if (!accessContext) return '';
  if (accessContext.isSCScoped && accessContext.scopeId) return `/sc/${accessContext.scopeId}`;
  if (accessContext.isCatchmentScoped && accessContext.scopeId) return `/catchment/${accessContext.scopeId}`;
  if (accessContext.isNationalScoped) return '/national';
  return '';
}

function isPathActive(pathname: string, segment: string): boolean {
  const pattern = new RegExp(`(^|/)(sc/[^/]+|catchment/[^/]+|national)?/?${segment}(\\/|$)`);
  return pattern.test(pathname);
}

export default function TopBar() {
  const { signOut, hasPermission, accessContext } = useAuth();
  const { isOnline } = useNetwork();
  const location = useLocation();
  const scopePrefix = getScopePrefix(accessContext);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getScopeLabel = () => {
    if (!accessContext) return 'Loading...';

    if (accessContext.isSCScoped && accessContext.serviceCentre) {
      return accessContext.serviceCentre.name.replace(/Service Centre?/gi, 'SC');
    }
    if (accessContext.isCatchmentScoped && accessContext.catchment) {
      return accessContext.catchment.name;
    }
    if (accessContext.isNationalScoped) {
      return 'National';
    }

    return 'System';
  };

  return (
    <header className="bg-gray-400 border-b border-gray-500">
      <div className="px-6 pt-3">
        <div className="flex items-center justify-between">
          <NavLink
            to={scopePrefix ? `${scopePrefix}/dashboard` : '/dashboard'}
            className={() => {
              const active = isPathActive(location.pathname, 'dashboard');
              return `flex items-center gap-2 px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                active
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-900 hover:bg-gray-500'
              }`;
            }}
          >
            <Home className="w-4 h-4" />
            <span>{getScopeLabel()}</span>
          </NavLink>

          <nav className="flex items-center gap-1">
            {middleMenuItems.map((item) => {
              const Icon = item.icon;
              const segment = item.path.replace(/^\//, '');
              const scopedPath = scopePrefix ? `${scopePrefix}${item.path}` : item.path;
              return (
                <NavLink
                  key={item.path}
                  to={scopedPath}
                  title={item.label}
                  className={() => {
                    const active = isPathActive(location.pathname, segment);
                    return `flex items-center gap-2 px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-900 hover:bg-gray-500'
                    }`;
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="inline lg:hidden">{item.shortLabel}</span>
                </NavLink>
              );
            })}
            {adminMenuItems.map((item) => {
              const Icon = item.icon;
              const canAccess = hasPermission(item.permission);

              if (!canAccess) return null;

              const segment = item.path.replace(/^\//, '');
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={() => {
                    const active = isPathActive(location.pathname, segment);
                    return `flex items-center gap-2 px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                      active
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-900 hover:bg-gray-500'
                    }`;
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                  <span className="inline lg:hidden">{item.shortLabel}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isOnline
                ? 'text-green-700'
                : 'text-red-700'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
            >
              {isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-black hover:bg-gray-500 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>

            <NavLink
              to="/about"
              className={() => {
                const active = isPathActive(location.pathname, 'about');
                return `flex items-center gap-2 px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                  active
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-900 hover:bg-gray-500'
                }`;
              }}
            >
              <Info className="w-4 h-4" />
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  );
}
