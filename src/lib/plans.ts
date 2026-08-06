// Plan tier definitions — single source of truth for the whole app.
// When RevenueCat is added, replace the `plan` value in useSettingsStore
// with the entitlement returned by Purchases.getCustomerInfo() and all
// cap/feature logic here will work without any other changes.

export type Plan = 'free' | 'pro' | 'guardian';

export type PlanConfig = {
  label: string;
  price: string;
  dailyCap: number | null; // null = unlimited
  audioEnabled: boolean;
  minInterval: 20 | 30 | 60;
  color: string;
};

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    label: 'Free',
    price: '$0',
    dailyCap: 50,
    audioEnabled: false,
    minInterval: 60,
    color: '#8888A0',
  },
  pro: {
    label: 'Pro',
    price: '$9.99/mo',
    dailyCap: 300,
    audioEnabled: true,
    minInterval: 30,
    color: '#00E5FF',
  },
  guardian: {
    label: 'Guardian',
    price: '$24.99/mo',
    dailyCap: null,
    audioEnabled: true,
    minInterval: 20,
    color: '#FFD740',
  },
};

export function isCapReached(plan: Plan, todayUsage: number): boolean {
  const cap = PLANS[plan].dailyCap;
  if (cap === null) return false;
  return todayUsage >= cap;
}

export function capLabel(plan: Plan, todayUsage: number): string {
  const cap = PLANS[plan].dailyCap;
  if (cap === null) return 'Unlimited';
  return `${todayUsage} / ${cap} today`;
}

export function capPercent(plan: Plan, todayUsage: number): number {
  const cap = PLANS[plan].dailyCap;
  if (cap === null) return 0;
  return Math.min(1, todayUsage / cap);
}
