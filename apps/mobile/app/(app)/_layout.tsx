import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/new" options={{ title: 'New project' }} />
      <Stack.Screen name="project/[id]/index" options={{ title: 'Project' }} />
      <Stack.Screen name="project/[id]/edit" options={{ title: 'Edit project' }} />
      <Stack.Screen name="task/new" options={{ title: 'New task' }} />
      <Stack.Screen name="task/[id]/index" options={{ title: 'Task' }} />
      <Stack.Screen name="task/[id]/edit" options={{ title: 'Edit task' }} />
    </Stack>
  );
}
