import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Household, Payment, subscribeToHouseholds, getPaymentsForHousehold, computeTotalPaid } from '../../lib/firestore';
import { formatPHP, TOTAL_DUE } from '../../lib/currency';
import HouseholdCard from '../../components/HouseholdCard';
import ProgressBar from '../../components/ProgressBar';
import { colors, fontSize, spacing } from '../../constants/theme';
import { getAuth } from 'firebase/auth';
import { getUserProfile } from '../../lib/firestore';

export default function CommunityDashboard() {
  const router = useRouter();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [paidMap, setPaidMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myHouseholdId, setMyHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (user) {
      getUserProfile(user.uid).then(p => setMyHouseholdId(p?.householdId ?? null));
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeToHouseholds(async (list) => {
      setHouseholds(list);
      // Fetch payments for each household
      const map: Record<string, number> = {};
      await Promise.all(
        list.map(async h => {
          const payments = await getPaymentsForHousehold(h.id);
          map[h.id] = computeTotalPaid(payments);
        }),
      );
      setPaidMap(map);
      setLoading(false);
      setRefreshing(false);
    });
    return unsub;
  }, []);

  const totalCommunityPaid = Object.values(paidMap).reduce((s, v) => s + v, 0);
  const totalCommunityDue = households.length * TOTAL_DUE;
  const communityProgress = totalCommunityDue > 0 ? totalCommunityPaid / totalCommunityDue : 0;
  const fullyPaidCount = households.filter(h => (paidMap[h.id] ?? 0) >= TOTAL_DUE).length;

  function handleRefresh() {
    setRefreshing(true);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading community data…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={households}
        keyExtractor={h => h.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Community Total</Text>
              <Text style={styles.summaryAmount}>{formatPHP(totalCommunityPaid)}</Text>
              <Text style={styles.summarySubtitle}>of {formatPHP(totalCommunityDue)} goal</Text>
              <ProgressBar progress={communityProgress} height={10} />
              <View style={styles.statsRow}>
                <Text style={styles.stat}>{fullyPaidCount} / {households.length} fully paid</Text>
                <Text style={styles.stat}>{Math.round(communityProgress * 100)}%</Text>
              </View>
            </View>
            <Text style={styles.sectionLabel}>All Households</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <HouseholdCard
            household={item}
            totalPaid={paidMap[item.id] ?? 0}
            highlight={item.id === myHouseholdId}
            onPress={() => router.push({ pathname: '/household-detail', params: { id: item.id } })}
          />
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
    gap: spacing.md,
    backgroundColor: colors.bg,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.muted,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    margin: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 16,
    gap: spacing.sm,
  },
  summaryTitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  summarySubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  stat: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: spacing.md,
  },
});
