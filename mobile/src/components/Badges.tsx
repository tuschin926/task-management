import { StyleSheet, Text, View } from "react-native";
import { priorityStyle, statusStyle } from "../theme";
import {
  priorityLabel,
  statusLabel,
  type Priority,
  type TaskStatus,
} from "../types";

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Text style={[s.text, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const c = statusStyle[status];
  return <Pill text={statusLabel[status]} bg={c.bg} fg={c.fg} />;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const c = priorityStyle[priority];
  return <Pill text={priorityLabel[priority]} bg={c.bg} fg={c.fg} />;
}

const s = StyleSheet.create({
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  text: { fontSize: 12, fontWeight: "600" },
});