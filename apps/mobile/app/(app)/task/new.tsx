import { useLocalSearchParams } from 'expo-router';
import { TaskFormScreen } from '@/features/tasks/TaskScreens';

export default function NewTaskRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  return <TaskFormScreen defaultProjectId={typeof projectId === 'string' ? projectId : undefined} />;
}
