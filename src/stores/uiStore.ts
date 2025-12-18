import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProcessStep } from '@/types';

export interface GenerationOptions {
  bullets: boolean;
  minutes: boolean;
  tasks: boolean;
}

interface UIState {
  currentStep: ProcessStep;
  isChangelogOpen: boolean;
  globalError: string | null;
  generationOptions: GenerationOptions;
  setCurrentStep: (step: ProcessStep) => void;
  openChangelog: () => void;
  closeChangelog: () => void;
  setGlobalError: (error: string | null) => void;
  updateGenerationOption: (key: keyof GenerationOptions, value: boolean) => void;
  updateGenerationOptions: (options: Partial<GenerationOptions>) => void;
}

export const useUiStore = create<UIState>()(
  persist(
    (set) => ({
      currentStep: 'upload',
      isChangelogOpen: false,
      globalError: null,
      generationOptions: {
        bullets: true,
        minutes: true,
        tasks: false,
      },
      setCurrentStep: (step) => set({ currentStep: step }),
      openChangelog: () => set({ isChangelogOpen: true }),
      closeChangelog: () => set({ isChangelogOpen: false }),
      setGlobalError: (error) => set({ globalError: error }),
      updateGenerationOption: (key, value) => 
        set((state) => ({
          generationOptions: {
            ...state.generationOptions,
            [key]: value,
          },
        })),
      updateGenerationOptions: (options) =>
        set((state) => ({
          generationOptions: {
            ...state.generationOptions,
            ...options,
          },
        })),
    }),
    {
      name: 'transcript-minute-ui-store',
      partialize: (state) => ({
        generationOptions: state.generationOptions,
      }),
    }
  )
); 