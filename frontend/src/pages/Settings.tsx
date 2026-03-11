import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Space, Typography, Divider } from 'antd';
import { LockOutlined, ExportOutlined, DatabaseOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleChangePassword = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      return message.error('两次输入的新密码不一致');
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('密码修改成功');
      form.resetFields();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '修改失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const url = `/api/analytics/export?format=${format}`;
      window.open(url, '_blank');
    } catch {
      message.error('导出失败');
    }
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24, maxWidth: 600 }}>
        <Title level={3}>设置</Title>

        <Card title={<><LockOutlined /> 修改密码</>} style={{ marginBottom: 24 }}>
          <Form form={form} layout="vertical" onFinish={handleChangePassword}>
            <Form.Item
              name="currentPassword"
              label="当前密码"
              rules={[{ required: true, message: '请输入当前密码' }]}
            >
              <Input.Password placeholder="输入当前密码" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[
                { required: true, message: '请输入新密码' },
                { min: 6, message: '密码至少6个字符' },
              ]}
            >
              <Input.Password placeholder="输入新密码" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认新密码"
              rules={[{ required: true, message: '请确认新密码' }]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              修改密码
            </Button>
          </Form>
        </Card>

        <Card title={<><DatabaseOutlined /> 数据管理</>}>
          <Space direction="vertical">
            <Text type="secondary">导出全部曲目元数据</Text>
            <Space>
              <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
                导出 JSON
              </Button>
              <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
                导出 CSV
              </Button>
            </Space>
          </Space>
          <Divider />
          <Text type="secondary">
            API 文档：<a href="/api/docs" target="_blank" rel="noopener noreferrer">打开 Swagger UI</a>
          </Text>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Settings;

