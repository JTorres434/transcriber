import { ConfirmationResult } from 'firebase/auth';

let _confirmation: ConfirmationResult | null = null;

export function setConfirmation(c: ConfirmationResult) {
  _confirmation = c;
}

export function getConfirmation(): ConfirmationResult | null {
  return _confirmation;
}

export function clearConfirmation() {
  _confirmation = null;
}
