import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../auth";
import { colors } from "../theme";
import { roleLabel } from "../types";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  if (!user) return null;

  function confirmLogout() {
    Alert.alert("Đăng xuất", "Bạn muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: () => logout() },
    ]);
  }

  return (
    <View style={s.page}>
      <View style={s.card}>
        <Text style={s.name}>{user.fullName}</Text>
        <Text style={s.muted}>{user.email}</Text>
        <Text style={s.row}>Vai trò: {roleLabel[user.role]}</Text>
        <Text style={s.row}>Phòng ban: {user.department ?? "-"}</Text>
      </View>
      <TouchableOpacity style={s.btn} onPress={confirmLogout}>
        <Text style={s.btnText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 4 },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted },
  row: { marginTop: 8, color: colors.text },
  btn: { backgroundColor: colors.danger, borderRadius: 10, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
});