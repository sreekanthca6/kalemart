const router = require('express').Router();

router.get('/', (_req, res) => res.json({ products: [], message: 'products stub' }));
router.post('/', (req, res) => res.status(201).json({ ...req.body, id: Date.now() }));

module.exports = router;
