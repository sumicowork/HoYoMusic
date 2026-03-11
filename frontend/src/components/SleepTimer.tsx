import React, { useState, useEffect } from 'react';
import { Popover, Button, Space, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { usePlayerStore } from '../store/playerStore';

const { Text } = Typography;

const PRESETS = [
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '45 分钟', value: 45 },
  { label: '60 分钟', value: 60 },
  { label: '90 分钟', value: 90 },
];

const SleepTimer: React.FC = () => {
  const { sleepTimerEnd, setSleepTimer, clearSleepTimer, pause } = usePlayerStore();
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!sleepTimerEnd) {
      setRemaining(null);
      return;
    }

    const interval = setInterval(() => {
      const diff = sleepTimerEnd - Date.now();
      if (diff <= 0) {
        pause();
        clearSleepTimer();
        setRemaining(null);
      } else {
        const m = Math.floor(diff / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEnd, pause, clearSleepTimer]);

  const content = (
    <Space direction="vertical" size="small" style={{ width: 140 }}>
      {remaining ? (
        <>
          <Text type="secondary">剩余 {remaining}</Text>
          <Button size="small" block danger onClick={clearSleepTimer}>
            取消定时
          </Button>
        </>
      ) : (
        <>
          <Text type="secondary">睡眠定时器</Text>
          {PRESETS.map(p => (
            <Button
              key={p.value}
              size="small"
              block
              onClick={() => setSleepTimer(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </>
      )}
    </Space>
  );

  return (
    <Popover content={content} trigger="click" placement="top">
      <Button
        type="text"
        size="small"
        icon={<ClockCircleOutlined />}
        style={{
          color: remaining ? '#1890ff' : undefined,
          fontSize: 14,
        }}
      >
        {remaining || ''}
      </Button>
    </Popover>
  );
};

export default SleepTimer;

