import React from 'react';
import { Layout, Menu, Drawer, Button } from 'antd';
import type { MenuProps } from 'antd';
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
  ApartmentOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS, resolveAdminMenuPath } from '../config/adminNavigation';
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
    navigate('/');
  };

  const iconByPath: Record<string, React.ReactNode> = {
    '/admin': <SoundOutlined />,
    '/admin/albums': <FolderOutlined />,
    '/admin/music-sources/library': <ApartmentOutlined />,
    '/admin/artists': <TeamOutlined />,
    '/admin/tags': <TagsOutlined />,
    '/admin/games': <AppstoreOutlined />,
    '/admin/users': <UserOutlined />,
    '/admin/comments': <AuditOutlined />,
    '/admin/analytics': <BarChartOutlined />,
    '/admin/settings': <SettingOutlined />,
  };

  const menuItems: MenuProps['items'] = [
    ...ADMIN_NAV_SECTIONS.map((section) => ({
      type: 'group' as const,
      key: section.key,
      label: section.label,
      children: ADMIN_NAV_ITEMS
        .filter((item) => item.sectionKey === section.key)
        .map((item) => ({
          key: item.path,
          icon: iconByPath[item.path],
          label: item.label,
          onClick: () => navigate(item.path),
        })),
    })),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ];

  const selectedMenuPath = resolveAdminMenuPath(location.pathname);

  const sidebarContent = (
    <>
      <div className="admin-logo">
        <h2>🎵 HoYoMusic Admin</h2>
        <div className="admin-user">
          <UserOutlined /> {user?.username}
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedMenuPath]}
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
        <h2>后台管理</h2>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(true)}
          className="admin-mobile-menu-btn"
          aria-label="打开管理菜单"
        />
      </div>
      <Drawer
        title="管理菜单"
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
