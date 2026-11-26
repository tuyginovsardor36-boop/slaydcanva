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
  referralCount: number;
  referredBy?: string;
  isBanned: boolean;
  isNewUser?: boolean;
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

export interface ServicePricingConfig {
  academic_wave_pptx: { basePrice: number; baseLimit: number; extraStepPrice: number };
  white_card_pptx: { basePrice: number; baseLimit: number; extraStepPrice: number };
  stitched_notebook_pdf: { basePrice: number; baseLimit: number; extraStepPrice: number };
  five_block_infographic: { basePrice: number };
  ai_canvas_design: { basePrice: number; baseLimit: number; extraStepPrice: number };
}

export interface AppPricingSettings {
  services: ServicePricingConfig;
  welcomeBonus: number;
  referralInviterBonus: number;
  referralInviteeBonus: number;
  dailyReferralLimit: number;
}

export interface AdminUserRow {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  fullName?: string;
  contact?: string;
  balance: number;
  referralCount: number;
  referredBy?: string;
  isBanned: boolean;
  projectCount: number;
  crmTag?: string;
  crmNote?: string;
  totalDeposited?: number;
  totalSpent?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdminAuditRow {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  amount?: number;
  details?: string;
  createdAt: number;
}

export interface AdminOverviewStats {
  totalUsers: number;
  bannedUsers: number;
  totalBalance: number;
  totalPaidOrders: number;
  totalPaidRevenue: number;
  totalReferrals: number;
  totalProjects: number;
  activeManagers: number;
  unreadCrmEvents: number;
  todayRevenue: number;
  todayNewUsers: number;
}

export type DbManagerPermission =
  | 'overview'
  | 'crm_events'
  | 'users'
  | 'balance'
  | 'orders'
  | 'pricing'
  | 'promos'
  | 'broadcast'
  | 'settings';

export interface DbManagerRecord {
  telegramId: string;
  firstName: string;
  username?: string;
  roleTitle: string;
  permissions: DbManagerPermission[];
  passwordHash?: string;
  hasPassword: boolean;
  isActive: boolean;
  notifyTelegram: boolean;
  addedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DbCrmEvent {
  id: string;
  eventType:
    | 'new_user'
    | 'payment_paid'
    | 'promo_redeemed'
    | 'balance_adjusted'
    | 'security_alert'
    | 'broadcast_sent'
    | 'manager_changed'
    | 'user_banned';
  title: string;
  message: string;
  userId?: string;
  amount?: number;
  isRead: boolean;
  createdAt: number;
}

export interface DbPromoCode {
  code: string;
  bonusAmount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: number | null;
  createdBy?: string;
  createdAt: number;
}

export interface DbBroadcastLog {
  id: string;
  actorId: string;
  targetSegment: string;
  message: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: number;
}

export const DEFAULT_PRICING_SETTINGS: AppPricingSettings = {
  services: {
    academic_wave_pptx: { basePrice: 4000, baseLimit: 7, extraStepPrice: 500 },
    white_card_pptx: { basePrice: 4000, baseLimit: 7, extraStepPrice: 500 },
    stitched_notebook_pdf: { basePrice: 3000, baseLimit: 4, extraStepPrice: 500 },
    five_block_infographic: { basePrice: 3000 },
    ai_canvas_design: { basePrice: 3000, baseLimit: 3, extraStepPrice: 500 },
  },
  welcomeBonus: 1000,
  referralInviterBonus: 1000,
  referralInviteeBonus: 0,
  dailyReferralLimit: 20,
};

let cachedUrl: string | null = null;
let cachedSql: NeonQueryFunction<false, false> | null = null;
let schemaPromise: Promise<boolean> | null = null;
let schemaReady = false;

export function getNeonConnectionUrl(): string | null {
  const candidates: Array<string | undefined> = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.NEON_DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];

  for (const [key, val] of Object.entries(process.env)) {
    if (/(?:^|_)(?:DATABASE_URL|POSTGRES_URL)$/i.test(key) && val) {
      candidates.push(val);
    }
  }

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
          balance INTEGER NOT NULL DEFAULT 1000,
          referred_by TEXT,
          referral_count INTEGER NOT NULL DEFAULT 0,
          is_banned BOOLEAN NOT NULL DEFAULT FALSE,
          notify_on_activity BOOLEAN NOT NULL DEFAULT TRUE,
          auto_send_files BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      // Safe idempotent column additions for existing deployments
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS crm_tag TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS crm_note TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW()`;
      await sql`ALTER TABLE users ALTER COLUMN balance SET DEFAULT 1000`;

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
        CREATE INDEX IF NOT EXISTS idx_payment_orders_created
        ON payment_orders (created_at DESC)
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

      await sql`
        CREATE TABLE IF NOT EXISTS referrals (
          invitee_id TEXT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
          inviter_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
          inviter_bonus INTEGER NOT NULL,
          invitee_bonus INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_referrals_inviter_created
        ON referrals (inviter_id, created_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          action TEXT NOT NULL,
          target_id TEXT,
          amount INTEGER,
          details TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created
        ON audit_logs (created_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS managers (
          telegram_id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          username TEXT,
          role_title TEXT NOT NULL DEFAULT 'Menejer',
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          password_hash TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          notify_telegram BOOLEAN NOT NULL DEFAULT TRUE,
          added_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS crm_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          user_id TEXT,
          amount INTEGER,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_crm_events_created
        ON crm_events (created_at DESC)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS promo_codes (
          code TEXT PRIMARY KEY,
          bonus_amount INTEGER NOT NULL,
          max_uses INTEGER NOT NULL DEFAULT 100,
          used_count INTEGER NOT NULL DEFAULT 0,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          expires_at TIMESTAMPTZ,
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS promo_redemptions (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
          telegram_id TEXT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
          bonus_amount INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (code, telegram_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS broadcast_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          target_segment TEXT NOT NULL,
          message TEXT NOT NULL,
          total_targets INTEGER NOT NULL DEFAULT 0,
          sent_count INTEGER NOT NULL DEFAULT 0,
          failed_count INTEGER NOT NULL DEFAULT 0,
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

export async function dbAppendAuditLog(entry: {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  amount?: number;
  details?: string;
}): Promise<void> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return;
  try {
    await sql`
      INSERT INTO audit_logs (id, actor_id, action, target_id, amount, details)
      VALUES (
        ${entry.id},
        ${entry.actorId},
        ${entry.action},
        ${entry.targetId ?? null},
        ${typeof entry.amount === 'number' ? Math.round(entry.amount) : null},
        ${entry.details ? entry.details.slice(0, 400) : null}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (err) {
    console.error('[Neon dbAppendAuditLog Error]', err);
  }
}

export async function dbGetSetting<T>(key: string): Promise<T | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT value
      FROM app_settings
      WHERE key = ${key}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (!rows[0]) return null;
    return rows[0].value as T;
  } catch (err) {
    console.error('[Neon dbGetSetting Error]', err);
    return null;
  }
}

export async function dbSetSetting(key: string, value: unknown): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    const jsonVal = JSON.stringify(value);
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${jsonVal}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW()
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbSetSetting Error]', err);
    return false;
  }
}

export async function dbClaimAdminPasswordIfUnset(passwordHash: string): Promise<'claimed' | 'already_set' | 'unavailable'> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return 'unavailable';
  try {
    const jsonVal = JSON.stringify({ passwordHash, updatedAt: Date.now() });
    const rows = (await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('admin_auth', ${jsonVal}::jsonb, NOW())
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    `) as Array<Record<string, unknown>>;
    return rows.length > 0 ? 'claimed' : 'already_set';
  } catch (err) {
    console.error('[Neon dbClaimAdminPasswordIfUnset Error]', err);
    return 'unavailable';
  }
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
  dateLabel: string,
  welcomeBonus = 1000
): Promise<DbUserAccount | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  const safeWelcome = Math.max(0, Math.min(50_000, Math.round(welcomeBonus)));

  try {
    const inserted = (await sql`
      INSERT INTO users (telegram_id, chat_id, first_name, last_name, username, balance)
      VALUES (
        ${profile.telegramId},
        ${profile.chatId},
        ${profile.firstName},
        ${profile.lastName ?? null},
        ${profile.username ?? null},
        ${safeWelcome}
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
        referral_count,
        referred_by,
        is_banned,
        notify_on_activity,
        auto_send_files,
        (xmax = 0) AS is_new,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    `) as Array<Record<string, unknown>>;

    const row = inserted[0];
    if (!row) return null;

    const isNewUser = Boolean(row.is_new);

    if (isNewUser && safeWelcome > 0) {
      await sql`
        INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
        VALUES (
          ${`init_${profile.telegramId}`},
          ${profile.telegramId},
          ${"Xush kelibsiz bonusi"},
          ${'Bonus'},
          ${safeWelcome},
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
      referralCount: Number(row.referral_count) || 0,
      referredBy: row.referred_by ? String(row.referred_by) : undefined,
      isBanned: Boolean(row.is_banned),
      isNewUser,
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

export async function dbApplyReferralBonus(params: {
  inviteeId: string;
  inviterId: string;
  inviterBonus: number;
  inviteeBonus: number;
  dailyLimit: number;
  dateLabel: string;
}): Promise<{ applied: boolean; inviterChatId?: string; inviterBalance?: number } | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  const { inviteeId, inviterId, inviterBonus, inviteeBonus, dailyLimit, dateLabel } = params;
  if (!/^\d{3,20}$/.test(inviteeId) || !/^\d{3,20}$/.test(inviterId) || inviteeId === inviterId) {
    return { applied: false };
  }

  const safeInviterBonus = Math.max(0, Math.min(50_000, Math.round(inviterBonus)));
  const safeInviteeBonus = Math.max(0, Math.min(50_000, Math.round(inviteeBonus)));
  const safeLimit = Math.max(1, Math.min(200, Math.round(dailyLimit)));

  try {
    // Inviter must exist and not be banned; invitee must not already have a referrer
    const inviterRows = (await sql`
      SELECT telegram_id, chat_id, is_banned
      FROM users
      WHERE telegram_id = ${inviterId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const inviter = inviterRows[0];
    if (!inviter || Boolean(inviter.is_banned)) {
      return { applied: false };
    }

    const inviteeRows = (await sql`
      SELECT telegram_id, referred_by, is_banned
      FROM users
      WHERE telegram_id = ${inviteeId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const invitee = inviteeRows[0];
    if (!invitee || invitee.referred_by || Boolean(invitee.is_banned)) {
      return { applied: false };
    }

    // Daily anti-abuse limit per inviter
    const countRows = (await sql`
      SELECT COUNT(*)::int AS cnt
      FROM referrals
      WHERE inviter_id = ${inviterId} AND created_at > NOW() - INTERVAL '24 hours'
    `) as Array<Record<string, unknown>>;

    if ((Number(countRows[0]?.cnt) || 0) >= safeLimit) {
      return { applied: false };
    }

    // Atomic one-time insert guarded by PRIMARY KEY (invitee_id)
    const refInserted = (await sql`
      INSERT INTO referrals (invitee_id, inviter_id, inviter_bonus, invitee_bonus)
      VALUES (${inviteeId}, ${inviterId}, ${safeInviterBonus}, ${safeInviteeBonus})
      ON CONFLICT (invitee_id) DO NOTHING
      RETURNING invitee_id
    `) as Array<Record<string, unknown>>;

    if (!refInserted.length) {
      return { applied: false };
    }

    await sql`
      UPDATE users
      SET referred_by = ${inviterId}, updated_at = NOW()
      WHERE telegram_id = ${inviteeId} AND referred_by IS NULL
    `;

    let inviterBalance = 0;
    if (safeInviterBonus > 0) {
      const txId = `ref_in_${inviteeId}`;
      const txInserted = (await sql`
        INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
        VALUES (
          ${txId},
          ${inviterId},
          ${`Referal bonusi (ID ${inviteeId})`},
          ${'Referal'},
          ${safeInviterBonus},
          ${dateLabel}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as Array<Record<string, unknown>>;

      if (txInserted.length > 0) {
        const updatedInviter = (await sql`
          UPDATE users
          SET
            balance = balance + ${safeInviterBonus},
            referral_count = referral_count + 1,
            updated_at = NOW()
          WHERE telegram_id = ${inviterId}
          RETURNING balance
        `) as Array<Record<string, unknown>>;
        inviterBalance = Number(updatedInviter[0]?.balance) || 0;
      }
    } else {
      await sql`
        UPDATE users
        SET referral_count = referral_count + 1, updated_at = NOW()
        WHERE telegram_id = ${inviterId}
      `;
    }

    if (safeInviteeBonus > 0) {
      const txIdOut = `ref_out_${inviteeId}`;
      const txOutInserted = (await sql`
        INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
        VALUES (
          ${txIdOut},
          ${inviteeId},
          ${"Referal taklif bonusi"},
          ${'Referal'},
          ${safeInviteeBonus},
          ${dateLabel}
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id
      `) as Array<Record<string, unknown>>;

      if (txOutInserted.length > 0) {
        await sql`
          UPDATE users
          SET balance = balance + ${safeInviteeBonus}, updated_at = NOW()
          WHERE telegram_id = ${inviteeId}
        `;
      }
    }

    await dbAppendAuditLog({
      id: `aud_ref_${inviteeId}`,
      actorId: inviterId,
      action: 'referral_reward',
      targetId: inviteeId,
      amount: safeInviterBonus,
      details: `Referal mukofoti: +${safeInviterBonus} so'm`,
    });

    return {
      applied: true,
      inviterChatId: String(inviter.chat_id),
      inviterBalance,
    };
  } catch (err) {
    console.error('[Neon dbApplyReferralBonus Error]', err);
    return null;
  }
}

export async function dbChargeAiService(params: {
  telegramId: string;
  txId: string;
  title: string;
  price: number;
  dateLabel: string;
}): Promise<{ ok: boolean; reason?: 'insufficient' | 'banned' | 'not_found'; balance?: number } | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  const safePrice = Math.max(0, Math.round(params.price));
  try {
    const userCheck = (await sql`
      SELECT balance, is_banned
      FROM users
      WHERE telegram_id = ${params.telegramId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    if (!userCheck[0]) return { ok: false, reason: 'not_found' };
    if (Boolean(userCheck[0].is_banned)) return { ok: false, reason: 'banned' };

    if (safePrice === 0) {
      return { ok: true, balance: Number(userCheck[0].balance) || 0 };
    }

    const updated = (await sql`
      UPDATE users
      SET balance = balance - ${safePrice}, updated_at = NOW()
      WHERE telegram_id = ${params.telegramId} AND is_banned = FALSE AND balance >= ${safePrice}
      RETURNING balance
    `) as Array<Record<string, unknown>>;

    if (!updated[0]) {
      return { ok: false, reason: 'insufficient', balance: Number(userCheck[0].balance) || 0 };
    }

    await sql`
      INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
      VALUES (
        ${params.txId},
        ${params.telegramId},
        ${params.title},
        ${'AI Xizmat'},
        ${-safePrice},
        ${params.dateLabel}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    return { ok: true, balance: Number(updated[0].balance) || 0 };
  } catch (err) {
    console.error('[Neon dbChargeAiService Error]', err);
    return null;
  }
}

export async function dbRefundAiCharge(params: {
  telegramId: string;
  txId: string;
  price: number;
}): Promise<void> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return;
  const safePrice = Math.max(0, Math.round(params.price));
  if (safePrice <= 0) return;

  try {
    const deleted = (await sql`
      DELETE FROM transactions
      WHERE id = ${params.txId} AND telegram_id = ${params.telegramId} AND amount < 0
      RETURNING id
    `) as Array<Record<string, unknown>>;
    if (deleted.length > 0) {
      await sql`
        UPDATE users
        SET balance = balance + ${safePrice}, updated_at = NOW()
        WHERE telegram_id = ${params.telegramId}
      `;
    }
  } catch (err) {
    console.error('[Neon dbRefundAiCharge Error]', err);
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
    // Client-triggered activity logging can never increase balance
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

export async function dbAdminAdjustBalance(params: {
  adminId: string;
  targetTelegramId: string;
  delta: number;
  reason: string;
  dateLabel: string;
}): Promise<{ balance: number; chatId: string } | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  const safeDelta = Math.round(params.delta);
  if (!safeDelta) return null;

  try {
    const updated = (await sql`
      UPDATE users
      SET
        balance = GREATEST(0, balance + ${safeDelta}),
        updated_at = NOW()
      WHERE telegram_id = ${params.targetTelegramId}
      RETURNING balance, chat_id
    `) as Array<Record<string, unknown>>;

    if (!updated[0]) return null;

    const txId = `adm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    await sql`
      INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
      VALUES (
        ${txId},
        ${params.targetTelegramId},
        ${params.reason.slice(0, 140)},
        ${'Admin'},
        ${safeDelta},
        ${params.dateLabel}
      )
    `;

    await dbAppendAuditLog({
      id: `aud_${txId}`,
      actorId: params.adminId,
      action: safeDelta > 0 ? 'admin_balance_add' : 'admin_balance_deduct',
      targetId: params.targetTelegramId,
      amount: safeDelta,
      details: params.reason,
    });

    return {
      balance: Number(updated[0].balance) || 0,
      chatId: String(updated[0].chat_id),
    };
  } catch (err) {
    console.error('[Neon dbAdminAdjustBalance Error]', err);
    return null;
  }
}

export async function dbSetUserBanned(
  adminId: string,
  targetTelegramId: string,
  isBanned: boolean
): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    const rows = (await sql`
      UPDATE users
      SET is_banned = ${isBanned}, updated_at = NOW()
      WHERE telegram_id = ${targetTelegramId}
      RETURNING telegram_id
    `) as Array<Record<string, unknown>>;
    if (!rows[0]) return false;

    await dbAppendAuditLog({
      id: `aud_ban_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      actorId: adminId,
      action: isBanned ? 'admin_ban_user' : 'admin_unban_user',
      targetId: targetTelegramId,
      details: isBanned ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi',
    });
    return true;
  } catch (err) {
    console.error('[Neon dbSetUserBanned Error]', err);
    return false;
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
    await sql`
      INSERT INTO users (telegram_id, chat_id, first_name, balance)
      VALUES (${telegramId}, ${chatId}, ${'Foydalanuvchi'}, ${1000})
      ON CONFLICT (telegram_id) DO NOTHING
    `;

    await sql`
      INSERT INTO payment_orders (
        order_id, telegram_id, chat_id, amount, method, status, is_test, credited
      )
      VALUES (
        ${orderId}, ${telegramId}, ${chatId}, ${amount}, ${methodLabel}, ${'pending'}, ${isTest}, FALSE
      )
      ON CONFLICT (order_id) DO NOTHING
    `;

    // Always trust the authoritative order amount stored when order was created
    const existingRows = (await sql`
      SELECT amount
      FROM payment_orders
      WHERE order_id = ${orderId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const trustedAmount = Number(existingRows[0]?.amount) || Math.round(amount);

    const claimed = (await sql`
      UPDATE payment_orders
      SET
        status = 'paid',
        credited = TRUE,
        telegram_id = COALESCE(telegram_id, ${telegramId}),
        chat_id = COALESCE(chat_id, ${chatId}),
        updated_at = NOW()
      WHERE order_id = ${orderId} AND credited = FALSE AND is_test = ${isTest}
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
        ${trustedAmount},
        ${dateLabel},
        ${orderId}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `) as Array<Record<string, unknown>>;

    if (insertedTx.length > 0) {
      await sql`
        UPDATE users
        SET balance = balance + ${trustedAmount}, updated_at = NOW()
        WHERE telegram_id = ${telegramId}
      `;
    }

    await dbAppendAuditLog({
      id: `aud_pay_${orderId}`,
      actorId: 'tolovgo',
      action: isTest ? 'tolovgo_test_credit' : 'tolovgo_live_credit',
      targetId: telegramId,
      amount: trustedAmount,
      details: `TolovGo #${orderId} tasdiqlandi`,
    });

    return true;
  } catch (err) {
    console.error('[Neon dbCreditTolovgoOrder Error]', err);
    return null;
  }
}

export async function dbGetAdminOverview(): Promise<AdminOverviewStats | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const [uRow] = (await sql`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE is_banned = TRUE)::int AS banned_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS today_new_users,
        COALESCE(SUM(balance), 0)::bigint AS total_balance
      FROM users
    `) as Array<Record<string, unknown>>;

    const [pRow] = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'paid' AND is_test = FALSE)::int AS total_paid_orders,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND is_test = FALSE), 0)::bigint AS total_paid_revenue,
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND is_test = FALSE AND updated_at >= NOW() - INTERVAL '24 hours'), 0)::bigint AS today_revenue
      FROM payment_orders
    `) as Array<Record<string, unknown>>;

    const [rRow] = (await sql`
      SELECT COUNT(*)::int AS total_referrals FROM referrals
    `) as Array<Record<string, unknown>>;

    const [prRow] = (await sql`
      SELECT COUNT(*)::int AS total_projects FROM projects
    `) as Array<Record<string, unknown>>;

    const [mgrRow] = (await sql`
      SELECT COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_managers FROM managers
    `) as Array<Record<string, unknown>>;

    const [crmRow] = (await sql`
      SELECT COUNT(*) FILTER (WHERE is_read = FALSE)::int AS unread_crm FROM crm_events
    `) as Array<Record<string, unknown>>;

    return {
      totalUsers: Number(uRow?.total_users) || 0,
      bannedUsers: Number(uRow?.banned_users) || 0,
      totalBalance: Number(uRow?.total_balance) || 0,
      totalPaidOrders: Number(pRow?.total_paid_orders) || 0,
      totalPaidRevenue: Number(pRow?.total_paid_revenue) || 0,
      totalReferrals: Number(rRow?.total_referrals) || 0,
      totalProjects: Number(prRow?.total_projects) || 0,
      activeManagers: Number(mgrRow?.active_managers) || 0,
      unreadCrmEvents: Number(crmRow?.unread_crm) || 0,
      todayRevenue: Number(pRow?.today_revenue) || 0,
      todayNewUsers: Number(uRow?.today_new_users) || 0,
    };
  } catch (err) {
    console.error('[Neon dbGetAdminOverview Error]', err);
    return null;
  }
}

export async function dbListUsersAdmin(search = '', limit = 150): Promise<AdminUserRow[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const q = search.trim();
    const pattern = q ? `%${q}%` : '%';
    const rows = (await sql`
      SELECT
        u.telegram_id,
        u.chat_id,
        u.first_name,
        u.last_name,
        u.username,
        u.full_name,
        u.contact,
        u.balance,
        u.referral_count,
        u.referred_by,
        u.is_banned,
        u.crm_tag,
        u.crm_note,
        EXTRACT(EPOCH FROM u.created_at) * 1000 AS created_ms,
        EXTRACT(EPOCH FROM u.updated_at) * 1000 AS updated_ms,
        (SELECT COUNT(*)::int FROM projects p WHERE p.telegram_id = u.telegram_id) AS project_count,
        COALESCE((SELECT SUM(t.amount)::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount > 0 AND t.external_order_id IS NOT NULL), 0) AS total_deposited,
        COALESCE((SELECT SUM(ABS(t.amount))::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount < 0), 0) AS total_spent
      FROM users u
      WHERE
        ${q === ''} OR
        u.telegram_id ILIKE ${pattern} OR
        COALESCE(u.username, '') ILIKE ${pattern} OR
        u.first_name ILIKE ${pattern} OR
        COALESCE(u.full_name, '') ILIKE ${pattern} OR
        COALESCE(u.crm_tag, '') ILIKE ${pattern}
      ORDER BY u.updated_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      telegramId: String(r.telegram_id),
      chatId: String(r.chat_id),
      firstName: String(r.first_name),
      lastName: r.last_name ? String(r.last_name) : undefined,
      username: r.username ? String(r.username) : undefined,
      fullName: r.full_name ? String(r.full_name) : undefined,
      contact: r.contact ? String(r.contact) : undefined,
      balance: Number(r.balance) || 0,
      referralCount: Number(r.referral_count) || 0,
      referredBy: r.referred_by ? String(r.referred_by) : undefined,
      isBanned: Boolean(r.is_banned),
      projectCount: Number(r.project_count) || 0,
      crmTag: r.crm_tag ? String(r.crm_tag) : undefined,
      crmNote: r.crm_note ? String(r.crm_note) : undefined,
      totalDeposited: Number(r.total_deposited) || 0,
      totalSpent: Number(r.total_spent) || 0,
      createdAt: Number(r.created_ms) || Date.now(),
      updatedAt: Number(r.updated_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListUsersAdmin Error]', err);
    return null;
  }
}

export async function dbListOrdersAdmin(limit = 100): Promise<DbPaymentOrder[] | null> {
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
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
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
    }));
  } catch (err) {
    console.error('[Neon dbListOrdersAdmin Error]', err);
    return null;
  }
}

export async function dbListAuditLogs(limit = 80): Promise<AdminAuditRow[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  try {
    const rows = (await sql`
      SELECT
        id,
        actor_id,
        action,
        target_id,
        amount,
        details,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      actorId: String(r.actor_id),
      action: String(r.action),
      targetId: r.target_id ? String(r.target_id) : undefined,
      amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : undefined,
      details: r.details ? String(r.details) : undefined,
      createdAt: Number(r.created_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListAuditLogs Error]', err);
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

// =========================================================================
// Managers, CRM Events, User CRM, Promo Codes, Broadcast & Analytics
// =========================================================================

function mapManagerRow(r: Record<string, unknown>): DbManagerRecord {
  const permsRaw = Array.isArray(r.permissions) ? r.permissions : [];
  return {
    telegramId: String(r.telegram_id),
    firstName: String(r.first_name || 'Menejer'),
    username: r.username ? String(r.username) : undefined,
    roleTitle: String(r.role_title || 'Menejer'),
    permissions: permsRaw.map((p) => String(p)) as DbManagerPermission[],
    passwordHash: r.password_hash ? String(r.password_hash) : undefined,
    hasPassword: Boolean(r.password_hash),
    isActive: r.is_active !== false,
    notifyTelegram: r.notify_telegram !== false,
    addedBy: r.added_by ? String(r.added_by) : undefined,
    createdAt: Number(r.created_ms) || Date.now(),
    updatedAt: Number(r.updated_ms) || Date.now(),
  };
}

export async function dbListManagers(): Promise<DbManagerRecord[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT
        telegram_id, first_name, username, role_title, permissions,
        (password_hash IS NOT NULL AND password_hash <> '') AS has_pwd,
        is_active, notify_telegram, added_by,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
      FROM managers
      ORDER BY created_at DESC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      ...mapManagerRow(r),
      passwordHash: undefined,
      hasPassword: Boolean(r.has_pwd),
    }));
  } catch (err) {
    console.error('[Neon dbListManagers Error]', err);
    return null;
  }
}

export async function dbGetManagerById(telegramId: string): Promise<DbManagerRecord | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT
        telegram_id, first_name, username, role_title, permissions,
        password_hash, is_active, notify_telegram, added_by,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
      FROM managers
      WHERE telegram_id = ${telegramId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (!rows[0]) return null;
    return mapManagerRow(rows[0]);
  } catch (err) {
    console.error('[Neon dbGetManagerById Error]', err);
    return null;
  }
}

export async function dbUpsertManager(params: {
  telegramId: string;
  firstName: string;
  username?: string;
  roleTitle: string;
  permissions: DbManagerPermission[];
  passwordHash?: string;
  isActive: boolean;
  notifyTelegram: boolean;
  addedBy: string;
}): Promise<DbManagerRecord | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const permsJson = JSON.stringify(params.permissions);
    const rows = (await sql`
      INSERT INTO managers (
        telegram_id, first_name, username, role_title, permissions, password_hash, is_active, notify_telegram, added_by
      )
      VALUES (
        ${params.telegramId},
        ${params.firstName},
        ${params.username ?? null},
        ${params.roleTitle},
        ${permsJson}::jsonb,
        ${params.passwordHash ?? null},
        ${params.isActive},
        ${params.notifyTelegram},
        ${params.addedBy}
      )
      ON CONFLICT (telegram_id) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        username = COALESCE(EXCLUDED.username, managers.username),
        role_title = EXCLUDED.role_title,
        permissions = EXCLUDED.permissions,
        password_hash = COALESCE(${params.passwordHash ?? null}, managers.password_hash),
        is_active = EXCLUDED.is_active,
        notify_telegram = EXCLUDED.notify_telegram,
        updated_at = NOW()
      RETURNING
        telegram_id, first_name, username, role_title, permissions,
        (password_hash IS NOT NULL AND password_hash <> '') AS has_pwd,
        is_active, notify_telegram, added_by,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms,
        EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    `) as Array<Record<string, unknown>>;
    if (!rows[0]) return null;
    return {
      ...mapManagerRow(rows[0]),
      passwordHash: undefined,
      hasPassword: Boolean(rows[0].has_pwd),
    };
  } catch (err) {
    console.error('[Neon dbUpsertManager Error]', err);
    return null;
  }
}

export async function dbDeleteManager(telegramId: string): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    await sql`DELETE FROM managers WHERE telegram_id = ${telegramId}`;
    return true;
  } catch (err) {
    console.error('[Neon dbDeleteManager Error]', err);
    return false;
  }
}

export async function dbAppendCrmEvent(entry: {
  id: string;
  eventType: DbCrmEvent['eventType'];
  title: string;
  message: string;
  userId?: string;
  amount?: number;
}): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    await sql`
      INSERT INTO crm_events (id, event_type, title, message, user_id, amount)
      VALUES (
        ${entry.id},
        ${entry.eventType},
        ${entry.title.slice(0, 140)},
        ${entry.message.slice(0, 500)},
        ${entry.userId ?? null},
        ${typeof entry.amount === 'number' ? Math.round(entry.amount) : null}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbAppendCrmEvent Error]', err);
    return false;
  }
}

export async function dbListCrmEvents(limit = 80): Promise<DbCrmEvent[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT
        id, event_type, title, message, user_id, amount, is_read,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM crm_events
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      eventType: String(r.event_type) as DbCrmEvent['eventType'],
      title: String(r.title),
      message: String(r.message),
      userId: r.user_id ? String(r.user_id) : undefined,
      amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : undefined,
      isRead: Boolean(r.is_read),
      createdAt: Number(r.created_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListCrmEvents Error]', err);
    return null;
  }
}

export async function dbMarkCrmEventsRead(eventIds?: string[]): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    if (Array.isArray(eventIds) && eventIds.length > 0) {
      await sql`UPDATE crm_events SET is_read = TRUE WHERE id = ANY(${eventIds})`;
    } else {
      await sql`UPDATE crm_events SET is_read = TRUE WHERE is_read = FALSE`;
    }
    return true;
  } catch (err) {
    console.error('[Neon dbMarkCrmEventsRead Error]', err);
    return false;
  }
}

export async function dbUpdateUserCrm(
  telegramId: string,
  crmTag: string,
  crmNote: string
): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    const rows = (await sql`
      UPDATE users
      SET crm_tag = ${crmTag || null}, crm_note = ${crmNote || null}, updated_at = NOW()
      WHERE telegram_id = ${telegramId}
      RETURNING telegram_id
    `) as Array<Record<string, unknown>>;
    return rows.length > 0;
  } catch (err) {
    console.error('[Neon dbUpdateUserCrm Error]', err);
    return false;
  }
}

export async function dbGetUserDetailAdmin(telegramId: string): Promise<{
  user: AdminUserRow;
  transactions: DbTransaction[];
  orders: DbPaymentOrder[];
  projects: DbProjectSummary[];
  referrals: Array<{ inviteeId: string; inviterBonus: number; createdAt: number }>;
} | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const uRows = (await sql`
      SELECT
        u.telegram_id, u.chat_id, u.first_name, u.last_name, u.username,
        u.full_name, u.contact, u.balance, u.referral_count, u.referred_by,
        u.is_banned, u.crm_tag, u.crm_note,
        EXTRACT(EPOCH FROM u.created_at) * 1000 AS created_ms,
        EXTRACT(EPOCH FROM u.updated_at) * 1000 AS updated_ms,
        (SELECT COUNT(*)::int FROM projects p WHERE p.telegram_id = u.telegram_id) AS project_count,
        COALESCE((SELECT SUM(t.amount)::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount > 0 AND t.external_order_id IS NOT NULL), 0) AS total_deposited,
        COALESCE((SELECT SUM(ABS(t.amount))::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount < 0), 0) AS total_spent
      FROM users u
      WHERE u.telegram_id = ${telegramId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;

    const r = uRows[0];
    if (!r) return null;

    const [transactions, oRows, projects, refRows] = await Promise.all([
      dbListUserTransactions(telegramId, 50),
      sql`
        SELECT order_id, telegram_id, chat_id, amount, pay_url, method, status, is_test, credited,
               EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
        FROM payment_orders
        WHERE telegram_id = ${telegramId}
        ORDER BY created_at DESC
        LIMIT 30
      ` as Promise<Array<Record<string, unknown>>>,
      dbListProjects(telegramId, 30),
      sql`
        SELECT invitee_id, inviter_bonus, EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
        FROM referrals
        WHERE inviter_id = ${telegramId}
        ORDER BY created_at DESC
        LIMIT 30
      ` as Promise<Array<Record<string, unknown>>>,
    ]);

    return {
      user: {
        telegramId: String(r.telegram_id),
        chatId: String(r.chat_id),
        firstName: String(r.first_name),
        lastName: r.last_name ? String(r.last_name) : undefined,
        username: r.username ? String(r.username) : undefined,
        fullName: r.full_name ? String(r.full_name) : undefined,
        contact: r.contact ? String(r.contact) : undefined,
        balance: Number(r.balance) || 0,
        referralCount: Number(r.referral_count) || 0,
        referredBy: r.referred_by ? String(r.referred_by) : undefined,
        isBanned: Boolean(r.is_banned),
        projectCount: Number(r.project_count) || 0,
        crmTag: r.crm_tag ? String(r.crm_tag) : undefined,
        crmNote: r.crm_note ? String(r.crm_note) : undefined,
        totalDeposited: Number(r.total_deposited) || 0,
        totalSpent: Number(r.total_spent) || 0,
        createdAt: Number(r.created_ms) || Date.now(),
        updatedAt: Number(r.updated_ms) || Date.now(),
      },
      transactions,
      orders: oRows.map((o) => ({
        orderId: String(o.order_id),
        telegramId: o.telegram_id ? String(o.telegram_id) : undefined,
        chatId: o.chat_id ? String(o.chat_id) : undefined,
        amount: Number(o.amount) || 0,
        payUrl: o.pay_url ? String(o.pay_url) : '',
        method: o.method ? String(o.method) : undefined,
        status: String(o.status || 'pending') as DbPaymentOrder['status'],
        isTest: Boolean(o.is_test),
        credited: Boolean(o.credited),
        createdAt: Number(o.created_ms) || Date.now(),
      })),
      projects: projects || [],
      referrals: refRows.map((rf) => ({
        inviteeId: String(rf.invitee_id),
        inviterBonus: Number(rf.inviter_bonus) || 0,
        createdAt: Number(rf.created_ms) || Date.now(),
      })),
    };
  } catch (err) {
    console.error('[Neon dbGetUserDetailAdmin Error]', err);
    return null;
  }
}

export async function dbGetAdminAnalytics(days = 14): Promise<{
  daily: Array<{ day: string; newUsers: number; paidRevenue: number; paidOrders: number; aiSpent: number }>;
  topSpenders: AdminUserRow[];
  serviceBreakdown: Array<{ label: string; count: number; totalAmount: number }>;
} | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;

  const safeDays = Math.min(30, Math.max(7, Math.round(days)));
  try {
    const [uDaily, pDaily, sDaily, topRows, srvRows] = await Promise.all([
      sql`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'MM-DD') AS day_key, COUNT(*)::int AS cnt
        FROM users
        WHERE created_at >= NOW() - (${safeDays} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      ` as Promise<Array<Record<string, unknown>>>,
      sql`
        SELECT TO_CHAR(DATE_TRUNC('day', updated_at), 'MM-DD') AS day_key,
               COUNT(*)::int AS orders,
               COALESCE(SUM(amount), 0)::bigint AS revenue
        FROM payment_orders
        WHERE status = 'paid' AND is_test = FALSE AND updated_at >= NOW() - (${safeDays} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      ` as Promise<Array<Record<string, unknown>>>,
      sql`
        SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'MM-DD') AS day_key,
               COALESCE(SUM(ABS(amount)), 0)::bigint AS spent
        FROM transactions
        WHERE amount < 0 AND created_at >= NOW() - (${safeDays} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      ` as Promise<Array<Record<string, unknown>>>,
      sql`
        SELECT
          u.telegram_id, u.chat_id, u.first_name, u.last_name, u.username,
          u.full_name, u.contact, u.balance, u.referral_count, u.referred_by,
          u.is_banned, u.crm_tag, u.crm_note,
          EXTRACT(EPOCH FROM u.created_at) * 1000 AS created_ms,
          EXTRACT(EPOCH FROM u.updated_at) * 1000 AS updated_ms,
          COALESCE((SELECT SUM(t.amount)::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount > 0 AND t.external_order_id IS NOT NULL), 0) AS total_deposited,
          COALESCE((SELECT SUM(ABS(t.amount))::bigint FROM transactions t WHERE t.telegram_id = u.telegram_id AND t.amount < 0), 0) AS total_spent
        FROM users u
        ORDER BY total_deposited DESC, total_spent DESC, u.balance DESC
        LIMIT 10
      ` as Promise<Array<Record<string, unknown>>>,
      sql`
        SELECT
          SPLIT_PART(title, ':', 1) AS svc_label,
          COUNT(*)::int AS cnt,
          COALESCE(SUM(ABS(amount)), 0)::bigint AS total_amt
        FROM transactions
        WHERE amount < 0
        GROUP BY 1
        ORDER BY total_amt DESC
        LIMIT 8
      ` as Promise<Array<Record<string, unknown>>>,
    ]);

    const dayMap = new Map<
      string,
      { day: string; newUsers: number; paidRevenue: number; paidOrders: number; aiSpent: number }
    >();
    const now = new Date();
    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86_400_000);
      const key = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      dayMap.set(key, { day: key, newUsers: 0, paidRevenue: 0, paidOrders: 0, aiSpent: 0 });
    }
    for (const r of uDaily) {
      const item = dayMap.get(String(r.day_key));
      if (item) item.newUsers = Number(r.cnt) || 0;
    }
    for (const r of pDaily) {
      const item = dayMap.get(String(r.day_key));
      if (item) {
        item.paidOrders = Number(r.orders) || 0;
        item.paidRevenue = Number(r.revenue) || 0;
      }
    }
    for (const r of sDaily) {
      const item = dayMap.get(String(r.day_key));
      if (item) item.aiSpent = Number(r.spent) || 0;
    }

    return {
      daily: Array.from(dayMap.values()),
      topSpenders: topRows.map((r) => ({
        telegramId: String(r.telegram_id),
        chatId: String(r.chat_id),
        firstName: String(r.first_name),
        lastName: r.last_name ? String(r.last_name) : undefined,
        username: r.username ? String(r.username) : undefined,
        fullName: r.full_name ? String(r.full_name) : undefined,
        contact: r.contact ? String(r.contact) : undefined,
        balance: Number(r.balance) || 0,
        referralCount: Number(r.referral_count) || 0,
        referredBy: r.referred_by ? String(r.referred_by) : undefined,
        isBanned: Boolean(r.is_banned),
        projectCount: 0,
        crmTag: r.crm_tag ? String(r.crm_tag) : undefined,
        crmNote: r.crm_note ? String(r.crm_note) : undefined,
        totalDeposited: Number(r.total_deposited) || 0,
        totalSpent: Number(r.total_spent) || 0,
        createdAt: Number(r.created_ms) || Date.now(),
        updatedAt: Number(r.updated_ms) || Date.now(),
      })),
      serviceBreakdown: srvRows.map((s) => ({
        label: String(s.svc_label || 'AI Xizmat'),
        count: Number(s.cnt) || 0,
        totalAmount: Number(s.total_amt) || 0,
      })),
    };
  } catch (err) {
    console.error('[Neon dbGetAdminAnalytics Error]', err);
    return null;
  }
}

export async function dbListPromoCodes(): Promise<DbPromoCode[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT
        code, bonus_amount, max_uses, used_count, is_active, created_by,
        CASE WHEN expires_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM expires_at) * 1000 END AS exp_ms,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM promo_codes
      ORDER BY created_at DESC
      LIMIT 100
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      code: String(r.code),
      bonusAmount: Number(r.bonus_amount) || 0,
      maxUses: Number(r.max_uses) || 0,
      usedCount: Number(r.used_count) || 0,
      isActive: r.is_active !== false,
      expiresAt: r.exp_ms ? Number(r.exp_ms) : null,
      createdBy: r.created_by ? String(r.created_by) : undefined,
      createdAt: Number(r.created_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListPromoCodes Error]', err);
    return null;
  }
}

export async function dbUpsertPromoCode(params: {
  code: string;
  bonusAmount: number;
  maxUses: number;
  isActive: boolean;
  expiresAt?: number | null;
  createdBy: string;
}): Promise<DbPromoCode | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const expIso = params.expiresAt ? new Date(params.expiresAt).toISOString() : null;
    const rows = (await sql`
      INSERT INTO promo_codes (code, bonus_amount, max_uses, is_active, expires_at, created_by)
      VALUES (
        ${params.code},
        ${Math.max(500, Math.min(1_000_000, Math.round(params.bonusAmount)))},
        ${Math.max(1, Math.min(100_000, Math.round(params.maxUses)))},
        ${params.isActive},
        ${expIso}::timestamptz,
        ${params.createdBy}
      )
      ON CONFLICT (code) DO UPDATE SET
        bonus_amount = EXCLUDED.bonus_amount,
        max_uses = EXCLUDED.max_uses,
        is_active = EXCLUDED.is_active,
        expires_at = EXCLUDED.expires_at
      RETURNING
        code, bonus_amount, max_uses, used_count, is_active, created_by,
        CASE WHEN expires_at IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM expires_at) * 1000 END AS exp_ms,
        EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
    `) as Array<Record<string, unknown>>;
    const r = rows[0];
    if (!r) return null;
    return {
      code: String(r.code),
      bonusAmount: Number(r.bonus_amount) || 0,
      maxUses: Number(r.max_uses) || 0,
      usedCount: Number(r.used_count) || 0,
      isActive: r.is_active !== false,
      expiresAt: r.exp_ms ? Number(r.exp_ms) : null,
      createdBy: r.created_by ? String(r.created_by) : undefined,
      createdAt: Number(r.created_ms) || Date.now(),
    };
  } catch (err) {
    console.error('[Neon dbUpsertPromoCode Error]', err);
    return null;
  }
}

export async function dbDeletePromoCode(code: string): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    await sql`DELETE FROM promo_codes WHERE code = ${code}`;
    return true;
  } catch (err) {
    console.error('[Neon dbDeletePromoCode Error]', err);
    return false;
  }
}

export async function dbRedeemPromoCode(params: {
  code: string;
  telegramId: string;
  dateLabel: string;
}): Promise<
  | { ok: true; bonusAmount: number; balance: number }
  | { ok: false; error: string }
  | null
> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const promoRows = (await sql`
      SELECT code, bonus_amount, max_uses, used_count, is_active, expires_at
      FROM promo_codes
      WHERE code = ${params.code}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    const p = promoRows[0];
    if (!p) return { ok: false, error: 'Promokod topilmadi.' };
    if (p.is_active === false) return { ok: false, error: 'Promokod faol emas.' };
    if (p.expires_at && new Date(String(p.expires_at)).getTime() < Date.now()) {
      return { ok: false, error: 'Promokod muddati tugagan.' };
    }
    if (Number(p.used_count) >= Number(p.max_uses)) {
      return { ok: false, error: "Promokod limiti to'lgan." };
    }

    const already = (await sql`
      SELECT id FROM promo_redemptions
      WHERE code = ${params.code} AND telegram_id = ${params.telegramId}
      LIMIT 1
    `) as Array<Record<string, unknown>>;
    if (already.length > 0) {
      return { ok: false, error: 'Siz bu promokoddan allaqachon foydalangansiz.' };
    }

    const updatedPromo = (await sql`
      UPDATE promo_codes
      SET used_count = used_count + 1
      WHERE code = ${params.code} AND is_active = TRUE AND used_count < max_uses
      RETURNING bonus_amount
    `) as Array<Record<string, unknown>>;
    if (!updatedPromo.length) {
      return { ok: false, error: "Promokod limiti to'lgan." };
    }

    const bonusAmount = Number(updatedPromo[0].bonus_amount) || 0;
    const redId = `pr_${params.code}_${params.telegramId}`;
    await sql`
      INSERT INTO promo_redemptions (id, code, telegram_id, bonus_amount)
      VALUES (${redId}, ${params.code}, ${params.telegramId}, ${bonusAmount})
    `;

    const txId = `promo_${params.code}_${params.telegramId}`;
    await sql`
      INSERT INTO transactions (id, telegram_id, title, method, amount, date_label)
      VALUES (
        ${txId},
        ${params.telegramId},
        ${`Promokod: ${params.code}`},
        ${'Promokod'},
        ${bonusAmount},
        ${params.dateLabel}
      )
      ON CONFLICT (id) DO NOTHING
    `;

    const uRows = (await sql`
      UPDATE users
      SET balance = balance + ${bonusAmount}, updated_at = NOW()
      WHERE telegram_id = ${params.telegramId}
      RETURNING balance
    `) as Array<Record<string, unknown>>;

    return {
      ok: true,
      bonusAmount,
      balance: Number(uRows[0]?.balance) || 0,
    };
  } catch (err) {
    console.error('[Neon dbRedeemPromoCode Error]', err);
    return null;
  }
}

export async function dbListBroadcastTargets(
  segment: 'all' | 'active' | 'vip' | 'zero_balance'
): Promise<Array<{ telegramId: string; chatId: string; firstName: string }> | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows =
      segment === 'vip'
        ? ((await sql`
            SELECT telegram_id, chat_id, first_name FROM users
            WHERE is_banned = FALSE AND (crm_tag = 'vip' OR balance >= 10000)
            ORDER BY updated_at DESC LIMIT 500
          `) as Array<Record<string, unknown>>)
        : segment === 'zero_balance'
          ? ((await sql`
              SELECT telegram_id, chat_id, first_name FROM users
              WHERE is_banned = FALSE AND balance < 1000
              ORDER BY updated_at DESC LIMIT 500
            `) as Array<Record<string, unknown>>)
          : ((await sql`
              SELECT telegram_id, chat_id, first_name FROM users
              WHERE is_banned = FALSE
              ORDER BY updated_at DESC LIMIT 500
            `) as Array<Record<string, unknown>>);

    return rows.map((r) => ({
      telegramId: String(r.telegram_id),
      chatId: String(r.chat_id),
      firstName: String(r.first_name || 'Foydalanuvchi'),
    }));
  } catch (err) {
    console.error('[Neon dbListBroadcastTargets Error]', err);
    return null;
  }
}

export async function dbLogBroadcast(entry: DbBroadcastLog): Promise<boolean> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return false;
  try {
    await sql`
      INSERT INTO broadcast_logs (id, actor_id, target_segment, message, total_targets, sent_count, failed_count)
      VALUES (
        ${entry.id},
        ${entry.actorId},
        ${entry.targetSegment},
        ${entry.message.slice(0, 2000)},
        ${entry.totalTargets},
        ${entry.sentCount},
        ${entry.failedCount}
      )
    `;
    return true;
  } catch (err) {
    console.error('[Neon dbLogBroadcast Error]', err);
    return false;
  }
}

export async function dbListBroadcastLogs(limit = 30): Promise<DbBroadcastLog[] | null> {
  const sql = getSql();
  if (!sql || !(await ensureDbSchema())) return null;
  try {
    const rows = (await sql`
      SELECT id, actor_id, target_segment, message, total_targets, sent_count, failed_count,
             EXTRACT(EPOCH FROM created_at) * 1000 AS created_ms
      FROM broadcast_logs
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      actorId: String(r.actor_id),
      targetSegment: String(r.target_segment),
      message: String(r.message),
      totalTargets: Number(r.total_targets) || 0,
      sentCount: Number(r.sent_count) || 0,
      failedCount: Number(r.failed_count) || 0,
      createdAt: Number(r.created_ms) || Date.now(),
    }));
  } catch (err) {
    console.error('[Neon dbListBroadcastLogs Error]', err);
    return null;
  }
}
