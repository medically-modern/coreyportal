import { Router } from 'express';

const router = Router();

const MONDAY_API = 'https://api.monday.com/v2';

const BOARD_IDS = [
  18407459988,  // Subscription Board
  18392794310,  // DTC Intake Board
  18406352652,  // Profile Send Off Board
  18406060017,  // Medical Evaluation
  18410601299,  // Insurance
  18410804557,  // Welcome Call
  18070135692,  // Force Board
];

// ─── In-memory patient index ───
// phone (last 10 digits) → [{name, board, group}]
// name (lowercase) → [{name, board, group}]
let phoneIndex = new Map();
let nameIndex = new Map();
let indexReady = false;
let indexBuilding = false;
let lastIndexTime = 0;
const INDEX_TTL = 15 * 60 * 1000; // 15 minutes

async function buildIndex() {
  if (!process.env.MONDAY_API_TOKEN) return;
  if (indexBuilding) return;
  indexBuilding = true;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': process.env.MONDAY_API_TOKEN,
  };

  const newPhoneIndex = new Map();
  const newNameIndex = new Map();
  let totalItems = 0;

  try {
    for (const boardId of BOARD_IDS) {
      // Fetch items with phone columns, paginate fully
      let cursor = null;
      let firstPage = true;
      let boardName = '';

      while (firstPage || cursor) {
        firstPage = false;
        let query;
        if (!cursor) {
          query = `{ boards(ids: [${boardId}]) { name items_page(limit: 500) { cursor items { id name group { title } column_values(types: [phone]) { id text } } } } }`;
        } else {
          query = `{ next_items_page(limit: 500, cursor: "${cursor}") { cursor items { id name group { title } column_values(types: [phone]) { id text } } } }`;
        }

        const res = await fetch(MONDAY_API, { method: 'POST', headers, body: JSON.stringify({ query }) });
        const data = await res.json();

        let items, nextCursor;
        if (!cursor) {
          const board = data.data?.boards?.[0];
          if (!board) break;
          boardName = board.name;
          items = board.items_page?.items || [];
          nextCursor = board.items_page?.cursor;
        } else {
          const page = data.data?.next_items_page || {};
          items = page.items || [];
          nextCursor = page.cursor;
        }

        for (const item of items) {
          totalItems++;
          const entry = { name: item.name, board: boardName, group: item.group?.title || '' };

          // Index by name
          const nameLower = (item.name || '').toLowerCase().trim();
          if (nameLower) {
            if (!newNameIndex.has(nameLower)) newNameIndex.set(nameLower, []);
            newNameIndex.get(nameLower).push(entry);
          }

          // Index by phone (last 10 digits)
          for (const col of item.column_values || []) {
            const val = (col.text || '').trim();
            if (!val) continue;
            const digits = val.replace(/\D/g, '');
            if (digits.length >= 10) {
              const key = digits.slice(-10);
              if (!newPhoneIndex.has(key)) newPhoneIndex.set(key, []);
              newPhoneIndex.get(key).push(entry);
            }
          }
        }

        cursor = nextCursor;
      }
    }

    phoneIndex = newPhoneIndex;
    nameIndex = newNameIndex;
    indexReady = true;
    lastIndexTime = Date.now();
    console.log(`[Monday] Index built: ${totalItems} items, ${newPhoneIndex.size} phones, ${newNameIndex.size} names`);
  } catch (err) {
    console.error('[Monday] Index build failed:', err.message);
  } finally {
    indexBuilding = false;
  }
}

// Build index on startup (non-blocking)
setTimeout(() => buildIndex(), 2000);

// Ensure index is fresh — returns true if ready
async function ensureIndex() {
  if (indexReady && (Date.now() - lastIndexTime < INDEX_TTL)) return true;
  if (!indexBuilding) buildIndex(); // fire and forget refresh
  return indexReady; // return current state even if stale
}

// ─── Search function ───
export async function searchMondayPatient(query) {
  if (!process.env.MONDAY_API_TOKEN) return null;

  await ensureIndex();

  const queryDigits = query.replace(/\D/g, '');
  const queryLower = query.toLowerCase().trim();
  const isPhoneSearch = queryDigits.length >= 10;

  // Phone search — instant from cache
  if (isPhoneSearch && indexReady) {
    const key = queryDigits.slice(-10);
    const results = phoneIndex.get(key);
    if (results && results.length > 0) {
      return results.map(r => ({ ...r, columns: {} }));
    }
    // Phone not found in index
    return null;
  }

  // Name search — instant from cache
  if (indexReady) {
    const matches = [];
    for (const [name, entries] of nameIndex) {
      if (name.includes(queryLower)) {
        matches.push(...entries.map(r => ({ ...r, columns: {} })));
      }
    }
    if (matches.length > 0) return matches;
  }

  // Fallback: index not ready, do a quick name-only live query
  if (!indexReady) {
    console.log('[Monday] Index not ready, falling back to live query');
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': process.env.MONDAY_API_TOKEN,
      };
      const nameRes = await fetch(MONDAY_API, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `{ boards(ids: [${BOARD_IDS.join(',')}]) { id name items_page(limit: 500) { items { id name group { title } } } } }`,
        }),
      });
      const nameData = await nameRes.json();
      const matches = [];
      for (const board of nameData.data?.boards || []) {
        for (const item of board.items_page?.items || []) {
          if (item.name && item.name.toLowerCase().includes(queryLower)) {
            matches.push({ name: item.name, board: board.name, group: item.group?.title || '', columns: {} });
          }
        }
      }
      return matches.length > 0 ? matches : null;
    } catch (err) {
      console.error('Monday fallback search error:', err.message);
      return null;
    }
  }

  return null;
}

// ─── Routes ───

router.get('/boards', async (req, res) => {
  if (!process.env.MONDAY_API_TOKEN) {
    return res.json({ boards: [], message: 'Monday API not configured' });
  }

  try {
    const response = await fetch(MONDAY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MONDAY_API_TOKEN,
      },
      body: JSON.stringify({
        query: `{
          boards(limit: 10) {
            id name
            items_page(limit: 25) {
              items {
                id name
                column_values { id text }
                group { title }
              }
            }
          }
        }`,
      }),
    });

    const data = await response.json();
    res.json({ boards: data.data?.boards || [] });
  } catch (err) {
    console.error('Monday API error:', err);
    res.status(500).json({ error: 'Monday API failed' });
  }
});

router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });
  const results = await searchMondayPatient(q);
  res.json({ results: results || [] });
});

// Force index rebuild
router.post('/reindex', async (req, res) => {
  lastIndexTime = 0;
  buildIndex();
  res.json({ status: 'reindexing', message: 'Index rebuild started' });
});

// Index status
router.get('/index-status', (req, res) => {
  res.json({
    ready: indexReady,
    building: indexBuilding,
    phones: phoneIndex.size,
    names: nameIndex.size,
    lastBuilt: lastIndexTime ? new Date(lastIndexTime).toISOString() : null,
    ttlRemaining: indexReady ? Math.max(0, INDEX_TTL - (Date.now() - lastIndexTime)) : 0,
  });
});

export default router;
