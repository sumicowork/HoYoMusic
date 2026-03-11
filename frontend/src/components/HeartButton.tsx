import React, { useState, useCallback } from 'react';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { message } from 'antd';
import favoriteService from '../services/favoriteService';

interface HeartButtonProps {
  trackId: number;
  initialFavorited?: boolean;
  size?: number;
  style?: React.CSSProperties;
}

const HeartButton: React.FC<HeartButtonProps> = ({
  trackId,
  initialFavorited = false,
  size = 18,
  style,
}) => {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const result = await favoriteService.toggle(trackId);
      setFavorited(result.favorited);
    } catch {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  }, [trackId, loading]);

  return favorited ? (
    <HeartFilled
      onClick={handleToggle}
      style={{ fontSize: size, color: '#ff4d6a', cursor: 'pointer', transition: 'all 0.2s', ...style }}
    />
  ) : (
    <HeartOutlined
      onClick={handleToggle}
      style={{ fontSize: size, color: '#999', cursor: 'pointer', transition: 'all 0.2s', ...style }}
    />
  );
};

export default HeartButton;

