# MVP implementation traceability

| UC / FR area | Existing screen | API / module | Status | Evidence |
|---|---|---|---|---|
| UC-01/02 account and password | `pages/login.html` | `/api/auth`, auth module | PARTIAL | Existing login/register; reset/forced-change workflow is not implemented |
| UC-03/04 building and room | `pages/can-tro.html`, `pages/phong.html` | legacy management/room routes | PARTIAL | CRUD exists, ownership and full state rules need hardening |
| UC-05/06 tenant/contract/deposit | tenant/contract/deposit screens | legacy routes/services | PARTIAL | Existing CRUD; full SRS approval and lifecycle rules remain |
| UC-09 tenant electricity reading | `pages/khach-thue/nhap-chi-so-dien.html` | `/api/v1/me/meter-reading-*` | PARTIAL | Upload/OCR fallback/manual value/submission implemented; DB E2E pending |
| UC-10 landlord confirmation | `pages/dien-nuoc.html` | `/api/v1/meter-readings/*` | PARTIAL | list/edit/confirm/correction/manual routes and UI wiring implemented |
| UC-11/12 receipts and payments | payment screens | legacy billing/payment routes | PARTIAL | Basic bill/payment code exists; receipt ledger, adjustments, idempotency and transaction invariants incomplete |
| UC-13/16/17/18 requests and checkout | request/checkout screens | legacy/incomplete | BLOCKED | No complete request aggregate/workflow in current backend |
| UC-22…29 incidents, expenses, co-tenants, reports | existing screens | incomplete | BLOCKED | Domain persistence/workflows not present |
| UC-27 notifications | notification screens | `ThongBao`, cron | PARTIAL | In-app notifications exist; durable Kafka worker not configured |
