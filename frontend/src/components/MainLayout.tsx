import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Layout, Avatar, Dropdown, Space, Button, Drawer, App as AntdApp } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  TeamOutlined,
  MenuOutlined,
  SettingOutlined,
  HomeOutlined,
  DownloadOutlined,
  ApiOutlined,
} from '@ant-design/icons';

import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api';
import { useIsMobile } from '@/hooks/useMediaQuery';
import GlobalSearch from '@/components/GlobalSearch';

const { Header, Content } = Layout;

/** 顶栏右侧：用户身份块（头像 + 名字 + 右上角小徽章） */
function UserBadge({
  username,
  isOwner,
  size = 'md',
}: {
  username: string;
  isOwner: boolean;
  size?: 'sm' | 'md';
}) {
  const avatarSize = size === 'sm' ? 26 : 30;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* 头像 + 角色右上角小徽章 */}
      <div style={{ position: 'relative', flex: '0 0 auto' }}>
        <Avatar
          size={avatarSize}
          icon={<UserOutlined />}
          style={{
            background: isOwner
              ? 'linear-gradient(135deg, var(--cy-neon-purple), var(--cy-neon-pink))'
              : 'rgba(124, 92, 255, 0.35)',
            boxShadow: isOwner ? '0 0 12px rgba(255, 46, 195, 0.45)' : 'none',
          }}
        />
        <span
          aria-label={isOwner ? 'OWNER' : 'GUEST'}
          title={isOwner ? '站主' : '访客'}
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: 12,
            height: 12,
            borderRadius: '50%',
            border: '2px solid var(--cy-bg-0)',
            background: isOwner
              ? 'linear-gradient(135deg, var(--cy-neon-cyan), var(--cy-neon-pink))'
              : 'var(--cy-text-faint)',
            boxShadow: isOwner ? '0 0 8px var(--cy-neon-pink)' : 'none',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--cy-font-mono)',
          fontSize: 13,
          color: 'var(--cy-text)',
          letterSpacing: '0.04em',
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {username}
      </span>
    </div>
  );
}

export default function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = user?.role === 'owner';

  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  const goAndClose = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  // 设置菜单项（桌面端 Dropdown 用）
  const settingsMenuItems = [
    isOwner && {
      key: 'categories',
      icon: <AppstoreOutlined />,
      label: '分类管理',
      onClick: () => navigate('/admin/categories'),
    },
    isOwner && {
      key: 'users',
      icon: <TeamOutlined />,
      label: '用户管理',
      onClick: () => navigate('/admin/users'),
    },
    isOwner && {
      key: 'export',
      icon: <DownloadOutlined />,
      label: '数据导出',
      onClick: () => navigate('/admin/export'),
    },
    isOwner && {
      key: 'open-api',
      icon: <ApiOutlined />,
      label: '开放接口',
      onClick: () => navigate('/admin/settings'),
    },
    isOwner && { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '断开连接',
      danger: true as const,
      onClick: handleLogout,
    },
  ].filter(Boolean) as never[];

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingInline: 28,
          background: 'rgba(6, 7, 13, 0.65)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(124, 92, 255, 0.25)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow:
            '0 1px 0 0 rgba(255, 46, 195, 0.25), 0 12px 40px -10px rgba(124, 92, 255, 0.4)',
        }}
      >
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

        {/* LOGO */}
        <div
          onClick={() => navigate('/')}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            minWidth: 0,
            flex: isMobile ? 1 : '0 0 auto',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--cy-font-mono)',
              fontSize: 11,
              color: 'var(--cy-neon-cyan)',
              letterSpacing: '0.3em',
              flex: '0 0 auto',
            }}
          >
            //
          </span>
          <span
            className="cy-neon-title"
            style={{
              fontSize: isMobile ? 14 : 18,
              letterSpacing: isMobile ? '0.08em' : '0.18em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
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
              flex: '0 0 auto',
            }}
          />
        </div>

        {!isMobile && <div style={{ flex: 1 }} />}

        {/* 桌面端：用户身份 + 设置 Dropdown */}
        {!isMobile && user && (
          <Space size={12} align="center">
            <UserBadge username={user.username} isOwner={isOwner} />
            <Dropdown
              menu={{ items: settingsMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                type="text"
                icon={<SettingOutlined style={{ fontSize: 18 }} />}
                style={{
                  height: 36,
                  width: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cy-text)',
                  border: '1px solid rgba(124, 92, 255, 0.35)',
                  borderRadius: 8,
                  background: 'rgba(20, 22, 50, 0.4)',
                }}
                aria-label="设置"
              />
            </Dropdown>
          </Space>
        )}

        {/* 移动端：右侧只放一个汉堡按钮 */}
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined style={{ color: 'var(--cy-text)', fontSize: 20 }} />}
            onClick={() => setMenuOpen(true)}
            style={{ height: 40, width: 40 }}
            aria-label="菜单"
          />
        )}
      </Header>

      <Content
        style={{
          padding: '24px 20px',
          maxWidth: 1280,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* 全局搜索：桌面端放在内容区顶部，作为页面级工具条 */}
        {!isMobile && (
          <div
            style={{
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--cy-font-mono)',
                fontSize: 11,
                color: 'var(--cy-neon-cyan)',
                letterSpacing: '0.2em',
                flex: '0 0 auto',
              }}
            >
              ⌕ SEARCH
            </span>
            <div style={{ flex: 1, maxWidth: 560 }}>
              <GlobalSearch fullWidth />
            </div>
          </div>
        )}
        <Outlet />
      </Content>

      {/* 移动端菜单抽屉 */}
      <Drawer
        title={user ? <UserBadge username={user.username} isOwner={isOwner} /> : null}
        placement="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        width={Math.min(320, typeof window !== 'undefined' ? window.innerWidth : 320)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ marginBottom: 4 }}>
            <GlobalSearch fullWidth compact />
          </div>
          <Button block size="large" icon={<HomeOutlined />} onClick={() => goAndClose('/')}>
            首页
          </Button>
          {isOwner && (
            <>
              <div
                style={{
                  fontFamily: 'var(--cy-font-mono)',
                  fontSize: 11,
                  color: 'var(--cy-text-faint)',
                  letterSpacing: '0.18em',
                  marginTop: 8,
                  paddingLeft: 4,
                }}
              >
                ⚙ SETTINGS
              </div>
              <Button
                block
                size="large"
                icon={<AppstoreOutlined />}
                onClick={() => goAndClose('/admin/categories')}
              >
                分类管理
              </Button>
              <Button
                block
                size="large"
                icon={<TeamOutlined />}
                onClick={() => goAndClose('/admin/users')}
              >
                用户管理
              </Button>
              <Button
                block
                size="large"
                icon={<DownloadOutlined />}
                onClick={() => goAndClose('/admin/export')}
              >
                数据导出
              </Button>
              <Button
                block
                size="large"
                icon={<ApiOutlined />}
                onClick={() => goAndClose('/admin/settings')}
              >
                开放接口
              </Button>
            </>
          )}
          <div
            style={{
              height: 1,
              background: 'rgba(124, 92, 255, 0.25)',
              margin: '12px 0',
            }}
          />
          <Button
            block
            size="large"
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
          >
            断开连接
          </Button>
        </div>
      </Drawer>
    </Layout>
  );
}
