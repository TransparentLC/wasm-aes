# wasm-aes

[![build](https://github.com/TransparentLC/wasm-aes/actions/workflows/build/badge.svg)](https://github.com/TransparentLC/wasm-aes/actions)

使用 WASM 运行的 AES 算法，预编译版可在 Actions 处下载。

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

以 aes-js 作为参考，随机生成数据进行加密和解密，检查运行结果是否相同。

```bash
curl https://cdn.jsdelivr.net/npm/aes-js@3/index.min.js --output aes-js.min.js
node test.js
```

运行 `node benchmark.js` 可以测试运行速度（对 32 MB 的随机数据进行加密），以下测试结果是在 WSL Ubuntu 20.04 Node.js v14.15.5 下运行的，仅供参考：

| 加密模式 | WASM 运行时间（Bytes） | JS 运行时间（Bytes） | WASM 加密速度（Bytes/ms） | JS 加密速度（Bytes/ms） | 比例 |
| - | - | - | - | - | - |
| AES128 ECB | 1176.72 | 1572.08 | 28515.22 | 21344.00 | 1.34 |
| AES128 CBC | 881.76 | 1671.79 | 38053.95 | 20070.91 | 1.90 |
| AES128 CFB | 839.60 | 1686.51 | 39964.58 | 19895.82 | 2.01 |
| AES128 OFB | 843.13 | 1504.50 | 39797.42 | 22302.69 | 1.78 |
| AES128 CTR | 892.21 | 1576.23 | 37608.33 | 21287.76 | 1.77 |
| AES192 ECB | 1344.41 | 1719.62 | 24958.50 | 19512.73 | 1.28 |
| AES192 CBC | 1037.27 | 1730.38 | 32348.86 | 19391.40 | 1.67 |
| AES192 CFB | 1003.51 | 1813.95 | 33437.05 | 18497.96 | 1.81 |
| AES192 OFB | 1005.22 | 1636.49 | 33380.33 | 20503.91 | 1.63 |
| AES192 CTR | 1058.44 | 1683.23 | 31701.73 | 19934.52 | 1.59 |
| AES256 ECB | 1495.54 | 1851.43 | 22436.36 | 18123.56 | 1.24 |
| AES256 CBC | 1169.92 | 1914.87 | 28680.95 | 17523.13 | 1.64 |
| AES256 CFB | 1158.10 | 1934.46 | 28973.75 | 17345.61 | 1.67 |
| AES256 OFB | 1154.21 | 1782.57 | 29071.34 | 18823.61 | 1.54 |
| AES256 CTR | 1222.91 | 1822.29 | 27438.22 | 18413.32 | 1.49 |
