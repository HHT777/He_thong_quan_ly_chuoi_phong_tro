# Implementation progress

## 2026-10-04 — Initial brownfield survey and MVP foundation

- Read `SRS.md`, `system_design.md`, `architecture.md`, `cau_truc_thu_muc.md`, `api_contract.md`, the existing Node/Express backend, Vite frontend, and `OCR/meter_ocr/`.
- Confirmed the repository is a modular monolith today: Node/Express API, Sequelize/MySQL models, static frontend, and a separate FastAPI OCR process exposing `POST /ocr`.
- Preserved the existing legacy `/api/*` routes. Added a versioned `/api/v1` meter-reading slice rather than silently changing old response shapes.
- Implemented additive MVP foundation for UC-09/UC-10: multipart OCR preview, tenant submission, landlord list/detail/edit/confirm/correction/manual routes, role checks, optimistic version checks, audit rows, outbox rows, idempotency schema, private evidence path, and a common v1 error envelope.
- Corrected the frontend API client so it sends a real Bearer token and does not force JSON `Content-Type` for `FormData`.
- Removed database connection side effects from module import so `/health` remains a liveness check and `/ready` can report database failure explicitly.
- Migration: `phong-tro-backend/migrations/001_mvp_foundation.sql`. Runtime requires this migration before `DB_SYNC=false`.

## 2026-10-04 — Local runtime verification and UC-09/UC-10 integration

- XAMPP MariaDB 10.4.32 is running on `127.0.0.1:3306`; the foundation migration completed successfully twice and is rerunnable.
- FastAPI OCR is running on `http://127.0.0.1:8000`; `/health` and a real sample `POST /ocr` returned success (`16959`).
- Node API is running on `http://127.0.0.1:3001`; `/health`, `/ready`, and real login succeeded.
- Added a real HTTP integration test covering OCR preview, submit, submit idempotency, tenant A/B listing isolation, landlord listing, confirmation calculation, and tenant write denial:
  `phong-tro-backend/tests/meter-reading.integration.test.js`.
- The integration test passed against the running MariaDB and OCR services. Invalid MIME was also verified to return `415 UNSUPPORTED_MEDIA_TYPE`.
- Fixed idempotent response decoding when MariaDB returns JSON payloads as strings and fixed the landlord guard used by meter-reading update/confirm handlers.
- UC-09 and UC-10 remain **PARTIAL**: the full 12-case contract matrix, tenant-A/tenant-B fixture isolation, concurrent confirmation, rollback, existing-bill conflict, correction history, and browser E2E have not all been executed.

### Known blockers / follow-up

- Docker Desktop is unavailable, so Kafka/Compose worker verification remains blocked. Outbox persistence is implemented; Kafka publisher/consumer wiring remains PARTIAL.
- The remaining SRS slices (full account/room/contract workflow, receipts/adjustments/debt, requests/checkout, incidents/expenses/co-tenants/reports) are not complete yet.
