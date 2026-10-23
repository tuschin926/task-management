import axios from "axios";

export const TOKEN_KEY = "token";
export const USER_KEY = "user";

export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
});

// Tự gắn token vào mọi request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Token hết hạn -> về trang đăng nhập
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith("/login")) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export function errMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (!d) return "Không kết nối được máy chủ";
    if (Array.isArray(d.errors) && d.errors.length) {
      return `${d.message}: ${d.errors
        .map((x: { message: string }) => x.message)
        .join("; ")}`;
    }
    return d.message ?? "Có lỗi xảy ra";
  }
  return "Có lỗi xảy ra";
}