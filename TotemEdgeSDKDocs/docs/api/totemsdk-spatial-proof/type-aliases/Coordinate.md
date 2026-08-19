[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / Coordinate

# Type Alias: Coordinate

> **Coordinate** = \[`number`, `number`\]

@totemsdk/spatial-proof — Type definitions

Pure schema for geospatial relationship proofs.

COORDINATE ORDER: GeoJSON order — [longitude, latitude] in decimal degrees
(WGS84 / EPSG:4326). This is the opposite of "lat, lon". All geometry
functions and hashes in this package assume [lon, lat].

No network, no storage, no map rendering, no GIS engine dependency.
