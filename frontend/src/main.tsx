import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import ThemeProvider from './theme/ThemeProvider';
import { useThemeStore } from '@/store/theme';
import './styles/cyberpunk.css';
import './styles/themes.css';

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

// 在首次渲染前同步注入主题，避免刷新时配色闪烁
document.documentElement.setAttribute('data-theme', useThemeStore.getState().theme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={baseName}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
