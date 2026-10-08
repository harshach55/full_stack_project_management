import { useLocalSearchParams } from 'expo-router';
import { TaskDetailScreen } from '@/features/tasks/TaskScreens';

export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskDetailScreen taskId={id} />;
}
