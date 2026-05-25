# Backlog

Things we know about and have intentionally deferred. Pull from the top.

## Settings UI for org admins (HIGH — blocks self-serve customers)

Backend APIs exist for all of these, but there's no UI for HR admins to manage
them. New customers can use the defaults but can't customize from inside the app.

- [ ] `/settings/leave-types` — add / edit / archive leave types
      (API: `POST/GET /api/leave/types`)
- [ ] `/settings/departments` — add / rename / archive departments
      (API: `POST/GET /api/departments`)
- [ ] `/settings/designations` — add / edit designations
      (API: `POST/GET /api/designations`)
- [ ] `/settings/salary-structures` — add / edit salary structures + components
      (API: full CRUD at `/api/payroll/structures` + `[id]`)
- [ ] `/settings/api-keys` — generate / revoke org API keys
      (API: full CRUD at `/api/org/api-keys` + `[id]`)
- [ ] `/settings/notifications` — toggle absent_check + other notification prefs
      (API: org settings JSON field)

Existing: `/holidays` page is fine, leave it.

Suggested IA: extend the existing `/settings` page into a tabbed layout.

## Security tiers still pending

- Tier 5: Razorpay webhook + billing fields migration (Employee → Organisation)
         + PII encryption (personal_info, contact_info)
- Tier 7.4: NextAuth v4 → v5 migration (deferred — touches auth core, risky to
            mix with other refactors; do as its own dedicated session)

## Logger rollout (Tier 7.3 follow-up)

`src/lib/logger.ts` exists and auto-redacts sensitive keys. Wired into:
auth/signup, auth/forgot-password, payroll/run. Still using raw `console.error`
in ~50 other routes — a full sweep is a low-risk mechanical chore. Pattern:

    // before:
    console.error('foo error:', err)
    // after:
    import { logger } from '@/lib/logger'
    logger.error('foo_failed', err, { /* any safe context */ })

Sensitive keys auto-redacted: password, token, secret, apiKey/api_key,
authorization, cookie, session, aws*, razorpay*, creditCard, cvv, ssn, pan,
aadhaar, bank, iban, csrf, rawKey/raw_key.

## Tenant-isolation audit notes (May 2026)

Cross-tenant attack suite ran 7 attacks against a 2-tenant fixture; all blocked.
3 real vulns + 1 misleading-status bug found and fixed during the audit:

- `recruitment/candidates/[id]` PATCH was spreading `...rest` into Prisma data —
  attacker could pass `{ org_id: '<other-tenant>' }` and move the row across tenants.
  Fixed: explicit Zod allow-list with `.strict()`.
- `recruitment/jobs/[id]` PATCH was passing `data: body` raw — same vuln. Fixed same way.
- `payroll/structures/[id]` PATCH was passing `data: body` raw — same vuln. Fixed same way.
- `employees/[id]` DELETE returned `200 success` even when `updateMany` matched 0 rows
  (cross-tenant target). Fixed: check `result.count`, return 404 if zero. Now consistent
  with all other find-by-id routes.

Pattern to apply going forward: **never** pass raw request body or `...rest` into
Prisma `data`. Always use an explicit Zod schema with `.strict()`, then forward
only the parsed fields. The `findFirst({ where: { id, org_id } })` pre-check is
defense in depth; alone it does NOT prevent mass-assignment.

All known tenant-iso observations resolved (`Candidate ↔ Organisation` relation
was added in Tier 7.2 alongside the other DB indexes).

## One-off cleanup

- Privacy / Terms pages — footer links to `/privacy` and `/terms` but pages
  don't exist yet. Either build them or strip the footer links.
- Real demo video for the `/demo` page (currently a "Coming soon" stub).
- Brand name swap — currently "Acme HR" placeholder.
- Rotate prod credentials seen during dev: Neon password, NEXTAUTH_SECRET,
  AWS keys, Resend API key, ENCRYPTION_KEY, CRON_SECRET, Razorpay test secret.
- Verify Resend `RESEND_FROM_EMAIL` domain — currently `hr@yourdomain.com`
  placeholder. Verification emails won't send until a real verified sender
  domain is configured.
- Prod migration helper for email verification rollout:
      UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
  Grandfathers existing prod users so they aren't locked out on deploy.
