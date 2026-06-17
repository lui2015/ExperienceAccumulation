import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';

import App from './App';
import './styles/cyberpunk.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const baseName = import.meta.env.PROD ? '/experience' : '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ff2ec3',
          colorInfo: '#00e5ff',
          colorSuccess: '#c5ff00',
          colorWarning: '#fde047',
          colorError: '#ff3d6e',
          colorBgBase: '#06070d',
          colorTextBase: '#e6e8ff',
          colorBgContainer: 'rgba(17, 20, 42, 0.6)',
          colorBgElevated: 'rgba(17, 20, 42, 0.95)',
          colorBorder: 'rgba(124, 92, 255, 0.35)',
          colorBorderSecondary: 'rgba(124, 92, 255, 0.18)',
          borderRadius: 10,
          fontFamily:
            "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontFamilyCode:
            "'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'SF Mono', Menlo, Consolas, monospace",
        },
        components: {
          Layout: {
            headerBg: 'transparent',
            bodyBg: 'transparent',
            headerHeight: 64,
          },
          Button: {
            controlHeight: 38,
            fontWeight: 500,
          },
          Card: {
            colorBgContainer: 'transparent',
          },
          Tabs: {
            inkBarColor: '#ff2ec3',
            itemColor: '#8b90b8',
            itemSelectedColor: '#ff2ec3',
            itemHoverColor: '#00e5ff',
          },
          Drawer: {
            colorBgElevated: '#11142a',
          },
          Modal: {
            colorBgElevated: '#11142a',
          },
          Input: {
            colorBgContainer: 'rgba(11, 13, 24, 0.7)',
          },
          Select: {
            colorBgContainer: 'rgba(11, 13, 24, 0.7)',
            colorBgElevated: 'rgba(17, 20, 42, 0.98)',
          },
        },
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={baseName}>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>,
);
