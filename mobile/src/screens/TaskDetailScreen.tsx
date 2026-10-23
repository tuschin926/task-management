import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_URL, api, errMsg, uploadPhotos } from "../api";
import { useAuth } from "../auth";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import type { RootStackParamList } from "../navigation";
import { colors } from "../theme";
import { statusLabel, type Attachment, type Comment, type Task, type TaskStatus } from "../types";
import { allowedNext, fmtDateTime, isOverdue } from "../utils";

type Props = NativeStackScreenProps<RootStackParamList, "TaskDetail">;

const PROGRESS_STEPS = [0, 25, 50, 75, 100];

export default function TaskDetailScreen({ route }: Props) {
  const { taskId } = route.params;
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, c, f] = await Promise.all([
        api.get<Task>(`/tasks/${taskId}`),
        api.get<Comment[]>(`/tasks/${taskId}/comments`),
        api.get<Attachment[]>(`/tasks/${taskId}/attachments`),
      ]);
      setTask(t.data);
      setComments(c.data);
      setFiles(f.data);
      setError("");
    } catch (e) {
      setError(errMsg(e));
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert("Lỗi", errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (!task || !user) {
    return (
      <View style={s.center}>
        {error ? <Text style={s.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  const isManager = user.role !== "EMPLOYEE";
  const isAssignee = task.assigneeId === user.id;
  const isOpen = task.status !== "DONE" && task.status !== "CANCELLED";
  const canWork = isManager || isAssignee;
  const next = allowedNext(task, user);

  function changeStatus(to: TaskStatus) {
    Alert.alert("Đổi trạng thái", `Chuyển sang "${statusLabel[to]}"?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đồng ý",
        onPress: () =>
          run(async () => {
            await api.patch(`/tasks/${taskId}/status`, { status: to, note: note.trim() || undefined });
            setNote("");
          }),
      },
    ]);
  }

  function setProgress(p: number) {
    run(() => api.patch(`/tasks/${taskId}/progress`, { progress: p }));
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Cần quyền camera", "Hãy cho phép dùng camera trong Cài đặt để chụp ảnh hiện trường.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!r.canceled) run(() => uploadPhotos(taskId, r.assets));
  }

  async function pickPhotos() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.7,
    });
    if (!r.canceled) run(() => uploadPhotos(taskId, r.assets));
  }

  function removeFile(id: string) {
    Alert.alert("Xóa ảnh", "Xóa file này?", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => run(() => api.delete(`/attachments/${id}`)) },
    ]);
  }

  function sendComment() {
    const content = text.trim();
    if (!content) return;
    run(async () => {
      await api.post(`/tasks/${taskId}/comments`, { content });
      setText("");
    });
  }

  const site = task.site;
  const hasGps = site && site.latitude != null && site.longitude != null;

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 14, gap: 12 }} keyboardShouldPersistTaps="handled">
      {/* Thông tin chính */}
      <View style={s.card}>
        <Text style={s.code}>{task.code}</Text>
        <Text style={s.title}>{task.title}</Text>
        <View style={[s.row, { marginTop: 8, flexWrap: "wrap" }]}>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {task.type && (
            <View style={[s.tag, { backgroundColor: task.type.color ?? "#6b7280" }]}>
              <Text style={s.tagText}>{task.type.name}</Text>
            </View>
          )}
        </View>
        {!!task.description && <Text style={s.desc}>{task.description}</Text>}

        <Info label="Dự án" value={task.project.name} />
        <Info label="Người giao" value={task.creator.fullName} />
        <Info label="Người thực hiện" value={task.assignee?.fullName ?? "Chưa giao"} />
        <Info
          label="Hạn chót"
          value={fmtDateTime(task.dueDate) + (isOverdue(task) ? "  (Quá hạn)" : "")}
          danger={isOverdue(task)}
        />
      </View>

      {/* Khách hàng và địa điểm */}
      {(task.customer || site) && (
        <View style={s.card}>
          <Text style={s.h}>Khách hàng & địa điểm</Text>
          {task.customer && <Info label="Khách hàng" value={task.customer.name} />}
          {site && (
            <>
              <Info label="Địa điểm" value={site.name} />
              <Info label="Địa chỉ" value={site.address} />
            </>
          )}
          <View style={[s.row, { marginTop: 10 }]}>
            {!!task.customer?.phone && (
              <TouchableOpacity
                style={s.btnOutline}
                onPress={() => Linking.openURL(`tel:${task.customer!.phone}`)}
              >
                <Text style={s.btnOutlineText}>📞 Gọi khách</Text>
              </TouchableOpacity>
            )}
            {hasGps && (
              <TouchableOpacity
                style={s.btnOutline}
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps/dir/?api=1&destination=${site!.latitude},${site!.longitude}`
                  )
                }
              >
                <Text style={s.btnOutlineText}>🗺 Chỉ đường</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Tiến độ */}
      <View style={s.card}>
        <Text style={s.h}>Tiến độ: {task.progress}%</Text>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${task.progress}%` }]} />
        </View>
        {canWork && isOpen && (
          <View style={[s.row, { marginTop: 10, flexWrap: "wrap" }]}>
            {PROGRESS_STEPS.map((p) => (
              <TouchableOpacity
                key={p}
                disabled={busy}
                style={[s.chip, task.progress === p && s.chipOn]}
                onPress={() => setProgress(p)}
              >
                <Text style={[s.chipText, task.progress === p && { color: "#fff" }]}>{p}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Đổi trạng thái */}
      {next.length > 0 && (
        <View style={s.card}>
          <Text style={s.h}>Chuyển trạng thái</Text>
          <TextInput
            style={s.input}
            placeholder="Ghi chú (không bắt buộc)"
            value={note}
            onChangeText={setNote}
          />
          <View style={[s.row, { marginTop: 10, flexWrap: "wrap" }]}>
            {next.map((st) => (
              <TouchableOpacity key={st} disabled={busy} style={s.btn} onPress={() => changeStatus(st)}>
                <Text style={s.btnText}>→ {statusLabel[st]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!isManager && (
            <Text style={s.hint}>
              Bạn chỉ chuyển được sang "Đang làm" hoặc "Chờ duyệt". Quản lý sẽ duyệt hoàn thành.
            </Text>
          )}
        </View>
      )}

      {/* Ảnh hiện trường */}
      <View style={s.card}>
        <Text style={s.h}>Ảnh / file đính kèm ({files.length})</Text>
        <View style={[s.row, { flexWrap: "wrap", marginTop: 8 }]}>
          {files.map((f) => {
            const isImage = /\.(jpe?g|png|webp)$/i.test(f.fileUrl);
            return (
              <View key={f.id} style={{ width: 100 }}>
                <TouchableOpacity onPress={() => Linking.openURL(`${API_URL}${f.fileUrl}`)}>
                  {isImage ? (
                    <Image source={{ uri: `${API_URL}${f.fileUrl}` }} style={s.thumb} />
                  ) : (
                    <View style={[s.thumb, s.center]}>
                      <Text style={{ fontSize: 30 }}>📄</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {(isManager || f.uploadedBy === user.id) && (
                  <TouchableOpacity onPress={() => removeFile(f.id)}>
                    <Text style={s.del}>Xóa</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          {files.length === 0 && <Text style={s.hint}>Chưa có ảnh nào</Text>}
        </View>
        {canWork && (
          <View style={[s.row, { marginTop: 12 }]}>
            <TouchableOpacity style={s.btn} disabled={busy} onPress={takePhoto}>
              <Text style={s.btnText}>📷 Chụp ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnOutline} disabled={busy} onPress={pickPhotos}>
              <Text style={s.btnOutlineText}>🖼 Chọn từ thư viện</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bình luận */}
      <View style={s.card}>
        <Text style={s.h}>Bình luận ({comments.length})</Text>
        {comments.map((c) => (
          <View key={c.id} style={s.comment}>
            <Text style={{ fontWeight: "600" }}>
              {c.user.fullName} <Text style={s.hint}>· {fmtDateTime(c.createdAt)}</Text>
            </Text>
            <Text>{c.content}</Text>
          </View>
        ))}
        <TextInput
          style={[s.input, { marginTop: 10, minHeight: 60 }]}
          placeholder="Viết bình luận..."
          multiline
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity
          style={[s.btn, { alignSelf: "flex-end", marginTop: 8 }, (busy || !text.trim()) && { opacity: 0.5 }]}
          disabled={busy || !text.trim()}
          onPress={sendComment}
        >
          <Text style={s.btnText}>Gửi</Text>
        </TouchableOpacity>
      </View>

      {busy && <ActivityIndicator style={{ marginVertical: 8 }} />}
    </ScrollView>
  );
}

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={s.hint}>{label}</Text>
      <Text style={[{ color: colors.text }, danger && { color: colors.danger, fontWeight: "700" }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  code: { color: colors.muted, fontSize: 12 },
  title: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 2 },
  h: { fontWeight: "700", fontSize: 15, color: colors.text },
  desc: { marginTop: 10, backgroundColor: "#f9fafb", padding: 10, borderRadius: 8 },
  hint: { color: colors.muted, fontSize: 12 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagText: { color: "#fff", fontSize: 12 },
  bar: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, marginTop: 8, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: colors.ok },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14, marginTop: 8 },
  btn: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnText: { color: "#fff", fontWeight: "600" },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  btnOutlineText: { color: colors.primary, fontWeight: "600" },
  thumb: { width: 92, height: 92, borderRadius: 8, backgroundColor: "#f3f4f6" },
  del: { color: colors.danger, fontSize: 12, marginTop: 2 },
  comment: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
});