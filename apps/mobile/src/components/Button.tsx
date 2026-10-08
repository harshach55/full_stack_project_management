import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, TOUCH_TARGET } from './theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Button with a 48 dp touch target; disabled with a spinner while `loading` (no double submits). */
export function Button({ title, variant = 'primary', loading = false, disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, isDisabled && styles.disabled, style]}
      {...rest}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? colors.primaryText : colors.text} />}
      <Text style={[styles.text, (variant === 'primary' || variant === 'danger') && styles.lightText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#cbd5e1' },
  danger: { backgroundColor: colors.danger },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  text: { fontSize: 16, fontWeight: '600', color: colors.text },
  lightText: { color: colors.primaryText },
});
