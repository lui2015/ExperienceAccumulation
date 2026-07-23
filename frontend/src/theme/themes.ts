import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const FONT_MONO =
  "'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'SF Mono', Menlo, Consolas, monospace";

interface Palette {
  primary: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  bgBase: string;
  textBase: string;
  textDim: string;
  bgContainer: string;
  bgElevated: string;
  border: string;
  borderSecondary: string;
  isLight?: boolean;
}

function build(p: Palette): ThemeConfig {
  return {
    algorithm: p.isLight ? antdTheme.defaultAlgorithm : antdTheme.darkAlgorithm,
    token: {
      colorPrimary: p.primary,
      colorInfo: p.info,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.error,
      colorBgBase: p.bgBase,
      colorTextBase: p.textBase,
      colorBgContainer: p.bgContainer,
      colorBgElevated: p.bgElevated,
      colorBorder: p.border,
      colorBorderSecondary: p.borderSecondary,
      borderRadius: 10,
      fontFamily: FONT_SANS,
      fontFamilyCode: FONT_MONO,
    },
    components: {
      Layout: { headerBg: 'transparent', bodyBg: 'transparent', headerHeight: 64 },
      Button: { controlHeight: 38, fontWeight: 500 },
      Card: { colorBgContainer: 'transparent' },
      Tabs: {
        inkBarColor: p.primary,
        itemColor: p.textDim,
        itemSelectedColor: p.primary,
        itemHoverColor: p.info,
      },
      Drawer: { colorBgElevated: p.bgElevated },
      Modal: { colorBgElevated: p.bgElevated },
      Input: { colorBgContainer: p.bgContainer },
      Select: { colorBgContainer: p.bgContainer, colorBgElevated: p.bgElevated },
    },
  };
}

export interface ThemeDef {
  key: string;
  name: string;
  desc: string;
  swatch: string;
  isLight?: boolean;
  antd: ThemeConfig;
}

export const THEMES: ThemeDef[] = [
  {
    key: 'cyberpunk',
    name: '赛博朋克',
    desc: '霓虹紫粉 · 暗夜网格',
    swatch: '#ff2ec3',
    antd: build({
      primary: '#ff2ec3',
      info: '#00e5ff',
      success: '#c5ff00',
      warning: '#fde047',
      error: '#ff3d6e',
      bgBase: '#06070d',
      textBase: '#e6e8ff',
      textDim: '#8b90b8',
      bgContainer: 'rgba(17, 20, 42, 0.6)',
      bgElevated: 'rgba(17, 20, 42, 0.95)',
      border: 'rgba(124, 92, 255, 0.35)',
      borderSecondary: 'rgba(124, 92, 255, 0.18)',
    }),
  },
  {
    key: 'midnight',
    name: '午夜深蓝',
    desc: '湛蓝与靛紫 · 静谧深海',
    swatch: '#4f7cff',
    antd: build({
      primary: '#4f7cff',
      info: '#38bdf8',
      success: '#7dd3fc',
      warning: '#fbbf24',
      error: '#ff5470',
      bgBase: '#05070f',
      textBase: '#eaf1ff',
      textDim: '#8fa3c8',
      bgContainer: 'rgba(15, 23, 48, 0.6)',
      bgElevated: 'rgba(15, 23, 48, 0.95)',
      border: 'rgba(56, 128, 255, 0.35)',
      borderSecondary: 'rgba(56, 128, 255, 0.18)',
    }),
  },
  {
    key: 'sakura',
    name: '樱花柔粉',
    desc: '玫瑰粉与薰衣草 · 温柔梦境',
    swatch: '#ff7ec6',
    antd: build({
      primary: '#ff7ec6',
      info: '#ff9ed8',
      success: '#ffd6f0',
      warning: '#ffe08a',
      error: '#ff5c8a',
      bgBase: '#10070f',
      textBase: '#ffeef7',
      textDim: '#c89ab4',
      bgContainer: 'rgba(36, 18, 37, 0.6)',
      bgElevated: 'rgba(36, 18, 37, 0.95)',
      border: 'rgba(255, 128, 200, 0.35)',
      borderSecondary: 'rgba(255, 128, 200, 0.18)',
    }),
  },
  {
    key: 'forest',
    name: '森林绿意',
    desc: '翠绿与青碧 · 自然生机',
    swatch: '#2dd4bf',
    antd: build({
      primary: '#2dd4bf',
      info: '#5eead4',
      success: '#a3e635',
      warning: '#facc15',
      error: '#fb7185',
      bgBase: '#050d0a',
      textBase: '#e6fff2',
      textDim: '#8fc4ad',
      bgContainer: 'rgba(14, 32, 24, 0.6)',
      bgElevated: 'rgba(14, 32, 24, 0.95)',
      border: 'rgba(52, 211, 153, 0.35)',
      borderSecondary: 'rgba(52, 211, 153, 0.18)',
    }),
  },
  {
    key: 'sunset',
    name: '日落橙暖',
    desc: '暖橙与琥珀 · 黄昏余晖',
    swatch: '#fb923c',
    antd: build({
      primary: '#fb923c',
      info: '#fbbf24',
      success: '#facc15',
      warning: '#fde68a',
      error: '#f43f5e',
      bgBase: '#0d0805',
      textBase: '#fff2e6',
      textDim: '#c4a58f',
      bgContainer: 'rgba(33, 22, 16, 0.6)',
      bgElevated: 'rgba(33, 22, 16, 0.95)',
      border: 'rgba(251, 146, 60, 0.35)',
      borderSecondary: 'rgba(251, 146, 60, 0.18)',
    }),
  },
  {
    key: 'light',
    name: '极简亮色',
    desc: '清爽白底 · 专注阅读',
    swatch: '#6d5cff',
    isLight: true,
    antd: build({
      primary: '#6d5cff',
      info: '#0ea5b7',
      success: '#3f9d00',
      warning: '#eab308',
      error: '#e03131',
      bgBase: '#f5f6fa',
      textBase: '#1a1c2e',
      textDim: '#5b5f7a',
      bgContainer: 'rgba(255, 255, 255, 0.9)',
      bgElevated: '#ffffff',
      border: 'rgba(99, 102, 241, 0.25)',
      borderSecondary: 'rgba(99, 102, 241, 0.15)',
      isLight: true,
    }),
  },
];

export const DEFAULT_THEME_KEY = 'cyberpunk';

export function getThemeDef(key: string): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
