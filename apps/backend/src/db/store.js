// In-memory store — swap for Postgres client in Chat 8
// Products reflect Kalemart's organic convenience store range
const { randomUUID } = require('crypto');

const products = new Map([
  // Beverages
  ['prod_001', { id: 'prod_001', name: 'Innocent Orange Juice 900ml',      sku: 'BEV-INO-900',  category: 'beverages',    price: 3.50, barcode: '5011711302278', organic: true  }],
  ['prod_002', { id: 'prod_002', name: 'Plenish Oat M!lk 1L',              sku: 'BEV-PLNOAT-1L',category: 'beverages',    price: 2.20, barcode: '5060410131016', organic: true  }],
  ['prod_003', { id: 'prod_003', name: 'Remedy Kombucha Ginger Lemon 330ml',sku: 'BEV-REMK-330', category: 'beverages',    price: 2.80, barcode: '9348876000264', organic: true  }],
  ['prod_004', { id: 'prod_004', name: 'Pukka Three Ginger Tea 20 bags',   sku: 'TEA-PUKG-20',  category: 'hot-drinks',   price: 3.20, barcode: '5060229011817', organic: true  }],
  ['prod_005', { id: 'prod_005', name: 'Minor Figures Oat M!lk Barista 1L',sku: 'BEV-MFOB-1L',  category: 'beverages',    price: 2.50, barcode: '5060443550312', organic: false }],
  // Snacks
  ['prod_006', { id: 'prod_006', name: 'Nakd Cocoa Orange Bar 35g',        sku: 'SNK-NAKD-35',  category: 'snacks',       price: 1.40, barcode: '5060088699584', organic: true  }],
  ['prod_007', { id: 'prod_007', name: 'Rude Health Granola 400g',         sku: 'SNK-RHGR-400', category: 'snacks',       price: 5.50, barcode: '5060048030061', organic: true  }],
  ['prod_008', { id: 'prod_008', name: 'Pip & Nut Almond Butter 170g',     sku: 'SNK-PNAB-170', category: 'snacks',       price: 4.50, barcode: '5060349130038', organic: false }],
  ['prod_009', { id: 'prod_009', name: 'Organic India Tulsi Holy Basil Tea',sku: 'TEA-OITB-18',  category: 'hot-drinks',   price: 3.80, barcode: '801541511806',  organic: true  }],
  // Chilled
  ['prod_010', { id: 'prod_010', name: 'Yeo Valley Organic Whole Milk 1L', sku: 'CHI-YVOM-1L',  category: 'chilled',      price: 1.90, barcode: '5000128040273', organic: true  }],
  ['prod_011', { id: 'prod_011', name: 'The Collective Yoghurt 450g',      sku: 'CHI-TCYO-450', category: 'chilled',      price: 3.00, barcode: '9421902470134', organic: false }],
  ['prod_012', { id: 'prod_012', name: 'Biotiful Kefir Original 250ml',    sku: 'CHI-BKEF-250', category: 'chilled',      price: 2.20, barcode: '5060342030151', organic: false }],
  // Fresh produce
  ['prod_013', { id: 'prod_013', name: 'Organic Avocados x2',              sku: 'FRS-AVOC-2',   category: 'fresh',        price: 2.50, barcode: '5060000000013', organic: true  }],
  ['prod_014', { id: 'prod_014', name: 'Organic Baby Spinach 200g',        sku: 'FRS-SPIN-200', category: 'fresh',        price: 2.00, barcode: '5060000000014', organic: true  }],
  // Health & wellness
  ['prod_015', { id: 'prod_015', name: 'Revvies Energy Strips Citrus x10', sku: 'HLT-REVE-10',  category: 'health',       price: 3.00, barcode: '9343906000014', organic: false }],
  ['prod_016', { id: 'prod_016', name: 'Bio-Kult Everyday Probiotic 30s',  sku: 'HLT-BKPR-30', category: 'health',       price: 9.50, barcode: '5060062559008', organic: false }],
  // Household / eco
  ['prod_017', { id: 'prod_017', name: 'Faith in Nature Shampoo 400ml',    sku: 'HYG-FINS-400', category: 'household',    price: 5.50, barcode: '5000009036016', organic: true  }],
  ['prod_018', { id: 'prod_018', name: 'Bio-D All Purpose Cleaner 500ml',  sku: 'HYG-BIOD-500', category: 'household',    price: 3.80, barcode: '5010347011015', organic: true  }],
]);

const inventory = new Map([
  ['inv_001', { id: 'inv_001', productId: 'prod_001', quantity: 24, minQuantity: 8,  location: 'fridge-1',  updatedAt: new Date() }],
  ['inv_002', { id: 'inv_002', productId: 'prod_002', quantity: 18, minQuantity: 6,  location: 'fridge-1',  updatedAt: new Date() }],
  ['inv_003', { id: 'inv_003', productId: 'prod_003', quantity: 4,  minQuantity: 10, location: 'fridge-2',  updatedAt: new Date() }], // low
  ['inv_004', { id: 'inv_004', productId: 'prod_004', quantity: 12, minQuantity: 5,  location: 'aisle-1',   updatedAt: new Date() }],
  ['inv_005', { id: 'inv_005', productId: 'prod_005', quantity: 0,  minQuantity: 6,  location: 'fridge-1',  updatedAt: new Date() }], // out
  ['inv_006', { id: 'inv_006', productId: 'prod_006', quantity: 30, minQuantity: 12, location: 'aisle-2',   updatedAt: new Date() }],
  ['inv_007', { id: 'inv_007', productId: 'prod_007', quantity: 6,  minQuantity: 8,  location: 'aisle-2',   updatedAt: new Date() }], // low
  ['inv_008', { id: 'inv_008', productId: 'prod_008', quantity: 9,  minQuantity: 6,  location: 'aisle-2',   updatedAt: new Date() }],
  ['inv_009', { id: 'inv_009', productId: 'prod_009', quantity: 8,  minQuantity: 5,  location: 'aisle-1',   updatedAt: new Date() }],
  ['inv_010', { id: 'inv_010', productId: 'prod_010', quantity: 12, minQuantity: 6,  location: 'fridge-2',  updatedAt: new Date() }],
  ['inv_011', { id: 'inv_011', productId: 'prod_011', quantity: 5,  minQuantity: 6,  location: 'fridge-2',  updatedAt: new Date() }], // low
  ['inv_012', { id: 'inv_012', productId: 'prod_012', quantity: 10, minQuantity: 6,  location: 'fridge-2',  updatedAt: new Date() }],
  ['inv_013', { id: 'inv_013', productId: 'prod_013', quantity: 0,  minQuantity: 4,  location: 'fresh-rack',updatedAt: new Date() }], // out
  ['inv_014', { id: 'inv_014', productId: 'prod_014', quantity: 8,  minQuantity: 4,  location: 'fresh-rack',updatedAt: new Date() }],
  ['inv_015', { id: 'inv_015', productId: 'prod_015', quantity: 15, minQuantity: 8,  location: 'counter',   updatedAt: new Date() }],
  ['inv_016', { id: 'inv_016', productId: 'prod_016', quantity: 7,  minQuantity: 5,  location: 'aisle-3',   updatedAt: new Date() }],
  ['inv_017', { id: 'inv_017', productId: 'prod_017', quantity: 3,  minQuantity: 4,  location: 'aisle-3',   updatedAt: new Date() }], // low
  ['inv_018', { id: 'inv_018', productId: 'prod_018', quantity: 6,  minQuantity: 4,  location: 'aisle-3',   updatedAt: new Date() }],
]);

const orders = new Map();

module.exports = {
  products,
  inventory,
  orders,
  newId: () => randomUUID(),
};
