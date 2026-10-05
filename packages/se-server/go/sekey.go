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

	"github.com/totem-sdk/core-ffi"
	"golang.org/x/crypto/sha3"
)

const reclaimEncKeyInfo = "statechain-reclaim-tx-v1"

// ErrNotInteroperable is retained for compatibility. It is no longer returned
// by seSign/wotsVerifyDigest, which now use the byte-exact WOTS engine
// (RFC-033, via cgo) instead of failing closed.
var ErrNotInteroperable = errors.New("se-server(go): not an interoperable WOTS SE (AUD-045); use the TypeScript SE")

// seSign is retained for owner-signature helpers that verify flat WOTS. The SE's
// own signing (blind-sign / claim) uses the leased one-time identity in
// `seidentity.go` (RFC-008), not this flat primitive.
func seSign(seed, commitmentBytes []byte) ([]byte, error) {
	return totemcrypto.Sign(seed, 0, commitmentBytes)
}

// wotsVerifyDigest verifies a flat WOTS signature over `message` against a
// 32-byte public-key digest (RFC-033). Used for owner request authentication.
func wotsVerifyDigest(sig, message, pkDigest []byte) bool {
	return totemcrypto.VerifyDigest(sig, message, pkDigest)
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
