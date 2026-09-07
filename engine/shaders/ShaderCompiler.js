// =============================================================
// engine/shaders/ShaderCompiler.js
// Bridges Lume AST into per-pixel function callable by rasterizer.
// Varyings are produced by the vertex stage for each triangle vertex,
// then interpolated perspective-correctly for each pixel.
// =============================================================

import { compileShader, execFn } from './ShaderLang.js';

export class ShaderProgram {
    constructor(source) {
        this.compiled = compileShader(source);
    }
}

// Build a per-triangle, per-pixel shader callable by the rasterizer.
export function makeRasterizerShader(prog, samplerBindings = {}) {
    return (ctx) => {
        const { bary, tri, attribs, stride, offsets, indices, uniforms } = ctx;

        const vertFn = prog.compiled.fns['vertex'];
        const fragFn = prog.compiled.fns['fragment'];
        if (!fragFn) {
            ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], 255, 0, 255);
            return;
        }

        // Run the vertex stage for each of the 3 triangle vertices to get their
        // varying values.
        const vary = [{}, {}, {}];
        for (let v = 0; v < 3; v++) {
            const i = indices[v];
            const a = {};
            for (const name in prog.compiled.attributes) {
                const o = offsets[name];
                if (o === undefined) continue;
                if (prog.compiled.attributes[name] === 'vec3') {
                    a[name] = [
                        attribs[i * stride + o],
                        attribs[i * stride + o + 1],
                        attribs[i * stride + o + 2]
                    ];
                } else if (prog.compiled.attributes[name] === 'vec2') {
                    a[name] = [
                        attribs[i * stride + o],
                        attribs[i * stride + o + 1]
                    ];
                } else {
                    a[name] = attribs[i * stride + o];
                }
            }
            if (vertFn) {
                const r = execFn(vertFn, a, uniforms || {});
                vary[v] = r.out;
            } else {
                vary[v] = { ...a };
            }
        }

        // Perspective-correct interpolation
        const varyings = {};
        const u0 = bary[0], u1 = bary[1], u2 = bary[2];
        const w0 = tri.v0[3], w1 = tri.v1[3], w2 = tri.v2[3];
        const invW = u0 / w0 + u1 / w1 + u2 / w2;
        const names = new Set([...Object.keys(vary[0]), ...Object.keys(vary[1]), ...Object.keys(vary[2])]);
        for (const name of names) {
            const a0 = vary[0][name], a1 = vary[1][name], a2 = vary[2][name];
            if (a0 === undefined || a1 === undefined || a2 === undefined) continue;
            if (Array.isArray(a0)) {
                const out = [];
                for (let c = 0; c < a0.length; c++) {
                    const num = u0 * a0[c] / w0 + u1 * a1[c] / w1 + u2 * a2[c] / w2;
                    out.push(num / invW);
                }
                varyings[name] = out;
            } else {
                const num = u0 * a0 / w0 + u1 * a1 / w1 + u2 * a2 / w2;
                varyings[name] = num / invW;
            }
        }

        // Inject world position for shaders that want it
        const wpos = [
            u0 * tri.world[0][0] / w0 + u1 * tri.world[1][0] / w1 + u2 * tri.world[2][0] / w2,
            u0 * tri.world[0][1] / w0 + u1 * tri.world[1][1] / w1 + u2 * tri.world[2][1] / w2,
            u0 * tri.world[0][2] / w0 + u1 * tri.world[1][2] / w1 + u2 * tri.world[2][2] / w2
        ];
        varyings.__worldPos = [wpos[0] / invW, wpos[1] / invW, wpos[2] / invW];

        // Merge samplers
        const u = Object.assign({}, uniforms, samplerBindings);
        try {
            const r = execFn(fragFn, {}, u);
            // Inject the interpolated varyings into the attribs the fragment fn reads
            // (we do this by re-running with the varyings as attribs).
            const r2 = execFn(fragFn, varyings, u);
            const ret = r2.ret !== undefined ? r2.ret : r.ret;
            if (Array.isArray(ret) && ret.length >= 3) {
                const fr = Math.max(0, Math.min(255, (ret[0] || 0) * 255));
                const fg = Math.max(0, Math.min(255, (ret[1] || 0) * 255));
                const fb = Math.max(0, Math.min(255, (ret[2] || 0) * 255));
                ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], fr | 0, fg | 0, fb | 0);
            } else if (typeof ret === 'number') {
                const v = Math.max(0, Math.min(255, ret * 255));
                ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], v | 0, v | 0, v | 0);
            } else {
                ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], 200, 200, 200);
            }
        } catch (e) {
            if (!makeRasterizerShader._logged) { console.error('Shader frag error:', e.message); makeRasterizerShader._logged = true; }
            ctx.fb.setPixel(ctx.pixel[0], ctx.pixel[1], 255, 0, 255);
        }
    };
}
