// =============================================================
// engine/core/Vec3.js
// 3D vector math. All vectors are plain arrays [x,y,z] to keep
// allocation pressure low — the rasterizer runs hot.
// =============================================================

export function vec3(x = 0, y = 0, z = 0) {
    return [x, y, z];
}

export function vec3Copy(a) {
    return [a[0], a[1], a[2]];
}

export function vec3Set(out, x, y, z) {
    out[0] = x; out[1] = y; out[2] = z;
    return out;
}

export function vec3Add(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
}

export function vec3Sub(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
}

export function vec3Scale(out, a, s) {
    out[0] = a[0] * s;
    out[1] = a[1] * s;
    out[2] = a[2] * s;
    return out;
}

export function vec3Dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
}

export function vec3Length(a) {
    return Math.hypot(a[0], a[1], a[2]);
}

export function vec3Normalize(out, a) {
    const len = Math.hypot(a[0], a[1], a[2]);
    if (len > 1e-8) {
        const inv = 1 / len;
        out[0] = a[0] * inv;
        out[1] = a[1] * inv;
        out[2] = a[2] * inv;
    } else {
        out[0] = 0; out[1] = 0; out[2] = 0;
    }
    return out;
}

export function vec3Lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
}

export function vec3TransformMat4(out, a, m) {
    const x = a[0], y = a[1], z = a[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
}
