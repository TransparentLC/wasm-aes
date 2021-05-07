if (typeof btoa === 'undefined') {
    global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}

if (typeof atob === 'undefined') {
    global.atob = b64Encoded => Buffer.from(b64Encoded, 'base64').toString('binary');
}

const { performance } = require('perf_hooks');

const aesjs = require('./aes-js.min.js');
const CryptoJS = require('./crypto-js.min.js');
const AES128 = require('./dist/aes128-wasm.min.js');
const AES192 = require('./dist/aes192-wasm.min.js');
const AES256 = require('./dist/aes256-wasm.min.js');

CryptoJS.enc.Uint8 = {
    stringify: wordArray => {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        const u8arr = new Uint8Array(sigBytes);
        for (let i = 0; i < sigBytes; i++) {
            u8arr[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
        }
        return u8arr;
    },
    parse: u8arr => {
        const len = u8arr.length;
        const words = [];
        for (let i = 0; i < len; i++) {
            words[i >>> 2] |= (u8arr[i] & 0xFF) << (24 - (i % 4) * 8);
        }
        return CryptoJS.lib.WordArray.create(words, len);
    }
};

const randomBytes = length => {
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        result[i] = Math.random() * 0xFF | 0;
    }
    return result;
};

const arrayEqual = (a, b) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

setTimeout(() => {
    const result = [];
    for (const [AES_MODE, AES] of [
        [128, AES128],
        [192, AES192],
        [256, AES256],
    ]) {
        for (const [mode, wasmMode, aesjsMode, cryptojsMode] of [
            ['ECB', AES.MODE_ECB, aesjs.ModeOfOperation.ecb, CryptoJS.mode.ECB],
            ['CBC', AES.MODE_CBC, aesjs.ModeOfOperation.cbc, CryptoJS.mode.CBC],
            ['CFB', AES.MODE_CFB, aesjs.ModeOfOperation.cfb, CryptoJS.mode.CFB],
            ['OFB', AES.MODE_OFB, aesjs.ModeOfOperation.ofb, CryptoJS.mode.OFB],
            ['CTR', AES.MODE_CTR, aesjs.ModeOfOperation.ctr, CryptoJS.mode.CTR],
        ]) {
            const name = `AES${AES_MODE} ${mode}`;
            console.log(`Benchmarking ${name}`);

            const bufferLength = 1048576 * 32;
            const key = randomBytes(AES_MODE / 8);
            const iv = randomBytes(16);
            const buffer = randomBytes(bufferLength);
            const aes = new AES(key, iv);

            const wasmStart = performance.now();
            const wasmEncrypt = aes.encrypt(wasmMode, buffer);
            const wasmEnd = performance.now();

            const aesjsStart = performance.now();
            const aesjsEncrypt = (new aesjsMode(key, iv, 16)).encrypt(buffer);
            const aesjsEnd = performance.now();

            const cryptojsStart = performance.now();
            const cryptojsEncrypt = CryptoJS.AES.encrypt(
                CryptoJS.enc.Uint8.parse(buffer),
                CryptoJS.enc.Uint8.parse(key),
                {
                    mode: cryptojsMode,
                    iv: CryptoJS.enc.Uint8.parse(iv),
                    padding: CryptoJS.pad.NoPadding,
                }
            ).ciphertext.toString(CryptoJS.enc.Uint8);
            const cryptojsEnd = performance.now();

            if (!arrayEqual(wasmEncrypt, aesjsEncrypt) || !arrayEqual(wasmEncrypt, cryptojsEncrypt)) {
                throw new Error('Not equal');
            }

            const wasmTime = wasmEnd - wasmStart;
            const aesjsTime = aesjsEnd - aesjsStart;
            const cryptojsTime = cryptojsEnd - cryptojsStart;
            const wasmSpeed = bufferLength / wasmTime;
            const aesjsSpeed = bufferLength / aesjsTime;
            const cryptojsSpeed = bufferLength / cryptojsTime;
            const aesjsRatio = wasmSpeed / aesjsSpeed;
            const cryptojsRatio = wasmSpeed / cryptojsSpeed;

            result.push({
                name,
                bufferLength,
                wasmTime,
                aesjsTime,
                cryptojsTime,
                wasmSpeed,
                aesjsSpeed,
                cryptojsSpeed,
                aesjsRatio,
                cryptojsRatio,
            });
        }
    }
    console.table(result);
}, 10);