import React from 'react';
import { Layout, Menu } from 'antd';
import {
  SoundOutlined,
  FolderOutlined,
  TagsOutlined,
  LogoutOutlined,
  UserOutlined
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
    return '/admin';
  };

  return (
    <Layout className="admin-layout-wrapper">
      <Sider
        className="admin-sidebar"
        width={250}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
        }}
      >
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
        />
        <div className="admin-theme-toggle">
          <ThemeToggle showLabel />
        </div>
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







