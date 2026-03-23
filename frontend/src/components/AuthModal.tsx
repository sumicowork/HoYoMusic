import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Typography, message } from 'antd';
import type { InputRef } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useAuthModalStore } from '../store/authModalStore';

const { Text } = Typography;

const normalizeEmailInput = (value: string): string => value
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/\u3000/g, ' ')
  .trim()
  .replace(/[＠﹫]/g, '@')
  .replace(/[。．｡﹒]/g, '.')
  .toLowerCase();

const AuthModal: React.FC = () => {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const { open, mode, redirectTo, close, setMode } = useAuthModalStore();

  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const registerEmailInputRef = useRef<InputRef>(null);

  const [loginForm] = Form.useForm<{ identifier: string; password: string }>();
  const [registerForm] = Form.useForm<{
    username: string;
    email: string;
    verification_code: string;
    password: string;
    confirm_password: string;
  }>();

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

  useEffect(() => {
    if (!open) {
      loginForm.resetFields();
      registerForm.resetFields();
      setCountdown(0);
    }
  }, [open, loginForm, registerForm]);

  const afterAuthSuccess = (user: { is_admin?: boolean }) => {
    const target = redirectTo;
    close();
    if (target) {
      if (target.startsWith('/admin') && !user.is_admin) {
        navigate('/', { replace: true });
        message.warning('该账号无管理权限');
        return;
      }
      navigate(target, { replace: true });
      return;
    }

    if (user.is_admin) {
      navigate('/admin', { replace: true });
    }
  };

  const handleLogin = async () => {
    try {
      const values = await loginForm.validateFields();
      setLoginLoading(true);
      const result = await authService.login(values);
      setToken(result.token);
      setUser(result.user);
      message.success('登录成功');
      afterAuthSuccess(result.user);
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.message || '登录失败');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendCode = async () => {
    try {
      const formEmail = registerForm.getFieldValue('email');
      const inputEmail = registerEmailInputRef.current?.input?.value;
      const normalizedEmail = normalizeEmailInput(String(formEmail ?? inputEmail ?? ''));
      if (!normalizedEmail) {
        message.error('请输入邮箱地址');
        return;
      }

      registerForm.setFieldsValue({ email: normalizedEmail });

      setSendingCode(true);
      const result = await authService.sendVerificationCode(normalizedEmail);
      message.success(result.message || '验证码已发送');
      setCountdown(60);
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.message || '发送验证码失败');
      }
    } finally {
      setSendingCode(false);
    }
  };

  const handleRegister = async () => {
    try {
      const formEmail = registerForm.getFieldValue('email');
      const inputEmail = registerEmailInputRef.current?.input?.value;
      const normalizedEmail = normalizeEmailInput(String(formEmail ?? inputEmail ?? ''));
      if (normalizedEmail) {
        registerForm.setFieldsValue({ email: normalizedEmail });
      }

      const values = await registerForm.validateFields();
      setRegisterLoading(true);
      const result = await authService.register(values);
      setToken(result.token);
      setUser(result.user);
      message.success('注册成功，已自动登录');
      afterAuthSuccess(result.user);
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error?.message || '注册失败');
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const title = mode === 'login' ? '登录账号' : '注册账号';

  return (
    <Modal
      title={title}
      open={open}
      onCancel={close}
      footer={null}
      destroyOnHidden
      width={460}
      maskClosable={!loginLoading && !registerLoading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        <Alert
          type="info"
          showIcon
          message="支持用户名或邮箱登录；注册后自动登录。"
        />

        {mode === 'login' ? (
          <>
            <Form form={loginForm} layout="vertical" onFinish={() => void handleLogin()}>
              <Form.Item
                label="用户名或邮箱"
                name="identifier"
                rules={[{ required: true, message: '请输入用户名或邮箱' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入用户名或邮箱" />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={loginLoading}>
                  登录
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">还没有账号？</Text>
              <Button type="link" onClick={() => setMode('register')} style={{ paddingInline: 6 }}>
                去注册
              </Button>
            </div>
          </>
        ) : (
          <>
            <Form form={registerForm} layout="vertical" onFinish={() => void handleRegister()}>
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }, { min: 2, message: '用户名至少 2 位' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
              </Form.Item>

              <Form.Item
                label="邮箱"
                name="email"
                normalize={(value) => (typeof value === 'string' ? normalizeEmailInput(value) : value)}
                rules={[{ required: true, message: '请输入邮箱' }]}
              >
                <Input ref={registerEmailInputRef} prefix={<MailOutlined />} placeholder="请输入邮箱" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button onClick={() => void handleSendCode()} loading={sendingCode} disabled={countdown > 0} block>
                  {countdown > 0 ? `${countdown}s 后可重发` : '发送验证码'}
                </Button>
              </Form.Item>

              <Form.Item
                label="验证码"
                name="verification_code"
                rules={[{ required: true, message: '请输入验证码' }, { len: 6, message: '验证码为 6 位数字' }]}
              >
                <Input placeholder="请输入邮箱验证码" maxLength={6} />
              </Form.Item>

              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
              </Form.Item>

              <Form.Item
                label="确认密码"
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
                <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" block loading={registerLoading}>
                  注册并登录
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">已有账号？</Text>
              <Button type="link" onClick={() => setMode('login')} style={{ paddingInline: 6 }}>
                去登录
              </Button>
            </div>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default AuthModal;

