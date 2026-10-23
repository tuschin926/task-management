import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api, errMsg } from "../api";
import { useNotif } from "../notif";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import type { Notification } from "../types";
import { fmtDateTime } from "../utils";

export default function NotificationsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { count, refresh } = useNotif();
  const [items, setItems] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/notifications", { params: { limit: 50 } });
      setItems(r.data.items);
      setError("");
      refresh();
    } catch (e) {
      setError(errMsg(e));
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function open(n: Notification) {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      refresh();
    }
    if (n.taskId) nav.navigate("TaskDetail", { taskId: n.taskId });
  }

  async function readAll() {
    await api.post("/notifications/read-all").catch(() => {});
    setItems((cur) => cur.map((x) => ({ ...x, isRead: true })));
    refresh();
  }

  return (
    <View style={s.page}>
      <View style={s.head}>
        <Text style={s.muted}>{count} chưa đọc</Text>
        <TouchableOpacity onPress={readAll} disabled={count === 0}>
          <Text style={[s.link, count === 0 && { opacity: 0.4 }]}>Đọc tất cả</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={s.empty}>Chưa có thông báo</Text>}
        renderItem={({ item: n }) => (
          <TouchableOpacity
            style={[s.item, !n.isRead && s.unread]}
            onPress={() => open(n)}
          >
            <Text style={[s.title, !n.isRead && { fontWeight: "700" }]}>{n.title}</Text>
            <Text style={s.body}>{n.body}</Text>
            <Text style={s.time}>{fmtDateTime(n.createdAt)}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", justifyContent: "space-between", padding: 14 },
  muted: { color: colors.muted },
  link: { color: colors.primary, fontWeight: "600" },
  error: { color: colors.danger, paddingHorizontal: 14 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  item: { backgroundColor: "#fff", padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  unread: { backgroundColor: "#eff6ff" },
  title: { fontSize: 15, color: colors.text },
  body: { color: colors.text, marginTop: 2 },
  time: { color: colors.muted, fontSize: 12, marginTop: 4 },
});