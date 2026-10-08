import { useLocalSearchParams } from 'expo-router';
import { ProjectDetailScreen } from '@/features/projects/ProjectScreens';

export default function ProjectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectDetailScreen projectId={id} />;
}
