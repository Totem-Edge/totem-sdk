[**@totemsdk/edge-gnss**](../index.md)

***

[@totemsdk/edge-gnss](../index.md) / GnssFixType

# Type Alias: GnssFixType

> **GnssFixType** = `"none"` \| `"2d"` \| `"3d"` \| `"dgps"` \| `"rtk-float"` \| `"rtk-fixed"` \| `"estimated"`

GNSS transport port — injected by the caller.

The connector owns fix validation, NMEA parsing and proof shaping. The
caller supplies the receiver binding: a serial NMEA reader, a modem AT
interface, a phone location API, or a simulator.
