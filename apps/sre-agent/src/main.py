"""
SRE Agent — FastAPI entrypoint.
Endpoints:
  POST /webhook/alertmanager  ← Alertmanager fires here
  GET  /approve/{id}          ← User approves a pending action
  GET  /reject/{id}           ← User rejects a pending action
  GET  /health
  GET  /preferences           ← See what's auto-approved
"""
import asyncio, os, logging, traceback
from fastapi import FastAPI, BackgroundTasks, Request
from fastapi.responses import HTMLResponse, JSONResponse
from .agent import SREAgent
from . import preferences as prefs

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("sre-agent")

app = FastAPI(title="Kalemart SRE Agent", version="1.0.0")

# Shared state for approval flow
pending_approvals: dict[str, asyncio.Event] = {}
approval_decisions: dict[str, dict]         = {}


def _agent() -> SREAgent:
    return SREAgent(pending_approvals=pending_approvals, approval_decisions=approval_decisions)


async def _safe_investigate(agent: SREAgent, alert: dict):
    """Wrapper that logs any unhandled exception from the background investigation."""
    try:
        await agent.investigate(alert)
    except Exception:
        logger.error("Unhandled exception in investigate:\n%s", traceback.format_exc())


# ── Alertmanager webhook ───────────────────────────────────────────────────────

@app.post("/webhook/alertmanager")
async def alertmanager_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    fired = [a for a in payload.get("alerts", []) if a.get("status") == "firing"]
    for alert in fired:
        background_tasks.add_task(_safe_investigate, _agent(), alert)
    return {"received": len(fired)}


# ── Manual trigger (for demos) ─────────────────────────────────────────────────

@app.post("/trigger")
async def manual_trigger(request: Request, background_tasks: BackgroundTasks):
    """Manually fire a synthetic alert — useful for demos."""
    body = await request.json()
    alert = {
        "status": "firing",
        "labels": {
            "alertname": body.get("alertname", "ManualTest"),
            "severity":  body.get("severity", "warning"),
            "service":   body.get("service", "backend"),
        },
        "annotations": {
            "summary":     body.get("summary", "Manual test alert"),
            "description": body.get("description", "Triggered manually for testing"),
        }
    }
    background_tasks.add_task(_safe_investigate, _agent(), alert)
    logger.info("Manual trigger: %s", alert["labels"]["alertname"])
    return {"status": "triggered", "alert": alert["labels"]["alertname"]}


# ── Approval endpoints ─────────────────────────────────────────────────────────

@app.get("/approve/{incident_id}", response_class=HTMLResponse)
async def approve_action(incident_id: str, action_type: str = "", always: bool = False):
    if incident_id in pending_approvals:
        approval_decisions[incident_id] = {"approved": True, "always": always}
        pending_approvals[incident_id].set()
        msg = "✅ Action approved" + (" and will be auto-approved in future." if always else ".")
    else:
        msg = "⚠️ No pending action found for this incident (may have already timed out)."
    return HTMLResponse(f"""
    <html><body style="font-family:sans-serif;padding:40px;background:#f0faf4">
    <h2 style="color:#1b8a5f">{msg}</h2>
    <p>You can close this tab. The SRE agent will continue.</p>
    </body></html>""")


@app.get("/reject/{incident_id}", response_class=HTMLResponse)
async def reject_action(incident_id: str):
    if incident_id in pending_approvals:
        approval_decisions[incident_id] = {"approved": False, "always": False}
        pending_approvals[incident_id].set()
        msg = "❌ Action rejected."
    else:
        msg = "⚠️ No pending action found (may have already timed out)."
    return HTMLResponse(f"""
    <html><body style="font-family:sans-serif;padding:40px;background:#fff0ef">
    <h2 style="color:#ff3b30">{msg}</h2>
    <p>You can close this tab. The SRE agent will skip this action.</p>
    </body></html>""")


# ── Info endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "sre-agent"}


@app.get("/preferences")
async def get_preferences():
    return {"auto_approved_actions": prefs.list_preferences()}


@app.delete("/preferences/{action_type}")
async def reset_preference(action_type: str):
    p = prefs.list_preferences()
    p.pop(action_type, None)
    import json
    with open(os.getenv("PREFS_FILE", "/tmp/sre_prefs.json"), "w") as f:
        json.dump(p, f)
    return {"status": "reset", "action_type": action_type}
