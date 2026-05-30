import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, radii, spacing } from '../constants/theme';
import { Payment } from '../lib/firestore';
import { formatPHP } from '../lib/currency';
import StatusBadge from './StatusBadge';

const METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
};

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  payment: Payment;
}

export default function PaymentHistoryItem({ payment }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.method}>{METHOD_LABELS[payment.method]}</Text>
        <Text style={styles.date}>{formatDate(payment.submittedAt)}</Text>
        {payment.rejectionNote ? (
          <Text style={styles.rejection} numberOfLines={2}>
            Rejected: {payment.rejectionNote}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatPHP(payment.amount)}</Text>
        <StatusBadge status={payment.status} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: spacing.sm,
  },
  left: {
    flex: 1,
    gap: 3,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  method: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.ink,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  amount: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
  },
  rejection: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: 2,
  },
});
