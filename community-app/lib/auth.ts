import {
  getAuth,
  signInWithPhoneNumber,
  ApplicationVerifier,
  ConfirmationResult,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import app from './firebase';

export const auth = getAuth(app);

export async function sendOtp(
  phoneNumber: string,
  appVerifier: ApplicationVerifier,
): Promise<ConfirmationResult> {
  // phoneNumber must include country code, e.g. +639171234567
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

export async function confirmOtp(
  confirmation: ConfirmationResult,
  code: string,
): Promise<User> {
  const result = await confirmation.confirm(code);
  return result.user;
}

export async function logout(): Promise<void> {
  return signOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
