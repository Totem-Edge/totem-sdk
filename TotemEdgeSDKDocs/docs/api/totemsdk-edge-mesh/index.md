**@totemsdk/edge-mesh**

***

**Maturity: beta**

# @totemsdk/edge-mesh

## Classes

- [Fragmenter](classes/Fragmenter.md)
- [FrameTooLargeError](classes/FrameTooLargeError.md)
- [InvalidStreamFrameError](classes/InvalidStreamFrameError.md)
- [MeshError](classes/MeshError.md)
- [MtuTooSmallError](classes/MtuTooSmallError.md)
- [Reassembler](classes/Reassembler.md)
- [StoreAndForward](classes/StoreAndForward.md)
- [StreamFramer](classes/StreamFramer.md)
- [TooManyFragmentsError](classes/TooManyFragmentsError.md)
- [VirtualLink](classes/VirtualLink.md)

## Interfaces

- [AssembledFrame](interfaces/AssembledFrame.md)
- [MeshLink](interfaces/MeshLink.md)
- [PacketHeader](interfaces/PacketHeader.md)
- [RelayedFrame](interfaces/RelayedFrame.md)

## Type Aliases

- [MeshErrorCode](type-aliases/MeshErrorCode.md)
- [MeshRejectReason](type-aliases/MeshRejectReason.md)
- [MeshRejectSink](type-aliases/MeshRejectSink.md)

## Variables

- [ATT\_OVERHEAD](variables/ATT_OVERHEAD.md)
- [HEADER\_BYTES](variables/HEADER_BYTES.md)
- [LENGTH\_PREFIX\_BYTES](variables/LENGTH_PREFIX_BYTES.md)
- [MAGIC](variables/MAGIC.md)
- [MAX\_FRAME\_BYTES](variables/MAX_FRAME_BYTES.md)
- [MAX\_PENDING\_MESSAGES](variables/MAX_PENDING_MESSAGES.md)
- [MAX\_STREAM\_FRAME](variables/MAX_STREAM_FRAME.md)
- [VERSION](variables/VERSION.md)

## Functions

- [crc16](functions/crc16.md)
- [decodeHeader](functions/decodeHeader.md)
- [encodeHeader](functions/encodeHeader.md)
- [frameHash](functions/frameHash.md)
- [headerRejectReason](functions/headerRejectReason.md)
- [makeFrame](functions/makeFrame.md)
