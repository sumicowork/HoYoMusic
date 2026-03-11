import React from 'react';
import { Popover, Button, Slider, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';

const { Text } = Typography;

const CrossfadeControl: React.FC = () => {
  const { crossfadeDuration, setCrossfadeDuration } = usePlayerStore();

  const content = (
    <div style={{ width: 160 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>淡入淡出</Text>
      <Slider
        min={0}
        max={12}
        step={1}
        value={crossfadeDuration}
        onChange={setCrossfadeDuration}
        marks={{ 0: '关', 3: '3s', 6: '6s', 12: '12s' }}
      />
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="top">
      <Button
        type="text"
        size="small"
        icon={<SwapOutlined />}
        style={{
          fontSize: 12,
          color: crossfadeDuration > 0 ? '#1890ff' : undefined,
        }}
      >
        {crossfadeDuration > 0 ? `${crossfadeDuration}s` : ''}
      </Button>
    </Popover>
  );
};

export default CrossfadeControl;

