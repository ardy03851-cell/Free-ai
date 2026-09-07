// =============================================================
// engine/world/SceneGraph.js
// Lightweight scene graph: a list of renderable objects with
// position/rotation/scale. Each node holds a Mesh and a shader
// reference. The Engine draws every node each frame.
// =============================================================

export class SceneNode {
    constructor(mesh, material) {
        this.mesh = mesh;
        this.material = material;  // { shader, uniforms }
        this.position = [0, 0, 0];
        this.rotation = [0, 0, 0];
        this.scale = [1, 1, 1];
        this.tag = '';
    }

    setPos(x, y, z) { this.position = [x, y, z]; return this; }
    setRot(x, y, z) { this.rotation = [x, y, z]; return this; }
    setScale(x, y, z) { this.scale = [x, y, z]; return this; }
    setTag(t) { this.tag = t; return this; }
}

export class Scene {
    constructor() {
        this.nodes = [];
        this.lights = [];
        this.sky = null;
    }

    add(node) { this.nodes.push(node); return node; }
    remove(node) { this.nodes = this.nodes.filter(n => n !== node); }
    clear() { this.nodes.length = 0; this.lights.length = 0; }

    addLight(l) { this.lights.push(l); }

    update(dt, t) {
        for (const n of this.nodes) if (n.update) n.update(dt, t, this);
    }
}
