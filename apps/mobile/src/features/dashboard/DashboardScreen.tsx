import type { DashboardResponse } from '@pm/shared';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card, Screen } from '@/components/Layout';
import { ErrorView, InlineError, LoadingView } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { useAuth, useCurrentUser } from '@/providers/AuthProvider';
import { useDashboard } from '../hooks';

/** The six statistics from GET /api/dashboard (DASH-01); counts come from the API only. */
const METRICS: { key: keyof DashboardResponse; label: string }[] = [
  { key: 'totalProjects', label: 'Total projects' },
  { key: 'projectsInProgress', label: 'Projects in progress' },
  { key: 'totalTasks', label: 'Total tasks' },
  { key: 'completedTasks', label: 'Completed tasks' },
  { key: 'pendingTasks', label: 'Pending tasks' },
  { key: 'inProgressTasks', label: 'In-progress tasks' },
];

export function DashboardScreen() {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { data, error, isPending, isRefetching, refetch } = useDashboard();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);

  const onLogout = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
    } catch (caught) {
      setLogoutError(caught);
      setLoggingOut(false);
    }
  };

  return (
    <Screen onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Text style={styles.welcome}>Welcome, {user.fullName}</Text>
      {isPending ? (
        <LoadingView label="Loading dashboard..." />
      ) : error && !data ? (
        <ErrorView error={error} title="Could not load the dashboard" onRetry={() => void refetch()} />
      ) : data ? (
        <View style={styles.grid}>
          {METRICS.map((metric) => (
            <Card key={metric.key} style={styles.metric}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue} accessibilityLabel={`${metric.label}: ${data[metric.key]}`}>
                {data[metric.key]}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
      <Card>
        <Text style={styles.metricLabel}>Signed in as</Text>
        <Text style={styles.user}>{user.email}</Text>
        <InlineError error={logoutError} prefix="Could not log out:" />
        <Button title="Log out" variant="secondary" onPress={() => void onLogout()} loading={loggingOut} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  welcome: { fontSize: 18, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { flexBasis: '47%', flexGrow: 1 },
  metricLabel: { fontSize: 13, color: colors.muted },
  metricValue: { fontSize: 30, fontWeight: '700', color: colors.text },
  user: { fontSize: 15, color: colors.text, marginBottom: spacing.sm },
});
