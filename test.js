if (typeof btoa === 'undefined') {
    global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}

if (typeof atob === 'undefined') {
    global.atob = b64Encoded => Buffer.from(b64Encoded, 'base64').toString('binary');
}

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
            let padC = CryptoJS.enc.Uint8.parse(arr);
            CryptoJS.pad.Pkcs7.pad(padC, 4);
            padC = padC.toString(CryptoJS.enc.Uint8);
            if (!arrayEqual(padA, padB) || !arrayEqual(padA, padC)) {
                throw new Error('PKCS7 padding test failed');
            }

            const stripA = AES.utils.pkcs7Strip(padA);
            const stripB = aesjs.padding.pkcs7.strip(padB);
            let stripC = CryptoJS.enc.Uint8.parse(padC);
            CryptoJS.pad.Pkcs7.unpad(stripC);
            stripC = stripC.toString(CryptoJS.enc.Uint8);
            if (!arrayEqual(stripA, stripB) || !arrayEqual(stripA, stripC)) {
                throw new Error('PKCS7 stripping test failed');
            }
        }

        for (const [mode, wasmMode, aesjsMode, cryptojsMode] of [
            ['ECB', AES.MODE_ECB, aesjs.ModeOfOperation.ecb, CryptoJS.mode.ECB],
            ['CBC', AES.MODE_CBC, aesjs.ModeOfOperation.cbc, CryptoJS.mode.CBC],
            ['CFB', AES.MODE_CFB, aesjs.ModeOfOperation.cfb, CryptoJS.mode.CFB],
            ['OFB', AES.MODE_OFB, aesjs.ModeOfOperation.ofb, CryptoJS.mode.OFB],
            ['CTR', AES.MODE_CTR, aesjs.ModeOfOperation.ctr, CryptoJS.mode.CTR],
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
                const encryptB = (new aesjsMode(key, iv, 16)).encrypt(aesjs.padding.pkcs7.pad(buffer));
                const encryptC = CryptoJS.AES.encrypt(
                    CryptoJS.enc.Uint8.parse(buffer),
                    CryptoJS.enc.Uint8.parse(key),
                    {
                        mode: cryptojsMode,
                        iv: CryptoJS.enc.Uint8.parse(iv),
                        padding: streamCipher ? CryptoJS.pad.NoPadding : CryptoJS.pad.Pkcs7,
                    }
                ).ciphertext.toString(CryptoJS.enc.Uint8);
                if (!arrayEqual(encryptA, streamCipher ? encryptB.slice(0, buffer.length) : encryptB) || !arrayEqual(encryptA, encryptC)) {
                    throw new Error(`${mode} encrypting test failed`);
                }

                const decryptA = (streamCipher ? e => e : AES.utils.pkcs7Strip)(aes.decrypt(wasmMode, encryptA));
                const decryptB = aesjs.padding.pkcs7.strip((new aesjsMode(key, iv, 16)).decrypt(encryptB));
                const decryptC = CryptoJS.AES.decrypt(
                    {
                        ciphertext: CryptoJS.enc.Uint8.parse(encryptC),
                    },
                    CryptoJS.enc.Uint8.parse(key),
                    {
                        mode: cryptojsMode,
                        iv: CryptoJS.enc.Uint8.parse(iv),
                        padding: streamCipher ? CryptoJS.pad.NoPadding : CryptoJS.pad.Pkcs7,
                    }
                ).toString(CryptoJS.enc.Uint8);
                if (!arrayEqual(decryptA, decryptB) || !arrayEqual(decryptA, decryptC)) {
                    throw new Error(`${mode} decrypting test failed`);
                }
            }
        }
    }
}, 10);