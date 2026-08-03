import React from 'react';
import { Card, Form, Input, Button, Switch, message } from 'antd';
import type { FormInstance } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { siteConfigService, type MaintenanceModeConfig } from '../../services/siteConfigService';

interface MaintenanceSectionProps {
  form: FormInstance;
}

const toLocalDatetime = (isoValue: string | null | undefined): string | null => {
  if (!isoValue) return null;
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoDatetime = (localValue: string | null | undefined): string | null => {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const MaintenanceSection: React.FC<MaintenanceSectionProps> = ({ form }) => {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    siteConfigService.getAdminMaintenanceMode()
      .then((config) => {
        form.setFieldsValue({
          enabled: config.enabled,
          expected_end_time: toLocalDatetime(config.expected_end_time),
          message: config.message || '',
        });
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.error?.message || err?.message || '加载维护配置失败';
        message.error(msg);
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSaveMaintenance = async (values: {
    enabled: boolean;
    expected_end_time?: string | null;
    message?: string;
  }) => {
    setSaving(true);
    try {
      const payload: Pick<MaintenanceModeConfig, 'enabled' | 'expected_end_time'> = {
        enabled: values.enabled,
        expected_end_time: toIsoDatetime(values.expected_end_time),
      };
      const payloadWithMessage = {
        ...payload,
        message: (values.message || '').trim(),
      } as Pick<MaintenanceModeConfig, 'enabled' | 'expected_end_time' | 'message'>;
      const saved = await siteConfigService.updateAdminMaintenanceMode(payloadWithMessage);
      form.setFieldsValue({
        enabled: saved.enabled,
        expected_end_time: toLocalDatetime(saved.expected_end_time),
        message: saved.message || '',
      });
      message.success('维护配置已保存');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || '保存失败';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={<><ToolOutlined /> 站点维护</>} loading={loading}>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ enabled: false, expected_end_time: null, message: '' }}
        onFinish={handleSaveMaintenance}
      >
        <Form.Item name="enabled" label="启用维护模式" valuePropName="checked">
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name="expected_end_time"
          label="预计结束时间"
          extra="用于维护页展示，可留空。"
        >
          <Input type="datetime-local" />
        </Form.Item>

        <Form.Item
          name="message"
          label="维护说明"
          rules={[{ max: 5000, message: '维护说明最多 5000 字' }]}
          extra="将展示在维护页，可留空（留空时使用默认文案）。"
        >
          <Input.TextArea rows={4} placeholder="例如：数据库迁移中，预计 20:00 恢复。" maxLength={5000} showCount />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving}>
          保存维护配置
        </Button>
      </Form>
    </Card>
  );
};

export default MaintenanceSection;
