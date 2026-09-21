package seserver

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/sha3"
)

const reclaimEncKeyInfo = "statechain-reclaim-tx-v1"

// ErrNotInteroperable marks the Go SE signing/identity surface as disabled
// (AUD-045). This package is NOT a WOTS-compatible SE: the TypeScript
// `@totemsdk/se-server` is the supported implementation. Until real
// interoperable WOTS (with cross-language known-answer tests) lands here, the
// signer/verifier fail closed rather than emitting placeholder cryptography
// that a peer could mistake for a valid SE signature.
var ErrNotInteroperable = errors.New("se-server(go): not an interoperable WOTS SE (AUD-045); use the TypeScript SE")

// getPublicKeyHex returns the (non-interoperable) legacy hash. It is retained
// only so the reference server still compiles; it is NOT the SE signing key and
// MUST NOT be treated as an SE identity. See ErrNotInteroperable.
func getPublicKeyHex(seed []byte) string {
	h := sha3.New256()
	h.Write(append(seed, 0, 0, 0, 0))
	return hex.EncodeToString(h.Sum(nil))
}

// seSign is disabled (AUD-045). The previous implementation returned an
// HMAC-SHA256 value, which is not a WOTS signature and must never be presented
// as one.
func seSign(seed, commitmentBytes []byte) ([]byte, error) {
	return nil, ErrNotInteroperable
}

// wotsVerifyDigest is disabled (AUD-045): never accept a non-WOTS signature.
func wotsVerifyDigest(sig, message, pkDigest []byte) bool {
	return false
}

func getReclaimEncKey(seed []byte) []byte {
	mac := hmac.New(sha256.New, seed)
	mac.Write([]byte(reclaimEncKeyInfo))
	return mac.Sum(nil)
}

func encryptReclaimTx(seed []byte, reclaimTxHex string) (string, error) {
	key := getReclaimEncKey(seed)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	ciphertext := aesgcm.Seal(nil, iv, []byte(reclaimTxHex), nil)
	return fmt.Sprintf("enc:%s.%s", hex.EncodeToString(iv), hex.EncodeToString(ciphertext)), nil
}

func decryptReclaimTx(seed []byte, enc string) (string, error) {
	if !strings.HasPrefix(enc, "enc:") {
		return enc, nil
	}

	parts := strings.SplitN(enc[4:], ".", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid encrypted reclaim tx format")
	}

	iv, err := hex.DecodeString(parts[0])
	if err != nil {
		return "", err
	}
	ciphertext, err := hex.DecodeString(parts[1])
	if err != nil {
		return "", err
	}

	key := getReclaimEncKey(seed)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := aesgcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}

func buildStatechainScript(sePkd string, reclaimTimelock int) string {
	kissHex := "0X" + strings.ToUpper(strings.TrimPrefix(sePkd, "0x"))
	return strings.Join([]string{
		"LET OWNER=STATE(0)",
		fmt.Sprintf("IF @COINAGE GTE %d THEN", reclaimTimelock),
		"  RETURN SIGNEDBY(OWNER)",
		"ENDIF",
		fmt.Sprintf("ASSERT MULTISIG(2 OWNER %s)", kissHex),
		"RETURN TRUE",
	}, "\n")
}

func scriptAddress(script string) string {
	h := sha3.New256()
	h.Write([]byte(strings.TrimSpace(strings.ToUpper(script))))
	return hex.EncodeToString(h.Sum(nil))
}
