import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import './Login.css';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser, setToken, isAuthenticated, isInitialized } = useAuthStore();

  // 若已登录则直接跳转管理后台
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isInitialized, navigate]);

  // 等待 auth 初始化完成
  if (!isInitialized) {
    return <Spin fullscreen />;
  }

  // 已认证则不渲染表单（useEffect 会处理跳转）
  if (isAuthenticated) return null;

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const data = await authService.login(values);
      setToken(data.token);
      setUser(data.user);
      message.success('登录成功！');
      navigate('/admin', { replace: true });
    } catch (error: any) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <div className="login-header">
          <h1>🎵 HoYoMusic</h1>
          <p>高品质音乐收藏平台</p>
        </div>
        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名！' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码！' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;

