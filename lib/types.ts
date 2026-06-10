export type PricingTier = "Gold" | "Silver" | "Bronze";

export type WorkflowStatus =
  | "Draft"
  | "Submitted"
  | "Awaiting Design"
  | "Design Approved / Locked"
  | "ERP Sync Pending"
  | "ERP Synced"
  | "PO Raised"
  | "In Production"
  | "Received"
  | "Picking"
  | "Packed"
  | "Invoiced";

export interface Product {
  productSku: string;
  productName: string;
  category: string;
  customizationType: string;
  size: string;
  unitPriceAud: number;
  stockOnHand: number;
  reserved: number;
  incomingEta: string | null;
  barcode: string | null;
  active: boolean;
}

export interface Account {
  accountId: string;
  accountName: string;
  contactName: string;
  pricingTier: PricingTier;
  discountPct: number;
  requiresDeposit: boolean;
  deliverySuburb: string;
  notes: string;
}

export interface RosterRow {
  team: string;
  playerName: string;
  playerNumber: string | null;
  productSku: string;
  size: string;
  quantity: number;
  packGroup: string;
  customizationNotes: string;
}

export interface WorkflowRule {
  from: WorkflowStatus;
  to: WorkflowStatus;
  guard: string;
}

export interface WorkflowConfig {
  statuses: WorkflowStatus[];
  rules: WorkflowRule[];
}

export interface QuoteLine {
  team: string;
  playerName: string;
  sku: string;
  size: string;
  quantity: number;
  packGroup: string;
  unitPrice: number;
  subtotal: number;
  stockAvailable: number;
  customizationNotes: string;
}

export interface QuoteSummary {
  account: Account;
  lines: QuoteLine[];
  subtotal: number;
  discountAmount: number;
  total: number;
  unitCount: number;
}

export interface ValidationIssue {
  rowNumber: number;
  playerName: string;
  message: string;
}

export interface ValidationResult {
  account: Account;
  rows: RosterRow[];
  issues: ValidationIssue[];
  quote: QuoteSummary;
}

export interface AuditEvent {
  id: string;
  at: string;
  type: string;
  message: string;
  status: WorkflowStatus;
}

export interface PickGroupSummary {
  packGroup: string;
  lines: QuoteLine[];
  totalUnits: number;
}

export interface OrderRecord {
  id: string;
  externalOrderRef: string;
  createdAt: string;
  account: Account;
  status: WorkflowStatus;
  rosterValidated: boolean;
  quote: QuoteSummary;
  roster: RosterRow[];
  proofUploaded: boolean;
  approvedByAuthorizedUser: boolean;
  lockedAt: string | null;
  packedConfirmed: boolean;
  invoiceAlreadyCreated: boolean;
  erpPayload: Record<string, unknown> | null;
  invoicePayload: Record<string, unknown> | null;
  auditLog: AuditEvent[];
  pickGroups: PickGroupSummary[];
}

export interface DashboardData {
  accounts: Account[];
  products: Product[];
  sampleRoster: RosterRow[];
  invalidRosterIssues: ValidationIssue[];
  workflow: WorkflowConfig;
  quote: QuoteSummary;
}