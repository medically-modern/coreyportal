import React, { useState, useEffect, useCallback } from 'react';
import { HelpCircle, X } from 'lucide-react';

// ── F4 Help Mode ──
// Press F4 anywhere: every button/control explains itself on hover.
// Clicks are paused while active (safe to explore). F4 or Esc exits.

const INTERACTIVE = 'button, a, input, textarea, select, [role="button"], [data-help], [title]';

// ── What every button actually DOES ──
// Matched against the control's label/title/href. First match wins.
const HELP_DICTIONARY = [
  // Elena (AI) actions — these spend AI tokens
  [/have elena organize/i, "Elena (AI) reads EVERY unread item and ranks them by priority with a reason for each. Labels are saved — they stay until you run it again. Costs one AI call."],
  [/get briefing|refresh briefing/i, "Elena (AI) reads your unread emails, texts, missed calls and team questions, then writes a morning-style briefing with what needs you first."],
  [/get elena'?s take|refresh take/i, "Elena (AI) analyzes this one item — checks patient history and context, tells you the urgency, what it's about, and the next step."],
  [/elena draft/i, "Elena (AI) writes a reply in Corey's voice based on the message. It lands in the box for you to edit — nothing sends until you press Send."],
  [/elena summarize|^summarize$/i, "Elena (AI) condenses this whole thread into the key points and what (if anything) you need to do."],
  [/chat with elena/i, "Opens the Elena chat page — ask her anything about patients, orders, or your channels."],
  [/breakdown|break.*down/i, "Elena (AI) splits this task into small, doable first steps."],

  // Acting on items
  [/^send$|sending\.\.\./i, "Sends the reply — emails go through Gmail in the same thread; texts go out via RingCentral SMS. Also marks the item processed."],
  [/mark processed/i, "Marks this as read/handled in the REAL system too (Gmail or RingCentral), not just in the portal. Use it when something needs no reply."],
  [/mark as handled|^done$/i, "Marks this item handled and moves you to the next one in the queue."],
  [/^snooze$|snooze for/i, "Hides this item until the time you pick. It moves to the Snoozed page (sidebar) with timestamps, and returns to your queue automatically."],
  [/skip this|^skip$/i, "Skips this item for now — it stays unread and will come back next time the queue loads. Nothing is changed."],
  [/^open$/i, "Jumps to this exact item in its full page — the specific email thread or text conversation, not just the tab."],
  [/view email/i, "Opens this email in the full Email page with the complete thread."],
  [/^history$/i, "Opens the full text-message history with this person in a side panel."],
  [/wake now/i, "Ends the snooze immediately — sends this item back to your active queue right now."],
  [/move to archive/i, "Archives this request — it leaves the pending list but can be restored from the Archived filter."],
  [/^restore$/i, "Brings this archived request back to pending."],
  [/^clear$/i, "Empties the reply box."],
  [/attach files/i, "Upload files (PDFs, images, docs) onto this request."],
  [/^view$/i, "Opens this file right inside the portal — PDFs and images render in a popup viewer, no download needed."],
  [/^download$/i, "Downloads a copy of this file to your computer."],

  // Views, filters, sorting
  [/^focus$/i, "Focus view: shows ONE item at a time so you can work top-down without getting overwhelmed. Handle it, snooze it, or skip it."],
  [/^all \(|^all$/i, "Shows everything at once — the full list/grid instead of one-at-a-time."],
  [/unprocessed/i, "Shows only unread items — the ones you haven't handled yet."],
  [/^pending$/i, "Requests waiting for your answer."],
  [/^answered$/i, "Requests you've already answered."],
  [/^archived$/i, "Requests you've archived — restorable anytime."],
  [/^urgency$/i, "Sort with the most urgent at the top."],
  [/^person$/i, "Sort alphabetically by who asked."],
  [/^category$/i, "Sort by request category."],
  [/^newest$/i, "Sort with the most recent first."],
  [/load more/i, "Loads the next page of older emails."],
  [/show more/i, "Reveals more conversations further down the list."],
  [/^elena$/i, "Toggles Elena's insights on the dashboard on or off."],

  // Search
  [/search by name or number/i, "One search for everything: type digits to find a conversation by phone number, or type a patient's name and it finds their number on file and pulls up their texts."],
  [/search emails/i, "Searches your Gmail — supports normal Gmail search (from:, subject:, has:attachment, etc.)."],

  // Sidebar destinations
  [/href:#\/$/i, "Dashboard — your whole world at a glance: one focus queue across emails, texts, and team questions."],
  [/href:#\/gmail/i, "Email page — full inbox with Elena's priority tags, reading pane, and reply box."],
  [/href:#\/ringcentral/i, "Texts & Calls — every patient conversation, with names from your patient records, search, and SMS replies."],
  [/href:#\/questions/i, "Team Questions — requests your team submitted, one at a time in Focus view."],
  [/href:#\/snoozed/i, "Snoozed — everything you've snoozed, when it was snoozed, and when it comes back."],
  [/href:#\/projects/i, "Projects — kanban boards. Drag cards between columns or onto each other to reorder."],
  [/href:#\/notes/i, "Parking Lot — quick scratch notes so a thought doesn't derail what you're doing."],
  [/href:#\/trash/i, "Trash — deleted items, restorable until emptied."],
  [/href:#\/assistant/i, "Elena — full chat with your AI assistant."],

  // Misc
  [/refresh/i, "Re-fetches the latest data from the server right now."],
  [/add to .*\.\.\./i, "Type here and press Enter to add a new task to this column."],
  [/drag a task here/i, "Drop a task card here to assign it to this person."],
];

function lookupHelp(haystack) {
  for (const [pattern, help] of HELP_DICTIONARY) {
    if (pattern.test(haystack)) return help;
  }
  return null;
}

function helpTextFor(el) {
  if (!el) return null;
  // Explicit data-help always wins
  const dataHelp = el.getAttribute('data-help');
  if (dataHelp) return dataHelp;

  const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ');
  const href = el.getAttribute('href') ? `href:${el.getAttribute('href')}` : '';
  const placeholder = el.placeholder || '';

  // Try the functionality dictionary against everything we know about it
  const known = lookupHelp(`${title} ${text.slice(0, 60)} ${placeholder} ${href}`);
  if (known) return known;

  // Fall back to the control's own description
  if (title) return title;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    return placeholder ? `Type here — ${placeholder}` : 'Text input';
  }
  if (tag === 'select') return 'Choose an option';
  if (text) return text.length > 90 ? `${text.slice(0, 90)}...` : `"${text}" — click to open`;
  return tag === 'a' ? 'Link' : 'Button';
}

export default function HelpMode() {
  const [active, setActive] = useState(false);
  const [tip, setTip] = useState(null); // {x, y, text}

  // F4 toggles; Esc exits
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'F4') {
        e.preventDefault();
        setActive(prev => !prev);
        setTip(null);
      } else if (e.key === 'Escape' && active) {
        setActive(false);
        setTip(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // Outline interactive elements while active
  useEffect(() => {
    document.body.classList.toggle('help-mode', active);
    return () => document.body.classList.remove('help-mode');
  }, [active]);

  // Hover → tooltip
  const onMove = useCallback((e) => {
    const el = e.target.closest?.(INTERACTIVE);
    if (!el || el.closest('[data-help-ui]')) { setTip(null); return; }
    const text = helpTextFor(el);
    if (!text) { setTip(null); return; }
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    const below = r.bottom + 10;
    const y = below > window.innerHeight - 70 ? r.top - 10 : below;
    setTip({ x, y, above: below > window.innerHeight - 70, text });
  }, []);

  // Pause real clicks while exploring (except help-mode's own UI)
  const onClickCapture = useCallback((e) => {
    if (e.target.closest?.('[data-help-ui]')) return;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    if (!active) return;
    document.addEventListener('mouseover', onMove, true);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      document.removeEventListener('mouseover', onMove, true);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [active, onMove, onClickCapture]);

  if (!active) return null;

  return (
    <>
      {/* Banner */}
      <div data-help-ui className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-800 border-2 border-brand-500/40 shadow-2xl shadow-black/40 animate-slide-down">
        <HelpCircle size={16} className="text-brand-400" />
        <span className="text-sm text-surface-100">
          <span className="font-semibold text-brand-400">Help Mode</span> — hover any button to see what it does. Clicks are paused.
        </span>
        <span className="text-xs text-surface-200/40 bg-surface-200/10 px-2 py-0.5 rounded-md font-mono">F4 to exit</span>
        <button
          data-help-ui
          onClick={() => { setActive(false); setTip(null); }}
          className="text-surface-200/40 hover:text-white transition"
          title="Exit help mode"
        >
          <X size={15} />
        </button>
      </div>

      {/* Hover tooltip */}
      {tip && (
        <div
          className="fixed z-[100] pointer-events-none max-w-[260px] px-3 py-2 rounded-lg bg-surface-800 border border-brand-500/40 shadow-xl shadow-black/40 text-xs text-surface-100 leading-snug text-center"
          style={{
            left: tip.x,
            top: tip.y,
            transform: `translate(-50%, ${tip.above ? '-100%' : '0'})`,
          }}
        >
          {tip.text}
        </div>
      )}
    </>
  );
}
