import { useLogto } from '@logto/react';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * 受保护的路由组件
 * 如果用户未登录，将重定向到 /signin 页面
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useLogto();
  const location = useLocation();

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div>加载中...</div>
        <div style={{ fontSize: '12px', color: '#888' }}>正在处理您的账户信息...</div>
      </div>
    );
  }

  return <Navigate to="/signin" state={{ from: location }} replace />;
}
