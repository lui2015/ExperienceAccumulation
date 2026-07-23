import { useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import { useThemeStore } from '@/store/theme';
import { getThemeDef } from './themes';

/**
 * 动态主题 Provider：
 * - 根据主题 store 渲染对应的 AnTD 主题；
 * - 通过 <html data-theme="xxx"> 驱动 CSS 变量（cyberpunk.css + themes.css）。
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const def = getThemeDef(theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ConfigProvider locale={zhCN} theme={def.antd}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
