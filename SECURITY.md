# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in UserTelemetryViewer, please report it responsibly. **Do not open a public issue.**

Instead, use [GitHub's private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) or contact the maintainer directly.

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

You should receive a response within 72 hours.

## Security Considerations

### Open API Endpoint

The `/api/events` endpoint on `server.ts` currently has **no authentication**. It accepts any POST request. In production:

- Add API key validation
- Rate-limit incoming requests
- Restrict CORS origins from `*` to your specific domains
- Run behind a reverse proxy (nginx, Cloudflare, etc.)

### WebSocket Connections

Socket.io connections are currently open to all origins (`cors: { origin: '*' }`). Restrict this in production.

### No Sensitive Data Storage

UserTelemetryViewer does not persist any data to disk. All user state is held in-memory and evicted after 2 minutes of inactivity. There is no database, no user credentials, no PII storage.

### Dependencies

Keep dependencies up to date. Run `npm audit` periodically to check for known vulnerabilities.

## Supported Versions

Only the latest version on `main` is supported with security updates.
