[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / GnssFix

# Interface: GnssFix

## Properties

### accuracyM?

> `optional` **accuracyM?**: `number`

***

### altitudeM?

> `optional` **altitudeM?**: `number`

***

### fixType

> **fixType**: [`GnssFixType`](../type-aliases/GnssFixType.md)

***

### hdop?

> `optional` **hdop?**: `number`

***

### headingDeg?

> `optional` **headingDeg?**: `number`

***

### lat

> **lat**: `number`

WGS-84 latitude in degrees.

***

### lon

> **lon**: `number`

WGS-84 longitude in degrees.

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### nmea?

> `optional` **nmea?**: `string`[]

Optional NMEA sentences that produced this fix.

***

### observedAt

> **observedAt**: `number`

Observation time in ms since epoch.

***

### pdop?

> `optional` **pdop?**: `number`

***

### raw?

> `optional` **raw?**: `Uint8Array`\<`ArrayBufferLike`\>

Optional raw receiver payload.

***

### satellitesUsed?

> `optional` **satellitesUsed?**: `number`

***

### source

> **source**: `string`

Source label, e.g. gnss, gps, rtk, cell, wifi.

***

### speedMps?

> `optional` **speedMps?**: `number`

***

### vdop?

> `optional` **vdop?**: `number`
