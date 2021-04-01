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

for (const [AES_MODE, AES] of [
    [128, AES128],
    [192, AES192],
    [256, AES256],
]) {
    console.log(`Testing AES${AES_MODE}`);

    console.log('Running PKCS7 tests');
    for (let i = 0; i < 1024; i++) {
        const arr = randomBytes(Math.random() * 64 | 0);
        const padA = AES.utils.pkcs7Pad(arr);
        const padB = aesjs.padding.pkcs7.pad(arr);
        if (!arrayEqual(padA, padB)) {
            throw new Error('PKCS7 padding test failed');
        }

        const stripA = AES.utils.pkcs7Strip(padA);
        const stripB = aesjs.padding.pkcs7.strip(padB);
        if (!arrayEqual(stripA, stripB)) {
            throw new Error('PKCS7 stripping test failed');
        }
    }

    for (const [mode, wasmMode, jsMode] of [
        ['ECB', AES.MODE_ECB, aesjs.ModeOfOperation.ecb],
        ['CBC', AES.MODE_CBC, aesjs.ModeOfOperation.cbc],
        ['CFB', AES.MODE_CFB, aesjs.ModeOfOperation.cfb],
        ['OFB', AES.MODE_OFB, aesjs.ModeOfOperation.ofb],
        ['CTR', AES.MODE_CTR, aesjs.ModeOfOperation.ctr],
    ]) {
        const name = `AES${AES_MODE} ${mode}`;
        console.log(`Running ${name} tests`);

        const streamCipher = mode === 'CFB' || mode === 'OFB' || mode === 'CTR';
        for (let i = 0; i < 32; i++) {
            const key = randomBytes(AES_MODE / 8);
            const iv = randomBytes(16);
            const buffer = randomBytes(Math.random() * 131072 | 0);
            const aes = new AES(key, iv);

            const encryptA = aes.encrypt(wasmMode, streamCipher ? buffer : AES.utils.pkcs7Pad(buffer));
            const encryptB = (new jsMode(key, iv, 16)).encrypt(aesjs.padding.pkcs7.pad(buffer));
            if (!arrayEqual(encryptA, streamCipher ? encryptB.slice(0, buffer.length) : encryptB)) {
                throw new Error(`${mode} encrypting test failed`);
            }

            const decryptA = (streamCipher ? e => e : AES.utils.pkcs7Strip)(aes.decrypt(wasmMode, encryptA));
            const decryptB = aesjs.padding.pkcs7.strip((new jsMode(key, iv, 16)).decrypt(encryptB));
            if (!arrayEqual(decryptA, decryptB)) {
                throw new Error(`${mode} decrypting test failed`);
            }
        }
    }
}
