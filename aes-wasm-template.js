((global, factory) => {
    global = typeof globalThis !== 'undefined' ? globalThis : global;
    if (typeof define === 'function' && define.amd) {
        define(() => factory(global));
    } else if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = factory(global);
    } else {
        global.AES$$AES_MODE$$ = factory(global);
    }
})(this, (/** @type {globalThis} */ global) => {

const {
    Error,
    Symbol,
    Uint8Array,
    WebAssembly,
} = global;

/**
 * Memory allocation:
 * 0x0000 - 0x???? Data
 * 0x???? - 0x0DFF Stack
 * 0x0E00 - 0x0FFF struct AES_ctx
 * 0x1000 - 0x???? Data to encrypt / decrypt
 *
 * struct AES_ctx {
 *     uint8_t RoundKey[AES_KEYEXPSIZE];
 *     uint8_t Iv[AES_BLOCKLEN];
 * };
 */
const OFFSET_AES_CTX = 0x0E00;
const OFFSET_BUFFER = 0x1000;
const AES_BLOCKLEN = 16;
const AES_KEYLEN = $$AES_KEYLEN$$;
const AES_KEYEXPSIZE = $$AES_KEYEXPSIZE$$;

const $modeECB = Symbol();
const $modeCBC = Symbol();
const $modeCFB = Symbol();
const $modeOFB = Symbol();
const $modeCTR = Symbol();
const $operationEncrypt = Symbol();
const $operationDecrypt = Symbol();
const $crypt = Symbol();
const $key = Symbol();
const $iv = Symbol();
const $instance = Symbol();
const $heapU8 = Symbol();

const utf8Encoder = new TextEncoder('utf-8');
const utf8Decoder = new TextDecoder('utf-8');
const cryptFunctionName = {
    [$operationEncrypt]: {
        [$modeECB]: '$$AES_ECB_encrypt$$',
        [$modeCBC]: '$$AES_CBC_encrypt_buffer$$',
        [$modeCFB]: '$$AES_CFB_encrypt_buffer$$',
        [$modeOFB]: '$$AES_OFB_xcrypt_buffer$$',
        [$modeCTR]: '$$AES_CTR_xcrypt_buffer$$',
    },
    [$operationDecrypt]: {
        [$modeECB]: '$$AES_ECB_decrypt$$',
        [$modeCBC]: '$$AES_CBC_decrypt_buffer$$',
        [$modeCFB]: '$$AES_CFB_decrypt_buffer$$',
        [$modeOFB]: '$$AES_OFB_xcrypt_buffer$$',
        [$modeCTR]: '$$AES_CTR_xcrypt_buffer$$',
    },
};
/**
 * @param {Function} initFunction
 * @param {Uint8Array} heapU8
 * @param {Uint8Array} key
 * @param {Uint8Array} iv
 */
const initContext = (initFunction, heapU8, key, iv) => {
    heapU8.set(key, OFFSET_AES_CTX + AES_KEYEXPSIZE + AES_BLOCKLEN);
    iv && heapU8.set(iv, OFFSET_AES_CTX + AES_KEYEXPSIZE);
    initFunction(
        OFFSET_AES_CTX,
        OFFSET_AES_CTX + AES_KEYEXPSIZE + AES_BLOCKLEN,
        OFFSET_AES_CTX + AES_KEYEXPSIZE
    );
};

const utils = {
    /**
     * @param {Uint8Array} data
     * @returns {String}
     */
    bytesToUtf8: data => utf8Decoder.decode(data),
    /**
     * @param {String} data
     * @returns {Uint8Array}
     */
    utf8ToBytes: data => utf8Encoder.encode(data),
    /**
     * @param {Uint8Array} data
     * @returns {String}
     */
    bytesToHex: data => {
        let result = '';
        const dataLength = data.length;
        for (let i = 0; i < dataLength; i++) {
            result += data[i].toString(16).padStart(2, 0);
        }
        return result;
    },
    /**
     * @param {String} data
     * @returns {Uint8Array}
     */
    hexToBytes: data => {
        const splitted = data.match(/[\da-f]{2}/ig);
        const splittedLength = splitted.length;
        const result = new Uint8Array(splittedLength);
        for (let i = 0; i < splittedLength; i++) {
            result[i] = parseInt(splitted[i], 16);
        }
        return result;
    },
    /**
     * @param {Uint8Array} data
     * @returns {String}
     */
    bytesToBase64: data => btoa(String.fromCharCode.apply(null, data)),
    /**
     * @param {String} data
     * @returns {Uint8Array}
     */
    base64ToBytes: data => {
        const decoded = atob(data);
        const decodedLength = decoded.length;
        const result = new Uint8Array(decodedLength);
        for (let i = 0; i < decodedLength; i++) {
            result[i] = decoded.charCodeAt(i);
        }
        return result;
    },
    /**
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    pkcs7Pad: data => {
        const padLength = ~(data.length & 0xF) + 17;
        const resultLength = data.length + padLength
        const result = new Uint8Array(resultLength);
        result.set(data, 0);
        for (let i = data.length; i < resultLength; i++) {
            result[i] = padLength;
        }
        return result;
    },
    /**
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    pkcs7Strip: data => data.slice(0, data.length - data[data.length - 1]),
};

/** @type {WebAssembly.Module} */
let cachedModule;
const wasmBinary = utils.base64ToBytes('$$WASM_BASE64$$');
try {
    // throw new Error('Forcely use async loading!');
    cachedModule = new WebAssembly.Module(wasmBinary);
} catch (error) {
    WebAssembly.compile(wasmBinary)
        .then(module => cachedModule = module);
}

class AES {
    static MODE_ECB = $modeECB;
    static MODE_CBC = $modeCBC;
    static MODE_CFB = $modeCFB;
    static MODE_OFB = $modeOFB;
    static MODE_CTR = $modeCTR;
    static utils = utils;

    /**
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     */
    constructor(key = null, iv = null) {
        this[$key] = key;
        this[$iv] = iv;
        const memory = new WebAssembly.Memory({
            initial: 1,
        });
        this[$heapU8] = new Uint8Array(memory.buffer);
        this[$instance] = new WebAssembly.Instance(cachedModule, {
            env: {
                memory: memory,
                __memory_base: 0x0000,
                __stack_pointer: new WebAssembly.Global(
                    {
                        mutable: true,
                        value: 'i32',
                    },
                    0x0DFF
                ),
            },
        });
    }

    /**
     * @param {Symbol} operation
     * @param {Symbol} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    [$crypt](operation, mode, buffer, key = this[$key], iv = this[$iv]) {
        if ((mode === $modeECB || mode === $modeCBC) && buffer.length % AES_BLOCKLEN) {
            throw new Error(`Buffer length must be evenly divisible by ${AES_BLOCKLEN} in ECB/CBC mode`);
        }
        // if (!(operation in cryptFunctionName)) {
        //     throw new Error('Invalid operation');
        // }
        if (!(mode in cryptFunctionName[operation])) {
            throw new Error('Invalid mode');
        }
        if (key.length !== AES_KEYLEN) {
            throw new Error(`Key length must be ${AES_KEYLEN}`);
        }
        if (mode !== $modeECB && iv.length !== AES_BLOCKLEN) {
            throw new Error(`IV length must be ${AES_BLOCKLEN}`);
        }
        const exports = this[$instance].exports;
        const cryptFunction = exports[cryptFunctionName[operation][mode]];
        initContext(
            mode === $modeECB ? exports.$$AES_init_ctx$$ : exports.$$AES_init_ctx_iv$$,
            this[$heapU8],
            key,
            iv
        );

        const result = new Uint8Array(buffer.length);
        let cryptedLength = 0;
        while (cryptedLength < buffer.length) {
            const sliceLength = mode === $modeECB ? AES_BLOCKLEN : Math.min(buffer.length - cryptedLength, this[$heapU8].length - OFFSET_BUFFER);
            this[$heapU8].set(buffer.slice(cryptedLength, cryptedLength + sliceLength), OFFSET_BUFFER);
            cryptFunction(OFFSET_AES_CTX, OFFSET_BUFFER, sliceLength);
            result.set(this[$heapU8].slice(OFFSET_BUFFER, OFFSET_BUFFER + sliceLength), cryptedLength);
            cryptedLength += sliceLength;
        }
        return result;
    }

    /**
     * @param {Symbol} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    encrypt(mode, buffer, key, iv) {
        return this[$crypt]($operationEncrypt, mode, buffer, key, iv);
    }

    /**
     * @param {Symbol} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    decrypt(mode, buffer, key, iv) {
        return this[$crypt]($operationDecrypt, mode, buffer, key, iv);
    }
}

return AES;

});