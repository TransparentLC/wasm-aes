# wasm-aes

[![build](https://github.com/TransparentLC/wasm-aes/actions/workflows/build.yml/badge.svg)](https://github.com/TransparentLC/wasm-aes/actions/workflows/build.yml)

使用 WASM 运行的 AES 算法，预编译版可在 [Actions](https://github.com/TransparentLC/wasm-aes/actions/workflows/build.yml) 或 [Releases](https://github.com/TransparentLC/wasm-aes/releases) 下载。

AES 的实现来自 [tiny-AES-C](https://github.com/kokke/tiny-AES-C)，原版提供了 ECB、CBC、CTR 三种模式，CFB、OFB 模式是我自己加上的。各模式的加密和解密结果和 [aes-js](https://github.com/ricmoo/aes-js) 及 [CryptoJS](https://github.com/brix/crypto-js) 相同。

## 使用方式

### 加密和解密

```js
if (typeof btoa === 'undefined') {
    global.btoa = str => Buffer.from(str, 'binary').toString('base64');
}

if (typeof atob === 'undefined') {
    global.atob = b64Encoded => Buffer.from(b64Encoded, 'base64').toString('binary');
}

// 在浏览器中加载时，名称为AES128/AES192/AES256
const AES = require('./dist/aes128-wasm.min.js');

(async () => {

// 等待模块异步加载完成
await AES.ready;

// key长度固定为16/24/32
const key = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3, 4, 5, 6, 7]);
// iv长度固定为16
const iv = new Uint8Array([7, 6, 5, 4, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1, 0]);

// 在新建加解密对象时设置key和iv（ECB模式不需要设置iv）
const aesEncrypt = new AES(key, iv);
const plaintextString = 'This is a secret message!';
// 将明文转换为Uint8Array
const plaintextBytes = AES.utils.utf8ToBytes(plaintextString);
// 对于ECB和CBC模式，明文长度必须是分组长度16的整数倍，因此还需要进行填充
// CFB、OFB和CTR模式将分组密码变为流密码，也就不需要填充了
const plaintextBytesPadded = AES.utils.pkcs7Pad(plaintextBytes);
// 使用CBC模式进行加密，可选的模式：
// AES.MODE_ECB
// AES.MODE_CBC
// AES.MODE_CFB
// AES.MODE_OFB
// AES.MODE_CTR
const ciphertext = aesEncrypt.encrypt(AES.MODE_CBC, plaintextBytesPadded);

console.log(AES.utils.bytesToHex(ciphertext));
// eb35b523d6b12f646c31139a1c656a80201ecd8315b418084515a57aeab2c487

// 使用PHP的openssl_encrypt验证：
// php > echo bin2hex(openssl_encrypt('This is a secret message!', 'aes-128-cbc', hex2bin('00010203040506070001020304050607'), OPENSSL_RAW_DATA, hex2bin('07060504030201000706050403020100')));
// eb35b523d6b12f646c31139a1c656a80201ecd8315b418084515a57aeab2c487

// 也可以不在新建对象时设置key和iv……
const aesDecrypt = new AES;
// 而是在加密和解密时再设置
const decrypted = aesDecrypt.decrypt(AES.MODE_CBC, ciphertext, key, iv);
// 去除填充
const decryptedStripped = AES.utils.pkcs7Strip(decrypted);
// 将解密后的数据转换为字符串
const decryptedString = AES.utils.bytesToUtf8(decryptedStripped);

console.log(decryptedString);
// This is a secret message!
console.log(plaintextString === decryptedString);
// true

})()
```

### 工具函数

* `AES.utils.bytesToUtf8` 将 Uint8Array 以 UTF-8 编码转换为字符串
* `AES.utils.utf8ToBytes` 将 字符串 以 UTF-8 编码转换为 Uint8Array
* `AES.utils.bytesToHex` 将 Uint8Array 转换为表示十六进制的字符串
* `AES.utils.hexToBytes` 将表示十六进制的字符串转换为 Uint8Array
* `AES.utils.bytesToBase64` 将 Uint8Array 转换为 Base64 编码的字符串
* `AES.utils.base64ToBytes` 将 Base64 编码的字符串转换为 Uint8Array
* `AES.utils.pkcs7Pad` 使用 PKCS #7 将 Uint8Array 填充到长度为 16 的倍数
* `AES.utils.pkcs7Strip` 去除 Uint8Array 的 PKCS #7 填充

## 编译

需要安装 [Emscripten](https://emscripten.org) 和 [Node.js](https://nodejs.org) 环境。

```bash
npm install -g terser
node build.js
```

运行后可以在 `dist` 目录找到以下文件：
* `aes***.wasm`
* `aes***-wasm.js`
* `aes***-wasm.min.js`
* `aes***-wasm.min.js.map`

`***` 是 128、192、256 之一，使用时在浏览器 / Node.js 中加载 JS 文件即可，WASM 文件可以不保留。

## 测试

以 aes-js 和 CryptoJS 作为参考，随机生成数据进行加密和解密，检查运行结果是否相同。

```bash
curl https://cdn.jsdelivr.net/npm/aes-js@3/index.min.js --output aes-js.min.js
curl https://cdn.jsdelivr.net/npm/crypto-js@3/crypto-js.min.js --output crypto-js.min.js
node test.js
```

运行 `node benchmark.js` 可以测试运行速度（对 32 MB 的随机数据进行加密），以下测试结果是在 WSL Ubuntu 20.04 Node.js v14.15.5 下运行的，仅供参考：

| 加密模式 | WASM 运行时间（Bytes） | aes-js 运行时间（Bytes） | CryptoJS 运行时间（Bytes） | WASM 加密速度（Bytes/ms） | aes-js 加密速度（Bytes/ms） | CryptoJS 加密速度（Bytes/ms） | 与 aes-js 比较的速度比例 | 与 CryptoJS 比较的速度比例 |
| - | - | - | - | - | - | - | - | - |
| AES128 ECB | 1201.60 | 1605.51 | 1422.02 | 27924.72 | 20899.59 | 23596.37 | 1.34 | 1.18 |
| AES128 CBC | 911.06 | 1498.55 | 1523.52 | 36830.30 | 22391.19 | 22024.27 | 1.64 | 1.67 |
| AES128 CFB | 912.26 | 1564.48 | 1500.74 |  36781.84 | 21447.67 | 22358.52 | 1.71 | 1.65 |
| AES128 OFB | 907.18 | 1344.67 | 1503.84 |  36987.46 | 24953.73 | 22312.54 | 1.48 | 1.66 |
| AES128 CTR | 1049.65 | 1423.54 | 1510.53  | 31967.33 | 23571.10 | 22213.62 | 1.36 | 1.44 |
| AES192 ECB | 1381.30 | 1618.10 | 1492.45 | 24291.85 |  20736.94 |  22482.83 | 1.17 | 1.08 |
| AES192 CBC | 1100.59 | 1686.65 | 1621.68 | 30487.63 | 19894.17 | 20691.14 | 1.53 | 1.47 |
| AES192 CFB | 1028.96 | 1762.22 |  1643.76 | 32610.05 | 19040.96 | 20413.28 | 1.71 | 1.60 |
| AES192 OFB | 1098.37 | 1565.58 | 1547.02 | 30549.25 | 21432.59 | 21689.77 | 1.43 | 1.41 |
| AES192 CTR | 1170.35 | 1622.54 | 1595.05 | 28670.35 | 20680.21 | 21036.59 | 1.39 | 1.36 |
| AES256 ECB | 1469.44 | 1833.12 | 1569.07 |  22834.88 | 18304.56  | 21384.90 | 1.25 | 1.07 |
| AES256 CBC | 1280.84 | 1901.32 | 1724.90  | 26197.20 | 17647.96 | 19452.98 | 1.48 | 1.35 |
| AES256 CFB | 1267.01 | 1934.47 | 1675.43 | 26483.10 | 17345.55 | 20027.34 | 1.53 | 1.32 |
| AES256 OFB | 1276.97 | 1745.55 | 1600.33 | 26276.65 | 19222.89 | 20967.14 | 1.37 | 1.25 |
| AES256 CTR | 1322.65 | 1797.53 | 1631.88 | 25369.07 | 18666.96 | 20561.87 | 1.36 | 1.23 |
