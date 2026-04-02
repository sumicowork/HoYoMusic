import React from 'react';
import { Layout, Menu, Drawer, Button } from 'antd';
import {
  SoundOutlined,
  FolderOutlined,
  TagsOutlined,
  LogoutOutlined,
  UserOutlined,
  AppstoreOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  MenuOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import './AdminLayout.css';

const { Sider, Content } = Layout;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const menuItems = [
    {
      key: '/admin',
      icon: <SoundOutlined />,
      label: '曲目管理',
      onClick: () => navigate('/admin')
    },
    {
      key: '/admin/albums',
      icon: <FolderOutlined />,
      label: '专辑管理',
      onClick: () => navigate('/admin/albums')
    },
    {
      key: '/admin/tags',
      icon: <TagsOutlined />,
      label: '标签管理',
      onClick: () => navigate('/admin/tags')
    },
    {
      key: '/admin/games',
      icon: <AppstoreOutlined />,
      label: '游戏管理',
      onClick: () => navigate('/admin/games')
    },
    {
      key: '/admin/artists',
      icon: <TeamOutlined />,
      label: '艺术家管理',
      onClick: () => navigate('/admin/artists')
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: '用户管理',
      onClick: () => navigate('/admin/users')
    },
    {
      key: '/admin/analytics',
      icon: <BarChartOutlined />,
      label: '访问统计',
      onClick: () => navigate('/admin/analytics')
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/admin/settings')
    },
    {
      key: '/admin/music-sources/library',
      icon: <ApartmentOutlined />,
      label: 'Music Source 库管理',
      onClick: () => navigate('/admin/music-sources/library')
    },
    {
      type: 'divider' as const
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true
    }
  ];

  // Determine selected key based on current path
  const getSelectedKey = () => {
    if (location.pathname === '/admin/albums') return '/admin/albums';
    if (location.pathname === '/admin/tags') return '/admin/tags';
    if (location.pathname === '/admin/games') return '/admin/games';
    if (location.pathname === '/admin/artists') return '/admin/artists';
    if (location.pathname === '/admin/users') return '/admin/users';
    if (location.pathname === '/admin/analytics') return '/admin/analytics';
    if (location.pathname === '/admin/settings') return '/admin/settings';
    if (location.pathname === '/admin/music-sources/library') return '/admin/music-sources/library';
    return '/admin';
  };

  const sidebarContent = (
    <>
      <div className="admin-logo">
        <h2>🎵 HoYoMusic</h2>
        <div className="admin-user">
          <UserOutlined /> {user?.username}
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        className="admin-menu"
        onClick={() => setMobileMenuOpen(false)}
      />
      <div className="admin-theme-toggle">
        <ThemeToggle showLabel />
      </div>
    </>
  );

  return (
    <Layout className="admin-layout-wrapper">
      <div className="admin-mobile-header">
        <h2>🎵 HoYoMusic Admin</h2>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
          className="admin-mobile-menu-btn"
          aria-label="打开管理菜单"
        />
      </div>
      <Drawer
        title="Admin Menu"
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        className="admin-mobile-drawer"
        width={250}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
      >
        <div className="admin-sidebar" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {sidebarContent}
        </div>
      </Drawer>
      <Sider
        breakpoint="lg"
        collapsedWidth="0"
        className="admin-sidebar admin-desktop-sidebar"
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
        trigger={null}
      >
        {sidebarContent}
      </Sider>
      <Layout className="admin-main-layout">
        <Content className="admin-main-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
