import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

// ---- INIT TABLES ----
function ensureTables() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      archived INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS project_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      column_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'normal',
      color TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      due_date TEXT DEFAULT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (column_id) REFERENCES project_columns(id) ON DELETE CASCADE
    );
  `);
}

// ---- PROJECTS ----

// List all projects
router.get('/', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const projects = db.prepare(
      'SELECT * FROM projects WHERE archived = 0 ORDER BY sort_order, created_at DESC'
    ).all();
    res.json({ projects });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create project (with default columns)
router.post('/', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const result = db.prepare(
      'INSERT INTO projects (name, color) VALUES (?, ?)'
    ).run(name, color || '#6366f1');

    const projectId = result.lastInsertRowid;

    // Create default columns
    const defaultCols = ['To Do', 'In Progress', 'Done'];
    const insertCol = db.prepare(
      'INSERT INTO project_columns (project_id, name, sort_order) VALUES (?, ?, ?)'
    );
    defaultCols.forEach((col, i) => insertCol.run(projectId, col, i));

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const columns = db.prepare('SELECT * FROM project_columns WHERE project_id = ? ORDER BY sort_order').all(projectId);
    res.json({ project: { ...project, columns, tasks: [] } });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete (archive) project
router.delete('/:id', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    db.prepare('UPDATE projects SET archived = 1 WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project name/color
router.patch('/:id', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { name, color } = req.body;
    if (name) db.prepare('UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, req.params.id);
    if (color) db.prepare('UPDATE projects SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(color, req.params.id);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- BOARD (columns + tasks for a project) ----

router.get('/:id/board', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const columns = db.prepare(
      'SELECT * FROM project_columns WHERE project_id = ? ORDER BY sort_order'
    ).all(req.params.id);

    const tasks = db.prepare(
      'SELECT * FROM project_tasks WHERE project_id = ? ORDER BY sort_order'
    ).all(req.params.id);

    res.json({ project, columns, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- COLUMNS ----

router.post('/:id/columns', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM project_columns WHERE project_id = ?').get(req.params.id);
    const result = db.prepare(
      'INSERT INTO project_columns (project_id, name, sort_order) VALUES (?, ?, ?)'
    ).run(req.params.id, name, (maxOrder?.m || 0) + 1);
    const column = db.prepare('SELECT * FROM project_columns WHERE id = ?').get(result.lastInsertRowid);
    res.json({ column });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:projectId/columns/:colId', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    // Move tasks to first column or delete them
    const firstCol = db.prepare(
      'SELECT id FROM project_columns WHERE project_id = ? AND id != ? ORDER BY sort_order LIMIT 1'
    ).get(req.params.projectId, req.params.colId);
    if (firstCol) {
      db.prepare('UPDATE project_tasks SET column_id = ? WHERE column_id = ?').run(firstCol.id, req.params.colId);
    } else {
      db.prepare('DELETE FROM project_tasks WHERE column_id = ?').run(req.params.colId);
    }
    db.prepare('DELETE FROM project_columns WHERE id = ?').run(req.params.colId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- TASKS ----

router.post('/:id/tasks', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { title, column_id, description, priority, color, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!column_id) return res.status(400).json({ error: 'column_id required' });

    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM project_tasks WHERE column_id = ?').get(column_id);
    const result = db.prepare(
      'INSERT INTO project_tasks (project_id, column_id, title, description, priority, color, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, column_id, title, description || '', priority || 'normal', color || '', due_date || null, (maxOrder?.m || 0) + 1);

    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(result.lastInsertRowid);
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:projectId/tasks/:taskId', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { title, description, priority, color, column_id, sort_order, completed, due_date } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (column_id !== undefined) { updates.push('column_id = ?'); values.push(column_id); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (completed !== undefined) { updates.push('completed = ?'); values.push(completed ? 1 : 0); }
    if (due_date !== undefined) { updates.push('due_date = ?'); values.push(due_date); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(req.params.taskId);
      db.prepare(`UPDATE project_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(req.params.taskId);
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:projectId/tasks/:taskId', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    db.prepare('DELETE FROM project_tasks WHERE id = ?').run(req.params.taskId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move task to different column (drag and drop)
router.post('/:projectId/tasks/:taskId/move', (req, res) => {
  try {
    ensureTables();
    const db = getDb();
    const { column_id, sort_order } = req.body;
    db.prepare(
      'UPDATE project_tasks SET column_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(column_id, sort_order || 0, req.params.taskId);
    const task = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(req.params.taskId);
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
