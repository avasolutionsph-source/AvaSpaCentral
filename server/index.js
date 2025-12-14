/**
 * Mock Backend Server for SPA ERP
 *
 * A simple Express server that provides sync endpoints for testing
 * the frontend sync functionality.
 *
 * Run with: npm start (or npm run dev for auto-reload)
 * Default port: 3001
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// In-memory data store (simulates a database)
const dataStore = {
  products: [],
  employees: [],
  customers: [],
  suppliers: [],
  rooms: [],
  transactions: [],
  appointments: [],
  expenses: [],
  giftCertificates: [],
  purchaseOrders: [],
  attendance: [],
  shiftSchedules: [],
  activityLogs: []
};

// Sync metadata tracking
const syncMetadata = {};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================================================
// SYNC ENDPOINTS
// ============================================================================

// GET /api/sync/:entityType - Get all entities (with optional since filter)
app.get('/api/sync/:entityType', (req, res) => {
  const { entityType } = req.params;
  const { since } = req.query;

  if (!dataStore[entityType]) {
    return res.status(404).json({ error: `Unknown entity type: ${entityType}` });
  }

  let items = dataStore[entityType];

  // Filter by timestamp if 'since' is provided
  if (since) {
    const sinceDate = new Date(since);
    items = items.filter(item => {
      const itemDate = new Date(item._updatedAt || item.createdAt || item._id);
      return itemDate > sinceDate;
    });
  }

  res.json({
    items,
    timestamp: new Date().toISOString(),
    count: items.length
  });
});

// POST /api/sync/:entityType - Create a new entity
app.post('/api/sync/:entityType', (req, res) => {
  const { entityType } = req.params;
  const data = req.body;

  if (!dataStore[entityType]) {
    return res.status(404).json({ error: `Unknown entity type: ${entityType}` });
  }

  // Ensure _id exists
  if (!data._id) {
    data._id = `${entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add timestamps
  data._createdAt = data._createdAt || new Date().toISOString();
  data._updatedAt = new Date().toISOString();

  // Check for duplicates and update if exists
  const existingIndex = dataStore[entityType].findIndex(item => item._id === data._id);
  if (existingIndex >= 0) {
    dataStore[entityType][existingIndex] = data;
  } else {
    dataStore[entityType].push(data);
  }

  console.log(`[Sync] Created/Updated ${entityType}: ${data._id}`);

  res.status(201).json({
    success: true,
    item: data,
    timestamp: new Date().toISOString()
  });
});

// PUT /api/sync/:entityType/:id - Update an entity
app.put('/api/sync/:entityType/:id', (req, res) => {
  const { entityType, id } = req.params;
  const data = req.body;

  if (!dataStore[entityType]) {
    return res.status(404).json({ error: `Unknown entity type: ${entityType}` });
  }

  const index = dataStore[entityType].findIndex(item => item._id === id);
  if (index === -1) {
    return res.status(404).json({ error: `Entity not found: ${id}` });
  }

  // Update timestamps
  data._updatedAt = new Date().toISOString();
  dataStore[entityType][index] = { ...dataStore[entityType][index], ...data };

  console.log(`[Sync] Updated ${entityType}: ${id}`);

  res.json({
    success: true,
    item: dataStore[entityType][index],
    timestamp: new Date().toISOString()
  });
});

// DELETE /api/sync/:entityType/:id - Delete an entity
app.delete('/api/sync/:entityType/:id', (req, res) => {
  const { entityType, id } = req.params;

  if (!dataStore[entityType]) {
    return res.status(404).json({ error: `Unknown entity type: ${entityType}` });
  }

  const index = dataStore[entityType].findIndex(item => item._id === id);
  if (index === -1) {
    // Return success even if not found (idempotent delete)
    return res.json({
      success: true,
      message: 'Entity already deleted or not found',
      timestamp: new Date().toISOString()
    });
  }

  dataStore[entityType].splice(index, 1);
  console.log(`[Sync] Deleted ${entityType}: ${id}`);

  res.json({
    success: true,
    timestamp: new Date().toISOString()
  });
});

// POST /api/sync/:entityType/bulk - Bulk upsert entities
app.post('/api/sync/:entityType/bulk', (req, res) => {
  const { entityType } = req.params;
  const { items } = req.body;

  if (!dataStore[entityType]) {
    return res.status(404).json({ error: `Unknown entity type: ${entityType}` });
  }

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }

  let created = 0;
  let updated = 0;

  for (const item of items) {
    if (!item._id) {
      item._id = `${entityType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    item._updatedAt = new Date().toISOString();

    const existingIndex = dataStore[entityType].findIndex(e => e._id === item._id);
    if (existingIndex >= 0) {
      dataStore[entityType][existingIndex] = item;
      updated++;
    } else {
      item._createdAt = item._createdAt || new Date().toISOString();
      dataStore[entityType].push(item);
      created++;
    }
  }

  // Update sync metadata
  syncMetadata[entityType] = {
    lastBulkSync: new Date().toISOString(),
    totalItems: dataStore[entityType].length
  };

  console.log(`[Sync] Bulk ${entityType}: ${created} created, ${updated} updated`);

  res.json({
    success: true,
    created,
    updated,
    total: dataStore[entityType].length,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// ADMIN/DEBUG ENDPOINTS
// ============================================================================

// GET /api/admin/stats - Get data store statistics
app.get('/api/admin/stats', (req, res) => {
  const stats = {};
  for (const [key, value] of Object.entries(dataStore)) {
    stats[key] = value.length;
  }

  res.json({
    stats,
    syncMetadata,
    timestamp: new Date().toISOString()
  });
});

// DELETE /api/admin/reset - Clear all data
app.delete('/api/admin/reset', (req, res) => {
  for (const key of Object.keys(dataStore)) {
    dataStore[key] = [];
  }

  console.log('[Admin] All data cleared');

  res.json({
    success: true,
    message: 'All data cleared',
    timestamp: new Date().toISOString()
  });
});

// GET /api/admin/export - Export all data as JSON
app.get('/api/admin/export', (req, res) => {
  res.json({
    exportDate: new Date().toISOString(),
    data: dataStore,
    syncMetadata
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('============================================');
  console.log(`  SPA ERP Mock Backend Server`);
  console.log('============================================');
  console.log(`  Status: Running`);
  console.log(`  Port: ${PORT}`);
  console.log(`  API Base: http://localhost:${PORT}/api`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /api/health              - Health check');
  console.log('    GET  /api/sync/:type          - Get entities');
  console.log('    POST /api/sync/:type          - Create entity');
  console.log('    PUT  /api/sync/:type/:id      - Update entity');
  console.log('    DELETE /api/sync/:type/:id    - Delete entity');
  console.log('    POST /api/sync/:type/bulk     - Bulk upsert');
  console.log('');
  console.log('  Admin:');
  console.log('    GET  /api/admin/stats         - Data statistics');
  console.log('    DELETE /api/admin/reset       - Clear all data');
  console.log('    GET  /api/admin/export        - Export all data');
  console.log('============================================');
});
