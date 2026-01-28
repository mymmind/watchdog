# Watchdog Test Suite

Comprehensive test coverage for Watchdog monitoring system using Node.js built-in test runner.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── CircularBuffer.test.js
│   ├── StateManager.test.js
│   ├── AnomalyDetector.test.js
│   └── MessageFormatter.test.js
├── integration/             # Integration tests for system workflows
│   ├── discovery.test.js    # Service discovery pipeline
│   └── monitoring.test.js   # Monitoring system orchestration
└── README.md               # This file
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
node --test tests/unit/CircularBuffer.test.js
```

### Run Tests with Watch Mode
```bash
node --test --watch tests/**/*.test.js
```

### Run Tests in Parallel
Tests run in parallel by default for optimal performance.

## Test Coverage

### Unit Tests (50 tests)

#### CircularBuffer (8 tests)
- Buffer creation and size validation
- Push operations and circular wrapping
- Statistical functions (median, average, min, max)
- Serialization/deserialization
- Clear and utility methods

#### StateManager (15 tests)
- Failure recording and tracking
- Alert cooldown management
- Flapping detection (3+ state changes in 10 minutes)
- Service acknowledgment (muting)
- State persistence to disk
- Recovery tracking
- Statistics aggregation

#### AnomalyDetector (13 tests)
- Response time recording
- Anomaly detection with configurable thresholds
- Statistical analysis (median-based detection)
- Service tracking and history
- State serialization
- Configuration-based enabling/disabling

#### MessageFormatter (14 tests)
- Service down notifications (first failure, ongoing failure)
- Service recovery notifications
- Performance anomaly alerts
- Flapping service alerts
- Resource warnings (disk, RAM, CPU)
- SSL certificate expiry warnings
- Startup and shutdown messages
- Duration formatting

### Integration Tests (17 tests)

#### Service Discovery (6 tests)
- Full discovery pipeline (Docker, PM2, systemd)
- YAML file generation with metadata
- Graceful handling of unavailable services
- Service structure validation
- Empty result handling
- End-to-end discovery and write flow

#### Monitoring System (11 tests)
- Monitor initialization with all checkers
- HTTP endpoint checking and response time tracking
- Failure detection and state management
- Recovery flow with downtime calculation
- Flapping detection and alert suppression
- Anomaly detection integration
- Resource monitoring
- Mock notifications for testing alerts
- Statistics aggregation
- Cron expression generation

## Test Patterns

### Unit Test Pattern
```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import MyModule from '../../src/path/MyModule.js';

describe('MyModule', () => {
  describe('myMethod', () => {
    it('should behave correctly', () => {
      const module = new MyModule();
      const result = module.myMethod();
      assert.ok(result);
    });
  });
});
```

### Integration Test Pattern
```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';

describe('MyIntegration', () => {
  let testData;

  beforeEach(() => {
    // Setup test environment
    testData = createTestData();
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync('./test-file.json')) {
      fs.unlinkSync('./test-file.json');
    }
  });

  it('should integrate components correctly', async () => {
    // Test integration
  });
});
```

## Testing Guidelines

### Writing New Tests

1. **Test Isolation**: Each test should be independent
   - Use `beforeEach` for setup
   - Use `afterEach` for cleanup
   - Don't rely on test execution order

2. **Descriptive Names**: Test names should be clear and specific
   ```javascript
   // Good
   it('should record first failure and return first_failure action', () => {});

   // Bad
   it('should work', () => {});
   ```

3. **Arrange-Act-Assert Pattern**:
   ```javascript
   it('should do something', () => {
     // Arrange: Set up test data
     const input = createInput();

     // Act: Execute the code under test
     const result = module.method(input);

     // Assert: Verify the outcome
     assert.strictEqual(result, expectedValue);
   });
   ```

4. **Test Both Success and Failure Cases**:
   ```javascript
   describe('validation', () => {
     it('should accept valid input', () => {});
     it('should reject invalid input', () => {});
   });
   ```

### Async Testing

For async operations, use `async/await`:
```javascript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  assert.ok(result);
});
```

### Mocking

For integration tests, create simple mock objects:
```javascript
const mockNotifier = {
  calls: [],
  async sendAlert(message) {
    this.calls.push(message);
  },
};
```

### Temporary Files

Always clean up temporary test files:
```javascript
afterEach(() => {
  if (fs.existsSync(TEST_FILE_PATH)) {
    fs.unlinkSync(TEST_FILE_PATH);
  }
});
```

## Test Configuration

Tests use the Node.js built-in test runner (`node:test`), which provides:
- Parallel execution by default
- Built-in assertions (`node:assert`)
- Lifecycle hooks (`beforeEach`, `afterEach`)
- Test organization (`describe`, `it`)
- No external dependencies required

## Continuous Integration

Tests run automatically:
- On every commit (via pre-commit hook)
- Before creating pull requests
- In CI/CD pipelines

## Debugging Tests

### Run Single Test with Debugging
```bash
node --inspect-brk --test tests/unit/CircularBuffer.test.js
```

### Add Debug Output
```javascript
import logger from '../../src/utils/logger.js';

it('should debug something', () => {
  logger.debug('Debug info', { data: testData });
  // test code
});
```

### Skip Tests Temporarily
```javascript
it.skip('should be skipped', () => {
  // This test won't run
});
```

### Focus on Specific Tests
```javascript
it.only('should run only this test', () => {
  // Only this test will run
});
```

## Code Coverage

To add code coverage in the future:
```bash
npm install --save-dev c8
```

Add to package.json:
```json
{
  "scripts": {
    "test:coverage": "c8 npm test"
  }
}
```

## Known Limitations

1. **External Services**: Integration tests mock external services (Telegram, Docker, PM2) to avoid dependencies
2. **System Resources**: Resource checker tests may vary based on system state
3. **Timing**: Some tests use small delays (10ms) to ensure timing-dependent assertions pass

## Contributing

When adding new features:
1. Write unit tests for new modules/methods
2. Write integration tests for new workflows
3. Ensure all tests pass: `npm test`
4. Maintain >80% code coverage
5. Follow existing test patterns

## Test Results

Current status: **67 tests, 0 failures**
- Unit tests: 50 passing
- Integration tests: 17 passing
- Average test duration: <1 second

## Future Test Additions

Planned test coverage:
- End-to-end tests with real services (optional Docker environment)
- Performance tests for response time tracking
- Load tests for concurrent health checks
- API tests for dashboard endpoints
- CLI tests for command-line interface
