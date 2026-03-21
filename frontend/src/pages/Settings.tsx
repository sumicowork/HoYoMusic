import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, message, Space, Typography, Divider, Switch, InputNumber, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined, ExportOutlined, DatabaseOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import api from '../services/api';
import { siteConfigService, type FirstVisitModalConfig, type SiteComplianceConfig } from '../services/siteConfigService';
import { feedbackService, type FeedbackItem } from '../services/feedbackService';

const { Title, Text } = Typography;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceSaving, setComplianceSaving] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [feedbackPagination, setFeedbackPagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();
  const [modalForm] = Form.useForm();
  const [complianceForm] = Form.useForm();

  const feedbackColumns: ColumnsType<FeedbackItem> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '反馈内容',
      dataIndex: 'content',
      key: 'content',
      render: (value: string) => <div style={{ whiteSpace: 'pre-wrap' }}>{value}</div>,
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      width: 180,
      render: (value: string | null) => value || <Tag>未填写</Tag>,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (value: string | null) => value || '—',
    },
  ];

  const loadFirstVisitModalConfig = async () => {
    setModalLoading(true);
    try {
      const config = await siteConfigService.getAdminFirstVisitModal();
      modalForm.setFieldsValue(config);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载首访弹窗配置失败';
      message.error(msg);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => {
    loadFirstVisitModalConfig();
  }, []);

  const loadComplianceConfig = async () => {
    setComplianceLoading(true);
    try {
      const config = await siteConfigService.getAdminComplianceConfig();
      complianceForm.setFieldsValue(config);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载备案配置失败';
      message.error(msg);
    } finally {
      setComplianceLoading(false);
    }
  };

  useEffect(() => {
    loadComplianceConfig();
  }, []);

  const loadFeedback = async (page = feedbackPagination.page, pageSize = feedbackPagination.pageSize) => {
    setFeedbackLoading(true);
    try {
      const data = await feedbackService.getAdminList(page, pageSize);
      setFeedbackItems(data.items);
      setFeedbackPagination({ page: data.pagination.page, pageSize: data.pagination.pageSize, total: data.pagination.total });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '加载反馈列表失败';
      message.error(msg);
    } finally {
      setFeedbackLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

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

  const handleSaveFirstVisitModal = async (values: FirstVisitModalConfig) => {
    setModalSaving(true);
    try {
      const saved = await siteConfigService.updateAdminFirstVisitModal({
        enabled: values.enabled,
        title: values.title,
        content: values.content,
        min_stay_seconds: values.min_stay_seconds,
      });
      modalForm.setFieldsValue(saved);
      message.success('首访弹窗配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveCompliance = async (values: SiteComplianceConfig) => {
    setComplianceSaving(true);
    try {
      const saved = await siteConfigService.updateAdminComplianceConfig({
        enabled: values.enabled,
        icp_number: values.icp_number || '',
        public_security_number: values.public_security_number || '',
      });
      complianceForm.setFieldsValue(saved);
      message.success('备案配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setComplianceSaving(false);
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

        <Card title="首访弹窗" loading={modalLoading} style={{ marginTop: 24 }}>
          <Form
            form={modalForm}
            layout="vertical"
            initialValues={{ enabled: false, min_stay_seconds: 5 }}
            onFinish={handleSaveFirstVisitModal}
          >
            <Form.Item name="enabled" label="启用弹窗" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item
              name="title"
              label="弹窗标题"
              rules={[{ required: true, message: '请输入弹窗标题' }, { max: 120, message: '标题最多 120 字' }]}
            >
              <Input placeholder="例如：访问须知" maxLength={120} />
            </Form.Item>

            <Form.Item
              name="content"
              label="弹窗内容"
              rules={[{ required: true, message: '请输入弹窗内容' }, { max: 5000, message: '内容最多 5000 字' }]}
            >
              <Input.TextArea rows={5} placeholder="支持换行显示" maxLength={5000} showCount />
            </Form.Item>

            <Form.Item
              name="min_stay_seconds"
              label="最短停留时长（秒）"
              rules={[{ required: true, message: '请输入最短停留时长' }]}
            >
              <InputNumber min={5} max={120} precision={0} style={{ width: 180 }} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={modalSaving}>
              保存弹窗配置
            </Button>
          </Form>
        </Card>

        <Card title="备案信息" loading={complianceLoading} style={{ marginTop: 24 }}>
          <Form
            form={complianceForm}
            layout="vertical"
            initialValues={{ enabled: false, icp_number: '', public_security_number: '' }}
            onFinish={handleSaveCompliance}
          >
            <Form.Item name="enabled" label="启用备案展示" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>

            <Form.Item
              name="icp_number"
              label="ICP备案号"
              rules={[{ max: 100, message: '备案号最多 100 字' }]}
              extra="将自动跳转到工信部备案系统。"
            >
              <Input placeholder="例如：沪ICP备2026000000号" maxLength={100} />
            </Form.Item>

            <Form.Item
              name="public_security_number"
              label="公网安备号"
              rules={[{ max: 100, message: '备案号最多 100 字' }]}
              extra="将自动提取编号并跳转到全国互联网安全管理服务平台。"
            >
              <Input placeholder="例如：沪公网安备31010102001234号" maxLength={100} />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={complianceSaving}>
              保存备案配置
            </Button>
          </Form>
        </Card>

        <Card
          title="用户反馈"
          extra={<Button onClick={() => loadFeedback(1, feedbackPagination.pageSize)} loading={feedbackLoading}>刷新</Button>}
          style={{ marginTop: 24 }}
        >
          <Table
            rowKey="id"
            loading={feedbackLoading}
            dataSource={feedbackItems}
            columns={feedbackColumns}
            pagination={{
              current: feedbackPagination.page,
              pageSize: feedbackPagination.pageSize,
              total: feedbackPagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `共 ${total} 条反馈`,
            }}
            onChange={(pagination) => {
              loadFeedback(pagination.current || 1, pagination.pageSize || feedbackPagination.pageSize);
            }}
          />
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Settings;

