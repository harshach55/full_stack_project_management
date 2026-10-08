import { useLocalSearchParams } from 'expo-router';
import { ProjectFormScreen } from '@/features/projects/ProjectScreens';

export default function EditProjectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectFormScreen projectId={id} />;
}
