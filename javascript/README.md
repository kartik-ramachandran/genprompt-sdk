# genprompt-sdk — JavaScript / TypeScript SDK

Official SDK for [GenPrompt](https://gen-prompt.me) with **built-in prompt caching** (stale-while-revalidate).

## Install

```bash
npm install genprompt-sdk
```

## Quick start

```ts
import { GenPromptClient } from 'genprompt-sdk'

const gp = new GenPromptClient({
  apiKey: 'pk_live_...',        // Settings → API Keys on gen-prompt.me
  defaultCacheTtl: 120,         // seconds (0 = always fresh, default 60)
})

// Fetch a prompt — served from cache after first call
const prompt = await gp.prompts.get('your-prompt-id')
console.log(prompt.content)
```

## Caching

Prompts are cached locally using a **stale-while-revalidate** strategy:

- Fresh entry → returned instantly, no network call
- Stale entry → returned instantly, refreshed in the background
- First fetch → fetched from API, then cached

```ts
// Per-call TTL override
const prompt = await gp.prompts.get('id', { cacheTtl: 300 })   // 5 min
const fresh  = await gp.prompts.get('id', { cacheTtl: 0 })     // always fresh

// Clear all cached data
gp.clearCache()
```

## Folders

Organise prompts in GenPrompt using slash-prefixed names:
`marketing/email-subject`, `support/reply-template`, etc.

Then filter by folder in the SDK:

```ts
const marketingPrompts = await gp.prompts.list({ folder: 'marketing/' })
```

## API Reference

### `gp.prompts.list(options?)`
Returns all prompts, optionally filtered by folder prefix.

### `gp.prompts.get(id, options?)`
Fetches a single prompt by ID. Cached by default.

### `gp.prompts.generate(intent, options?)`
Generates a new prompt from plain-language intent. Not cached.

```ts
const { prompt } = await gp.prompts.generate('Summarise legal documents', {
  selectedGoals: ['be concise', 'use bullet points'],
})
```

### `gp.prompts.test(content, options?)`
Runs a prompt through AI and returns the response.

```ts
const response = await gp.prompts.test(prompt.content, { userInput: 'Hello' })
```

### `gp.personas.list(options?)`
Returns all personas.

### `gp.chains.execute(chainId, input)`
Executes a prompt chain.

## Usage with LangChain

```ts
import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { GenPromptClient } from 'genprompt-sdk'

const gp = new GenPromptClient({ apiKey: process.env.GENPROMPT_API_KEY! })
const { content } = await gp.prompts.get('my-prompt-id')

const chain = ChatPromptTemplate.fromTemplate(content).pipe(new ChatOpenAI())
const result = await chain.invoke({ input: 'Summarise this...' })
```

## Usage in GitHub Copilot / VS Code extension

See [`../github-copilot/`](../github-copilot/) for the VS Code extension that surfaces GenPrompt prompts inside Copilot Chat.
