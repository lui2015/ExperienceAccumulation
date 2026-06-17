import { http } from './http';
import type {
  CategoryOut,
  ExperienceOut,
  GroupOut,
  HtmlTokenOut,
  ManagedUserCreatedOut,
  ManagedUserOut,
  MoveItem,
  ReorderItem,
  UserOut,
  VisitorCreatedOut,
  VisitorOut,
} from './types';

// ===== Auth =====
export const authApi = {
  login: (username: string, password: string) =>
    http.post<UserOut>('/auth/login', { username, password }).then((r) => r.data),
  logout: () => http.post('/auth/logout'),
  me: () => http.get<UserOut>('/auth/me').then((r) => r.data),
};

// ===== Categories =====
export const categoryApi = {
  list: () => http.get<CategoryOut[]>('/categories').then((r) => r.data),
  create: (data: { slug: string; name: string; icon?: string | null }) =>
    http.post<CategoryOut>('/categories', data).then((r) => r.data),
  update: (id: string, data: Partial<{ slug: string; name: string; icon: string | null }>) =>
    http.put<CategoryOut>(`/categories/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/categories/${id}`),
  reorder: (items: ReorderItem[]) => http.patch('/categories/reorder', { items }),
};

// ===== Groups =====
export const groupApi = {
  list: (categoryId?: string) =>
    http
      .get<GroupOut[]>('/groups', categoryId ? { params: { category_id: categoryId } } : undefined)
      .then((r) => r.data),
  create: (data: { category_id: string; name: string; icon?: string | null }) =>
    http.post<GroupOut>('/groups', data).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; icon: string | null }>) =>
    http.put<GroupOut>(`/groups/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/groups/${id}`),
  reorder: (items: ReorderItem[]) => http.patch('/groups/reorder', { items }),
};

// ===== Experiences =====
export const experienceApi = {
  list: (categoryId: string) =>
    http
      .get<ExperienceOut[]>('/experiences', { params: { category_id: categoryId } })
      .then((r) => r.data),
  create: (form: FormData) =>
    http
      .post<ExperienceOut>('/experiences', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  update: (id: string, form: FormData) =>
    http
      .put<ExperienceOut>(`/experiences/${id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  remove: (id: string) => http.delete(`/experiences/${id}`),
  restore: (id: string) =>
    http.post<ExperienceOut>(`/experiences/${id}/restore`).then((r) => r.data),
  reorder: (items: MoveItem[]) => http.patch('/experiences/reorder', { items }),
  getHtmlToken: (id: string) =>
    http.get<HtmlTokenOut>(`/experiences/${id}/html-token`).then((r) => r.data),
};

// ===== Visitors =====
export const visitorApi = {
  list: () => http.get<VisitorOut[]>('/visitors').then((r) => r.data),
  create: (data: { username: string; remark?: string | null }) =>
    http.post<VisitorCreatedOut>('/visitors', data).then((r) => r.data),
  update: (id: string, data: { remark?: string; status?: string; reset_password?: boolean }) =>
    http.patch<VisitorOut | VisitorCreatedOut>(`/visitors/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/visitors/${id}`),
};

// ===== Users（统一用户管理：站主可创建任意角色账号） =====
export const userApi = {
  list: () => http.get<ManagedUserOut[]>('/users').then((r) => r.data),
  create: (data: {
    username: string;
    role: 'owner' | 'visitor';
    password?: string | null;
    remark?: string | null;
  }) => http.post<ManagedUserCreatedOut>('/users', data).then((r) => r.data),
  update: (
    id: string,
    data: {
      remark?: string | null;
      status?: 'active' | 'disabled';
      role?: 'owner' | 'visitor';
      new_password?: string | null;
      reset_password?: boolean;
    },
  ) => http.patch<ManagedUserCreatedOut>(`/users/${id}`, data).then((r) => r.data),
  remove: (id: string) => http.delete(`/users/${id}`),
};
