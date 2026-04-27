"""
Stores "don't ask me again" preferences per action type.
Persisted to /tmp/sre_prefs.json inside the pod.
"""
import json, os

PREFS_FILE = os.getenv("PREFS_FILE", "/tmp/sre_prefs.json")

_cache: dict[str, bool] = {}


def _load() -> dict[str, bool]:
    global _cache
    try:
        with open(PREFS_FILE) as f:
            _cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _cache = {}
    return _cache


def _save():
    with open(PREFS_FILE, "w") as f:
        json.dump(_cache, f, indent=2)


def is_auto_approved(action_type: str) -> bool:
    _load()
    return _cache.get(action_type, False)


def set_auto_approve(action_type: str):
    _load()
    _cache[action_type] = True
    _save()


def list_preferences() -> dict[str, bool]:
    return _load()
