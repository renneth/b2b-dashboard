# B2B Dashboard

This app is a demo B2B ordering workflow built with Next.js. It simulates roster validation, quote generation, order submission, workflow progression, warehouse picking, invoice creation, and an audit trail using local fixture files plus a JSON-backed demo order store.

## What the app does

- Validates uploaded roster CSV data against fixture products and account pricing.
- Creates draft orders and submits them into a shared dashboard queue.
- Moves orders through a simplified operational workflow from `Draft` to `Invoiced`.
- Generates mock ERP and invoice payloads during the workflow.
- Persists demo orders and audit history in `files/demo-orders.json`.

## Local setup

### Prerequisites

- Node.js 20+
- pnpm

### Install and run

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

### Useful commands

```bash
pnpm lint
pnpm build
pnpm start
```

## How to use the app

The app has three main user-facing workflows.

### 1. Dashboard workflow

Start on the dashboard at `/`.

- View all stored demo orders in the queue.
- Filter the queue by workflow status.
- Select an order to inspect its detail view.
- Review the current status, audit events, pick-list grouping, ERP payload, and invoice payload.
- Use the primary action button to move the selected order to its next implemented step.
- Use `Clear demo data` to remove all stored demo orders and audit history.

Implemented dashboard transitions:

1. `Submitted` -> `Awaiting Design`
2. `Awaiting Design` -> `Design Approved / Locked`
3. `Design Approved / Locked` -> `ERP Sync Pending`
4. `ERP Sync Pending` -> `ERP Synced`
5. `ERP Synced` -> `Picking`
6. `Picking` -> `Packed`
7. `Packed` -> `Invoiced`

### 2. New order workflow

Create orders from `/new-order`.

- Choose an account.
- Paste CSV content into the preview box or upload a `.csv` file.
- Use `Use Valid Sample` or `Use Invalid Sample` to test the flow quickly.
- Run `Validate` to check row-level issues and calculate a quote.
- If validation succeeds, use `Create order` to generate a draft.
- Review the draft summary and pick groups.
- Use `Submit` to move the draft to `Submitted` and return it to the dashboard queue.

Roster validation currently checks:

- Required team, player, and pack-group fields
- SKU existence
- Positive quantity
- SKU/size match
- Available stock after reserved quantity

### 3. Audit log workflow

Open `/audit-logs` to review the global event feed.

- See all order lifecycle events in reverse chronological order.
- Track how many total events and unique orders exist in the demo store.
- Use this page to confirm that order creation, submission, workflow progression, and invoicing are being recorded.

## Demo data and storage

The app reads seed data from the `files/` directory:

- `accounts.csv` for demo customer accounts
- `product_catalog.csv` for products, sizes, pricing, and stock
- `sample_roster_upload.csv` for a valid upload example
- `sample_roster_upload_invalid.csv` for validation failure scenarios
- `order_statuses.json` for the displayed workflow states
- `mock_erp_payload_example.json` and `mock_xero_invoice_example.json` for generated payload templates

Created orders and audit history are persisted to `files/demo-orders.json`.

## Workflow summary

### Dashboard queue

Operational view for all stored demo orders, status filters, and step-by-step progression.

### New order intake

Separated workflow for roster upload, validation, quote review, draft creation, and submission.

### Global audit feed

Read-only event log across all stored orders for tracking workflow activity and generated outputs.

## Current limitations

- This is a demo app with file-based storage only; there is no database or multi-user concurrency control.
- Orders persist in a single JSON file, so concurrent writes or deployment to serverless/multi-instance environments would need a different storage model.
- The workflow state list includes `PO Raised`, `In Production`, and `Received`, but those transitions are not implemented in the current UI or API.
- ERP and invoice generation use mock payload templates only; no external systems are called.
- Authentication, authorization, and role-based approvals are not implemented.
- Validation only covers a focused set of CSV and stock checks; it does not cover all commercial or operational business rules.
- There is no automated test suite yet.
- Resetting demo data clears all stored orders and audit history globally for the local app instance.

## Next implementation steps

1. Replace JSON persistence with a real database and transaction-safe write path.
2. Implement the missing workflow stages for `PO Raised`, `In Production`, and `Received`.
3. Add authentication and role-based permissions for sales, design, warehouse, and finance actions.
4. Introduce automated tests for CSV validation, and controlled tweaking of fields before pushing it to the next stage.
5. Add stronger validation for duplicate rows, account-specific product rules, lead times, and pricing exceptions.
6. Integrate real ERP and invoicing adapters behind service boundaries instead of mock payload generation.
7. Add optimistic refresh or live updates so multiple users can see queue changes reliably.
8. Add export/reporting capabilities for audit history, pick lists, and operational metrics.
