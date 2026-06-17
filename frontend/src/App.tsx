import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spin } from 'antd';

import { authApi } from '@/api';
import { useAuthStore } from '@/store/auth';
import LoginPage from '@/pages/Login';
import HomePage from '@/pages/Home';
import CategoriesAdminPage from '@/pages/CategoriesAdmin';
import UsersAdminPage from '@/pages/UsersAdmin';
import MainLayout from '@/components/MainLayout';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

function RequireOwner({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'owner') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const setUser = useAuthStore((s) => s.setUser);

  // 应用启动时尝试拉取当前用户（基于 Cookie）
  const { isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      authApi
        .me()
        .then((u) => {
          setUser(u);
          return u;
        })
        .catch(() => {
          setUser(null);
          return null;
        }),
    retry: false,
  });

  useEffect(() => {
    document.title = '经验沉淀';
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/c/:slug" element={<HomePage />} />
        <Route
          path="/admin/categories"
          element={
            <RequireOwner>
              <CategoriesAdminPage />
            </RequireOwner>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireOwner>
              <UsersAdminPage />
            </RequireOwner>
          }
        />
        {/* 兼容旧路径，重定向到新路径 */}
        <Route path="/admin/visitors" element={<Navigate to="/admin/users" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
