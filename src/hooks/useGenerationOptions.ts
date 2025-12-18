import { useUiStore, GenerationOptions } from '@/stores/uiStore';

export type { GenerationOptions };

export function useGenerationOptions() {
  const generationOptions = useUiStore((state) => state.generationOptions);
  const updateGenerationOption = useUiStore((state) => state.updateGenerationOption);
  const updateGenerationOptions = useUiStore((state) => state.updateGenerationOptions);

  return {
    options: generationOptions,
    updateOption: updateGenerationOption,
    updateOptions: updateGenerationOptions,
  };
} 