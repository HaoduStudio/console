import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Button, Dropdown, DialogPlugin, Drawer } from 'tdesign-react';
import { 
  DashboardIcon, 
  ServerIcon, 
  CloudIcon, 
  WatchIcon, 
  ShopIcon, 
  FolderIcon, 
  NotificationIcon, 
  UserIcon, 
  LogoutIcon,
  ViewListIcon,
  MenuFoldIcon,
  MenuUnfoldIcon
} from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import { postSignOutRedirectUri } from '../config/logto';
import { useNavigate, useLocation } from 'react-router-dom';
import './MainLayout.css';

const { Header, Content, Aside } = Layout;
const { MenuItem, SubMenu } = Menu;

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, getIdTokenClaims, isAuthenticated } = useLogto();
  const [username, setUsername] = useState('User');
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const mobile = width < MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    
    if (width < TABLET_BREAKPOINT && !mobile) {
      setCollapsed(true);
    }

    if (mobile) {
      setDrawerVisible(false);
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

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

  const handleMenuChange = (v: string | number) => {
    navigate(v as string);
    if (isMobile) {
      setDrawerVisible(false);
    }
  };

  const toggleCollapsed = () => {
    if (isMobile) {
      setDrawerVisible(!drawerVisible);
    } else {
      setCollapsed(!collapsed);
    }
  };

  const menuContent = (
    <Menu
      value={location.pathname}
      collapsed={isMobile ? false : collapsed}
      onChange={handleMenuChange}
      style={{ height: '100%', border: 'none' }}
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
  );

  return (
    <Layout className="main-layout">
      <Header className="main-header">
        <div className="header-left">
          <Button
            shape="square"
            variant="text"
            icon={<ViewListIcon />}
            onClick={toggleCollapsed}
            className="menu-toggle-btn"
          />
          <span className="app-title">Dailys Network</span>
        </div>
        <div className="header-right">
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
      <Layout className="main-body">
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Aside width={collapsed ? '64px' : '232px'} className="main-aside">
            {menuContent}
          </Aside>
        )}
        
        {/* 移动端抽屉 */}
        {isMobile && (
          <Drawer
            visible={drawerVisible}
            onClose={() => setDrawerVisible(false)}
            placement="left"
            size="232px"
            header={
              <span style={{ fontWeight: 'bold' }}>Dailys Network</span>
            }
            footer={false}
          >
            {menuContent}
          </Drawer>
        )}
        
        <Content className="main-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
