const router = require('express').Router();
const svc = require('../services/productService');

router.get('/', async (req, res, next) => {
  try { res.json(await svc.list(req.query.category)); }
  catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await svc.getById(req.params.id)); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await svc.create(req.body)); }
  catch (e) { next(e); }
});

module.exports = router;
