import React from 'react';
import { Button, Card, Typography } from 'antd';
import type { MaintenanceModeConfig } from '../services/siteConfigService';
import { useAuthModalStore } from '../store/authModalStore';
import './Maintenance.css';

const { Title, Paragraph, Text } = Typography;

interface MaintenanceProps {
  config?: MaintenanceModeConfig;
  onOpenFeedback?: () => void;
}

const formatExpectedEndTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('zh-CN', { hour12: false });
};

const DEFAULT_MAINTENANCE_MESSAGE = '我们正在进行维护与优化，请稍后再访问。';

const Maintenance: React.FC<MaintenanceProps> = ({ config, onOpenFeedback }) => {
  const { openLogin } = useAuthModalStore();
  const expectedTime = formatExpectedEndTime(config?.expected_end_time);
  const messageText = config?.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE;

  return (
    <div className="maintenance-page">
      <Card className="maintenance-card" bordered={false}>
        <Title level={2}>站点正在维护</Title>
        <Paragraph>{messageText}</Paragraph>
        {expectedTime && (
          <Paragraph>
            <Text strong>预计恢复时间：</Text>
            <Text>{expectedTime}</Text>
          </Paragraph>
        )}
        <div className="maintenance-actions">
          <Button type="primary" size="large" onClick={() => openLogin('/admin')}>
            管理入口
          </Button>
          <Button size="large" onClick={onOpenFeedback}>
            反馈
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Maintenance;


