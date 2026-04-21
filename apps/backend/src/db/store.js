// In-memory store — swap for Postgres client in Chat 7
const { randomUUID } = require('crypto');

const products = new Map([
  ['prod_001', { id: 'prod_001', name: 'Coca-Cola 330ml', sku: 'BEV-COKE-330', category: 'beverages', price: 1.50, barcode: '5000112637922' }],
  ['prod_002', { id: 'prod_002', name: 'Pepsi 330ml', sku: 'BEV-PEPSI-330', category: 'beverages', price: 1.45, barcode: '5000112637939' }],
  ['prod_003', { id: 'prod_003', name: "Lay's Classic Chips 150g", sku: 'SNK-LAYS-150', category: 'snacks', price: 2.00, barcode: '5000112637946' }],
  ['prod_004', { id: 'prod_004', name: 'Red Bull 250ml', sku: 'BEV-RBULL-250', category: 'energy-drinks', price: 2.50, barcode: '9002490100070' }],
  ['prod_005', { id: 'prod_005', name: 'Snickers Bar 50g', sku: 'CNF-SNIC-50', category: 'confectionery', price: 1.20, barcode: '5000159461122' }],
  ['prod_006', { id: 'prod_006', name: 'Marlboro Red 20s', sku: 'TOB-MARL-20', category: 'tobacco', price: 12.00, barcode: '4007801095502' }],
  ['prod_007', { id: 'prod_007', name: 'Andrex Toilet Roll 4pk', sku: 'HYG-ANDR-4', category: 'household', price: 3.50, barcode: '5000168003285' }],
  ['prod_008', { id: 'prod_008', name: 'Tropicana Orange 1L', sku: 'BEV-TROP-1L', category: 'beverages', price: 2.80, barcode: '0012000161155' }],
  ['prod_009', { id: 'prod_009', name: 'Hobnobs 262g', sku: 'SNK-HOBN-262', category: 'biscuits', price: 1.80, barcode: '5000168241810' }],
  ['prod_010', { id: 'prod_010', name: 'Pot Noodle Chicken 90g', sku: 'FOD-POTN-90', category: 'food', price: 1.00, barcode: '5000118277829' }],
]);

const inventory = new Map([
  ['inv_001', { id: 'inv_001', productId: 'prod_001', quantity: 48, minQuantity: 12, location: 'aisle-1', updatedAt: new Date() }],
  ['inv_002', { id: 'inv_002', productId: 'prod_002', quantity: 36, minQuantity: 12, location: 'aisle-1', updatedAt: new Date() }],
  ['inv_003', { id: 'inv_003', productId: 'prod_003', quantity: 8,  minQuantity: 10, location: 'aisle-2', updatedAt: new Date() }],
  ['inv_004', { id: 'inv_004', productId: 'prod_004', quantity: 3,  minQuantity: 10, location: 'aisle-1', updatedAt: new Date() }],
  ['inv_005', { id: 'inv_005', productId: 'prod_005', quantity: 24, minQuantity: 15, location: 'aisle-3', updatedAt: new Date() }],
  ['inv_006', { id: 'inv_006', productId: 'prod_006', quantity: 0,  minQuantity: 5,  location: 'cabinet', updatedAt: new Date() }],
  ['inv_007', { id: 'inv_007', productId: 'prod_007', quantity: 18, minQuantity: 6,  location: 'aisle-4', updatedAt: new Date() }],
  ['inv_008', { id: 'inv_008', productId: 'prod_008', quantity: 12, minQuantity: 8,  location: 'fridge-1', updatedAt: new Date() }],
  ['inv_009', { id: 'inv_009', productId: 'prod_009', quantity: 6,  minQuantity: 8,  location: 'aisle-2', updatedAt: new Date() }],
  ['inv_010', { id: 'inv_010', productId: 'prod_010', quantity: 20, minQuantity: 10, location: 'aisle-3', updatedAt: new Date() }],
]);

const orders = new Map();

module.exports = {
  products,
  inventory,
  orders,
  newId: () => randomUUID(),
};
