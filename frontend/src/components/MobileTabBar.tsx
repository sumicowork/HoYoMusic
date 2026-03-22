import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  UserOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import { useDebugUserFeatures, isTestDebugEnabled } from '../utils/debugFeature';
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
  const showDebugUserFeatures = useDebugUserFeatures();
  const debugQuery = isTestDebugEnabled(location.search) ? '?test_debug=1' : '';

  const tabs: TabItem[] = [
    { key: 'home', icon: <HomeOutlined />, label: '主页', path: '/' },
    { key: 'search', icon: <SearchOutlined />, label: '搜索', path: '/search' },
    { key: 'library', icon: <UnorderedListOutlined />, label: '曲库', path: '/library' },
    { key: 'albums', icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
    { key: 'feedback', icon: <MessageOutlined />, label: '反馈', onClick: onFeedbackClick },
    { key: 'artists', icon: <UserOutlined />, label: '创作者', path: '/artists' },
    ...(showDebugUserFeatures ? [{ key: 'me', icon: <UserOutlined />, label: '我的', path: `/me${debugQuery}` } as TabItem] : []),
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

