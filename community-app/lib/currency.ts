export function formatPHP(amount: number): string {
  return '₱ ' + amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPHPShort(amount: number): string {
  if (amount >= 1000) {
    return '₱' + (amount / 1000).toFixed(1) + 'k';
  }
  return '₱' + amount.toLocaleString('en-PH');
}

export const TOTAL_DUE = 150000;
