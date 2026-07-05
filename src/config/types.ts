export interface AutomechConfig {
  pipeline: {
    maxIterations: number;
    sandboxTimeoutMs: number;
    dockerMemoryMb: number;
    dockerCpus: number;
  };
  manufacturing: {
    buildVolume: [number, number, number];
    maxOverhangPercent: number;
    defaultMaterial: string;
  };
  llm: {
    provider: 'openrouter' | 'deepseek';
    model: string;
    temperature: number;
  };
  slicer: {
    preferredBinary: string;
    timeoutMs: number;
  };
  api: {
    port: number;
  };
}

export const DEFAULT_CONFIG: AutomechConfig = {
  pipeline: {
    maxIterations: 20,
    sandboxTimeoutMs: 15000,
    dockerMemoryMb: 512,
    dockerCpus: 1.0,
  },
  manufacturing: {
    buildVolume: [256, 256, 256],
    maxOverhangPercent: 15,
    defaultMaterial: 'PETG',
  },
  llm: {
    provider: 'openrouter',
    model: 'deepseek/deepseek-chat',
    temperature: 0.1,
  },
  slicer: {
    preferredBinary: 'prusa-slicer',
    timeoutMs: 60000,
  },
  api: {
    port: 3000,
  },
};
