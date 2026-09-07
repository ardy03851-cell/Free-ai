// =============================================================
// engine/models/ModelBuilder.js
// High-level procedural model API. Models can be assembled from
// primitives in a few lines, then exported/imported as .mdl.
//
//   const pine = new ModelBuilder('pine')
//     .cone(0.7, 4, 9, 0.18, 0.5, 0.2)
//     .cylinder(0.18, 0.18, 1.2, 8)
//     .translate(0, 2.0, 0)
//     .build();
//
// Every chainable method is *additive* — it appends a part and
// returns `this` for the next part. Final .build() composes the
// parts into a single Mesh using MDL semantics under the hood.
// =============================================================

import { loadMDL, exportMDL } from './MDLFormat.js';

export class ModelBuilder {
    constructor(name = 'model') {
        this.name = name;
        this.parts = [];
    }

    // ---- primitive shortcuts ----
    box(w = 1, h = 1, d = 1) {
        this.parts.push({ primitive: 'box', width: w, height: h, depth: d });
        return this;
    }
    sphere(r = 0.5, segs = 16, rings = 10) {
        this.parts.push({ primitive: 'sphere', radius: r, segments: segs, rings });
        return this;
    }
    cylinder(rTop = 0.5, rBot = 0.5, h = 1, segs = 16) {
        this.parts.push({ primitive: 'cylinder', radiusTop: rTop, radiusBottom: rBot, height: h, segments: segs });
        return this;
    }
    cone(r = 0.5, h = 1, segs = 16) {
        this.parts.push({ primitive: 'cone', radius: r, height: h, segments: segs });
        return this;
    }
    plane(w = 1, d = 1) {
        this.parts.push({ primitive: 'plane', width: w, depth: d });
        return this;
    }
    quad() { this.parts.push({ primitive: 'quad' }); return this; }

    // ---- transforms (apply to last part) ----
    translate(x, y, z) {
        const p = this.parts[this.parts.length - 1];
        if (!p) return this;
        p.translate = [x, y, z];
        return this;
    }
    rotate(x, y, z) {
        const p = this.parts[this.parts.length - 1];
        if (!p) return this;
        p.rotate = [x, y, z];
        return this;
    }
    scale(sx, sy, sz) {
        const p = this.parts[this.parts.length - 1];
        if (!p) return this;
        p.scale = [sx, sy, sz];
        return this;
    }
    color(r, g, b) {
        const p = this.parts[this.parts.length - 1];
        if (!p) return this;
        p.color = [r, g, b];
        return this;
    }

    // ---- easy composition helpers ----
    // A pine tree = cone foliage + cylindrical trunk
    pineTree(foliageHeight = 4, trunkHeight = 1.2, trunkRadius = 0.18) {
        this.cone(0.9, foliageHeight, 10)
            .color(0.20, 0.55, 0.20)
            .translate(0, trunkHeight + foliageHeight / 2, 0);
        this.cylinder(trunkRadius, trunkRadius, trunkHeight, 8)
            .color(0.40, 0.25, 0.10)
            .translate(0, trunkHeight / 2, 0);
        return this;
    }

    // A rock = slightly squashed sphere with grey tint
    rock(radius = 0.5) {
        this.sphere(radius, 10, 8)
            .scale(1.1, 0.6, 1.0)
            .color(0.45, 0.42, 0.40);
        return this;
    }

    // A house = box base + pyramid roof
    house(w = 3, d = 3, h = 2.5) {
        this.box(w, h, d)
            .color(0.85, 0.78, 0.65)
            .translate(0, h / 2, 0);
        this.cone(Math.max(w, d) * 0.75, h * 0.7, 4)
            .color(0.6, 0.18, 0.18)
            .translate(0, h + h * 0.35, 0);
        return this;
    }

    // A simple humanoid figure
    figure() {
        this.sphere(0.3, 10, 8).color(0.95, 0.82, 0.68).translate(0, 1.6, 0); // head
        this.box(0.6, 1.0, 0.4).color(0.25, 0.45, 0.85).translate(0, 0.9, 0);  // torso
        this.box(0.2, 0.8, 0.2).color(0.15, 0.25, 0.55).translate(-0.4, 0.8, 0); // arm L
        this.box(0.2, 0.8, 0.2).color(0.15, 0.25, 0.55).translate(0.4, 0.8, 0);  // arm R
        this.box(0.25, 0.8, 0.25).color(0.2, 0.2, 0.2).translate(-0.18, 0.0, 0); // leg L
        this.box(0.25, 0.8, 0.25).color(0.2, 0.2, 0.2).translate(0.18, 0.0, 0);  // leg R
        return this;
    }

    // A floating crystal
    crystal(size = 1) {
        this.cone(size, size * 1.5, 6).color(0.6, 0.85, 1.0).translate(0, size * 0.75, 0);
        this.cone(size, size * 1.5, 6).color(0.4, 0.7, 1.0).scale(1, -1, 1).translate(0, -size * 0.75, 0);
        return this;
    }

    // A torch (cylinder + cone + sphere)
    torch() {
        this.cylinder(0.06, 0.06, 1.4, 8).color(0.4, 0.25, 0.1).translate(0, 0.7, 0);
        this.cone(0.18, 0.4, 8).color(1.0, 0.55, 0.1).translate(0, 1.6, 0);
        this.sphere(0.12, 8, 6).color(1.0, 0.85, 0.2).translate(0, 1.85, 0);
        return this;
    }

    toMDL() {
        return exportMDL({ name: this.name, primitive: this.parts[0]?.primitive, ...this.parts[0], children: this.parts.slice(1) });
    }

    build() {
        // Build each part as its own Mesh, apply its transforms, then combine.
        const meshes = [];
        for (const part of this.parts) {
            const m = makePrimMesh(part);
            if (m) {
                applyPartTransforms(m, part);
                meshes.push(m);
            }
        }
        if (meshes.length === 0) return null;
        if (meshes.length === 1) { meshes[0].name = this.name; return meshes[0]; }
        return Mesh.combine(meshes);
    }

    buildAll() {
        const meshes = [];
        for (const part of this.parts) {
            const m = makePrimMesh(part);
            if (m) {
                applyPartTransforms(m, part);
                meshes.push(m);
            }
        }
        return { name: this.name, meshes, combined: meshes.length > 1 ? Mesh.combine(meshes) : meshes[0] };
    }
}

import { Mesh } from './Mesh.js';

function makePrimMesh(part) {
    switch (part.primitive) {
        case 'box': {
            const w = part.width || 1, h = part.height || 1, d = part.depth || 1;
            const x = w / 2, y = h / 2, z = d / 2;
            const v = [
                -x,-y,z, 0,0,1,0,0,  x,-y,z, 0,0,1,1,0,  x,y,z, 0,0,1,1,1,  -x,y,z, 0,0,1,0,1,
                x,-y,-z, 0,0,-1,0,0, -x,-y,-z, 0,0,-1,1,0, -x,y,-z, 0,0,-1,1,1,  x,y,-z, 0,0,-1,0,1,
                -x,y,z, 0,1,0,0,0,  x,y,z, 0,1,0,1,0,  x,y,-z, 0,1,0,1,1, -x,y,-z, 0,1,0,0,1,
                -x,-y,-z, 0,-1,0,0,0,  x,-y,-z, 0,-1,0,1,0,  x,-y,z, 0,-1,0,1,1, -x,-y,z, 0,-1,0,0,1,
                x,-y,z, 1,0,0,0,0,  x,-y,-z, 1,0,0,1,0,  x,y,-z, 1,0,0,1,1,  x,y,z, 1,0,0,0,1,
                -x,-y,-z, -1,0,0,0,0, -x,-y,z, -1,0,0,1,0, -x,y,z, -1,0,0,1,1, -x,y,-z, -1,0,0,0,1
            ];
            const idx = [];
            for (let f = 0; f < 6; f++) {
                const o = f * 4;
                idx.push(o, o+1, o+2, o, o+2, o+3);
            }
            return Mesh.fromArrays('box', v, idx, 8);
        }
        case 'sphere': return makeSpherePrim(part.radius || 0.5, part.segments || 16, part.rings || 10);
        case 'cylinder': return makeCylinderPrim(part.radiusTop || part.radius || 0.5, part.radiusBottom || part.radius || 0.5, part.height || 1, part.segments || 16);
        case 'cone': return makeCylinderPrim(0, part.radius || 0.5, part.height || 1, part.segments || 16);
        case 'plane': {
            const w = part.width || 1, d = part.depth || 1;
            const x = w/2, z = d/2;
            const v = [-x,0,z,0,1,0,0,0, x,0,z,0,1,0,1,0, x,0,-z,0,1,0,1,1, -x,0,-z,0,1,0,0,1];
            return Mesh.fromArrays('plane', v, [0,1,2,0,2,3], 8);
        }
        case 'quad': {
            const v = [-0.5,0,0.5,0,1,0,0,0, 0.5,0,0.5,0,1,0,1,0, 0.5,0,-0.5,0,1,0,1,1, -0.5,0,-0.5,0,1,0,0,1];
            return Mesh.fromArrays('quad', v, [0,1,2,0,2,3], 8);
        }
    }
    return null;
}

function makeSpherePrim(radius = 0.5, segs = 16, rings = 10) {
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
            const nx = px / radius, ny = py / radius, nz = pz / radius;
            verts.push(px, py, pz, nx, ny, nz, u, v);
        }
    }
    const stride = segs + 1;
    for (let y = 0; y < rings; y++) {
        for (let x = 0; x < segs; x++) {
            const a = y * stride + x;
            idx.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
        }
    }
    return Mesh.fromArrays('sphere', verts, idx, 8);
}

function makeCylinderPrim(rTop = 0.5, rBot = 0.5, h = 1, segs = 16) {
    const verts = [];
    const idx = [];
    const half = h / 2;
    for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const t = u * Math.PI * 2;
        const cx = Math.cos(t), cz = Math.sin(t);
        verts.push(cx * rBot, -half, cz * rBot, cx, 0, cz, u, 0);
        verts.push(cx * rTop,  half, cz * rTop, cx, 0, cz, u, 1);
    }
    for (let i = 0; i < segs; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const topCenter = verts.length / 8;
    verts.push(0, half, 0, 0, 1, 0, 0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const t = u * Math.PI * 2;
        verts.push(Math.cos(t) * rTop, half, Math.sin(t) * rTop, 0, 1, 0, 0.5 + Math.cos(t) * 0.5, 0.5 + Math.sin(t) * 0.5);
    }
    for (let i = 0; i < segs; i++) {
        const a = topCenter + 1 + i;
        idx.push(topCenter, a + 1, a);
    }
    const botCenter = verts.length / 8;
    verts.push(0, -half, 0, 0, -1, 0, 0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const t = u * Math.PI * 2;
        verts.push(Math.cos(t) * rBot, -half, Math.sin(t) * rBot, 0, -1, 0, 0.5 + Math.cos(t) * 0.5, 0.5 + Math.sin(t) * 0.5);
    }
    for (let i = 0; i < segs; i++) {
        const a = botCenter + 1 + i;
        idx.push(botCenter, a, a + 1);
    }
    return Mesh.fromArrays('cylinder', verts, idx, 8);
}

function applyPartTransforms(mesh, part) {
    if (part.translate) {
        mesh.translate(part.translate[0], part.translate[1], part.translate[2]);
    }
    if (part.rotate) {
        if (part.rotate[0]) mesh.rotateX(part.rotate[0] * Math.PI / 180);
        if (part.rotate[1]) mesh.rotateY(part.rotate[1] * Math.PI / 180);
        if (part.rotate[2]) mesh.rotateZ(part.rotate[2] * Math.PI / 180);
    }
    if (part.scale) mesh.scale(part.scale[0], part.scale[1], part.scale[2]);
    if (part.color) mesh.tint(part.color[0], part.color[1], part.color[2]);
}
