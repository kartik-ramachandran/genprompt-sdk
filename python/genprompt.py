"""GenPrompt Python SDK — prompt caching with stale-while-revalidate."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

_BASE_URL = "https://gen-prompt.me/api/external"
_DEFAULT_TTL = 60


# ── Cache ─────────────────────────────────────────────────────────────────────

@dataclass
class _Entry:
    value: Any
    expires_at: float
    revalidating: bool = False

    @property
    def stale(self) -> bool:
        return time.monotonic() > self.expires_at


class _Cache:
    def __init__(self) -> None:
        self._store: dict[str, _Entry] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[_Entry]:
        with self._lock:
            return self._store.get(key)

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            self._store[key] = _Entry(value=value, expires_at=time.monotonic() + ttl)

    def mark_revalidating(self, key: str) -> None:
        with self._lock:
            if key in self._store:
                self._store[key].revalidating = True

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


# ── Client ────────────────────────────────────────────────────────────────────

class GenPromptClient:
    """
    Official GenPrompt client with stale-while-revalidate caching.

    Args:
        api_key: Your ``pk_live_...`` key from gen-prompt.me → Settings → API Keys
        base_url: Override for self-hosted deployments
        default_cache_ttl: Seconds to cache responses (0 = disabled, default 60)

    Example::

        from genprompt import GenPromptClient

        gp = GenPromptClient(api_key="pk_live_...")
        prompt = gp.prompts.get("my-prompt-id")
        print(prompt["content"])
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = _BASE_URL,
        default_cache_ttl: int = _DEFAULT_TTL,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"X-GenPrompt-Header": api_key, "Content-Type": "application/json"}
        self._default_ttl = default_cache_ttl
        self._cache = _Cache()
        self._http = httpx.Client(headers=self._headers, timeout=30)

        self.prompts = _PromptResource(self)
        self.personas = _PersonaResource(self)
        self.chains = _ChainResource(self)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _get(self, path: str) -> Any:
        res = self._http.get(f"{self._base_url}{path}")
        res.raise_for_status()
        return res.json()

    def _post(self, path: str, body: dict) -> Any:
        res = self._http.post(f"{self._base_url}{path}", json=body)
        res.raise_for_status()
        return res.json()

    def _cached_get(self, key: str, fetcher, ttl: int) -> Any:
        if ttl == 0:
            return fetcher()

        entry = self._cache.get(key)

        if entry:
            if entry.stale and not entry.revalidating:
                self._cache.mark_revalidating(key)

                def _refresh():
                    try:
                        self._cache.set(key, fetcher(), ttl)
                    except Exception:
                        self._cache.delete(key)

                threading.Thread(target=_refresh, daemon=True).start()
            return entry.value

        value = fetcher()
        self._cache.set(key, value, ttl)
        return value

    def clear_cache(self) -> None:
        """Clear all locally cached prompts and personas."""
        self._cache.clear()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self._http.close()


# ── Resources ─────────────────────────────────────────────────────────────────

class _PromptResource:
    def __init__(self, client: GenPromptClient) -> None:
        self._c = client

    def list(self, *, folder: str = "", cache_ttl: Optional[int] = None) -> list[dict]:
        """
        List all prompts, optionally filtered by folder prefix.

        Args:
            folder: Slash-prefixed folder name, e.g. ``"marketing/"``
            cache_ttl: Override TTL in seconds (0 = always fresh)
        """
        ttl = self._c._default_ttl if cache_ttl is None else cache_ttl
        key = f"prompts:list:{folder}"
        all_prompts: list[dict] = self._c._cached_get(
            key, lambda: self._c._get("/prompts"), ttl
        )
        return [p for p in all_prompts if p["name"].startswith(folder)] if folder else all_prompts

    def get(self, prompt_id: str, *, cache_ttl: Optional[int] = None) -> dict:
        """
        Fetch a single prompt by ID.

        Args:
            prompt_id: UUID of the prompt
            cache_ttl: Seconds to cache this prompt (0 = always fresh, default 60)

        Example::

            prompt = gp.prompts.get("abc-123", cache_ttl=300)
        """
        ttl = self._c._default_ttl if cache_ttl is None else cache_ttl
        return self._c._cached_get(
            f"prompts:{prompt_id}",
            lambda: self._c._get(f"/prompts/{prompt_id}"),
            ttl,
        )

    def generate(
        self,
        intent: str,
        *,
        selected_goals: Optional[list[str]] = None,
        additional_context: str = "",
    ) -> dict:
        """
        Generate a new prompt from plain-language intent. Not cached.

        Example::

            result = gp.prompts.generate(
                "Summarise legal documents",
                selected_goals=["be concise", "use bullet points"],
            )
            print(result["prompt"])
        """
        return self._c._post("/prompts/generate", {
            "intent": intent,
            "selectedGoals": selected_goals or [],
            "additionalContext": additional_context,
        })

    def test(self, prompt_content: str, *, user_input: str = "") -> dict:
        """Run a prompt through AI and return the response."""
        return self._c._post("/prompts/test", {
            "promptContent": prompt_content,
            "userInput": user_input,
        })


class _PersonaResource:
    def __init__(self, client: GenPromptClient) -> None:
        self._c = client

    def list(self, *, cache_ttl: Optional[int] = None) -> list[dict]:
        ttl = self._c._default_ttl if cache_ttl is None else cache_ttl
        return self._c._cached_get("personas:list", lambda: self._c._get("/personas"), ttl)


class _ChainResource:
    def __init__(self, client: GenPromptClient) -> None:
        self._c = client

    def execute(self, chain_id: int, input_text: str = "") -> dict:
        """Execute a prompt chain with an input."""
        return self._c._post(f"/chains/{chain_id}/execute", {"input": input_text})
