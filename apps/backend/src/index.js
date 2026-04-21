const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'backend' }));

// Inventory routes (stub)
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

app.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
