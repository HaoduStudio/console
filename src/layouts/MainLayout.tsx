import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, DialogPlugin } from 'tdesign-react';
import { 
  DashboardIcon, 
  ServerIcon, 
  CloudIcon, 
  WatchIcon, 
  ShopIcon, 
  FolderIcon, 
  NotificationIcon, 
  UserIcon, 
  LogoutIcon 
} from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import { postSignOutRedirectUri } from '../config/logto';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Content, Aside } = Layout;
const { MenuItem, SubMenu } = Menu;

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, getIdTokenClaims, isAuthenticated } = useLogto();
  const [username, setUsername] = useState('User');
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = false;

  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated) {
      getIdTokenClaims().then((claims) => {
        if (isMounted && claims) {
          setUsername(claims.name || claims.sub || '用户');
        }
      }).catch((error) => {
        console.error('获取用户信息失败:', error);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, getIdTokenClaims]);

  const handleLogout = () => {
    const confirmDialog = DialogPlugin.confirm({
      header: '确认退出',
      body: '您确定要退出登录吗？',
      onConfirm: async () => {
        await signOut(postSignOutRedirectUri);
        confirmDialog.hide();
      },
      onClose: () => {
        confirmDialog.hide();
      }
    });
  };

  const handleUserMenuClick = (data: any) => {
    if (data.value === 'logout') {
      handleLogout();
    } else if (data.value === 'user-center') {
      navigate('/my');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', background: 'var(--td-bg-color-container)', borderBottom: '1px solid var(--td-component-stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--td-text-color-primary)' }}>Dailys Network</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button shape="square" variant="text" icon={<NotificationIcon />} />
          <Dropdown
            trigger="click"
            onClick={handleUserMenuClick}
            options={[
              { content: username, value: 'username', disabled: true },
              { content: '用户中心', value: 'user-center', prefixIcon: <UserIcon /> },
              { content: '退出登录', value: 'logout', prefixIcon: <LogoutIcon />, theme: 'error' },
            ]}
          >
            <Button variant="text" shape="square" icon={<UserIcon />} />
          </Dropdown>
        </div>
      </Header>
      <Layout>
        <Aside width="232px">
          <Menu
            value={location.pathname}
            collapsed={collapsed}
            onChange={(v) => navigate(v as string)}
            style={{ height: '100%' }}
          >
            <MenuItem value="/" icon={<DashboardIcon />}>
              仪表盘
            </MenuItem>
            <SubMenu value="resource" title="资源中心" icon={<ServerIcon />}>
              <MenuItem value="/resource/market" icon={<ShopIcon />}>资源市场</MenuItem>
              <MenuItem value="/resource/my" icon={<FolderIcon />}>我的资源</MenuItem>
            </SubMenu>
            <MenuItem value="/sync" icon={<CloudIcon />}>
              云同步
            </MenuItem>
            <MenuItem value="/devices" icon={<WatchIcon />}>
              我的设备
            </MenuItem>
          </Menu>
        </Aside>
        <Content style={{ padding: '24px' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
