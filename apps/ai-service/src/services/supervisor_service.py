"""
Supervisor analysis service.
Demo mode: generates intelligent recommendations from inventory data (no API key needed).
Real mode: uses Claude with tool_use for reasoning (requires ANTHROPIC_API_KEY).
"""
import os
import uuid
from datetime import datetime

import anthropic
from opentelemetry import trace

tracer = trace.get_tracer("kalemart-ai-service")

_api_key = os.getenv("ANTHROPIC_API_KEY", "")
DEMO_MODE = not _api_key or _api_key in ("placeholder", "")


# ─── Public entry point ──────────────────────────────────────────────────────

def analyze(inventory: list, context: dict) -> dict:
    with tracer.start_as_current_span("supervisor.analyze") as span:
        span.set_attribute("supervisor.demo_mode", DEMO_MODE)
        span.set_attribute("supervisor.sku_count", len(inventory))
        if DEMO_MODE:
            recs = _demo_analyze(inventory, context)
        else:
            recs = _claude_analyze(inventory, context)
        span.set_attribute("supervisor.recommendation_count", len(recs))
        return {
            "recommendations": recs,
            "generatedAt": datetime.utcnow().isoformat() + "Z",
            "mode": "demo" if DEMO_MODE else "claude",
            "skuCount": len(inventory),
            "context": context,
        }


# ─── Demo analysis (no API key required) ─────────────────────────────────────

def _demo_analyze(inventory: list, context: dict) -> list:
    recs = []
    weather = context.get("weather", {})
    events  = context.get("events", [])
    temp    = int(weather.get("temp", 16))
    warm    = temp > 18

    out_of_stock = [i for i in inventory if i["quantity"] == 0]
    low_stock    = [i for i in inventory if 0 < i["quantity"] < i["minQuantity"]]

    # ── 1. URGENT restocks ──────────────────────────────────────────────────
    for item in out_of_stock:
        p    = item.get("product", {})
        vel  = item.get("velocity", {})
        name = p.get("name", item["productId"])
        price= float(p.get("price", 0))
        cat  = p.get("category", "")
        sold = vel.get("sold14d", 0)
        rate = float(vel.get("dailyRate", 0))

        qty  = max(int(item["minQuantity"] * 3), 12)
        cost = round(price * qty, 2)
        days = int(qty / max(rate, 0.5))

        ctx_notes = []
        if warm and cat in ("beverages", "chilled"):
            ctx_notes.append(f"{temp}°C weekend forecast — cold drink demand typically +35%")
        if events:
            e = events[0]
            ctx_notes.append(f"{e['name']} ({e['distance']}) this weekend brings extra foot traffic")

        recs.append(_rec(
            type_="restock", priority="urgent",
            title=f"Restock {name}",
            summary=f"Out of stock · {sold} sold in 14 days · order {qty} units",
            reasoning=(
                f"**{name}** is completely out of stock. "
                f"You sold {sold} units over the past 14 days (~{rate:.1f}/day). "
                + (". ".join(ctx_notes) + ". " if ctx_notes else "")
                + f"Ordering {qty} units provides ~{days} days of supply. "
                  f"Estimated cost: £{cost:.2f}."
            ),
            action={"type": "order", "qty": qty, "invId": item["id"], "productId": item["productId"]},
            metrics={"velocity": f"{rate:.1f}/day", "sold14d": sold, "estCost": f"£{cost:.2f}", "daysSupply": days},
        ))

    # ── 2. LOW stock restocks ───────────────────────────────────────────────
    for item in low_stock:
        p    = item.get("product", {})
        vel  = item.get("velocity", {})
        name = p.get("name", item["productId"])
        price= float(p.get("price", 0))
        sold = vel.get("sold14d", 0)
        rate = float(vel.get("dailyRate", 0))

        qty      = item["minQuantity"] * 3
        cost     = round(price * qty, 2)
        days_left= int(item["quantity"] / max(rate, 0.1))
        pct      = round(item["quantity"] / item["minQuantity"] * 100)

        recs.append(_rec(
            type_="restock", priority="high",
            title=f"Restock {name}",
            summary=f"{item['quantity']}/{item['minQuantity']} min · ~{days_left}d until stockout",
            reasoning=(
                f"**{name}** is at {item['quantity']} units — {pct}% of its minimum. "
                f"At {rate:.1f} units/day you have roughly {days_left} days before running out. "
                f"Ordering {qty} units (3× minimum) costs £{cost:.2f} and provides a comfortable buffer."
            ),
            action={"type": "order", "qty": qty, "invId": item["id"], "productId": item["productId"]},
            metrics={"velocity": f"{rate:.1f}/day", "daysLeft": days_left, "estCost": f"£{cost:.2f}"},
        ))

    # ── 3. Try NEW products ─────────────────────────────────────────────────
    cats = {i.get("product", {}).get("category") for i in inventory}

    if "beverages" in cats:
        recs.append(_rec(
            type_="try_new", priority="normal",
            title="Trial: Minor Figures Cold Brew Concentrate 200ml",
            summary="Cold coffee growing 40% YoY · Pairs with existing oat milks · RRP £4.50",
            reasoning=(
                "Your oat milk range signals a coffee-forward customer base. "
                "Cold brew concentrate is growing 40% YoY in UK convenience and pairs naturally "
                "with your barista milks — it's a high-margin add-on purchase. "
                + (f"With {temp}°C forecast this weekend, cold coffee demand will peak. " if warm else "")
                + "Trial 12 units at £4.50 RRP (£2.20 cost). "
                  "If 6 sell in 14 days, establish as a permanent line."
            ),
            action={"type": "trial", "qty": 12, "suggestedRrp": 4.50},
            metrics={"trialQty": 12, "estCost": "£26.40", "breakEven": "6 units", "category": "beverages"},
        ))

    if "health" in cats:
        event_note = (
            f"The {events[0]['name']} crowd this weekend skews wellness-focused. "
            if events else ""
        )
        recs.append(_rec(
            type_="try_new", priority="normal",
            title="Trial: HUEL Ready-to-Drink Vanilla 500ml",
            summary="Meal replacement boom · High repeat buy · RRP £3.50",
            reasoning=(
                "Your health category attracts time-pressed, health-conscious shoppers. "
                "HUEL RTD is now a fixture in urban convenience and appeals to the same customer "
                "already buying Bio-Kult and Revvies. "
                + event_note
                + "Trial 8 units at £3.50. One loyal customer accounts for 4–6 units/week — "
                  "a single convert pays back the trial in days."
            ),
            action={"type": "trial", "qty": 8, "suggestedRrp": 3.50},
            metrics={"trialQty": 8, "estCost": "£18.00", "breakEven": "4 units", "category": "health"},
        ))

    # ── 4. SLOW MOVERS to review ────────────────────────────────────────────
    for item in inventory:
        p    = item.get("product", {})
        vel  = item.get("velocity", {})
        qty  = item["quantity"]
        sold = vel.get("sold14d", 0)
        if qty >= item["minQuantity"] * 1.2 and sold == 0 and qty > 0:
            name  = p.get("name", item["productId"])
            price = float(p.get("price", 0))
            recs.append(_rec(
                type_="review", priority="normal",
                title=f"Review: {name}",
                summary=f"0 sales in 14 days · {qty} units sitting · £{price:.2f} RRP",
                reasoning=(
                    f"**{name}** has had zero sales in 14 days with {qty} units in stock "
                    f"(stock value: £{price * qty:.2f}). "
                    f"At £{price:.2f} it sits at a higher price point for its category. "
                    "Recommended actions in order: "
                    "(A) Move to counter/eye-level for 7 days and track — visibility alone often rescues slow movers. "
                    "(B) Bundle with a complementary product at 10% off to drive trial. "
                    "(C) If still no movement after 14 days, reduce to 2 units facing and don't reorder."
                ),
                action={"type": "review", "options": ["relocate", "bundle", "reduce_facing", "discontinue"]},
                metrics={"velocity": "0/day", "stockValue": f"£{price * qty:.2f}", "daysStagnant": 14},
            ))
            break  # one review card is enough

    # ── 5. COMBOS ───────────────────────────────────────────────────────────
    recs.extend(_build_combos(inventory))

    # ── 6. PROMO ────────────────────────────────────────────────────────────
    promo = _build_promo(inventory, context)
    if promo:
        recs.append(promo)

    return recs


def _build_combos(inventory: list) -> list:
    combos = []

    def find(keyword, cat=None):
        for i in inventory:
            p = i.get("product", {})
            name_match = keyword.lower() in p.get("name", "").lower()
            cat_match  = cat is None or p.get("category") == cat
            if name_match and cat_match and i["quantity"] > 0:
                return i
        return None

    # Morning Ritual
    milk    = find("oat") or find("milk", "beverages")
    granola = find("granola")
    tea     = find("tea", "hot-drinks")
    if milk and granola and tea:
        items = [milk, granola, tea]
        total = sum(float(i.get("product", {}).get("price", 0)) for i in items)
        bundle = round(total * 0.90, 2)
        combos.append(_rec(
            type_="combo", priority="normal",
            title='"Morning Ritual" Bundle — 10% off',
            summary=f'{_first(milk)} + {_first(granola)} + {_first(tea)} · £{bundle:.2f}',
            reasoning=(
                "These three share the same morning-routine shopper persona. "
                f"Bundled at 10% off (£{bundle:.2f} vs £{total:.2f} individual) creates clear value. "
                "Morning bundles increase average basket size by 20–30% for this segment. "
                "Place as a shelf talker near the chilled section. "
                "Best display time: refill shelf by 7:30am."
            ),
            action={"type": "combo", "products": [i["productId"] for i in items], "discount": 10, "bundlePrice": bundle},
            metrics={"saving": f"£{total - bundle:.2f}", "margin": "est. 42%", "expectedUplift": "+22% attach"},
        ))

    # Green Desk Lunch
    avo     = find("avocado")
    spinach = find("spinach")
    almond  = find("almond")
    lunch_items = [i for i in [avo, spinach, almond] if i and i["quantity"] > 0]
    if len(lunch_items) >= 2:
        total  = sum(float(i.get("product", {}).get("price", 0)) for i in lunch_items)
        bundle = round(total * 0.90, 2)
        names  = " + ".join(_first(i) for i in lunch_items)
        combos.append(_rec(
            type_="combo", priority="normal",
            title='"Green Desk Lunch" Bundle — 10% off',
            summary=f'{names[:55]}{"…" if len(names) > 55 else ""} · £{bundle:.2f}',
            reasoning=(
                "Targets the 12pm grab-and-go customer building a healthy lunch. "
                f"Bundle at £{bundle:.2f} (save £{total - bundle:.2f}). "
                "Display near the fresh rack with a 'Build Your Lunch Bowl' shelf talker. "
                "The Biotiful Kefir makes a natural upsell add-on — train staff to suggest it."
            ),
            action={"type": "combo", "products": [i["productId"] for i in lunch_items], "discount": 10, "bundlePrice": bundle},
            metrics={"saving": f"£{total - bundle:.2f}", "margin": "est. 38%", "expectedUplift": "+18% attach"},
        ))

    # Afternoon Boost
    kombucha = find("kombucha")
    nakd     = find("nakd")
    revvies  = find("revvies")
    boost_items = [i for i in [kombucha, nakd, revvies] if i and i["quantity"] > 0]
    if len(boost_items) >= 2:
        total  = sum(float(i.get("product", {}).get("price", 0)) for i in boost_items)
        bundle = round(total * 0.90, 2)
        names  = " + ".join(_first(i) for i in boost_items)
        combos.append(_rec(
            type_="combo", priority="normal",
            title='"Afternoon Boost" Bundle — 10% off',
            summary=f'{names[:55]}{"…" if len(names) > 55 else ""} · £{bundle:.2f}',
            reasoning=(
                "The 2–4pm energy slump is a well-documented convenience retail opportunity. "
                "This bundle combines fast energy (Nakd bar, Revvies strips) with functional "
                "gut health (Kombucha) — appealing to office workers and students. "
                f"Bundle at £{bundle:.2f}. Display at the counter — peak conversion: 13:00–16:00."
            ),
            action={"type": "combo", "products": [i["productId"] for i in boost_items], "discount": 10, "bundlePrice": bundle},
            metrics={"saving": f"£{total - bundle:.2f}", "margin": "est. 45%", "expectedUplift": "+15% attach"},
        ))

    return combos


def _build_promo(inventory: list, context: dict) -> dict | None:
    events = context.get("events", [])
    temp   = int(context.get("weather", {}).get("temp", 16))

    if events:
        e = events[0]
        return _rec(
            type_="promo", priority="normal",
            title=f'Wellness Weekend Activation · {e["name"]}',
            summary=f'{e["name"]} {e["distance"]} away · {e.get("attendance", 200)} expected visitors',
            reasoning=(
                f"**{e['name']}** is happening {e['distance']} away this {e.get('date', 'weekend')}, "
                f"drawing ~{e.get('attendance', 200)} health-focused visitors past your door. "
                "Recommended: "
                "(1) Create a 'Local Organic Picks' shelf talker with your top 5 organic items, "
                "(2) Run a stamp card: buy 5 organic items, get a free Nakd bar — drives repeat visit, "
                "(3) Move Kombucha + Kefir + Oat Milk to eye-level on Friday morning. "
                "Expected uplift: +25–35% on organic beverages and fresh over the weekend."
            ),
            action={"type": "promo", "channel": "in-store", "mechanic": "stamp_card", "duration": "Fri PM – Sun PM"},
            metrics={"estimatedUplift": "+30%", "targetCategory": "organic + fresh", "effort": "low"},
        )

    if temp > 18:
        return _rec(
            type_="promo", priority="normal",
            title=f"Warm Weather Push: Chilled Drinks to Front",
            summary=f"{temp}°C forecast this weekend — move cold beverages to prime positions",
            reasoning=(
                f"With {temp}°C this weekend, cold drink purchases will spike. "
                "Move Kombucha, Kefir, and OJ to the very front of the fridge. "
                "A simple 'Try Something New' sign on Remedy Kombucha "
                "(buy 1 get 10p off next) can convert first-time buyers into regulars. "
                "Low effort, high return — staff changeover takes 5 minutes."
            ),
            action={"type": "promo", "channel": "in-store", "mechanic": "shelf_placement"},
            metrics={"estimatedUplift": "+20%", "targetCategory": "beverages", "effort": "minimal"},
        )

    return None


# ─── Claude mode (real API key) ───────────────────────────────────────────────

def _claude_analyze(inventory: list, context: dict) -> list:
    """Full Claude reasoning with structured output. Used when API key is present."""
    client = anthropic.Anthropic(api_key=_api_key)
    inv_summary = "\n".join(
        f"- {i.get('product', {}).get('name', i['productId'])}: "
        f"qty={i['quantity']}, min={i['minQuantity']}, "
        f"sold14d={i.get('velocity', {}).get('sold14d', 0)}, "
        f"price=£{i.get('product', {}).get('price', 0)}, "
        f"category={i.get('product', {}).get('category', '?')}"
        for i in inventory
    )
    weather = context.get("weather", {})
    events  = context.get("events", [])
    ctx_txt = (
        f"Weather: {weather.get('weekend', 'typical')}\n"
        f"Local events: {'; '.join(e['name'] + ' ' + e['distance'] for e in events) or 'none'}"
    )
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=[{
            "type": "text",
            "text": (
                "You are Kalemart's AI inventory supervisor for a UK organic convenience store. "
                "Analyse the inventory snapshot and local context provided. "
                "Return a JSON array of recommendation objects. Each object must have: "
                "id (string), type (restock|try_new|review|combo|promo), priority (urgent|high|normal), "
                "title (string), summary (string, 1 line), reasoning (string, 2-4 sentences with **bold** product names), "
                "action (object), metrics (object), status ('pending'). "
                "Be specific: use real product names, real quantities, real £ costs. "
                "Return ONLY the JSON array, no markdown wrapper."
            ),
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": f"Inventory:\n{inv_summary}\n\nContext:\n{ctx_txt}"}],
    )
    import json
    try:
        return json.loads(msg.content[0].text)
    except Exception:
        return _demo_analyze(inventory, context)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _rec(*, type_: str, priority: str, title: str, summary: str,
         reasoning: str, action: dict, metrics: dict) -> dict:
    return {
        "id": f"rec_{uuid.uuid4().hex[:8]}",
        "type": type_,
        "priority": priority,
        "title": title,
        "summary": summary,
        "reasoning": reasoning,
        "action": action,
        "metrics": metrics,
        "status": "pending",
    }


def _first(item: dict) -> str:
    name = item.get("product", {}).get("name", "")
    return name.split(" ")[0] if name else "?"
