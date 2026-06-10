import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import {
  buildQuote,
  groupQuoteLines,
  loadAccounts,
  loadExamplePayloads,
  loadProducts,
  validateRoster,
} from "@/lib/fixtures";
import {
  type AuditEvent,
  type OrderRecord,
  type RosterRow,
  type WorkflowStatus,
} from "@/lib/types";

const orders = new Map<string, OrderRecord>();

function resolveOrderStorePath(): string {
  if (process.env.ORDER_STORE_PATH) {
    return process.env.ORDER_STORE_PATH;
  }

  if (process.env.VERCEL === "1" || process.env.VERCEL_ENV) {
    return path.join(process.env.TMPDIR ?? "/tmp", "b2b-dashboard", "demo-orders.json");
  }

  return path.join(process.cwd(), "files", "demo-orders.json");
}

const ORDER_STORE_PATH = resolveOrderStorePath();
const ONGOING_STATUSES = new Set<WorkflowStatus>([
  "Submitted",
  "Awaiting Design",
  "Design Approved / Locked",
  "ERP Sync Pending",
  "ERP Synced",
  "PO Raised",
  "In Production",
  "Received",
  "Picking",
  "Packed",
]);

let loadOrdersPromise: Promise<void> | null = null;

export interface AuditFeedEvent extends AuditEvent {
  orderId: string;
  externalOrderRef: string;
  accountName: string;
}

async function persistOrders(): Promise<void> {
  const payload = JSON.stringify([...orders.values()], null, 2);
  const tempPath = `${ORDER_STORE_PATH}.tmp`;

  await fs.mkdir(path.dirname(ORDER_STORE_PATH), { recursive: true });
  await fs.writeFile(tempPath, `${payload}\n`, "utf8");
  await fs.rename(tempPath, ORDER_STORE_PATH);
}

async function ensureOrdersLoaded(): Promise<void> {
  if (!loadOrdersPromise) {
    loadOrdersPromise = (async () => {
      try {
        const raw = await fs.readFile(ORDER_STORE_PATH, "utf8");
        const storedOrders = JSON.parse(raw) as OrderRecord[];

        orders.clear();
        for (const order of storedOrders) {
          orders.set(order.id, order);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }

        await persistOrders();
      }
    })();
  }

  await loadOrdersPromise;
}

function createAuditEvent(
  status: WorkflowStatus,
  type: string,
  message: string,
): AuditEvent {
  return {
    id: randomUUID(),
    at: new Date().toISOString(),
    type,
    message,
    status,
  };
}

function makeExternalRef(): string {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `B2B-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

function assertTransition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export async function createOrder(
  accountId: string,
  roster: RosterRow[],
): Promise<OrderRecord> {
  await ensureOrdersLoaded();

  const [accounts, products] = await Promise.all([loadAccounts(), loadProducts()]);
  const account = accounts.find((entry) => entry.accountId === accountId) ?? accounts[0];
  const issues = validateRoster(roster, products);

  if (issues.length > 0) {
    throw new Error("Roster has validation issues.");
  }

  const quote = buildQuote(account, roster, products);
  const orderId = randomUUID();
  const order: OrderRecord = {
    id: orderId,
    externalOrderRef: makeExternalRef(),
    createdAt: new Date().toISOString(),
    account,
    status: "Draft",
    rosterValidated: true,
    quote,
    roster,
    proofUploaded: false,
    approvedByAuthorizedUser: false,
    lockedAt: null,
    packedConfirmed: false,
    invoiceAlreadyCreated: false,
    erpPayload: null,
    invoicePayload: null,
    auditLog: [createAuditEvent("Draft", "order.created", "Order created from valid roster")],
    pickGroups: groupQuoteLines(quote.lines),
  };

  orders.set(orderId, order);
  await persistOrders();

  return order;
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  await ensureOrdersLoaded();
  return orders.get(orderId) ?? null;
}

export async function listOrders(): Promise<OrderRecord[]> {
  await ensureOrdersLoaded();

  return [...orders.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function listOngoingOrders(): Promise<OrderRecord[]> {
  const allOrders = await listOrders();

  return allOrders.filter((order) => ONGOING_STATUSES.has(order.status));
}

export async function listAuditFeed(): Promise<AuditFeedEvent[]> {
  const allOrders = await listOrders();

  return allOrders
    .flatMap((order) =>
      order.auditLog.map((event) => ({
        ...event,
        orderId: order.id,
        externalOrderRef: order.externalOrderRef,
        accountName: order.account.accountName,
      })),
    )
    .sort((left, right) => right.at.localeCompare(left.at));
}

export async function clearOrders(): Promise<void> {
  await ensureOrdersLoaded();
  orders.clear();
  await persistOrders();
}

export async function transitionOrder(
  orderId: string,
  action: string,
): Promise<OrderRecord> {
  await ensureOrdersLoaded();

  const order = orders.get(orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (action === "submit") {
    assertTransition(order.status === "Draft", "Only draft orders can be submitted.");
    assertTransition(order.rosterValidated, "Roster must be validated before submit.");
    assertTransition(order.quote.total > 0, "Quote total must be greater than zero.");
    order.status = "Submitted";
    order.auditLog.unshift(
      createAuditEvent(order.status, "order.submitted", "Quote submitted for review"),
    );
  } else if (action === "await_design") {
    assertTransition(order.status === "Submitted", "Order must be submitted first.");
    order.status = "Awaiting Design";
    order.auditLog.unshift(
      createAuditEvent(order.status, "design.awaiting", "Awaiting design proof"),
    );
  } else if (action === "approve_design") {
    assertTransition(
      order.status === "Awaiting Design",
      "Design can only be approved from Awaiting Design.",
    );
    order.proofUploaded = true;
    order.approvedByAuthorizedUser = true;
    order.lockedAt = new Date().toISOString();
    assertTransition(order.proofUploaded, "Proof upload is required.");
    assertTransition(order.approvedByAuthorizedUser, "Authorized approval is required.");
    order.status = "Design Approved / Locked";
    order.auditLog.unshift(
      createAuditEvent(order.status, "design.approved", "Proof approved and order locked"),
    );
  } else if (action === "queue_erp") {
    assertTransition(
      order.status === "Design Approved / Locked",
      "Order must be locked before ERP sync.",
    );
    assertTransition(order.lockedAt !== null, "Locked timestamp is required.");
    const examples = await loadExamplePayloads();
    order.erpPayload = {
      ...examples.erp,
      external_order_ref: order.externalOrderRef,
      account_code: order.account.accountId,
      status: "ERP Sync Pending",
      lines: order.quote.lines.map((line) => ({
        sku: line.sku,
        size: line.size,
        qty: line.quantity,
        notes: `Pack ${line.packGroup}`,
      })),
    };
    order.status = "ERP Sync Pending";
    order.auditLog.unshift(
      createAuditEvent(order.status, "erp.queued", "Mock ERP payload generated"),
    );
  } else if (action === "mark_erp_synced") {
    assertTransition(order.status === "ERP Sync Pending", "ERP sync must be pending first.");
    assertTransition(order.erpPayload !== null, "ERP payload has not been generated.");
    order.status = "ERP Synced";
    order.auditLog.unshift(
      createAuditEvent(order.status, "erp.synced", "ERP sync completed"),
    );
  } else if (action === "start_picking") {
    assertTransition(order.status === "ERP Synced", "ERP sync must complete before picking.");
    order.status = "Picking";
    order.auditLog.unshift(
      createAuditEvent(order.status, "warehouse.picking", "Warehouse picking started"),
    );
  } else if (action === "mark_packed") {
    assertTransition(order.status === "Picking", "Picking must start before packing.");
    order.packedConfirmed = true;
    order.status = "Packed";
    order.auditLog.unshift(
      createAuditEvent(order.status, "warehouse.packed", "Packed confirmation recorded"),
    );
  } else if (action === "create_invoice") {
    assertTransition(order.status === "Packed", "Only packed orders can be invoiced.");
    assertTransition(order.packedConfirmed, "Packed confirmation is required.");
    assertTransition(!order.invoiceAlreadyCreated, "Invoice already exists for this order.");
    const examples = await loadExamplePayloads();
    order.invoicePayload = {
      ...examples.xero,
      invoice_ref: `INV-${order.externalOrderRef}`,
      account_code: order.account.accountId,
      lines: [
        {
          description: `B2B teamwear order ${order.externalOrderRef}`,
          quantity: 1,
          unit_amount: Number(order.quote.total.toFixed(2)),
        },
      ],
    };
    order.invoiceAlreadyCreated = true;
    order.status = "Invoiced";
    order.auditLog.unshift(
      createAuditEvent(order.status, "invoice.created", "Mock Xero invoice created"),
    );
  } else {
    throw new Error("Unknown action.");
  }

  orders.set(orderId, order);
  await persistOrders();
  return order;
}