[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildExerciseCovenant

# Function: buildExerciseCovenant()

> **buildExerciseCovenant**(`config`): `string`

Build the P-EXIT exercise/settlement covenant script.

Layout:
```
  exercise: IF <condition> THEN [IF SIGNEDBY(beneficiary) THEN]
              ASSERT VERIFYOUT(0 beneficiary payout|@AMOUNT tokenId FALSE)
              IF payout < @AMOUNT THEN RETURN VERIFYOUT(1 remainder @AMOUNT-payout tokenId TRUE) ENDIF
              RETURN TRUE
            [ENDIF] ENDIF
  recovery: IF @BLOCK GTE recovery THEN
              ASSERT VERIFYOUT(0 recovery @AMOUNT tokenId FALSE); RETURN TRUE
            ENDIF
  RETURN FALSE
```

## Parameters

### config

[`ExerciseCovenantConfig`](../interfaces/ExerciseCovenantConfig.md)

## Returns

`string`
