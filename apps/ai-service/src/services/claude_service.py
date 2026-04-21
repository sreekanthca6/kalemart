import os
import anthropic
from opentelemetry import trace

tracer = trace.get_tracer("kalemart-ai-service")
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

# This large system prompt is sent with cache_control so it is only
# tokenised once per cache TTL (~5 min), keeping costs low.
SYSTEM_PROMPT = """You are Kalemart's AI inventory assistant for a convenience store.
Your role is to help store managers make smart decisions about:
- Stock levels and reorder points
- Product combo recommendations (items frequently bought together)
- Pricing and promotion suggestions
- Wastage reduction

Guidelines:
- Be concise and actionable — store managers are busy
- Always include specific quantities when suggesting reorders
- Flag urgent issues (out-of-stock, expiry risk) clearly
- Format lists with bullet points for readability
- Use British English (this is a UK convenience store)
"""

def ask(context: str, question: str) -> str:
    with tracer.start_as_current_span("claude.ask") as span:
        span.set_attribute("claude.model", "claude-sonnet-4-6")
        span.set_attribute("question.length", len(question))

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},  # prompt cache
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": f"Current inventory snapshot:\n{context}\n\nQuestion: {question}",
                }
            ],
        )
        result = message.content[0].text
        span.set_attribute("claude.input_tokens", message.usage.input_tokens)
        span.set_attribute("claude.output_tokens", message.usage.output_tokens)
        span.set_attribute("claude.cache_read_tokens", getattr(message.usage, "cache_read_input_tokens", 0))
        return result


def reorder_suggestions(items: list[dict]) -> str:
    with tracer.start_as_current_span("claude.reorder_suggestions") as span:
        span.set_attribute("claude.model", "claude-sonnet-4-6")
        span.set_attribute("items.count", len(items))

        items_text = "\n".join(
            f"- {i.get('product', {}).get('name', i.get('productId', '?'))}: "
            f"{i['quantity']} units (min: {i['minQuantity']}, location: {i['location']})"
            for i in items
        )

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        "The following products are at or below their minimum stock level:\n"
                        f"{items_text}\n\n"
                        "For each item, suggest: (1) reorder quantity, (2) priority (urgent/normal), "
                        "(3) any relevant notes (seasonal demand, shelf life, etc.)."
                    ),
                }
            ],
        )
        result = message.content[0].text
        span.set_attribute("claude.input_tokens", message.usage.input_tokens)
        span.set_attribute("claude.output_tokens", message.usage.output_tokens)
        span.set_attribute("claude.cache_read_tokens", getattr(message.usage, "cache_read_input_tokens", 0))
        return result


def combo_recommendations(product_ids: list[str]) -> str:
    with tracer.start_as_current_span("claude.combo_recommendations") as span:
        span.set_attribute("claude.model", "claude-sonnet-4-6")

        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"A customer is buying products with IDs: {', '.join(product_ids)}.\n"
                        "Suggest 3 complementary products they might also want, "
                        "common in UK convenience stores. Include reason for each."
                    ),
                }
            ],
        )
        result = message.content[0].text
        span.set_attribute("claude.input_tokens", message.usage.input_tokens)
        span.set_attribute("claude.output_tokens", message.usage.output_tokens)
        return result
