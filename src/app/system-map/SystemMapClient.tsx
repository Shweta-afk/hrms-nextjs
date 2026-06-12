'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

type Mode = 'dark' | 'light'
type Layer = 'public' | 'portal' | 'admin' | 'api' | 'infra' | 'secrets'

interface LayerTheme {
  bg: string; border: string; text: string; glow: string; badge: string; badgeText: string
}

const DARK: Record<Layer, LayerTheme> = {
  public:  { bg: '#041a18', border: '#2dd4bf', text: '#5eead4', glow: '#2dd4bf22', badge: '#134e4a', badgeText: '#99f6e4' },
  portal:  { bg: '#0f0519', border: '#c084fc', text: '#d8b4fe', glow: '#c084fc22', badge: '#4c1d95', badgeText: '#ede9fe' },
  admin:   { bg: '#1a0508', border: '#fb7185', text: '#fda4af', glow: '#fb718522', badge: '#881337', badgeText: '#fecdd3' },
  api:     { bg: '#1a0900', border: '#fb923c', text: '#fdba74', glow: '#fb923c22', badge: '#7c2d12', badgeText: '#fed7aa' },
  infra:   { bg: '#0d1a02', border: '#a3e635', text: '#bef264', glow: '#a3e63522', badge: '#365314', badgeText: '#d9f99d' },
  secrets: { bg: '#1a0505', border: '#f87171', text: '#fca5a5', glow: '#f8717122', badge: '#7f1d1d', badgeText: '#fecaca' },
}
const LIGHT: Record<Layer, LayerTheme> = {
  public:  { bg: '#f0fdfa', border: '#0d9488', text: '#0f766e', glow: '#0d948818', badge: '#ccfbf1', badgeText: '#0f766e' },
  portal:  { bg: '#faf5ff', border: '#6d28d9', text: '#5b21b6', glow: '#6d28d918', badge: '#ede9fe', badgeText: '#5b21b6' },
  admin:   { bg: '#fff1f2', border: '#e11d48', text: '#be123c', glow: '#e11d4818', badge: '#ffe4e6', badgeText: '#be123c' },
  api:     { bg: '#fff7ed', border: '#c2410c', text: '#9a3412', glow: '#c2410c18', badge: '#ffedd5', badgeText: '#9a3412' },
  infra:   { bg: '#f7fee7', border: '#4d7c0f', text: '#3f6212', glow: '#4d7c0f18', badge: '#ecfccb', badgeText: '#3f6212' },
  secrets: { bg: '#fef2f2', border: '#b91c1c', text: '#991b1b', glow: '#b91c1c18', badge: '#fee2e2', badgeText: '#991b1b' },
}
const PD = { bg: '#060b14', surface: '#0d1117', border: '#1e2733', text: '#e6edf3', muted: '#8b949e', faint: '#1e2733', subtle: '#161b22' }
const PL = { bg: '#f1f5f9', surface: '#ffffff',  border: '#e2e8f0', text: '#0f172a', muted: '#64748b', faint: '#e2e8f0', subtle: '#f8fafc' }

const LAYER_LABELS: Record<Layer, string> = {
  public:  'Public / Auth Pages',
  portal:  'Employee Portal',
  admin:   'HR Admin Pages',
  api:     'API Routes',
  infra:   'Infrastructure',
  secrets: 'Secrets & Credentials',
}

interface NodeDef {
  id: string; label: string; sublabel: string
  x: number; y: number; layer: Layer
  info: { what: string; breaks: string[]; diagnose: string[]; fix: string[]; files: string[] }
}
interface EdgeDef { from: string; to: string; label?: string; dashed?: boolean }

const W = 1500; const H = 860
const NW = 72; const NH = 28

const NODES: NodeDef[] = [
  // ── Public / Auth ─────────────────────────────────────────────────────
  {
    id: 'login', label: 'Login', sublabel: '/login',
    x: 90, y: 100, layer: 'public',
    info: {
      what: 'NextAuth Credentials login page. Rate-limited (10 failed/15 min per email, 50/15 min per IP). Requires email verification before first login.',
      breaks: ['Login button does nothing / spins', 'Rate limit error even with correct password', '"Email not verified" blocking returning user'],
      diagnose: ['Check NEXTAUTH_SECRET is set (next start will 500 without it)', 'Check rate_limit_entries table: SELECT * FROM rate_limit_entries WHERE key LIKE \'login%\'', 'Check email_verified_at in users table for the user'],
      fix: ['Clear rate limit: DELETE FROM rate_limit_entries WHERE key = \'login:email:<email>\'', 'Resend verification: POST /api/auth/resend-verification', 'Missing NEXTAUTH_SECRET: set in .env.local and redeploy'],
      files: ['src/app/login/page.tsx', 'src/app/api/auth/[...nextauth]/route.ts', 'src/lib/rateLimit.ts'],
    },
  },
  {
    id: 'signup', label: 'Signup', sublabel: '/signup',
    x: 250, y: 100, layer: 'public',
    info: {
      what: 'New organisation signup. Creates org + hr_admin user + default departments + default leave types. Sends verification email via Resend. Subdomain must be unique.',
      breaks: ['Signup succeeds but verification email not received', 'Subdomain conflict error', 'Prisma transaction fails silently'],
      diagnose: ['Check RESEND_API_KEY and RESEND_FROM_EMAIL env vars', 'SELECT subdomain FROM organisations to check conflicts', 'Check Vercel/server logs for Prisma transaction errors'],
      fix: ['Rotate RESEND_API_KEY if email bouncing', 'Check Resend → Domains for sending domain verification', 'If org created but user missing: check DB transaction logs'],
      files: ['src/app/signup/page.tsx', 'src/app/api/auth/signup/route.ts', 'src/lib/email.ts'],
    },
  },
  {
    id: 'verify', label: 'Verify Email', sublabel: '/verify-email',
    x: 420, y: 100, layer: 'public',
    info: {
      what: 'Email verification gate. User clicks link in signup email → token validated → email_verified_at set → can now log in. Tokens expire after 24 hours.',
      breaks: ['Verification link says "expired" immediately', 'Link works but login still blocked', '"Token not found" error'],
      diagnose: ['Check email_verification_expiry in users table for the user', 'Check email_verified_at — null = still blocked', 'Verify token matches email_verification_token in DB'],
      fix: ['Resend verification: POST /api/auth/resend-verification with { email }', 'If token expired: resend generates a fresh one with a new 24h window', 'If email_verified_at is set but login blocked: check is_active flag'],
      files: ['src/app/verify-email/page.tsx', 'src/app/api/auth/verify-email/route.ts'],
    },
  },
  {
    id: 'forgot', label: 'Forgot / Reset Password', sublabel: '/forgot-password  /reset-password',
    x: 630, y: 100, layer: 'public',
    info: {
      what: 'Password reset flow. Sends time-limited reset token via Resend. Token stored hashed in users.reset_token.',
      breaks: ['Reset email not received', 'Reset link says "invalid or expired"', 'Password resets but login still fails'],
      diagnose: ['Check RESEND_API_KEY and Resend logs', 'SELECT reset_token_expiry FROM users WHERE email = \'...\'', 'Verify bcrypt is hashing the new password correctly'],
      fix: ['Rotate RESEND_API_KEY if emails not sending', 'If token expired: trigger another forgot-password request', 'If password saved but login fails: check bcrypt cost factor = 10'],
      files: ['src/app/forgot-password/page.tsx', 'src/app/reset-password/page.tsx', 'src/app/api/auth/forgot-password/route.ts', 'src/app/api/auth/reset-password/route.ts'],
    },
  },

  // ── Employee Portal ───────────────────────────────────────────────────
  {
    id: 'portal', label: 'Portal', sublabel: '/portal',
    x: 900, y: 100, layer: 'portal',
    info: {
      what: 'Employee self-service home. Shows attendance summary, pending leave, recent payslips. Session-gated — middleware redirects hr_admin to /dashboard.',
      breaks: ['Portal shows blank / no data', 'Middleware sends employees to wrong page', 'Attendance data stale'],
      diagnose: ['Check NextAuth session: employee_id and org_id must be in JWT', 'Check middleware.ts ADMIN_ONLY_PREFIXES — /portal must NOT be in that list', 'Check attendance_records for this employee in DB'],
      fix: ['Expired session: force logout and re-login', 'Wrong redirect: review middleware.ts role check', 'Missing employee_id on user: check users.employee_id FK'],
      files: ['src/app/portal/page.tsx', 'src/middleware.ts', 'src/app/api/auth/[...nextauth]/route.ts'],
    },
  },
  {
    id: 'payslip', label: 'Payslips', sublabel: '/payslip',
    x: 1060, y: 100, layer: 'portal',
    info: {
      what: 'Employee payslip viewer. Fetches payslips for the logged-in employee only (filtered by employee_id from session). PDFs served via S3 presigned URLs.',
      breaks: ['Payslip PDF link returns 403 or expired', 'No payslips shown even after payroll run', 'Wrong payslips shown (cross-employee leak)'],
      diagnose: ['S3 presigned URLs expire in 15 min — PDF 403 means stale link, just refresh', 'Check payslips table: SELECT * FROM payslips WHERE employee_id = \'...\'', 'Check API route filters by session employee_id, not request body'],
      fix: ['Refresh the page to get a fresh presigned URL', 'If payslip missing after run: check payroll_runs.status = \'completed\'', 'S3 bucket policy: objects must not be public — only presigned access'],
      files: ['src/app/payslip/page.tsx', 'src/app/api/payroll/payslips/route.ts', 'src/lib/s3.ts'],
    },
  },
  {
    id: 'leave-portal', label: 'Leave Requests', sublabel: '/leave (employee)',
    x: 1230, y: 100, layer: 'portal',
    info: {
      what: 'Employee leave application and status tracking. Employees submit requests; hr_admin approves/rejects. Balance calculated from leave_types.days_per_year minus approved leaves.',
      breaks: ['Leave balance shows wrong number', 'Request stuck in "pending" — no approval flow', 'Can\'t apply — "insufficient balance" even with days remaining'],
      diagnose: ['SELECT * FROM leave_types WHERE org_id = \'...\' to check days_per_year', 'Check approved leaves: SELECT count(*) FROM leave_requests WHERE employee_id = \'...\' AND status = \'approved\'', 'Check leave year boundaries — balance resets on leave year start'],
      fix: ['Wrong balance: check leave year start date in org settings', 'Approval flow broken: hr_admin must visit /leave to approve', 'Carry-forward limit: check leave_types.carry_forward_limit'],
      files: ['src/app/leave/page.tsx', 'src/app/api/leave/route.ts', 'src/app/api/leave/balance/route.ts'],
    },
  },

  // ── HR Admin Pages ───────────────────────────────────────────────────
  {
    id: 'dashboard', label: 'Dashboard', sublabel: '/dashboard',
    x: 80, y: 290, layer: 'admin',
    info: {
      what: 'HR admin overview — headcount, attendance rates, pending approvals, payroll status, active devices. All widgets fetch from their respective API routes.',
      breaks: ['Dashboard widgets show 0 / empty', 'Charts not loading', '403 for hr_admin users'],
      diagnose: ['Open DevTools Network — look for 401/403/500 on API calls', 'Check session.user.role === "hr_admin"', 'If all zeros: check org_id in session matches DB data'],
      fix: ['Re-login to refresh stale JWT', 'If org_id mismatch: check users.org_id FK integrity', 'Widget timeout: check Supabase pooler (Supavisor, port 6543) — use the pooled string for serverless'],
      files: ['src/app/dashboard/page.tsx', 'src/views/Index.tsx'],
    },
  },
  {
    id: 'employees-page', label: 'Employees', sublabel: '/employees',
    x: 250, y: 290, layer: 'admin',
    info: {
      what: 'Employee directory and management. CRUD for employee records, invite-by-email flow, org chart, document uploads to S3. All scoped to org_id.',
      breaks: ['Invite email not sent', 'Employee profile shows blank after save', 'Document upload fails / 403 on S3'],
      diagnose: ['Check RESEND_API_KEY for invite emails', 'Check presigned URL: POST /api/upload/presign returns a URL — test it directly', 'Check AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_S3_BUCKET env vars'],
      fix: ['S3 403: check IAM policy allows s3:PutObject on the bucket', 'Invite not received: check Resend logs, verify from-address domain', 'Document not appearing: check employee_documents table after upload'],
      files: ['src/app/employees/page.tsx', 'src/app/api/employees/route.ts', 'src/app/api/upload/presign/route.ts', 'src/lib/s3.ts'],
    },
  },
  {
    id: 'attendance-page', label: 'Attendance', sublabel: '/attendance',
    x: 430, y: 290, layer: 'admin',
    info: {
      what: 'Attendance management hub. Syncs punches from ZKTeco biometric devices, bulk imports via CSV, shows daily/monthly reports, processes IN/OUT punch logs into attendance records.',
      breaks: ['Device shows "offline" even when reachable', 'Punch sync returns 0 new records', 'Attendance records duplicated'],
      diagnose: ['Check devices table: last_heartbeat, status, push_token', 'Check punch_logs: SELECT count(*) FROM punch_logs WHERE processed = false AND org_id = \'...\'', 'Check device network: can the device reach your server URL?'],
      fix: ['Device offline: update device IP in /attendance/devices and re-test connection', 'Punches unprocessed: check punch-processor.ts for errors in logs', 'Duplicate records: unique constraint on (org_id, employee_id, date) prevents true dups — check for near-dups'],
      files: ['src/app/attendance/page.tsx', 'src/app/api/attendance/sync/route.ts', 'src/app/api/iclock/cdata/route.ts', 'src/lib/punch-processor.ts'],
    },
  },
  {
    id: 'payroll-page', label: 'Payroll', sublabel: '/payroll',
    x: 610, y: 290, layer: 'admin',
    info: {
      what: 'Monthly payroll processing. Creates payroll_runs → generates payslips per employee → calculates gross/deductions from salary_structures → PDF generation → approval workflow.',
      breaks: ['Payroll run stuck at "processing"', 'Payslip calculations wrong', 'PDF generation fails'],
      diagnose: ['Check payroll_runs.status in DB — "failed" row will have error context', 'Check salary_structures for the employee: ctc_annual, deduction breakdowns', 'Check S3 bucket permissions for PDF upload (pdf_s3_key on payslips)'],
      fix: ['Stuck run: check server logs for unhandled errors in payroll calculation', 'Wrong calculations: verify salary_structure.components JSON structure', 'Missing PDF: check AWS credentials and S3 bucket CORS policy'],
      files: ['src/app/payroll/page.tsx', 'src/app/api/payroll/runs/route.ts', 'src/lib/payroll/', 'src/lib/s3.ts'],
    },
  },
  {
    id: 'settings-page', label: 'Settings', sublabel: '/settings',
    x: 790, y: 290, layer: 'admin',
    info: {
      what: 'Organisation configuration: company details, leave policies, shift groups, API key management, billing. API keys are stored SHA-256 hashed — the raw key is shown only once on creation.',
      breaks: ['API key not working for integrations', 'Org settings not saving', 'Shift groups not applying to employees'],
      diagnose: ['API key issues: SHA-256 hash the raw key and compare with org_api_keys.key_hash', 'Settings save: check /api/org/settings for 4xx responses', 'Shift groups: check employees.shift_group_id FK'],
      fix: ['Lost API key: can\'t recover — revoke old key and create new one (raw shown only once)', 'Settings 403: confirm session is hr_admin role', 'Shift not applying: update employee record with new shift_group_id'],
      files: ['src/app/settings/page.tsx', 'src/app/api/org/settings/route.ts', 'src/app/api/org/api-keys/route.ts'],
    },
  },
  {
    id: 'billing-page', label: 'Billing', sublabel: '/billing',
    x: 970, y: 290, layer: 'admin',
    info: {
      what: 'Subscription management via Razorpay. Creates payment orders, verifies webhooks via HMAC-SHA256 signature, updates org.plan on successful payment.',
      breaks: ['Payment page doesn\'t load / Razorpay widget missing', 'Payment succeeds but plan not upgraded', 'Webhook verification fails'],
      diagnose: ['Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars', 'Check Razorpay dashboard → Webhooks → delivery logs for failures', 'Webhook signature: RAZORPAY_KEY_SECRET must match what\'s in Razorpay dashboard'],
      fix: ['Widget missing: check NEXT_PUBLIC_RAZORPAY_KEY_ID is set (public env var)', 'Plan not upgraded: check /api/billing/verify route and organisations.plan in DB', 'Webhook failing: verify the webhook secret in Razorpay dashboard matches .env'],
      files: ['src/app/billing/page.tsx', 'src/app/api/billing/create-order/route.ts', 'src/app/api/billing/verify/route.ts'],
    },
  },
  {
    id: 'recruitment-page', label: 'Recruitment', sublabel: '/recruitment',
    x: 1150, y: 290, layer: 'admin',
    info: {
      what: 'Hiring pipeline: job postings, candidate tracking (applied → screened → interviewed → offered → hired). Org-scoped — candidates can\'t cross tenants.',
      breaks: ['Job postings not showing to candidates', 'Candidate status update not saving', 'Pipeline stage counts wrong'],
      diagnose: ['Check job_postings: is_active = true and org_id correct', 'Network tab: check /api/recruitment/* for errors', 'Count mismatch: check candidates.stage values match expected enum'],
      fix: ['Activate posting: UPDATE job_postings SET is_active = true WHERE id = \'...\'', 'Status not saving: check Zod schema on the update endpoint', 'Rebuild stage counts from candidates table if denormalised counts drift'],
      files: ['src/app/recruitment/page.tsx', 'src/app/api/recruitment/route.ts'],
    },
  },
  {
    id: 'analytics-page', label: 'Analytics', sublabel: '/analytics',
    x: 1360, y: 290, layer: 'admin',
    info: {
      what: 'HR analytics dashboard — attrition trends, headcount over time, leave patterns, attendance rates. Queries aggregate data from multiple tables via Prisma.',
      breaks: ['Charts show no data', 'Slow query timeouts', 'Data looks wrong / stale'],
      diagnose: ['DevTools Network — check /api/analytics/* endpoints for errors or timeouts', 'Check Supabase pooler (Supavisor) — analytics queries are heavy (use EXPLAIN on slow queries)', 'Check perf indexes migration (20260604000001_perf_indexes) was applied'],
      fix: ['Index missing: run 20260604000001_perf_indexes migration', 'Timeout: add date range filter to analytics queries to reduce scan size', 'Stale data: analytics reads live from DB — if stale, data wasn\'t committed properly'],
      files: ['src/app/analytics/page.tsx', 'src/app/api/analytics/route.ts', 'prisma/migrations/20260604000001_perf_indexes/'],
    },
  },

  // ── API Layer ─────────────────────────────────────────────────────────
  {
    id: 'api-auth', label: 'NextAuth API', sublabel: '/api/auth/*',
    x: 100, y: 490, layer: 'api',
    info: {
      what: 'NextAuth.js v4 handler. Issues JWT sessions, handles credentials authorize(), OAuth callbacks (if added). Session cookie is HttpOnly + SameSite=Lax. JWT signed with NEXTAUTH_SECRET.',
      breaks: ['All login attempts fail with 500', 'Session cookie not being set', 'JWT decode errors in logs'],
      diagnose: ['NEXTAUTH_SECRET must be set — missing it causes 500 on any auth operation', 'Check NEXTAUTH_URL matches the actual deployment URL (used for callback URLs)', 'Check next-auth logs: set NEXTAUTH_DEBUG=1 temporarily'],
      fix: ['Missing NEXTAUTH_SECRET: set to a 32+ char random string (openssl rand -base64 32)', 'Wrong NEXTAUTH_URL in production: set to https://yourdomain.com', 'Rotate secret: all existing sessions are invalidated — users must re-login'],
      files: ['src/app/api/auth/[...nextauth]/route.ts', 'src/types/next-auth.d.ts'],
    },
  },
  {
    id: 'api-employees', label: 'Employees API', sublabel: '/api/employees/*',
    x: 290, y: 490, layer: 'api',
    info: {
      what: 'CRUD for employee records. All routes require hr_admin role via requireAdmin(). All queries scoped to session.user.org_id — cross-org access is impossible even with a valid session from another org.',
      breaks: ['403 on employee create/update', 'Employee list returns empty', 'Encrypted fields (bank details) showing garbled text'],
      diagnose: ['Check session.user.role === "hr_admin"', 'Check employees table: WHERE org_id = \'<org>\'', 'ENCRYPTION_KEY env var must be exactly 64 hex chars (32 bytes) — wrong key = garbled decrypt'],
      fix: ['403: confirm user has hr_admin role in users table', 'Empty list: check org_id on session matches employees.org_id', 'Encryption issue: NEVER change ENCRYPTION_KEY once data is encrypted — you will permanently lose all encrypted field data'],
      files: ['src/app/api/employees/route.ts', 'src/app/api/employees/[id]/route.ts', 'src/lib/encryption.ts'],
    },
  },
  {
    id: 'api-attendance', label: 'Attendance + Devices API', sublabel: '/api/attendance/*  /api/devices/*',
    x: 510, y: 490, layer: 'api',
    info: {
      what: 'Attendance sync (pull from ZKTeco via zklib), bulk import (CSV), manual corrections, plus device management (add/remove/test biometric devices). /api/iclock/* handles device PUSH in iClock protocol.',
      breaks: ['Device sync returns "connection refused"', 'Bulk import fails on row N', 'iclock push stops recording punches'],
      diagnose: ['Device connectivity: test from server — the device must be network-reachable from the Vercel edge (unlikely) — use a self-hosted sync worker for on-prem devices', 'Import CSV: check column headers match expected format, check encoding (UTF-8)', 'iClock: check devices.push_token matches what\'s configured on the physical device'],
      fix: ['Vercel + on-prem devices: deploy a local sync worker that calls your API, or use device push (iClock) instead of pull', 'CSV import errors: check /api/attendance/import error response for row-level details', 'iClock not pushing: reconfigure device\'s server URL to point to your deployment'],
      files: ['src/app/api/attendance/sync/route.ts', 'src/app/api/attendance/import/route.ts', 'src/app/api/iclock/cdata/route.ts', 'src/app/api/devices/route.ts'],
    },
  },
  {
    id: 'api-payroll', label: 'Payroll API', sublabel: '/api/payroll/*',
    x: 730, y: 490, layer: 'api',
    info: {
      what: 'Payroll run execution, payslip generation, structure management. Run creation triggers async-style processing. Payslip PDFs uploaded to S3. Approval workflow included.',
      breaks: ['Run creation returns 500', 'Payslip PDF not generating', 'Approval emails not sent'],
      diagnose: ['Check Supabase database logs for constraint violations during run', 'S3: check AWS credentials, bucket name, and region in env vars', 'Check RESEND_API_KEY for approval notifications'],
      fix: ['Missing salary structure: every employee must have salary_structure_id set', 'S3 upload fail: check IAM user has s3:PutObject permission on the bucket', 'Approval email missing: check email.ts notification template'],
      files: ['src/app/api/payroll/runs/route.ts', 'src/app/api/payroll/payslips/route.ts', 'src/lib/payroll/', 'src/lib/s3.ts'],
    },
  },
  {
    id: 'api-notifications', label: 'Notifications + Cron', sublabel: '/api/notifications/*  /api/cron/*',
    x: 960, y: 490, layer: 'api',
    info: {
      what: 'In-app notification read/dismiss, plus Vercel cron job (every 15 min) that checks: offline devices, employees not arrived by 10:30 AM, device storage >90%. Cron is protected by CRON_SECRET bearer token.',
      breaks: ['Cron runs but no notifications created', 'Cron returns 401', 'Notification bell shows wrong count'],
      diagnose: ['Cron 401: check CRON_SECRET env var matches Vercel cron config (vercel.json or dashboard)', 'No notifications: check the offline threshold (OFFLINE_ALERT_MINUTES env var, default 5)', 'Count mismatch: check notifications table WHERE user_id = \'...\' AND is_read = false'],
      fix: ['Set CRON_SECRET in Vercel env vars and in vercel.json headers', 'Device offline alert too noisy: increase OFFLINE_ALERT_MINUTES env var', 'Mark all read: UPDATE notifications SET is_read = true WHERE org_id = \'...\''],
      files: ['src/app/api/notifications/route.ts', 'src/app/api/cron/notifications/route.ts', 'src/lib/notifications.ts'],
    },
  },
  {
    id: 'api-upload', label: 'Upload API', sublabel: '/api/upload/*',
    x: 1160, y: 490, layer: 'api',
    info: {
      what: 'Generates S3 presigned URLs for direct browser-to-S3 uploads. Files are stored under org_id/category/sub_id/ to enforce tenant isolation at the storage layer. 15-minute URL expiry.',
      breaks: ['Presigned URL returns 403 when uploading', 'File appears uploaded but not accessible', 'File type rejected'],
      diagnose: ['Check AWS credentials: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET', 'Check S3 bucket CORS policy — must allow PUT from your app domain', 'Content-type: the presigned URL is bound to a specific content-type — browser must use the same'],
      fix: ['S3 CORS: add PUT + Content-Type allowed headers for your domain', 'IAM: ensure s3:PutObject and s3:GetObject permissions on the bucket', 'File not accessible: use presigned GET URLs — bucket should NOT be public'],
      files: ['src/app/api/upload/presign/route.ts', 'src/lib/s3.ts'],
    },
  },
  {
    id: 'api-billing-wh', label: 'Billing / Razorpay', sublabel: '/api/billing/*',
    x: 1370, y: 490, layer: 'api',
    info: {
      what: 'Creates Razorpay payment orders, verifies payment signatures on completion, handles Razorpay webhooks (HMAC-SHA256 signature validated). Updates org plan in DB on success.',
      breaks: ['Payment verification fails — "signature mismatch"', 'Webhook not received / 400 error', 'Plan not upgrading after successful payment'],
      diagnose: ['Signature mismatch: RAZORPAY_KEY_SECRET must match the key used to create the order', 'Webhook 400: check /api/billing/webhook — ensure raw body is read (not parsed JSON)', 'Plan not updated: check Razorpay dashboard → Payments for the payment ID'],
      fix: ['Wrong key: ensure RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are from the same Razorpay account/mode (test vs live)', 'Webhook: register the webhook URL in Razorpay dashboard → Webhooks', 'Manually update plan: UPDATE organisations SET plan = \'pro\' WHERE id = \'...\''],
      files: ['src/app/api/billing/create-order/route.ts', 'src/app/api/billing/verify/route.ts'],
    },
  },

  // ── Infrastructure ────────────────────────────────────────────────────
  {
    id: 'supabase-db', label: 'Supabase PostgreSQL', sublabel: 'Prisma ORM · multi-tenant · RLS',
    x: 200, y: 680, layer: 'infra',
    info: {
      what: 'Supabase-hosted PostgreSQL. All app data. Prisma as ORM. Multi-tenancy via org_id on every table. RLS enabled. Two connection strings: pooled (Supavisor, port 6543) for serverless DATABASE_URL, and direct (port 5432) for DIRECT_URL used by migrations.',
      breaks: ['All DB queries time out', '"Too many clients" / "remaining connection slots" in logs', 'Migration fails to apply', 'Storage / row limit hit on free plan'],
      diagnose: ['Supabase dashboard → Database → check active connections + pooler health', 'prisma db execute to test connectivity', 'Check prisma/migrations/ — compare applied migrations with schema', 'Supabase dashboard → Settings → Usage for storage'],
      fix: ['Too many clients: use the POOLED string (Supavisor, port 6543) as DATABASE_URL with ?pgbouncer=true&connection_limit=1; keep direct 5432 string as DIRECT_URL', 'Migration drift: npx prisma migrate deploy', 'Storage full: archive old punch_logs, rate_limit_entries, notifications', 'Upgrade Supabase plan for more connections and storage'],
      files: ['prisma/schema.prisma', 'prisma/migrations/', 'src/lib/prisma.ts', '.env.local (DATABASE_URL, DIRECT_URL)'],
    },
  },
  {
    id: 'vercel', label: 'Vercel', sublabel: 'deployment · edge · cron',
    x: 490, y: 680, layer: 'infra',
    info: {
      what: 'Deployment platform. Runs Next.js as serverless functions. Handles edge middleware, cron jobs (vercel.json), automatic deploys on git push. Environment variables managed in Vercel dashboard.',
      breaks: ['Deploy fails in CI', 'Cron jobs not firing', 'Edge middleware returning 500', 'Function timeout (10s on Hobby plan)'],
      diagnose: ['Vercel dashboard → Deployments → build logs', 'Vercel dashboard → Cron Jobs → check last run status', 'Vercel logs → filter for middleware errors', 'Function timeout: check Vercel → Functions tab for duration'],
      fix: ['Build fail: fix TypeScript/build errors locally with npm run build first', 'Cron not firing: check vercel.json cron config, redeploy', 'Timeout: move heavy operations to background jobs or increase timeout (Pro plan)', 'Set all env vars in Vercel dashboard under Project → Settings → Environment Variables'],
      files: ['vercel.json', 'next.config.ts', '.github/workflows/ (if using GitHub Actions instead)'],
    },
  },
  {
    id: 'aws-s3', label: 'AWS S3', sublabel: 'file storage · documents · payslip PDFs',
    x: 780, y: 680, layer: 'infra',
    info: {
      what: 'Object storage for employee documents (Aadhaar, PAN, contracts), payslip PDFs. Files are private — accessed only via 15-minute presigned URLs. Organised as org_id/category/employee_id/filename.',
      breaks: ['Presigned URL 403 on upload or download', 'Files uploaded but "not found" later', 'CORS error on browser upload'],
      diagnose: ['Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET in env', 'Check S3 bucket policy — bucket must NOT be public, objects accessed via presigned URLs only', 'CORS: check S3 bucket CORS configuration'],
      fix: ['IAM permissions: s3:PutObject, s3:GetObject, s3:DeleteObject on arn:aws:s3:::<bucket>/*', 'CORS config: allow PUT from your domain, allow GET everywhere (presigned URLs work from any origin)', 'Wrong region: AWS_REGION must match the bucket\'s actual region'],
      files: ['src/lib/s3.ts', 'src/app/api/upload/presign/route.ts', '.env.local (AWS_*)'],
    },
  },
  {
    id: 'resend', label: 'Resend', sublabel: 'transactional email',
    x: 1050, y: 680, layer: 'infra',
    info: {
      what: 'Email delivery for: signup verification, password reset, employee invitations, payslip approval notifications, leave approval notifications. Free plan: 3,000 emails/month.',
      breaks: ['Verification emails not received', 'Reset emails going to spam', 'Monthly quota exceeded'],
      diagnose: ['Check RESEND_API_KEY and RESEND_FROM_EMAIL env vars', 'Resend dashboard → Logs → filter by recipient', 'Resend dashboard → Domains — check sending domain is verified'],
      fix: ['Domain not verified: add DNS records in Resend → Domains → your domain', 'Rotate key: Resend → API Keys → new key → update RESEND_API_KEY env var', 'Quota exceeded: upgrade Resend plan or reduce email frequency'],
      files: ['src/lib/email.ts', '.env.local (RESEND_API_KEY, RESEND_FROM_EMAIL)'],
    },
  },
  {
    id: 'razorpay', label: 'Razorpay', sublabel: 'payments · subscriptions',
    x: 1310, y: 680, layer: 'infra',
    info: {
      what: 'Payment gateway for HRMS subscription billing. Orders created server-side, payment verified via HMAC-SHA256 on return. Webhooks for async payment events.',
      breaks: ['Checkout widget not loading', 'Test payments working but live failing', 'Webhook events not processed'],
      diagnose: ['Widget: check NEXT_PUBLIC_RAZORPAY_KEY_ID in frontend env (must be NEXT_PUBLIC_ prefix)', 'Test vs live: ensure RAZORPAY_KEY_ID and KEY_SECRET match the current mode in Razorpay dashboard', 'Webhook: check Razorpay dashboard → Webhooks → failed events'],
      fix: ['Live mode keys: update RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, NEXT_PUBLIC_RAZORPAY_KEY_ID to live values', 'Register webhook URL in Razorpay: <your-domain>/api/billing/webhook', 'Verify webhook secret matches in code and Razorpay dashboard'],
      files: ['src/app/api/billing/create-order/route.ts', 'src/app/api/billing/verify/route.ts', '.env.local (RAZORPAY_*)'],
    },
  },

  // ── Secrets ───────────────────────────────────────────────────────────
  {
    id: 'nextauth-secret', label: 'NEXTAUTH_SECRET', sublabel: '>=32 chars · JWT signing',
    x: 150, y: 850, layer: 'secrets',
    info: {
      what: 'Signs and verifies all NextAuth JWT session tokens. If this changes, all active user sessions are invalidated immediately — every user gets logged out. Must be at least 32 characters.',
      breaks: ['All users suddenly logged out after deploy', 'Login 500 error on new deployment', '"JWTVerificationFailed" in logs'],
      diagnose: ['Check env var is set in Vercel / .env.local', 'echo $NEXTAUTH_SECRET | wc -c (must be ≥32)', 'Compare secret in staging vs production — they should be different'],
      fix: ['Generate new: openssl rand -base64 32', 'Set in Vercel: Project → Settings → Environment Variables', 'Changing invalidates ALL sessions — do this during off-hours'],
      files: ['src/app/api/auth/[...nextauth]/route.ts', '.env.local'],
    },
  },
  {
    id: 'encryption-key', label: 'ENCRYPTION_KEY', sublabel: '64 hex chars · AES-256-GCM',
    x: 430, y: 850, layer: 'secrets',
    info: {
      what: 'AES-256-GCM key for encrypting sensitive employee fields: bank_details, statutory_info (PAN, Aadhaar). Stored as 64 hex characters (32 bytes). NEVER change this once data is encrypted.',
      breaks: ['Employee bank details showing garbled / JSON parse error', 'Statutory info unreadable after re-deploy', '"Decryption failed" errors in logs'],
      diagnose: ['Check ENCRYPTION_KEY is exactly 64 hex chars: echo -n $ENCRYPTION_KEY | wc -c', 'If value changed: the old ciphertext is now permanently unreadable', 'Check encryption.ts decrypt function is receiving the exact same key as encrypt'],
      fix: ['DO NOT rotate this key unless you decrypt-and-re-encrypt all data first', 'If accidentally changed: restore the previous key value', 'Backup current key value in a password manager immediately'],
      files: ['src/lib/encryption.ts', 'src/app/api/employees/[id]/route.ts', '.env.local'],
    },
  },
  {
    id: 'aws-creds', label: 'AWS Credentials', sublabel: 'ACCESS_KEY_ID · SECRET_ACCESS_KEY',
    x: 720, y: 850, layer: 'secrets',
    info: {
      what: 'IAM credentials for S3 access. Used by the server only (never exposed to the browser). The IAM user should have minimal permissions: s3:PutObject, s3:GetObject, s3:DeleteObject on the specific bucket only.',
      breaks: ['File uploads return 403 or SignatureDoesNotMatch', 'Presigned GET URLs return 403', 'New deployment uploads broken'],
      diagnose: ['Check all four: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET', 'Test in AWS CLI: aws s3 ls s3://<bucket> --region ap-south-1', 'IAM console: check access key is not expired or deactivated'],
      fix: ['Rotate key: IAM → Security Credentials → Create access key → update Vercel env vars', 'Region mismatch: ensure AWS_REGION matches the bucket\'s region exactly', 'Principle of least privilege: restrict IAM to only the S3 bucket, not all S3'],
      files: ['src/lib/s3.ts', '.env.local (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET)'],
    },
  },
  {
    id: 'cron-secret', label: 'CRON_SECRET', sublabel: 'Bearer token · Vercel cron auth',
    x: 1000, y: 850, layer: 'secrets',
    info: {
      what: 'Bearer token that protects /api/cron/notifications from being publicly callable. Vercel cron sends it in the Authorization header. If unset, the cron endpoint fails closed (returns 401).',
      breaks: ['Cron job returns 401 in Vercel logs', 'No notifications triggered by cron', 'CRON_SECRET not found error in logs'],
      diagnose: ['Check CRON_SECRET is set in Vercel env vars', 'Check vercel.json cron config has correct Authorization header', 'Cron 401: compare secret in env vs what\'s sent in vercel.json'],
      fix: ['Generate: openssl rand -base64 32', 'Set in Vercel: Project → Environment Variables → CRON_SECRET', 'Update vercel.json if the secret value changed'],
      files: ['src/app/api/cron/notifications/route.ts', 'vercel.json', '.env.local'],
    },
  },
  {
    id: 'razorpay-keys', label: 'Razorpay Keys', sublabel: 'KEY_ID · KEY_SECRET · webhook',
    x: 1280, y: 850, layer: 'secrets',
    info: {
      what: 'Three Razorpay credentials: RAZORPAY_KEY_ID (server), RAZORPAY_KEY_SECRET (server, signing), NEXT_PUBLIC_RAZORPAY_KEY_ID (frontend, public). Test and live keys are different — never mix them.',
      breaks: ['Checkout widget shows "invalid key" error', 'Signature verification fails on payment return', 'Wrong plan environment (test orders in production)'],
      diagnose: ['NEXT_PUBLIC_RAZORPAY_KEY_ID must match RAZORPAY_KEY_ID (same key)', 'Check Razorpay dashboard mode (test/live) vs your env keys', 'Webhook secret in code must match what\'s registered in Razorpay dashboard'],
      fix: ['Switch to live: get live keys from Razorpay dashboard → Update all three env vars', 'Do NOT commit keys to git — set only in Vercel env vars', 'Register webhook: Razorpay dashboard → Webhooks → add <domain>/api/billing/webhook'],
      files: ['src/app/api/billing/create-order/route.ts', '.env.local (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, NEXT_PUBLIC_RAZORPAY_KEY_ID)'],
    },
  },
]

const EDGES: EdgeDef[] = [
  // auth pages → nextauth api
  { from: 'login',           to: 'api-auth' },
  { from: 'signup',          to: 'api-auth' },
  { from: 'verify',          to: 'api-auth' },
  { from: 'forgot',          to: 'api-auth' },
  // portal → api
  { from: 'portal',          to: 'api-employees' },
  { from: 'payslip',         to: 'api-payroll' },
  { from: 'leave-portal',    to: 'api-payroll',    dashed: true },
  // admin pages → api
  { from: 'dashboard',       to: 'api-employees' },
  { from: 'dashboard',       to: 'api-notifications' },
  { from: 'employees-page',  to: 'api-employees' },
  { from: 'employees-page',  to: 'api-upload' },
  { from: 'attendance-page', to: 'api-attendance' },
  { from: 'payroll-page',    to: 'api-payroll' },
  { from: 'payroll-page',    to: 'api-upload' },
  { from: 'settings-page',   to: 'supabase-db',         dashed: true },
  { from: 'billing-page',    to: 'api-billing-wh' },
  { from: 'recruitment-page',to: 'api-employees',   dashed: true },
  { from: 'analytics-page',  to: 'supabase-db',         dashed: true },
  // api → infra
  { from: 'api-auth',        to: 'supabase-db' },
  { from: 'api-auth',        to: 'nextauth-secret' },
  { from: 'api-auth',        to: 'resend' },
  { from: 'api-employees',   to: 'supabase-db' },
  { from: 'api-employees',   to: 'encryption-key' },
  { from: 'api-attendance',  to: 'supabase-db' },
  { from: 'api-payroll',     to: 'supabase-db' },
  { from: 'api-payroll',     to: 'aws-s3' },
  { from: 'api-payroll',     to: 'resend' },
  { from: 'api-notifications',to: 'supabase-db' },
  { from: 'api-notifications',to: 'cron-secret' },
  { from: 'api-upload',      to: 'aws-s3' },
  { from: 'api-upload',      to: 'aws-creds' },
  { from: 'api-billing-wh',  to: 'razorpay' },
  { from: 'api-billing-wh',  to: 'razorpay-keys' },
  // infra internal
  { from: 'supabase-db',         to: 'vercel',          dashed: true },
  { from: 'resend',          to: 'vercel',          dashed: true },
  { from: 'aws-s3',          to: 'aws-creds' },
  { from: 'razorpay',        to: 'razorpay-keys' },
]

// ─────────────────────────────────────────────────────────────

function nodeById(id: string) { return NODES.find(n => n.id === id)! }

function edgePath(a: NodeDef, b: NodeDef) {
  const x1 = a.x, y1 = a.y + NH
  const x2 = b.x, y2 = b.y - NH
  const mid = Math.abs(y2 - y1) * 0.5
  return `M ${x1} ${y1} C ${x1} ${y1 + mid}, ${x2} ${y2 - mid}, ${x2} ${y2}`
}

function edgeMid(a: NodeDef, b: NodeDef): [number, number] {
  return [(a.x + b.x) / 2, (a.y + b.y) / 2]
}

function MapNode({ node, selected, highlighted, dimmed, onClick, colors }: {
  node: NodeDef; selected: boolean; highlighted: boolean; dimmed: boolean
  onClick: (id: string) => void; colors: Record<Layer, LayerTheme>
}) {
  const c = colors[node.layer]
  return (
    <g style={{ cursor: 'pointer', opacity: dimmed ? 0.13 : 1, transition: 'opacity 0.18s' }}
       onClick={() => onClick(node.id)}>
      {(selected || highlighted) && (
        <rect x={node.x - NW - 7} y={node.y - NH - 7} width={(NW + 7) * 2} height={(NH + 7) * 2}
          rx={14} fill={c.glow} stroke={c.border}
          strokeWidth={selected ? 2.5 : 1.5} strokeOpacity={selected ? 1 : 0.55} />
      )}
      <rect x={node.x - NW} y={node.y - NH} width={NW * 2} height={NH * 2}
        rx={10} fill={c.bg} stroke={c.border}
        strokeWidth={selected ? 2 : 1} strokeOpacity={selected ? 1 : 0.5} />
      <text x={node.x} y={node.y - 7} textAnchor="middle" fill={c.text}
        fontSize={10.5} fontWeight={700} fontFamily="ui-monospace,monospace">
        {node.label}
      </text>
      <text x={node.x} y={node.y + 9} textAnchor="middle" fill={c.border}
        fontSize={7.5} fontFamily="ui-monospace,monospace" opacity={0.75}>
        {node.sublabel.length > 30 ? node.sublabel.slice(0, 29) + '…' : node.sublabel}
      </text>
    </g>
  )
}

function DetailPanel({ node, onClose, mode, colors, page }: {
  node: NodeDef; onClose: () => void; mode: Mode
  colors: Record<Layer, LayerTheme>; page: typeof PD
}) {
  const c = colors[node.layer]
  const sectionBg = mode === 'dark' ? '#0a0d12' : '#f8fafc'
  const sectionBorder = mode === 'dark' ? '#1e2733' : '#e2e8f0'
  const itemColor = mode === 'dark' ? '#8b949e' : '#475569'
  return (
    <div style={{ background: page.surface, border: `1px solid ${c.border}`, borderRadius: 16,
      padding: '22px 26px', position: 'relative', boxShadow: `0 0 40px ${c.glow}` }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14,
        background: 'transparent', border: `1px solid ${page.border}`, borderRadius: 8,
        color: page.muted, cursor: 'pointer', padding: '2px 10px', fontSize: 12,
        fontFamily: 'ui-monospace,monospace' }}>
        close
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ background: c.badge, color: c.badgeText, borderRadius: 5, fontSize: 9,
          fontWeight: 800, padding: '3px 8px', fontFamily: 'monospace',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {LAYER_LABELS[node.layer]}
        </span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: c.text,
          fontFamily: 'ui-monospace,monospace', letterSpacing: '-0.02em' }}>
          {node.label}
        </h2>
        <code style={{ fontSize: 10, color: page.muted }}>{node.sublabel}</code>
      </div>
      <p style={{ margin: '0 0 16px', color: page.muted, fontSize: 12.5, lineHeight: 1.65 }}>
        {node.info.what}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { title: 'When it breaks',  color: '#f87171', items: node.info.breaks   },
          { title: 'How to diagnose', color: '#fb923c', items: node.info.diagnose },
          { title: 'How to fix',      color: '#2dd4bf', items: node.info.fix      },
        ].map(({ title, color, items }) => (
          <div key={title} style={{ background: sectionBg, borderRadius: 10, padding: '10px 12px',
            border: `1px solid ${sectionBorder}`, borderTop: `2px solid ${color}` }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color, marginBottom: 6,
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'ui-monospace,monospace' }}>
              {title}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {items.map(item => (
                <li key={item} style={{ color: itemColor, fontSize: 11, lineHeight: 1.6,
                  marginBottom: 2, paddingLeft: 10, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 0, color, fontWeight: 700 }}>›</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${page.faint}` }}>
        <span style={{ color: page.muted, fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Source files</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
          {node.info.files.map(f => (
            <code key={f} style={{ background: page.subtle, border: `1px solid ${page.border}`,
              borderRadius: 5, padding: '2px 7px', fontSize: 10, color: page.muted,
              fontFamily: 'ui-monospace,monospace' }}>{f}</code>
          ))}
        </div>
      </div>
    </div>
  )
}

const BANDS = [
  { x: 8,   y: 52,  w: 730, h: 120, label: 'PUBLIC / AUTH PAGES' },
  { x: 830, y: 52,  w: 660, h: 120, label: 'EMPLOYEE PORTAL' },
  { x: 8,   y: 240, w: W-16, h: 120, label: 'HR ADMIN PAGES' },
  { x: 8,   y: 430, w: W-16, h: 120, label: 'API ROUTES' },
  { x: 8,   y: 622, w: W-16, h: 120, label: 'INFRASTRUCTURE' },
  { x: 8,   y: 802, w: W-16, h: 110, label: 'SECRETS & CREDENTIALS' },
]

export default function SystemMapClient() {
  const [mode, setMode] = useState<Mode>('dark')
  const [selected, setSelected] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const page = mode === 'dark' ? PD : PL
  const colors = mode === 'dark' ? DARK : LIGHT
  const selectedNode = selected ? nodeById(selected) : null

  const connectedIds = useCallback((id: string | null): Set<string> => {
    if (!id) return new Set()
    const s = new Set<string>()
    EDGES.forEach(e => { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from) })
    return s
  }, [])
  const connected = connectedIds(selected)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => Math.min(4, Math.max(0.2, z * (e.deltaY < 0 ? 1.12 : 0.9))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest('g[style*="pointer"]')) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    setPan({ x: dragStart.current.px + (e.clientX - dragStart.current.mx), y: dragStart.current.py + (e.clientY - dragStart.current.my) })
  }
  function onMouseUp() { dragging.current = false }

  return (
    <div style={{ minHeight: '100vh', background: page.bg, color: page.text,
      fontFamily: 'system-ui,-apple-system,sans-serif', paddingBottom: 60,
      transition: 'background 0.2s,color 0.2s' }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${page.border}`, padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 16, background: page.surface,
        position: 'sticky', top: 0, zIndex: 50, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
            HRMS — System Map
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: page.muted }}>HR Admin only · Internal maintenance reference</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginLeft: 20 }}>
          {(Object.entries(LAYER_LABELS) as [Layer,string][]).map(([layer, label]) => (
            <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[layer].border }} />
              <span style={{ fontSize: 10.5, color: page.muted }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
          {[{ label: '+', fn: () => setZoom(z => Math.min(4, z * 1.2)) },
            { label: '−', fn: () => setZoom(z => Math.max(0.2, z / 1.2)) },
            { label: 'Reset', fn: () => { setZoom(1); setPan({ x: 0, y: 0 }) } }
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={{ background: 'transparent',
              border: `1px solid ${page.border}`, borderRadius: 7, color: page.muted,
              cursor: 'pointer', padding: '4px 10px', fontSize: 11,
              fontFamily: 'ui-monospace,monospace' }}>{label}</button>
          ))}
          <button onClick={() => setMode(m => m === 'dark' ? 'light' : 'dark')} style={{
            background: mode === 'dark' ? '#1e2733' : '#e2e8f0',
            border: `1px solid ${page.border}`, borderRadius: 20, color: page.text,
            cursor: 'pointer', padding: '4px 13px', fontSize: 11, fontWeight: 600,
            fontFamily: 'ui-monospace,monospace' }}>
            {mode === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div style={{ padding: '7px 24px', fontSize: 11, color: page.muted,
        borderBottom: `1px solid ${page.faint}`, background: page.surface,
        display: 'flex', gap: 18 }}>
        <span>› Click a node to inspect</span>
        <span>› Scroll to zoom</span>
        <span>› Drag to pan</span>
        <span>› Zoom: {Math.round(zoom * 100)}%</span>
        {selected && <span style={{ color: colors[nodeById(selected).layer].border }}>
          › Selected: {nodeById(selected).label}
        </span>}
      </div>

      {/* Map */}
      <div ref={containerRef} style={{ overflow: 'hidden', cursor: 'grab',
        userSelect: 'none', height: 560, borderBottom: `1px solid ${page.faint}` }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center', width: '100%', height: '100%',
          transition: 'transform 0.04s linear' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', display: 'block' }}
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                <path d="M0,0.5 L0,5.5 L7,3 z" fill={mode === 'dark' ? '#2d3748' : '#cbd5e1'} />
              </marker>
              {(Object.entries(colors) as [Layer,LayerTheme][]).map(([layer, c]) => (
                <marker key={layer} id={`arr-${layer}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                  <path d="M0,0.5 L0,5.5 L7,3 z" fill={c.border} />
                </marker>
              ))}
            </defs>

            {/* Bands */}
            {BANDS.map(b => (
              <g key={b.label}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10}
                  fill={mode === 'dark' ? '#ffffff05' : '#00000005'}
                  stroke={mode === 'dark' ? '#ffffff08' : '#00000008'} strokeWidth={1} />
                <text x={b.x + 12} y={b.y + 14} fontSize={7.5} fill={page.muted}
                  fontFamily="ui-monospace,monospace" fontWeight={700} letterSpacing="0.14em" opacity={0.45}>
                  {b.label}
                </text>
              </g>
            ))}

            {/* Edges */}
            {EDGES.map(edge => {
              const a = nodeById(edge.from); const b = nodeById(edge.to)
              const isActive = !!selected && (edge.from === selected || edge.to === selected)
              const isDimmed = !!selected && !isActive
              const ac = colors[a.layer]
              const [mx, my] = edgeMid(a, b)
              return (
                <g key={`${edge.from}-${edge.to}`}
                   style={{ opacity: isDimmed ? 0.05 : 1, transition: 'opacity 0.18s' }}>
                  <path d={edgePath(a, b)} fill="none"
                    stroke={isActive ? ac.border : (mode === 'dark' ? '#1e2d3d' : '#cbd5e1')}
                    strokeWidth={isActive ? 1.8 : 0.9}
                    strokeDasharray={edge.dashed ? '5,4' : undefined}
                    markerEnd={`url(#arr${isActive ? `-${a.layer}` : ''})`}
                    strokeOpacity={isActive ? 0.9 : 0.65} />
                  {edge.label && isActive && (
                    <text x={mx} y={my} textAnchor="middle" fontSize={8} fill={ac.border}
                      fontFamily="ui-monospace,monospace" style={{ pointerEvents: 'none' }}>
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {NODES.map(node => (
              <MapNode key={node.id} node={node}
                selected={selected === node.id}
                highlighted={connected.has(node.id)}
                dimmed={!!selected && selected !== node.id && !connected.has(node.id)}
                onClick={id => setSelected(p => p === id ? null : id)}
                colors={colors} />
            ))}
          </svg>
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ padding: '14px 22px' }}>
        {selectedNode ? (
          <DetailPanel node={selectedNode} onClose={() => setSelected(null)}
            mode={mode} colors={colors} page={page} />
        ) : (
          <div style={{ background: page.surface, border: `1px solid ${page.border}`,
            borderRadius: 14, padding: '24px', textAlign: 'center', color: page.muted }}>
            <div style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace' }}>
              ↑ Select a node above to see maintenance details
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
              Each node shows: what it does, symptoms when it fails, how to diagnose, how to fix
            </div>
          </div>
        )}
      </div>

      {/* Secrets quick reference */}
      <div style={{ padding: '8px 22px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: page.muted, marginBottom: 10,
          textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'ui-monospace,monospace' }}>
          Secrets & Environment Variables — Quick Reference
        </div>
        <div style={{ background: page.surface, border: `1px solid ${page.border}`,
          borderRadius: 10, overflow: 'hidden', fontSize: 11, fontFamily: 'ui-monospace,monospace' }}>
          {[
            { key: 'NEXTAUTH_SECRET',          where: 'Vercel env',   how: 'openssl rand -base64 32',                            affects: 'All sessions invalidated if changed' },
            { key: 'ENCRYPTION_KEY',            where: 'Vercel env',   how: 'openssl rand -hex 32',                               affects: 'NEVER rotate — loses all encrypted employee data' },
            { key: 'DATABASE_URL',              where: 'Vercel env',   how: 'Supabase Settings → Connection string',                 affects: 'Entire app — no DB = no app' },
            { key: 'RESEND_API_KEY',            where: 'Vercel env',   how: 'Resend dashboard → API Keys',                        affects: 'Signup, password reset, invite, payslip approval emails' },
            { key: 'AWS_ACCESS_KEY_ID + SECRET',where: 'Vercel env',   how: 'IAM → Security credentials → Create access key',    affects: 'All file uploads and payslip PDFs' },
            { key: 'RAZORPAY_KEY_ID + SECRET',  where: 'Vercel env',   how: 'Razorpay dashboard → API Keys',                     affects: 'Billing and subscription payments' },
            { key: 'CRON_SECRET',               where: 'Vercel env',   how: 'openssl rand -base64 32 + update vercel.json',       affects: 'Device offline alerts + attendance notifications' },
            { key: 'NEXTAUTH_URL',              where: 'Vercel env',   how: 'https://yourdomain.com',                             affects: 'Auth callbacks, email links' },
          ].map((row, i) => (
            <div key={row.key} style={{ display: 'grid', gridTemplateColumns: '260px 130px 320px 1fr',
              borderBottom: i < 7 ? `1px solid ${page.faint}` : 'none',
              padding: '8px 14px', alignItems: 'center',
              background: i % 2 === 0 ? page.subtle : page.surface }}>
              <code style={{ color: colors.secrets.border, fontWeight: 700 }}>{row.key}</code>
              <span style={{ color: page.muted }}>{row.where}</span>
              <code style={{ color: colors.public.border, fontSize: 10 }}>{row.how}</code>
              <span style={{ color: page.muted, fontSize: 10.5 }}>{row.affects}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Dependency chains */}
      <div style={{ padding: '20px 22px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: page.muted, marginBottom: 10,
          textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'ui-monospace,monospace' }}>
          Critical Dependency Chains
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { title: 'User Login', color: colors.public.border, steps: [
              'User submits credentials at /login',
              '→ NextAuth authorize() called',
              '→ peekRateLimit() — checks per-email + per-IP buckets in Supabase Postgres',
              '→ prisma.user.findUnique() — fetches user + org',
              '→ bcrypt.compare() — verifies password',
              '→ JWT signed with NEXTAUTH_SECRET',
              '→ HttpOnly session cookie set',
              '→ middleware.ts validates JWT on every request',
            ]},
            { title: 'Employee Sensitive Data', color: colors.secrets.border, steps: [
              'HR updates bank details on /employees',
              '→ API route calls requireAdmin()',
              '→ encrypt(value, ENCRYPTION_KEY) — AES-256-GCM',
              '→ Ciphertext stored in employees.bank_details',
              '→ On read: decrypt(ciphertext, ENCRYPTION_KEY)',
              '→ Plaintext shown in UI only',
              '→ ENCRYPTION_KEY must NEVER change',
            ]},
            { title: 'Payslip Generation', color: colors.infra.border, steps: [
              'HR runs payroll for month at /payroll',
              '→ payroll_runs record created (status: processing)',
              '→ For each employee: calculate gross/deductions',
              '→ Generate PDF (Puppeteer/PDFKit)',
              '→ Upload PDF to S3 (org_id/payslips/...)',
              '→ payslips record created with pdf_s3_key',
              '→ Approval email sent via Resend',
              '→ Employee sees presigned S3 URL at /payslip',
            ]},
          ].map(item => (
            <div key={item.title} style={{ background: page.surface, borderRadius: 10,
              padding: '12px 14px', border: `1px solid ${page.border}`,
              borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: item.color, marginBottom: 8,
                fontFamily: 'ui-monospace,monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {item.title}
              </div>
              {item.steps.map((step, i) => (
                <div key={i} style={{ fontSize: 11, color: step.startsWith('→') ? page.muted : page.text,
                  fontFamily: step.startsWith('→') ? 'ui-monospace,monospace' : 'inherit',
                  padding: '1.5px 0', paddingLeft: step.startsWith('→') ? 8 : 0 }}>
                  {step}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
