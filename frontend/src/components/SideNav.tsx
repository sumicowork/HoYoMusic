import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tooltip } from 'antd';
import {
  HomeOutlined,
  AppstoreOutlined,
  UserOutlined,
  TagsOutlined,
  UnorderedListOutlined,
  LoginOutlined,
  MoonOutlined,
  SunOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useThemeStore } from '../store/themeStore';
import './SideNav.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path?: string;
  action?: () => void;
  color: string;
}

const SideNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useThemeStore();

  const navItems: NavItem[] = [
    { icon: <HomeOutlined />, label: '主页', path: '/', color: '#667eea' },
    { icon: <SearchOutlined />, label: '搜索', path: '/search', color: '#0ea5e9' },
    { icon: <UnorderedListOutlined />, label: '曲库', path: '/library', color: '#06b6d4' },
    { icon: <AppstoreOutlined />, label: '专辑', path: '/albums', color: '#8b5cf6' },
    { icon: <UserOutlined />, label: '艺术家', path: '/artists', color: '#f59e0b' },
    { icon: <TagsOutlined />, label: '标签', path: '/tags', color: '#10b981' },
    { icon: <LoginOutlined />, label: '管理', path: '/admin/login', color: '#ef4444' },
    {
      icon: mode === 'dark' ? <SunOutlined /> : <MoonOutlined />,
      label: mode === 'dark' ? '浅色' : '深色',
      action: toggleTheme,
      color: mode === 'dark' ? '#fbbf24' : '#6366f1',
    },
  ];

  return (
    <nav className="side-nav">
      {navItems.map((item, idx) => {
        const isActive = item.path && location.pathname === item.path;
        return (
          <Tooltip key={idx} title={item.label} placement="right">
            <div
              className={`side-nav-item ${isActive ? 'active' : ''}`}
              style={{ '--nav-color': item.color } as React.CSSProperties}
              onClick={() => {
                if (item.action) item.action();
                else if (item.path) navigate(item.path);
              }}
            >
              <span className="side-nav-icon">{item.icon}</span>
              <span className="side-nav-label">{item.label}</span>
            </div>
          </Tooltip>
        );
      })}
    </nav>
  );
};

export default SideNav;




