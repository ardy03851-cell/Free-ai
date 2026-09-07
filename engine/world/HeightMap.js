// =============================================================
// engine/world/HeightMap.js
// Heightmap representation: a 2D grid of elevation values that
// can be queried, sampled bilinearly, and used to generate
// terrain meshes + drive water level / shoreline.
// =============================================================

import { fbm2D, ridgedNoise } from './Noise.js';

export class HeightMap {
    constructor(size, scale = 1) {
        this.size = size;       // resolution (size x size)
        this.scale = scale;     // world units between samples
        this.data = new Float32Array(size * size);
    }

    getIndex(x, y) {
        return (y * this.size + x) | 0;
    }

    get(x, y) {
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) return 0;
        return this.data[this.getIndex(x, y)];
    }

    set(x, y, v) {
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
        this.data[this.getIndex(x, y)] = v;
    }

    // Bilinear sample at world coords
    sample(wx, wz) {
        const fx = wx / this.scale + this.size / 2;
        const fz = wz / this.scale + this.size / 2;
        const x0 = Math.floor(fx), z0 = Math.floor(fz);
        const x1 = x0 + 1, z1 = z0 + 1;
        const tx = fx - x0, tz = fz - z0;
        const a = this.get(x0, z0);
        const b = this.get(x1, z0);
        const c = this.get(x0, z1);
        const d = this.get(x1, z1);
        return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }

    // Generate a procedural heightmap using fBm + ridged
    generateProcedural(opts = {}) {
        const {
            baseFreq = 0.02,
            octaves = 5,
            amplitude = 8,
            island = true,
            mountain = true,
            seed = 0
        } = opts;
        const cx = this.size / 2, cy = this.size / 2;
        const maxR = this.size * 0.55;
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const wx = (x + seed) * baseFreq;
                const wy = (y + seed) * baseFreq;
                let h = fbm2D(wx, wy, octaves) * 0.6;
                h += ridgedNoise(wx * 0.5, wy * 0.5, 4) * 0.4;
                h *= amplitude;
                if (island) {
                    const dx = x - cx, dy = y - cy;
                    const r = Math.hypot(dx, dy) / maxR;
                    const falloff = Math.max(0, 1 - r * r);
                    h *= falloff;
                    h -= (1 - falloff) * amplitude * 0.5;
                }
                if (mountain) {
                    const m = ridgedNoise(wx * 0.3, wy * 0.3, 3);
                    h += m * 4 * Math.max(0, fbm2D(wx * 0.1, wy * 0.1, 2));
                }
                this.set(x, y, h);
            }
        }
        return this;
    }

    // Find water level so a target fraction of map is below water
    findWaterLevel(targetBelow = 0.5) {
        const sorted = Array.from(this.data).sort((a, b) => a - b);
        return sorted[Math.floor(this.data.length * targetBelow)];
    }
}
