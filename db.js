/**
 * Database Layer – Local PostgreSQL (formerly Supabase)
 * 
 * Drop-in replacement using raw postgres.js queries.
 * Every exported function signature is identical to the old Supabase wrapper
 * so all route files continue to work without changes.
 */

const postgres = require('postgres');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'push_admin'}:${process.env.POSTGRES_PASSWORD || 'changeme'}@${process.env.POSTGRES_HOST || 'postgres'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'beacon'}`;
const sql = postgres(databaseUrl);

// Legacy compat: some routes still import `db` for direct queries.
// We expose a thin shim that mimics the db-js chaining API for the
// patterns actually used in the codebase (.from().select().eq()... etc.)
const db = {
  from: (table) => {
    let _table = table;
    let _select = '*';
    let _filters = [];
    let _inFilters = [];
    let _insertData = null;
    let _updateData = null;
    let _deleteMode = false;
    let _upsertData = null;
    let _single = false;
    let _limit = null;
    let _offset = null;
    let _orderCol = null;
    let _orderAsc = true;
    let _countMode = false;
    let _headMode = false;

    const chain = {
      select: (cols, opts) => {
        _select = cols || '*';
        if (opts && opts.count === 'exact') _countMode = true;
        if (opts && opts.head) _headMode = true;
        return chain;
      },
      eq: (col, val) => { _filters.push({ col, op: '=', val }); return chain; },
      neq: (col, val) => { _filters.push({ col, op: '!=', val }); return chain; },
      gt: (col, val) => { _filters.push({ col, op: '>', val }); return chain; },
      gte: (col, val) => { _filters.push({ col, op: '>=', val }); return chain; },
      lt: (col, val) => { _filters.push({ col, op: '<', val }); return chain; },
      lte: (col, val) => { _filters.push({ col, op: '<=', val }); return chain; },
      in: (col, vals) => { _inFilters.push({ col, vals }); return chain; },
      limit: (n) => { _limit = n; return chain; },
      single: () => { _single = true; return chain; },
      order: (col, opts) => { _orderCol = col; _orderAsc = opts?.ascending !== false; return chain; },
      range: (from, to) => { _offset = from; _limit = to - from + 1; return chain; },

      insert: (rows) => { _insertData = Array.isArray(rows) ? rows : [rows]; return chain; },
      update: (data) => { _updateData = data; return chain; },
      upsert: (data) => { _upsertData = Array.isArray(data) ? data : [data]; return chain; },
      delete: () => { _deleteMode = true; return chain; },

      // Terminal: execute the built query
      then: async (resolve, reject) => {
        try {
          const result = await _execute();
          resolve(result);
        } catch (err) {
          if (reject) reject(err);
          else resolve({ data: null, error: err });
        }
      },
    };

    async function _execute() {
      try {
        // --- DELETE ---
        if (_deleteMode) {
          const where = _buildWhere();
          const rows = await sql.unsafe(`DELETE FROM "${_table}" ${where.text} RETURNING *`, where.values);
          return { data: rows, error: null };
        }

        // --- INSERT ---
        if (_insertData) {
          const results = [];
          for (const row of _insertData) {
            const safeRow = Object.fromEntries(Object.entries(row).filter(([_, v]) => v !== undefined));
            const cols = Object.keys(safeRow);
            const vals = Object.values(safeRow).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const colStr = cols.map(c => `"${c}"`).join(', ');
            const r = await sql.unsafe(
              `INSERT INTO "${_table}" (${colStr}) VALUES (${placeholders}) RETURNING *`,
              vals
            );
            results.push(...r);
          }
          if (_single && results.length > 0) return { data: results[0], error: null };
          return { data: results, error: null };
        }

        // --- UPSERT ---
        if (_upsertData) {
          // BUG-06 FIX: Use a table-to-PK lookup instead of the broken "first column" heuristic
          const TABLE_PK_MAP = {
            websites: 'id',
            subscriptions: 'endpoint',
            notifications: 'id',
            settings: 'key',
          };
          
          const results = [];
          for (const row of _upsertData) {
            const safeRow = Object.fromEntries(Object.entries(row).filter(([_, v]) => v !== undefined));
            const cols = Object.keys(safeRow);
            const vals = Object.values(safeRow).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
            const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
            const colStr = cols.map(c => `"${c}"`).join(', ');
            // Use the real primary key from our lookup, falling back to 'id'
            const pk = TABLE_PK_MAP[_table] || 'id';
            const nonPkCols = cols.filter(c => c !== pk);
            const updateStr = nonPkCols.map(c => {
              const idx = cols.indexOf(c);
              return `"${c}" = $${idx + 1}`;
            }).join(', ');
            
            if (updateStr.length === 0) {
              // If only the PK column is present, do nothing on conflict
              const r = await sql.unsafe(
                `INSERT INTO "${_table}" (${colStr}) VALUES (${placeholders}) ON CONFLICT ("${pk}") DO NOTHING RETURNING *`,
                vals
              );
              results.push(...r);
            } else {
              const r = await sql.unsafe(
                `INSERT INTO "${_table}" (${colStr}) VALUES (${placeholders}) ON CONFLICT ("${pk}") DO UPDATE SET ${updateStr} RETURNING *`,
                vals
              );
              results.push(...r);
            }
          }
          if (_single && results.length > 0) return { data: results[0], error: null };
          return { data: results, error: null };
        }

        // --- UPDATE ---
        if (_updateData) {
          const safeData = Object.fromEntries(Object.entries(_updateData).filter(([_, v]) => v !== undefined));
          const setCols = Object.keys(safeData);
          const setVals = Object.values(safeData).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
          const setStr = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
          const where = _buildWhere(setVals.length);
          const allVals = [...setVals, ...where.values];
          const rows = await sql.unsafe(
            `UPDATE "${_table}" SET ${setStr} ${where.text} RETURNING *`,
            allVals
          );
          return { data: rows, error: null };
        }

        // --- SELECT ---
        if (_countMode && _headMode) {
          const where = _buildWhere();
          const rows = await sql.unsafe(`SELECT COUNT(*) as count FROM "${_table}" ${where.text}`, where.values);
          return { count: parseInt(rows[0].count), data: null, error: null };
        }

        const where = _buildWhere();
        // Build column list — don't quote *, and handle mixed selects like '*, data'
        let selectCols;
        if (_select === '*') {
          selectCols = '*';
        } else {
          selectCols = _select.split(',').map(c => {
            const col = c.trim();
            if (col === '*') return '*';
            return `"${col}"`;
          }).join(', ');
        }
        let query = `SELECT ${selectCols} FROM "${_table}" ${where.text}`;
        if (_orderCol) query += ` ORDER BY "${_orderCol}" ${_orderAsc ? 'ASC' : 'DESC'}`;
        if (_limit) query += ` LIMIT ${_limit}`;
        if (_offset) query += ` OFFSET ${_offset}`;

        const rows = await sql.unsafe(query, where.values);

        if (_single) {
          if (rows.length === 0) {
            return { data: null, error: { code: 'PGRST116', message: 'Not found' } };
          }
          return { data: rows[0], error: null };
        }

        return { data: rows, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    function _buildWhere(offset = 0) {
      const clauses = [];
      const values = [];
      let idx = offset;

      for (const f of _filters) {
        idx++;
        clauses.push(`"${f.col}" ${f.op} $${idx}`);
        values.push(f.val);
      }

      for (const inf of _inFilters) {
        const placeholders = inf.vals.map((_, i) => `$${idx + i + 1}`).join(', ');
        clauses.push(`"${inf.col}" IN (${placeholders})`);
        values.push(...inf.vals);
        idx += inf.vals.length;
      }

      if (clauses.length === 0) return { text: '', values: [] };
      return {
        text: 'WHERE ' + clauses.join(' AND '),
        values,
      };
    }

    return chain;
  }
};

/**
 * Database helper functions for websites
 */
const websites = {
  getAll: async () => {
    try {
      const websitesData = await sql`SELECT * FROM websites`;
      if (!websitesData || websitesData.length === 0) return [];

      const subCounts = await sql`SELECT "websiteId", COUNT(*)::int as count FROM subscriptions GROUP BY "websiteId"`;
      const countMap = {};
      subCounts.forEach(r => { countMap[r.websiteId] = r.count; });

      return websitesData.map(w => ({ ...w, subscriptionCount: countMap[w.id] || 0 }));
    } catch (error) {
      console.error('Error fetching websites:', error);
      throw error;
    }
  },

  getById: async (id) => {
    const rows = await sql`SELECT * FROM websites WHERE id = ${id}`;
    if (rows.length === 0) return null;
    const website = rows[0];
    
    // Robust parsing for jsonb columns that might have been stored as strings
    ['prompt_config', 'stats'].forEach(col => {
      if (typeof website[col] === 'string') {
        try {
          website[col] = JSON.parse(website[col]);
        } catch (e) {
          console.warn(`Failed to parse ${col} for website ${id}:`, e);
        }
      }
    });

    if (website.prompt_config && !website.promptConfig) {
      website.promptConfig = website.prompt_config;
    }
    return website;
  },

  create: async (websiteData) => {
    if (websiteData.promptConfig) {
      websiteData.prompt_config = websiteData.promptConfig;
      delete websiteData.promptConfig;
    }
    const cols = Object.keys(websiteData);
    // Don't JSON.stringify here; let the driver handle it for jsonb columns
    const vals = Object.values(websiteData);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const colStr = cols.map(c => `"${c}"`).join(', ');
    const rows = await sql.unsafe(`INSERT INTO websites (${colStr}) VALUES (${placeholders}) RETURNING *`, vals);
    const res = rows[0];
    if (res.prompt_config) res.promptConfig = res.prompt_config;
    return res;
  },

  update: async (id, updates) => {
    if (updates.promptConfig) {
      updates.prompt_config = updates.promptConfig;
      delete updates.promptConfig;
    }
    const setCols = Object.keys(updates);
    const setVals = Object.values(updates);
    const setStr = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const rows = await sql.unsafe(`UPDATE websites SET ${setStr} WHERE id = $${setVals.length + 1} RETURNING *`, [...setVals, id]);
    const res = rows[0];
    if (res && res.prompt_config) res.promptConfig = res.prompt_config;
    return res;
  },

  delete: async (id) => {
    await sql`DELETE FROM websites WHERE id = ${id}`;
    return true;
  },

  updateStats: async (id, stats) => {
    const rows = await sql`UPDATE websites SET stats = ${stats}::jsonb WHERE id = ${id} RETURNING *`;
    return rows[0];
  },

  getConfig: async (id) => {
    const rows = await sql`SELECT prompt_config FROM websites WHERE id = ${id}`;
    if (rows.length === 0) return null;
    let config = rows[0].prompt_config;
    if (typeof config === 'string') {
      try { config = JSON.parse(config); } catch (e) {}
    }
    return config;
  },

  updateConfig: async (id, promptConfig) => {
    // FIX: Remove manual stringify to prevent double-encoding in jsonb columns
    const rows = await sql`UPDATE websites SET prompt_config = ${promptConfig}::jsonb WHERE id = ${id} RETURNING *`;
    const res = rows[0];
    if (res && res.prompt_config) res.promptConfig = res.prompt_config;
    return res;
  },

  trackPromptEvent: async (id, eventType) => {
    if (!['impression', 'allow', 'later'].includes(eventType)) {
      throw new Error('Invalid event type');
    }
    const columnMap = { impression: 'prompt_impressions', allow: 'prompt_allowed', later: 'prompt_later' };
    const col = columnMap[eventType];
    await sql.unsafe(`UPDATE websites SET "${col}" = COALESCE("${col}", 0) + 1 WHERE id = $1`, [id]);
    return true;
  },

  getPromptMetrics: async (id) => {
    const rows = await sql`SELECT prompt_impressions, prompt_allowed, prompt_later FROM websites WHERE id = ${id}`;
    if (rows.length === 0) return { impressions: 0, allowed: 0, later: 0 };
    return {
      impressions: rows[0].prompt_impressions || 0,
      allowed: rows[0].prompt_allowed || 0,
      later: rows[0].prompt_later || 0,
    };
  },
};

/**
 * Database helper functions for subscriptions
 */
const subscriptions = {
  getAll: async () => {
    return await sql`SELECT * FROM subscriptions`;
  },

  getByWebsiteId: async (websiteId) => {
    return await sql`SELECT * FROM subscriptions WHERE "websiteId" = ${websiteId}`;
  },

  getByEndpoint: async (endpoint) => {
    const rows = await sql`SELECT * FROM subscriptions WHERE endpoint = ${endpoint}`;
    return rows.length > 0 ? rows[0] : null;
  },

  add: async (subscription) => {
    const cols = Object.keys(subscription);
    const vals = Object.values(subscription).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    const colStr = cols.map(c => `"${c}"`).join(', ');
    const rows = await sql.unsafe(`INSERT INTO subscriptions (${colStr}) VALUES (${placeholders}) RETURNING *`, vals);
    return rows[0];
  },

  update: async (endpoint, updates) => {
    const setCols = Object.keys(updates);
    const setVals = Object.values(updates).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
    const setStr = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const rows = await sql.unsafe(`UPDATE subscriptions SET ${setStr} WHERE endpoint = $${setVals.length + 1} RETURNING *`, [...setVals, endpoint]);
    return rows[0];
  },

  remove: async (endpoint) => {
    await sql`DELETE FROM subscriptions WHERE endpoint = ${endpoint}`;
    return true;
  },

  removeByWebsiteId: async (websiteId) => {
    await sql`DELETE FROM subscriptions WHERE "websiteId" = ${websiteId}`;
    return true;
  },

  updateUsage: async (endpoint, updates) => {
    const setCols = Object.keys(updates);
    const setVals = Object.values(updates).map(v => typeof v === 'object' && v !== null && !(v instanceof Date) ? JSON.stringify(v) : v);
    const setStr = setCols.map((c, i) => `"${c}" = $${i + 1}`).join(', ');
    const rows = await sql.unsafe(`UPDATE subscriptions SET ${setStr} WHERE endpoint = $${setVals.length + 1} RETURNING *`, [...setVals, endpoint]);
    return rows[0];
  },
};

/**
 * Database helper functions for system settings
 */
const settings = {
  getMasterApiKey: async () => {
    const rows = await sql`SELECT value FROM settings WHERE key = 'masterApiKey'`;
    if (rows.length === 0) throw new Error('Master API key not found');
    return rows[0].value;
  },

  setMasterApiKey: async (apiKey) => {
    const rows = await sql`
      INSERT INTO settings (key, value) VALUES ('masterApiKey', ${apiKey})
      ON CONFLICT (key) DO UPDATE SET value = ${apiKey}
      RETURNING *
    `;
    return rows[0];
  },

  get: async (key) => {
    const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
    return rows.length > 0 ? rows[0].value : null;
  },

  set: async (key, value) => {
    const rows = await sql`
      INSERT INTO settings (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = ${value}
      RETURNING *
    `;
    return rows[0];
  },
};

module.exports = {
  db,
  sql,
  websites,
  subscriptions,
  settings
};