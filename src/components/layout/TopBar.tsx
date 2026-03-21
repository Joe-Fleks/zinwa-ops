import { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Home, Droplets, Waves, Wrench, DollarSign, Package, Shield, Info, LogOut, Wifi, WifiOff, Menu, ChevronDown } from 'lucide-react';

interface MenuItem {
  path: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  permission?: string;
  scoped?: boolean;
}

const primaryItems: MenuItem[] = [
  { path: '/clearwater', label: 'Clear Water', shortLabel: 'CW', icon: Droplets, scoped: true },
  { path: '/rawwater', label: 'Raw Water', shortLabel: 'RW', icon: Waves, scoped: true },
  { path: '/maintenance', label: 'Maintenance', shortLabel: 'Maint', icon: Wrench, scoped: true },
  { path: '/stock-control', label: 'Stock Control', shortLabel: 'Stock', icon: Package, scoped: true },
];

const overflowItems: MenuItem[] = [
  { path: '/finance', label: 'Finance', shortLabel: 'Fin', icon: DollarSign, scoped: true },
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

type ScreenTier = 'small' | 'medium' | 'large';

function getScreenTier(width: number): ScreenTier {
  if (width >= 1280) return 'large';
  if (width >= 768) return 'medium';
  return 'small';
}

export default function TopBar() {
  const { signOut, hasPermission, accessContext } = useAuth();
  const { isOnline } = useNetwork();
  const location = useLocation();
  const navigate = useNavigate();
  const scopePrefix = getScopePrefix(accessContext);

  const [tier, setTier] = useState<ScreenTier>(() => getScreenTier(window.innerWidth));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const mobileRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => {
      const next = getScreenTier(window.innerWidth);
      setTier(next);
      if (next !== 'small') setMobileMenuOpen(false);
      if (next !== 'medium') setOverflowOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setOverflowOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
    if (accessContext.isNationalScoped) return 'National';
    return 'System';
  };

  const resolvedPath = useCallback((item: MenuItem) => {
    if (!item.scoped) return item.path;
    return scopePrefix ? `${scopePrefix}${item.path}` : item.path;
  }, [scopePrefix]);

  const tabClass = (segment: string) => {
    const active = isPathActive(location.pathname, segment);
    return `flex items-center gap-2 px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
      active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-900 hover:bg-blue-400'
    }`;
  };

  const dropdownItemClass = (segment: string) => {
    const active = isPathActive(location.pathname, segment);
    return `flex items-center gap-3 w-full px-4 py-2.5 text-sm font-semibold transition-colors ${
      active ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-blue-50'
    }`;
  };

  const canAccessItem = (item: MenuItem) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
  };

  const visibleOverflow = overflowItems.filter(canAccessItem);
  const anyOverflowActive = visibleOverflow.some(item =>
    isPathActive(location.pathname, item.path.replace(/^\//, ''))
  );

  const allItems = [...primaryItems, ...overflowItems];

  const renderNavItem = (item: MenuItem, showFull: boolean) => {
    const Icon = item.icon;
    const segment = item.path.replace(/^\//, '');
    return (
      <NavLink
        key={item.path}
        to={resolvedPath(item)}
        title={item.label}
        className={() => tabClass(segment)}
      >
        <Icon className="w-4 h-4" />
        {showFull ? (
          <span>{item.label}</span>
        ) : (
          <span>{item.shortLabel}</span>
        )}
      </NavLink>
    );
  };

  return (
    <header className="bg-blue-300 border-b border-blue-400 relative z-50">
      <div className="px-3 md:px-6 pt-3">
        <div className="flex items-center justify-between">
          <NavLink
            to={scopePrefix ? `${scopePrefix}/dashboard` : '/dashboard'}
            className={() => {
              const active = isPathActive(location.pathname, 'dashboard');
              return `flex items-center gap-2 px-3 md:px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-900 hover:bg-blue-400'
              }`;
            }}
          >
            <Home className="w-4 h-4" />
            <span className="truncate max-w-[120px] md:max-w-none">{getScopeLabel()}</span>
          </NavLink>

          {tier === 'large' && (
            <nav className="flex items-center gap-1">
              {allItems.map((item) => {
                if (!canAccessItem(item)) return null;
                return renderNavItem(item, true);
              })}
            </nav>
          )}

          {tier === 'medium' && (
            <nav className="flex items-center gap-1">
              {primaryItems.map((item) => renderNavItem(item, false))}
              {visibleOverflow.length > 0 && (
                <div className="relative" ref={overflowRef}>
                  <button
                    onClick={() => setOverflowOpen(prev => !prev)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                      anyOverflowActive
                        ? 'bg-white text-gray-900 shadow-sm'
                        : overflowOpen
                        ? 'bg-blue-400 text-gray-900'
                        : 'text-gray-900 hover:bg-blue-400'
                    }`}
                    title="More modules"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${overflowOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {overflowOpen && (
                    <div className="absolute right-0 top-full mt-0 w-48 bg-white rounded-b-lg rounded-tl-lg shadow-lg border border-gray-200 py-1 z-50">
                      {visibleOverflow.map((item) => {
                        const Icon = item.icon;
                        const segment = item.path.replace(/^\//, '');
                        return (
                          <button
                            key={item.path}
                            onClick={() => {
                              navigate(resolvedPath(item));
                              setOverflowOpen(false);
                            }}
                            className={dropdownItemClass(segment)}
                          >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}

          {tier === 'small' && (
            <div className="relative" ref={mobileRef}>
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className={`flex items-center gap-1 px-3 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                  mobileMenuOpen ? 'bg-blue-400 text-gray-900' : 'text-gray-900 hover:bg-blue-400'
                }`}
                title="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              {mobileMenuOpen && (
                <div className="absolute right-0 top-full mt-0 w-56 bg-white rounded-b-lg rounded-tl-lg shadow-lg border border-gray-200 py-1 z-50">
                  {allItems.map((item) => {
                    if (!canAccessItem(item)) return null;
                    const Icon = item.icon;
                    const segment = item.path.replace(/^\//, '');
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(resolvedPath(item));
                          setMobileMenuOpen(false);
                        }}
                        className={dropdownItemClass(segment)}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 md:gap-3">
            <div
              className={`p-2 rounded-lg ${isOnline ? 'text-green-700' : 'text-red-700'}`}
              title={isOnline ? 'Online' : 'Offline'}
            >
              {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-black hover:bg-blue-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <NavLink
              to="/about"
              className={() => {
                const active = isPathActive(location.pathname, 'about');
                return `flex items-center gap-2 px-3 md:px-4 py-2 rounded-t-lg rounded-b-none transition-colors font-bold text-sm ${
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-900 hover:bg-blue-400'
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
