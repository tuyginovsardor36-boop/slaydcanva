export type WorkspaceMode = 'pptx' | 'word' | 'pdf';

export type MobileTab = 'home' | 'files' | 'editor' | 'topup' | 'balance' | 'profile';

export type DesktopView = 'services' | 'editor';

export type AiServiceId =
  | 'academic_wave_pptx'
  | 'white_card_pptx'
  | 'ai_canvas_design'
  | 'independent_work_word'
  | 'course_work_word'
  | 'essay_article_word'
  | 'stitched_notebook_pdf'
  | 'five_block_infographic';

export type AcademicWordStyle =
  | 'classic_otm'
  | 'framed_academic'
  | 'modern_university'
  | 'imrad_journal'
  | 'analytical_essay'
  | 'conference_thesis';

export type SlideDesignTheme =
  | 'academic_gold'
  | 'royal_navy'
  | 'crimson_dark'
  | 'clean_white'
  | 'emerald_green'
  | 'terracotta_editorial'
  | 'obsidian_minimal'
  | 'violet_tech';

export type AiTone = 'academic' | 'business' | 'lesson' | 'creative';

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
  marginPreset: 'gost_academic' | 'normal' | 'narrow' | 'wide';
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

export type StaffRole = 'super_admin' | 'manager' | 'support' | 'user';

export type ManagerPermission =
  | 'overview'
  | 'crm_events'
  | 'users'
  | 'balance'
  | 'orders'
  | 'pricing'
  | 'promos'
  | 'broadcast'
  | 'settings'
  | 'support'
  | 'security';

export interface TelegramUser {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  autoSendFiles?: boolean;
  notifyOnActivity?: boolean;
  referralCount?: number;
  isAdmin?: boolean;
  isManager?: boolean;
  isSupport?: boolean;
  staffRole?: StaffRole;
  managerPermissions?: ManagerPermission[];
  isBanned?: boolean;
}

export interface ServicePricingConfig {
  basePrice: number;
  baseLimit: number;
  extraStepPrice: number;
  enabled?: boolean;
}

export interface AppPricingSettings {
  services: {
    academic_wave_pptx: ServicePricingConfig;
    white_card_pptx: ServicePricingConfig;
    ai_canvas_design: ServicePricingConfig;
    independent_work_word: ServicePricingConfig;
    course_work_word: ServicePricingConfig;
    essay_article_word: ServicePricingConfig;
    stitched_notebook_pdf: ServicePricingConfig;
    five_block_infographic: { basePrice: number; enabled?: boolean };
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
  telegramOnlyMode: boolean;
  supportUsername: string;
  botWelcomeTitle?: string;
  strictWebhookSignature?: boolean;
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
  activeSupportAgents?: number;
  unreadCrmEvents?: number;
  openSupportTickets?: number;
  unresolvedSecurityLogs?: number;
  todayRevenue?: number;
  todayNewUsers?: number;
}

export interface AdminUserRow {
  telegramId: string;
  chatId: string;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
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
  roleType?: 'manager' | 'support';
  isSupportDefault?: boolean;
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
    | 'user_banned'
    | 'support_message';
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
  promoUses?: number;
  projectsCreated?: number;
  avgOrderValue?: number;
  netCashflow?: number;
  activeUsers?: number;
}

export interface HourlyAnalyticsPoint {
  hour: number;
  label: string;
  count: number;
  revenue: number;
}

export interface AdminAnalyticsPayload {
  daily: DailyAnalyticsPoint[];
  topSpenders: AdminUserRow[];
  serviceBreakdown: Array<{ label: string; count: number; totalAmount: number }>;
  hourlyActivity?: HourlyAnalyticsPoint[];
  paymentMethodBreakdown?: Array<{ method: string; count: number; amount: number }>;
  userSegmentBreakdown?: Array<{ segment: string; count: number }>;
  staffActivityBreakdown?: Array<{ actorId: string; name: string; role: string; actions: number }>;
  supportMetrics?: {
    openCount: number;
    pendingCount: number;
    resolvedCount: number;
    totalMessages: number;
    telegramChannelCount: number;
    siteChannelCount: number;
  };
  securityMetrics?: {
    totalLogs: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    unresolvedCount: number;
    dailyThreats: Array<{ day: string; count: number; critical: number }>;
  };
  referralMetrics?: {
    totalReferrals: number;
    totalInviterBonus: number;
    conversionRate: number;
  };
  economyMetrics?: {
    totalDeposited: number;
    totalSpent: number;
    promoBonusGiven: number;
    netMargin: number;
    retentionRate: number;
    repeatOrderRate: number;
    averageOrderValue: number;
  };
}

export interface AdminUserDetailPayload {
  user: AdminUserRow;
  transactions: BalanceTransaction[];
  orders: AdminOrderRow[];
  projects: ProjectSummary[];
  referrals: Array<{ inviteeId: string; inviterBonus: number; createdAt: number }>;
}

export type SupportTicketStatus = 'open' | 'pending' | 'resolved';

export interface SupportAgentPublic {
  telegramId: string;
  firstName: string;
  username?: string;
  roleTitle: string;
  isDefault: boolean;
}

export interface SupportTicketRow {
  id: string;
  telegramId: string;
  userFirstName: string;
  userUsername?: string;
  assignedTo?: string;
  assignedName?: string;
  status: SupportTicketStatus;
  subject: string;
  lastMessage: string;
  unreadForStaff: number;
  unreadForUser: number;
  updatedAt: number;
  createdAt: number;
}

export interface InboxMessageRow {
  id: string;
  threadId: string;
  telegramId: string;
  senderRole: 'user' | 'staff';
  senderId: string;
  senderName: string;
  channel: 'site' | 'telegram' | 'both';
  message: string;
  isRead: boolean;
  createdAt: number;
}

export type SecurityLogSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityLogRow {
  id: string;
  severity: SecurityLogSeverity;
  category: string;
  title: string;
  details: string;
  ipAddress?: string;
  userId?: string;
  path?: string;
  isResolved: boolean;
  notifiedStaff: boolean;
  createdAt: number;
}

export interface SecurityScanCheck {
  id: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  severity: SecurityLogSeverity;
  message: string;
  recommendation?: string;
}

export interface SecurityScanReport {
  scannedAt: number;
  score: number;
  riskLevel: 'safe' | 'moderate' | 'elevated' | 'critical';
  checks: SecurityScanCheck[];
  summary: string;
  threatsDetected: number;
}

export interface UserFileRecord {
  id: string;
  fileName: string;
  format: 'pptx' | 'pdf' | 'docx' | 'png';
  sizeBytes: number;
  sentToTelegram: boolean;
  createdAt: number;
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
