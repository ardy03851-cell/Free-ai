// =============================================================
// engine/models/MDLFormat.js
// LumeMDL — a brand-new declarative model format designed so that
// 3D meshes can be authored VERY EASILY.
//
// Example (.mdl text):
//
//   # LumeMDL v1
//   name: tree_pine
//   primitive: cone
//   segments: 8
//   height: 4.0
//   radius: 0.7
//   stack: {
//     translate: [0, 0, 0]
//     color: [0.3, 0.6, 0.2]
//   }
//   child: {
//     primitive: cylinder
//     height: 1.5
//     radius: 0.2
//     stack: { translate: [0, 2.0, 0] color: [0.4, 0.25, 0.1] }
//   }
//
// The loader converts the text into an in-memory Mesh (vertex buffer
// + index buffer + per-vertex attributes) that the rasterizer can
// draw directly. Primitives: box, sphere, cylinder, cone, plane, quad.
// =============================================================

import { Mesh } from './Mesh.js';

// ---- LumeMDL parser (a tiny structured-text parser) --------------------
function parseMDL(text) {
    const lines = text.split('\n');
    let pos = 0;
    function skipBlank() {
        while (pos < lines.length && /^\s*(#|$)/.test(lines[pos])) pos++;
    }
    function peek() { skipBlank(); return lines[pos]; }
    function next() { skipBlank(); return lines[pos++]; }

    function parseBlock() {
        // { ... }   (single-line value style also supported)
        if (peek() && peek().trim() === '{') {
            next(); // consume {
            const out = {};
            while (pos < lines.length && peek().trim() !== '}') {
                const ln = next();
                const m = ln.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
                if (!m) continue;
                const key = m[1];
                let val = m[2].trim();
                if (val === '{') {
                    out[key] = parseBlock();
                } else if (val.startsWith('[') && val.endsWith(']')) {
                    out[key] = val.slice(1, -1).split(',').map(s => {
                        const t = s.trim();
                        return t.startsWith('"') ? t.slice(1, -1) : Number(t);
                    });
                } else if (val === 'true') out[key] = true;
                else if (val === 'false') out[key] = false;
                else if (!isNaN(Number(val))) out[key] = Number(val);
                else out[key] = val.replace(/^"|"$/g, '');
            }
            if (peek() && peek().trim() === '}') next();
            return out;
        }
        return null;
    }

    const root = {};
    while (pos < lines.length) {
        skipBlank();
        if (pos >= lines.length) break;
        const ln = next();
        const m = ln.match(/^\s*([a-zA-Z_]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if (val === '{') root[key] = parseBlock();
        else if (val.startsWith('[') && val.endsWith(']')) {
            root[key] = val.slice(1, -1).split(',').map(s => {
                const t = s.trim();
                return t.startsWith('"') ? t.slice(1, -1) : Number(t);
            });
        } else if (val === 'true') root[key] = true;
        else if (val === 'false') root[key] = false;
        else if (!isNaN(Number(val))) root[key] = Number(val);
        else root[key] = val.replace(/^"|"$/g, '');
    }
    return root;
}

// ---- Primitive generators (all return a Mesh) --------------------------
function makeBox(w, h, d) {
    const x = w / 2, y = h / 2, z = d / 2;
    const verts = [
        // front
        -x, -y,  z, 0,0,1,  0,0,  x, -y,  z, 0,0,1, 1,0,  x,  y,  z, 0,0,1, 1,1, -x,  y,  z, 0,0,1, 0,1,
        // back
         x, -y, -z, 0,0,-1, 0,0, -x, -y, -z, 0,0,-1, 1,0, -x,  y, -z, 0,0,-1, 1,1,  x,  y, -z, 0,0,-1, 0,1,
        // top
        -x,  y,  z, 0,1,0, 0,0,  x,  y,  z, 0,1,0, 1,0,  x,  y, -z, 0,1,0, 1,1, -x,  y, -z, 0,1,0, 0,1,
        // bottom
        -x, -y, -z, 0,-1,0, 0,0,  x, -y, -z, 0,-1,0, 1,0,  x, -y,  z, 0,-1,0, 1,1, -x, -y,  z, 0,-1,0, 0,1,
        // right
         x, -y,  z, 1,0,0, 0,0,  x, -y, -z, 1,0,0, 1,0,  x,  y, -z, 1,0,0, 1,1,  x,  y,  z, 1,0,0, 0,1,
        // left
        -x, -y, -z,-1,0,0, 0,0, -x, -y,  z,-1,0,0, 1,0, -x,  y,  z,-1,0,0, 1,1, -x,  y, -z,-1,0,0, 0,1,
    ];
    const idx = [];
    for (let f = 0; f < 6; f++) {
        const o = f * 4;
        idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    return Mesh.fromArrays('box', verts, idx, 8);
}

function makePlane(w, d) {
    const x = w / 2, z = d / 2;
    const verts = [
        -x, 0,  z, 0,1,0, 0,0,  x, 0,  z, 0,1,0, 1,0,  x, 0, -z, 0,1,0, 1,1, -x, 0, -z, 0,1,0, 0,1
    ];
    return Mesh.fromArrays('plane', verts, [0, 1, 2, 0, 2, 3], 8);
}

function makeSphere(radius = 0.5, segs = 16, rings = 10) {
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
            const b = a + 1;
            const c = a + stride;
            const d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }
    return Mesh.fromArrays('sphere', verts, idx, 8);
}

function makeCylinder(rTop = 0.5, rBot = 0.5, h = 1, segs = 16) {
    const verts = [];
    const idx = [];
    const half = h / 2;
    // side
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
    // caps
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

function makeCone(radius = 0.5, h = 1, segs = 16) {
    return makeCylinder(0, radius, h, segs);
}

function makeQuad() {
    const verts = [
        -0.5, 0,  0.5, 0, 1, 0, 0, 0,  0.5, 0,  0.5, 0, 1, 0, 1, 0,
         0.5, 0, -0.5, 0, 1, 0, 1, 1, -0.5, 0, -0.5, 0, 1, 0, 0, 1
    ];
    return Mesh.fromArrays('quad', verts, [0, 1, 2, 0, 2, 3], 8);
}

// ---- Apply MDL transforms: translate, rotate, scale, color ----
function applyTransforms(mesh, block) {
    if (!block) return mesh;
    if (block.translate) {
        const [x, y, z] = block.translate;
        mesh.translate(x, y, z);
    }
    if (block.rotate) {
        const [x, y, z] = block.rotate;
        if (x) mesh.rotateX(x * Math.PI / 180);
        if (y) mesh.rotateY(y * Math.PI / 180);
        if (z) mesh.rotateZ(z * Math.PI / 180);
    }
    if (block.scale) {
        const [x, y, z] = block.scale;
        mesh.scale(x, y, z);
    }
    if (block.color) {
        const [r, g, b] = block.color;
        mesh.tint(r, g, b);
    }
    if (block.uvScale) {
        const [u, v] = block.uvScale;
        mesh.scaleUV(u, v);
    }
    return mesh;
}

// ---- Build a single mesh node from MDL dict ----
function buildNode(node) {
    let mesh;
    const p = node.primitive || 'box';
    switch (p) {
        case 'box': mesh = makeBox(node.width || 1, node.height || 1, node.depth || 1); break;
        case 'sphere': mesh = makeSphere(node.radius || 0.5, node.segments || 16, node.rings || 10); break;
        case 'cylinder': mesh = makeCylinder(node.radiusTop || node.radius || 0.5, node.radiusBottom || node.radius || 0.5, node.height || 1, node.segments || 16); break;
        case 'cone': mesh = makeCone(node.radius || 0.5, node.height || 1, node.segments || 16); break;
        case 'plane': mesh = makePlane(node.width || 1, node.depth || 1); break;
        case 'quad': mesh = makeQuad(); break;
        default: throw new Error('MDL: unknown primitive ' + p);
    }
    applyTransforms(mesh, node);
    return mesh;
}

// ---- Recursive mesh assembly ----
function buildNodeList(node) {
    // Returns array of Mesh objects (each becomes its own draw call)
    const meshes = [buildNode(node)];
    if (Array.isArray(node.children)) {
        for (const c of node.children) {
            const sub = buildNodeList(c);
            // offset children by parent translate
            const t = node.translate || [0, 0, 0];
            const r = node.rotate || [0, 0, 0];
            const s = node.scale || [1, 1, 1];
            for (const m of sub) {
                m.applyParentTransform(t, r, s, node.color);
            }
            meshes.push(...sub);
        }
    }
    return meshes;
}

export function loadMDL(text, name = 'mdl') {
    const root = parseMDL(text);
    const rootNode = {
        primitive: root.primitive,
        ...root.props,
        ...root
    };
    // Properties at top level are merged into rootNode already
    const meshes = buildNodeList(rootNode);
    return {
        name: root.name || name,
        meshes,
        // optional: pre-bake a single combined mesh
        combined: meshes.length > 1 ? Mesh.combine(meshes) : meshes[0]
    };
}

// ---- Utility: write a JS-side model description to MDL text ----
export function exportMDL(modelDef) {
    let out = `# LumeMDL v1\nname: ${modelDef.name || 'model'}\n`;
    function block(node, indent = ' ') {
        out += `${indent}primitive: ${node.primitive}\n`;
        if (node.width !== undefined) out += `${indent}width: ${node.width}\n`;
        if (node.height !== undefined) out += `${indent}height: ${node.height}\n`;
        if (node.depth !== undefined) out += `${indent}depth: ${node.depth}\n`;
        if (node.radius !== undefined) out += `${indent}radius: ${node.radius}\n`;
        if (node.segments !== undefined) out += `${indent}segments: ${node.segments}\n`;
        if (node.translate) out += `${indent}translate: [${node.translate.join(', ')}]\n`;
        if (node.rotate) out += `${indent}rotate: [${node.rotate.join(', ')}]\n`;
        if (node.scale) out += `${indent}scale: [${node.scale.join(', ')}]\n`;
        if (node.color) out += `${indent}color: [${node.color.join(', ')}]\n`;
    }
    block(modelDef);
    if (modelDef.children) for (const c of modelDef.children) block(c);
    return out;
}
