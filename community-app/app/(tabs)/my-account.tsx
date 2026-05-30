import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import {
  getUserProfile,
  getHousehold,
  subscribeToHouseholdPayments,
  computeTotalPaid,
  Household,
  Payment,
} from '../../lib/firestore';
import { formatPHP, TOTAL_DUE } from '../../lib/currency';
import ProgressBar from '../../components/ProgressBar';
import PaymentHistoryItem from '../../components/PaymentHistoryItem';
import { colors, fontSize, radii, spacing } from '../../constants/theme';
import { logout } from '../../lib/auth';

export default function MyAccountScreen() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [noHousehold, setNoHousehold] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const user = getAuth().currentUser;
      if (!user) return;

      let unsub: (() => void) | null = null;

      getUserProfile(user.uid).then(profile => {
        if (!profile?.householdId) {
          setNoHousehold(true);
          setLoading(false);
          return;
        }
        getHousehold(profile.householdId).then(h => setHousehold(h));
        unsub = subscribeToHouseholdPayments(profile.householdId, p => {
          setPayments(p);
          setLoading(false);
        });
      });

      return () => unsub?.();
    }, []),
  );

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (noHousehold) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.center}>
          <Text style={styles.noHouseEmoji}>⏳</Text>
          <Text style={styles.noHouseTitle}>Account Not Linked</Text>
          <Text style={styles.noHouseText}>
            Please ask the community admin to link your account to your household.
          </Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalPaid = computeTotalPaid(payments);
  const remaining = Math.max(0, TOTAL_DUE - totalPaid);
  const progress = Math.min(1, totalPaid / TOTAL_DUE);
  const isPaid = remaining === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={payments}
        keyExtractor={p => p.id}
        ListHeaderComponent={() => (
          <View>
            {/* Progress card */}
            <View style={styles.progressCard}>
              <Text style={styles.houseName}>{household?.familyName}</Text>
              <Text style={styles.houseNum}>House #{household?.houseNumber}</Text>

              <View style={styles.amountsRow}>
                <View>
                  <Text style={styles.amtLabel}>Paid</Text>
                  <Text style={[styles.amtValue, { color: colors.success }]}>{formatPHP(totalPaid)}</Text>
                </View>
                <View style={styles.divider} />
                <View>
                  <Text style={styles.amtLabel}>Remaining</Text>
                  <Text style={[styles.amtValue, { color: isPaid ? colors.success : colors.accent }]}>
                    {isPaid ? 'Fully Paid!' : formatPHP(remaining)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View>
                  <Text style={styles.amtLabel}>Total Due</Text>
                  <Text style={styles.amtValue}>{formatPHP(TOTAL_DUE)}</Text>
                </View>
              </View>

              <ProgressBar
                progress={progress}
                height={10}
                color={isPaid ? colors.success : colors.accent}
                trackColor="rgba(255,255,255,0.3)"
              />
              <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
            </View>

            {/* Submit payment button */}
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => router.push('/submit-payment')}
              activeOpacity={0.8}
            >
              <Text style={styles.payBtnText}>+ Submit Payment</Text>
            </TouchableOpacity>

            {/* History header */}
            {payments.length > 0 && (
              <Text style={styles.historyLabel}>Payment History</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => <PaymentHistoryItem payment={item} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyText}>No payments submitted yet.</Text>
            <Text style={styles.emptySubtext}>Tap "Submit Payment" above to record your first payment.</Text>
          </View>
        )}
        ListFooterComponent={() => (
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  progressCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 16,
    gap: spacing.md,
  },
  houseName: {
    fontSize: fontSize.xxl,
    fontWeight: '800',
    color: '#fff',
  },
  houseNum: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: -spacing.sm,
  },
  amountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  amtLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  amtValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressPct: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  payBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  payBtnText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
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
  emptyHistory: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  noHouseEmoji: {
    fontSize: 48,
  },
  noHouseTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  noHouseText: {
    fontSize: fontSize.md,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  logoutBtn: {
    margin: spacing.xl,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
});
