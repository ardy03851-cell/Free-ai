// =============================================================
// game/entities/Player.js
// The player: model + third-person follow camera + walk-on-terrain.
// =============================================================

import { ModelBuilder } from '../../engine/models/ModelBuilder.js';
import { SceneNode } from '../../engine/world/SceneGraph.js';

export class Player {
    constructor(scene) {
        const m = new ModelBuilder('player').figure().build();
        this.mesh = m;
        this.node = new SceneNode(m, null);
        this.node.setTag('player');
        scene.add(this.node);

        this.position = [0, 0, 0];
        this.velocity = [0, 0, 0];
        this.yaw = 0;
        this.speed = 4.5;
        this.onGround = false;
        this.height = 0.9;
    }

    update(dt, input, terrain) {
        const move = input.move;
        const look = input.look;
        this.yaw += look.x;
        // Compute forward based on yaw (XZ plane)
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const sx = -Math.cos(this.yaw);
        const sz = Math.sin(this.yaw);

        const speed = this.speed * (input.jump ? 1.6 : 1);
        const targetVx = (move.x * sx + move.y * fx) * speed;
        const targetVz = (move.x * sz + move.y * fz) * speed;
        this.velocity[0] += (targetVx - this.velocity[0]) * Math.min(1, dt * 8);
        this.velocity[2] += (targetVz - this.velocity[2]) * Math.min(1, dt * 8);

        // gravity + jump
        this.velocity[1] -= 18 * dt;
        if (input.jump && this.onGround) {
            this.velocity[1] = 7;
            this.onGround = false;
        }
        this.position[0] += this.velocity[0] * dt;
        this.position[1] += this.velocity[1] * dt;
        this.position[2] += this.velocity[2] * dt;

        // collide with terrain (snap y)
        const groundY = terrain ? terrain.heightAt(this.position[0], this.position[2]) : 0;
        const minY = groundY + this.height;
        if (this.position[1] < minY) {
            this.position[1] = minY;
            this.velocity[1] = 0;
            this.onGround = true;
        } else {
            this.onGround = false;
        }

        // If underwater, drag
        if (terrain && terrain.isUnderwater(this.position[0], this.position[2])) {
            this.velocity[1] *= 0.92;
        }

        this.node.position = [this.position[0], this.position[1] - this.height, this.position[2]];
        this.node.rotation = [0, this.yaw, 0];
    }
}
