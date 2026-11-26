import { neon, NeonQueryFunction } from '@neondatabase/serverless';

export interface DbTransaction {
  id: string;
  title: string;
  method: string;
  amount: number;
  date: string;
}

export interface DbUserAccount {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  fullName?: string;
  contact?: string;
  balance: number;
  transactions: DbTransaction[];
  notifyOnActivity: boolean;
  autoSendFiles: boolean;
  updatedAt: number;
}

export interface DbPaymentOrder {
  orderId: string;
  amount: number;
  payUrl: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  isTest: boolean;
  credited: boolean;
  createdAt: number;
  telegramId?: string;
  chatId?: string;
  method?: string;
}

export interface DbProjectRecord {
  id: string;
  telegramId: string;
  title: string;
  mode: 'pptx' | 'word' | 'pdf';
  pptxPages: unknown[];
  pdfPages: unknown[];
  pdfOrientation: 'portrait' | 'landscape';
  wordDoc: Record<string, unknown>;
  tolovgoMode: 'live' | 'test';
  updatedAt: number;
  createdAt: number;
}

export interface DbProjectSummary {
  id: string;
  title: string;
  mode: 'pptx' | 'word' | 'pdf';
  pptxCount: number;
  pdfCount: number;
  updatedAt: number;
}

let cachedUrl: string | null = null;
let cachedSql: NeonQueryFunction<false, false> | null = null;
let schemaPromise: Promise<boolean> | null = null;
let schemaReady = false;

export function getNeonConnectionUrl(): string | null {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.NEON_DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
  ];
  for (const raw of candidates) {
    const val = raw?.trim();
    if (!val || val === 'MY_DATABASE_URL') continue;
    try {
      const parsed = new URL(val);
      if (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') {
        return val;
      }
    } catch {
      // Ignore malformed connection strings
    }
  }
  return null;
}

export function isNeonConfigured(): boolean {
  return Boolean(getNeonConnectionUrl());
}

function getSql(): NeonQueryFunction<false, false> | null {
  const url = getNeonConnectionUrl();
  if (!url) return null;
  if (!cachedSql || cachedUrl !== url) {
    cachedUrl = url;
    cachedSql = neon(url);
    schemaPromise = null;
    schemaReady = false;
  }
  return cachedSql;
}

export async function ensureDbSchema(): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  if (schemaReady) return true;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          telegram_id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT,
          username TEXT,
          full_name TEXT,
          contact TEXT,
          balance INTEGER NOT NULL DEFAULT 50000,
          notify_on_activity BOOLEAN NOT NULL DEFAULT TRUE,
          auto_send_files BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          method TEXT NOT NULL,
          amount INTEGER NOT NULL,
          date_label TEXT NOT NULL,
          external_order_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_transactions_tg_created
        ON transactions (telegram_id, created_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS payment_orders (
          order_id TEXT PRIMARY KEY,
          telegram_id TEXT,
          chat_id TEXT,
          amount INTEGER NOT NULL,
          pay_url TEXT,
          method TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          is_test BOOLEAN NOT NULL DEFAULT FALSE,
          credited BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'pptx',
          pptx_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
          pdf_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
          pdf_orientation TEXT NOT NULL DEFAULT 'portrait',
          word_doc JSONB NOT NULL DEFAULT '{}'::jsonb,
          tolovgo_mode TEXT NOT NULL DEFAULT 'live',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_projects_tg_updated
        ON projects (telegram_id, updated_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS auth_nonces (
          nonce TEXT PRIMARY KEY,
          login_token TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      schemaReady = true;
      return true;
    } catch (err) {
      console.error('[Neon Schema Init Error]', err);
      schemaPromise = null;
      return false;
    }
  })();

  return schemaPromise;
}

export async function dbGetDbStatus(): Promise<{
  configured: boolean;
  ready: boolean;
}> {
  if (!isNeonConfigured()) {
    return { configured: false, ready: false };
  }
  const ready = await ensureDbSchema();
  return { configured: true, ready };
}

export async function dbListUserTransactions(
  telegramId: string,
  limit = 40
): Promise<DbTransaction[]> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return [];
  const rows = (await sql`
    SELECT id, title, method, amount, date_label
    FROM transactions
    WHERE telegram_id = ${telegramId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    method: String(r.method),
    amount: Number(r.amount) || 0,
    date: String(r.date_label),
  }));
}

export async function dbGetOrCreateUser(
  profile: {
    telegramId: string;
    chatId: string;
    firstName: string;
    lastName?: string;
    username?: string;
  },
  dateLabel: string
): Promise<DbUserAccount | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const inserted = (await sql`
      INSERT INTO users (telegram_id, chat_id, first_name, last_name, username, balance)
      VALUES (
        ${profile.telegramId},
        ${profile.chatId},
        ${profile.firstName},
        ${profile.lastName ?? null},
        ${profile.username ?? null},
        50000
      )
      ON CONFLICT (telegram_id) DO UPDATE SET
        chat_id = EXCLUDED.chat_id,
        first_name = EXCLUDED.first_name,
        last_name = COALESCE(EXCLUDED.last_name, users.last_name),
        username = COALESCE(EXCLUDED.username, users.username),
        updated_at = NOW()
      RETURNING
        telegram_id,
        chat_id,
        first_name,
        last_name,
        username,
        full_name,
        contact,
        balance,
        notify_on_activity,
        auto_send_files,
        (created_at = updated_at) AS is_new,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    `) as Array<Record<string, unknown>>;

    const row = inserted[0];
    if (!row) return null;

    if (row.is_new) {
      await sql`
        INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
        VALUES (
          ${`init_${profile.telegramId}`},
          ${profile.telegramId},
          ${"Boshlang'ich hisob"},
          ${'Tizim'},
          ${50000},
          ${dateLabel}
        )
        ON CONFLICT (id) DO NOTHING
      `;
    }

    const transactions = await dbListUserTransactions(profile.telegramId, 40);

    return {
      telegramId: String(row.telegram_id),
      chatId: String(row.chat_id),
      firstName: String(row.first_name),
      lastName: row.last_name ? String(row.last_name) : undefined,
      username: row.username ? String(row.username) : undefined,
      fullName: row.full_name ? String(row.full_name) : undefined,
      contact: row.contact ? String(row.contact) : undefined,
      balance: Number(row.balance) || 0,
      transactions,
      notifyOnActivity: row.notify_on_activity !== false,
      autoSendFiles: row.auto_send_files !== false,
      updatedAt: Number(row.updated_ms) || Date.now(),
    };
  } catch (err) {
    console.error('[Neon dbGetOrCreateUser Error]', err);
    return null;
  }
}

export async function dbUpdateUserPreferences(
  telegramId: string,
  prefs: { autoSendFiles?: boolean; notifyOnActivity?: boolean }
): Promise<{ autoSendFiles: boolean; notifyOnActivity: boolean } | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const rows = (await sql`
      UPDATE users
      SET
        auto_send_files = COALESCE(${typeof prefs.autoSendFiles === 'boolean' ? prefs.autoSendFiles : null}, auto_send_files),
        notify_on_activity = COALESCE(${typeof prefs.notifyOnActivity === 'boolean' ? prefs.notifyOnActivity : null}, notify_on_activity),
        updated_at = NOW()
      WHERE telegram_id = ${telegramId}
      RETURNING auto_send_files, notify_on_activity
    `) as Array<Record<string, unknown>>;

    if (!rows[0]) return null;
    return {
      autoSendFiles: rows[0].auto_send_files !== false,
      notifyOnActivity: rows[0].notify_on_activity !== false,
    };
  } catch (err) {
    console.error('[Neon dbUpdateUserPreferences Error]', err);
    return null;
  }
}

export async function dbUpdateUserProfile(
  telegramId: string,
  profile: { fullName?: string; contact?: string }
): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;

  try {
    await sql`
      UPDATE users
      SET
        full_name = COALESCE(${profile.fullName ?? null}, full_name),
        contact = COALESCE(${profile.contact ?? null}, contact),
        updated_at = NOW()
      WHERE telegram_id = ${telegramId}
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbUpdateUserProfile Error]', err);
    return false;
  }
}

export async function dbLogActivity(
  telegramId: string,
  txId: string,
  title: string,
  method: string,
  amountDelta: number,
  dateLabel: string
): Promise<{ balance: number; transactions: DbTransaction[] } | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const safeDelta = amountDelta <= 0 ? Math.round(amountDelta) : 0;
    const updatedRows = (await sql`
      UPDATE users
      SET
        balance = GREATEST(0, balance + ${safeDelta}),
        updated_at = NOW()
      WHERE telegram_id = ${telegramId}
      RETURNING balance
    `) as Array<Record<string, unknown>>;

    if (!updatedRows[0]) return null;

    await sql`
      INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
      VALUES (${txId}, ${telegramId}, ${title}, ${method}, ${safeDelta}, ${dateLabel})
      ON CONFLICT (id) DO NOTHING
    `;

    const transactions = await dbListUserTransactions(telegramId, 40);
    return {
      balance: Number(updatedRows[0].balance) || 0,
      transactions,
    };
  } catch (err) {
    console.error('[Neon dbLogActivity Error]', err);
    return null;
  }
}

export async function dbUpsertPaymentOrder(order: DbPaymentOrder): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;

  try {
    await sql`
      INSERT INTO payment_orders (
        order_id, telegram_id, chat_id, amount, pay_url, method, status, is_test, credited
      )
      VALUES (
        ${order.orderId},
        ${order.telegramId ?? null},
        ${order.chatId ?? null},
        ${order.amount},
        ${order.payUrl || null},
        ${order.method ?? null},
        ${order.status},
        ${order.isTest},
        ${order.credited}
      )
      ON CONFLICT (order_id) DO UPDATE SET
        telegram_id = COALESCE(EXCLUDED.telegram_id, payment_orders.telegram_id),
        chat_id = COALESCE(EXCLUDED.chat_id, payment_orders.chat_id),
        status = EXCLUDED.status,
        credited = payment_orders.credited OR EXCLUDED.credited,
        updated_at = NOW()
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbUpsertPaymentOrder Error]', err);
    return false;
  }
}

export async function dbGetPaymentOrder(orderId: string): Promise<DbPaymentOrder | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const rows = (await sql`
      SELECT
        order_id,
        telegram_id,
        chat_id,
        amount,
        pay_url,
        method,
        status,
        is_test,
        credited,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM payment_orders
      WHERE order_id = ${orderId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const r = rows[0];
    if (!r) return null;
    return {
      orderId: String(r.order_id),
      telegramId: r.telegram_id ? String(r.telegram_id) : undefined,
      chatId: r.chat_id ? String(r.chat_id) : undefined,
      amount: Number(r.amount) || 0,
      payUrl: r.pay_url ? String(r.pay_url) : '',
      method: r.method ? String(r.method) : undefined,
      status: String(r.status || 'pending') as DbPaymentOrder['status'],
      isTest: Boolean(r.is_test),
      credited: Boolean(r.credited),
      createdAt: Number(r.created_ms) || Date.now(),
    };
  } catch (err) {
    console.error('[Neon dbGetPaymentOrder Error]', err);
    return null;
  }
}

export async function dbCreditTolovgoOrder(
  orderId: string,
  telegramId: string,
  chatId: string,
  amount: number,
  methodLabel: string,
  dateLabel: string,
  isTest: boolean
): Promise<boolean | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    // Ensure user exists before crediting
    await sql`
      INSERT INTO users (telegram_id, chat_id, first_name, balance)
      VALUES (${telegramId}, ${chatId}, ${'Foydalanuvchi'}, ${50000})
      ON CONFLICT (telegram_id) DO NOTHING
    `;

    // Ensure order record exists first if callback arrived without prior row
    await sql`
      INSERT INTO payment_orders (
        order_id, telegram_id, chat_id, amount, method, status, is_test, credited
      )
      VALUES (
        ${orderId}, ${telegramId}, ${chatId}, ${amount}, ${methodLabel}, ${'pending'}, ${isTest}, FALSE
      )
      ON CONFLICT (order_id) DO NOTHING
    `;

    // Atomic conditional update prevents race-condition double crediting
    const claimed = (await sql`
      UPDATE payment_orders
      SET
        status = 'paid',
        credited = TRUE,
        telegram_id = COALESCE(telegram_id, ${telegramId}),
        chat_id = COALESCE(chat_id, ${chatId}),
        updated_at = NOW()
      WHERE order_id = ${orderId} AND credited = FALSE
      RETURNING order_id
    `) as Array<Record<string, unknown>>;

    if (!claimed.length) {
      return false;
    }

    const txId = `tolovgo_${orderId}`;
    const insertedTx = (await sql`
      INSERT INTO transactions (id, telegram_id, title, method, amount, date_label, external_order_id)
      VALUES (
        ${txId},
        ${telegramId},
        ${`Balans to'ldirish (#${orderId})`},
        ${methodLabel},
        ${amount},
        ${dateLabel},
        ${orderId}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as Array<Record<string, unknown>>;

    if (insertedTx.length > 0) {
      await sql`
        UPDATE users
        SET balance = balance + ${amount}, updated_at = NOW()
        WHERE telegram_id = ${telegramId}
      `;
    }

    return true;
  } catch (err) {
    console.error('[Neon dbCreditTolovgoOrder Error]', err);
    return null;
  }
}

export async function dbSaveAuthNonce(
  nonce: string,
  loginToken: string,
  ttlSeconds = 600
): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await sql`
      INSERT INTO auth_nonces (nonce, login_token, expires_at)
      VALUES (${nonce}, ${loginToken}, ${expiresAt}::timestamptz)
      ON CONFLICT (nonce) DO UPDATE SET
        login_token = EXCLUDED.login_token,
        expires_at = EXCLUDED.expires_at
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbSaveAuthNonce Error]', err);
    return false;
  }
}

export async function dbGetAuthNonce(nonce: string): Promise<string | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT login_token
      FROM auth_nonces
      WHERE nonce = ${nonce} AND expires_at > NOW()
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    return rows[0]?.login_token ? String(rows[0].login_token) : null;
  } catch (err) {
    console.error('[Neon dbGetAuthNonce Error]', err);
    return null;
  }
}

export async function dbSaveProject(
  telegramId: string,
  project: {
    id: string;
    title: string;
    mode: 'pptx' | 'word' | 'pdf';
    pptxPages: unknown[];
    pdfPages: unknown[];
    pdfOrientation: 'portrait' | 'landscape';
    wordDoc: Record<string, unknown>;
    tolovgoMode: 'live' | 'test';
  }
): Promise<DbProjectSummary | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const pptxJson = JSON.stringify(project.pptxPages);
    const pdfJson = JSON.stringify(project.pdfPages);
    const wordJson = JSON.stringify(project.wordDoc);

    const rows = (await sql`
      INSERT INTO projects (
        id, telegram_id, title, mode, pptx_pages, pdf_pages, pdf_orientation, word_doc, tolovgo_mode
      )
      VALUES (
        ${project.id},
        ${telegramId},
        ${project.title},
        ${project.mode},
        ${pptxJson}::jsonb,
        ${pdfJson}::jsonb,
        ${project.pdfOrientation},
        ${wordJson}::jsonb,
        ${project.tolovgoMode}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        mode = EXCLUDED.mode,
        pptx_pages = EXCLUDED.pptx_pages,
        pdf_pages = EXCLUDED.pdf_pages,
        pdf_orientation = EXCLUDED.pdf_orientation,
        word_doc = EXCLUDED.word_doc,
        tolovgo_mode = EXCLUDED.tolovgo_mode,
        updated_at = NOW()
      WHERE projects.telegram_id = ${telegramId}
      RETURNING
        id,
        title,
        mode,
        jsonb_array_length(pptx_pages) AS pptx_count,
        jsonb_array_length(pdf_pages) AS pdf_count,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    `) as Array<Record<string, unknown>>;

    const r = rows[0];
    if (!r) return null;
    return {
      id: String(r.id),
      title: String(r.title),
      mode: String(r.mode) as DbProjectSummary['mode'],
      pptxCount: Number(r.pptx_count) || 0,
      pdfCount: Number(r.pdf_count) || 0,
      updatedAt: Number(r.updated_ms) || Date.now(),
    };
  } catch (err) {
    console.error('[Neon dbSaveProject Error]', err);
    return null;
  }
}

export async function dbListProjects(
  telegramId: string,
  limit = 15
): Promise<DbProjectSummary[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const rows = (await sql`
      SELECT
        id,
        title,
        mode,
        jsonb_array_length(pptx_pages) AS pptx_count,
        jsonb_array_length(pdf_pages) AS pdf_count,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
      FROM projects
      WHERE telegram_id = ${telegramId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      mode: String(r.mode) as DbProjectSummary['mode'],
      pptxCount: Number(r.pptx_count) || 0,
      pdfCount: Number(r.pdf_count) || 0,
      updatedAt: Number(r.updated_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListProjects Error]', err);
    return null;
  }
}

export async function dbGetProjectById(
  telegramId: string,
  projectId?: string
): Promise<DbProjectRecord | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const rows = projectId
      ? ((await sql`
          SELECT
            id, telegram_id, title, mode, pptx_pages, pdf_pages, pdf_orientation, word_doc, tolovgo_mode,
            EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
            EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
          FROM projects
          WHERE telegram_id = ${telegramId} AND id = ${projectId}
          LIMIT 1
        `) as Array<Record<string, unknown>>)
      : ((await sql`
          SELECT
            id, telegram_id, title, mode, pptx_pages, pdf_pages, pdf_orientation, word_doc, tolovgo_mode,
            EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
            EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
          FROM projects
          WHERE telegram_id = ${telegramId}
          ORDER BY updated_at DESC
          LIMIT 1
        `) as Array<Record<string, unknown>>);

    const r = rows[0];
    if (!r) return null;

    return {
      id: String(r.id),
      telegramId: String(r.telegram_id),
      title: String(r.title),
      mode: String(r.mode) as DbProjectRecord['mode'],
      pptxPages: Array.isArray(r.pptx_pages) ? r.pptx_pages : [],
      pdfPages: Array.isArray(r.pdf_pages) ? r.pdf_pages : [],
      pdfOrientation: r.pdf_orientation === 'landscape' ? 'landscape' : 'portrait',
      wordDoc:
        r.word_doc && typeof r.word_doc === 'object'
          ? (r.word_doc as Record<string, unknown>)
          : {},
      tolovgoMode: r.tolovgo_mode === 'test' ? 'test' : 'live',
      createdAt: Number(r.created_ms) || Date.now(),
      updatedAt: Number(r.updated_ms) || Date.now(),
    };
  } catch (err) {
    console.error('[Neon dbGetProjectById Error]', err);
    return null;
  }
}

export async function dbDeleteProject(telegramId: string, projectId: string): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;

  try {
    await sql`
      DELETE FROM projects
      WHERE telegram_id = ${telegramId} AND id = ${projectId}
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbDeleteProject Error]', err);
    return false;
  }
}
