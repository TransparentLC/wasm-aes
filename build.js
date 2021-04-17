const childProcess = require('child_process');
const fs = require('fs');

if (!String.prototype.replaceAll) {
    /**
     * @param {String|RegExp} str
     * @param {String} newStr
     * @returns {String}
     */
    String.prototype.replaceAll = function (str, newStr) {
        return this.replace(str instanceof RegExp ? str : new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newStr);
    }
}

/**
 * @param {Number} num
 * @param {String} charset
 * @returns {String}
 */
const baseConvert = (num, charset) => {
    const base = charset.length;
    let result = '';
    do {
        result = charset[num % base] + result;
        num = Math.floor(num / base);
    } while (num);
    return result;
}

/**
 * @param {Array} arr
 * @return {Array}
 */
const shuffleArray = arr => {
    arr = arr.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * @param {Object} mappingObject
 * @param {String} str
 * @return {String}
 */
const applyReplaceMapping = (mappingObject, str) => Object
    .entries(mappingObject)
    .reduce(
        (acc, cur) => acc.replaceAll(cur[0], cur[1]),
        str
    );

fs.rmdirSync('dist', { recursive: true });
fs.mkdirSync('dist');

for (const [AES_MODE, AES_KEYLEN, AES_KEYEXPSIZE] of [
    [128, 16, 176],
    [192, 24, 208],
    [256, 32, 240],
]) {
    const charset = shuffleArray('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')).join('');
    const uniqueId = Math.random().toString(36).slice(2, 10);
    /** @type {Object} */
    const contentMapping = [
        '$$AES_init_ctx$$',
        '$$AES_init_ctx_iv$$',
        '$$AES_ctx_set_iv$$',
        '$$AES_ECB_encrypt$$',
        '$$AES_ECB_decrypt$$',
        '$$AES_CBC_encrypt_buffer$$',
        '$$AES_CBC_decrypt_buffer$$',
        '$$AES_CFB_encrypt_buffer$$',
        '$$AES_CFB_decrypt_buffer$$',
        '$$AES_OFB_xcrypt_buffer$$',
        '$$AES_CTR_xcrypt_buffer$$',
    ].reduce(
        (acc, cur, idx) => {
            acc[cur] = baseConvert(idx, charset);
            return acc;
        },
        {
            $$UNIQUE_ID$$: uniqueId,
            $$AES_MODE$$: AES_MODE,
            $$AES_KEYLEN$$: AES_KEYLEN,
            $$AES_KEYEXPSIZE$$: AES_KEYEXPSIZE,
        }
    );
    fs.writeFileSync(
        `aes-${uniqueId}.h`,
        applyReplaceMapping(contentMapping, fs.readFileSync('aes.h', { encoding: 'utf-8' }))
    );
    fs.writeFileSync(
        `aes-${uniqueId}.c`,
        applyReplaceMapping(contentMapping, fs.readFileSync('aes.c', { encoding: 'utf-8' }))
    );
    const emscriptenProcess = childProcess.spawnSync(
        'emcc',
        [
            `aes-${uniqueId}.c`,
            '-O3',
            '-v',
            '-s', 'SIDE_MODULE=2',
            '-D', `AES${AES_MODE}=1`,
            '-o', `dist/aes${AES_MODE}.wasm`,
        ],
    );
    console.log(emscriptenProcess.output.toString());
    fs.unlinkSync(`aes-${uniqueId}.h`);
    fs.unlinkSync(`aes-${uniqueId}.c`);
    contentMapping.$$WASM_BASE64$$ = fs.readFileSync(`dist/aes${AES_MODE}.wasm`, { encoding: 'base64' });

    fs.writeFileSync(
        `dist/aes${AES_MODE}-wasm.js`,
        applyReplaceMapping(contentMapping, fs.readFileSync('aes-wasm-template.js', { encoding: 'utf-8' }))
    );
    const terserProcess = childProcess.spawnSync(
        'terser',
        [
            '--ecma', '2020',
            '--compress', 'unsafe_math,unsafe_methods,unsafe_proto,unsafe_regexp,unsafe_undefined',
            '--mangle',
            '--comments', 'false',
            '--source-map', `url="aes${AES_MODE}-wasm.min.js.map"`,
            '--output', `dist/aes${AES_MODE}-wasm.min.js`,
            `dist/aes${AES_MODE}-wasm.js`,
        ],
    );
    console.log(terserProcess.output.toString());
}