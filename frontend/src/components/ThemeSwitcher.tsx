import { Dropdown, type MenuProps } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';

import { useThemeStore, type ThemeKey } from '@/store/theme';
import { THEMES } from '@/theme/themes';

/**
 * 主题切换器：顶栏入口，点击下拉选择主题，选择写入 store 并持久化。
 */
export default function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const items: MenuProps['items'] = THEMES.map((t) => ({
    key: t.key,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 11,
            height: 11,
            borderRadius: '50%',
            background: t.swatch,
            boxShadow: `0 0 8px ${t.swatch}`,
            flex: '0 0 auto',
          }}
        />
        <span style={{ fontWeight: 600 }}>{t.name}</span>
        <span style={{ color: 'var(--cy-text-faint)', fontSize: 12 }}>{t.desc}</span>
      </span>
    ),
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectedKeys: [theme],
        onClick: ({ key }) => setTheme(key as ThemeKey),
      }}
      placement="bottomRight"
      trigger={['click']}
    >
      <button
        type="button"
        aria-label="切换主题"
        title="切换主题"
        style={{
          height: 36,
          width: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--cy-text)',
          border: '1px solid var(--cy-glass-border)',
          borderRadius: 8,
          background: 'var(--cy-btn-default-bg)',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: 'color .2s, border-color .2s, box-shadow .2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--cy-neon-cyan)';
          e.currentTarget.style.borderColor = 'var(--cy-neon-cyan)';
          e.currentTarget.style.boxShadow = '0 0 12px var(--cy-neon-cyan)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--cy-text)';
          e.currentTarget.style.borderColor = 'var(--cy-glass-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <BgColorsOutlined style={{ fontSize: 18 }} />
      </button>
    </Dropdown>
  );
}
