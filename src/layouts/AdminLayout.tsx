import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Button, Dropdown, DialogPlugin, Drawer } from 'tdesign-react';
import type { DropdownOption } from 'tdesign-react';
import { 
  DashboardIcon, 
  UserIcon,
  NotificationIcon, 
  LogoutIcon,
  ViewListIcon,
  CloudIcon,
  HomeIcon
} from 'tdesign-icons-react';
import { useLogto } from '@logto/react';
import { postSignOutRedirectUri } from '../config/logto';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnnouncementNotification } from '../components/AnnouncementNotification';
import './AdminLayout.css';

const { Header, Content, Aside } = Layout;
const { MenuItem } = Menu;

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut, getIdTokenClaims, isAuthenticated } = useLogto();
  const [username, setUsername] = useState('Admin');
  const navigate = useNavigate();
  const location = useLocation();

  const getInitialLayoutState = () => {
    const width = typeof window !== 'undefined' ? window.innerWidth : TABLET_BREAKPOINT;
    const mobile = width < MOBILE_BREAKPOINT;
    return {
      mobile,
      collapsed: !mobile && width < TABLET_BREAKPOINT,
    };
  };

  const [collapsed, setCollapsed] = useState(() => getInitialLayoutState().collapsed);
  const [isMobile, setIsMobile] = useState(() => getInitialLayoutState().mobile);
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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  useEffect(() => {
    let isMounted = true;
    
    if (isAuthenticated) {
      getIdTokenClaims().then((claims) => {
        if (isMounted && claims) {
          setUsername(claims.name || claims.sub || 'Admin');
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

  const handleUserMenuClick = (data: DropdownOption) => {
    if (data.value === 'logout') {
      handleLogout();
    } else if (data.value === 'user-center') {
      navigate('/my');
    } else if (data.value === 'switch-user') {
      navigate('/');
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
      <MenuItem value="/admin" icon={<DashboardIcon />}>
        仪表盘
      </MenuItem>
      <MenuItem value="/admin/users" icon={<UserIcon />}>
        用户管理
      </MenuItem>
      <MenuItem value="/admin/announcements" icon={<NotificationIcon />}>
        公告管理
      </MenuItem>
      <MenuItem value="/admin/resources" icon={<CloudIcon />}>
        资源管理
      </MenuItem>
    </Menu>
  );

  return (
    <Layout className="admin-layout">
      <Header className="admin-header">
        <div className="header-left">
          <Button
            shape="square"
            variant="text"
            icon={<ViewListIcon />}
            onClick={toggleCollapsed}
            className="menu-toggle-btn"
          />
          <span className="app-title">Dailys Admin</span>
        </div>
        <div className="header-right">
          <AnnouncementNotification />
          <Dropdown
            trigger="click"
            onClick={handleUserMenuClick}
            options={[
              { content: username, value: 'username', disabled: true },
              { content: '用户面板', value: 'switch-user', prefixIcon: <HomeIcon /> },
              { content: '用户中心', value: 'user-center', prefixIcon: <UserIcon /> },
              { content: '退出登录', value: 'logout', prefixIcon: <LogoutIcon />, theme: 'error' },
            ]}
          >
            <Button variant="text" shape="square" icon={<UserIcon />} />
          </Dropdown>
        </div>
      </Header>
      <Layout className="admin-body">
        {/* 桌面端侧边栏 */}
        {!isMobile && (
          <Aside width={collapsed ? '64px' : '232px'} className="admin-aside">
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
              <span style={{ fontWeight: 'bold' }}>Dailys Admin</span>
            }
            footer={false}
          >
            {menuContent}
          </Drawer>
        )}
        
        <Content className="admin-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
