const childProcess = require('child_process');
const fs = require('fs');

fs.rmdirSync('dist', { recursive: true });
fs.mkdirSync('dist');

const templateFile = fs.readFileSync('aes-wasm-template.js').toString();

for (const [AES_MODE, AES_KEYLEN, AES_KEYEXPSIZE] of [
    [128, 16, 176],
    [192, 24, 208],
    [256, 32, 240],
]) {
    const emscriptenProcess = childProcess.spawnSync(
        'emcc',
        [
            'aes.c',
            '-O3',
            '-v',
            '-s', 'SIDE_MODULE=1',
            '-D', `AES${AES_MODE}=1`,
            '-o', `dist/aes${AES_MODE}.wasm`,
        ],
    );
    console.log(emscriptenProcess.output.toString());
    if (emscriptenProcess.status) {
        continue;
    }
    fs.writeFileSync(
        `dist/aes${AES_MODE}-wasm.js`,
        templateFile
            .replace(/\$\$AES_MODE\$\$/, AES_MODE)
            .replace(/\$\$AES_KEYLEN\$\$/, AES_KEYLEN)
            .replace(/\$\$AES_KEYEXPSIZE\$\$/, AES_KEYEXPSIZE)
            .replace(/\$\$WASM_BASE64\$\$/, fs.readFileSync(`dist/aes${AES_MODE}.wasm`, { encoding: 'base64' }))
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