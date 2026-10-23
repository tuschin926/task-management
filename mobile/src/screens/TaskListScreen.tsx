import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { api, errMsg } from "../api";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import type { Task } from "../types";
import { fmtDateTime, isOverdue } from "../utils";

const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "TODO", label: "Chờ làm" },
  { key: "IN_PROGRESS", label: "Đang làm" },
  { key: "REVIEW", label: "Chờ duyệt" },
  { key: "DONE", label: "Hoàn thành" },
];

export default function TaskListScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/tasks", {
        params: { mine: "true", status: status || undefined, limit: 100 },
      });
      setItems(r.data.items);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [status]);

  // Tải lại mỗi khi quay về màn hình này (ví dụ sau khi đổi trạng thái)
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

  return (
    <View style={s.page}>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, status === f.key && s.chipOn]}
              onPress={() => setStatus(f.key)}
            >
              <Text style={[s.chipText, status === f.key && { color: "#fff" }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={s.empty}>Không có công việc nào</Text>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => nav.navigate("TaskDetail", { taskId: t.id })}
          >
            <View style={s.row}>
              <Text style={s.code}>{t.code}</Text>
              {t.type && (
                <View style={[s.dot, { backgroundColor: t.type.color ?? "#9ca3af" }]} />
              )}
              {t.type && <Text style={s.code}>{t.type.name}</Text>}
            </View>
            <Text style={s.title}>{t.title}</Text>
            <Text style={s.muted}>{t.project.name}</Text>
            {t.site && <Text style={s.muted}>📍 {t.site.name}</Text>}

            <View style={[s.row, { marginTop: 8, gap: 6 }]}>
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
            </View>

            <Text style={[s.due, isOverdue(t) && { color: colors.danger, fontWeight: "700" }]}>
              Hạn: {fmtDateTime(t.dueDate)}
              {isOverdue(t) ? "  (Quá hạn)" : ""}
            </Text>

            <View style={s.bar}>
              <View style={[s.barFill, { width: `${t.progress}%` }]} />
            </View>
            <Text style={s.muted}>{t.progress}%</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  filters: { padding: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13 },
  error: { color: colors.danger, paddingHorizontal: 12 },
  empty: { textAlign: "center", color: colors.muted, marginTop: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  code: { color: colors.muted, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: "600", marginTop: 4, color: colors.text },
  muted: { color: colors.muted, fontSize: 13, marginTop: 2 },
  due: { marginTop: 8, fontSize: 13, color: colors.text },
  bar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginTop: 8, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.ok },
});