import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export type PaymentMethod = 'gcash' | 'maya' | 'bank_transfer' | 'cash';
export type PaymentStatus = 'pending' | 'verified' | 'rejected';

export interface Household {
  id: string;
  houseNumber: number;
  familyName: string;
  phone: string;
  totalDue: number;
}

export interface Payment {
  id: string;
  householdId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  proofUrl: string | null;
  referenceNumber: string | null;
  notes: string;
  submittedAt: Timestamp;
  verifiedAt: Timestamp | null;
  verifiedBy: string | null;
  rejectionNote: string | null;
}

export interface UserProfile {
  uid: string;
  householdId: string | null;
  phone: string;
  isAdmin: boolean;
}

export interface PaymentInfo {
  gcashNumber: string;
  gcashName: string;
  mayaNumber: string;
  mayaName: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
}

// ── User profile ──────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

export async function createUserProfile(uid: string, phone: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { phone, householdId: null, isAdmin: false })
    .catch(async () => {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', uid), { phone, householdId: null, isAdmin: false });
    });
}

// ── Households ────────────────────────────────────────────────────────────────

export async function getAllHouseholds(): Promise<Household[]> {
  const snap = await getDocs(query(collection(db, 'households'), orderBy('houseNumber')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Household));
}

export function subscribeToHouseholds(callback: (households: Household[]) => void) {
  return onSnapshot(
    query(collection(db, 'households'), orderBy('houseNumber')),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Household))),
  );
}

export async function getHousehold(id: string): Promise<Household | null> {
  const snap = await getDoc(doc(db, 'households', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Household;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getPaymentsForHousehold(householdId: string): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, 'payments'),
      where('householdId', '==', householdId),
      orderBy('submittedAt', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
}

export function subscribeToHouseholdPayments(
  householdId: string,
  callback: (payments: Payment[]) => void,
) {
  return onSnapshot(
    query(
      collection(db, 'payments'),
      where('householdId', '==', householdId),
      orderBy('submittedAt', 'desc'),
    ),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))),
  );
}

export function subscribeToPendingPayments(callback: (payments: Payment[]) => void) {
  return onSnapshot(
    query(
      collection(db, 'payments'),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc'),
    ),
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment))),
  );
}

export async function getAllVerifiedPayments(): Promise<Payment[]> {
  const snap = await getDocs(
    query(collection(db, 'payments'), where('status', '==', 'verified')),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
}

export async function submitPayment(data: {
  householdId: string;
  amount: number;
  method: PaymentMethod;
  proofUri: string | null;
  referenceNumber: string;
  notes: string;
}): Promise<string> {
  let proofUrl: string | null = null;

  if (data.proofUri) {
    const response = await fetch(data.proofUri);
    const blob = await response.blob();
    const filename = `proofs/${data.householdId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    proofUrl = await getDownloadURL(storageRef);
  }

  const docRef = await addDoc(collection(db, 'payments'), {
    householdId: data.householdId,
    amount: data.amount,
    method: data.method,
    status: 'pending',
    proofUrl,
    referenceNumber: data.referenceNumber || null,
    notes: data.notes,
    submittedAt: serverTimestamp(),
    verifiedAt: null,
    verifiedBy: null,
    rejectionNote: null,
  });

  return docRef.id;
}

export async function verifyPayment(paymentId: string, adminUid: string): Promise<void> {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'verified',
    verifiedAt: serverTimestamp(),
    verifiedBy: adminUid,
  });
}

export async function rejectPayment(
  paymentId: string,
  adminUid: string,
  note: string,
): Promise<void> {
  await updateDoc(doc(db, 'payments', paymentId), {
    status: 'rejected',
    verifiedAt: serverTimestamp(),
    verifiedBy: adminUid,
    rejectionNote: note,
  });
}

// Admin logs a cash payment directly as verified
export async function logCashPayment(data: {
  householdId: string;
  amount: number;
  notes: string;
  adminUid: string;
}): Promise<void> {
  await addDoc(collection(db, 'payments'), {
    householdId: data.householdId,
    amount: data.amount,
    method: 'cash',
    status: 'verified',
    proofUrl: null,
    referenceNumber: null,
    notes: data.notes,
    submittedAt: serverTimestamp(),
    verifiedAt: serverTimestamp(),
    verifiedBy: data.adminUid,
    rejectionNote: null,
  });
}

// ── Payment info (community's receiving accounts) ─────────────────────────────

export async function getPaymentInfo(): Promise<PaymentInfo | null> {
  const snap = await getDoc(doc(db, 'config', 'payment_info'));
  if (!snap.exists()) return null;
  return snap.data() as PaymentInfo;
}

// ── Aggregation helpers ────────────────────────────────────────────────────────

export function computeTotalPaid(payments: Payment[]): number {
  return payments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + p.amount, 0);
}
