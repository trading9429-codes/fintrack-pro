import http from 'node:http';
import fs from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.join(__dirname, 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');
const BUDGETS_FILE = path.join(DATA_DIR, 'budgets.json');
const SPLITS_FILE = path.join(DATA_DIR, 'splits.json');
const SAMPLE_FILE = path.join(DATA_DIR, 'sample_hdfc_transactions.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize data directory and file
if (!existsSync(DATA_DIR)) {
  fs.mkdir(DATA_DIR, { recursive: true });
}

if (!existsSync(TRANSACTIONS_FILE) && existsSync(SAMPLE_FILE)) {
  writeFileSync(TRANSACTIONS_FILE, readFileSync(SAMPLE_FILE, 'utf-8'), 'utf-8');
}

if (!existsSync(RULES_FILE)) {
  writeFileSync(RULES_FILE, '[]', 'utf-8');
}

if (!existsSync(SPLITS_FILE)) {
  writeFileSync(SPLITS_FILE, '[]', 'utf-8');
}

if (!existsSync(BUDGETS_FILE)) {
  const defaultBudgets = {
    dining: 15000,
    groceries: 20000,
    shopping: 12000,
    commute: 8000,
    utilities: 6000,
    entertainment: 5000,
    personal_care: 4000
  };
  writeFileSync(BUDGETS_FILE, JSON.stringify(defaultBudgets, null, 2), 'utf-8');
}

async function getTransactions() {
  try {
    const raw = await fs.readFile(TRANSACTIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function saveTransactions(data) {
  await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function getRules() {
  try {
    const raw = await fs.readFile(RULES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function saveRules(data) {
  await fs.writeFile(RULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function getBudgets() {
  try {
    const raw = await fs.readFile(BUDGETS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

async function saveBudgets(data) {
  await fs.writeFile(BUDGETS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function getSplits() {
  try {
    const raw = await fs.readFile(SPLITS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

async function saveSplits(data) {
  await fs.writeFile(SPLITS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/')) {
    try {
      // GET /api/transactions
      if (pathname === '/api/transactions' && method === 'GET') {
        const txs = await getTransactions();
        return sendJson(res, 200, { success: true, count: txs.length, data: txs });
      }

      // POST /api/transactions (Add single or bulk)
      if (pathname === '/api/transactions' && method === 'POST') {
        const body = await parseBody(req);
        const current = await getTransactions();
        
        if (Array.isArray(body.transactions)) {
          // Bulk append / merge
          const incoming = body.transactions;
          // Avoid duplicate ref/date/narration
          const existingKeys = new Set(current.map(t => `${t.date}_${t.narration}_${t.amount}`));
          const added = [];
          for (const item of incoming) {
            const key = `${item.date}_${item.narration}_${item.amount}`;
            if (!existingKeys.has(key)) {
              existingKeys.add(key);
              added.push(item);
            }
          }
          const updated = [...added, ...current].sort((a, b) => new Date(b.date) - new Date(a.date));
          await saveTransactions(updated);
          return sendJson(res, 201, { success: true, addedCount: added.length, total: updated.length, data: updated });
        } else if (body.transaction) {
          // Single item
          const newTx = body.transaction;
          if (!newTx.id) newTx.id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const updated = [newTx, ...current].sort((a, b) => new Date(b.date) - new Date(a.date));
          await saveTransactions(updated);
          return sendJson(res, 201, { success: true, transaction: newTx, total: updated.length });
        }
        return sendJson(res, 400, { success: false, error: 'Invalid payload. Expecting transaction or transactions array.' });
      }

      // PUT /api/transactions/:id (Update single transaction)
      if (pathname.startsWith('/api/transactions/') && method === 'PUT') {
        const id = pathname.replace('/api/transactions/', '');
        const body = await parseBody(req);
        const current = await getTransactions();
        const index = current.findIndex(t => t.id === id);

        if (index === -1) {
          return sendJson(res, 404, { success: false, error: 'Transaction not found' });
        }

        current[index] = { ...current[index], ...body };
        current.sort((a, b) => new Date(b.date) - new Date(a.date));
        await saveTransactions(current);
        return sendJson(res, 200, { success: true, transaction: current[index] });
      }

      // DELETE /api/transactions/:id (Delete single transaction)
      if (pathname.startsWith('/api/transactions/') && method === 'DELETE') {
        const id = pathname.replace('/api/transactions/', '');
        const current = await getTransactions();
        const filtered = current.filter(t => t.id !== id);

        if (filtered.length === current.length) {
          return sendJson(res, 404, { success: false, error: 'Transaction not found' });
        }

        await saveTransactions(filtered);
        return sendJson(res, 200, { success: true, remaining: filtered.length });
      }

      // POST /api/transactions/bulk-delete
      if (pathname === '/api/transactions/bulk-delete' && method === 'POST') {
        const body = await parseBody(req);
        const idsToDelete = new Set(body.ids || []);
        const current = await getTransactions();
        const filtered = current.filter(t => !idsToDelete.has(t.id));
        await saveTransactions(filtered);
        return sendJson(res, 200, { success: true, deleted: current.length - filtered.length, remaining: filtered.length });
      }

      // POST /api/transactions/bulk-update
      if (pathname === '/api/transactions/bulk-update' && method === 'POST') {
        const body = await parseBody(req);
        const { ids, updates } = body;
        const idSet = new Set(ids || []);
        const current = await getTransactions();
        let updatedCount = 0;
        for (let i = 0; i < current.length; i++) {
          if (idSet.has(current[i].id)) {
            current[i] = { ...current[i], ...updates };
            updatedCount++;
          }
        }
        await saveTransactions(current);
        return sendJson(res, 200, { success: true, updatedCount, total: current.length });
      }

      // POST /api/reset (Reset to initial sample transactions)
      if (pathname === '/api/reset' && method === 'POST') {
        if (existsSync(SAMPLE_FILE)) {
          const sample = readFileSync(SAMPLE_FILE, 'utf-8');
          await fs.writeFile(TRANSACTIONS_FILE, sample, 'utf-8');
          return sendJson(res, 200, { success: true, message: 'Database reset to realistic HDFC sample data', data: JSON.parse(sample) });
        }
        return sendJson(res, 404, { success: false, error: 'Sample dataset file not found' });
      }

      // POST /api/clear (Clear all transactions)
      if (pathname === '/api/clear' && method === 'POST') {
        await saveTransactions([]);
        return sendJson(res, 200, { success: true, message: 'All transactions cleared', data: [] });
      }

      // GET /api/rules
      if (pathname === '/api/rules' && method === 'GET') {
        const rules = await getRules();
        return sendJson(res, 200, { success: true, rules });
      }

      // POST /api/rules
      if (pathname === '/api/rules' && method === 'POST') {
        const body = await parseBody(req);
        const rules = Array.isArray(body.rules) ? body.rules : [];
        await saveRules(rules);
        return sendJson(res, 200, { success: true, count: rules.length, rules });
      }

      // GET /api/budgets
      if (pathname === '/api/budgets' && method === 'GET') {
        const budgets = await getBudgets();
        return sendJson(res, 200, { success: true, budgets });
      }

      // POST /api/budgets
      if (pathname === '/api/budgets' && method === 'POST') {
        const body = await parseBody(req);
        const budgets = body.budgets && typeof body.budgets === 'object' ? body.budgets : {};
        await saveBudgets(budgets);
        return sendJson(res, 200, { success: true, budgets });
      }

      // GET /api/splits
      if (pathname === '/api/splits' && method === 'GET') {
        const splits = await getSplits();
        return sendJson(res, 200, { success: true, splits });
      }

      // POST /api/splits
      if (pathname === '/api/splits' && method === 'POST') {
        const body = await parseBody(req);
        const splits = Array.isArray(body.splits) ? body.splits : [];
        await saveSplits(splits);
        return sendJson(res, 200, { success: true, count: splits.length, splits });
      }

      // GET /api/backup (Export full system snapshot)
      if (pathname === '/api/backup' && method === 'GET') {
        const txs = await getTransactions();
        const rules = await getRules();
        const budgets = await getBudgets();
        const splits = await getSplits();
        const payload = {
          version: '4.0',
          exportedAt: new Date().toISOString(),
          transactionCount: txs.length,
          transactions: txs,
          rules: rules,
          budgets: budgets,
          splits: splits
        };
        return sendJson(res, 200, { success: true, backup: payload });
      }

      // POST /api/restore (Restore full system snapshot)
      if (pathname === '/api/restore' && method === 'POST') {
        const body = await parseBody(req);
        if (!body || !Array.isArray(body.transactions)) {
          return sendJson(res, 400, { success: false, error: 'Invalid backup file structure: missing transactions array' });
        }
        await saveTransactions(body.transactions);
        if (Array.isArray(body.rules)) {
          await saveRules(body.rules);
        }
        if (body.budgets && typeof body.budgets === 'object') {
          await saveBudgets(body.budgets);
        }
        if (Array.isArray(body.splits)) {
          await saveSplits(body.splits);
        }
        return sendJson(res, 200, {
          success: true,
          restoredTransactions: body.transactions.length,
          restoredRules: (body.rules || []).length,
          restoredBudgets: Object.keys(body.budgets || {}).length,
          restoredSplits: (body.splits || []).length
        });
      }

      // Fallback 404 for unknown api
      return sendJson(res, 404, { success: false, error: `Endpoint ${pathname} not found` });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { success: false, error: err.message || 'Server error' });
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  try {
    let stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(` HDFC Expense & Income Tracker Web App is RUNNING! `);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
