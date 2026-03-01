import { useEffect, type ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import TopBar from './TopBar';
import RouteGuard from '../RouteGuard';
import Dashboard from '../../pages/Dashboard';
import ClearWater from '../../pages/ClearWater';
import RawWater from '../../pages/RawWater';
import Maintenance from '../../pages/Maintenance';
import Finance from '../../pages/Finance';
import StockControl from '../../pages/StockControl';
import About from '../../pages/About';
import Administration from '../../pages/Administration';
import AdminUsers from '../../pages/AdminUsers';
import AdminCreateUser from '../../pages/AdminCreateUser';
import RoleManagement from '../../pages/RoleManagement';
import AuditLogs from '../../pages/AuditLogs';
import StationList from '../../pages/StationList';
import StationRegistration from '../../pages/StationRegistration';
import StationView from '../../pages/StationView';
import ProductionDataManager from '../../pages/ProductionDataManager';
import ClientProfile from '../../pages/ClientProfile';
import DamCapacityPage from '../../pages/DamCapacityPage';
import ChemicalNewStock from '../../pages/ChemicalNewStock';
import ChemicalDistributor from '../../pages/ChemicalDistributor';
import { useAuth } from '../../contexts/AuthContext';
import { getScopeRedirectPath, isRouteAuthorizedForUser } from '../../lib/scopeUtils';
import ChatPanel from '../chat/ChatPanel';

function ScopeRedirector() {
  const { accessContext, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !accessContext) return;

    if (location.pathname === '/' || location.pathname === '/dashboard') {
      const scopePath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);
      if (scopePath !== '/dashboard') {
        navigate(scopePath, { replace: true });
      }
    }
  }, [accessContext, loading, location.pathname, navigate]);

  return null;
}

function ScrollPage({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-y-auto p-6">{children}</div>;
}

function RouteTracker() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accessContext } = useAuth();

  useEffect(() => {
    if (!accessContext) return;

    const savedRoute = localStorage.getItem('lastRoute');
    const defaultPath = getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId);

    if (savedRoute && location.pathname === defaultPath && savedRoute !== defaultPath) {
      if (isRouteAuthorizedForUser(savedRoute, accessContext)) {
        navigate(savedRoute, { replace: true });
      } else {
        localStorage.removeItem('lastRoute');
      }
    }
  }, [accessContext]);

  useEffect(() => {
    if (location.pathname !== '/') {
      localStorage.setItem('lastRoute', location.pathname);
    }
  }, [location.pathname]);

  return null;
}

export default function MainLayout() {
  const { accessContext } = useAuth();
  const defaultRedirect = accessContext
    ? getScopeRedirectPath(accessContext.scopeType, accessContext.scopeId)
    : '/dashboard';

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar />
      <ScopeRedirector />
      <RouteTracker />
      <main className="flex-1 overflow-hidden flex flex-col" id="main-scroll-container">
        <RouteGuard>
          <Routes>

          <Route path="/" element={<Navigate to={defaultRedirect} replace />} />

          <Route path="/sc/:scId/dashboard" element={<Dashboard />} />
          <Route path="/sc/:scId/clearwater" element={<ScrollPage><ClearWater /></ScrollPage>} />
          <Route path="/sc/:scId/clearwater/stations" element={<ScrollPage><StationList /></ScrollPage>} />
          <Route path="/sc/:scId/clearwater/stations/new" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/sc/:scId/clearwater/stations/:id" element={<ScrollPage><StationView /></ScrollPage>} />
          <Route path="/sc/:scId/clearwater/stations/:id/edit" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/sc/:scId/clearwater/production" element={<ScrollPage><ProductionDataManager /></ScrollPage>} />
          <Route path="/sc/:scId/rawwater" element={<ScrollPage><RawWater /></ScrollPage>} />
          <Route path="/sc/:scId/rawwater/capacity/new" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/sc/:scId/rawwater/capacity/:id/edit" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/sc/:scId/rawwater/client/:userId" element={<ScrollPage><ClientProfile /></ScrollPage>} />
          <Route path="/sc/:scId/maintenance" element={<ScrollPage><Maintenance /></ScrollPage>} />
          <Route path="/sc/:scId/finance" element={<ScrollPage><Finance /></ScrollPage>} />
          <Route path="/sc/:scId/stock-control" element={<ScrollPage><StockControl /></ScrollPage>} />
          <Route path="/sc/:scId/stock-control/chemical-new-stock" element={<ScrollPage><ChemicalNewStock /></ScrollPage>} />
          <Route path="/sc/:scId/stock-control/chemical-distributor" element={<ScrollPage><ChemicalDistributor /></ScrollPage>} />

          <Route path="/catchment/:catchmentId/dashboard" element={<Dashboard />} />
          <Route path="/catchment/:catchmentId/clearwater" element={<ScrollPage><ClearWater /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/clearwater/stations" element={<ScrollPage><StationList /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/clearwater/stations/new" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/clearwater/stations/:id" element={<ScrollPage><StationView /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/clearwater/stations/:id/edit" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/clearwater/production" element={<ScrollPage><ProductionDataManager /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/rawwater" element={<ScrollPage><RawWater /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/rawwater/capacity/new" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/rawwater/capacity/:id/edit" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/rawwater/client/:userId" element={<ScrollPage><ClientProfile /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/maintenance" element={<ScrollPage><Maintenance /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/finance" element={<ScrollPage><Finance /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/stock-control" element={<ScrollPage><StockControl /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/stock-control/chemical-new-stock" element={<ScrollPage><ChemicalNewStock /></ScrollPage>} />
          <Route path="/catchment/:catchmentId/stock-control/chemical-distributor" element={<ScrollPage><ChemicalDistributor /></ScrollPage>} />

          <Route path="/national/dashboard" element={<Dashboard />} />
          <Route path="/national/clearwater" element={<ScrollPage><ClearWater /></ScrollPage>} />
          <Route path="/national/clearwater/stations" element={<ScrollPage><StationList /></ScrollPage>} />
          <Route path="/national/clearwater/stations/new" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/national/clearwater/stations/:id" element={<ScrollPage><StationView /></ScrollPage>} />
          <Route path="/national/clearwater/stations/:id/edit" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/national/clearwater/production" element={<ScrollPage><ProductionDataManager /></ScrollPage>} />
          <Route path="/national/rawwater" element={<ScrollPage><RawWater /></ScrollPage>} />
          <Route path="/national/rawwater/capacity/new" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/national/rawwater/capacity/:id/edit" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/national/rawwater/client/:userId" element={<ScrollPage><ClientProfile /></ScrollPage>} />
          <Route path="/national/maintenance" element={<ScrollPage><Maintenance /></ScrollPage>} />
          <Route path="/national/finance" element={<ScrollPage><Finance /></ScrollPage>} />
          <Route path="/national/stock-control" element={<ScrollPage><StockControl /></ScrollPage>} />
          <Route path="/national/stock-control/chemical-new-stock" element={<ScrollPage><ChemicalNewStock /></ScrollPage>} />
          <Route path="/national/stock-control/chemical-distributor" element={<ScrollPage><ChemicalDistributor /></ScrollPage>} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clearwater" element={<ScrollPage><ClearWater /></ScrollPage>} />
          <Route path="/clearwater/stations" element={<ScrollPage><StationList /></ScrollPage>} />
          <Route path="/clearwater/stations/new" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/clearwater/stations/:id" element={<ScrollPage><StationView /></ScrollPage>} />
          <Route path="/clearwater/stations/:id/edit" element={<ScrollPage><StationRegistration /></ScrollPage>} />
          <Route path="/clearwater/production" element={<ScrollPage><ProductionDataManager /></ScrollPage>} />
          <Route path="/rawwater" element={<ScrollPage><RawWater /></ScrollPage>} />
          <Route path="/rawwater/capacity/new" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/rawwater/capacity/:id/edit" element={<ScrollPage><DamCapacityPage /></ScrollPage>} />
          <Route path="/rawwater/client/:userId" element={<ScrollPage><ClientProfile /></ScrollPage>} />
          <Route path="/maintenance" element={<ScrollPage><Maintenance /></ScrollPage>} />
          <Route path="/finance" element={<ScrollPage><Finance /></ScrollPage>} />
          <Route path="/stock-control" element={<ScrollPage><StockControl /></ScrollPage>} />
          <Route path="/stock-control/chemical-new-stock" element={<ScrollPage><ChemicalNewStock /></ScrollPage>} />
          <Route path="/stock-control/chemical-distributor" element={<ScrollPage><ChemicalDistributor /></ScrollPage>} />
          <Route path="/about" element={<ScrollPage><About /></ScrollPage>} />
          <Route path="/admin" element={<ScrollPage><Administration /></ScrollPage>} />
          <Route path="/admin/users" element={<ScrollPage><AdminUsers /></ScrollPage>} />
          <Route path="/admin/users/create" element={<ScrollPage><AdminCreateUser /></ScrollPage>} />
          <Route path="/admin/roles" element={<ScrollPage><RoleManagement /></ScrollPage>} />
          <Route path="/admin/audit-logs" element={<ScrollPage><AuditLogs /></ScrollPage>} />
        </Routes>
        </RouteGuard>
      </main>
      <ChatPanel />
    </div>
  );
}
