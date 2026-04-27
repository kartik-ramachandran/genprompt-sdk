# genprompt — Python SDK

Official Python SDK for [GenPrompt](https://gen-prompt.me) with **thread-safe caching** and stale-while-revalidate.

## Install

```bash
pip install genprompt
```

Or directly from the repo:
```bash
pip install httpx
cp genprompt.py your_project/
```

## Quick start

```python
from genprompt import GenPromptClient

gp = GenPromptClient(
    api_key="pk_live_...",   # Settings → API Keys on gen-prompt.me
    default_cache_ttl=120,   # seconds (0 = always fresh, default 60)
)

# Fetched from API on first call, from cache after that
prompt = gp.prompts.get("your-prompt-id")
print(prompt["content"])
```

## Caching

Prompts are cached in memory using a **stale-while-revalidate** strategy:
- Fresh → returned instantly
- Stale → returned instantly, refreshed on a background thread
- Miss → fetched, then cached

```python
# Per-call TTL override
prompt = gp.prompts.get("id", cache_ttl=300)   # 5 min
fresh  = gp.prompts.get("id", cache_ttl=0)     # always fresh

# Clear everything
gp.clear_cache()
```

## Folders

Name prompts with slashes in GenPrompt (`marketing/email`, `support/reply`) and filter by folder:

```python
marketing = gp.prompts.list(folder="marketing/")
```

## API Reference

### `gp.prompts.list(folder="", cache_ttl=None)`
### `gp.prompts.get(id, cache_ttl=None)`
### `gp.prompts.generate(intent, selected_goals=None, additional_context="")`

```python
result = gp.prompts.generate(
    "Summarise legal documents",
    selected_goals=["be concise", "use bullet points"],
)
print(result["prompt"])
```

### `gp.prompts.test(prompt_content, user_input="")`
### `gp.personas.list(cache_ttl=None)`
### `gp.chains.execute(chain_id, input_text="")`

## Use as context manager

```python
with GenPromptClient(api_key="pk_live_...") as gp:
    prompt = gp.prompts.get("id")
```

## Usage with LangChain

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from genprompt import GenPromptClient

gp = GenPromptClient(api_key=os.environ["GENPROMPT_API_KEY"])
data = gp.prompts.get("my-prompt-id")

chain = ChatPromptTemplate.from_template(data["content"]) | ChatOpenAI()
result = chain.invoke({"input": "Summarise this contract..."})
```

## Publish to PyPI

```bash
pip install build twine
python -m build
twine upload dist/*
```
