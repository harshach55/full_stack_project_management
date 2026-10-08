# ADR-0006: REST API conventions and documentation

- Status: accepted
- Date: 2026-10-08

## Context

The required endpoint list is fixed (`/api/auth/*`, `/api/projects`, `/api/tasks`, `/api/dashboard`). Phase 1 decided: `PUT` is a full replacement and partial bodies are rejected (PD-07); no `PATCH` (PD-06); newest-first lists (PD-13); 404 for foreign resources (PD-17); filtered task lists behave as in PD-11. API documentation must be served at `/api/docs` and `/api/docs.json` and stay in sync with the real API.

## Decision

- JSON over HTTPS, all routes under `/api`. Plural resource names, ids in the path.
- Methods: `GET` (read), `POST` (create, auth actions), `PUT` (full replacement), `DELETE`. No `PATCH`.
- `PUT` bodies must contain every editable field; optional fields are sent as `null` to clear them. A missing field is a validation error (400).
- Status codes: 200 read/update, 201 create, 204 delete and logout, 400 validation, 401 authentication, 403 origin check only, 404 missing or not owned, 409 duplicate email, 413 body too large, 429 rate limit, 500 unexpected. Health check may return 503.
- List filters as query parameters: projects `search`, `status`; tasks `search`, `status`, `priority`, `projectId`. All combine with AND.
- Lists return all matching items, newest first. No pagination in the initial version (scope document, section 3).
- Formats: ids are UUID strings; date-only fields are `YYYY-MM-DD`; timestamps are ISO 8601 in UTC.
- Additional route: `GET /api/health` (not part of the required list, used for operations).
- **OpenAPI is generated from the shared Zod schemas** (with a Zod-to-OpenAPI library such as `@asteasolutions/zod-to-openapi`) and served as JSON at `/api/docs.json` and through Swagger UI at `/api/docs`.

## Alternatives considered

- **Hand-written OpenAPI YAML:** full control, but it duplicates the validation rules and drifts as soon as a schema changes.
- **JSDoc comments on routes converted to OpenAPI:** the documentation still lives apart from the validation code.
- **Partial `PUT` or adding `PATCH`:** ruled out by PD-06 and PD-07.
- **Pagination from the start:** optional; per-user data volume is small. Can be added later as optional query parameters without breaking clients.

## Decision rationale

Generating the documentation from the schemas the API actually uses for validation keeps the two in sync by construction. The remaining conventions are standard REST practice and follow the Phase 1 decisions directly.

## Tradeoffs

- Route metadata (summary, responses) must be registered next to each route, which adds some code per endpoint.
- Without pagination, a very large list would be returned in one response; acceptable for the expected data size.

## Consequences

- Phase 4 defines exact request and response bodies, the success envelope (if any) and the error format.
- A test in Phase 5 checks that every mounted route appears in the OpenAPI document.
- Swagger UI needs a Content Security Policy that allows its assets; helmet is configured accordingly for `/api/docs` only.
