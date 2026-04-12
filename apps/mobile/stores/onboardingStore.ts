import { create } from 'zustand';

export type OnboardingStep = 'location' | 'cuisines' | 'price' | 'distance' | 'auth';

interface OnboardingState {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  step: 'location',
  setStep: (step) => set({ step }),
  reset: () => set({ step: 'location' }),
}));
