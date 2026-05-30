import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmOtp } from '../lib/auth';
import { createUserProfile, getUserProfile } from '../lib/firestore';
import { colors, fontSize, radii, spacing } from '../constants/theme';
import { getConfirmation, clearConfirmation } from '../lib/confirmationStore';

export default function VerifyScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    if (code.length === 6) handleVerify();
  }, [code]);

  async function handleVerify() {
    const confirmation = getConfirmation();
    if (!confirmation) {
      Alert.alert('Session expired', 'Please go back and request a new code.');
      return;
    }
    setLoading(true);
    try {
      const user = await confirmOtp(confirmation, code);
      const existing = await getUserProfile(user.uid);
      if (!existing) {
        await createUserProfile(user.uid, phone ?? '');
      }
      clearConfirmation();
      // Auth state change in _layout will redirect to tabs
    } catch (err: any) {
      setCode('');
      Alert.alert('Invalid code', err?.message ?? 'The code you entered is incorrect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.top}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>💬</Text>
          </View>
          <Text style={styles.title}>Enter Code</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.phone}>{phone}</Text>
          </Text>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          caretHidden
        />

        <TouchableOpacity onPress={() => inputRef.current?.focus()} activeOpacity={0.8}>
          <View style={styles.codeRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[styles.codeBox, code[i] !== undefined && styles.codeBoxFilled]}
              >
                <Text style={styles.codeChar}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Verifying…</Text>
          </View>
        )}

        <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
          <Text style={styles.resendText}>Didn't receive a code? Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  top: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 22,
  },
  phone: {
    fontWeight: '700',
    color: colors.ink,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  codeBox: {
    width: 46,
    height: 56,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  codeChar: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.ink,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.inkSoft,
  },
  resendBtn: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  resendText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
  },
});
