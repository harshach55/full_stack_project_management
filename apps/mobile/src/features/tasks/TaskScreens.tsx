import {
  LIMITS,
  taskCreateBodySchema,
  taskUpdateBodySchema,
  type Task,
  type TaskCreateInput,
  type TaskPriority,
  type TaskStatus,
  type TaskUpdateInput,
} from '@pm/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { ChipGroup, TextField } from '@/components/Fields';
import { Badge, Card, Screen } from '@/components/Layout';
import { EmptyView, ErrorView, InlineError, LoadingView } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { isApiError, serverFieldErrors } from '@/lib/api-error';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { dateTextToValue, validateForm, type FieldErrors } from '@/lib/form';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useCreateTask, useDeleteTask, useProject, useProjects, useTask, useTasks, useUpdateTask } from '../hooks';
import { PRIORITY_COLORS, STATUS_COLORS, TASK_PRIORITY_LABELS, TASK_PRIORITY_OPTIONS, TASK_STATUS_LABELS, TASK_STATUS_OPTIONS } from '../labels';
import { TaskCard } from './TaskListSection';
import { toTaskUpdateBody } from './task-body';

/** All of the user's tasks with server-side search and filters (name, status, priority, project). */
export function TasksScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [projectId, setProjectId] = useState('');
  const debounced = useDebouncedValue(search.trim());
  const effectiveSearch = search.trim() === '' ? '' : debounced;
  const filters = { search: effectiveSearch || undefined, status: status || undefined, priority: priority || undefined, projectId: projectId || undefined };
  const filtered = Boolean(filters.search || filters.status || filters.priority || filters.projectId);

  const tasks = useTasks(filters);
  const projects = useProjects({});
  const projectNames = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const reset = () => {
    setSearch('');
    setStatus('');
    setPriority('');
    setProjectId('');
  };

  return (
    <Screen
      onRefresh={() => {
        void tasks.refetch();
        void projects.refetch();
      }}
      refreshing={tasks.isRefetching}
    >
      <Button title="New task" onPress={() => router.push({ pathname: '/task/new', params: projectId ? { projectId } : {} })} />
      <TextField label="Search by name" value={search} onChangeText={setSearch} maxLength={LIMITS.searchMax} autoCapitalize="none" returnKeyType="search" />
      <ChipGroup label="Status" options={TASK_STATUS_OPTIONS} value={status} onChange={setStatus} allowAll />
      <ChipGroup label="Priority" options={TASK_PRIORITY_OPTIONS} value={priority} onChange={setPriority} allowAll />
      {projectOptions.length > 0 ? <ChipGroup label="Project" options={projectOptions} value={projectId} onChange={setProjectId} allowAll /> : null}
      {tasks.isPending ? (
        <LoadingView label="Loading tasks..." />
      ) : tasks.error && !tasks.data ? (
        <ErrorView error={tasks.error} title="Could not load tasks" onRetry={() => void tasks.refetch()} />
      ) : tasks.data && tasks.data.length === 0 ? (
        filtered ? (
          <EmptyView title="No tasks match your filters" action={<Button title="Reset filters" variant="secondary" onPress={reset} />} />
        ) : (
          <EmptyView title="No tasks yet" description="Create a task in one of your projects." />
        )
      ) : (
        tasks.data?.map((task) => <TaskCard key={task.id} task={task} projectName={projectNames.get(task.projectId)} />)
      )}
    </Screen>
  );
}

/** Task detail with quick status and priority changes, each sent as a full PUT (PD-07). */
export function TaskDetailScreen({ taskId }: { taskId: string }) {
  const { data: task, error, isPending, isRefetching, refetch } = useTask(taskId);
  const project = useProject(task?.projectId ?? '');
  const update = useUpdateTask();
  const remove = useDeleteTask();

  if (isPending) return <LoadingView label="Loading task..." />;
  if (error && !task) {
    const notFound = isApiError(error) && (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_ERROR');
    return (
      <Screen>
        <ErrorView error={error} title={notFound ? 'Task not found' : 'Could not load the task'} onRetry={notFound ? undefined : () => void refetch()} />
      </Screen>
    );
  }
  if (!task) return null;

  const change = (changes: Partial<TaskUpdateInput>) => update.mutate({ id: task.id, body: toTaskUpdateBody(task, changes) });

  const confirmDelete = () =>
    Alert.alert('Delete task?', `"${task.name}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete task', style: 'destructive', onPress: () => remove.mutate(task.id, { onSuccess: () => router.back() }) },
    ]);

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Card>
        <Text style={styles.title}>{task.name}</Text>
        <View style={styles.badges}>
          <Badge label={TASK_STATUS_LABELS[task.status]} colors={STATUS_COLORS[task.status]} />
          <Badge label={`${TASK_PRIORITY_LABELS[task.priority]} priority`} colors={PRIORITY_COLORS[task.priority]} />
        </View>
        <Text style={styles.body}>{task.description || 'No description.'}</Text>
        <Text style={styles.meta}>Project: {project.data?.name ?? '...'}</Text>
        <Text style={styles.meta}>Due: {formatDate(task.dueDate) || 'Not set'}</Text>
        <Text style={styles.meta}>Created: {formatTimestamp(task.createdAt)}</Text>
      </Card>
      <Card>
        <ChipGroup label="Status" options={TASK_STATUS_OPTIONS} value={task.status} onChange={(status) => status && change({ status })} disabled={update.isPending} />
        <ChipGroup label="Priority" options={TASK_PRIORITY_OPTIONS} value={task.priority} onChange={(priority) => priority && change({ priority })} disabled={update.isPending} />
        <InlineError error={update.error} prefix="Could not update:" />
      </Card>
      <View style={styles.actions}>
        <Button title="Edit" variant="secondary" style={styles.flex} onPress={() => router.push(`/task/${task.id}/edit`)} />
        <Button title="Delete" variant="danger" style={styles.flex} onPress={confirmDelete} loading={remove.isPending} />
      </View>
      <InlineError error={remove.error} prefix="Could not delete:" />
    </Screen>
  );
}

/** New task (projectId required, preselected when coming from a project) or edit (project fixed). */
export function TaskFormScreen({ taskId, defaultProjectId }: { taskId?: string; defaultProjectId?: string }) {
  const existing = useTask(taskId ?? '');
  const projects = useProjects({});
  if (taskId && existing.isPending) return <LoadingView label="Loading task..." />;
  if (taskId && existing.error && !existing.data) {
    return (
      <Screen>
        <ErrorView error={existing.error} title="Could not load the task" onRetry={() => void existing.refetch()} />
      </Screen>
    );
  }
  if (!taskId && projects.isPending) return <LoadingView label="Loading projects..." />;
  if (!taskId && projects.data?.length === 0) {
    return (
      <Screen>
        <EmptyView title="Create a project first" description="Every task belongs to a project." action={<Button title="New project" onPress={() => router.replace('/project/new')} />} />
      </Screen>
    );
  }
  return <TaskForm task={existing.data} projects={projects.data ?? []} defaultProjectId={defaultProjectId} />;
}

function TaskForm({ task, projects, defaultProjectId }: { task?: Task; projects: { id: string; name: string }[]; defaultProjectId?: string }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [projectId, setProjectId] = useState(defaultProjectId && projects.some((p) => p.id === defaultProjectId) ? defaultProjectId : '');
  const [name, setName] = useState(task?.name ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = task ? update : create;

  const onSubmit = () => {
    const editable = { name, description, priority, status, dueDate: dateTextToValue(dueDate) };
    const onError = (error: unknown) => setErrors(serverFieldErrors(error));
    if (task) {
      const result = validateForm(taskUpdateBodySchema, editable);
      if (!result.success) return setErrors(result.errors);
      setErrors({});
      // Edit: the five editable fields only; the project cannot change (PD-08).
      update.mutate({ id: task.id, body: result.data }, { onSuccess: () => router.back(), onError });
    } else {
      const result = validateForm(taskCreateBodySchema, { projectId, ...editable });
      if (!result.success) {
        if (projectId === '') result.errors.projectId = 'Choose a project.';
        return setErrors(result.errors);
      }
      setErrors({});
      create.mutate(result.data as TaskCreateInput, { onSuccess: (created) => router.replace(`/task/${created.id}`), onError });
    }
  };

  const showBanner = mutation.isError && Object.keys(serverFieldErrors(mutation.error)).length === 0;
  const projectName = task ? projects.find((p) => p.id === task.projectId)?.name : undefined;

  return (
    <Screen>
      {showBanner ? <InlineError error={mutation.error} prefix="Could not save:" /> : null}
      {task ? (
        <View style={styles.readonly}>
          <Text style={styles.label}>Project</Text>
          <Text style={styles.body}>{projectName ?? 'Project'}</Text>
          <Text style={styles.meta}>A task stays in the project it was created in.</Text>
        </View>
      ) : (
        <ChipGroup label="Project" options={projects.map((p) => ({ value: p.id, label: p.name }))} value={projectId} onChange={setProjectId} error={errors.projectId} />
      )}
      <TextField label="Name" value={name} onChangeText={setName} error={errors.name} maxLength={LIMITS.nameMax} />
      <TextField label="Description" value={description} onChangeText={setDescription} error={errors.description} maxLength={LIMITS.descriptionMax} multiline hint="Optional." />
      <ChipGroup label="Priority" options={TASK_PRIORITY_OPTIONS} value={priority} onChange={(value) => value && setPriority(value)} error={errors.priority} />
      <ChipGroup label="Status" options={TASK_STATUS_OPTIONS} value={status} onChange={(value) => value && setStatus(value)} error={errors.status} />
      <TextField label="Due date" value={dueDate} onChangeText={setDueDate} error={errors.dueDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" hint="Optional. Leave empty for no due date." />
      <Button title={task ? 'Save changes' : 'Create task'} onPress={onSubmit} loading={mutation.isPending} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} disabled={mutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  meta: { fontSize: 13, color: colors.subtle },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  readonly: { gap: spacing.xs, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
