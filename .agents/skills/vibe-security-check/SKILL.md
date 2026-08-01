---
name: vibe-security-check
description: "Auditoria completa de segurança com 15 módulos cobrindo OWASP Top 10: varre o projeto detectando segredos expostos, falhas de autenticação, JWT mal configurado, uploads sem validação, dependências vulneráveis e muito mais. Corrige automaticamente as vulnerabilidades encontradas e gera um relatório detalhado com o que foi resolvido e o que ainda precisa de atenção manual."
---

Run the Vibe Security Check on this project.

Phase 0 — Reconnaissance: Scan the codebase for signals: auth system, JWT usage, password reset, admin routes, file uploads, webhooks, raw SQL, innerHTML/dangerouslySetInnerHTML, CORS config, error handling, dependency manifests, deployment config, and hardcoded secrets. Output a Reconnaissance Report listing which of the 15 SEC modules will run and which are skipped (with reasons).

Phase 1 — Run each applicable SEC module in order:
SEC-01: Secrets & API Key Exposure — scan all files for hardcoded API keys, passwords, DB URLs, tokens.
SEC-02: Secure Authentication — check password hashing, session management, brute force protection.
SEC-03: JWT Security — verify algorithm (no 'none', no HS256 with weak secret), expiry, storage.
SEC-04: Password Reset Flow — check token expiry, single-use enforcement, account enumeration.
SEC-05: IDOR & Ownership Checks — every route using a user-supplied ID must verify ownership.
SEC-06: Admin Route Protection — all /admin routes must verify role server-side.
SEC-07: Input Validation — all user inputs validated before processing.
SEC-08: XSS Protection — no innerHTML, dangerouslySetInnerHTML, or eval with user data.
SEC-09: Secure File Uploads — type validation, size limits, no execution of uploaded files.
SEC-10: CORS Configuration — no wildcard origin on authenticated endpoints.
SEC-11: Webhook Verification — HMAC signature validation on all webhook endpoints.
SEC-12: Error Message Leakage — no stack traces, DB errors, or internal paths exposed to users.
SEC-13: Rate Limiting — protect login, signup, password reset, and expensive endpoints.

Before modifying any file, log: [SEC-XX] Modifying <filename>: replacing <old> with <new> because <reason>.

Phase 2 — Dependency Scan: run npm audit --json (or equivalent). List Critical/High CVEs with safe upgrade versions and apply non-breaking upgrades.

Phase 3 — Save SECURITY_AUDIT_REPORT.md in the project root with: Executive Summary, findings by severity (Critical/High/Medium/Low), what was auto-fixed, and what needs manual attention.
