// =============================================================
// engine/core/Vec2.js
// 2D vector helpers used for screen-space rasterization.
// =============================================================

export function vec2(x = 0, y = 0) {
    return [x, y];
}

export function vec2Lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    return out;
}

export function vec2Barycentric(p, a, b, c) {
    // Returns barycentric (u,v,w) where p = u*a + v*b + w*c
    const v0x = b[0] - a[0], v0y = b[1] - a[1];
    const v1x = c[0] - a[0], v1y = c[1] - a[1];
    const v2x = p[0] - a[0], v2y = p[1] - a[1];
    const d00 = v0x * v0x + v0y * v0y;
    const d01 = v0x * v1x + v0y * v1y;
    const d11 = v1x * v1x + v1y * v1y;
    const d20 = v2x * v0x + v2y * v0y;
    const d21 = v2x * v1x + v2y * v1y;
    const denom = d00 * d11 - d01 * d01;
    if (denom === 0) return [0, 0, 0];
    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;
    return [u, v, w];
}
