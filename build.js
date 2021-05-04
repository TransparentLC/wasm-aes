const childProcess = require('child_process');
const fs = require('fs');
const ReplacementCollector = require('./replacement-collector.js');

fs.rmdirSync('dist', { recursive: true });
fs.mkdirSync('dist');

for (const [AES_MODE, AES_KEYLEN, AES_KEYEXPSIZE] of [
    [128, 16, 176],
    [192, 24, 208],
    [256, 32, 240],
]) {
    const uniqueId = Math.random().toString(36).slice(2, 10);
    const rc = new ReplacementCollector(/\$\$.+?\$\$/g, {
        $$UNIQUE_ID$$: uniqueId,
        $$AES_MODE$$: AES_MODE,
        $$AES_KEYLEN$$: AES_KEYLEN,
        $$AES_KEYEXPSIZE$$: AES_KEYEXPSIZE,
        $$WASM_BASE64$$: null,
    });
    for (const f of [
        'aes.c',
        'aes.h',
        'aes-wasm-template.js',
    ]) {
        rc.collect(fs.readFileSync(f, { encoding: 'utf-8' }));
    }

    fs.writeFileSync(
        `aes-${uniqueId}.h`,
        rc.applyReplace(fs.readFileSync('aes.h', { encoding: 'utf-8' }))
    );
    fs.writeFileSync(
        `aes-${uniqueId}.c`,
        rc.applyReplace(fs.readFileSync('aes.c', { encoding: 'utf-8' }))
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
    rc.mapping.set('$$WASM_BASE64$$', fs.readFileSync(`dist/aes${AES_MODE}.wasm`, { encoding: 'base64' }));

    fs.writeFileSync(
        `dist/aes${AES_MODE}-wasm.js`,
        rc.applyReplace(fs.readFileSync('aes-wasm-template.js', { encoding: 'utf-8' }))
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