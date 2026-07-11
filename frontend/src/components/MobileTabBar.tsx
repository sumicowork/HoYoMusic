import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  SearchOutlined,
  AppstoreOutlined,
  UserOutlined,
  IdcardOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { useAuthStore } from '../store/authStore';
import { useAuthModalStore } from '../store/authModalStore';
import './MobileTabBar.css';

interface TabItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path?: string;
  onClick?: () => void;
}

interface MobileTabBarProps {
  onFeedbackClick?: () => void;
}

const MobileTabBar: React.FC<MobileTabBarProps> = ({ onFeedbackClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrack } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();
  const { openLogin } = useAuthModalStore();

  const goToMe = () => {
    if (isAuthenticated) {
      navigate('/me');
      return;
    }
    openLogin(`${location.pathname}${location.search}${location.hash}`);
  };

  const tabs: TabItem[] = [
    { key: 'home', icon: <HomeOutlined />, label: '主页', path: '/' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索', path: '/search' },
    { key: 'albums', icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
    { key: 'artists', icon: <UserOutlined />, label: '创作者', path: '/artists' },
    { key: 'me', icon: <IdcardOutlined />, label: '我的', onClick: goToMe },
    { key: 'feedback', icon: <MessageOutlined />, label: '反馈', onClick: onFeedbackClick },
  ];

  return (
    <nav
      className={`mobile-tab-bar${currentTrack ? ' with-player' : ''}`}
      role="navigation"
      aria-label="移动端导航"
    >
      {tabs.map((tab) => {
        const isActive = tab.path === '/'
          ? location.pathname === '/'
          : Boolean(tab.path && location.pathname.startsWith(tab.path));
        return (
          <button
            key={tab.key}
            className={`mobile-tab-item${isActive ? ' active' : ''}`}
            onClick={() => {
              if (tab.onClick) {
                tab.onClick();
                return;
              }
              if (tab.path) {
                navigate(tab.path);
              }
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
          >
            <span className="mobile-tab-icon">{tab.icon}</span>
            <span className="mobile-tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileTabBar;

