package omniarouter

import (
	"crypto/rand"
	"math/big"

	"golang.org/x/crypto/sha3"
)

func BuildPaymentRequest(amount, tokenID, expiryBlock, description string) (*PaymentRequest, error) {
	preimageBytes := make([]byte, 32)
	_, err := rand.Read(preimageBytes)
	if err != nil {
		return nil, err
	}

	preimage := "0x" + hexEncode(preimageBytes)

	hash := sha3.New256()
	hash.Write(preimageBytes)
	hashlock := "0x" + hexEncode(hash.Sum(nil))

	return &PaymentRequest{
		Hashlock:    hashlock,
		Preimage:    preimage,
		Amount:      amount,
		TokenID:     tokenID,
		ExpiryBlock: expiryBlock,
		Description: description,
	}, nil
}

func BuildCrossTokenRequest(amountOut, tokenOut, expiryBlock, description string) (*PaymentRequest, error) {
	return BuildPaymentRequest(amountOut, tokenOut, expiryBlock, description)
}

func hexEncode(data []byte) string {
	const hexChars = "0123456789abcdef"
	result := make([]byte, len(data)*2)
	for i, b := range data {
		result[i*2] = hexChars[b>>4]
		result[i*2+1] = hexChars[b&0x0f]
	}
	return string(result)
}

func init() {
	_ = big.NewInt(0)
}
