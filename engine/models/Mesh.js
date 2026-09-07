// =============================================================
// engine/models/Mesh.js
// In-memory mesh: an interleaved vertex buffer with per-vertex
// position, normal, and uv, plus an index buffer.
// =============================================================

export class Mesh {
    constructor() {
        // Interleaved: [px,py,pz, nx,ny,nz, u,v]
        this.vertices = [];
        this.indices = [];
        this.vertexStride = 8;
        this.maxVerts = 0;
        this.name = '';
        this.cullBackface = true;
    }

    static fromArrays(name, flatVerts, indices, stride = 8) {
        const m = new Mesh();
        m.name = name;
        m.vertices = new Float32Array(flatVerts.length);
        for (let i = 0; i < flatVerts.length; i++) m.vertices[i] = flatVerts[i];
        m.indices = new Uint16Array(indices);
        m.maxVerts = m.vertices.length / stride;
        m.attributes = { position: 0, normal: 3, uv: 6 };
        return m;
    }

    // Recompute normals from positions (flat shading)
    recomputeNormals() {
        const v = this.vertices, idx = this.indices;
        for (let i = 0; i < this.maxVerts * 8; i += 8) {
            v[i + 3] = 0; v[i + 4] = 0; v[i + 5] = 0;
        }
        for (let t = 0; t < idx.length; t += 3) {
            const a = idx[t] * 8, b = idx[t + 1] * 8, c = idx[t + 2] * 8;
            const ax = v[a], ay = v[a + 1], az = v[a + 2];
            const bx = v[b], by = v[b + 1], bz = v[b + 2];
            const cx = v[c], cy = v[c + 1], cz = v[c + 2];
            const ux = bx - ax, uy = by - ay, uz = bz - az;
            const vx = cx - ax, vy = cy - ay, vz = cz - az;
            const nx = uy * vz - uz * vy;
            const ny = uz * vx - ux * vz;
            const nz = ux * vy - uy * vx;
            v[a + 3] += nx; v[a + 4] += ny; v[a + 5] += nz;
            v[b + 3] += nx; v[b + 4] += ny; v[b + 5] += nz;
            v[c + 3] += nx; v[c + 4] += ny; v[c + 5] += nz;
        }
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8 + 3;
            const x = v[o], y = v[o + 1], z = v[o + 2];
            const l = Math.hypot(x, y, z) || 1;
            v[o] = x / l; v[o + 1] = y / l; v[o + 2] = z / l;
        }
    }

    translate(x, y, z) {
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8;
            this.vertices[o] += x; this.vertices[o + 1] += y; this.vertices[o + 2] += z;
        }
    }

    rotateY(rad) {
        const s = Math.sin(rad), c = Math.cos(rad);
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8;
            const x = this.vertices[o], z = this.vertices[o + 2];
            this.vertices[o] = x * c + z * s;
            this.vertices[o + 2] = -x * s + z * c;
            // also rotate normal
            const nx = this.vertices[o + 3], nz = this.vertices[o + 5];
            this.vertices[o + 3] = nx * c + nz * s;
            this.vertices[o + 5] = -nx * s + nz * c;
        }
    }

    rotateX(rad) {
        const s = Math.sin(rad), c = Math.cos(rad);
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8;
            const y = this.vertices[o + 1], z = this.vertices[o + 2];
            this.vertices[o + 1] = y * c - z * s;
            this.vertices[o + 2] = y * s + z * c;
        }
    }

    scale(sx, sy, sz) {
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8;
            this.vertices[o] *= sx;
            this.vertices[o + 1] *= sy;
            this.vertices[o + 2] *= sz;
            this.vertices[o + 6] *= sx;
            this.vertices[o + 7] *= sy;
        }
    }

    scaleUV(su, sv) {
        for (let i = 0; i < this.maxVerts; i++) {
            const o = i * 8;
            this.vertices[o + 6] *= su;
            this.vertices[o + 7] *= sv;
        }
    }

    tint(r, g, b) {
        // Apply a color modulation stored in the uv.x = packed r, uv.y = packed g?
        // We piggyback tint via a per-vertex multiplier in the lit shader — easiest:
        // write a small marker bit on uv2 — but we don't have uv2.
        // So we store tint in a Float32Array side-channel.
        if (!this.tintR) { this.tintR = new Float32Array(this.maxVerts); this.tintG = new Float32Array(this.maxVerts); this.tintB = new Float32Array(this.maxVerts); }
        for (let i = 0; i < this.maxVerts; i++) { this.tintR[i] = r; this.tintG[i] = g; this.tintB[i] = b; }
    }

    applyParentTransform(t, r, s, parentColor) {
        if (r) {
            this.rotateX((r[0] || 0) * Math.PI / 180);
            this.rotateY((r[1] || 0) * Math.PI / 180);
            this.rotateZ((r[2] || 0) * Math.PI / 180);
        }
        this.scale(s[0] || 1, s[1] || 1, s[2] || 1);
        this.translate(t[0] || 0, t[1] || 0, t[2] || 0);
        if (parentColor) this.tint(parentColor[0], parentColor[1], parentColor[2]);
    }

    static combine(meshes) {
        const out = new Mesh();
        out.name = meshes.map(m => m.name).join('+');
        let totalV = 0, totalI = 0;
        for (const m of meshes) { totalV += m.maxVerts; totalI += m.indices.length; }
        out.vertices = new Float32Array(totalV * 8);
        out.indices = new Uint16Array(totalI);
        out.attributes = { position: 0, normal: 3, uv: 6 };
        let vo = 0, io = 0;
        for (const m of meshes) {
            out.vertices.set(m.vertices, vo * 8);
            for (let i = 0; i < m.indices.length; i++) {
                out.indices[io++] = m.indices[i] + vo;
            }
            vo += m.maxVerts;
        }
        out.maxVerts = totalV;
        return out;
    }
}
