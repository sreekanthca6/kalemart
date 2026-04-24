const router = require('express').Router();
const { randomUUID } = require('crypto');
const { queryAsTenant } = require('../db/tenantQuery');
const inventorySvc = require('../services/inventoryService');
const { purchaseOrdersTotal } = require('../metrics');
const { logEvent } = require('../observability/log');

// KeHE Montreal delivery schedule
// Deliveries: Thursday + Monday
// Cut-offs:   Tuesday 17:00 → Thursday | Friday 17:00 → Monday
const SCHEDULE = [
  { deliveryDay: 4, cutoffDay: 2, cutoffHour: 17, deliveryName: 'Thursday', cutoffName: 'Tuesday' },
  { deliveryDay: 1, cutoffDay: 5, cutoffHour: 17, deliveryName: 'Monday',   cutoffName: 'Friday'  },
];

const CASE_SIZE = { beverages: 12, 'grab-n-go': 6, 'hot-drinks': 6, snacks: 12, chilled: 6, fresh: 6, health: 6, 'personal-care': 6, household: 6 };

function buildDeliverySchedule() {
  const now  = new Date();
  const dow  = now.getDay();
  const hour = now.getHours();

  const resolved = SCHEDULE.map(s => {
    let dDel = (s.deliveryDay - dow + 7) % 7 || 7;
    let dCut = (s.cutoffDay  - dow + 7) % 7;
    if (dCut === 0 && hour >= s.cutoffHour) dCut = 7;

    const deliveryDate = new Date(now); deliveryDate.setDate(now.getDate() + dDel); deliveryDate.setHours(9,0,0,0);
    const cutoffDate   = new Date(now); cutoffDate.setDate(now.getDate() + dCut);   cutoffDate.setHours(s.cutoffHour,0,0,0);

    const hoursToCutoff = Math.max(0, Math.round((cutoffDate - now) / 3600000));
    const isPastCutoff  = now > cutoffDate;

    return { ...s, deliveryDate, cutoffDate, daysToDelivery: dDel, hoursToCutoff, isPastCutoff };
  }).sort((a, b) => a.daysToDelivery - b.daysToDelivery);

  const [next, afterNext] = resolved;
  return { next, afterNext, stockTargetDays: afterNext.daysToDelivery + 4 };
}

async function calcVelocity() {
  const { rows } = await queryAsTenant(
    `SELECT oi.inventory_id AS id, COALESCE(SUM(oi.quantity), 0)::int AS sold
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE o.created_at >= NOW() - INTERVAL '14 days'
     GROUP BY oi.inventory_id`
  );
  const vel = {};
  for (const r of rows) vel[r.id] = r.sold;
  return vel;
}

let lastPO = null;

// ─── GET /api/order-basket ────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
  const sched = buildDeliverySchedule();
  const { next, afterNext, stockTargetDays } = sched;
  const [inventoryList, vel] = await Promise.all([inventorySvc.list(), calcVelocity()]);

  const critical = [], toOrder = [], sufficient = [];

  for (const inv of inventoryList) {
    const product = inv.product;
    const invId = inv.id;
    if (!product) continue;

    const sold14d    = vel[invId] || 0;
    const dailyRate  = +(sold14d / 14).toFixed(2);
    const daysLeft   = dailyRate > 0 ? +(inv.quantity / dailyRate).toFixed(1) : (inv.quantity > 0 ? null : 0);

    // Determine status
    let status;
    if (inv.quantity === 0 || (daysLeft !== null && daysLeft < next.daysToDelivery)) {
      status = 'critical';
    } else if (daysLeft !== null && daysLeft < afterNext.daysToDelivery) {
      status = 'order';
    } else if (inv.quantity < inv.minQuantity) {
      status = 'order';
    } else {
      status = 'ok';
    }

    // Calculate suggested order quantity
    let suggestedQty = 0;
    if (status !== 'ok') {
      const stockAtDelivery = Math.max(0, inv.quantity - dailyRate * next.daysToDelivery);
      const daysToStock     = stockTargetDays - next.daysToDelivery;
      // Out-of-stock with no history → order 3× min to avoid immediate re-stockout
      const minFloor        = inv.quantity === 0 && dailyRate === 0 ? inv.minQuantity * 3 : inv.minQuantity;
      const rawNeed         = Math.max(
        Math.ceil(dailyRate * daysToStock) - stockAtDelivery,
        minFloor
      );
      const cs = CASE_SIZE[product.category] || 12;
      suggestedQty = Math.ceil(rawNeed / cs) * cs;
    }

    const estCostUnit = +(product.price * 0.55).toFixed(2);
    const lineCost    = +(suggestedQty * estCostUnit).toFixed(2);

    const row = {
      invId, productId: inv.productId,
      product: { id: product.id, name: product.name, sku: product.sku, category: product.category, price: product.price },
      currentStock: inv.quantity,
      minQuantity: inv.minQuantity,
      dailyRate, sold14d,
      daysLeft,
      status, suggestedQty, estCostUnit, lineCost,
      location: inv.location,
    };

    if      (status === 'critical') critical.push(row);
    else if (status === 'order')    toOrder.push(row);
    else                            sufficient.push(row);
  }

  // Sort each group by daysLeft asc
  const sortByDays = arr => arr.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  sortByDays(critical); sortByDays(toOrder);

  const orderItems = [...critical, ...toOrder];
  const totalCost  = +orderItems.reduce((s, i) => s + i.lineCost, 0).toFixed(2);

  res.json({
    schedule: {
      next:      { name: next.deliveryName,      date: next.deliveryDate.toISOString(),      daysAway: next.daysToDelivery,      cutoffDate: next.cutoffDate.toISOString(),      hoursToCutoff: next.hoursToCutoff,      isPastCutoff: next.isPastCutoff },
      afterNext: { name: afterNext.deliveryName, date: afterNext.deliveryDate.toISOString(), daysAway: afterNext.daysToDelivery },
      stockTargetDays,
    },
    summary: { critical: critical.length, order: toOrder.length, sufficient: sufficient.length, totalCost },
    critical, order: toOrder, sufficient,
  });
  } catch (e) { next(e); }
});

// ─── POST /api/order-basket/approve ──────────────────────────────────────────
router.post('/approve', (req, res) => {
  const { items, schedule } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'No items' });

  const totalCost = +items.reduce((s, i) => s + (i.suggestedQty * i.estCostUnit), 0).toFixed(2);

  const emailLines = items.map(i =>
    `  ${i.product.name.padEnd(48)} x${String(i.suggestedQty).padStart(4)}   @ $${i.estCostUnit.toFixed(2)} = $${(i.suggestedQty * i.estCostUnit).toFixed(2)}`
  ).join('\n');

  const deliveryName = schedule?.next?.name || 'next delivery';
  const deliveryDate = schedule?.next?.date ? new Date(schedule.next.date).toDateString() : '';

  const emailBody = `To: orders@kehe.com
Subject: Purchase Order — KaleMart24, 1170 Rue de Bleury, Montréal

Dear KeHE Team,

Please process the following purchase order for:

  Store:   KaleMart24 — 1170 Rue de Bleury, Montréal, QC H3A 1A6
  Account: KaleMart24
  Request: Delivery by ${deliveryName} ${deliveryDate}

───────────────────────────────────────────────────────────────────
${emailLines}
───────────────────────────────────────────────────────────────────
  TOTAL (estimated cost):  $${totalCost}

Please confirm receipt and expected delivery window.

Thank you,
KaleMart24 Operations Team
1170 Rue de Bleury, Montréal`;

  lastPO = {
    id: `PO-${randomUUID().slice(0,8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'submitted',
    totalCost, emailBody,
    items: items.map(i => ({ sku: i.product.sku, name: i.product.name, qty: i.suggestedQty, unitCost: i.estCostUnit, total: +(i.suggestedQty * i.estCostUnit).toFixed(2) })),
  };

  purchaseOrdersTotal.add(1, { supplier: 'kehe' });
  logEvent('purchase_order_generated', {
    poId: lastPO.id,
    supplier: 'kehe',
    itemCount: lastPO.items.length,
    totalCost,
    tenantId: req.tenantId,
  });
  res.json(lastPO);
});

router.get('/last-po', (req, res) => res.json(lastPO || null));

module.exports = router;
