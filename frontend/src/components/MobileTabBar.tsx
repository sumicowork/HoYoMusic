import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';
import './MobileTabBar.css';

const tabs = [
  { icon: <HomeOutlined />, label: '主页', path: '/' },
  { icon: <SearchOutlined />, label: '搜索', path: '/search' },
  { icon: <UnorderedListOutlined />, label: '曲库', path: '/library' },
  { icon: <AppstoreOutlined />, label: '专辑', path: '/albums' },
  { icon: <UserOutlined />, label: '创作者', path: '/artists' },
];

const MobileTabBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTrack } = usePlayerStore();

  return (
    <nav
      className={`mobile-tab-bar${currentTrack ? ' with-player' : ''}`}
      role="navigation"
      aria-label="移动端导航"
    >
      {tabs.map((tab) => {
        const isActive = tab.path === '/'
          ? location.pathname === '/'
          : location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            className={`mobile-tab-item${isActive ? ' active' : ''}`}
            onClick={() => navigate(tab.path)}
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

