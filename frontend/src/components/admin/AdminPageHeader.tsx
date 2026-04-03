import React from 'react';
import { Space, Typography } from 'antd';
import './AdminPageHeader.css';

const { Title, Text } = Typography;

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ title, description, actions }) => (
  <div className="admin-page-header">
    <Space direction="vertical" size={4}>
      <Title level={3} style={{ margin: 0 }}>{title}</Title>
      {description ? <Text type="secondary">{description}</Text> : null}
    </Space>
    {actions ? <div className="admin-page-header-actions">{actions}</div> : null}
  </div>
);

export default AdminPageHeader;

