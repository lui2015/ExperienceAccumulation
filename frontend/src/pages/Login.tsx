import { Button, Form, Input, App as AntdApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import { LockOutlined, UserOutlined } from '@ant-design/icons';

import { authApi } from '@/api';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const { message } = AntdApp.useApp();

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      const u = await authApi.login(values.username, values.password);
      setUser(u);
      message.success('AUTH OK · 欢迎回来');
      navigate('/', { replace: true });
    } catch {
      // 拦截器已提示
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        position: 'relative',
      }}
    >
      <div
        className="cy-glass"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          padding: 'clamp(24px, 6vw, 40px) clamp(20px, 5vw, 36px) clamp(20px, 5vw, 32px)',
          borderRadius: 16,
          boxShadow:
            '0 0 0 1px rgba(255, 46, 195, 0.25), 0 30px 80px -20px rgba(124, 92, 255, 0.45)',
        }}
      >
        <span className="cy-corner tl" />
        <span className="cy-corner tr" />
        <span className="cy-corner bl" />
        <span className="cy-corner br" />

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 12,
              letterSpacing: '0.4em',
              color: 'var(--cy-neon-cyan)',
              marginBottom: 8,
            }}
          >
            // SECURE TERMINAL
          </div>
          <h1
            className="cy-glitch cy-neon-title"
            data-text="EXPERIENCE.SYS"
            style={{ fontSize: 'clamp(22px, 6.5vw, 30px)', margin: 0 }}
          >
            EXPERIENCE.SYS
          </h1>
          <div
            style={{
              marginTop: 10,
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 12,
              color: 'var(--cy-text-faint)',
            }}
          >
            <span className="cy-blink" style={{ color: 'var(--cy-neon-pink)' }}>
              ●
            </span>{' '}
            establishing neural link...
          </div>
        </div>

        <Form layout="vertical" onFinish={onFinish} autoComplete="off" requiredMark={false}>
          <Form.Item
            name="username"
            label={<span style={{ color: 'var(--cy-text-dim)' }}>USER_ID</span>}
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              size="large"
              autoFocus
              prefix={<UserOutlined style={{ color: 'var(--cy-neon-cyan)' }} />}
              placeholder="admin"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label={<span style={{ color: 'var(--cy-text-dim)' }}>PASSCODE</span>}
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined style={{ color: 'var(--cy-neon-cyan)' }} />}
              placeholder="••••••••"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block style={{ marginTop: 8 }}>
            ► CONNECT
          </Button>
        </Form>

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px dashed rgba(124, 92, 255, 0.25)',
            fontFamily: 'var(--cy-font-mono)',
            fontSize: 11,
            color: 'var(--cy-text-faint)',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>v1.0.0</span>
          <span>NODE: luliming.xyz</span>
        </div>
      </div>
    </div>
  );
}
