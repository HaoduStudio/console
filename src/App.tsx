import { useEffect } from 'react';
import { LogtoProvider } from '@logto/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { logtoConfig } from './config/logto';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SignInPage } from './pages/SignIn';
import { CallbackPage } from './pages/Callback';
import { HomePage } from './pages/Home';
import { UserCenterPage } from './pages/UserCenter';
import { ResourceMarketPage } from './pages/ResourceMarket';
import { MyResourcesPage } from './pages/MyResources';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserManagement } from './pages/UserManagement';
import { ResourceManagement } from './pages/ResourceManagement';
import { AnnouncementManagement } from './pages/AnnouncementManagement';
import { MainLayout } from './layouts/MainLayout';
import { AdminLayout } from './layouts/AdminLayout';

import 'tdesign-react/es/style/index.css';

function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        document.documentElement.setAttribute('theme-mode', 'dark');
      } else {
        document.documentElement.removeAttribute('theme-mode');
      }
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <LogtoProvider config={logtoConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UserCenterPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource/market"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <ResourceMarketPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/resource/my"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <MyResourcesPage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          {/* 管理员路由 */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <UserManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/resources"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ResourceManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/announcements"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AnnouncementManagement />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <HomePage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </LogtoProvider>
  );
}

export default App;
