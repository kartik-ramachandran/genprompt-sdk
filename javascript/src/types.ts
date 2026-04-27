export interface GenPromptConfig {
  apiKey: string
  baseUrl?: string
  /** Default cache TTL in seconds (0 = disabled). Default: 60 */
  defaultCacheTtl?: number
}

export interface Prompt {
  id: string
  name: string
  content: string
  category: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface Persona {
  id: number
  name: string
  systemPrompt: string
  description: string
  tone: string
  expertise: string
}

export interface GenerateOptions {
  selectedGoals?: string[]
  additionalContext?: string
}

export interface TestOptions {
  userInput?: string
}

export interface FetchOptions {
  /** Cache TTL in seconds. 0 = always fetch fresh. Default: uses client default. */
  cacheTtl?: number
}

export interface GeneratedPrompt {
  prompt: string
}

export interface ChainResult {
  finalOutput: string
  steps: unknown[]
}
