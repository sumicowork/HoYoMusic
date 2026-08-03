import React from 'react';
import { Card, Form, Input, Button, message } from 'antd';
import type { FormInstance } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import api from '../../services/api';

interface PasswordSectionProps {
  form: FormInstance;
}

const PasswordSection: React.FC<PasswordSectionProps> = ({ form }) => {
  const [loading, setLoading] = React.useState(false);

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return;
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

  return (
    <Card title={<><LockOutlined /> 修改密码</>}>
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
  );
};

export default PasswordSection;
