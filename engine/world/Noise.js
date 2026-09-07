// =============================================================
// engine/world/Noise.js
// Value noise + multi-octave fBm. Used to build procedural
// heightmaps for terrain and animated water surfaces.
// =============================================================

// Deterministic hash for tileable noise
function hash2(ix, iy) {
    let h = ix * 374761393 + iy * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return ((h >>> 0) / 0xFFFFFFFF) * 2 - 1;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

export function valueNoise2D(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = hash2(ix, iy);
    const b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1);
    const d = hash2(ix + 1, iy + 1);
    const ux = smoothstep(fx);
    const uy = smoothstep(fy);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

export function fbm2D(x, y, octaves = 5, lacunarity = 2.0, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * valueNoise2D(x * freq, y * freq);
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / norm;
}

export function ridgedNoise(x, y, octaves = 5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
        let n = 1 - Math.abs(valueNoise2D(x * freq, y * freq));
        n = n * n;
        sum += amp * n;
        norm += amp;
        amp *= 0.5;
        freq *= 2.0;
    }
    return sum / norm;
}
