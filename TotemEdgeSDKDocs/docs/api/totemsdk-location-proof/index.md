**@totemsdk/location-proof**

***

# @totemsdk/location-proof

## Interfaces

- [CreateLocationProofParams](interfaces/CreateLocationProofParams.md)
- [CreateMovementTrailParams](interfaces/CreateMovementTrailParams.md)
- [GeoPoint](interfaces/GeoPoint.md)
- [ImpossibleJumpResult](interfaces/ImpossibleJumpResult.md)
- [LocationChallenge](interfaces/LocationChallenge.md)
- [LocationClaim](interfaces/LocationClaim.md)
- [LocationConfidenceOptions](interfaces/LocationConfidenceOptions.md)
- [LocationConfidenceResult](interfaces/LocationConfidenceResult.md)
- [LocationCorroboration](interfaces/LocationCorroboration.md)
- [LocationProofVerifyResult](interfaces/LocationProofVerifyResult.md)
- [LocationSource](interfaces/LocationSource.md)
- [LocationValidationResult](interfaces/LocationValidationResult.md)
- [MotionOptions](interfaces/MotionOptions.md)
- [MotionSample](interfaces/MotionSample.md)
- [MovementTrail](interfaces/MovementTrail.md)

## Type Aliases

- [DeviceClass](type-aliases/DeviceClass.md)
- [LocationSourceType](type-aliases/LocationSourceType.md)

## Functions

- [addLocationClaimToGraph](functions/addLocationClaimToGraph.md)
- [addLocationProofToGraph](functions/addLocationProofToGraph.md)
- [canonicalJson](functions/canonicalJson.md)
- [computeLocationClaimId](functions/computeLocationClaimId.md)
- [computeMovementTrailId](functions/computeMovementTrailId.md)
- [computeSpeedMps](functions/computeSpeedMps.md)
- [createLocationClaim](functions/createLocationClaim.md)
- [createMovementTrail](functions/createMovementTrail.md)
- [createUnsignedLocationProof](functions/createUnsignedLocationProof.md)
- [detectImpossibleJumps](functions/detectImpossibleJumps.md)
- [distanceMeters](functions/distanceMeters.md)
- [hashLocationClaim](functions/hashLocationClaim.md)
- [hashMovementTrail](functions/hashMovementTrail.md)
- [isChallengeExpired](functions/isChallengeExpired.md)
- [locationClaimToEvidenceRef](functions/locationClaimToEvidenceRef.md)
- [locationClaimToProofGraphNode](functions/locationClaimToProofGraphNode.md)
- [locationProofToGraphEdges](functions/locationProofToGraphEdges.md)
- [movementTrailToEvidenceRef](functions/movementTrailToEvidenceRef.md)
- [scoreLocationClaim](functions/scoreLocationClaim.md)
- [signLocationProof](functions/signLocationProof.md)
- [signLocationProofWithLease](functions/signLocationProofWithLease.md)
- [toHex](functions/toHex.md)
- [validateGeoPoint](functions/validateGeoPoint.md)
- [validateLocationClaim](functions/validateLocationClaim.md)
- [validateMovementTrail](functions/validateMovementTrail.md)
- [verifyLocationProof](functions/verifyLocationProof.md)
