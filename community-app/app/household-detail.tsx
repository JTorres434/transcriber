import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { getHousehold, getPaymentsForHousehold, computeTotalPaid, Household, Payment } from '../lib/firestore';
import { formatPHP, TOTAL_DUE } from '../lib/currency';
import ProgressBar from '../components/ProgressBar';
import PaymentHistoryItem from '../components/PaymentHistoryItem';
import { colors, fontSize, spacing } from '../constants/theme';

export default function HouseholdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [household, setHousehold] = useState<Household | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([getHousehold(id), getPaymentsForHousehold(id)]).then(([h, p]) => {
      setHousehold(h);
      setPayments(p);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!household) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Household not found.</Text>
      </View>
    );
  }

  const totalPaid = computeTotalPaid(payments);
  const remaining = Math.max(0, TOTAL_DUE - totalPaid);
  const progress = Math.min(1, totalPaid / TOTAL_DUE);
  const isPaid = remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={payments.filter(p => p.status === 'verified')}
        keyExtractor={p => p.id}
        ListHeaderComponent={() => (
          <View>
            <View style={styles.summaryCard}>
              <Text style={styles.name}>{household.familyName}</Text>
              <Text style={styles.sub}>House #{household.houseNumber}</Text>

              <View style={styles.amountsRow}>
                <View>
                  <Text style={styles.amtLabel}>Paid</Text>
                  <Text style={[styles.amtVal, { color: '#a5d6a7' }]}>{formatPHP(totalPaid)}</Text>
                </View>
                <View style={styles.vDivider} />
                <View>
                  <Text style={styles.amtLabel}>Remaining</Text>
                  <Text style={[styles.amtVal, { color: isPaid ? '#a5d6a7' : '#ffcc80' }]}>
                    {isPaid ? 'Done!' : formatPHP(remaining)}
                  </Text>
                </View>
              </View>

              <ProgressBar
                progress={progress}
                height={10}
                color={isPaid ? '#81c784' : '#ffb74d'}
                trackColor="rgba(255,255,255,0.2)"
              />
              <Text style={styles.pct}>{Math.round(progress * 100)}% of ₱150,000</Text>
            </View>

            {payments.filter(p => p.status === 'verified').length > 0 && (
              <Text style={styles.historyLabel}>Verified Payments</Text>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No verified payments yet.</Text>
          </View>
        )}
        renderItem={({ item }) => <PaymentHistoryItem payment={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: fontSize.md, color: colors.muted },
  list: { paddingBottom: spacing.xl },
  summaryCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 16,
    gap: spacing.md,
  },
  name: { fontSize: fontSize.xxl, fontWeight: '800', color: '#fff' },
  sub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: -spacing.sm },
  amountsRow: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
  amtLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  amtVal: { fontSize: fontSize.xl, fontWeight: '700' },
  vDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' },
  pct: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  historyLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: fontSize.md, color: colors.muted },
});
