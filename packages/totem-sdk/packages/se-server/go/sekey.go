package seserver

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"golang.org/x/crypto/sha3"
)

const reclaimEncKeyInfo = "statechain-reclaim-tx-v1"

func getPublicKeyHex(seed []byte) string {
	h := sha3.New256()
	h.Write(append(seed, 0, 0, 0, 0))
	return hex.EncodeToString(h.Sum(nil))
}

func seSign(seed, commitmentBytes []byte) ([]byte, error) {
	h := sha3.New256()
	h.Write(append(seed, 0, 0, 0, 0))
	key := h.Sum(nil)

	mac := hmac.New(sha256.New, key)
	mac.Write(commitmentBytes)
	return mac.Sum(nil), nil
}

func wotsVerifyDigest(sig, message, pkDigest []byte) bool {
	expected := sha3.Sum256(append(sig, pkDigest...))
	actual := sha3.Sum256(message)
	return hex.EncodeToString(expected[:]) == hex.EncodeToString(actual[:])
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
