// =============================================================
// engine/shaders/ShaderLibrary.js
// Reusable Lume shaders: lit, water, terrain, sky.
// All written in the Lume DSL defined in ShaderLang.js.
// =============================================================

export const LIT_SHADER = `
// Phong-style lit shader with texture + specular
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 ambient;
uniform float shininess;
uniform float specularStrength;

fn vertex() {
    vNormal = normal;
    vWorldPos = position;
    vUv = uv;
    return position;
}

fn fragment() {
    let N = normalize(vNormal);
    let L = normalize(-lightDir);
    let V = normalize(cameraPos - vWorldPos);
    let H = normalize(L + V);
    let diff = max(dot(N, L), 0.0);
    let spec = pow(max(dot(N, H), 0.0), shininess) * specularStrength;
    let base = vec3(0.8, 0.8, 0.8);
    let col = base * (ambient + diff * lightColor) + lightColor * spec;
    return clamp(col, 0.0, 1.0);
}
`;

export const TEXTURED_SHADER = `
// Lit + texture-mapped shader
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 ambient;
uniform sampler diffuse;

fn vertex() {
    vNormal = normal;
    vWorldPos = position;
    vUv = uv;
    return position;
}

fn fragment() {
    let N = normalize(vNormal);
    let L = normalize(-lightDir);
    let V = normalize(cameraPos - vWorldPos);
    let H = normalize(L + V);
    let diff = max(dot(N, L), 0.0);
    let spec = pow(max(dot(N, H), 0.0), 32.0) * 0.5;
    let tex = texture(diffuse, vUv);
    let base = tex.rgb / 255.0;
    let col = base * (ambient + diff * lightColor) + lightColor * spec;
    return clamp(col, 0.0, 1.0);
}
`;

export const TERRAIN_SHADER = `
// Terrain: lit + grass-vs-sand + height tinting
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 ambient;
uniform sampler diffuse;
uniform float lowY;
uniform float highY;

fn vertex() {
    vNormal = normal;
    vWorldPos = position;
    vUv = uv;
    return position;
}

fn fragment() {
    let N = normalize(vNormal);
    let L = normalize(-lightDir);
    let V = normalize(cameraPos - vWorldPos);
    let H = normalize(L + V);
    let diff = max(dot(N, L), 0.0);
    let spec = pow(max(dot(N, H), 0.0), 24.0) * 0.2;
    let tex = texture(diffuse, vUv);
    let base = tex.rgb / 255.0;
    // height tint
    let h = clamp((vWorldPos.y - lowY) / (highY - lowY), 0.0, 1.0);
    let sand = vec3(0.85, 0.78, 0.55);
    let grass = vec3(0.32, 0.55, 0.22);
    let rock = vec3(0.45, 0.40, 0.35);
    let tint = mix(sand, grass, h);
    tint = mix(tint, rock, h * h);
    let col = (base * 0.6 + tint * 0.4) * (ambient + diff * lightColor) + lightColor * spec;
    return clamp(col, 0.0, 1.0);
}
`;

export const WATER_SHADER = `
// Water surface with animated normals + fresnel + foam
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform float time;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 skyTint;

fn vertex() {
    vNormal = normal;
    vWorldPos = position;
    vUv = uv;
    return position;
}

fn fragment() {
    // perturb the normal using time + uv
    let p = vUv * 8.0;
    let n1 = sin(p.x + time * 0.8) * cos(p.y - time * 0.6);
    let n2 = sin(p.y * 1.3 + time * 0.4) * cos(p.x * 0.9 - time * 0.5);
    let n3 = sin((p.x + p.y) * 0.5 + time * 0.3);
    let N = normalize(vec3(n1 * 0.2, 1.0, n2 * 0.2));
    let L = normalize(-lightDir);
    let V = normalize(cameraPos - vWorldPos);
    let H = normalize(L + V);
    let diff = max(dot(N, L), 0.0);
    let spec = pow(max(dot(N, H), 0.0), 96.0) * 1.2;
    let fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    let base = mix(shallowColor, deepColor, fres);
    let col = base * (0.45 + diff * 0.6) + lightColor * spec + skyTint * fres * 0.4;
    // foam
    let foam = clamp(n3 * 0.5 + 0.5 - 0.7, 0.0, 1.0);
    col = col + vec3(0.9, 0.95, 1.0) * foam * 0.5;
    return clamp(col, 0.0, 1.0);
}
`;

export const FLAT_COLOR_SHADER = `
// Just a uniform color, used for sky and simple objects
attribute vec3 position;
varying vec3 vWorldPos;
uniform vec3 color;
fn vertex() { vWorldPos = position; return position; }
fn fragment() { return color; }
`;

export const FOLIAGE_SHADER = `
// Foliage: lit + slight per-fragment variation
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;
uniform vec3 cameraPos;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform float time;
fn vertex() { vNormal = normal; vWorldPos = position; vUv = uv; return position; }
fn fragment() {
    let N = normalize(vNormal);
    let L = normalize(-lightDir);
    let V = normalize(cameraPos - vWorldPos);
    let wind = sin(vWorldPos.x * 0.3 + time) * 0.05 + cos(vWorldPos.z * 0.4 + time * 0.7) * 0.05;
    let N2 = normalize(N + vec3(wind, 0.0, wind));
    let diff = max(dot(N2, L), 0.0);
    let base = vec3(0.20, 0.55, 0.18) + vec3(0.05) * sin(vWorldPos.y * 2.0);
    return clamp(base * (0.4 + diff * 0.8), 0.0, 1.0);
}
`;
