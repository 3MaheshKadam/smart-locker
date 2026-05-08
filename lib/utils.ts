import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(paise / 100);
}

export function calculateOvertimeHours(paidUntil: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - paidUntil.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

export function calculateOvertimeMinutes(paidUntil: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - paidUntil.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60));
}

export function isInGracePeriod(paidUntil: Date, now: Date = new Date()): boolean {
  const GRACE_MINUTES = 10;
  const diffMs = now.getTime() - paidUntil.getTime();
  return diffMs > 0 && diffMs <= GRACE_MINUTES * 60 * 1000;
}
