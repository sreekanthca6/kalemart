const router = require('express').Router();
const svc = require('../services/inventoryService');

router.get('/', (_req, res, next) => {
  try { res.json(svc.list()); }
  catch (e) { next(e); }
});

router.get('/low-stock', (_req, res, next) => {
  try { res.json(svc.getLowStock()); }
  catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(svc.getById(req.params.id)); }
  catch (e) { next(e); }
});

router.post('/', (req, res, next) => {
  try {
    const { productId, quantity, minQuantity, location } = req.body;
    res.status(201).json(svc.create(productId, quantity, minQuantity, location));
  } catch (e) { next(e); }
});

router.patch('/:id/quantity', (req, res, next) => {
  try {
    const { delta, reason } = req.body;
    res.json(svc.updateQuantity(req.params.id, delta, reason));
  } catch (e) { next(e); }
});

module.exports = router;
