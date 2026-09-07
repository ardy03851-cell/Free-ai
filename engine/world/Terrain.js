// =============================================================
// engine/world/Terrain.js
// Builds a Mesh from a HeightMap and computes per-vertex normals.
// Also provides shoreline / water-level helpers.
// =============================================================

import { Mesh } from '../models/Mesh.js';
import { HeightMap } from './HeightMap.js';

export class Terrain {
    constructor(heightMap, waterLevel = 0) {
        this.hm = heightMap;
        this.waterLevel = waterLevel;
        this.mesh = this._build();
        this.bounds = this._computeBounds();
    }

    _build() {
        const hm = this.hm;
        const size = hm.size;
        const mesh = new Mesh();
        mesh.name = 'terrain';
        mesh.cullBackface = true;
        const verts = new Float32Array(size * size * 8);
        const idx = new Uint32Array((size - 1) * (size - 1) * 6);

        // Fill positions
        let v = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const px = (x - size / 2) * hm.scale;
                const pz = (y - size / 2) * hm.scale;
                const py = hm.get(x, y);
                const u = x / (size - 1);
                const vv = y / (size - 1);
                verts[v++] = px;
                verts[v++] = py;
                verts[v++] = pz;
                verts[v++] = 0; verts[v++] = 1; verts[v++] = 0;
                verts[v++] = u; verts[v++] = vv;
            }
        }

        // Indices
        let i = 0;
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                const a = y * size + x;
                const b = a + 1;
                const c = a + size;
                const d = c + 1;
                idx[i++] = a; idx[i++] = c; idx[i++] = b;
                idx[i++] = b; idx[i++] = c; idx[i++] = d;
            }
        }

        // Compute normals
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                const hL = hm.get(Math.max(0, x - 1), y);
                const hR = hm.get(Math.min(size - 1, x + 1), y);
                const hU = hm.get(x, Math.max(0, y - 1));
                const hD = hm.get(x, Math.min(size - 1, y + 1));
                const nx = (hL - hR) * hm.scale;
                const nz = (hU - hD) * hm.scale;
                const ny = 2 * hm.scale * hm.scale;
                const l = Math.hypot(nx, ny, nz) || 1;
                const n = [nx / l, ny / l, nz / l];
                const base = (y * size + x) * 8 + 3;
                verts[base] = n[0]; verts[base + 1] = n[1]; verts[base + 2] = n[2];
            }
        }

        mesh.vertices = verts;
        mesh.indices = new Uint16Array(idx.buffer, idx.byteOffset, idx.length);
        mesh.maxVerts = size * size;
        mesh.attributes = { position: 0, normal: 3, uv: 6 };
        return mesh;
    }

    _computeBounds() {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        const v = this.mesh.vertices;
        for (let i = 0; i < v.length; i += 8) {
            const x = v[i], y = v[i + 1], z = v[i + 2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        }
        return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
    }

    // Height at world (x, z)
    heightAt(x, z) {
        return this.hm.sample(x, z);
    }

    // Is world position underwater?
    isUnderwater(x, z) {
        return this.hm.sample(x, z) < this.waterLevel;
    }

    static fromProcedural(opts = {}) {
        const size = opts.size || 128;
        const scale = opts.scale || 1.5;
        const hm = new HeightMap(size, scale);
        hm.generateProcedural({ ...opts });
        const wl = opts.waterLevel !== undefined ? opts.waterLevel : hm.findWaterLevel(opts.targetBelow || 0.5);
        return new Terrain(hm, wl);
    }
}
