import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, radii, spacing } from '../constants/theme';
import { PaymentStatus } from '../lib/firestore';

const config: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: colors.pendingSoft, text: colors.pending },
  verified: { label: 'Verified', bg: colors.verifiedSoft, text: colors.verified },
  rejected: { label: 'Rejected', bg: colors.rejectedSoft, text: colors.rejected },
};

export default function StatusBadge({ status }: { status: PaymentStatus }) {
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.text }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
