[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / RasterSourceType

# Type Alias: RasterSourceType

> **RasterSourceType** = `"satellite"` \| `"drone"` \| `"camera"` \| `"robot-camera"` \| `"thermal-camera"` \| `"lidar-derived"` \| `"radar"` \| `"map-tile"` \| `"derived"` \| `"manual-import"` \| `"other"`

@totemsdk/raster-proof — Type definitions

Pure schema for raster and visual evidence proofs.

This package proves bytes, manifests, provenance, windows and declared
relationships. It does NOT process raster bytes — no decoding, no GDAL,
no cloud masking, no NDVI, no ML. It only hashes bytes and records the
metadata that makes them verifiable.

No network, no storage, no map rendering, no GIS engine dependency.
