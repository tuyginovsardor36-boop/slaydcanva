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
}
