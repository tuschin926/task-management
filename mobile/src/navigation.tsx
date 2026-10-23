import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { useNotif } from "./notif";
import { colors } from "./theme";
import NotificationsScreen from "./screens/NotificationsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import TaskDetailScreen from "./screens/TaskDetailScreen";
import TaskListScreen from "./screens/TaskListScreen";

export type RootStackParamList = {
  Tabs: undefined;
  TaskDetail: { taskId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { count } = useNotif();
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tab.Screen
        name="Việc của tôi"
        component={TaskListScreen}
        options={{ tabBarIcon: () => <Text>📋</Text> }}
      />
      <Tab.Screen
        name="Thông báo"
        component={NotificationsScreen}
        options={{
          tabBarIcon: () => <Text>🔔</Text>,
          tabBarBadge: count > 0 ? count : undefined,
        }}
      />
      <Tab.Screen
        name="Tài khoản"
        component={ProfileScreen}
        options={{ tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: "Chi tiết công việc" }}
      />
    </Stack.Navigator>
  );
}