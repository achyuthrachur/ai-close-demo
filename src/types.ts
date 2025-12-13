export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type JEFlag = 'DUPLICATE' | 'UNUSUAL_AMOUNT' | 'REVERSAL_ISSUE';

export interface JournalEntry {
  jeId: string;
  postingDate: string; // ISO date string
  period: string; // e.g., 2025-06
  account: string;
  costCenter: string;
  debit: number;
  credit: number;
  description: string;
  preparer: string;
  approver: string;
  sourceSystem: string;
  reversalOf?: string;
}

export interface FlaggedEntry {
  entry: JournalEntry;
  flags: JEFlag[];
  risk: RiskLevel;
  context: {
    accountAverage?: number;
    accountStdDev?: number;
    duplicateCount?: number;
    hasMatchingReversal?: boolean;
    daysSinceOriginal?: number;
  };
}

export interface VendorProfile {
  vendorId: string;
  vendorName: string;
  defaultGLAccount: string;
  costCenter: string;
}

export interface VendorInvoice {
  vendorId: string;
  vendorName: string;
  invoiceId: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  glAccount: string;
  costCenter: string;
  status: 'PAID' | 'UNPAID';
  period: string;
}

export type CadenceLabel = 'Monthly' | 'Quarterly' | 'Irregular' | 'Unknown';

export interface AccrualCandidate {
  vendorId: string;
  vendorName: string;
  cadence: CadenceLabel;
  historyCount: number;
  lastInvoiceDate?: string;
  averageAmount?: number;
  expectedMissing: boolean;
  suggestedAccrual?: number;
  currency: string;
  glAccount: string;
  costCenter: string;
  confidence: number;
  recentInvoices: VendorInvoice[];
}
