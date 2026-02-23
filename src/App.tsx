import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <NetworkProvider>
        <AuthProvider>
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        </AuthProvider>
      </NetworkProvider>
    </BrowserRouter>
  );
}

export default App;
