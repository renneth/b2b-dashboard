import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type Account,
  type DashboardData,
  type PickGroupSummary,
  type Product,
  type QuoteLine,
  type QuoteSummary,
  type RosterRow,
  type ValidationResult,
  type ValidationIssue,
  type WorkflowConfig,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "files");

export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      if (currentField.length > 0 || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
      }

      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.length > 0));
}

export async function readFixture(fileName: string): Promise<string> {
  return fs.readFile(path.join(DATA_DIR, fileName), "utf8");
}

async function loadCsvRecords(fileName: string): Promise<Record<string, string>[]> {
  const content = await readFixture(fileName);
  const [headers, ...rows] = parseCsv(content);

  return rows.map((row) => {
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {});
  });
}

function parseBoolean(value: string): boolean {
  return value.toUpperCase() === "TRUE";
}

function parseNumber(value: string): number {
  return Number.parseFloat(value);
}

export async function loadProducts(): Promise<Product[]> {
  const records = await loadCsvRecords("product_catalog.csv");

  return records.map((record) => ({
    productSku: record.product_sku,
    productName: record.product_name,
    category: record.category,
    customizationType: record.customization_type,
    size: record.size,
    unitPriceAud: parseNumber(record.unit_price_aud),
    stockOnHand: Number.parseInt(record.stock_on_hand, 10),
    reserved: Number.parseInt(record.reserved, 10),
    incomingEta: record.incoming_eta || null,
    barcode: record.barcode || null,
    active: parseBoolean(record.active),
  }));
}

export async function loadAccounts(): Promise<Account[]> {
  const records = await loadCsvRecords("accounts.csv");

  return records.map((record) => ({
    accountId: record.account_id,
    accountName: record.account_name,
    contactName: record.contact_name,
    pricingTier: record.pricing_tier as Account["pricingTier"],
    discountPct: Number.parseInt(record.discount_pct, 10),
    requiresDeposit: parseBoolean(record.requires_deposit),
    deliverySuburb: record.delivery_suburb,
    notes: record.notes,
  }));
}

export function parseRosterRecords(records: Record<string, string>[]): RosterRow[] {
  return records.map((record) => ({
    team: record.team,
    playerName: record.player_name,
    playerNumber: record.player_number || null,
    productSku: record.product_sku,
    size: record.size,
    quantity: Number.parseInt(record.quantity, 10),
    packGroup: record.pack_group,
    customizationNotes: record.customization_notes,
  }));
}

export function parseRosterCsv(content: string): RosterRow[] {
  const [headers, ...rows] = parseCsv(content);
  const records = rows.map((row) => {
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {});
  });

  return parseRosterRecords(records);
}

export async function loadRoster(fileName: string): Promise<RosterRow[]> {
  const records = await loadCsvRecords(fileName);

  return parseRosterRecords(records);
}

export async function loadWorkflow(): Promise<WorkflowConfig> {
  const raw = await readFixture("order_statuses.json");
  return JSON.parse(raw) as WorkflowConfig;
}

function formatPlayerName(row: RosterRow): string {
  return row.playerName || "Unknown";
}

export function validateRoster(
  rows: RosterRow[],
  products: Product[],
): ValidationIssue[] {
  const productsBySku = new Map(products.map((product) => [product.productSku, product]));

  return rows.flatMap((row, index) => {
    const issues: ValidationIssue[] = [];
    const product = productsBySku.get(row.productSku);

    if (!row.team || !row.playerName || !row.packGroup) {
      issues.push({
        rowNumber: index + 2,
        playerName: formatPlayerName(row),
        message: "Team, player, and pack group are required",
      });
    }

    if (!product) {
      issues.push({
        rowNumber: index + 2,
        playerName: formatPlayerName(row),
        message: "SKU not found",
      });
      return issues;
    }

    if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
      issues.push({
        rowNumber: index + 2,
        playerName: formatPlayerName(row),
        message: "Quantity must be a positive number",
      });
    }

    if (product.size !== row.size) {
      issues.push({
        rowNumber: index + 2,
        playerName: formatPlayerName(row),
        message: `Size ${row.size} does not match SKU size ${product.size}`,
      });
    }

    const available = product.stockOnHand - product.reserved;
    if (product.stockOnHand > 0 && Number.isFinite(row.quantity) && row.quantity > available) {
      issues.push({
        rowNumber: index + 2,
        playerName: formatPlayerName(row),
        message: `Only ${available} units available`,
      });
    }

    return issues;
  });
}

export function buildQuote(
  account: Account,
  roster: RosterRow[],
  products: Product[],
): QuoteSummary {
  const productsBySku = new Map(products.map((product) => [product.productSku, product]));

  const lines: QuoteLine[] = roster.flatMap((row) => {
    const product = productsBySku.get(row.productSku);
    if (!product || !Number.isFinite(row.quantity) || row.quantity <= 0) {
      return [];
    }

    const subtotal = product.unitPriceAud * row.quantity;

    return [
      {
        team: row.team,
        playerName: row.playerName,
        sku: row.productSku,
        size: row.size,
        quantity: row.quantity,
        packGroup: row.packGroup,
        unitPrice: product.unitPriceAud,
        subtotal,
        stockAvailable: Math.max(product.stockOnHand - product.reserved, 0),
        customizationNotes: row.customizationNotes,
      },
    ];
  });

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const unitCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const discountAmount = subtotal * (account.discountPct / 100);

  return {
    account,
    lines,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount,
    unitCount,
  };
}

export function groupQuoteLines(lines: QuoteLine[]): PickGroupSummary[] {
  const groups = new Map<string, QuoteLine[]>();

  for (const line of lines) {
    const current = groups.get(line.packGroup) ?? [];
    current.push(line);
    groups.set(line.packGroup, current);
  }

  return [...groups.entries()].map(([packGroup, groupedLines]) => ({
    packGroup,
    lines: groupedLines,
    totalUnits: groupedLines.reduce((sum, line) => sum + line.quantity, 0),
  }));
}

export async function validateRosterCsv(
  accountId: string,
  csvText: string,
): Promise<ValidationResult> {
  const [accounts, products] = await Promise.all([loadAccounts(), loadProducts()]);
  const account = accounts.find((entry) => entry.accountId === accountId) ?? accounts[0];
  const rows = parseRosterCsv(csvText);
  const issues = validateRoster(rows, products);
  const validRows = issues.length === 0 ? rows : [];
  const quote = buildQuote(account, validRows, products);

  return {
    account,
    rows: validRows,
    issues,
    quote,
  };
}

export async function loadExamplePayloads(): Promise<{
  erp: Record<string, unknown>;
  xero: Record<string, unknown>;
}> {
  const [erp, xero] = await Promise.all([
    readFixture("mock_erp_payload_example.json"),
    readFixture("mock_xero_invoice_example.json"),
  ]);

  return {
    erp: JSON.parse(erp) as Record<string, unknown>,
    xero: JSON.parse(xero) as Record<string, unknown>,
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const [accounts, products, sampleRoster, invalidRoster, workflow] = await Promise.all([
    loadAccounts(),
    loadProducts(),
    loadRoster("sample_roster_upload.csv"),
    loadRoster("sample_roster_upload_invalid.csv"),
    loadWorkflow(),
  ]);

  const quote = buildQuote(accounts[0], sampleRoster, products);
  const invalidRosterIssues = validateRoster(invalidRoster, products);

  return {
    accounts,
    products,
    sampleRoster,
    invalidRosterIssues,
    workflow,
    quote,
  };
}