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
  MessageOutlined,
} from '@ant-design/icons';
import { IS_STATIC } from '../services/api';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import './PageHeader.css';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path?: string;
  key: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  /** Optional extra content (e.g. search bar) rendered at the right side */
  extra?: React.ReactNode;
  onFeedbackClick?: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ extra, onFeedbackClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  const navItems: NavItem[] = [
    { key: 'home', icon: <HomeOutlined />, label: '主页', path: '/' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索', path: '/search' },
    { key: 'library', icon: <UnorderedListOutlined />, label: '曲库', path: '/library' },
    { key: 'albums', icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
    { key: 'artists', icon: <UserOutlined />, label: '创作者', path: '/artists' },
    { key: 'tags', icon: <TagsOutlined />, label: '标签', path: '/tags' },
    { key: 'feedback', icon: <MessageOutlined />, label: '反馈', onClick: onFeedbackClick },
  ];

  const isActive = (path?: string) => {
    if (!path) return false;
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
              key={item.key}
              className={`page-header-nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                  return;
                }
                if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              <span className="page-header-nav-icon">{item.icon}</span>
              <span className="page-header-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Right side: extra + theme toggle */}
        <div className="page-header-right">
          {extra}
          {!IS_STATIC && (
            <button
              className="page-header-auth-button"
              onClick={() => navigate(isAuthenticated ? '/me' : '/admin/login')}
            >
              <span className="page-header-nav-icon">
                {isAuthenticated ? <UserOutlined /> : <LoginOutlined />}
              </span>
              <span>{isAuthenticated ? (user?.username || '我的') : '登录'}</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default PageHeader;

