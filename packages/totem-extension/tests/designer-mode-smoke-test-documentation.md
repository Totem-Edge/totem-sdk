# Designer Mode Smoke Test Suite

| Property | Value |
|----------|-------|
| **Component** | Designer Mode Feature Detection |
| **Type** | Smoke Test |
| **Framework** | Jest |

## Purpose

This smoke test suite validates the basic functionality of Designer Mode in the Totem Extension. It ensures that:

1. **Designer Mode Loads** without errors or crashes
2. **Basic Functionality** is operational (config reading, UI rendering)
3. **Environment Detection** correctly identifies designer mode context
4. **Critical Paths** are not broken after code changes
5. **Fast Feedback** - Quick validation before running full test suite

This is a smoke test, meaning it provides rapid feedback on whether Designer Mode is fundamentally working, without exhaustively testing every feature.

## Test Design

The test suite follows smoke testing principles - shallow but broad coverage:

### Test Strategy
```
Quick Checks (< 5 seconds total)
├── Import doesn't throw
├── Config can be loaded
├── Designer mode flag detectable
└── No critical errors in console
```

### Coverage Scope
- ✅ Module imports successfully
- ✅ Basic initialization
- ✅ Config access
- ❌ NOT testing: Full feature workflows
- ❌ NOT testing: Edge cases
- ❌ NOT testing: Error scenarios

## Pass Requirements

For tests to pass:

1. **Designer Mode module** must import without errors
2. **Configuration loading** must succeed
3. **isDesignerMode flag** must be readable (true/false)
4. **No uncaught exceptions** during basic initialization
5. **Tests complete** in under 5 seconds

## Test Coverage

### Import Tests
```typescript
✓ DesignerMode module imports successfully
✓ No syntax errors in module
✓ Exports are defined
```

### Configuration Tests
```typescript
✓ Can read designer mode config
✓ Config has expected structure
✓ Default values present
```

### Feature Flag Tests
```typescript
✓ isDesignerMode() returns boolean
✓ Designer mode can be detected
```

### Initialization Tests
```typescript
✓ Designer mode initializes without errors
✓ No critical warnings logged
```

## Prerequisites

### Environment
- Node.js runtime (v18+)
- Jest test framework

### Dependencies
- Designer Mode module
- Configuration system

### Configuration
No special configuration needed for smoke tests.

## Running the Tests

### Run this specific test file:
```bash
cd packages/totem-extension
npm test tests/designer-mode-smoke.test.ts
```

### Run as part of CI quick checks:
```bash
cd packages/totem-extension
npm run test:smoke
```

### Run with minimal output:
```bash
cd packages/totem-extension
npm test -- --silent tests/designer-mode-smoke.test.ts
```

## Expected Outcomes

### When All Tests Pass

```
PASS  tests/designer-mode-smoke.test.ts
  Designer Mode Smoke Tests
    ✓ imports without errors (2ms)
    ✓ can read config (1ms)
    ✓ isDesignerMode returns boolean (1ms)
    ✓ initializes without errors (1ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Time:        0.8s
```

### What Passing Tests Indicate
- ✅ Designer Mode module is not critically broken
- ✅ Safe to run more comprehensive tests
- ✅ Basic functionality operational
- ⚠️  Does NOT guarantee full functionality

## Common Issues

### Issue: "imports without errors" fails
**Cause**: Syntax error or missing dependency  
**Solution**: Check import statement and dependencies:
```typescript
// Test
import { DesignerMode } from '../src/designer-mode';

// If fails, check:
// 1. File exists at correct path
// 2. Export is correct in source
// 3. TypeScript compiled successfully
```

### Issue: "can read config" fails
**Cause**: Config file missing or malformed  
**Solution**: Ensure config exists:
```typescript
// designer-config.json should exist
{
  "enabled": true,
  "features": ["dev-tools", "debug-panel"]
}
```

### Issue: All tests pass but feature doesn't work
**Cause**: Smoke tests only check basics  
**Solution**: Run full test suite:
```bash
npm test tests/designer-mode.test.ts  # Full tests
```

### Debugging Tips

1. **Run in verbose mode**:
```bash
npm test -- --verbose tests/designer-mode-smoke.test.ts
```

2. **Check what's being imported**:
```typescript
import * as DesignerMode from '../src/designer-mode';
console.log('Exports:', Object.keys(DesignerMode));
```

3. **Verify config path**:
```typescript
const fs = require('fs');
const configPath = './designer-config.json';
console.log('Config exists:', fs.existsSync(configPath));
```

---

**Last Updated**: October 28, 2025
