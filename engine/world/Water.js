// =============================================================
// engine/world/Water.js
// Water surface mesh + animated wave system. The surface is a
// grid of vertices that displaces vertically with a sin/cos
// wave function over time, giving realistic water height.
// =============================================================

import { Mesh } from '../models/Mesh.js';

export class Water {
    constructor(extent, level, resolution = 64) {
        this.extent = extent;
        this.level = level;
        this.res = resolution;
        this.time = 0;
        this.mesh = this._build();
    }

    _build() {
        const m = new Mesh();
        m.name = 'water';
        m.cullBackface = false;
        const N = this.res;
        const verts = new Float32Array(N * N * 8);
        const idx = new Uint32Array((N - 1) * (N - 1) * 6);
        let v = 0;
        for (let z = 0; z < N; z++) {
            for (let x = 0; x < N; x++) {
                const px = (x / (N - 1) - 0.5) * this.extent;
                const pz = (z / (N - 1) - 0.5) * this.extent;
                const u = x / (N - 1);
                const vv = z / (N - 1);
                verts[v++] = px;
                verts[v++] = this.level;
                verts[v++] = pz;
                verts[v++] = 0; verts[v++] = 1; verts[v++] = 0;
                verts[v++] = u; verts[v++] = vv;
            }
        }
        let i = 0;
        for (let z = 0; z < N - 1; z++) {
            for (let x = 0; x < N - 1; x++) {
                const a = z * N + x;
                const b = a + 1;
                const c = a + N;
                const d = c + 1;
                idx[i++] = a; idx[i++] = c; idx[i++] = b;
                idx[i++] = b; idx[i++] = c; idx[i++] = d;
            }
        }
        m.vertices = verts;
        m.indices = new Uint16Array(idx.buffer, idx.byteOffset, idx.length);
        m.maxVerts = N * N;
        m.attributes = { position: 0, normal: 3, uv: 6 };
        return m;
    }

    update(dt) {
        this.time += dt;
        const v = this.mesh.vertices;
        const N = this.res;
        const t = this.time;
        // Gerstner-ish waves: stack of 3 sines
        for (let z = 0; z < N; z++) {
            for (let x = 0; x < N; x++) {
                const o = (z * N + x) * 8;
                const px = v[o], pz = v[o + 2];
                const w1 = Math.sin(px * 0.4 + t * 1.2) * Math.cos(pz * 0.3 + t * 0.8);
                const w2 = Math.sin(px * 0.9 - t * 1.5) * 0.5;
                const w3 = Math.cos(pz * 0.7 + t * 0.6) * 0.3;
                v[o + 1] = this.level + (w1 + w2 + w3) * 0.15;
                // approximate normal from finite differences
                const dx = (Math.cos(px * 0.4 + t * 1.2) * 0.4 * Math.cos(pz * 0.3 + t * 0.8)) * 0.15;
                const dz = -(Math.sin(px * 0.4 + t * 1.2) * Math.sin(pz * 0.3 + t * 0.8) * 0.3) * 0.15;
                v[o + 3] = -dx; v[o + 4] = 1; v[o + 5] = -dz;
                const l = Math.hypot(v[o + 3], v[o + 4], v[o + 5]) || 1;
                v[o + 3] /= l; v[o + 4] /= l; v[o + 5] /= l;
            }
        }
    }
}
