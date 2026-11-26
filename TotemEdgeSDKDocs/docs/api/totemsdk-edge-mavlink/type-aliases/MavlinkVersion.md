[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkVersion

# Type Alias: MavlinkVersion

> **MavlinkVersion** = `1` \| `2`

MAVLink 1/2 framing and common-message decoding.

Frame checksums use the MAVLink X25 CRC plus the per-message CRC_EXTRA byte.
MAVLink 2 signed frames are accepted; the 13-byte signature is carried but
not verified here (signing policy belongs to the caller).
