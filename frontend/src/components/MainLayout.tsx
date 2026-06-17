import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Avatar, Dropdown, Space, Button, App as AntdApp } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';

const { Header, Content } = Layout;

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();

  const isOwner = user?.role === 'owner';

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          paddingInline: 28,
          background: 'rgba(6, 7, 13, 0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(124, 92, 255, 0.25)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 1px 0 0 rgba(255, 46, 195, 0.25), 0 12px 40px -10px rgba(124, 92, 255, 0.4)',
        }}
      >
        {/* 顶部霓虹细线 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 1,
            background:
              'linear-gradient(90deg, transparent 0%, var(--cy-neon-cyan) 30%, var(--cy-neon-pink) 70%, transparent 100%)',
            opacity: 0.7,
          }}
        />

        <div
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 10 }}
        >
          <span
            style={{
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 11,
              color: 'var(--cy-neon-cyan)',
              letterSpacing: '0.3em',
            }}
          >
            //
          </span>
          <span
            className="cy-neon-title"
            style={{ fontSize: 18, letterSpacing: '0.18em' }}
          >
            EXPERIENCE.SYS
          </span>
          <span
            className="cy-blink"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--cy-neon-pink)',
              boxShadow: '0 0 10px var(--cy-neon-pink)',
              alignSelf: 'center',
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {isOwner && (
          <Space size={8}>
            <Button icon={<AppstoreOutlined />} onClick={() => navigate('/admin/categories')}>
              分类管理
            </Button>
            <Button icon={<TeamOutlined />} onClick={() => navigate('/admin/users')}>
              用户管理
            </Button>
          </Space>
        )}

        <Dropdown
          menu={{
            items: [
              { key: 'logout', icon: <LogoutOutlined />, label: '断开连接', onClick: handleLogout },
            ],
          }}
        >
          <Space
            style={{
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(124, 92, 255, 0.45)',
              background: 'rgba(20, 22, 50, 0.5)',
            }}
          >
            <Avatar
              size={24}
              icon={<UserOutlined />}
              style={{
                background: 'linear-gradient(135deg, var(--cy-neon-purple), var(--cy-neon-pink))',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 13,
                color: 'var(--cy-text)',
              }}
            >
              {user?.username}
            </span>
            <span
              style={{
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: isOwner
                  ? 'linear-gradient(90deg, var(--cy-neon-purple), var(--cy-neon-pink))'
                  : 'rgba(124, 92, 255, 0.2)',
                color: isOwner ? '#06070d' : 'var(--cy-text-dim)',
                fontWeight: 700,
                letterSpacing: '0.1em',
              }}
            >
              {isOwner ? 'OWNER' : 'GUEST'}
            </span>
          </Space>
        </Dropdown>
      </Header>

      <Content
        style={{
          padding: '32px 28px',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Outlet />
      </Content>
    </Layout>
  );
}
