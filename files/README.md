# B2B Ordering Portal Prototype - Starter Data

This starter pack is for a masked Senior Full-Stack Developer technical assessment.
Do not use real client names, real customer data, real API credentials, or production systems.

## Files

- `product_catalog.csv` - sample products, sizes, prices, stock, reserved quantities and barcodes.
- `accounts.csv` - fictional customer accounts and pricing tiers.
- `sample_roster_upload.csv` - valid roster/order upload example.
- `sample_roster_upload_invalid.csv` - invalid rows to test CSV validation.
- `order_statuses.json` - suggested workflow statuses and a few transition guards.
- `mock_erp_payload_example.json` - example legacy ERP sales-order payload.
- `mock_xero_invoice_example.json` - example Xero-style invoice payload.

## Suggested build flow

1. Seed products and accounts.
2. Upload roster CSV and validate each row.
3. Preview quote and submit order.
4. Approve design and lock order.
5. Generate mock ERP integration event.
6. Show warehouse pick list grouped by `pack_group`.
7. Mark packed and generate mock Xero invoice event.
8. Show dashboard and audit/integration log.

## Important

The prototype should demonstrate business workflow thinking, integration readiness, validation, auditability and maintainability. It does not need to be visually perfect.
