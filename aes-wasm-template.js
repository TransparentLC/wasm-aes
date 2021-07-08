(() => {

/** @type {globalThis} */
const GLOBAL = typeof globalThis !== 'undefined' ? globalThis : (global || self);

const {
    Error,
    Uint8Array,
    WebAssembly,
} = GLOBAL;

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
const WASM_MEMORY_LENGTH = 0x10000;
const AES_BLOCKLEN = 16;
const AES_KEYLEN = $$AES_KEYLEN$$;
const AES_KEYEXPSIZE = $$AES_KEYEXPSIZE$$;

const utf8Encoder = new TextEncoder('utf-8');
const utf8Decoder = new TextDecoder('utf-8');
const cryptFunctionName = {
    '$$AES_ENCRYPT$$': {
        '$$AES_ECB$$': '$$AES_ECB_encrypt$$',
        '$$AES_CBC$$': '$$AES_CBC_encrypt_buffer$$',
        '$$AES_CFB$$': '$$AES_CFB_encrypt_buffer$$',
        '$$AES_OFB$$': '$$AES_OFB_xcrypt_buffer$$',
        '$$AES_CTR$$': '$$AES_CTR_xcrypt_buffer$$',
    },
    '$$AES_DECRYPT$$': {
        '$$AES_ECB$$': '$$AES_ECB_decrypt$$',
        '$$AES_CBC$$': '$$AES_CBC_decrypt_buffer$$',
        '$$AES_CFB$$': '$$AES_CFB_decrypt_buffer$$',
        '$$AES_OFB$$': '$$AES_OFB_xcrypt_buffer$$',
        '$$AES_CTR$$': '$$AES_CTR_xcrypt_buffer$$',
    },
};

const utils = {
    /**
     * @param {Uint8Array} data
     * @returns {String}
     */
    'bytesToUtf8': data => utf8Decoder.decode(data),
    /**
     * @param {String} data
     * @returns {Uint8Array}
     */
    'utf8ToBytes': data => utf8Encoder.encode(data),
    /**
     * @param {Uint8Array} data
     * @returns {String}
     */
    'bytesToHex': data => {
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
    'hexToBytes': data => {
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
    'bytesToBase64': data => btoa(String.fromCharCode.apply(null, data)),
    /**
     * @param {String} data
     * @returns {Uint8Array}
     */
    'base64ToBytes': data => Uint8Array.from(atob(data), e => e.charCodeAt()),
    /**
     * @param {Uint8Array} data
     * @returns {Uint8Array}
     */
    'pkcs7Pad': data => {
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
    'pkcs7Strip': data => data.slice(0, data.length - data[data.length - 1]),
};

const wasmMemory = new WebAssembly.Memory({
    'initial': 1,
});
const wasmHeapU8 = new Uint8Array(wasmMemory.buffer);

/** @type {WebAssembly.Exports} */
let wasmExports;
/** @type {Promise<void>} */
const wasmReady = new Promise(resolve => WebAssembly
    .instantiate(
        utils['base64ToBytes']('$$WASM_BASE64$$'),
        {
            'env': {
                'memory': wasmMemory,
                '__memory_base': 0x0000,
                '__stack_pointer': new WebAssembly.Global(
                    {
                        'mutable': true,
                        'value': 'i32',
                    },
                    0x0E00
                ),
            },
        }
    )
    .then(result => {
        wasmExports = result['instance']['exports'];
        resolve();
    })
);

/**
 * @param {Function} initFunction
 * @param {Uint8Array} key
 * @param {Uint8Array} iv
 */
const initContext = (initFunction, key, iv) => {
    wasmHeapU8.set(key, OFFSET_AES_CTX + AES_KEYEXPSIZE + AES_BLOCKLEN);
    iv && wasmHeapU8.set(iv, OFFSET_AES_CTX + AES_KEYEXPSIZE);
    initFunction(
        OFFSET_AES_CTX,
        OFFSET_AES_CTX + AES_KEYEXPSIZE + AES_BLOCKLEN,
        OFFSET_AES_CTX + AES_KEYEXPSIZE
    );
};

class AES {
    static 'MODE_ECB' = '$$AES_ECB$$';
    static 'MODE_CBC' = '$$AES_CBC$$';
    static 'MODE_CFB' = '$$AES_CFB$$';
    static 'MODE_OFB' = '$$AES_OFB$$';
    static 'MODE_CTR' = '$$AES_CTR$$';
    static 'utils' = utils;
    static 'ready' = wasmReady;

    /**
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     */
    constructor(key = null, iv = null) {
        this._key = key;
        this._iv = iv;
    }

    /**
     * @param {String} operation
     * @param {String} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    crypt(operation, mode, buffer, key = this._key, iv = this._iv) {
        if ((mode === '$$AES_ECB$$' || mode === '$$AES_CBC$$') && buffer.length % AES_BLOCKLEN) {
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
        if (mode !== '$$AES_ECB$$' && iv.length !== AES_BLOCKLEN) {
            throw new Error(`IV length must be ${AES_BLOCKLEN}`);
        }
        const cryptFunction = wasmExports[cryptFunctionName[operation][mode]];
        initContext(
            wasmExports[mode === '$$AES_ECB$$' ? '$$AES_init_ctx$$' : '$$AES_init_ctx_iv$$'],
            key,
            iv
        );

        const result = new Uint8Array(buffer.length);
        let cryptedLength = 0;
        while (cryptedLength < buffer.length) {
            const sliceLength = mode === '$$AES_ECB$$' ? AES_BLOCKLEN : Math.min(buffer.length - cryptedLength, WASM_MEMORY_LENGTH - OFFSET_BUFFER);
            wasmHeapU8.set(buffer.subarray(cryptedLength, cryptedLength + sliceLength), OFFSET_BUFFER);
            cryptFunction(OFFSET_AES_CTX, OFFSET_BUFFER, sliceLength);
            result.set(wasmHeapU8.subarray(OFFSET_BUFFER, OFFSET_BUFFER + sliceLength), cryptedLength);
            cryptedLength += sliceLength;
        }
        return result;
    }

    /**
     * @param {String} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    'encrypt'(mode, buffer, key, iv) {
        return this.crypt('$$AES_ENCRYPT$$', mode, buffer, key, iv);
    }

    /**
     * @param {String} mode
     * @param {Uint8Array} buffer
     * @param {Uint8Array} [key]
     * @param {Uint8Array} [iv]
     * @returns {Uint8Array}
     */
    'decrypt'(mode, buffer, key, iv) {
        return this.crypt('$$AES_DECRYPT$$', mode, buffer, key, iv);
    }
}

if (typeof module !== 'undefined') {
    module.exports = AES;
} else {
    GLOBAL['AES$$AES_MODE$$'] = AES;
}

})()