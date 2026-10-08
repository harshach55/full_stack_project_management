import { LIMITS, loginBodySchema, registerBodySchema } from '@pm/shared';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Fields';
import { Card, Screen } from '@/components/Layout';
import { InlineError } from '@/components/States';
import { colors, spacing } from '@/components/theme';
import { isApiError, serverFieldErrors } from '@/lib/api-error';
import { validateForm, type FieldErrors } from '@/lib/form';
import { useAuth } from '@/providers/AuthProvider';

function useSubmit() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      const fields = serverFieldErrors(caught);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setError(caught);
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, fieldErrors, setFieldErrors, run };
}

export function LoginScreen() {
  const { state, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submitting, error, fieldErrors, setFieldErrors, run } = useSubmit();
  const notice = state.status === 'signedOut' ? state.notice : null;

  const onSubmit = () => {
    const result = validateForm(loginBodySchema, { email, password });
    if (!result.success) return setFieldErrors(result.errors);
    setFieldErrors({});
    void run(() => login(result.data));
  };

  return (
    <Screen contentStyle={styles.centered}>
      <Card>
        <Text style={styles.title} accessibilityRole="header">
          Log in
        </Text>
        {notice && !error ? (
          <Text style={styles.notice} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
        <InlineError error={error} />
        <TextField label="Email" value={email} onChangeText={setEmail} error={fieldErrors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
        <TextField label="Password" value={password} onChangeText={setPassword} error={fieldErrors.password} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={onSubmit} />
        <Button title="Log in" onPress={onSubmit} loading={submitting} />
        <View style={styles.footer}>
          <Text style={styles.muted}>No account yet? </Text>
          <Link href="/register" style={styles.link}>
            Create one
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

export function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submitting, error, fieldErrors, setFieldErrors, run } = useSubmit();

  const onSubmit = () => {
    const result = validateForm(registerBodySchema, { fullName, email, password });
    if (!result.success) return setFieldErrors(result.errors);
    setFieldErrors({});
    void run(async () => {
      try {
        await register(result.data);
      } catch (caught) {
        // A duplicate email is shown next to the email field.
        if (isApiError(caught) && caught.code === 'EMAIL_ALREADY_EXISTS') {
          setFieldErrors({ email: caught.message });
          return;
        }
        throw caught;
      }
    });
  };

  return (
    <Screen contentStyle={styles.centered}>
      <Card>
        <Text style={styles.title} accessibilityRole="header">
          Create account
        </Text>
        <InlineError error={error} />
        <TextField label="Full name" value={fullName} onChangeText={setFullName} error={fieldErrors.fullName} maxLength={LIMITS.fullNameMax} autoComplete="name" />
        <TextField label="Email" value={email} onChangeText={setEmail} error={fieldErrors.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          hint={`At least ${LIMITS.passwordMinBytes} characters (at most ${LIMITS.passwordMaxBytes} bytes).`}
          secureTextEntry
          autoComplete="password-new"
        />
        <Button title="Create account" onPress={onSubmit} loading={submitting} />
        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <Link href="/login" style={styles.link}>
            Log in
          </Link>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  notice: { backgroundColor: colors.warningBg, color: colors.warningText, padding: spacing.md, borderRadius: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  muted: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '600' },
});
