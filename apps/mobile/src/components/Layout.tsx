import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { OfflineBanner } from './States';
import { colors, spacing } from './theme';

interface ScreenProps {
  children: ReactNode;
  /** Enables pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Scrollable screen body with the offline banner; stays usable while the keyboard is open (forms). */
export function Screen({ children, onRefresh, refreshing = false, contentStyle }: ScreenProps) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <OfflineBanner />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, colors: [background, text] }: { label: string; colors: [string, string] }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sectionTitle} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  badge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
