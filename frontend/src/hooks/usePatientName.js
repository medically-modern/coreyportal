import { useState, useEffect } from 'react';
import { api } from '../services/api';

// Resolves a phone number → patient name via the Monday index.
// Module-level cache: each unique phone is only looked up once per session.
const nameCache = new Map(); // last-10-digits -> string | null

export function usePatientName(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  const key = digits.length >= 10 ? digits.slice(-10) : null;
  const [name, setName] = useState(() => (key && nameCache.has(key) ? nameCache.get(key) : null));

  useEffect(() => {
    if (!key) { setName(null); return; }
    if (nameCache.has(key)) { setName(nameCache.get(key)); return; }
    let cancelled = false;
    api.mondaySearch(phone)
      .then(res => {
        const n = res.results?.[0]?.name || null;
        nameCache.set(key, n);
        if (!cancelled) setName(n);
      })
      .catch(() => { if (!cancelled) setName(null); });
    return () => { cancelled = true; };
  }, [key]);

  return name;
}
