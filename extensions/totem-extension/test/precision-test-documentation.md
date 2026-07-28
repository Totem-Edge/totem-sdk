# Minima Precision Utilities (44 Decimals) - Test Documentation

**Test Suite**: Minima Precision Utilities  
**Component**: totem-extension  
**Type**: Unit  
**Framework**: Jest

## Purpose

This test suite validates the precision handling utilities that manage Minima's **44-decimal precision** requirement. Minima uses extremely high precision to avoid floating-point errors in financial calculations.

## Background

Minima requires 44-decimal precision for all token amounts. Standard JavaScript `Number` type only supports ~15-16 decimal digits safely, which causes catastrophic precision loss.

**Example of the Problem:**
```javascript
// ❌ WRONG - JavaScript Number loses precision
const amount = 0.123456789012345678901234567890123456789012345; 
console.log(amount); 
// Output: 0.12345678901234568 (precision lost after ~16 digits!)
```

**Solution:**
This test validates utilities that use:
- `BigInt` for integer arithmetic
- String representation for exact decimal values
- Custom parsing/formatting functions

## Test Coverage

### String to BigInt Conversion
- Tests parsing 44-decimal strings into BigInt (scaled by 10^44)
- Validates handling of edge cases (0, max values, negative numbers)
- Ensures no precision loss during conversion

### BigInt to String Conversion
- Tests formatting BigInt back to human-readable 44-decimal strings
- Validates proper decimal point placement
- Tests trailing zero handling

### Arithmetic Operations
- Addition/subtraction with 44-decimal precision
- Multiplication/division without overflow
- Comparison operations

### Edge Cases
- Maximum safe Minima amount
- Minimum non-zero amount (0.00000000000000000000000000000000000000000001)
- Zero handling
- Negative amounts (if applicable)

## Running the Tests

```bash
cd packages/totem-extension
pnpm test test/precision.test.ts
```

## Expected Outcomes

All tests should pass, demonstrating:
- ✅ Perfect 44-decimal precision maintained
- ✅ No floating-point rounding errors
- ✅ Correct arithmetic results
- ✅ Proper string formatting

## Common Issues

### Precision Loss Detected
- Check that all operations use BigInt, not Number
- Verify string parsing doesn't truncate decimals
- Ensure division uses proper scaling

### Overflow Errors
- Validate that amounts don't exceed Minima's max supply
- Check for integer overflow in multiplication
- Use safe arithmetic helpers

## References

- [Minima Precision Spec](https://docs.minima.global/docs/learn/coins#precision)
- [JavaScript BigInt Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)

## Last Updated
October 28, 2025
