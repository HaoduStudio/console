import { useHandleSignInCallback } from '@logto/react';
import { useNavigate } from 'react-router-dom';

export function CallbackPage() {
  const navigate = useNavigate();
  
  const { isLoading } = useHandleSignInCallback(() => {
    navigate('/', { replace: true });
  });

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
        <div>正在登录...</div>
      </div>
    );
  }

  return null;
}
