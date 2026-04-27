# GenPrompt SDK

Official JavaScript/TypeScript and Python SDKs for [GenPrompt](https://gen-prompt.me) — fetch, generate, and cache AI prompts in your applications.

## Packages

| Package | Language | Install |
|---------|----------|---------|
| [`genprompt-sdk`](./javascript) | JavaScript / TypeScript | `npm install genprompt-sdk` |
| [`genprompt`](./python) | Python | `pip install genprompt` |

## Quick Start

### JavaScript / TypeScript

```typescript
import { GenPromptClient } from 'genprompt-sdk'

const client = new GenPromptClient({ apiKey: 'pk_live_...' })

const prompts = await client.prompts.list()
const generated = await client.prompts.generate({ intent: 'A code review assistant' })
const result = await client.chains.execute(chainId, { input: 'review this code' })
```

### Python

```python
from genprompt import GenPromptClient

client = GenPromptClient(api_key="pk_live_...")

prompts = client.prompts.list()
generated = client.prompts.generate(intent="A code review assistant")
result = client.chains.execute(chain_id, input="review this code")
```

## Authentication

Get your API key from [gen-prompt.me/settings](https://gen-prompt.me/settings).

## Links

- [Homepage](https://gen-prompt.me)
- [Documentation](https://gen-prompt.me/features)
- [Public Prompt Library](https://gen-prompt.me/library)
- [Issues](https://github.com/kartik-ramachandran/genprompt-sdk/issues)
