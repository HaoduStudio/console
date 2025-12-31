import { useLogto } from '@logto/react';
import { useEffect, useState } from 'react';
import './Home.css';

export function HomePage() {
  const { getIdTokenClaims, isAuthenticated } = useLogto();
  const [username, setUsername] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated) {
      getIdTokenClaims().then((claims) => {
        if (isMounted && claims) {
          setUsername(claims.name || claims.sub || '用户');
        }
      }).catch(console.error);
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, getIdTokenClaims]);

  return (
    <div className="home-container">
      <h1>仪表盘</h1>
      <p>欢迎回来, {username}!</p>
    </div>
  );
}
