import { useNetInfo } from '@react-native-community/netinfo';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/lib/api-error';
import { Button } from './Button';
import { colors, spacing } from './theme';

export function LoadingView({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function EmptyView({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.muted}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** Readable error with Retry; never shows raw responses or internal details. */
export function ErrorView({ error, title = 'Could not load data', onRetry }: { error: unknown; title?: string; onRetry?: () => void }) {
  return (
    <View style={[styles.box, styles.errorBox]} accessibilityRole="alert">
      <Text style={[styles.title, styles.errorTitle]}>{title}</Text>
      <Text style={styles.errorText}>{errorMessage(error)}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Retry" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

/** Inline message for a failed action (save, delete, quick change). */
export function InlineError({ error, prefix }: { error: unknown; prefix?: string }) {
  if (!error) return null;
  return (
    <Text style={styles.inline} accessibilityRole="alert">
      {prefix ? `${prefix} ` : ''}
      {errorMessage(error)}
    </Text>
  );
}

/**
 * Shown on every app screen while NetInfo reports no connection. Already loaded data stays
 * visible; pulling to refresh works again once the connection returns.
 */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  if (isConnected !== false) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.offlineText}>You are offline. Showing the last loaded data; changes need a connection.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  box: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorBox: { borderStyle: 'solid', borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
  title: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  errorTitle: { color: '#991b1b' },
  errorText: { fontSize: 14, color: '#b91c1c', textAlign: 'center' },
  muted: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  action: { marginTop: spacing.sm, alignSelf: 'stretch' },
  inline: { fontSize: 14, color: colors.danger, marginVertical: spacing.sm },
  offline: { backgroundColor: colors.warningBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderColor: '#fde68a' },
  offlineText: { color: colors.warningText, fontSize: 13 },
});
