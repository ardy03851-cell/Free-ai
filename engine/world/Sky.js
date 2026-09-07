// =============================================================
// engine/world/Sky.js
// Procedural sky: a large inverted sphere with a custom shader
// that produces a day/night gradient with a soft sun disc.
// Implemented entirely in our Lume shader DSL.
// =============================================================

import { Mesh } from '../models/Mesh.js';

export function buildSkyDome(radius = 400) {
    const segs = 24, rings = 12;
    const verts = [];
    const idx = [];
    for (let y = 0; y <= rings; y++) {
        const v = y / rings;
        const phi = v * Math.PI;
        for (let x = 0; x <= segs; x++) {
            const u = x / segs;
            const theta = u * Math.PI * 2;
            const px = Math.cos(theta) * Math.sin(phi) * radius;
            const py = Math.cos(phi) * radius;
            const pz = Math.sin(theta) * Math.sin(phi) * radius;
            // outward normal
            const nx = px / radius, ny = py / radius, nz = pz / radius;
            verts.push(px, py, pz, nx, ny, nz, u, v);
        }
    }
    const stride = segs + 1;
    for (let y = 0; y < rings; y++) {
        for (let x = 0; x < segs; x++) {
            const a = y * stride + x;
            const b = a + 1;
            const c = a + stride;
            const d = c + 1;
            idx.push(a, b, c, b, d, c);
        }
    }
    const mesh = new Mesh();
    mesh.name = 'skydome';
    mesh.cullBackface = false;
    mesh.vertices = new Float32Array(verts);
    mesh.indices = new Uint16Array(idx);
    mesh.maxVerts = verts.length / 8;
    mesh.attributes = { position: 0, normal: 3, uv: 6 };
    return mesh;
}

export const SKY_SHADER = `
// Day/night sky with sun
attribute vec3 position;
attribute vec3 normal;
varying vec3 vWorldPos;
varying vec3 vDir;
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform float time;

fn vertex() {
    vDir = normalize(position);
    vWorldPos = position;
    return position;
}

fn fragment() {
    let D = normalize(vDir);
    let sunD = normalize(sunDir);
    let h = clamp(D.y, -0.2, 1.0);
    let t = pow(max(h, 0.0), 0.4);
    let sky = mix(horizon, zenith, t);
    // sun disc
    let sun = max(dot(D, sunD), 0.0);
    let disc = pow(sun, 800.0);
    let halo = pow(sun, 16.0) * 0.3;
    // cloud band
    let cloud = sin(D.x * 4.0 + time * 0.05) * cos(D.z * 5.0) * 0.5 + 0.5;
    cloud = cloud * smoothstep(0.0, 0.4, D.y) * (1.0 - smoothstep(0.5, 0.9, D.y));
    let col = sky + sunColor * (disc + halo) + vec3(1.0, 0.95, 0.9) * cloud * 0.15;
    return clamp(col, 0.0, 1.0);
}
`;
