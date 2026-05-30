import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { getAuth } from 'firebase/auth';
import { getUserProfile, getPaymentInfo, submitPayment, PaymentMethod, PaymentInfo } from '../lib/firestore';
import { formatPHP, TOTAL_DUE } from '../lib/currency';
import { colors, fontSize, radii, spacing } from '../constants/theme';

const METHODS: { key: PaymentMethod; label: string; emoji: string; needsProof: boolean }[] = [
  { key: 'gcash', label: 'GCash', emoji: '📱', needsProof: true },
  { key: 'maya', label: 'Maya', emoji: '💜', needsProof: true },
  { key: 'bank_transfer', label: 'Bank Transfer', emoji: '🏦', needsProof: true },
  { key: 'cash', label: 'Cash', emoji: '💵', needsProof: false },
];

export default function SubmitPaymentScreen() {
  const router = useRouter();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('gcash');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    getUserProfile(user.uid).then(p => setHouseholdId(p?.householdId ?? null));
    getPaymentInfo().then(info => setPaymentInfo(info));
  }, []);

  const selectedMethod = METHODS.find(m => m.key === method)!;

  async function pickProof() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled) {
      setProofUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled) {
      setProofUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!householdId) {
      Alert.alert('Error', 'Your account is not linked to a household. Please contact the admin.');
      return;
    }
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }
    if (parsedAmount > TOTAL_DUE) {
      Alert.alert('Too large', `Amount cannot exceed ${formatPHP(TOTAL_DUE)}.`);
      return;
    }
    if (selectedMethod.needsProof && !proofUri) {
      Alert.alert('Proof required', 'Please upload a screenshot of your payment.');
      return;
    }

    setLoading(true);
    try {
      await submitPayment({
        householdId,
        amount: parsedAmount,
        method,
        proofUri: selectedMethod.needsProof ? proofUri : null,
        referenceNumber,
        notes,
      });
      Alert.alert(
        'Submitted!',
        'Your payment has been submitted for admin review. It will appear in your history once verified.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not submit payment. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function renderPaymentInstructions() {
    if (!paymentInfo) return null;

    if (method === 'gcash') {
      return (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>📱 Send via GCash</Text>
          <Text style={styles.instructionItem}>Number: <Text style={styles.bold}>{paymentInfo.gcashNumber}</Text></Text>
          <Text style={styles.instructionItem}>Name: <Text style={styles.bold}>{paymentInfo.gcashName}</Text></Text>
          <Text style={styles.instructionNote}>Then take a screenshot and upload it below as proof.</Text>
        </View>
      );
    }
    if (method === 'maya') {
      return (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>💜 Send via Maya</Text>
          <Text style={styles.instructionItem}>Number: <Text style={styles.bold}>{paymentInfo.mayaNumber}</Text></Text>
          <Text style={styles.instructionItem}>Name: <Text style={styles.bold}>{paymentInfo.mayaName}</Text></Text>
          <Text style={styles.instructionNote}>Then take a screenshot and upload it below as proof.</Text>
        </View>
      );
    }
    if (method === 'bank_transfer') {
      return (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>🏦 Bank Transfer Details</Text>
          <Text style={styles.instructionItem}>Bank: <Text style={styles.bold}>{paymentInfo.bankName}</Text></Text>
          <Text style={styles.instructionItem}>Account Name: <Text style={styles.bold}>{paymentInfo.bankAccountName}</Text></Text>
          <Text style={styles.instructionItem}>Account Number: <Text style={styles.bold}>{paymentInfo.bankAccountNumber}</Text></Text>
          <Text style={styles.instructionNote}>Upload your transfer receipt or screenshot as proof.</Text>
        </View>
      );
    }
    if (method === 'cash') {
      return (
        <View style={styles.instructionBox}>
          <Text style={styles.instructionTitle}>💵 Cash Payment</Text>
          <Text style={styles.instructionNote}>
            Submit this form to record your cash payment intent. The community treasurer will verify and confirm it in person.
          </Text>
        </View>
      );
    }
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Method selector */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.methodRow}>
          {METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[styles.methodBtn, method === m.key && styles.methodBtnActive]}
              onPress={() => setMethod(m.key)}
            >
              <Text style={styles.methodEmoji}>{m.emoji}</Text>
              <Text style={[styles.methodLabel, method === m.key && styles.methodLabelActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {renderPaymentInstructions()}

        {/* Amount */}
        <Text style={styles.sectionLabel}>Amount (PHP)</Text>
        <View style={styles.amountRow}>
          <Text style={styles.pesoSign}>₱</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {/* Reference number */}
        {method !== 'cash' && (
          <>
            <Text style={styles.sectionLabel}>Reference Number (optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="GCash/bank reference number"
              placeholderTextColor={colors.muted}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
            />
          </>
        )}

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="e.g. October installment"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* Proof upload */}
        {selectedMethod.needsProof && (
          <>
            <Text style={styles.sectionLabel}>Payment Proof <Text style={styles.required}>*Required</Text></Text>
            {proofUri ? (
              <View style={styles.proofPreview}>
                <Image source={{ uri: proofUri }} style={styles.proofImg} />
                <TouchableOpacity style={styles.changeProof} onPress={() => setProofUri(null)}>
                  <Text style={styles.changeProofText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadRow}>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickProof}>
                  <Text style={styles.uploadEmoji}>🖼️</Text>
                  <Text style={styles.uploadText}>From Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.uploadBtn} onPress={takePhoto}>
                  <Text style={styles.uploadEmoji}>📷</Text>
                  <Text style={styles.uploadText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Payment</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Your payment will be reviewed by the community treasurer. It will be verified within 1–2 days.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  required: { color: colors.error, textTransform: 'none' },
  methodRow: { flexDirection: 'row', gap: spacing.sm },
  methodBtn: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
  },
  methodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  methodEmoji: { fontSize: 22 },
  methodLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.inkSoft },
  methodLabelActive: { color: colors.primary },
  instructionBox: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  instructionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.ink },
  instructionItem: { fontSize: fontSize.sm, color: colors.inkSoft },
  instructionNote: { fontSize: fontSize.sm, color: colors.inkSoft, fontStyle: 'italic', marginTop: spacing.xs },
  bold: { fontWeight: '700', color: colors.ink },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  pesoSign: {
    paddingHorizontal: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.ink,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  uploadRow: { flexDirection: 'row', gap: spacing.sm },
  uploadBtn: {
    flex: 1,
    height: 100,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadEmoji: { fontSize: 28 },
  uploadText: { fontSize: fontSize.sm, color: colors.inkSoft, fontWeight: '600' },
  proofPreview: { alignItems: 'center', gap: spacing.sm },
  proofImg: { width: '100%', height: 200, borderRadius: radii.md, backgroundColor: colors.line },
  changeProof: { padding: spacing.sm },
  changeProofText: { color: colors.error, fontWeight: '600', fontSize: fontSize.sm },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '700' },
  disclaimer: {
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
