import type { Task } from '@pm/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Badge, Card } from '@/components/Layout';
import { EmptyView, ErrorView, InlineError, LoadingView } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { formatDate } from '@/lib/dates';
import { useTasks, useUpdateTask } from '../hooks';
import { PRIORITY_COLORS, STATUS_COLORS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '../labels';
import { toTaskUpdateBody } from './task-body';

/** A task row: opens the detail screen; "Mark complete" sends the full PUT body (PD-07). */
export function TaskCard({ task, projectName }: { task: Task; projectName?: string }) {
  const update = useUpdateTask();
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open task ${task.name}`} onPress={() => router.push(`/task/${task.id}`)}>
        <Text style={styles.title}>{task.name}</Text>
        <View style={styles.badges}>
          <Badge label={TASK_STATUS_LABELS[task.status]} colors={STATUS_COLORS[task.status]} />
          <Badge label={`${TASK_PRIORITY_LABELS[task.priority]} priority`} colors={PRIORITY_COLORS[task.priority]} />
        </View>
        {task.dueDate ? <Text style={styles.meta}>Due {formatDate(task.dueDate)}</Text> : null}
        {projectName ? <Text style={styles.meta}>Project: {projectName}</Text> : null}
      </Pressable>
      {task.status !== 'COMPLETED' ? (
        <Button
          title="Mark complete"
          variant="secondary"
          loading={update.isPending}
          onPress={() => update.mutate({ id: task.id, body: toTaskUpdateBody(task, { status: 'COMPLETED' }) })}
        />
      ) : null}
      <InlineError error={update.error} prefix="Could not update:" />
    </Card>
  );
}

/** The tasks of one project (project detail screen). */
export function TaskListSection({ projectId }: { projectId: string }) {
  const { data, error, isPending, refetch } = useTasks({ projectId });
  return (
    <View style={styles.section}>
      <Button title="Add task" onPress={() => router.push({ pathname: '/task/new', params: { projectId } })} />
      {isPending ? (
        <LoadingView label="Loading tasks..." />
      ) : error && !data ? (
        <ErrorView error={error} title="Could not load tasks" onRetry={() => void refetch()} />
      ) : data && data.length === 0 ? (
        <EmptyView title="No tasks yet" description="Add the first task to this project." />
      ) : (
        data?.map((task) => <TaskCard key={task.id} task={task} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  meta: { fontSize: 13, color: colors.subtle, marginTop: spacing.xs },
});
