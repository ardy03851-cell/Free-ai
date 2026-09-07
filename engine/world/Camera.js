// =============================================================
// engine/world/Camera.js
// First/third person fly camera. Pitch, yaw, position.
// Computes the view matrix each frame.
// =============================================================

import { mat4LookAt, mat4Perspective } from '../core/Mat4.js';
import { vec3Normalize, vec3Cross, vec3Sub } from '../core/Vec3.js';

export class Camera {
    constructor(aspect, fov = Math.PI / 3) {
        this.position = [0, 2, 6];
        this.yaw = 0;       // radians, around Y
        this.pitch = -0.2;  // radians, around X
        this.fov = fov;
        this.aspect = aspect;
        this.near = 0.1;
        this.far = 500;
        this.view = new Float32Array(16);
        this.proj = new Float32Array(16);
        this.updateProjection();
        this.updateView();
    }

    setAspect(a) {
        this.aspect = a;
        this.updateProjection();
    }

    updateProjection() {
        mat4Perspective(this.proj, this.fov, this.aspect, this.near, this.far);
    }

    forward() {
        return [
            Math.cos(this.pitch) * Math.sin(this.yaw),
            Math.sin(this.pitch),
            -Math.cos(this.pitch) * Math.cos(this.yaw)
        ];
    }

    right() {
        const f = this.forward();
        return [f[2], 0, -f[0]];
    }

    updateView() {
        const f = this.forward();
        const target = [this.position[0] + f[0], this.position[1] + f[1], this.position[2] + f[2]];
        mat4LookAt(this.view, this.position, target, [0, 1, 0]);
    }

    // Free-fly movement
    move(forwardAmt, rightAmt, upAmt) {
        const f = this.forward();
        const r = this.right();
        this.position[0] += f[0] * forwardAmt + r[0] * rightAmt;
        this.position[1] += f[1] * forwardAmt + upAmt;
        this.position[2] += f[2] * forwardAmt + r[2] * rightAmt;
        this.updateView();
    }

    rotate(dYaw, dPitch) {
        this.yaw += dYaw;
        this.pitch += dPitch;
        if (this.pitch > Math.PI / 2 - 0.05) this.pitch = Math.PI / 2 - 0.05;
        if (this.pitch < -Math.PI / 2 + 0.05) this.pitch = -Math.PI / 2 + 0.05;
        this.updateView();
    }
}
