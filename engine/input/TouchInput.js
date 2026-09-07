// =============================================================
// engine/input/TouchInput.js
// Touch + mouse + keyboard input for iPad. Supports:
//   - First-touch virtual joystick (left half of screen)
//   - Second-touch camera look (right half of screen)
//   - Keyboard WASD/arrows + mouse drag fallback
//   - Pinch-to-zoom
// =============================================================

export class TouchInput {
    constructor(canvas) {
        this.canvas = canvas;
        this.touches = new Map();   // id -> {x,y,startX,startY,type}
        this.keys = new Set();
        this.joystick = { x: 0, y: 0, active: false };
        this.look = { dx: 0, dy: 0, active: false };
        this.pinchDist = 0;
        this.zoom = 0;
        this.actionPressed = false;

        canvas.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
        canvas.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
        canvas.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });
        canvas.addEventListener('touchcancel', e => this._onTouchEnd(e), { passive: false });

        canvas.addEventListener('mousedown', e => this._onMouseDown(e));
        canvas.addEventListener('mousemove', e => this._onMouseMove(e));
        canvas.addEventListener('mouseup', () => { this.joystick.active = false; this.look.active = false; });
        canvas.addEventListener('wheel', e => { this.zoom += e.deltaY * 0.001; }, { passive: true });

        window.addEventListener('keydown', e => this.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    }

    _onTouchStart(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        for (const t of e.changedTouches) {
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            const half = rect.width / 2;
            this.touches.set(t.identifier, {
                x, y, startX: x, startY: y,
                type: x < half ? 'joystick' : 'look'
            });
            if (x < half) {
                this.joystick.active = true;
                this.joystick.x = 0; this.joystick.y = 0;
            } else {
                this.look.active = true;
                this.look.dx = 0; this.look.dy = 0;
            }
        }
        if (this.touches.size === 2) {
            const ts = Array.from(this.touches.values());
            this.pinchDist = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
        }
    }

    _onTouchMove(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        for (const t of e.changedTouches) {
            const cur = this.touches.get(t.identifier);
            if (!cur) continue;
            const x = t.clientX - rect.left;
            const y = t.clientY - rect.top;
            if (cur.type === 'joystick') {
                const radius = rect.width * 0.18;
                const dx = (x - cur.startX) / radius;
                const dy = (y - cur.startY) / radius;
                const m = Math.hypot(dx, dy);
                if (m > 1) { this.joystick.x = dx / m; this.joystick.y = dy / m; }
                else { this.joystick.x = dx; this.joystick.y = dy; }
            } else if (cur.type === 'look') {
                this.look.dx += (x - cur.x) * 0.005;
                this.look.dy += (y - cur.y) * 0.005;
            }
            cur.x = x; cur.y = y;
        }
        if (this.touches.size === 2) {
            const ts = Array.from(this.touches.values());
            const d = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y);
            this.zoom += (d - this.pinchDist) * 0.01;
            this.pinchDist = d;
        }
    }

    _onTouchEnd(e) {
        for (const t of e.changedTouches) this.touches.delete(t.identifier);
        if (this.touches.size === 0) {
            this.joystick.active = false;
            this.look.active = false;
        } else {
            // promote remaining touch type
            const ts = Array.from(this.touches.values());
            this.joystick.active = ts.some(t => t.type === 'joystick');
            this.look.active = ts.some(t => t.type === 'look');
        }
    }

    _onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (e.button === 0) {
            this.joystick.active = true;
            this.joystick._mx = x;
            this.joystick._my = y;
        } else if (e.button === 2) {
            this.look.active = true;
            this.look._mx = x;
            this.look._my = y;
        }
    }
    _onMouseMove(e) {
        if (this.joystick.active) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const radius = rect.width * 0.15;
            this.joystick.x = Math.max(-1, Math.min(1, (x - this.joystick._mx) / radius));
            this.joystick.y = Math.max(-1, Math.min(1, (y - this.joystick._my) / radius));
        }
        if (this.look.active) {
            this.look.dx += e.movementX * 0.005;
            this.look.dy += e.movementY * 0.005;
        }
    }

    // Per-frame consumption
    consume() {
        const jx = this.joystick.x;
        const jy = this.joystick.y;
        const lx = this.look.dx;
        const ly = this.look.dy;
        let kx = 0, ky = 0;
        if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
        if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
        if (this.keys.has(' ')) this.actionPressed = true; else this.actionPressed = false;
        this.look.dx = 0;
        this.look.dy = 0;
        return {
            move: { x: jx || kx, y: jy || ky },
            look: { x: lx, y: ly },
            zoom: this.zoom,
            jump: this.keys.has(' ') || this.actionPressed
        };
    }
}
