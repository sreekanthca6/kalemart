"""
Slack client — posts incident updates and approval requests via incoming webhook.
Approval is handled by the user clicking a URL served by the SRE agent itself.
"""
import httpx, os

WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
AGENT_EXTERNAL_URL = os.getenv("AGENT_EXTERNAL_URL", "http://kalemart.local/sre")


async def _post(blocks: list, text: str = "SRE Agent"):
    if not WEBHOOK_URL:
        return
    async with httpx.AsyncClient() as client:
        await client.post(WEBHOOK_URL, json={"text": text, "blocks": blocks}, timeout=10)


async def post_alert_received(incident_id: str, alert_name: str, description: str, severity: str):
    color = "#ff3b30" if severity == "critical" else "#ff9f0a"
    emoji = "🔴" if severity == "critical" else "🟡"
    await _post([
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"{emoji} Incident {incident_id} — {alert_name}"}
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Description:* {description}\n*Severity:* `{severity}`\n*Status:* 🔍 Investigating…"}
        },
        {"type": "divider"}
    ], text=f"{emoji} {alert_name} — investigating")


async def post_investigation_update(incident_id: str, finding: str):
    await _post([
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*[{incident_id}]* 🔍 {finding}"}
        }
    ], text=f"[{incident_id}] {finding}")


async def post_approval_request(incident_id: str, action_type: str, action_description: str) -> str:
    approve_url = f"{AGENT_EXTERNAL_URL}/approve/{incident_id}?action_type={action_type}"
    reject_url  = f"{AGENT_EXTERNAL_URL}/reject/{incident_id}"
    always_url  = f"{AGENT_EXTERNAL_URL}/approve/{incident_id}?action_type={action_type}&always=true"

    await _post([
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*[{incident_id}]* ⚠️ *Approval Required*\n\n*Action:* `{action_type}`\n*Details:* {action_description}"}
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (
                    f"• ✅ *Approve once:* <{approve_url}|Click here>\n"
                    f"• 🔓 *Approve & don't ask again:* <{always_url}|Click here>\n"
                    f"• ❌ *Reject:* <{reject_url}|Click here>\n\n"
                    f"_Waiting up to 5 minutes…_"
                )
            }
        }
    ], text=f"[{incident_id}] Approval needed for {action_type}")

    return approve_url


async def post_fix_applied(incident_id: str, action: str, before: str, after: str):
    await _post([
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": (
                f"*[{incident_id}]* ✅ *Fix Applied*\n"
                f"*Action:* {action}\n"
                f"*Before:* `{before}`\n"
                f"*After:* `{after}`"
            )}
        }
    ], text=f"[{incident_id}] Fix applied: {action}")


async def post_rca(incident_id: str, alert_name: str, duration_min: int, rca: dict):
    await _post([
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"📋 RCA — {incident_id}"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Alert:*\n{alert_name}"},
                {"type": "mrkdwn", "text": f"*Duration:*\n{duration_min} min"},
                {"type": "mrkdwn", "text": f"*Root Cause:*\n{rca.get('root_cause', 'N/A')}"},
                {"type": "mrkdwn", "text": f"*Fix:*\n{rca.get('fix', 'N/A')}"},
            ]
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*Impact:* {rca.get('impact', 'N/A')}\n*Prevention:* {rca.get('prevention', 'N/A')}"}
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"_Status: {'✅ Resolved' if rca.get('resolved') else '⚠️ Partially mitigated'}_"}
        }
    ], text=f"RCA complete — {incident_id}")


async def post_error(incident_id: str, message: str):
    await _post([
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*[{incident_id}]* ❌ Agent error: {message}"}
        }
    ], text=f"[{incident_id}] Agent error")
