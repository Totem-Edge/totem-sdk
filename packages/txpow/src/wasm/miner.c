/**
 * miner.c — SHA3-256 proof-of-work mining loop for WASM compilation.
 *
 * Compile (requires Emscripten):
 *   emcc -O3 -o miner.wasm miner.c \
 *     -s WASM=1 -s SIDE_MODULE=1 \
 *     -s EXPORTED_FUNCTIONS='["_mine","_malloc","_free"]' \
 *     --no-entry
 *
 * Or set EMSCRIPTEN env var and run: npm run build:wasm
 *
 * WASM interface:
 *   uint32_t mine(
 *     uint8_t* header,       // header buffer in WASM linear memory
 *     int      headerLen,    // total header length
 *     int      nonceOffset,  // byte offset of nonce VALUE (= 2, after scale+len)
 *     int      nonceLen,     // byte length of nonce value (1, 2, or 3)
 *     uint8_t* target,       // 32-byte target in WASM linear memory
 *     uint32_t startNonce,   // first nonce to try
 *     uint32_t chunkSize     // number of hashes to attempt
 *   )
 * Returns: found nonce (0 = found at nonce 0, 0xFFFFFFFF = not found in chunk)
 *
 * SHA3-256 implementation: keccak-tiny (public domain, David Leon Gil, 2015)
 * Inlined here so the WASM binary has no external dependencies.
 */

#include <stdint.h>
#include <string.h>

/* ── keccak-tiny ─────────────────────────────────────────────────────────── */

#define SHA3_256_RATE 136
#define SHA3_256_CAP  64

static const uint64_t KECCAK_ROUND_CONSTANTS[24] = {
  0x0000000000000001ULL, 0x0000000000008082ULL, 0x800000000000808AULL,
  0x8000000080008000ULL, 0x000000000000808BULL, 0x0000000080000001ULL,
  0x8000000080008081ULL, 0x8000000000008009ULL, 0x000000000000008AULL,
  0x0000000000000088ULL, 0x0000000080008009ULL, 0x000000008000000AULL,
  0x000000008000808BULL, 0x800000000000008BULL, 0x8000000000008089ULL,
  0x8000000000008003ULL, 0x8000000000008002ULL, 0x8000000000000080ULL,
  0x000000000000800AULL, 0x800000008000000AULL, 0x8000000080008081ULL,
  0x8000000000008080ULL, 0x0000000080000001ULL, 0x8000000080008008ULL,
};

static const int KECCAK_RHO[24] = {
  1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15,
  21, 8, 18, 2, 61, 56, 14
};
static const int KECCAK_PI[24] = {
  10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12,
  2, 20, 14, 22, 9, 6, 1
};

#define ROL64(a, b) (((a) << (b)) | ((a) >> (64 - (b))))

static void keccak_f(uint64_t* state) {
  for (int round = 0; round < 24; round++) {
    uint64_t C[5], D[5], tmp;
    for (int x = 0; x < 5; x++)
      C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
    for (int x = 0; x < 5; x++) {
      D[x] = C[(x+4)%5] ^ ROL64(C[(x+1)%5], 1);
      for (int y = 0; y < 5; y++) state[x + y*5] ^= D[x];
    }
    tmp = state[1];
    for (int i = 0; i < 24; i++) {
      int j = KECCAK_PI[i];
      uint64_t t = state[j];
      state[j] = ROL64(tmp, KECCAK_RHO[i]);
      tmp = t;
    }
    for (int y = 0; y < 5; y++) {
      uint64_t lane[5];
      for (int x = 0; x < 5; x++) lane[x] = state[x + y*5];
      for (int x = 0; x < 5; x++)
        state[x + y*5] = lane[x] ^ (~lane[(x+1)%5] & lane[(x+2)%5]);
    }
    state[0] ^= KECCAK_ROUND_CONSTANTS[round];
  }
}

static void sha3_256_hash(const uint8_t* msg, int msgLen, uint8_t* out) {
  uint64_t state[25];
  memset(state, 0, sizeof(state));

  uint8_t buf[SHA3_256_RATE];
  int absorbed = 0;

  while (msgLen > 0) {
    int take = msgLen < SHA3_256_RATE ? msgLen : SHA3_256_RATE;
    if (absorbed + take < SHA3_256_RATE) {
      memcpy(buf + absorbed, msg, take);
      absorbed += take;
      msgLen -= take;
      msg += take;
    } else {
      memcpy(buf + absorbed, msg, SHA3_256_RATE - absorbed);
      for (int i = 0; i < SHA3_256_RATE; i++)
        ((uint8_t*)state)[i] ^= buf[i];
      keccak_f(state);
      absorbed = 0;
      msg += (SHA3_256_RATE - absorbed + take - (SHA3_256_RATE - absorbed));
      msgLen -= take;
    }
  }

  /* Padding: SHA-3 domain = 0x06, last byte 0x80 */
  memset(buf + absorbed, 0, SHA3_256_RATE - absorbed);
  buf[absorbed] = 0x06;
  buf[SHA3_256_RATE - 1] ^= 0x80;
  for (int i = 0; i < SHA3_256_RATE; i++)
    ((uint8_t*)state)[i] ^= buf[i];
  keccak_f(state);

  memcpy(out, state, 32);
}

/* ── Mining export ────────────────────────────────────────────────────────── */

/**
 * Mine a chunk: iterate nonce from startNonce to startNonce+chunkSize−1.
 * Write the nonce big-endian into header[nonceOffset..nonceOffset+nonceLen).
 * Hash the header with SHA3-256 and compare to target (32 bytes).
 *
 * Returns the found nonce, or 0xFFFFFFFF if not found in this chunk.
 *
 * NOTE: nonce value is written big-endian. For nonce 0: all zero bytes.
 *       The caller ensures startNonce..startNonce+chunkSize stay within
 *       the current MiniNumber encoding length boundary.
 */
__attribute__((used))
uint32_t mine(
  uint8_t* header,
  int      headerLen,
  int      nonceOffset,
  int      nonceLen,
  uint8_t* target,
  uint32_t startNonce,
  uint32_t chunkSize
) {
  uint8_t hash[32];

  for (uint32_t n = startNonce; n < startNonce + chunkSize; n++) {
    /* Write nonce big-endian */
    uint32_t tmp = n;
    for (int i = nonceLen - 1; i >= 0; i--) {
      header[nonceOffset + i] = (uint8_t)(tmp & 0xFF);
      tmp >>= 8;
    }

    sha3_256_hash(header, headerLen, hash);

    /* Big-endian 256-bit compare: hash < target? */
    int lt = 0;
    for (int i = 0; i < 32; i++) {
      if (hash[i] < target[i]) { lt = 1; break; }
      if (hash[i] > target[i]) { lt = 0; break; }
    }
    if (lt) return n;
  }

  return 0xFFFFFFFFU;
}
