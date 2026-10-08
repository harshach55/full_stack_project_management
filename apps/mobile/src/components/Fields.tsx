import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, spacing, TOUCH_TARGET } from './theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

/** Labelled text input; the label and error are exposed to screen readers. */
export function TextField({ label, error, hint, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.subtle}
        style={[styles.input, rest.multiline && styles.multiline, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (value: T | '') => void;
  /** Adds an "All" option that clears the selection (used for filters). */
  allowAll?: boolean;
  error?: string;
  disabled?: boolean;
}

/** Single-choice selector shown as large chips (status, priority, filters). */
export function ChipGroup<T extends string>({ label, options, value, onChange, allowAll = false, error, disabled = false }: ChipGroupProps<T>) {
  const items: { value: T | ''; label: string }[] = allowAll ? [{ value: '', label: 'All' }, ...options] : options;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {items.map((item) => {
          const selected = item.value === value;
          return (
            <Pressable
              key={item.value || 'all'}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${label}: ${item.label}`}
              disabled={disabled}
              onPress={() => onChange(item.value)}
              style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  input: {
    minHeight: TOUCH_TARGET,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 13, color: colors.danger },
  hint: { fontSize: 12, color: colors.subtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.55 },
  chipText: { fontSize: 14, color: colors.text },
  chipTextSelected: { color: colors.primaryText, fontWeight: '600' },
});
