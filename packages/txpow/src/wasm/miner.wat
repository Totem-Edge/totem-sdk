;;
;; miner.wat — WebAssembly Text Format source for the TxPoW mining loop.
;;
;; This module is the canonical, human-readable source for miner.wasm.
;; To recompile: node scripts/compile-wasm.js
;;   (uses the `wabt` npm package — no Emscripten required)
;;
;; Architecture:
;;   SHA3-256 is provided by the host JavaScript engine (via @noble/hashes).
;;   WASM owns: nonce iteration, big-endian byte writing, 256-bit comparison.
;;   This keeps the binary small and removes the need for a WASM SHA3 impl.
;;
;; Memory layout (must be respected by the JS caller):
;;   [0  .. 31 ] — hash output buffer (written by the host sha3_256 call)
;;   [32 .. 32+headerLen-1] — header buffer  (caller writes here)
;;   [32+headerLen .. 32+headerLen+31] — target buffer (caller writes here)
;;
;; WASM interface:
;;   mine(headerPtr, headerLen, nonceOffset, nonceLen, targetPtr,
;;        startNonce, chunkSize) → i32
;;
;; mine() returns the found nonce (0..N), or -1 (= 0xFFFFFFFF as i32) if no
;; valid nonce was found in the requested chunk.
;;
;; Host import:
;;   env.sha3_256(headerPtr: i32, headerLen: i32, outPtr: i32)
;;     Reads header bytes from WASM linear memory at [headerPtr..headerPtr+headerLen).
;;     Writes 32-byte SHA3-256 digest to WASM linear memory at [outPtr..outPtr+32).
;;

(module
  ;; ── Host import ────────────────────────────────────────────────────────────
  ;; JavaScript provides sha3_256 from @noble/hashes.
  ;; Reads/writes directly in WASM linear memory (zero-copy via Uint8Array view).
  (import "env" "sha3_256" (func $sha3_256 (param i32 i32 i32)))

  ;; ── Memory ─────────────────────────────────────────────────────────────────
  ;; One 64 KB page is sufficient for all TxHeaders (< 512 bytes).
  (memory (export "memory") 1)

  ;; ── mine ───────────────────────────────────────────────────────────────────
  (func (export "mine")
    ;;
    ;; Parameters (indices 0..6):
    ;;   headerPtr   — byte offset of the header in linear memory (must be ≥ 32)
    ;;   headerLen   — byte length of the header
    ;;   nonceOffset — byte offset of the nonce VALUE within the header
    ;;                 (= 2, after the MiniNumber scale and length bytes)
    ;;   nonceLen    — byte length of the nonce value (1 byte for nonce 0-127, etc.)
    ;;   targetPtr   — byte offset of the 32-byte difficulty target in linear memory
    ;;   startNonce  — first nonce value to try (unsigned 32-bit)
    ;;   chunkSize   — number of consecutive nonces to try
    ;;
    (param $headerPtr   i32)
    (param $headerLen   i32)
    (param $nonceOffset i32)
    (param $nonceLen    i32)
    (param $targetPtr   i32)
    (param $startNonce  i32)
    (param $chunkSize   i32)
    (result i32)

    ;; Locals (indices 7..13):
    (local $n        i32)  ;; current nonce value
    (local $endNonce i32)  ;; exclusive upper bound = startNonce + chunkSize
    (local $byteIdx  i32)  ;; byte-loop index (reused for nonce write + cmp)
    (local $tmp      i32)  ;; scratch: nonce value shifted down during byte write
    (local $lt       i32)  ;; 1 if hash < target; 0 otherwise
    (local $hb       i32)  ;; hash byte for comparison
    (local $tb       i32)  ;; target byte for comparison

    ;; n = startNonce
    local.get $startNonce
    local.set $n

    ;; endNonce = startNonce + chunkSize
    local.get $startNonce
    local.get $chunkSize
    i32.add
    local.set $endNonce

    ;; ── Outer loop: iterate nonces ──────────────────────────────────────────
    block $done
      loop $outer

        ;; Exit if n >= endNonce
        local.get $n
        local.get $endNonce
        i32.ge_u
        br_if $done

        ;; ── Write nonce big-endian to header[nonceOffset..nonceOffset+nonceLen) ──
        local.get $n
        local.set $tmp                    ;; tmp = n

        local.get $nonceLen
        i32.const 1
        i32.sub
        local.set $byteIdx               ;; byteIdx = nonceLen - 1

        block $write_done
          loop $write
            ;; Exit when byteIdx < 0
            local.get $byteIdx
            i32.const 0
            i32.lt_s
            br_if $write_done

            ;; mem[headerPtr + nonceOffset + byteIdx] = tmp & 0xFF
            local.get $headerPtr
            local.get $nonceOffset
            i32.add
            local.get $byteIdx
            i32.add
            local.get $tmp
            i32.const 255
            i32.and
            i32.store8

            ;; tmp >>= 8
            local.get $tmp
            i32.const 8
            i32.shr_u
            local.set $tmp

            ;; byteIdx--
            local.get $byteIdx
            i32.const 1
            i32.sub
            local.set $byteIdx

            br $write
          end
        end

        ;; ── Compute SHA3-256 via host import ─────────────────────────────────
        ;; Result written to linear memory at offset 0 (hash output buffer).
        local.get $headerPtr
        local.get $headerLen
        i32.const 0                       ;; hash output at offset 0
        call $sha3_256

        ;; ── Compare mem[0..32) < mem[targetPtr..targetPtr+32) ────────────────
        i32.const 0
        local.set $lt                    ;; lt = 0 (not less than, by default)
        i32.const 0
        local.set $byteIdx              ;; byteIdx = 0

        block $cmp_done
          loop $cmp
            ;; All 32 bytes equal ⟹ hash == target ⟹ not less than
            local.get $byteIdx
            i32.const 32
            i32.ge_u
            br_if $cmp_done

            ;; hb = mem[byteIdx]          (hash byte)
            local.get $byteIdx
            i32.load8_u
            local.set $hb

            ;; tb = mem[targetPtr + byteIdx]  (target byte)
            local.get $targetPtr
            local.get $byteIdx
            i32.add
            i32.load8_u
            local.set $tb

            ;; if hb < tb: lt=1, jump out of comparison loop
            block $not_lt
              local.get $hb
              local.get $tb
              i32.ge_u
              br_if $not_lt             ;; hb >= tb → skip
              i32.const 1
              local.set $lt
              br $cmp_done
            end

            ;; if hb > tb: lt stays 0, jump out of comparison loop
            local.get $hb
            local.get $tb
            i32.gt_u
            br_if $cmp_done

            ;; hb == tb: advance to next byte
            local.get $byteIdx
            i32.const 1
            i32.add
            local.set $byteIdx

            br $cmp
          end
        end

        ;; ── If hash < target: return the found nonce ─────────────────────────
        local.get $lt
        if
          local.get $n
          return
        end

        ;; n++
        local.get $n
        i32.const 1
        i32.add
        local.set $n

        br $outer
      end
    end

    ;; Not found in this chunk: return 0xFFFFFFFF
    i32.const -1
  )
)
