const router = require('express').Router();
const aiClient = require('../services/aiClient');
const inventorySvc = require('../services/inventoryService');

// Ask a question about the current inventory state
router.post('/ask', async (req, res, next) => {
  try {
    const { question } = req.body;
    const inventory = inventorySvc.list();
    const context = JSON.stringify(inventory.map(i => ({
      product: i.product?.name,
      quantity: i.quantity,
      minQuantity: i.minQuantity,
      location: i.location,
    })));
    const result = await aiClient.post('/api/insights/', { context, question });
    res.json(result);
  } catch (e) { next(e); }
});

// Get reorder suggestions based on current low-stock items
router.get('/reorder-suggestions', async (req, res, next) => {
  try {
    const lowStock = inventorySvc.getLowStock();
    const result = await aiClient.post('/api/insights/reorder', { items: lowStock });
    res.json(result);
  } catch (e) { next(e); }
});

// Get combo product recommendations
router.post('/combos', async (req, res, next) => {
  try {
    const { productIds } = req.body;
    const result = await aiClient.post('/api/insights/combos', { productIds });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
