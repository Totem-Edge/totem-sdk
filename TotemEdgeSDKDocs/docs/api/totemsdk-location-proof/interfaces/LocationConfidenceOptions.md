[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / LocationConfidenceOptions

# Interface: LocationConfidenceOptions

## Properties

### accuracyThresholdM?

> `optional` **accuracyThresholdM?**: `number`

accuracyM at or below this value is considered strong (default 10m)

***

### maxAgeMs?

> `optional` **maxAgeMs?**: `number`

a claim older than maxAgeMs is considered stale (default 300_000)

***

### now?

> `optional` **now?**: `number`

explicit "now" timestamp for deterministic scoring (default Date.now())

***

### strongHdop?

> `optional` **strongHdop?**: `number`

HDOP at or below this value is considered low (default 2)

***

### strongSatellites?

> `optional` **strongSatellites?**: `number`

satellite count at or above this value is considered strong (default 8)

***

### weakAccuracyThresholdM?

> `optional` **weakAccuracyThresholdM?**: `number`

accuracyM above this value is considered weak (default 3x accuracyThresholdM)
