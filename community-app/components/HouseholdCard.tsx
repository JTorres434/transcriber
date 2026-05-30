import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fontSize, radii, spacing } from '../constants/theme';
import { Household } from '../lib/firestore';
import { formatPHP, TOTAL_DUE } from '../lib/currency';
import ProgressBar from './ProgressBar';

interface Props {
  household: Household;
  totalPaid: number;
  onPress?: () => void;
  highlight?: boolean;
}

export default function HouseholdCard({ household, totalPaid, onPress, highlight }: Props) {
  const remaining = Math.max(0, TOTAL_DUE - totalPaid);
  const progress = Math.min(1, totalPaid / TOTAL_DUE);
  const isPaid = remaining === 0;

  return (
    <TouchableOpacity
      style={[styles.card, highlight && styles.highlight]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{household.houseNumber}</Text>
        </View>
        <View style={styles.nameBlock}>
          <Text style={styles.name} numberOfLines={1}>{household.familyName}</Text>
          {isPaid && <Text style={styles.paidLabel}>Fully Paid ✓</Text>}
        </View>
        <Text style={[styles.paidAmount, isPaid && styles.paidAmountDone]}>
          {formatPHP(totalPaid)}
        </Text>
      </View>

      <ProgressBar
        progress={progress}
        height={6}
        color={isPaid ? colors.success : colors.primary}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isPaid ? 'Complete' : `${formatPHP(remaining)} remaining`}
        </Text>
        <Text style={styles.footerText}>
          {Math.round(progress * 100)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: spacing.sm,
  },
  highlight: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.ink,
  },
  paidLabel: {
    fontSize: fontSize.xs,
    color: colors.success,
    fontWeight: '600',
    marginTop: 1,
  },
  paidAmount: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  paidAmountDone: {
    color: colors.success,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
});
