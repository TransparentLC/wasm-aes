const { performance } = require('perf_hooks');

const aesjs = require('./aes-js.min.js');
const AES128 = require('./dist/aes128-wasm.min.js');
const AES192 = require('./dist/aes192-wasm.min.js');
const AES256 = require('./dist/aes256-wasm.min.js');

if (typeof btoa === 'undefined') {
    global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}

if (typeof atob === 'undefined') {
    global.atob = b64Encoded => Buffer.from(b64Encoded, 'base64').toString('binary');
}

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

const result = [];
for (const [AES_MODE, AES] of [
    [128, AES128],
    [192, AES192],
    [256, AES256],
]) {
    for (const [mode, wasmMode, jsMode] of [
        ['ECB', AES.MODE_ECB, aesjs.ModeOfOperation.ecb],
        ['CBC', AES.MODE_CBC, aesjs.ModeOfOperation.cbc],
        ['CFB', AES.MODE_CFB, aesjs.ModeOfOperation.cfb],
        ['OFB', AES.MODE_OFB, aesjs.ModeOfOperation.ofb],
        ['CTR', AES.MODE_CTR, aesjs.ModeOfOperation.ctr],
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

        const jsStart = performance.now();
        const jsEncrypt = (new jsMode(key, iv, 16)).encrypt(buffer);
        const jsEnd = performance.now();

        if (!arrayEqual(wasmEncrypt, jsEncrypt)) {
            throw new Error('Not equal');
        }

        const wasmTime = wasmEnd - wasmStart;
        const jsTime = jsEnd - jsStart;
        const wasmSpeed = bufferLength / wasmTime;
        const jsSpeed = bufferLength / jsTime;
        const ratio = wasmSpeed / jsSpeed;

        result.push({
            name,
            bufferLength,
            wasmTime,
            jsTime,
            wasmSpeed,
            jsSpeed,
            ratio,
        });
    }
}
console.table(result);