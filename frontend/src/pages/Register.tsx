import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, message, Spin, Typography } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import './Login.css';

const { Text } = Typography;

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken, isAuthenticated, isInitialized } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [form] = Form.useForm();

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isInitialized, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  if (!isInitialized) {
    return <Spin fullscreen />;
  }

  if (isAuthenticated) return null;

  const handleSendCode = async () => {
    try {
      const email = await form.validateFields(['email']);
      setSendingCode(true);
      const result = await authService.sendVerificationCode(email.email);
      message.success(result.message || '验证码已发送');
      setCountdown(60);
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const onFinish = async (values: {
    username: string;
    email: string;
    verification_code: string;
    password: string;
    confirm_password: string;
  }) => {
    setSubmitting(true);
    try {
      const result = await authService.register(values);
      setToken(result.token);
      setUser(result.user);
      message.success('注册成功，已自动登录');
      navigate('/', { replace: true });
    } catch (error: any) {
      message.error(error?.message || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <div className="login-header">
          <h1>🎵 HoYoMusic</h1>
          <p>注册新账号</p>
        </div>

        <Form form={form} name="register" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }, { min: 2, message: '用户名至少 2 位' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效邮箱地址' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button onClick={handleSendCode} loading={sendingCode} disabled={countdown > 0} block>
              {countdown > 0 ? `${countdown}s 后可重发` : '发送验证码'}
            </Button>
          </Form.Item>

          <Form.Item
            name="verification_code"
            rules={[{ required: true, message: '请输入验证码' }, { len: 6, message: '验证码为 6 位数字' }]}
          >
            <Input placeholder="邮箱验证码" maxLength={6} />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              注册并登录
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Text type="secondary">已有账号？</Text>
            <Link to="/admin/login" style={{ marginLeft: 8 }}>返回登录</Link>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Register;

