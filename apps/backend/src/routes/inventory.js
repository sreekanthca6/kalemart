const router = require('express').Router();

router.get('/', (_req, res) => res.json({ items: [], message: 'inventory stub' }));
router.get('/:id', (req, res) => res.json({ id: req.params.id, message: 'inventory item stub' }));

module.exports = router;
