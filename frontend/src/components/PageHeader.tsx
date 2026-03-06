import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  UserOutlined,
  TagsOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { IS_STATIC } from '../services/api';
import ThemeToggle from './ThemeToggle';
import './PageHeader.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: <HomeOutlined />, label: '主页', path: '/' },
  { icon: <SearchOutlined />, label: '搜索', path: '/search' },
  { icon: <UnorderedListOutlined />, label: '曲库', path: '/library' },
  { icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
  { icon: <UserOutlined />, label: '创作者', path: '/artists' },
  { icon: <TagsOutlined />, label: '标签', path: '/tags' },
  ...(!IS_STATIC ? [{ icon: <LoginOutlined />, label: '管理', path: '/admin/login' } as NavItem] : []),
];

interface PageHeaderProps {
  /** Optional extra content (e.g. search bar) rendered at the right side */
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ extra }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <header className="page-header">
      <div className="page-header-inner">
        {/* Logo */}
        <div className="page-header-logo" onClick={() => navigate('/')}>
          🎵 HoYoMusic
        </div>

        {/* Navigation */}
        <nav className="page-header-nav">
          {navItems.map((item) => (
            <button
              key={item.path}
              className={`page-header-nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="page-header-nav-icon">{item.icon}</span>
              <span className="page-header-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side: extra + theme toggle */}
        <div className="page-header-right">
          {extra}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default PageHeader;

