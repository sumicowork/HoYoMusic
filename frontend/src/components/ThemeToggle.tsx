import React from 'react';
import { Switch, Tooltip } from 'antd';
import { BulbOutlined, BulbFilled } from '@ant-design/icons';
import { useThemeStore } from '../store/themeStore';
import './ThemeToggle.css';

interface ThemeToggleProps {
  size?: 'small' | 'default';
  showLabel?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ size = 'default', showLabel = false }) => {
  const { mode, toggleTheme } = useThemeStore();
  const isDark = mode === 'dark';

  return (
    <div className="theme-toggle">
      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? '深色模式' : '浅色模式'}
        </span>
      )}
      <Tooltip title={isDark ? '切换到浅色模式' : '切换到深色模式'}>
        <Switch
          checked={isDark}
          onChange={toggleTheme}
          checkedChildren={<BulbFilled />}
          unCheckedChildren={<BulbOutlined />}
          size={size}
          className="theme-toggle-switch"
        />
      </Tooltip>
    </div>
  );
};

export default ThemeToggle;

