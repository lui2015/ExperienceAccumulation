import axios, { AxiosError } from 'axios';
import { message } from 'antd';

// 生产挂在 /experience 子路径下，请求路径需带前缀；开发由 vite 代理 /api → :8000。
const API_PREFIX = import.meta.env.PROD ? '/experience/api/v1' : '/api/v1';

export const http = axios.create({
  baseURL: API_PREFIX,
  withCredentials: true,
  timeout: 60_000,
});

// 统一错误提示
http.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ detail?: string }>) => {
    const status = err.response?.status;
    const detail = err.response?.data?.detail;
    if (status === 401) {
      // 401 由路由守卫处理，不弹 toast
    } else if (detail) {
      message.error(detail);
    } else {
      message.error('请求失败，请稍后重试');
    }
    return Promise.reject(err);
  }
);
