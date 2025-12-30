import { useLogto } from '@logto/react';
import { Button } from 'tdesign-react';
import { postSignOutRedirectUri } from '../config/logto';
import './Home.css';

export function HomePage() {
  const { signOut, getIdTokenClaims } = useLogto();
  
  const handleSignOut = async () => {
    await signOut(postSignOutRedirectUri);
  };

  const showUserInfo = async () => {
    const claims = await getIdTokenClaims();
    console.log('用户信息:', claims);
    alert(`欢迎, ${claims?.name || claims?.sub || '用户'}!`);
  };

  return (
    <div className="home-container">
      <h1>Dailys Network 控制台</h1>
      <p>您已成功登录！</p>
      <div className="home-actions">
        <Button theme="primary" onClick={showUserInfo}>
          查看用户信息
        </Button>
        <Button theme="default" onClick={handleSignOut}>
          退出登录
        </Button>
      </div>
    </div>
  );
}
