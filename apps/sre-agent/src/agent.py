"""
SRE Agent — uses Claude with tool_use to investigate, diagnose, and fix incidents.
"""
import asyncio, os, time, uuid
from anthropic import AsyncAnthropic
from . import slack_client as slack
from . import preferences
from .tools import TOOL_DEFINITIONS, TOOL_REGISTRY

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are an expert Site Reliability Engineer (SRE) for KaleMart24, a multi-tenant grocery store management platform running on Kubernetes with PostgreSQL.

Your job when an alert fires:
1. INVESTIGATE — use your tools to gather data: metrics, logs, events, DB diagnostics
2. DIAGNOSE — identify the root cause (not just symptoms)
3. FIX — apply the appropriate remediation. Always prefer safe fixes first
4. VALIDATE — confirm the fix worked by re-checking metrics
5. SUMMARIZE — produce a concise RCA with root cause, fix, impact, and prevention

Key architecture facts:
- Backend: Node.js/Express on port 4000, namespace=kalemart
- Frontend: Next.js on port 3000
- AI Service: Python FastAPI on port 5000
- Database: PostgreSQL (kalemart-postgres), uses RLS with tenant isolation
- All tables have tenant_id column with composite indexes: (tenant_id, created_at), (tenant_id, date)
- Prometheus: prometheus-server.observability.svc.cluster.local:80
- Tempo (traces): tempo.observability.svc.cluster.local:3200

Common issues and their signatures:
- Slow tax queries → missing composite index or random_page_cost too high
- 401 errors on AI endpoints → ANTHROPIC_API_KEY invalid or missing
- Pod crashloop → check logs for OOM or startup error
- High latency → check DB query plans with EXPLAIN ANALYZE

Rules:
- Never guess — always use tools to gather evidence before concluding
- For destructive actions (restart, create index), use the tool and the system will handle approval
- Be concise in your reasoning — no verbose explanations
- After fixing, ALWAYS validate with a metric query
- End with a structured RCA

Return your final RCA as JSON in a code block:
```json
{
  "root_cause": "...",
  "fix": "...",
  "impact": "...",
  "prevention": "...",
  "resolved": true
}
```
"""


class SREAgent:
    def __init__(self, pending_approvals: dict, approval_decisions: dict):
        self.client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        self.pending_approvals = pending_approvals
        self.approval_decisions = approval_decisions

    async def _wait_for_approval(self, incident_id: str, action_type: str, description: str) -> bool:
        """Post approval request to Slack and wait up to 5 minutes for response."""
        # Check if this action type is pre-approved
        if preferences.is_auto_approved(action_type):
            await slack.post_investigation_update(incident_id, f"Auto-approved `{action_type}` (don't-ask-again is set)")
            return True

        event = asyncio.Event()
        self.pending_approvals[incident_id] = event
        self.approval_decisions.pop(incident_id, None)

        await slack.post_approval_request(incident_id, action_type, description)

        try:
            await asyncio.wait_for(event.wait(), timeout=300)  # 5 min
        except asyncio.TimeoutError:
            await slack.post_investigation_update(incident_id, f"⏱️ Approval timed out for `{action_type}` — skipping")
            return False
        finally:
            self.pending_approvals.pop(incident_id, None)

        decision = self.approval_decisions.get(incident_id, {})
        approved = decision.get("approved", False)
        always   = decision.get("always", False)

        if approved and always:
            preferences.set_auto_approve(action_type)
            await slack.post_investigation_update(incident_id, f"🔓 `{action_type}` will be auto-approved in future incidents")

        return approved

    async def _execute_tool(self, incident_id: str, tool_name: str, tool_input: dict) -> str:
        fn, requires_approval = TOOL_REGISTRY.get(tool_name, (None, False))
        if fn is None:
            return f"Unknown tool: {tool_name}"

        if requires_approval:
            description = f"`{tool_name}` with params: `{tool_input}`"
            approved = await self._wait_for_approval(incident_id, tool_name, description)
            if not approved:
                return f"Action `{tool_name}` was rejected or timed out — skipping"

        await slack.post_investigation_update(incident_id, f"Running `{tool_name}`…")
        result = await fn(**tool_input)
        return str(result)

    async def investigate(self, alert: dict):
        incident_id = f"INC-{str(uuid.uuid4())[:6].upper()}"
        start_time  = time.time()

        alert_name  = alert.get("labels", {}).get("alertname", "Unknown")
        severity    = alert.get("labels", {}).get("severity", "warning")
        description = alert.get("annotations", {}).get("description", alert.get("annotations", {}).get("summary", "No description"))

        await slack.post_alert_received(incident_id, alert_name, description, severity)

        messages = [
            {
                "role": "user",
                "content": (
                    f"A Prometheus alert has fired. Investigate and resolve it.\n\n"
                    f"**Alert:** {alert_name}\n"
                    f"**Severity:** {severity}\n"
                    f"**Description:** {description}\n"
                    f"**Labels:** {alert.get('labels', {})}\n"
                    f"**Incident ID:** {incident_id}\n\n"
                    f"Start by gathering data, then diagnose, fix, validate, and produce an RCA."
                )
            }
        ]

        try:
            while True:
                response = await self.client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    tools=TOOL_DEFINITIONS,
                    messages=messages,
                )

                # Collect all text + tool calls from this response
                tool_results = []
                final_text   = ""

                for block in response.content:
                    if block.type == "text":
                        final_text = block.text
                    elif block.type == "tool_use":
                        result_str = await self._execute_tool(incident_id, block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": result_str,
                        })

                # Append assistant turn
                messages.append({"role": "assistant", "content": response.content})

                # If there were tool calls, feed results back
                if tool_results:
                    messages.append({"role": "user", "content": tool_results})
                    continue  # next loop iteration → Claude processes results

                # No more tool calls — done
                break

            # Parse RCA from the final text
            rca = self._parse_rca(final_text)
            duration_min = round((time.time() - start_time) / 60, 1)
            await slack.post_rca(incident_id, alert_name, duration_min, rca)

        except Exception as e:
            await slack.post_error(incident_id, str(e))
            raise

    def _parse_rca(self, text: str) -> dict:
        import json, re
        match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        return {
            "root_cause": "See Slack thread for full analysis",
            "fix": "Applied by SRE agent",
            "impact": "Unknown",
            "prevention": "Review runbook",
            "resolved": True,
        }
