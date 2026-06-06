import { Router } from 'express';

const router = Router();

const MONDAY_API = 'https://api.monday.com/v2';

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

// Search for a patient across all boards by phone number or name
export async function searchMondayPatient(query) {
  if (!process.env.MONDAY_API_TOKEN) return null;

  try {
    const boardIds = [
      18407459988,  // Subscription Board
      18392794310,  // DTC Intake Board
      18406352652,  // Profile Send Off Board
      18406060017,  // Medical Evaluation
      18410601299,  // Insurance
      18410804557,  // Welcome Call
    ];

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': process.env.MONDAY_API_TOKEN,
    };

    const queryDigits = query.replace(/\D/g, '');
    const queryLower = query.toLowerCase().trim();
    const isPhoneSearch = queryDigits.length >= 10;

    // STEP 1: Fast name-only search (tiny payload — just item names + groups)
    const nameRes = await fetch(MONDAY_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: `{
          boards(ids: [${boardIds.join(',')}]) {
            id name
            items_page(limit: 500) {
              cursor
              items { id name group { title } }
            }
          }
        }`,
      }),
    });
    const nameData = await nameRes.json();
    if (nameData.errors) {
      console.error('Monday name search error:', nameData.errors);
      return null;
    }

    const matches = [];
    const boardsWithNames = nameData.data?.boards || [];

    // Check names across all boards
    for (const board of boardsWithNames) {
      for (const item of board.items_page?.items || []) {
        if (item.name && item.name.toLowerCase().includes(queryLower)) {
          matches.push({ name: item.name, board: board.name, group: item.group?.title || '', columns: {} });
        }
      }
    }

    // Also check overflow boards for name matches
    if (matches.length === 0) {
      for (const board of boardsWithNames) {
        let cursor = board.items_page?.cursor;
        while (cursor) {
          const r = await fetch(MONDAY_API, { method: 'POST', headers,
            body: JSON.stringify({ query: `{ next_items_page(limit: 500, cursor: "${cursor}") { cursor items { id name group { title } } } }` })
          });
          const d = await r.json();
          const page = d.data?.next_items_page || {};
          for (const item of page.items || []) {
            if (item.name && item.name.toLowerCase().includes(queryLower)) {
              matches.push({ name: item.name, board: board.name, group: item.group?.title || '', columns: {} });
            }
          }
          cursor = page.cursor;
          if (matches.length > 0) break;
        }
      }
    }

    if (matches.length > 0) return matches;

    // STEP 2: Phone search — query each board for ONLY phone-type columns
    if (isPhoneSearch) {
      for (const boardId of boardIds) {
        // First get the board's phone column IDs
        const colRes = await fetch(MONDAY_API, { method: 'POST', headers,
          body: JSON.stringify({ query: `{ boards(ids: [${boardId}]) { name columns(types: [phone]) { id } items_page(limit: 500) { cursor items { id name group { title } column_values(types: [phone]) { id text } } } } }` })
        });
        const colData = await colRes.json();
        const board = colData.data?.boards?.[0];
        if (!board) continue;

        const searchItems = (items) => {
          for (const item of items) {
            for (const col of item.column_values || []) {
              const val = (col.text || '').trim();
              if (!val) continue;
              const colDigits = val.replace(/\D/g, '');
              if (colDigits.length >= 10 && colDigits.slice(-10) === queryDigits.slice(-10)) {
                matches.push({ name: item.name, board: board.name, group: item.group?.title || '', columns: {} });
              }
            }
          }
        };

        searchItems(board.items_page?.items || []);
        if (matches.length > 0) return matches;

        // Paginate if overflow
        let cursor = board.items_page?.cursor;
        while (cursor) {
          const r = await fetch(MONDAY_API, { method: 'POST', headers,
            body: JSON.stringify({ query: `{ next_items_page(limit: 500, cursor: "${cursor}") { cursor items { id name group { title } column_values(types: [phone]) { id text } } } }` })
          });
          const d = await r.json();
          const page = d.data?.next_items_page || {};
          searchItems(page.items || []);
          if (matches.length > 0) return matches;
          cursor = page.cursor;
        }
      }
    }

    return matches.length > 0 ? matches : null;
  } catch (err) {
    console.error('Monday patient search error:', err);
    return null;
  }
}

// Expose search as an API route too
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q parameter required' });
  const results = await searchMondayPatient(q);
  res.json({ results: results || [] });
});

export default router;
