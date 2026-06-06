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
    // Board IDs from Medically Modern pipeline
    const boardIds = [
      18407459988,  // P.S.O.
      18392794310,  // M.E.
      18406352652,  // Insurance
      18406060017,  // Welcome call / final profile review
      18410601299,  // Subscription board
      18410804557,  // Additional board
    ];

    // Search across all boards for matching phone number or name
    const response = await fetch(MONDAY_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': process.env.MONDAY_API_TOKEN,
      },
      body: JSON.stringify({
        query: `{
          boards(ids: [${boardIds.join(',')}]) {
            id name
            items_page(limit: 500) {
              items {
                id name
                group { title }
                column_values { id title text type }
              }
            }
          }
        }`,
      }),
    });

    const data = await response.json();
    const boards = data.data?.boards || [];

    // Normalize the query for matching
    const queryDigits = query.replace(/\D/g, '');
    const queryLower = query.toLowerCase().trim();
    const matches = [];

    for (const board of boards) {
      const items = board.items_page?.items || [];
      for (const item of items) {
        let matched = false;

        // Check item name (usually patient name)
        if (item.name && item.name.toLowerCase().includes(queryLower)) {
          matched = true;
        }

        // Check all column values for phone number match
        for (const col of item.column_values || []) {
          const val = (col.text || '').trim();
          if (!val) continue;

          // Phone match: compare last 10 digits
          if (queryDigits.length >= 10) {
            const colDigits = val.replace(/\D/g, '');
            if (colDigits.length >= 10 && colDigits.slice(-10) === queryDigits.slice(-10)) {
              matched = true;
            }
          }

          // Name match in column values
          if (queryLower.length > 2 && val.toLowerCase().includes(queryLower)) {
            matched = true;
          }
        }

        if (matched) {
          matches.push({
            name: item.name,
            board: board.name,
            group: item.group?.title || '',
            columns: (item.column_values || [])
              .filter(c => c.text)
              .reduce((acc, c) => {
                acc[c.title || c.id] = c.text;
                return acc;
              }, {}),
          });
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
