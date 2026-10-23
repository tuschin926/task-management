import axios from "axios";
import type { ImagePickerAsset } from "expo-image-picker";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  token = t;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use((cfg) => {
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Token hết hạn (đang có token mà bị 401) -> đăng xuất
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && token && onUnauthorized) onUnauthorized();
    return Promise.reject(err);
  }
);

export function errMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data;
    if (!d) return "Không kết nối được máy chủ. Kiểm tra Wi-Fi và địa chỉ API.";
    if (Array.isArray(d.errors) && d.errors.length) {
      return `${d.message}: ${d.errors.map((x: { message: string }) => x.message).join("; ")}`;
    }
    return d.message ?? "Có lỗi xảy ra";
  }
  if (e instanceof Error) return e.message;
  return "Có lỗi xảy ra";
}

// Upload ảnh bằng fetch (ổn định hơn axios với FormData trên React Native)
export async function uploadPhotos(taskId: string, assets: ImagePickerAsset[]) {
  const fd = new FormData();
  assets.forEach((a, i) => {
    fd.append("files", {
      uri: a.uri,
      name: a.fileName ?? `anh-${Date.now()}-${i}.jpg`,
      type: a.mimeType ?? "image/jpeg",
    } as unknown as Blob);
  });

  const res = await fetch(`${API_URL}/api/tasks/${taskId}/attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new Error(d?.message ?? "Tải ảnh thất bại");
  }
}