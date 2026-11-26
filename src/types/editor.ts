export type WorkspaceMode = 'pptx' | 'word' | 'pdf';

export type MobileTab = 'home' | 'editor' | 'topup' | 'balance' | 'profile';

export type DesktopView = 'services' | 'editor';

export type AiServiceId =
  | 'academic_wave_pptx'
  | 'white_card_pptx'
  | 'stitched_notebook_pdf'
  | 'five_block_infographic'
  | 'ai_canvas_design';

export type ElementType = 'text' | 'rect' | 'circle' | 'image';

export type TextAlign = 'left' | 'center' | 'right';

export type PdfOrientation = 'portrait' | 'landscape';

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  // Text properties
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: TextAlign;
  color?: string;
  padding?: number;
  lineHeight?: number;
  // Shape properties
  fill?: string;
  gradient?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  shadow?: boolean;
  // Image properties
  src?: string;
  imageFit?: 'contain' | 'cover';
}

export interface CanvasPage {
  id: string;
  title?: string;
  background: string;
  backgroundImage?: string;
  elements: CanvasElement[];
}

export interface WordDocumentData {
  html: string;
  fontFamily: string;
  fontSize: number;
  marginPreset: 'normal' | 'narrow' | 'wide';
}

export interface BalanceTransaction {
  id: string;
  title: string;
  method: string;
  amount: number;
  date: string;
}

export interface UserProfile {
  fullName: string;
  contact: string;
}

export type TolovgoPaymentMode = 'live' | 'test';

export type StaffRole = 'super_admin' | 'manager' | 'user';

export type ManagerPermission =
  | 'overview'
  | 'crm_events'
  | 'users'
  | 'balance'
  | 'orders'
  | 'pricing'
  | 'promos'
  | 'broadcast'
  | 'settings';

export interface TelegramUser {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  autoSendFiles?: boolean;
  notifyOnActivity?: boolean;
  referralCount?: number;
  isAdmin?: boolean;
  isManager?: boolean;
  staffRole?: StaffRole;
  managerPermissions?: ManagerPermission[];
  isBanned?: boolean;
}

export interface ServicePricingConfig {
  basePrice: number;
  baseLimit: number;
  extraStepPrice: number;
}

export interface AppPricingSettings {
  services: {
    academic_wave_pptx: ServicePricingConfig;
    white_card_pptx: ServicePricingConfig;
    stitched_notebook_pdf: ServicePricingConfig;
    five_block_infographic: { basePrice: number };
    ai_canvas_design: ServicePricingConfig;
  };
  welcomeBonus: number;
  referralInviterBonus: number;
  referralInviteeBonus: number;
  dailyReferralLimit: number;
}

export interface SiteConfigSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementBanner: string;
  notifyNewUsersToStaff: boolean;
  notifyPaymentsToStaff: boolean;
  defaultAiModel: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  bannedUsers: number;
  totalBalance: number;
  totalPaidOrders: number;
  totalPaidRevenue: number;
  totalReferrals: number;
  totalProjects: number;
  activeManagers?: number;
  unreadCrmEvents?: number;
  todayRevenue?: number;
  todayNewUsers?: number;
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
  projectCount?: number;
  crmTag?: string;
  crmNote?: string;
  totalDeposited?: number;
  totalSpent?: number;
  createdAt?: number;
  updatedAt: number;
}

export interface AdminOrderRow {
  orderId: string;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'refunded';
  isTest: boolean;
  credited: boolean;
  telegramId?: string;
  method?: string;
  createdAt: number;
}

export interface AdminAuditRow {
  id: string;
  actorId: string;
  action: string;
  targetId?: string;
  amount?: number;
  amountDelta?: number;
  details?: string;
  createdAt: number;
}

export interface ManagerRecord {
  telegramId: string;
  firstName: string;
  username?: string;
  roleTitle: string;
  permissions: ManagerPermission[];
  hasPassword: boolean;
  isActive: boolean;
  notifyTelegram: boolean;
  addedBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CrmEventRow {
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

export interface PromoCodeRow {
  code: string;
  bonusAmount: number;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: number | null;
  createdBy?: string;
  createdAt: number;
}

export interface BroadcastLogRow {
  id: string;
  actorId: string;
  targetSegment: string;
  message: string;
  totalTargets: number;
  sentCount: number;
  failedCount: number;
  createdAt: number;
}

export interface DailyAnalyticsPoint {
  day: string;
  newUsers: number;
  paidRevenue: number;
  paidOrders: number;
  aiSpent: number;
}

export interface AdminAnalyticsPayload {
  daily: DailyAnalyticsPoint[];
  topSpenders: AdminUserRow[];
  serviceBreakdown: Array<{ label: string; count: number; totalAmount: number }>;
}

export interface AdminUserDetailPayload {
  user: AdminUserRow;
  transactions: BalanceTransaction[];
  orders: AdminOrderRow[];
  projects: ProjectSummary[];
  referrals: Array<{ inviteeId: string; inviterBonus: number; createdAt: number }>;
}

export interface SlaydCanvaState {
  mode: WorkspaceMode;
  docTitle: string;
  pptxPages: CanvasPage[];
  activePptxId: string;
  pdfPages: CanvasPage[];
  pdfOrientation: PdfOrientation;
  activePdfId: string;
  wordDoc: WordDocumentData;
  balance: number;
  transactions: BalanceTransaction[];
  profile: UserProfile;
  tolovgoMode?: TolovgoPaymentMode;
  telegramUser?: TelegramUser | null;
  telegramSessionToken?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  mode: WorkspaceMode;
  pptxCount: number;
  pdfCount: number;
  updatedAt: number;
}

export interface CloudProjectData {
  id: string;
  title: string;
  mode: WorkspaceMode;
  pptxPages: CanvasPage[];
  pdfPages: CanvasPage[];
  pdfOrientation: PdfOrientation;
  wordDoc: WordDocumentData;
  tolovgoMode?: TolovgoPaymentMode;
  updatedAt: number;
}
