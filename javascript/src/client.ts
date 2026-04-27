import { PromptCache } from './cache'
import type {
  GenPromptConfig, Prompt, Persona, FetchOptions,
  GenerateOptions, TestOptions, GeneratedPrompt, ChainResult,
} from './types'

const DEFAULT_BASE_URL = 'https://gen-prompt.me/api/external'
const DEFAULT_CACHE_TTL = 60

export class GenPromptClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly defaultCacheTtl: number
  private cache = new PromptCache()

  readonly prompts: PromptResource
  readonly personas: PersonaResource
  readonly chains: ChainResource

  constructor(config: GenPromptConfig) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.headers = { 'X-GenPrompt-Header': config.apiKey, 'Content-Type': 'application/json' }
    this.defaultCacheTtl = config.defaultCacheTtl ?? DEFAULT_CACHE_TTL

    this.prompts = new PromptResource(this)
    this.personas = new PersonaResource(this)
    this.chains = new ChainResource(this)
  }

  /** @internal */
  async _fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status))
      throw new Error(`GenPrompt API error ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  /** @internal */
  async _cachedGet<T>(cacheKey: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
    if (ttl === 0) return fetcher()

    const cached = this.cache.get<T>(cacheKey)

    if (cached) {
      // Stale-while-revalidate: serve stale immediately, refresh in background
      if (cached.stale && !this.cache.isRevalidating(cacheKey)) {
        this.cache.markRevalidating(cacheKey)
        fetcher()
          .then(v => this.cache.set(cacheKey, v, ttl))
          .catch(() => this.cache.delete(cacheKey))
      }
      return cached.value
    }

    const value = await fetcher()
    this.cache.set(cacheKey, value, ttl)
    return value
  }

  /** Clear the local prompt cache. */
  clearCache(): void {
    this.cache.clear()
  }
}

class PromptResource {
  constructor(private client: GenPromptClient) {}

  /**
   * List all prompts. Optionally filter by folder prefix (e.g. `"marketing/"`)
   * using the same slash-naming convention as in GenPrompt.
   */
  async list(options: FetchOptions & { folder?: string } = {}): Promise<Prompt[]> {
    const ttl = options.cacheTtl ?? (this.client as any).defaultCacheTtl
    const folder = options.folder ?? ''
    const key = `prompts:list:${folder}`
    const all = await (this.client as any)._cachedGet<Prompt[]>(
      key,
      () => (this.client as any)._fetch<Prompt[]>('/prompts'),
      ttl,
    )
    return folder ? all.filter(p => p.name.startsWith(folder)) : all
  }

  /**
   * Fetch a single prompt by ID with optional caching.
   * @example
   * const prompt = await gp.prompts.get('abc-123', { cacheTtl: 300 })
   */
  async get(id: string, options: FetchOptions = {}): Promise<Prompt> {
    const ttl = options.cacheTtl ?? (this.client as any).defaultCacheTtl
    return (this.client as any)._cachedGet<Prompt>(
      `prompts:${id}`,
      () => (this.client as any)._fetch<Prompt>(`/prompts/${id}`),
      ttl,
    )
  }

  /**
   * Generate a new prompt from a plain-language intent.
   * Results are not cached (every call produces a new prompt).
   */
  async generate(intent: string, options: GenerateOptions = {}): Promise<GeneratedPrompt> {
    return (this.client as any)._fetch<GeneratedPrompt>('/prompts/generate', {
      method: 'POST',
      body: JSON.stringify({
        intent,
        selectedGoals: options.selectedGoals ?? [],
        additionalContext: options.additionalContext ?? '',
      }),
    })
  }

  /**
   * Run a prompt through AI and return the response.
   */
  async test(promptContent: string, options: TestOptions = {}): Promise<unknown> {
    return (this.client as any)._fetch<unknown>('/prompts/test', {
      method: 'POST',
      body: JSON.stringify({ promptContent, userInput: options.userInput ?? '' }),
    })
  }
}

class PersonaResource {
  constructor(private client: GenPromptClient) {}

  async list(options: FetchOptions = {}): Promise<Persona[]> {
    const ttl = options.cacheTtl ?? (this.client as any).defaultCacheTtl
    return (this.client as any)._cachedGet<Persona[]>(
      'personas:list',
      () => (this.client as any)._fetch<Persona[]>('/personas'),
      ttl,
    )
  }
}

class ChainResource {
  constructor(private client: GenPromptClient) {}

  async execute(chainId: number, input: string): Promise<ChainResult> {
    return (this.client as any)._fetch<ChainResult>(`/chains/${chainId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
  }
}
