// =============================================================
// engine/render/Rasterizer.js
// Software triangle rasterizer. NO WebGL, NO Three.js, NO libraries.
//
// Pipeline per triangle:
//   1. Vertex transform (model + view + proj)  ->  clip space
//   2. Clip / reject against near plane
//   3. Perspective divide -> NDC -> screen coords
//   4. Compute screen-space bounding box
//   5. For each pixel: barycentric coords, depth test, shader eval
// =============================================================

import { vec3TransformMat4 } from '../core/Vec3.js';
import { mat4Multiply } from '../core/Mat4.js';

export class Rasterizer {
    constructor(frameBuffer) {
        this.fb = frameBuffer;
        this.viewProj = new Float32Array(16);
        this.model = new Float32Array(16);
        this.mvp = new Float32Array(16);
        this.uniforms = {};
        this.shader = null; // function: (ctx) => void
        this.lights = [];
    }

    setViewProjection(vp) {
        this.viewProj.set(vp);
    }

    setModelMatrix(m) {
        this.model.set(m);
        mat4Multiply(this.mvp, this.viewProj, this.model);
    }

    setShader(fn) {
        this.shader = fn;
    }

    setLights(list) {
        this.lights = list;
    }

    setUniforms(u) {
        this.uniforms = u;
    }

    // Project a vertex through the MVP matrix and perspective divide.
    // Returns [x, y, z, w] in NDC-ish space.
    _project(v) {
        const m = this.mvp;
        const x = v[0], y = v[1], z = v[2];
        const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
        return [
            (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
            (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
            w
        ];
    }

    // Project a vertex through ONLY the model matrix (for world-space varyings)
    _world(v) {
        const m = this.model;
        return [
            m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
            m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
            m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
        ];
    }

    // Draw a single mesh (list of triangles with per-vertex attributes)
    draw(mesh) {
        const fb = this.fb;
        const W = fb.width, H = fb.height;
        const vData = mesh.vertices;     // Float32Array, stride = vertexStride
        const stride = mesh.vertexStride;
        const indices = mesh.indices;    // Uint16Array of triangle indices

        // Per-vertex scratch
        const clipVerts = new Array(mesh.maxVerts);
        const screenVerts = new Array(mesh.maxVerts);
        const worldVerts = new Array(mesh.maxVerts);
        const vtxAttr = mesh.attributes; // { name: offset }

        // 1. transform vertices
        for (let i = 0; i < mesh.maxVerts; i++) {
            const base = i * stride;
            const v = [vData[base + vtxAttr.position], vData[base + vtxAttr.position + 1], vData[base + vtxAttr.position + 2]];
            const world = this._world(v);
            worldVerts[i] = world;
            const clip = this._project(v);
            clipVerts[i] = clip;
            // NDC -> screen
            const sx = (clip[0] * 0.5 + 0.5) * W;
            const sy = (1 - (clip[1] * 0.5 + 0.5)) * H;
            screenVerts[i] = [sx, sy, clip[2], clip[3]];
        }

        // 2. draw triangles
        for (let t = 0; t < indices.length; t += 3) {
            const i0 = indices[t], i1 = indices[t + 1], i2 = indices[t + 2];
            const s0 = screenVerts[i0], s1 = screenVerts[i1], s2 = screenVerts[i2];

            // Near-plane clipping check (simple: if all w <= 0 skip)
            if (s0[3] < 0.05 && s1[3] < 0.05 && s2[3] < 0.05) continue;

            // backface cull via screen-space signed area
            const area = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
            if (Math.abs(area) < 0.001) continue;
            if (mesh.cullBackface && area < 0) continue;

            // Bounding box
            const minX = Math.max(0, Math.min(s0[0], s1[0], s2[0]) | 0);
            const maxX = Math.min(W - 1, Math.max(s0[0], s1[0], s2[0]) | 0);
            const minY = Math.max(0, Math.min(s0[1], s1[1], s2[1]) | 0);
            const maxY = Math.min(H - 1, Math.max(s0[1], s1[1], s2[1]) | 0);
            if (maxX < minX || maxY < minY) continue;

            // Barycentric incremental setup
            const A01 = s0[1] - s1[1], B01 = s1[0] - s0[0];
            const A12 = s1[1] - s2[1], B12 = s2[0] - s1[0];
            const A20 = s2[1] - s0[1], B20 = s0[0] - s2[0];
            const denom = area;

            // Build the per-pixel context once per triangle for the shader
            const ctx = {
                fb,
                lights: this.lights,
                uniforms: this.uniforms,
                tri: { v0: s0, v1: s1, v2: s2, world: [worldVerts[i0], worldVerts[i1], worldVerts[i2]], denom },
                // raw attribute arrays the shader can pull from
                attribs: vData,
                stride,
                offsets: vtxAttr,
                indices: [i0, i1, i2]
            };

            // 3. iterate pixels
            const px = minX + 0.5;
            const py = minY + 0.5;

            // Edge functions at start
            let w0Row = (s1[0] - s0[0]) * (py - s0[1]) - (s1[1] - s0[1]) * (px - s0[0]);
            let w1Row = (s2[0] - s1[0]) * (py - s1[1]) - (s2[1] - s1[1]) * (px - s1[0]);
            let w2Row = (s0[0] - s2[0]) * (py - s2[1]) - (s0[1] - s2[1]) * (px - s2[0]);

            for (let y = minY; y <= maxY; y++) {
                let w0 = w0Row, w1 = w1Row, w2 = w2Row;
                for (let x = minX; x <= maxX; x++) {
                    // Inside test: all edge functions have the same sign as area
                    const inside = denom > 0
                        ? (w0 >= 0 && w1 >= 0 && w2 >= 0)
                        : (w0 <= 0 && w1 <= 0 && w2 <= 0);
                    if (inside) {
                        const u = w0 / denom;
                        const v = w1 / denom;
                        const w = w2 / denom;
                        // Perspective-correct depth: linear interpolate 1/w, then invert
                        const invW = u / s0[3] + v / s1[3] + w / s2[3];
                        if (invW !== 0) {
                            const z = (u * s0[2] / s0[3] + v * s1[2] / s1[3] + w * s2[2] / s2[3]) / invW;
                            const zBuf = fb.getDepth(x, y);
                            if (z < zBuf) {
                                fb.setDepth(x, y, z);
                                // Build barycentric world for shader
                                ctx.bary = [u, v, w];
                                ctx.pixel = [x, y];
                                if (this.shader) {
                                    try {
                                        this.shader(ctx);
                                    } catch (e) {
                                        if (!Rasterizer._logged) { console.error('Shader error:', e.message); Rasterizer._logged = true; }
                                        fb.setPixel(x, y, 255, 0, 255);
                                    }
                                } else {
                                    // default: flat color from uniform
                                    const c = ctx.uniforms.color || [200, 200, 220];
                                    fb.setPixel(x, y, c[0] | 0, c[1] | 0, c[2] | 0);
                                }
                            }
                        }
                    }
                    w0 += A01;
                    w1 += A12;
                    w2 += A20;
                }
                w0Row += B01;
                w1Row += B12;
                w2Row += B20;
            }
        }
    }

    // Draw a list of lines (for debug / wireframes)
    drawLines(lines, color = [255, 255, 255]) {
        const fb = this.fb;
        for (const [a, b] of lines) {
            const wa = this._world(a);
            const wb = this._world(b);
            const ca = this._project(wa);
            const cb = this._project(wb);
            if (ca[3] < 0.05 || cb[3] < 0.05) continue;
            const x0 = (ca[0] * 0.5 + 0.5) * fb.width;
            const y0 = (1 - (ca[1] * 0.5 + 0.5)) * fb.height;
            const x1 = (cb[0] * 0.5 + 0.5) * fb.width;
            const y1 = (1 - (cb[1] * 0.5 + 0.5)) * fb.height;
            this._line(x0, y0, x1, y1, color);
        }
    }

    _line(x0, y0, x1, y1, color) {
        const fb = this.fb;
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        let x = x0 | 0, y = y0 | 0;
        while (true) {
            fb.setPixel(x, y, color[0] | 0, color[1] | 0, color[2] | 0);
            if (x === (x1 | 0) && y === (y1 | 0)) break;
            const e2 = err * 2;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    }
}
