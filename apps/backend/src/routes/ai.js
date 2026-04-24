const router = require('express').Router();
const aiClient = require('../services/aiClient');
const inventorySvc = require('../services/inventoryService');

// Ask a question about the current inventory state
router.post('/ask', async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }
    const inventory = await inventorySvc.list();
    const context = JSON.stringify(inventory.map(i => ({
      product: i.product?.name,
      quantity: i.quantity,
      minQuantity: i.minQuantity,
      location: i.location,
    })));
    try {
      const result = await aiClient.post('/api/insights/', { context, question });
      res.json(result);
    } catch (aiErr) {
      res.json({
        insight: '⚠️ AI service is temporarily unavailable. Please set a valid ANTHROPIC_API_KEY in your deployment config and redeploy.',
        mode: 'unavailable',
      });
    }
  } catch (e) { next(e); }
});

// Get reorder suggestions based on current low-stock items
router.get('/reorder-suggestions', async (req, res, next) => {
  try {
    const lowStock = await inventorySvc.getLowStock();
    try {
      const result = await aiClient.post('/api/insights/reorder', { items: lowStock });
      res.json(result);
    } catch (aiErr) {
      res.json({
        suggestions: '⚠️ AI service is temporarily unavailable. Please set a valid ANTHROPIC_API_KEY in your deployment config and redeploy.',
        mode: 'unavailable',
        lowStockCount: lowStock.length,
      });
    }
  } catch (e) { next(e); }
});

// Get combo product recommendations
router.post('/combos', async (req, res, next) => {
  try {
    const { productIds } = req.body;
    try {
      const result = await aiClient.post('/api/insights/combos', { productIds });
      res.json(result);
    } catch (aiErr) {
      res.json({
        recommendations: '⚠️ AI service is temporarily unavailable. Please set a valid ANTHROPIC_API_KEY in your deployment config and redeploy.',
        mode: 'unavailable',
      });
    }
  } catch (e) { next(e); }
});

module.exports = router;
