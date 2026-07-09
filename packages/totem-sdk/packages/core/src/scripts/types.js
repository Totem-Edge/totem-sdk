function kissHex(hex) {
    const raw = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
    return '0x' + raw.toUpperCase();
}
export function convertFlatChunkToSDK(chunk) {
    return {
        isLeft: chunk.isLeft,
        mmrData: { data: chunk.data, value: 0n }
    };
}
export function convertLegacyProofToSDK(legacy) {
    return {
        proof: {
            chunks: legacy.proofChain.map(convertFlatChunkToSDK)
        },
        blockTime: legacy.blockTime
    };
}
export function createEmptyMMRProof() {
    return { chunks: [] };
}
export function createSignedByDescriptor(address, wotsRootPublicKey) {
    return {
        address,
        scriptType: 'signedby',
        script: `RETURN SIGNEDBY(${kissHex(wotsRootPublicKey)})`,
        wotsRootPublicKey,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
export function createMultisigDescriptor(address, publicKey1, publicKey2, ownPublicKey) {
    return {
        address,
        scriptType: 'multisig',
        script: `RETURN SIGNEDBY(${kissHex(publicKey1)}) AND SIGNEDBY(${kissHex(publicKey2)})`,
        wotsRootPublicKey: ownPublicKey,
        multisigKeys: [publicKey1, publicKey2],
        multisigThreshold: 2,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
export function createMofNMultisigDescriptor(address, threshold, publicKeys, ownPublicKey) {
    const formattedKeys = publicKeys.map(pk => kissHex(pk)).join(' ');
    return {
        address,
        scriptType: 'multisig_mofn',
        script: `RETURN MULTISIG(${threshold} ${formattedKeys})`,
        wotsRootPublicKey: ownPublicKey,
        multisigKeys: publicKeys,
        multisigThreshold: threshold,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
export function createTimelockDescriptor(address, publicKey, unlockBlock) {
    return {
        address,
        scriptType: 'timelock',
        script: `RETURN SIGNEDBY(${kissHex(publicKey)}) AND @BLOCK GT ${unlockBlock}`,
        wotsRootPublicKey: publicKey,
        timelockBlock: unlockBlock,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
export function createHTLCDescriptor(address, ownerPublicKey, recipientPublicKey, hashLock, timeoutBlock, isOwner, preimage) {
    const script = `IF @BLOCK GT ${timeoutBlock} AND SIGNEDBY(${kissHex(ownerPublicKey)}) THEN RETURN TRUE ENDIF RETURN (SIGNEDBY(${kissHex(recipientPublicKey)}) AND SHA3(STATE(1)) EQ ${kissHex(hashLock)})`;
    const descriptor = {
        address,
        scriptType: 'htlc',
        script,
        wotsRootPublicKey: isOwner ? ownerPublicKey : recipientPublicKey,
        htlcHash: hashLock,
        timelockBlock: timeoutBlock,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
    if (preimage) {
        descriptor.htlcPreimage = preimage;
        descriptor.stateVariables = [{ port: 1, value: preimage, type: 'string' }];
    }
    return descriptor;
}
export function createMASTDescriptor(address, rootHash, branchScript, branchProof, wotsPublicKey) {
    return {
        address,
        scriptType: 'mast',
        script: `MAST ${kissHex(rootHash)}`,
        wotsRootPublicKey: wotsPublicKey,
        extraScripts: new Map([[branchScript, branchProof]]),
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
export function createExchangeDescriptor(address, ownerPublicKey, desiredAddress, desiredAmount, desiredTokenId) {
    const ownerPk = kissHex(ownerPublicKey);
    const script = `IF SIGNEDBY(PREVSTATE(0)) THEN RETURN TRUE ENDIF ASSERT VERIFYOUT(@INPUT PREVSTATE(1) PREVSTATE(2) PREVSTATE(3) TRUE) RETURN TRUE`;
    return {
        address,
        scriptType: 'exchange',
        script,
        wotsRootPublicKey: ownerPublicKey,
        stateVariables: [
            { port: 0, value: ownerPk, type: 'hex' },
            { port: 1, value: desiredAddress, type: 'hex' },
            { port: 2, value: desiredAmount, type: 'number' },
            { port: 3, value: desiredTokenId, type: 'hex' }
        ],
        verifyOutExpectations: [{
                inputIndex: '@INPUT',
                outputAddress: desiredAddress,
                amount: desiredAmount,
                tokenId: desiredTokenId,
                keepState: true
            }],
        mastProof: createEmptyMMRProof(),
        storeState: true
    };
}
export function createFlashCashDescriptor(address, ownerPublicKey, interestMultiplier = '1.01') {
    const script = `IF SIGNEDBY(PREVSTATE(1)) THEN RETURN TRUE ENDIF ASSERT SAMESTATE(1 1) RETURN VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${interestMultiplier} @TOKENID TRUE)`;
    return {
        address,
        scriptType: 'flashcash',
        script,
        wotsRootPublicKey: ownerPublicKey,
        stateVariables: [{ port: 1, value: ownerPublicKey, type: 'hex' }],
        mastProof: createEmptyMMRProof(),
        storeState: true
    };
}
export function createSlowCashDescriptor(address, ownerPublicKey, withdrawalPercent = '0.9', cooldownBlocks = 10000n) {
    const script = `IF @COINAGE LT ${cooldownBlocks} THEN RETURN FALSE ENDIF ASSERT SIGNEDBY(${kissHex(ownerPublicKey)}) AND VERIFYOUT(@INPUT @ADDRESS @AMOUNT*${withdrawalPercent} @TOKENID TRUE)`;
    return {
        address,
        scriptType: 'slowcash',
        script,
        wotsRootPublicKey: ownerPublicKey,
        timelockBlock: cooldownBlocks,
        mastProof: createEmptyMMRProof(),
        storeState: false
    };
}
