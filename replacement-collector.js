const fs = require('fs');

const xmur3 = h => () => {
    h = Math.imul(h ^ h >>> 16, 0x85EBCA6B);
    h = Math.imul(h ^ h >>> 13, 0xC2B2AE35);
    return (h ^= h >>> 16) >>> 0;
};

/**
 * @param {Array} arr
 * @param {Function} rng
 */
const shuffleArray = (arr, rng = () => Math.random() * 0xFFFFFFFF >>> 0) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = rng() % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
};

/**
 * @param {Number} num
 * @param {Array<String>} charset
 * @param {seed} [seed]
 * @returns {String}
 */
const baseConvertId = (num, charset, seed) => {
    const base = charset.length;
    let result = '';
    charset = charset.slice();
    do {
        const rng = xmur3(seed);
        shuffleArray(charset, rng);
        const char = charset[num % base];
        result = char + result;
        seed ^= rng() ^ char.charCodeAt();
        num = Math.floor(num / base);
    } while (num);
    return result;
}

class ReplacementCollector {
    /** @property {RegExp} */
    #pattern;
    /** @property {Number} */
    #counter;
    /** @property {String} */
    #charset;
    /** @property {Number} */
    #seed;
    /** @property {Map} */
    mapping;

    /**
     * @param {RegExp} pattern
     * @param {Map<String, String>} [mapping]
     */
    constructor(pattern, mapping = new Map) {
        this.#pattern = pattern;
        if (mapping instanceof Object) {
            this.mapping = new Map;
            for (const key in mapping) {
                this.mapping.set(key, mapping[key]);
            }
        } else {
            this.mapping = mapping;
        }
        this.#counter = 0;
        this.#charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        this.#seed = (Date.now() & 0xFFFFFFFF) >>> 0;
    }

    /**
     * @param {String} str
     */
    collect(str) {
        for (const match of str.matchAll(this.#pattern)) {
            const key = match[0];
            if (!this.mapping.has(key)) {
                this.mapping.set(key, baseConvertId(this.#counter, this.#charset, this.#seed));
                this.#counter++;
            }
        }
    }

    /**
     * @param {String} str
     * @returns {String}
     */
    applyReplace(str) {
        for (const [key, value] of this.mapping[Symbol.iterator]()) {
            if (value !== null) {
                str = str.replace(
                    new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                    value
                );
            }
        }
        return str;
    }
}

module.exports = ReplacementCollector;
