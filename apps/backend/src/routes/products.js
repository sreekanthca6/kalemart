const router = require('express').Router();
const svc = require('../services/productService');

router.get('/', (req, res, next) => {
  try { res.json(svc.list(req.query.category)); }
  catch (e) { next(e); }
});

router.get('/:id', (req, res, next) => {
  try { res.json(svc.getById(req.params.id)); }
  catch (e) { next(e); }
});

router.post('/', (req, res, next) => {
  try { res.status(201).json(svc.create(req.body)); }
  catch (e) { next(e); }
});

module.exports = router;
