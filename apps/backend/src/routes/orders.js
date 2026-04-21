const router = require('express').Router();

router.get('/', (_req, res) => res.json({ orders: [], message: 'orders stub' }));
router.post('/', (req, res) => res.status(201).json({ ...req.body, id: Date.now(), status: 'pending' }));

module.exports = router;
