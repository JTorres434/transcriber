import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import {
  subscribeToPendingPayments,
  getAllHouseholds,
  verifyPayment,
  rejectPayment,
  logCashPayment,
  Payment,
  Household,
} from '../../lib/firestore';
import { formatPHP } from '../../lib/currency';
import StatusBadge from '../../components/StatusBadge';
import { colors, fontSize, radii, spacing } from '../../constants/theme';

const METHOD_LABELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
};

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminScreen() {
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [householdMap, setHouseholdMap] = useState<Record<string, Household>>({});
  const [selectedProof, setSelectedProof] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  // Cash payment logging
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashHouseholdId, setCashHouseholdId] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [households, setHouseholds] = useState<Household[]>([]);

  useEffect(() => {
    getAllHouseholds().then(list => {
      setHouseholds(list);
      const map: Record<string, Household> = {};
      list.forEach(h => { map[h.id] = h; });
      setHouseholdMap(map);
    });

    const unsub = subscribeToPendingPayments(setPendingPayments);
    return unsub;
  }, []);

  async function handleVerify(paymentId: string) {
    const adminUid = getAuth().currentUser?.uid;
    if (!adminUid) return;
    setProcessing(paymentId);
    try {
      await verifyPayment(paymentId, adminUid);
    } catch {
      Alert.alert('Error', 'Could not verify payment.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(paymentId: string) {
    if (!rejectNote.trim()) {
      Alert.alert('Required', 'Please enter a reason for rejection.');
      return;
    }
    const adminUid = getAuth().currentUser?.uid;
    if (!adminUid) return;
    setProcessing(paymentId);
    try {
      await rejectPayment(paymentId, adminUid, rejectNote.trim());
      setRejectingId(null);
      setRejectNote('');
    } catch {
      Alert.alert('Error', 'Could not reject payment.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleLogCash() {
    const adminUid = getAuth().currentUser?.uid;
    if (!adminUid || !cashHouseholdId || !cashAmount) {
      Alert.alert('Required', 'Please select a household and enter an amount.');
      return;
    }
    const amount = parseFloat(cashAmount.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    try {
      await logCashPayment({ householdId: cashHouseholdId, amount, notes: cashNotes, adminUid });
      setShowCashModal(false);
      setCashHouseholdId('');
      setCashAmount('');
      setCashNotes('');
      Alert.alert('Done', 'Cash payment logged successfully.');
    } catch {
      Alert.alert('Error', 'Could not log cash payment.');
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Proof image modal */}
      <Modal visible={!!selectedProof} transparent animationType="fade">
        <View style={styles.proofModal}>
          <TouchableOpacity style={styles.proofClose} onPress={() => setSelectedProof(null)}>
            <Text style={styles.proofCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {selectedProof && (
            <Image source={{ uri: selectedProof }} style={styles.proofImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Cash payment modal */}
      <Modal visible={showCashModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.cashModal}>
            <Text style={styles.cashModalTitle}>Log Cash Payment</Text>
            <Text style={styles.cashLabel}>Household</Text>
            <ScrollView style={styles.householdPicker} nestedScrollEnabled>
              {households.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.householdOption, cashHouseholdId === h.id && styles.householdOptionSelected]}
                  onPress={() => setCashHouseholdId(h.id)}
                >
                  <Text style={[styles.householdOptionText, cashHouseholdId === h.id && { color: '#fff' }]}>
                    #{h.houseNumber} — {h.familyName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.cashLabel}>Amount (PHP)</Text>
            <TextInput
              style={styles.cashInput}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              value={cashAmount}
              onChangeText={setCashAmount}
            />
            <Text style={styles.cashLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.cashInput}
              placeholder="e.g. October installment"
              value={cashNotes}
              onChangeText={setCashNotes}
            />
            <View style={styles.cashButtons}>
              <TouchableOpacity style={styles.cashCancel} onPress={() => setShowCashModal(false)}>
                <Text style={styles.cashCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cashConfirm} onPress={handleLogCash}>
                <Text style={styles.cashConfirmText}>Log Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={pendingPayments}
        keyExtractor={p => p.id}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.sectionLabel}>Pending Approvals ({pendingPayments.length})</Text>
            <TouchableOpacity style={styles.cashBtn} onPress={() => setShowCashModal(true)}>
              <Text style={styles.cashBtnText}>+ Log Cash</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>No pending payments to review.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const h = householdMap[item.householdId];
          const isProcessing = processing === item.id;
          const isRejecting = rejectingId === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.houseName}>{h ? `#${h.houseNumber} — ${h.familyName}` : '—'}</Text>
                  <Text style={styles.cardSub}>{METHOD_LABELS[item.method]} • {formatDate(item.submittedAt)}</Text>
                  {item.referenceNumber && (
                    <Text style={styles.refNum}>Ref: {item.referenceNumber}</Text>
                  )}
                  {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.amount}>{formatPHP(item.amount)}</Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>

              {item.proofUrl && (
                <TouchableOpacity onPress={() => setSelectedProof(item.proofUrl!)} style={styles.proofThumb}>
                  <Image source={{ uri: item.proofUrl }} style={styles.thumbImg} />
                  <Text style={styles.thumbLabel}>Tap to view proof</Text>
                </TouchableOpacity>
              )}

              {isRejecting ? (
                <View style={styles.rejectBox}>
                  <TextInput
                    style={styles.rejectInput}
                    placeholder="Reason for rejection…"
                    value={rejectNote}
                    onChangeText={setRejectNote}
                    multiline
                  />
                  <View style={styles.rejectButtons}>
                    <TouchableOpacity onPress={() => { setRejectingId(null); setRejectNote(''); }} style={styles.cancelBtn}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleReject(item.id)} style={styles.confirmRejectBtn}>
                      <Text style={styles.confirmRejectText}>Confirm Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.rejectBtn}
                    onPress={() => setRejectingId(item.id)}
                    disabled={isProcessing}
                  >
                    <Text style={styles.rejectBtnText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.verifyBtn, isProcessing && { opacity: 0.5 }]}
                    onPress={() => handleVerify(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.verifyBtnText}>✓ Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: spacing.xl },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cashBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  cashBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  houseName: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  refNum: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2 },
  notes: { fontSize: fontSize.xs, color: colors.inkSoft, marginTop: 2, fontStyle: 'italic' },
  amount: { fontSize: fontSize.lg, fontWeight: '700', color: colors.ink },
  proofThumb: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbImg: { width: 60, height: 60, borderRadius: radii.sm, backgroundColor: colors.line },
  thumbLabel: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  rejectBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.error,
    alignItems: 'center',
  },
  rejectBtnText: { color: colors.error, fontWeight: '700', fontSize: fontSize.sm },
  verifyBtn: {
    flex: 2,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.success,
    alignItems: 'center',
  },
  verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  rejectBox: { gap: spacing.sm },
  rejectInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.ink,
    minHeight: 60,
  },
  rejectButtons: { flexDirection: 'row', gap: spacing.sm },
  cancelBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  cancelText: { color: colors.inkSoft, fontWeight: '600', fontSize: fontSize.sm },
  confirmRejectBtn: {
    flex: 2,
    padding: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmRejectText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.ink },
  emptyText: { fontSize: fontSize.md, color: colors.muted },
  proofModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  proofClose: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  proofCloseText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  proofImage: { width: '90%', height: '70%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cashModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.xl,
    gap: spacing.sm,
    maxHeight: '80%',
  },
  cashModalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  cashLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 },
  cashInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  householdPicker: { maxHeight: 160, marginBottom: spacing.sm },
  householdOption: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xs,
  },
  householdOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  householdOptionText: { fontSize: fontSize.sm, color: colors.ink },
  cashButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cashCancel: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  cashCancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.inkSoft },
  cashConfirm: {
    flex: 2,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  cashConfirmText: { fontSize: fontSize.md, fontWeight: '700', color: '#fff' },
});
