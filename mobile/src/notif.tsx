import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { api } from "./api";

interface NotifValue {
  count: number;
  refresh: () => void;
}

const NotifContext = createContext<NotifValue>({ count: 0, refresh: () => {} });

export function NotifProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    api
      .get<{ count: number }>("/notifications/unread-count")
      .then((r) => setCount(r.data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    // Mở lại app từ nền -> cập nhật ngay
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return (
    <NotifContext.Provider value={{ count, refresh }}>
      {children}
    </NotifContext.Provider>
  );
}

export const useNotif = () => useContext(NotifContext);