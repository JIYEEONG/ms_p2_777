# MOOV admin dashboard design QA

- source visual truth: attached `moov_admin_dashboard_source_redownload_20260923.zip`
- implementation: `front/public/dashboard/index.html`
- local URL: `http://localhost:3000/dashboard/#dashboard`
- state: dashboard home with integration adapter loaded
- target viewport: source responsive desktop and mobile layouts

## Source fidelity evidence

- `styles.css`, `app.js`, `manage.js`, `vehicle-management.js`, `manage.css`, `vehicle-management.css`, and `content-management.css` are byte-identical to the attached source.
- `index.html` is byte-identical after removing the single added `<script src="./integration.js"></script>` tag.
- Original dashboard, vehicle, product, member, AI, and theme panels remain present.
- Original modal, export, import, restock, vehicle action, AI configuration, and theme handlers remain present.

## Connection evidence

- The integration layer reads the current `moov-app-v3:{user}` and `moov-outing-v1:{user}` contracts.
- It connects `/api/auth/me`, `/api/outing/health`, `/api/outing/popularity`, and `/api/hot-products`.
- It supplies compatibility for the attached source's config, events, payments, Python import, and asset upload APIs.
- The app reads `moov_admin_bridge_v1` and applies administrator product and default theme changes.

## Automated checks

- Six dashboard preservation and integration tests pass.
- All four dashboard scripts parse successfully.
- Dashboard HTML, CSS, integration, management, and vehicle resources return HTTP 200.

## Visual comparison limitation

The current environment exposes neither an in-app browser nor Chrome, so a same-viewport screenshot comparison and browser-console inspection could not be completed. Source identity checks prove that the supplied styling and feature scripts were not redesigned, but they do not replace rendered visual evidence.

final result: blocked
