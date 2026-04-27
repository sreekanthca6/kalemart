"""
SRE Agent tool implementations — each function maps to a Claude tool.
"""
import asyncio, os, subprocess
import httpx

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus-server.observability.svc.cluster.local:80")
DATABASE_URL   = os.getenv("DATABASE_URL", "")
NAMESPACE      = os.getenv("K8S_NAMESPACE", "kalemart")


# ── Prometheus ─────────────────────────────────────────────────────────────────

async def query_prometheus(query: str, time_range_minutes: int = 30) -> dict:
    """Run a PromQL instant or range query and return results."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query})
            data = r.json()
            results = data.get("data", {}).get("result", [])
            if not results:
                return {"status": "no_data", "query": query, "results": []}
            formatted = []
            for item in results[:10]:  # cap at 10 series
                labels = item.get("metric", {})
                value  = item.get("value", [None, "N/A"])[1]
                formatted.append({"labels": labels, "value": value})
            return {"status": "ok", "query": query, "results": formatted}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Kubernetes ─────────────────────────────────────────────────────────────────

def _kubectl(*args) -> str:
    try:
        result = subprocess.run(
            ["kubectl", *args],
            capture_output=True, text=True, timeout=30
        )
        return (result.stdout + result.stderr).strip()[:3000]
    except Exception as e:
        return f"kubectl error: {e}"


async def get_pod_logs(pod_prefix: str, lines: int = 50) -> dict:
    """Get recent logs from a pod matching the prefix."""
    pods_out = _kubectl("get", "pods", "-n", NAMESPACE, "--no-headers", "-o", "custom-columns=NAME:.metadata.name")
    matching = [p for p in pods_out.splitlines() if pod_prefix in p]
    if not matching:
        return {"status": "not_found", "pod_prefix": pod_prefix}
    pod = matching[0]
    logs = _kubectl("logs", "-n", NAMESPACE, pod, f"--tail={lines}")
    return {"status": "ok", "pod": pod, "logs": logs}


async def get_k8s_events(namespace: str = None) -> dict:
    """Get recent Kubernetes warning events."""
    ns = namespace or NAMESPACE
    out = _kubectl("get", "events", "-n", ns, "--sort-by=.lastTimestamp",
                   "--field-selector=type=Warning", "--no-headers")
    lines = out.splitlines()[-20:]  # last 20 warnings
    return {"status": "ok", "namespace": ns, "events": "\n".join(lines) or "No warnings"}


async def get_pod_status() -> dict:
    """Get current pod status in the kalemart namespace."""
    out = _kubectl("get", "pods", "-n", NAMESPACE, "-o", "wide")
    return {"status": "ok", "output": out}


async def restart_deployment(deployment: str) -> dict:
    """Rolling restart a deployment (requires approval)."""
    out = _kubectl("rollout", "restart", f"deployment/{deployment}", "-n", NAMESPACE)
    status = _kubectl("rollout", "status", f"deployment/{deployment}", "-n", NAMESPACE, "--timeout=60s")
    return {"status": "ok", "restart_output": out, "rollout_status": status}


async def get_deployment_history(deployment: str) -> dict:
    """Get rollout history for a deployment."""
    out = _kubectl("rollout", "history", f"deployment/{deployment}", "-n", NAMESPACE)
    return {"status": "ok", "history": out}


# ── Database ───────────────────────────────────────────────────────────────────

async def run_db_diagnostic(sql: str) -> dict:
    """Run a diagnostic SQL query (read-only: EXPLAIN ANALYZE, pg_stat_*, etc)."""
    # Safety: only allow read-only statements
    normalized = sql.strip().upper()
    allowed_prefixes = ("EXPLAIN", "SELECT", "SHOW", "WITH")
    if not any(normalized.startswith(p) for p in allowed_prefixes):
        return {"status": "blocked", "reason": "Only read-only queries allowed via this tool"}
    try:
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            rows = await conn.fetch(sql)
            result = [dict(r) for r in rows[:50]]
            return {"status": "ok", "rows": result, "count": len(result)}
        finally:
            await conn.close()
    except Exception as e:
        return {"status": "error", "error": str(e)}


async def create_db_index(sql: str) -> dict:
    """Create a database index (requires approval). Must be a CREATE INDEX statement."""
    if not sql.strip().upper().startswith("CREATE INDEX"):
        return {"status": "blocked", "reason": "Only CREATE INDEX statements allowed"}
    try:
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            await conn.execute(sql)
            return {"status": "ok", "sql": sql}
        finally:
            await conn.close()
    except Exception as e:
        return {"status": "error", "error": str(e)}


async def run_db_analyze(table: str) -> dict:
    """Run ANALYZE on a table to update query planner statistics."""
    allowed = {"orders", "order_items", "products", "expenses", "tax_periods"}
    if table not in allowed:
        return {"status": "blocked", "reason": f"Table {table} not in allowed list"}
    try:
        import asyncpg
        conn = await asyncpg.connect(DATABASE_URL)
        try:
            await conn.execute(f"ANALYZE {table}")
            return {"status": "ok", "table": table, "message": "Statistics updated"}
        finally:
            await conn.close()
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Tool registry ──────────────────────────────────────────────────────────────

# Maps tool name → (function, requires_approval)
TOOL_REGISTRY = {
    "query_prometheus":     (query_prometheus,     False),
    "get_pod_logs":         (get_pod_logs,         False),
    "get_k8s_events":       (get_k8s_events,       False),
    "get_pod_status":       (get_pod_status,       False),
    "get_deployment_history": (get_deployment_history, False),
    "run_db_diagnostic":    (run_db_diagnostic,    False),
    "restart_deployment":   (restart_deployment,   True),   # ← needs approval
    "create_db_index":      (create_db_index,      True),   # ← needs approval
    "run_db_analyze":       (run_db_analyze,       False),
}


# Claude tool definitions (passed to the API)
TOOL_DEFINITIONS = [
    {
        "name": "query_prometheus",
        "description": "Run a PromQL query against Prometheus to fetch metrics. Use this to check latency, error rates, request counts, pod restarts, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "PromQL expression"},
                "time_range_minutes": {"type": "integer", "description": "Look-back window in minutes", "default": 30}
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_pod_logs",
        "description": "Fetch recent logs from a pod. Use pod name prefix like 'kalemart-backend', 'kalemart-ai-service'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pod_prefix": {"type": "string", "description": "Pod name prefix"},
                "lines": {"type": "integer", "description": "Number of log lines", "default": 50}
            },
            "required": ["pod_prefix"]
        }
    },
    {
        "name": "get_k8s_events",
        "description": "Get recent Kubernetes warning events — useful for detecting OOMKill, BackOff, FailedScheduling etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "namespace": {"type": "string", "description": "Kubernetes namespace (default: kalemart)"}
            }
        }
    },
    {
        "name": "get_pod_status",
        "description": "Get the current status of all pods in the kalemart namespace.",
        "input_schema": {"type": "object", "properties": {}}
    },
    {
        "name": "get_deployment_history",
        "description": "Get rollout history for a deployment to check if a recent deploy caused the issue.",
        "input_schema": {
            "type": "object",
            "properties": {
                "deployment": {"type": "string", "description": "Deployment name e.g. kalemart-backend"}
            },
            "required": ["deployment"]
        }
    },
    {
        "name": "run_db_diagnostic",
        "description": "Run a read-only SQL query for diagnostics: EXPLAIN ANALYZE, SELECT from pg_stat_activity, pg_indexes, pg_stats etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "Read-only SQL (EXPLAIN, SELECT, WITH only)"}
            },
            "required": ["sql"]
        }
    },
    {
        "name": "restart_deployment",
        "description": "Trigger a rolling restart of a deployment. REQUIRES APPROVAL. Use when pod is crash-looping or stuck.",
        "input_schema": {
            "type": "object",
            "properties": {
                "deployment": {"type": "string", "description": "Deployment name e.g. kalemart-backend"}
            },
            "required": ["deployment"]
        }
    },
    {
        "name": "create_db_index",
        "description": "Create a PostgreSQL index. REQUIRES APPROVAL. Use when EXPLAIN ANALYZE reveals a missing index causing slow queries.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string", "description": "CREATE INDEX IF NOT EXISTS ... statement"}
            },
            "required": ["sql"]
        }
    },
    {
        "name": "run_db_analyze",
        "description": "Run ANALYZE on a table to refresh query planner statistics. Safe, no approval needed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "table": {"type": "string", "description": "Table name: orders, order_items, products, expenses, tax_periods"}
            },
            "required": ["table"]
        }
    },
]
