const router = require('express').Router();
const svc = require('../services/inventoryService');

router.get('/', async (req, res, next) => {
  try { res.json(await svc.list()); }
  catch (e) { next(e); }
});

router.get('/low-stock', async (req, res, next) => {
  try { res.json(await svc.getLowStock()); }
  catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.getById(req.params.id)); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { productId, quantity, minQuantity, location } = req.body;
    res.status(201).json(await svc.create(productId, quantity, minQuantity, location));
  } catch (e) { next(e); }
});

router.patch('/:id/quantity', async (req, res, next) => {
  try {
    const { delta, reason } = req.body;
    res.json(await svc.updateQuantity(req.params.id, delta, reason));
  } catch (e) { next(e); }
});

module.exports = router;
