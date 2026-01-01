import { useEffect } from 'react';
import { LogtoProvider } from '@logto/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { logtoConfig } from './config/logto';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SignInPage } from './pages/SignIn';
import { CallbackPage } from './pages/Callback';
import { HomePage } from './pages/Home';
import { UserCenterPage } from './pages/UserCenter';
import { MainLayout } from './layouts/MainLayout';

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
