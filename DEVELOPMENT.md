# Development Guide

Guide for contributing to Watchdog development.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Structure](#code-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Contributing Workflow](#contributing-workflow)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher (LTS recommended)
- **npm**: 10.0.0 or higher
- **Git**: For version control
- **Optional**: Docker, PM2, systemd (for testing discovery features)

### Fork and Clone

```bash
# Fork repository on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/watchdog.git
cd watchdog
```

### Install Dependencies

```bash
npm install
```

### Configure Development Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your Telegram credentials
# (Get test bot from @BotFather)
nano .env
```

### Verify Setup

```bash
# Run tests
npm test

# Run linter
npm run lint

# Start in development mode
npm start
```

## Development Setup

### Environment Configuration

Create `.env.development` for development-specific settings:

```env
# Telegram (use test bot)
TELEGRAM_BOT_TOKEN=your_test_bot_token
TELEGRAM_CHAT_ID=your_test_chat_id

# Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3100

# Shorter intervals for faster feedback
CHECK_INTERVAL_SERVICES=30000     # 30 seconds
CHECK_INTERVAL_ENDPOINTS=15000    # 15 seconds
CHECK_INTERVAL_RESOURCES=60000    # 1 minute

# Lower cooldown for testing
ALERT_COOLDOWN_MINUTES=5

# Enable debug logging
LOG_LEVEL=debug
```

### Recommended Tools

**Code Editor**:
- VS Code with extensions:
  - ESLint
  - Prettier
  - EditorConfig
  - JavaScript (ES6) code snippets

**Terminal**:
- iTerm2 (macOS) or Windows Terminal
- Oh My Zsh with git plugin

**Debugging**:
- Node.js DevTools
- Chrome DevTools (for dashboard)

### NPM Scripts

```bash
# Development
npm start                    # Start Watchdog
npm run dev                  # Start with nodemon (auto-restart)

# Testing
npm test                     # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:watch           # Watch mode
npm run test:coverage        # With coverage report

# Linting
npm run lint                 # Check code style
npm run lint:fix             # Auto-fix issues

# PM2
npm run pm2:start            # Start with PM2
npm run pm2:stop             # Stop PM2
npm run pm2:restart          # Restart PM2
npm run pm2:logs             # View logs
npm run pm2:status           # Check status

# Cleanup
npm run clean                # Remove generated files
```

## Code Structure

```
watchdog/
├── src/
│   ├── index.js                 # Entry point
│   ├── config/
│   │   ├── ConfigLoader.js      # Configuration system
│   │   ├── defaults.js          # Default values
│   │   └── schema.js            # Validation schema
│   ├── discovery/
│   │   ├── ServiceDiscovery.js  # Orchestrator
│   │   ├── DockerDiscovery.js   # Docker scanner
│   │   ├── PM2Discovery.js      # PM2 scanner
│   │   ├── SystemdDiscovery.js  # systemd scanner
│   │   └── DiscoveredServicesWriter.js
│   ├── checkers/
│   │   ├── HealthChecker.js     # Base class
│   │   ├── DockerChecker.js     # Docker health
│   │   ├── PM2Checker.js        # PM2 health
│   │   ├── SystemdChecker.js    # systemd health
│   │   ├── HTTPChecker.js       # HTTP/HTTPS
│   │   ├── ResourceChecker.js   # Disk/RAM/CPU
│   │   └── SSLChecker.js        # SSL certificates
│   ├── monitoring/
│   │   ├── Monitor.js           # Main orchestrator
│   │   ├── StateManager.js      # Persistent state
│   │   └── AnomalyDetector.js   # Performance monitoring
│   ├── notifications/
│   │   ├── TelegramNotifier.js  # Telegram integration
│   │   └── MessageFormatter.js  # Message formatting
│   ├── ui/
│   │   ├── DashboardServer.js   # HTTP server
│   │   └── public/
│   │       └── index.html       # Dashboard UI
│   └── utils/
│       ├── logger.js            # Structured logging
│       ├── exec.js              # Safe command execution
│       └── CircularBuffer.js    # Response time buffer
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── README.md                # Test documentation
├── .env.example                 # Environment template
├── .eslintrc.json               # ESLint configuration
├── .gitignore                   # Git ignore rules
├── ecosystem.config.js          # PM2 configuration
├── package.json                 # Dependencies
├── watchdog.config.example.yml  # Config template
└── docs/                        # Documentation
    ├── README.md
    ├── CONFIGURATION.md
    ├── ARCHITECTURE.md
    └── DEVELOPMENT.md (this file)
```

## Coding Standards

### JavaScript Style Guide

We follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) with some modifications.

**ESLint Configuration** (`.eslintrc.json`):
```json
{
  "extends": "airbnb-base",
  "env": {
    "node": true,
    "es2022": true
  },
  "rules": {
    "no-console": "off",
    "import/extensions": ["error", "always"],
    "class-methods-use-this": "off"
  }
}
```

### Code Formatting

**Indent**: 2 spaces (no tabs)

**Line Length**: 100 characters max

**Quotes**: Single quotes for strings

**Semicolons**: Required

**Trailing Commas**: Required in multi-line

### Naming Conventions

**Files**: PascalCase for classes, camelCase for utilities
```
HealthChecker.js      # Class
logger.js             # Utility
```

**Classes**: PascalCase
```javascript
class StateManager {}
class DockerChecker extends HealthChecker {}
```

**Functions/Variables**: camelCase
```javascript
function checkHealth() {}
const responseTime = 100;
```

**Constants**: UPPER_SNAKE_CASE
```javascript
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
```

**Private Methods**: Prefix with underscore
```javascript
class Checker {
  _parseOutput(output) {}  // Private
  check(service) {}         // Public
}
```

### Documentation

**JSDoc for Public APIs**:
```javascript
/**
 * Check service health
 * @param {Object} service - Service configuration
 * @param {string} service.name - Service name
 * @returns {Promise<Object>} - Health check result
 * @throws {Error} - If service not found
 */
async check(service) {
  // Implementation
}
```

**Inline Comments**: Explain WHY, not WHAT
```javascript
// ❌ Bad
// Set timeout to 5000
const timeout = 5000;

// ✅ Good
// Timeout increased to handle slow Docker daemon on startup
const timeout = 5000;
```

### Error Handling

**Always Catch Errors**:
```javascript
// ✅ Good
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  return this.createFailureResult(error.message);
}

// ❌ Bad
await riskyOperation();  // Unhandled promise rejection
```

**Error Messages**:
- Be specific about what failed
- Include relevant context
- Don't expose sensitive data

```javascript
// ✅ Good
throw new Error(`Failed to connect to Docker socket: ${error.message}`);

// ❌ Bad
throw new Error('Error');
```

### Security Best Practices

**Input Validation**:
```javascript
function validateThreshold(value) {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new Error('Threshold must be between 0 and 100');
  }
}
```

**Command Execution**:
```javascript
// ✅ Safe: Whitelist + sanitization
await safeExec('docker', ['ps']);

// ❌ Dangerous: User input in command
await exec(`docker ps ${userInput}`);
```

**Sensitive Data**:
```javascript
// ✅ Good: Sanitize before logging
logger.info('Config loaded', sanitize(config));

// ❌ Bad: Log sensitive data
logger.info('Config loaded', config);  // May contain tokens
```

## Testing

### Test Structure

See [tests/README.md](tests/README.md) for complete testing documentation.

### Writing Unit Tests

**Test File Naming**: `<Module>.test.js`

**Test Structure**:
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import MyModule from '../../src/path/MyModule.js';

describe('MyModule', () => {
  describe('methodName', () => {
    it('should behave correctly', () => {
      const module = new MyModule();
      const result = module.methodName();
      assert.strictEqual(result, expected);
    });

    it('should handle errors', () => {
      const module = new MyModule();
      assert.throws(() => module.methodName(invalid));
    });
  });
});
```

### Testing Checklist

Before submitting code:

- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] New code has tests
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] No console.log left in code

### Manual Testing

**Test Discovery**:
```bash
# Remove discovered-services.yml
rm discovered-services.yml

# Start Watchdog
npm start

# Verify services discovered
cat discovered-services.yml
```

**Test Alerts**:
```bash
# Stop a service
docker stop postgres

# Wait for alert
# Check Telegram

# Start service
docker start postgres

# Wait for recovery alert
```

**Test Dashboard**:
```bash
# Start Watchdog
npm start

# Open http://localhost:3100
# Verify services displayed
# Check auto-refresh
```

## Contributing Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

**Branch Naming**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code restructuring
- `test/` - Test additions/fixes

### 2. Make Changes

- Write code following standards
- Add/update tests
- Update documentation
- Run linter and tests

### 3. Commit Changes

**Commit Message Format**:
```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Example**:
```
feat: Add Redis health checker

Implements RedisChecker class that uses redis-cli to check
connection status. Supports authentication and custom ports.

- Added RedisChecker.js
- Added tests for Redis checking
- Updated Monitor to use RedisChecker
- Added Redis to discovery system

Closes #123
```

### 4. Push Branch

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

On GitHub:
1. Click "New Pull Request"
2. Fill in description using template
3. Link related issues
4. Request review

## Pull Request Process

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] New tests added
- [ ] Manual testing performed

## Checklist
- [ ] Code follows style guide
- [ ] Self-reviewed code
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Git commit messages are clear

## Related Issues
Closes #123
```

### Code Review Checklist

**Functionality**:
- [ ] Does what it's supposed to do
- [ ] Handles edge cases
- [ ] No obvious bugs
- [ ] Performance acceptable

**Code Quality**:
- [ ] Follows style guide
- [ ] Clear and readable
- [ ] No code duplication
- [ ] Appropriate abstractions

**Tests**:
- [ ] Adequate test coverage
- [ ] Tests are meaningful
- [ ] Edge cases tested
- [ ] No flaky tests

**Documentation**:
- [ ] Public APIs documented
- [ ] README updated if needed
- [ ] Complex logic explained
- [ ] CHANGELOG updated

**Security**:
- [ ] No security vulnerabilities
- [ ] Input validated
- [ ] No sensitive data logged
- [ ] Dependencies secure

### Responding to Review Feedback

1. **Address all comments**: Resolve or discuss
2. **Push additional commits**: Don't force-push during review
3. **Mark conversations resolved**: After addressing
4. **Request re-review**: When ready

### Merging

**Requirements**:
- [ ] At least one approval
- [ ] All checks passing
- [ ] No merge conflicts
- [ ] Up to date with main

**Merge Strategy**: Squash and merge (GitHub)

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

Example: `1.2.3`
- Major version: 1
- Minor version: 2
- Patch version: 3

### Release Checklist

1. **Update Version**:
   ```bash
   npm version minor  # or major/patch
   ```

2. **Update CHANGELOG.md**:
   ```markdown
   ## [1.2.0] - 2026-01-28
   ### Added
   - Redis health checker
   - SSL certificate monitoring

   ### Changed
   - Improved anomaly detection algorithm

   ### Fixed
   - Dashboard refresh issue
   ```

3. **Create Git Tag**:
   ```bash
   git tag -a v1.2.0 -m "Release 1.2.0"
   git push origin v1.2.0
   ```

4. **Create GitHub Release**:
   - Go to Releases
   - Draft new release
   - Choose tag
   - Copy CHANGELOG entry
   - Publish

5. **Announce**:
   - Update README badges
   - Post in Discussions
   - Tweet (if applicable)

## Common Development Tasks

### Adding a New Checker

1. **Create Checker Class**:
   ```javascript
   // src/checkers/RedisChecker.js
   import HealthChecker from './HealthChecker.js';
   import { safeExec } from '../utils/exec.js';

   export default class RedisChecker extends HealthChecker {
     async check(service) {
       try {
         await safeExec('redis-cli', ['-h', service.host, 'ping']);
         return this.createSuccessResult();
       } catch (error) {
         return this.createFailureResult(error.message);
       }
     }
   }
   ```

2. **Add to Monitor**:
   ```javascript
   // src/monitoring/Monitor.js
   import RedisChecker from '../checkers/RedisChecker.js';

   constructor(config, stateManager, notifier) {
     this.checkers = {
       // ... existing checkers
       redis: new RedisChecker(config),
     };
   }
   ```

3. **Add Tests**:
   ```javascript
   // tests/unit/RedisChecker.test.js
   import { describe, it } from 'node:test';
   import assert from 'node:assert';
   import RedisChecker from '../../src/checkers/RedisChecker.js';

   describe('RedisChecker', () => {
     // Write tests
   });
   ```

4. **Update Documentation**:
   - Add to README features list
   - Add to CONFIGURATION.md
   - Add to ARCHITECTURE.md

### Adding a New Notification Channel

1. **Create Notifier**:
   ```javascript
   // src/notifications/SlackNotifier.js
   export default class SlackNotifier {
     async sendFailureAlert(serviceId, service, result, action) {
       // Implement Slack webhook
     }
     // ... other methods
   }
   ```

2. **Add to Monitor**:
   ```javascript
   constructor(config, stateManager, telegramNotifier, slackNotifier) {
     this.notifiers = [telegramNotifier, slackNotifier];
   }

   async notifyAll(method, ...args) {
     await Promise.allSettled(
       this.notifiers.map(n => n[method](...args))
     );
   }
   ```

3. **Add Configuration**:
   ```env
   SLACK_WEBHOOK_URL=https://hooks.slack.com/...
   ```

### Adding a New Dashboard Widget

1. **Update API Endpoint**:
   ```javascript
   // src/ui/DashboardServer.js
   buildStatusResponse() {
     return {
       // ... existing data
       newWidget: this.getNewWidgetData(),
     };
   }
   ```

2. **Update Frontend**:
   ```javascript
   // src/ui/public/index.html
   function updateDashboard(data) {
     // ... existing updates
     updateNewWidget(data.newWidget);
   }

   function updateNewWidget(data) {
     // Update DOM
   }
   ```

3. **Add Styles**:
   ```css
   .new-widget {
     /* Styles */
   }
   ```

## Troubleshooting Development Issues

### Tests Failing

```bash
# Clear state files
rm state.json discovered-services.yml

# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests verbose
npm test -- --reporter=spec
```

### Linter Errors

```bash
# Auto-fix what's possible
npm run lint:fix

# Check specific file
npx eslint src/path/file.js
```

### Module Not Found

```bash
# Ensure .js extension in imports
import Module from './Module.js';  // ✅
import Module from './Module';     // ❌
```

### Git Hooks Not Running

```bash
# Reinstall hooks
rm -rf .husky
npm install
```

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/mymmind/watchdog/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mymmind/watchdog/discussions)
- **Code of Conduct**: Be respectful and constructive
- **Security**: Report vulnerabilities privately to maintainers

## Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [ESLint Rules](https://eslint.org/docs/rules/)

---

Thank you for contributing to Watchdog! 🐕

Every contribution, no matter how small, makes this project better for everyone.
