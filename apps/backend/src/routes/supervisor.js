const router = require('express').Router();
const { trace } = require('@opentelemetry/api');
const { randomUUID } = require('crypto');
const { queryAsTenant } = require('../db/tenantQuery');
const inventorySvc = require('../services/inventoryService');
const config = require('../config');
const aiClient = require('../services/aiClient');
const { supervisorRecommendationsTotal } = require('../metrics');
const { logEvent } = require('../observability/log');

const tracer = trace.getTracer('kalemart-backend');

let latestAnalysis = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rec(type, priority, title, summary, reasoning, action, metrics) {
  return { id: `rec_${randomUUID().replace(/-/g,'').slice(0,8)}`, type, priority, title, summary, reasoning, action, metrics, status: 'pending' };
}

function first(item) {
  return (item?.product?.name || '').split(' ')[0] || '?';
}

async function calcVelocity(days = 14) {
  const { rows } = await queryAsTenant(
    `SELECT oi.inventory_id AS id, COALESCE(SUM(oi.quantity), 0)::int AS sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY oi.inventory_id`,
    [days]
  );
  const vel = {};
  for (const r of rows) vel[r.id] = { sold: r.sold, days };
  return vel;
}

function buildContext() {
  const month = new Date().getMonth();
  // Montreal seasonal temps (°C)
  const temp = month >= 5 && month <= 8 ? 26 : month >= 9 && month <= 10 ? 8 : month >= 11 || month <= 2 ? -8 : 12;
  const description = temp > 20 ? 'Sunny & warm' : temp > 5 ? 'Mild' : temp > -5 ? 'Cold' : 'Freezing';

  // Dynamic Montreal events based on season
  const events = month >= 5 && month <= 8
    ? [
        { name: 'Festival International de Jazz de Montréal', date: 'Saturday', distance: '0.3km', attendance: 3000 },
        { name: 'Canadiens de Montréal Game — Bell Centre',   date: 'Sunday',   distance: '0.4km', attendance: 21105 },
      ]
    : [
        { name: 'Canadiens de Montréal Game — Bell Centre',   date: 'Saturday', distance: '0.4km', attendance: 21105 },
        { name: 'Concordia Farmers Market',                   date: 'Sunday',   distance: '0.6km', attendance: 420 },
      ];

  return {
    location: '1170 Rue de Bleury, Downtown Montréal',
    weather: { temp, description, weekend: `${description}, ${temp}°C` },
    events,
    date: new Date().toISOString(),
  };
}

// ─── Expiry helpers ───────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate) - Date.now()) / 86400000);
}

function analyzeExpiry(inventory) {
  const recs = [];

  for (const item of inventory) {
    if (!item.expiryDate || item.quantity === 0) continue;
    const p    = item.product || {};
    const days = daysUntilExpiry(item.expiryDate);
    const expStr = new Date(item.expiryDate).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
    const stockVal = +(p.price * item.quantity).toFixed(2);

    if (days <= 0) {
      // Expired — must remove
      recs.push(rec('expiry', 'urgent',
        `REMOVE: ${p.name} — Expired`,
        `${item.quantity} units expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago · Remove immediately`,
        `**${p.name}** (${item.quantity} units at ${item.location}) passed its best-before date ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago. **Remove from shelf immediately** — selling expired food is a regulatory violation in Québec (MAPAQ) and a liability. Options: (1) Discard. (2) Donate to a food bank (Moisson Montréal accepts same-day pickups). Estimated write-off: $${stockVal}.`,
        { type: 'remove', invId: item.id, productId: item.productId, qty: item.quantity },
        { expiryDate: expStr, daysOverdue: Math.abs(days), stockValue: `$${stockVal}`, units: item.quantity },
      ));
    } else if (days <= 2) {
      // Expiring in 1-2 days — deep discount or donate
      const discountPct = 40;
      const discountPrice = +(p.price * (1 - discountPct / 100)).toFixed(2);
      recs.push(rec('expiry', 'urgent',
        `Expires in ${days}d: ${p.name} — Mark Down 40%`,
        `${item.quantity} units · Expires ${expStr} · Mark to $${discountPrice.toFixed(2)}`,
        `**${p.name}** expires in ${days} day${days !== 1 ? 's' : ''} (${expStr}). You have ${item.quantity} units at ${item.location}. Act now: (1) **Mark to $${discountPrice.toFixed(2)} (40% off)** — place a "Last chance" label and move to the counter impulse zone. At this price it competes with convenience items and will clear quickly. (2) If not sold by end of day tomorrow, donate to Moisson Montréal or discard. Recovering $${(discountPrice * item.quantity).toFixed(2)} beats a full write-off of $${stockVal}.`,
        { type: 'markdown', invId: item.id, productId: item.productId, discountPct, discountPrice },
        { expiryDate: expStr, daysLeft: days, discountPrice: `$${discountPrice}`, units: item.quantity, recoverable: `$${(discountPrice * item.quantity).toFixed(2)}` },
      ));
    } else if (days <= 5) {
      // Expiring in 3-5 days — promote and bundle
      const discountPct = 20;
      const discountPrice = +(p.price * (1 - discountPct / 100)).toFixed(2);
      recs.push(rec('expiry', 'high',
        `Expires in ${days}d: ${p.name} — Promote Now`,
        `${item.quantity} units · Expires ${expStr} · 20% off + front-of-store`,
        `**${p.name}** expires in ${days} days (${expStr}). ${item.quantity} units at ${item.location}. This is still enough runway to sell through at a modest markdown. Actions: (1) **Move to front fridge / counter** — visibility is the single highest-leverage action. (2) **20% off label ($${discountPrice})** — daily savers respond instantly to value signals. (3) Feature in a combo: pair with a snack or drink at a combined price. At ${item.quantity} units × $${discountPrice} you recover $${(discountPrice * item.quantity).toFixed(2)}.`,
        { type: 'markdown', invId: item.id, productId: item.productId, discountPct, discountPrice },
        { expiryDate: expStr, daysLeft: days, discountPrice: `$${discountPrice}`, units: item.quantity, recoverable: `$${(discountPrice * item.quantity).toFixed(2)}` },
      ));
    } else if (days <= 7) {
      // Expiring in 6-7 days — early warning
      recs.push(rec('expiry', 'normal',
        `Watch: ${p.name} — Expires in ${days}d`,
        `${item.quantity} units · Expires ${expStr} · Rotate to front`,
        `**${p.name}** expires ${expStr} (${days} days). At current rate you should sell through, but monitor daily. Action: **rotate to front** (FIFO) and watch sell-through. If not 50% sold by ${new Date(Date.now() + 3*86400000).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}, apply the 20% markdown protocol.`,
        { type: 'watch', invId: item.id, productId: item.productId },
        { expiryDate: expStr, daysLeft: days, units: item.quantity, stockValue: `$${stockVal}` },
      ));
    }
  }

  return recs;
}

// ─── Demo analysis (runs in-process, no AI service needed) ────────────────────

function demoAnalyze(inventory, context) {
  const recs = [];
  const { weather, events } = context;
  const temp = weather.temp;
  const warm = temp > 18;
  const event = events[0];

  const outOfStock = inventory.filter(i => i.quantity === 0);
  const lowStock   = inventory.filter(i => i.quantity > 0 && i.quantity < i.minQuantity);

  // ── URGENT restocks ──
  for (const item of outOfStock) {
    const p = item.product || {};
    const v = item.velocity || {};
    const sold = v.sold14d || 0;
    const rate = v.dailyRate || 0;
    const qty  = Math.max(item.minQuantity * 3, 12);
    const cost = (p.price * qty).toFixed(2);
    const days = Math.round(qty / Math.max(rate, 0.5));
    const isBellCentre = event?.name?.toLowerCase().includes('bell') || event?.name?.toLowerCase().includes('canadien');
    const ctxNote = warm && ['beverages','chilled'].includes(p.category)
      ? ` With ${temp}°C forecast in Montréal this weekend, cold drink demand will spike ~35%.`
      : isBellCentre ? ` ${event.name} (${event.distance}) draws ${event.attendance.toLocaleString()} fans past your door.`
      : event ? ` ${event.name} (${event.distance}) this weekend adds foot traffic on Rue de Bleury.` : '';

    recs.push(rec('restock','urgent',
      `Restock ${p.name}`,
      `Out of stock · ${sold} sold in 14 days · order ${qty} units`,
      `**${p.name}** is completely out of stock. You sold ${sold} units in the past 14 days (~${rate.toFixed(1)}/day).${ctxNote} Ordering ${qty} units gives ~${days} days of supply. Estimated cost: $${cost}.`,
      { type:'order', qty, invId: item.id, productId: item.productId },
      { velocity: `${rate.toFixed(1)}/day`, sold14d: sold, estCost: `$${cost}`, daysSupply: days },
    ));
  }

  // ── LOW stock restocks ──
  for (const item of lowStock) {
    const p = item.product || {};
    const v = item.velocity || {};
    const sold = v.sold14d || 0;
    const rate = v.dailyRate || 0;
    const qty  = item.minQuantity * 3;
    const cost = (p.price * qty).toFixed(2);
    const daysLeft = Math.round(item.quantity / Math.max(rate, 0.1));
    const pct = Math.round(item.quantity / item.minQuantity * 100);

    recs.push(rec('restock','high',
      `Restock ${p.name}`,
      `${item.quantity}/${item.minQuantity} min · ~${daysLeft}d until stockout`,
      `**${p.name}** is at ${item.quantity} units — ${pct}% of minimum stock. At ${rate.toFixed(1)} units/day you have ~${daysLeft} days before running out. Ordering ${qty} units (3× min) costs $${cost} and provides a comfortable buffer.`,
      { type:'order', qty, invId: item.id, productId: item.productId },
      { velocity: `${rate.toFixed(1)}/day`, daysLeft, estCost: `$${cost}` },
    ));
  }

  // ── TRY NEW products ──
  const cats = new Set(inventory.map(i => i.product?.category).filter(Boolean));

  if (cats.has('beverages')) {
    recs.push(rec('try_new','normal',
      'Trial: Toro Matcha Sparkling Water 355ml',
      'Canned matcha trending +55% YoY · Sam\'s brand · RRP $4.99',
      `Toro Matcha is KaleMart24's own founder brand — Sam Saoudi built this label from the ground up. A sparkling matcha line-extension is the logical next SKU for your matcha-forward customers.${warm ? ` With ${temp}°C this weekend, chilled canned matcha will outperform hot formats by 3×.` : ''} Trial 24 units at $4.99 RRP. If 12 sell in 14 days, lock in a standing order through KeHE.`,
      { type:'trial', qty:24, suggestedRrp:4.99 },
      { trialQty:24, estCost:'$71.76', breakEven:'12 units', category:'beverages' },
    ));
  }

  if (cats.has('grab-n-go')) {
    recs.push(rec('try_new','normal',
      'Trial: KM24 Acai Smoothie Bowl — Bell Centre Edition',
      'Game-day grab · High margin · RRP $12.99',
      `The Bell Centre is 0.4km away — 21,105 fans walk past your door on game nights. A signature smoothie bowl with Évive açaí and Toro Matcha granola commands $12.99 and positions KaleMart24 as the premium pit-stop vs. arena junk food. Build 10 units before each home game. Margin: ~52%.${event ? ` Next game: ${event.date}.` : ''}`,
      { type:'trial', qty:10, suggestedRrp:12.99 },
      { trialQty:10, estCost:'$64.90', breakEven:'6 units', category:'grab-n-go' },
    ));
  }

  // ── SLOW MOVERS to review ──
  for (const item of inventory) {
    const p = item.product || {};
    const sold = item.velocity?.sold14d || 0;
    if (item.quantity >= item.minQuantity * 1.2 && sold === 0 && item.quantity > 0) {
      const stockVal = (p.price * item.quantity).toFixed(2);
      recs.push(rec('review','normal',
        `Review: ${p.name}`,
        `0 sales in 14 days · ${item.quantity} units sitting · $${p.price?.toFixed(2)} RRP`,
        `**${p.name}** has had zero sales in 14 days (stock value: $${stockVal}). At $${p.price?.toFixed(2)} it sits at a higher price point for its category. Actions in order: (A) Move to counter/eye-level for 7 days — visibility rescues slow movers in a 800–1,500 sq ft store. (B) Bundle with a complementary product at 10% off to drive trial. (C) If still stagnant after 14 days, reduce facing and don't reorder.`,
        { type:'review', options:['relocate','bundle','reduce_facing','discontinue'] },
        { velocity:'0/day', stockValue:`$${stockVal}`, daysStagnant:14 },
      ));
      break;
    }
  }

  // ── COMBOS ──
  const find = (kw, cat) => inventory.find(i => {
    const nm = (i.product?.name || '').toLowerCase();
    const ct = i.product?.category;
    return nm.includes(kw) && (!cat || ct === cat) && i.quantity > 0;
  });

  const oat     = find('oat','beverages') || find('oatly');
  const granola = find('granola') || find('made good');
  const tea     = find('tea','hot-drinks') || find('matcha','hot-drinks');
  if (oat && granola && tea) {
    const items = [oat, granola, tea];
    const total  = items.reduce((s,i) => s + (i.product?.price||0), 0);
    const bundle = +(total * 0.90).toFixed(2);
    recs.push(rec('combo','normal',
      '"Morning Ritual" Bundle — 10% off',
      `${first(oat)} + ${first(granola)} + ${first(tea)} · $${bundle.toFixed(2)}`,
      `These three share the same morning-routine shopper — the Bleury St commuter stopping in before the Metro. Bundled at 10% off ($${bundle.toFixed(2)} vs $${total.toFixed(2)} individual) creates clear value. Morning bundles increase basket size by 20–30% for this segment. Place as a shelf talker near the chilled section with a '10% off your morning' sign.`,
      { type:'combo', products: items.map(i=>i.productId), discount:10, bundlePrice:bundle },
      { saving:`$${(total-bundle).toFixed(2)}`, margin:'est. 42%', expectedUplift:'+22% attach' },
    ));
  }

  const avo    = find('avocado');
  const spin   = find('spinach');
  const wrap   = find('wrap','grab-n-go') || find('bowl','grab-n-go');
  const lunchItems = [avo,spin,wrap].filter(Boolean).filter(i => i.quantity > 0);
  if (lunchItems.length >= 2) {
    const total  = lunchItems.reduce((s,i) => s + (i.product?.price||0), 0);
    const bundle = +(total * 0.90).toFixed(2);
    const names  = lunchItems.map(first).join(' + ');
    recs.push(rec('combo','normal',
      '"Build Your Bowl" Bundle — 10% off',
      `${names.slice(0,55)} · $${bundle.toFixed(2)}`,
      `Targets the 12pm grab-and-go customer at Concordia/McGill who's building a healthy lunch. Bundle at $${bundle.toFixed(2)} (save $${(total-bundle).toFixed(2)}). Display near the fresh rack with a 'Build Your Lunch Bowl' shelf talker — this is KaleMart24's core differentiation vs. a regular dépanneur. Liberté Kefir makes a natural upsell add-on.`,
      { type:'combo', products: lunchItems.map(i=>i.productId), discount:10, bundlePrice:bundle },
      { saving:`$${(total-bundle).toFixed(2)}`, margin:'est. 38%', expectedUplift:'+18% attach' },
    ));
  }

  const kombucha = find('kombucha','beverages');
  const bar      = find('protein bar') || find('granola bar') || find('made good');
  const guru     = find('guru') || find('energy drink','beverages');
  const boostItems = [kombucha,bar,guru].filter(Boolean).filter(i => i.quantity > 0);
  if (boostItems.length >= 2) {
    const total  = boostItems.reduce((s,i) => s + (i.product?.price||0), 0);
    const bundle = +(total * 0.90).toFixed(2);
    const names  = boostItems.map(first).join(' + ');
    recs.push(rec('combo','normal',
      '"Afternoon Boost" Bundle — 10% off',
      `${names.slice(0,55)} · $${bundle.toFixed(2)}`,
      `The 2–4pm energy slump is a prime conversion window in convenience retail. This bundle pairs a Montreal-born energy drink (Guru) with functional gut health (Rise Kombucha) and a clean snack. Bundle at $${bundle.toFixed(2)}. Counter display — peak conversion: 13:00–16:00. Bell Centre pre-game crowd (17:00–19:00) doubles this window on game days.`,
      { type:'combo', products: boostItems.map(i=>i.productId), discount:10, bundlePrice:bundle },
      { saving:`$${(total-bundle).toFixed(2)}`, margin:'est. 45%', expectedUplift:'+15% attach' },
    ));
  }

  // ── PROMO ──
  if (event) {
    const isBellCentre = event.name.toLowerCase().includes('bell') || event.name.toLowerCase().includes('canadien');
    recs.push(rec('promo','normal',
      isBellCentre ? `Canadiens Game-Day Activation · ${event.distance} Away` : `Wellness Weekend · ${event.name}`,
      `${event.name} · ${event.distance} · ${event.attendance.toLocaleString()} expected`,
      isBellCentre
        ? `**${event.name}** draws ${event.attendance.toLocaleString()} fans and passes right by 1170 Rue de Bleury. Actions: (1) Move Rise Kombucha + Guru Energy to the front fridge — energy drink impulse peaks 90 min pre-game. (2) Stack Toro Matcha Energy Drinks at the door with a 'Fuel Up Before the Game' sign. (3) Pre-pack 20 Grab & Go bags (wrap + drink + snack, $16.99) labelled 'Game Day Bundle'. Expected uplift: +40–50% on beverages, +60% on Grab & Go.`
        : `**${event.name}** (${event.distance}) this ${event.date} draws ~${event.attendance} wellness-focused visitors to the Bleury corridor. Actions: (1) 'Organic Montréal Picks' shelf talker on your top 5 organic SKUs. (2) Stamp card: buy 5 organic items, get a free Made Good bar. (3) Move Rise Kombucha + Kefir + Oatly to eye-level Friday morning. Expected uplift: +25–35% on organic beverages and fresh.`,
      { type:'promo', channel:'in-store', mechanic: isBellCentre ? 'game_day_bundle' : 'stamp_card', duration:'Fri PM – Sun PM' },
      { estimatedUplift: isBellCentre ? '+45%' : '+30%', targetCategory: isBellCentre ? 'beverages + grab-n-go' : 'organic + fresh', effort:'low' },
    ));
  } else if (warm) {
    recs.push(rec('promo','normal',
      `Warm Weather Push: Chilled Drinks to Front`,
      `${temp}°C forecast — move cold beverages to prime positions`,
      `With ${temp}°C this weekend in Montréal, cold drink purchases will spike — especially on Rue de Bleury with heavy foot traffic from Concordia and McGill. Move Rise Kombucha, Liberté Kefir, and Harmless Harvest Coconut Water to the very front of the fridge. A 'Try Something New' sign on Toro Matcha Energy (buy 2 save $1) converts first-time buyers into regulars. Low effort, high return.`,
      { type:'promo', channel:'in-store', mechanic:'shelf_placement' },
      { estimatedUplift:'+25%', targetCategory:'beverages', effort:'minimal' },
    ));
  }

  // Expiry recs go first — highest urgency
  return [...analyzeExpiry(inventory), ...recs];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/analyze', async (req, res, next) => {
  return tracer.startActiveSpan('supervisor.analyze', async span => {
    try {
      const [vel, inventoryList] = await Promise.all([calcVelocity(14), inventorySvc.list()]);
      const ctx = buildContext();

      const inventoryPayload = inventoryList.map(inv => ({
        ...inv,
        updatedAt: inv.updatedAt?.toISOString?.() ?? inv.updatedAt,
        velocity: { sold14d: vel[inv.id]?.sold || 0, dailyRate: parseFloat(((vel[inv.id]?.sold || 0) / 14).toFixed(2)) },
      }));

      let recommendations;
      let mode = 'demo';

      // Try AI service first; fall back to in-process demo analysis
      if (config.aiServiceUrl) {
        try {
          const result = await aiClient.post('/api/supervisor/analyze', { inventory: inventoryPayload, context: ctx });
          recommendations = result.recommendations;
          mode = result.mode || 'ai';
        } catch {
          recommendations = demoAnalyze(inventoryPayload, ctx);
        }
      } else {
        recommendations = demoAnalyze(inventoryPayload, ctx);
      }

      span.setAttribute('supervisor.rec_count', recommendations.length);
      supervisorRecommendationsTotal.add(recommendations.length, { mode });
      logEvent('supervisor_analysis_completed', {
        mode,
        recommendationCount: recommendations.length,
        skuCount: inventoryPayload.length,
        tenantId: req.tenantId,
      });

      latestAnalysis = {
        runAt: new Date().toISOString(),
        context: ctx,
        recommendations,
        mode,
        skuCount: inventoryPayload.length,
      };

      res.json(latestAnalysis);
    } catch (e) {
      span.recordException(e);
      next(e);
    } finally {
      span.end();
    }
  });
});

router.get('/latest', (req, res) => {
  res.json(latestAnalysis || { recommendations: [], runAt: null, context: buildContext() });
});

router.patch('/recommendations/:id', (req, res) => {
  if (!latestAnalysis) return res.status(404).json({ error: 'No analysis run yet' });
  const rec = latestAnalysis.recommendations?.find(r => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  if (!['approved','rejected'].includes(status)) return res.status(400).json({ error: 'status must be approved or rejected' });
  rec.status = status;
  res.json(rec);
});

module.exports = router;
