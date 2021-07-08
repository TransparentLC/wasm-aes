export = class AES {
    static MODE_ECB: String
    static MODE_CBC: String
    static MODE_CFB: String
    static MODE_OFB: String
    static MODE_CTR: String
    static utils: {
        bytesToUtf8(data: Uint8Array): String
        utf8ToBytes(data: String): Uint8Array
        bytesToHex(data: Uint8Array): String
        hexToBytes(data: String): Uint8Array
        bytesToBase64(data: Uint8Array): String
        base64ToBytes(data: String): Uint8Array
        pkcs7Pad(data: Uint8Array): Uint8Array
        pkcs7Strip(data: Uint8Array): Uint8Array
    }
    static ready: Promise<void>

    constructor(key?: Uint8Array, iv?: Uint8Array)
    encrypt(mode: String, buffer: Uint8Array, key?: Uint8Array, iv?: Uint8Array): Uint8Array
    decrypt(mode: String, buffer: Uint8Array, key?: Uint8Array, iv?: Uint8Array): Uint8Array
}
