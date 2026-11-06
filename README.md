# Garage console

A Next.js / Bun administration console for Garage 2.1. The operation catalog in lib/admin-spec.json is the official Garage v2.1.0 specification from Deuxfleurs, distributed under AGPL-3.0. The Garage logo is sourced from garagehq.deuxfleurs.fr. The button component is adapted from shadcn/ui (MIT).

Build with `bun install --frozen-lockfile && bun run build`, then `bun run start`, or build the Dockerfile. Configure the following server-only environment variables.

- CONSOLE_URL is the exact browser origin. Use HTTPS outside a local SSH tunnel.
- SESSION_SECRET is at least 32 random characters. ADMIN_PASSWORD is the local administrator password.
- GARAGE_ADMIN_URL and GARAGE_TOKEN connect to the Garage v2 administration endpoint.
- S3_ENDPOINT, S3_REGION, S3_KEY and S3_SECRET connect to the Garage S3 endpoint. Use a dedicated console key. The console automatically ensures read, write and owner permissions on each bucket accessed by an administrator.
- OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_SECRET and OIDC_ADMIN_GROUP enable SSO. Register the exact callback at CONSOLE_URL/auth/callback and include the groups claim in ID tokens. Both the provider application binding and the console restrict access to the admin group.

The Admin operations workspace acts with cluster administrator privileges. Bucket CORS, website, lifecycle and object operations act with the dedicated key. Uploads are capped at 32 MiB per object. Lifecycle and website editors accept the Garage-supported AWS SDK JSON shape.

Mount persistent storage at /app/data (the VM uses Docker volume gm-garage-console-audit). The Audit log records console sign-ins, explicit admin and storage requests, and automatic permission grants from deployment onward. It stores timestamps, actors, action names, resource identifiers and outcomes in SQLite. A request interrupted before its result is recorded remains Unconfirmed. Direct Garage/S3 clients and background dashboard rendering are outside this log.

Object previews run in a sandboxed frame with an opaque origin and a bundled viewer. Text, HTML, scripts and SVG are displayed as source. PDF pages render to canvas. Modern Office and OpenDocument files show text excerpts. ZIP and EPUB show entry names. Browser-supported images, audio and video use built-in decoders. Text previews read at most 256 KiB. Other viewers accept files up to 24 MiB. Download always returns the original file as an attachment. Preview reads have a separate audit action.

Authentication → Console sign-in lets a verified Authentik administrator enable SSO-only mode. This policy persists in the mounted audit database. Enabling it revokes existing password sessions; old sessions remain invalid even if password sign-in is later re-enabled. Sessions created before the console recorded login method must sign in again through Authentik to change the policy.

Application components, API routes, preview tooling and Next.js configuration are written in TypeScript. Run `bun run typecheck` for strict checking and `bun run build` for the production build. Next.js and the isolated preview viewer generate JavaScript for the browser.

The console stores audit events and the sign-in policy in SQLite using Bun's built-in SQLite driver. The production database is mounted at `/app/data/audit.sqlite`. Garage continues to own object data, bucket configuration and access keys.
