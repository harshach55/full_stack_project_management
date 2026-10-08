import { StyleSheet, Text, View } from 'react-native';
import { ErrorView, LoadingView } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { useAuth } from '@/providers/AuthProvider';

export function CheckingSessionScreen() {
  return <LoadingView label="Checking your session..." />;
}

/** The stored session could not be checked (offline or server down); the token is kept. */
export function UnreachableScreen({ error }: { error: unknown }) {
  const { retry } = useAuth();
  return (
    <View style={styles.container}>
      <ErrorView error={error} title="Could not reach the server" onRetry={retry} />
    </View>
  );
}

/** EXPO_PUBLIC_API_URL is missing or invalid; nothing can work until it is set. */
export function MissingConfigurationScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>API address not configured</Text>
      <Text style={styles.text}>
        Set EXPO_PUBLIC_API_URL in apps/mobile/.env.local (see apps/mobile/.env.example) and restart Expo. On the Android emulator the
        local API is usually http://10.0.2.2:4000.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  text: { fontSize: 15, color: colors.muted, lineHeight: 22 },
});
