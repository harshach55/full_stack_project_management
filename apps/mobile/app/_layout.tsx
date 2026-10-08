import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CheckingSessionScreen, MissingConfigurationScreen, UnreachableScreen } from '@/features/auth/SessionScreens';
import { api } from '@/lib/api';
import { AppProviders } from '@/providers/AppProviders';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Single authentication gate for the whole app: the (app) group is only reachable with a
 * valid session and the (auth) group only without one (Stack.Protected). Screens never
 * check the session themselves.
 */
function RootNavigator() {
  const { state } = useAuth();
  if (state.status === 'checking') return <CheckingSessionScreen />;
  if (state.status === 'unreachable') return <UnreachableScreen error={state.error} />;
  const signedIn = state.status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  if (!api) return <MissingConfigurationScreen />;
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
    </AppProviders>
  );
}
