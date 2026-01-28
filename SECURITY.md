# Security Policy

## Supported Versions

Currently supported versions receiving security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email**: Send details to the project maintainers privately
2. **GitHub Security**: Use GitHub's private vulnerability reporting feature
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Varies by severity
  - **Critical**: 1-7 days
  - **High**: 7-30 days
  - **Medium**: 30-90 days
  - **Low**: Best effort

### Disclosure Policy

- We will coordinate disclosure with you
- Fix will be developed privately
- CVE will be requested if applicable
- Credit will be given to reporter (unless anonymous preferred)
- Public disclosure after fix is released

## Security Best Practices

### For Deployment

**Environment Variables**:
- Never commit `.env` file to version control
- Use `.env.example` as template only
- Rotate Telegram bot tokens periodically

**Dashboard**:
- Dashboard is unauthenticated by default
- For remote access, use:
  - Reverse proxy with authentication (recommended)
  - SSH tunnel for temporary access
  - Firewall rules to restrict access
- Never expose dashboard directly to internet

**File Permissions**:
```bash
chmod 600 .env              # Only owner can read/write
chmod 644 state.json        # Owner write, others read
chmod 755 logs/             # Standard directory permissions
```

**PM2 Configuration**:
- Run as non-root user when possible
- Set `max_memory_restart` to prevent memory leaks
- Use PM2 startup script for auto-start

### For Development

**Command Execution**:
- Always use `safeExec()` wrapper from `src/utils/exec.js`
- Never use `exec()` with user input
- Whitelist commands only
- Sanitize all arguments

**Input Validation**:
- Validate all configuration before use
- Sanitize user input from YAML config
- Check types and ranges for thresholds

**Logging**:
- Use `logger` utility to auto-sanitize sensitive data
- Never log tokens, passwords, or secrets
- Redact sensitive fields from error messages

**Dependencies**:
- Run `npm audit` regularly
- Update dependencies for security patches
- Review dependency changes before upgrading

## Known Security Considerations

### 1. Telegram Bot Token

**Risk**: Token exposure allows unauthorized message sending

**Mitigation**:
- Store in `.env` file only
- Never commit to version control
- Rotate token if exposed
- Use BotFather to revoke compromised tokens

### 2. Dashboard Access

**Risk**: Unauthenticated access to monitoring data

**Mitigation**:
- Default: localhost only
- Production: Use reverse proxy with auth
- Monitor access logs

### 3. Command Injection

**Risk**: Malicious service names could execute commands

**Mitigation**:
- Whitelist of allowed commands
- Argument sanitization (removes `; & | $ ( )`)
- Use `spawn()` not `exec()`
- Input validation in config loader

### 4. State File Access

**Risk**: State file contains service metadata

**Mitigation**:
- File permissions (644 or 600)
- No sensitive data stored in state
- Sanitize before logging

### 5. Docker Socket Access

**Risk**: Docker socket access is privileged

**Mitigation**:
- Read-only operations only
- No container manipulation commands
- Error handling for permission issues

## Security Features

### Implemented

- ✅ Command injection prevention
- ✅ Sensitive data sanitization in logs
- ✅ Input validation and schema checking
- ✅ Safe command execution wrapper
- ✅ Rate-limited Telegram API calls
- ✅ Graceful error handling
- ✅ No secrets in state files

### Planned

- ⏳ Dashboard authentication (v1.1)
- ⏳ API key support for dashboard (v1.1)
- ⏳ Encrypted state file option (v1.2)
- ⏳ Audit logging (v1.2)

## Contact

For security concerns:
- **GitHub Issues**: Public issues (non-security)
- **Private Report**: Use GitHub's security advisory feature
- **Urgent**: Contact maintainers directly

## Acknowledgments

We appreciate responsible disclosure and will credit security researchers who help improve Watchdog's security.

---

**Last Updated**: 2026-01-28
