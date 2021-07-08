const childProcess = require('child_process');
const fs = require('fs');
const ReplacementCollector = require('./replacement-collector.js');

if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
}
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
        'src/aes.c',
        'src/aes.h',
        'aes-wasm-template.js',
    ]) {
        rc.collect(fs.readFileSync(f, { encoding: 'utf-8' }));
    }

    fs.writeFileSync(
        `src/aes-${uniqueId}.h`,
        rc.applyReplace(fs.readFileSync('src/aes.h', { encoding: 'utf-8' }))
    );
    fs.writeFileSync(
        `src/aes-${uniqueId}.c`,
        rc.applyReplace(fs.readFileSync('src/aes.c', { encoding: 'utf-8' }))
    );
    childProcess.spawnSync(
        'emcc',
        [
            `src/aes-${uniqueId}.c`,
            '-O3',
            '-v',
            '-s', 'SIDE_MODULE=2',
            '-D', `AES${AES_MODE}=1`,
            '-o', `dist/aes${AES_MODE}.wasm`,
        ],
        {
            stdio: ['ignore', 1, 2],
        }
    );
    fs.unlinkSync(`src/aes-${uniqueId}.h`);
    fs.unlinkSync(`src/aes-${uniqueId}.c`);
    rc.mapping.set('$$WASM_BASE64$$', fs.readFileSync(`dist/aes${AES_MODE}.wasm`, { encoding: 'base64' }));

    fs.writeFileSync(
        `dist/aes${AES_MODE}-wasm.js`,
        rc.applyReplace(fs.readFileSync('aes-wasm-template.js', { encoding: 'utf-8' }))
    );
    fs.copyFileSync('aes-wasm-template.d.ts', `dist/aes${AES_MODE}-wasm.d.ts`);
    childProcess.spawnSync(
        'terser',
        [
            '--ecma', '2020',
            '--compress', 'unsafe_math,unsafe_methods,unsafe_proto,unsafe_regexp,unsafe_undefined,passes=2',
            '--mangle',
            '--mangle-props', 'keep_quoted',
            '--comments', 'false',
            '--output', `dist/aes${AES_MODE}-wasm.min.js`,
            `dist/aes${AES_MODE}-wasm.js`,
        ],
        {
            stdio: ['ignore', 1, 2],
        }
    );
    fs.copyFileSync('aes-wasm-template.d.ts', `dist/aes${AES_MODE}-wasm.min.d.ts`);
}