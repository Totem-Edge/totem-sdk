# DesignerConfigManager Unit Test Suite

| Property | Value |
|----------|-------|
| **Component** | Designer Configuration Management |
| **Type** | Unit Test |
| **Framework** | Jest |

## Purpose

This unit test suite validates the DesignerConfigManager class that handles configuration for designer/developer tools in the Totem Extension. It ensures that:

1. **Config Loading** correctly reads configuration from storage
2. **Config Saving** persists configuration changes
3. **Default Values** are applied when config doesn't exist
4. **Config Validation** rejects invalid configuration
5. **Feature Flags** can be read and updated
6. **Type Safety** enforces correct config structure

The DesignerConfigManager provides a centralized way to manage developer-specific settings.

## Test Design

The test suite validates the configuration manager class through unit tests:

### Test Structure
```
DesignerConfigManager
├── Constructor & Initialization
│   ├── Creates with default config
│   └── Loads existing config
├── Config Reading
│   ├── get(key) returns values
│   └── getAll() returns full config
├── Config Writing
│   ├── set(key, value) updates config
│   └── setAll(config) replaces config
├── Persistence
│   ├── save() writes to storage
│   └── load() reads from storage
└── Validation
    ├── Rejects invalid keys
    └── Rejects invalid values
```

## Pass Requirements

For tests to pass:

1. **Constructor** must initialize with default config if no saved config exists
2. **get(key)** must return correct value for existing keys
3. **get(nonexistent)** must return undefined or default value
4. **set(key, value)** must update config in memory
5. **save()** must persist config to storage
6. **load()** must restore config from storage
7. **Validation** must reject invalid config

## Test Coverage

### Initialization Tests
```typescript
✓ creates with empty config
✓ creates with default config
✓ loads existing config from storage
```

### Read Operations
```typescript
✓ get() returns value for existing key
✓ get() returns undefined for missing key
✓ getAll() returns full config object
```

### Write Operations
```typescript
✓ set() updates single config value
✓ setAll() replaces entire config
✓ set() doesn't persist until save() called
```

### Persistence Tests
```typescript
✓ save() writes config to storage
✓ load() reads config from storage
✓ save-load round-trip preserves data
```

### Validation Tests
```typescript
✓ rejects unknown config keys
✓ rejects invalid value types
✓ validates nested config objects
```

### Feature Flag Tests
```typescript
✓ isFeatureEnabled() checks boolean flags
✓ enableFeature() sets flag to true
✓ disableFeature() sets flag to false
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- Browser storage API (mocked in tests)
- TypeScript

### Configuration Schema
```typescript
interface DesignerConfig {
  enabled: boolean;
  debugMode: boolean;
  features: {
    devTools: boolean;
    inspector: boolean;
    logger: boolean;
  };
}
```

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test test/unit/config/DesignerConfigManager.test.ts
```

### Run all config tests:
```bash
cd packages/totem-extension
npm test test/unit/config/
```

### Run with coverage:
```bash
cd packages/totem-extension
npm test -- --coverage test/unit/config/DesignerConfigManager.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  test/unit/config/DesignerConfigManager.test.ts
  DesignerConfigManager
    Initialization
      ✓ creates with default config (3ms)
      ✓ loads existing config (2ms)
    Read Operations
      ✓ get() returns value (1ms)
      ✓ getAll() returns config (1ms)
    Write Operations
      ✓ set() updates value (1ms)
      ✓ setAll() replaces config (2ms)
    Persistence
      ✓ save() writes to storage (3ms)
      ✓ load() reads from storage (2ms)
    Validation
      ✓ rejects invalid keys (1ms)
      ✓ rejects invalid values (1ms)

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

### What Passing Tests Indicate
- ✅ Config manager working correctly
- ✅ Storage operations functional
- ✅ Validation preventing bad config
- ✅ Type safety enforced

## Common Issues

### Issue: "loads existing config" fails
**Cause**: Storage mock not set up  
**Solution**: Mock browser.storage API:
```typescript
// Mock storage
const mockStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn()
  }
};
global.browser = { storage: mockStorage };
```

### Issue: "save() writes to storage" fails
**Cause**: save() not calling storage.set()  
**Solution**: Implement save method:
```typescript
class DesignerConfigManager {
  async save() {
    await browser.storage.local.set({
      designerConfig: this.config
    });
  }
}
```

### Issue: Validation tests fail
**Cause**: No validation implemented  
**Solution**: Add validation logic:
```typescript
set(key: string, value: any) {
  if (!this.isValidKey(key)) {
    throw new Error(`Invalid config key: ${key}`);
  }
  if (!this.isValidValue(key, value)) {
    throw new Error(`Invalid value for ${key}`);
  }
  this.config[key] = value;
}
```

### Debugging Tips

1. **Log config operations**:
```typescript
get(key: string) {
  console.log('Getting config:', key);
  return this.config[key];
}
```

2. **Inspect storage calls**:
```typescript
const calls = mockStorage.local.set.mock.calls;
console.log('Storage.set called with:', calls);
```

3. **Test round-trip**:
```typescript
const manager = new DesignerConfigManager();
manager.set('enabled', true);
await manager.save();
await manager.load();
expect(manager.get('enabled')).toBe(true);
```

---

**Last Updated**: October 28, 2025
