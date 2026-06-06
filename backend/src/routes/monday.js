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

export default router;
