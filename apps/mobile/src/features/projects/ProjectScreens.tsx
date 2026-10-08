import { LIMITS, projectUpdateBodySchema, type Project, type ProjectStatus, type ProjectUpdateInput } from '@pm/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { ChipGroup, TextField } from '@/components/Fields';
import { Badge, Card, Screen, SectionTitle } from '@/components/Layout';
import { EmptyView, ErrorView, InlineError, LoadingView } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { isApiError, serverFieldErrors } from '@/lib/api-error';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { dateTextToValue, validateForm, type FieldErrors } from '@/lib/form';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCreateProject, useDeleteProject, useProject, useProjects, useUpdateProject } from '../hooks';
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_OPTIONS, STATUS_COLORS } from '../labels';
import { TaskListSection } from '../tasks/TaskListSection';

/** Project list with server-side name search and status filter, newest first. */
export function ProjectsScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const debounced = useDebouncedValue(search.trim());
  const effectiveSearch = search.trim() === '' ? '' : debounced;
  const filters = { search: effectiveSearch || undefined, status: status || undefined };
  const filtered = Boolean(filters.search || filters.status);
  const { data, error, isPending, isRefetching, refetch } = useProjects(filters);

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Button title="New project" onPress={() => router.push('/project/new')} />
      <TextField label="Search by name" value={search} onChangeText={setSearch} maxLength={LIMITS.searchMax} autoCapitalize="none" returnKeyType="search" />
      <ChipGroup label="Status" options={PROJECT_STATUS_OPTIONS} value={status} onChange={setStatus} allowAll />
      {isPending ? (
        <LoadingView label="Loading projects..." />
      ) : error && !data ? (
        <ErrorView error={error} title="Could not load projects" onRetry={() => void refetch()} />
      ) : data && data.length === 0 ? (
        filtered ? (
          <EmptyView
            title="No projects match your filters"
            action={
              <Button
                title="Reset filters"
                variant="secondary"
                onPress={() => {
                  setSearch('');
                  setStatus('');
                }}
              />
            }
          />
        ) : (
          <EmptyView title="No projects yet" description="Create your first project to start adding tasks." />
        )
      ) : (
        data?.map((project) => <ProjectCard key={project.id} project={project} />)
      )}
    </Screen>
  );
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open project ${project.name}`} onPress={() => router.push(`/project/${project.id}`)}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>{project.name}</Text>
          <Badge label={PROJECT_STATUS_LABELS[project.status]} colors={STATUS_COLORS[project.status]} />
        </View>
        {project.description ? (
          <Text style={styles.muted} numberOfLines={2}>
            {project.description}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          {formatDate(project.startDate) || 'No start date'} to {formatDate(project.endDate) || 'no end date'}
        </Text>
      </Card>
    </Pressable>
  );
}

export function ProjectDetailScreen({ projectId }: { projectId: string }) {
  const { data: project, error, isPending, isRefetching, refetch } = useProject(projectId);
  const deleteProject = useDeleteProject();

  if (isPending) return <LoadingView label="Loading project..." />;
  if (error && !project) {
    const notFound = isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR');
    return (
      <Screen>
        <ErrorView error={error} title={notFound ? 'Project not found' : 'Could not load the project'} onRetry={notFound ? undefined : () => void refetch()} />
      </Screen>
    );
  }
  if (!project) return null;

  const confirmDelete = () =>
    Alert.alert('Delete project?', `"${project.name}" and all of its tasks will be permanently deleted. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete project',
        style: 'destructive',
        onPress: () => deleteProject.mutate(project.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Card>
        <View style={styles.row}>
          <Text style={styles.title}>{project.name}</Text>
          <Badge label={PROJECT_STATUS_LABELS[project.status]} colors={STATUS_COLORS[project.status]} />
        </View>
        <Text style={styles.body}>{project.description || 'No description.'}</Text>
        <Text style={styles.meta}>Start: {formatDate(project.startDate) || 'Not set'}</Text>
        <Text style={styles.meta}>End: {formatDate(project.endDate) || 'Not set'}</Text>
        <Text style={styles.meta}>Created: {formatTimestamp(project.createdAt)}</Text>
        <View style={styles.actions}>
          <Button title="Edit" variant="secondary" style={styles.flex} onPress={() => router.push(`/project/${project.id}/edit`)} />
          <Button title="Delete" variant="danger" style={styles.flex} onPress={confirmDelete} loading={deleteProject.isPending} />
        </View>
        <InlineError error={deleteProject.error} prefix="Could not delete:" />
      </Card>
      <SectionTitle>Tasks in this project</SectionTitle>
      <TaskListSection projectId={project.id} />
    </Screen>
  );
}

/** Create and edit form; always produces all five editable fields (the full PUT body). */
export function ProjectFormScreen({ projectId }: { projectId?: string }) {
  const existing = useProject(projectId ?? '');
  if (projectId && existing.isPending) return <LoadingView label="Loading project..." />;
  if (projectId && existing.error && !existing.data) {
    return (
      <Screen>
        <ErrorView error={existing.error} title="Could not load the project" onRetry={() => void existing.refetch()} />
      </Screen>
    );
  }
  return <ProjectForm initial={existing.data} />;
}

function ProjectForm({ initial }: { initial?: Project }) {
  const create = useCreateProject();
  const update = useUpdateProject(initial?.id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'NOT_STARTED');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = initial ? update : create;

  const onSubmit = () => {
    const result = validateForm(projectUpdateBodySchema, {
      name,
      description,
      status,
      startDate: dateTextToValue(startDate),
      endDate: dateTextToValue(endDate),
    });
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    const values: ProjectUpdateInput = result.data;
    const onError = (error: unknown) => setErrors(serverFieldErrors(error));
    if (initial) update.mutate(values, { onSuccess: () => router.back(), onError });
    else create.mutate(values, { onSuccess: (project) => router.replace(`/project/${project.id}`), onError });
  };

  const showBanner = mutation.isError && Object.keys(serverFieldErrors(mutation.error)).length === 0;

  return (
    <Screen>
      {showBanner ? <InlineError error={mutation.error} prefix="Could not save:" /> : null}
      <TextField label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={LIMITS.nameMax} />
      <TextField label="Description" value={description} onChangeText={setDescription} error={errors.description} maxLength={LIMITS.descriptionMax} multiline hint="Optional." />
      <ChipGroup label="Status" options={PROJECT_STATUS_OPTIONS} value={status} onChange={(value) => value && setStatus(value)} error={errors.status} />
      <TextField label="Start date" value={startDate} onChangeText={setStartDate} error={errors.startDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" hint="Optional." />
      <TextField label="End date" value={endDate} onChangeText={setEndDate} error={errors.endDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" hint="Optional. On or after the start date." />
      <Button title={initial ? 'Save changes' : 'Create project'} onPress={onSubmit} loading={mutation.isPending} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={mutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  flex: { flex: 1 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted },
  meta: { fontSize: 13, color: colors.subtle },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
