[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / RasterSpatialMetadata

# Interface: RasterSpatialMetadata

Spatial context for a raster asset. Bounds are GeoJSON order:
[minLon, minLat, maxLon, maxLat] (WGS84 / EPSG:4326).

## Properties

### bounds?

> `optional` **bounds?**: \[`number`, `number`, `number`, `number`\]

***

### crs?

> `optional` **crs?**: `string`

***

### geometryHash?

> `optional` **geometryHash?**: `string`

totem:geo:<hex> hash of the footprint geometry (via @totemsdk/spatial-proof).

***

### heightPx?

> `optional` **heightPx?**: `number`

***

### resolutionM?

> `optional` **resolutionM?**: `number`

***

### spatialObjectId?

> `optional` **spatialObjectId?**: `string`

totem:spatial:<hex> spatial object ID the footprint maps to.

***

### widthPx?

> `optional` **widthPx?**: `number`
