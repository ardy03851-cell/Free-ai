// =============================================================
// engine/shaders/ShaderLang.js
// Lume — a tiny domain-specific shading language.
//
//   fn vertex() { ... }     // produces varyings
//   fn fragment() { ... }   // consumes varyings, returns color
//
// Lume is a SAFE, sandboxed, expression-based mini language. It has
// no loops, no memory, no globals — only inputs, varyings, uniforms,
// and arithmetic.
// =============================================================

// --- tokenizer ----------------------------------------------------------
function tokenize(src) {
    const tokens = [];
    let i = 0;
    const key = new Set([
        'let', 'const', 'attribute', 'varying', 'uniform',
        'vec3', 'vec2', 'float', 'int', 'in', 'out',
        'true', 'false', 'if', 'else', 'return', 'fn',
        'sampler'
    ]);
    while (i < src.length) {
        const c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
        if (/[0-9]/.test(c)) {
            let j = i;
            let hasDot = false;
            while (j < src.length && (/[0-9]/.test(src[j]) || (src[j] === '.' && !hasDot))) {
                if (src[j] === '.') hasDot = true;
                j++;
            }
            if (j < src.length && (src[j] === 'e' || src[j] === 'E')) {
                j++;
                if (j < src.length && (src[j] === '+' || src[j] === '-')) j++;
                while (j < src.length && /[0-9]/.test(src[j])) j++;
            }
            tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) });
            i = j; continue;
        }
        if (c === '.' && /[0-9]/.test(src[i + 1] || '')) {
            let j = i + 1;
            while (j < src.length && /[0-9]/.test(src[j])) j++;
            tokens.push({ type: 'num', value: parseFloat(src.slice(i, j)) });
            i = j; continue;
        }
        if (/[a-zA-Z_]/.test(c)) {
            let j = i;
            while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
            const w = src.slice(i, j);
            tokens.push({ type: key.has(w) ? 'kw' : 'id', value: w });
            i = j; continue;
        }
        if (c === '"' || c === "'") {
            const q = c; let j = i + 1; let s = '';
            while (j < src.length && src[j] !== q) { s += src[j]; j++; }
            tokens.push({ type: 'str', value: s });
            i = j + 1; continue;
        }
        if ('+-*/%^,;(){}[]<>!?:=.'.includes(c)) {
            if (c === '=' && src[i + 1] === '=') { tokens.push({ type: 'op', value: '==' }); i += 2; continue; }
            if (c === '!' && src[i + 1] === '=') { tokens.push({ type: 'op', value: '!=' }); i += 2; continue; }
            if (c === '<' && src[i + 1] === '=') { tokens.push({ type: 'op', value: '<=' }); i += 2; continue; }
            if (c === '>' && src[i + 1] === '=') { tokens.push({ type: 'op', value: '>=' }); i += 2; continue; }
            tokens.push({ type: 'op', value: c });
            i++; continue;
        }
        throw new Error('Lume: unexpected char: ' + c);
    }
    return tokens;
}

// --- parser -------------------------------------------------------------
class Parser {
    constructor(tokens) { this.t = tokens; this.p = 0; }
    peek(o = 0) { return this.t[this.p + o]; }
    next() { return this.t[this.p++]; }
    eat(type, val) {
        const t = this.peek();
        if (t && t.type === type && (val === undefined || t.value === val)) return this.next();
        return null;
    }
    expect(type, val) {
        const t = this.eat(type, val);
        if (!t) throw new Error('Lume: expected ' + type + ' ' + (val || '') + ' got ' + JSON.stringify(this.peek()));
        return t;
    }

    _typeName() {
        const t = this.peek();
        if (!t) throw new Error('Lume: expected type');
        if (t.type === 'id' || (t.type === 'kw' && ['vec2', 'vec3', 'float', 'int', 'sampler'].includes(t.value))) {
            return this.next().value;
        }
        throw new Error('Lume: expected type got ' + JSON.stringify(t));
    }

    parseProgram() {
        const decls = [];
        while (this.p < this.t.length) decls.push(this.parseDecl());
        return { type: 'prog', decls };
    }

    parseDecl() {
        if (this.eat('kw', 'attribute')) return this.parseAttribute();
        if (this.eat('kw', 'varying')) return this.parseVarying();
        if (this.eat('kw', 'uniform')) return this.parseUniform();
        if (this.eat('kw', 'fn')) return this.parseFn();
        if (this.eat('kw', 'let') || this.eat('kw', 'const')) return this.parseVar();
        return this.parseStmt();
    }

    parseAttribute() {
        const type = this._typeName();
        const name = this.expect('id').value;
        this.expect('op', ';');
        return { type: 'attr', dtype: type, name };
    }
    parseVarying() {
        const type = this._typeName();
        const name = this.expect('id').value;
        this.expect('op', ';');
        return { type: 'vary', dtype: type, name };
    }
    parseUniform() {
        const type = this._typeName();
        const name = this.expect('id').value;
        this.expect('op', ';');
        return { type: 'uniform', dtype: type, name };
    }
    parseVar() {
        const name = this.expect('id').value;
        this.expect('op', '=');
        const value = this.parseExpr();
        this.expect('op', ';');
        return { type: 'var', name, value };
    }
    parseFn() {
        const name = this.expect('id').value;
        this.expect('op', '(');
        const params = [];
        while (!this.eat('op', ')')) {
            const t = this._typeName();
            const n = this.expect('id').value;
            params.push({ type: t, name: n });
            this.eat('op', ',');
        }
        this.expect('op', '{');
        const body = [];
        while (!this.eat('op', '}')) body.push(this.parseStmt());
        return { type: 'fn', name, params, body };
    }
    parseStmt() {
        if (this.eat('kw', 'let')) {
            const name = this.expect('id').value;
            this.expect('op', '=');
            const value = this.parseExpr();
            this.expect('op', ';');
            return { type: 'let', name, value };
        }
        if (this.eat('kw', 'return')) {
            const value = this.parseExpr();
            this.expect('op', ';');
            return { type: 'ret', value };
        }
        if (this.eat('kw', 'if')) {
            this.expect('op', '(');
            const cond = this.parseExpr();
            this.expect('op', ')');
            const cons = this.parseBlock();
            const alt = this.eat('kw', 'else') ? this.parseBlock() : null;
            return { type: 'if', cond, cons, alt };
        }
        const id = this.expect('id').value;
        this.expect('op', '=');
        const value = this.parseExpr();
        this.expect('op', ';');
        return { type: 'assign', name: id, value };
    }
    parseBlock() {
        this.expect('op', '{');
        const body = [];
        while (!this.eat('op', '}')) body.push(this.parseStmt());
        return body;
    }
    parseExpr() { return this.parseTernary(); }
    parseTernary() {
        const c = this.parseOr();
        if (this.eat('op', '?')) {
            const t = this.parseExpr();
            this.expect('op', ':');
            const f = this.parseExpr();
            return { type: 'ternary', cond: c, t, f };
        }
        return c;
    }
    parseOr() { let l = this.parseAnd(); while (this.eat('op', '||')) { const r = this.parseAnd(); l = { type: 'bin', op: '||', l, r }; } return l; }
    parseAnd() { let l = this.parseCmp(); while (this.eat('op', '&&')) { const r = this.parseCmp(); l = { type: 'bin', op: '&&', l, r }; } return l; }
    parseCmp() { let l = this.parseAdd(); while (this.peek() && this.peek().type === 'op' && ['<', '>', '==', '!=', '<=', '>='].includes(this.peek().value)) { const op = this.next().value; const r = this.parseAdd(); l = { type: 'bin', op, l, r }; } return l; }
    parseAdd() { let l = this.parseMul(); while (this.peek() && this.peek().type === 'op' && (this.peek().value === '+' || this.peek().value === '-')) { const op = this.next().value; const r = this.parseMul(); l = { type: 'bin', op, l, r }; } return l; }
    parseMul() { let l = this.parsePow(); while (this.peek() && this.peek().type === 'op' && (this.peek().value === '*' || this.peek().value === '/' || this.peek().value === '%')) { const op = this.next().value; const r = this.parsePow(); l = { type: 'bin', op, l, r }; } return l; }
    parsePow() { let l = this.parseUnary(); while (this.eat('op', '^')) { const r = this.parseUnary(); l = { type: 'bin', op: '^', l, r }; } return l; }
    parseUnary() { if (this.eat('op', '-')) return { type: 'neg', expr: this.parseUnary() }; return this.parsePostfix(); }
    parsePostfix() {
        let n = this.parsePrimary();
        while (true) {
            if (this.eat('op', '.')) {
                const sw = this.expect('id').value;
                n = { type: 'swizzle', expr: n, sw };
            } else if (this.eat('op', '[')) {
                const idx = this.parseExpr();
                this.expect('op', ']');
                n = { type: 'index', expr: n, idx };
            } else break;
        }
        return n;
    }
    parsePrimary() {
        const t = this.peek();
        if (!t) throw new Error('Lume: unexpected end');
        if (t.type === 'num') { this.next(); return { type: 'lit', value: t.value }; }
        if (t.type === 'str') { this.next(); return { type: 'lit', value: t.value }; }
        if (t.type === 'op' && t.value === '(') {
            this.next();
            const e = this.parseExpr();
            this.expect('op', ')');
            return e;
        }
        if (t.type === 'id' || (t.type === 'kw' && ['normalize', 'dot', 'cross', 'mix', 'clamp', 'sin', 'cos', 'abs', 'fract', 'floor', 'ceil', 'min', 'max', 'pow', 'sqrt', 'length', 'texture', 'sample', 'vec3', 'vec2', 'smoothstep'].includes(t.value))) {
            const name = this.next().value;
            if (this.eat('op', '(')) {
                const args = [];
                while (!this.eat('op', ')')) {
                    args.push(this.parseExpr());
                    this.eat('op', ',');
                }
                return { type: 'call', name, args };
            }
            return { type: 'ref', name };
        }
        throw new Error('Lume: unexpected token ' + JSON.stringify(t));
    }
}

function parse(src) {
    return new Parser(tokenize(src)).parseProgram();
}

// --- builtins -----------------------------------------------------------
const BUILTINS = {
    vec3: (a, b, c) => Array.isArray(a) ? [a[0] || 0, a[1] || 0, a[2] || 0] : [a || 0, b || 0, c || 0],
    vec2: (a, b) => Array.isArray(a) ? [a[0] || 0, a[1] || 0] : [a || 0, b || 0],
    normalize: (v) => {
        const l = Math.hypot(v[0] || 0, v[1] || 0, v[2] || 0) || 1;
        return [v[0] / l, v[1] / l, v[2] / l];
    },
    length: (v) => Math.hypot(v[0] || 0, v[1] || 0, v[2] || 0),
    dot: (a, b) => (a[0] || 0) * (b[0] || 0) + (a[1] || 0) * (b[1] || 0) + (a[2] || 0) * (b[2] || 0),
    cross: (a, b) => [
        (a[1] || 0) * (b[2] || 0) - (a[2] || 0) * (b[1] || 0),
        (a[2] || 0) * (b[0] || 0) - (a[0] || 0) * (b[2] || 0),
        (a[0] || 0) * (b[1] || 0) - (a[1] || 0) * (b[0] || 0)
    ],
    mix: (a, b, t) => Array.isArray(a) ? [
        (a[0] || 0) + ((b[0] || 0) - (a[0] || 0)) * t,
        (a[1] || 0) + ((b[1] || 0) - (a[1] || 0)) * t,
        (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t
    ] : (a + (b - a) * t),
    clamp: (v, lo, hi) => Array.isArray(v)
        ? [Math.min(Math.max(v[0], lo), hi), Math.min(Math.max(v[1], lo), hi), Math.min(Math.max(v[2], lo), hi)]
        : Math.min(Math.max(v, lo), hi),
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    abs: (x) => Array.isArray(x) ? [Math.abs(x[0] || 0), Math.abs(x[1] || 0), Math.abs(x[2] || 0)] : Math.abs(x),
    fract: (x) => Array.isArray(x) ? [(x[0] || 0) - Math.floor(x[0] || 0), (x[1] || 0) - Math.floor(x[1] || 0), (x[2] || 0) - Math.floor(x[2] || 0)] : x - Math.floor(x),
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    min: (a, b) => Array.isArray(a) ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])] : Math.min(a, b),
    max: (a, b) => Array.isArray(a) ? [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])] : Math.max(a, b),
    pow: (a, b) => Math.pow(a, b),
    sqrt: (x) => Math.sqrt(x),
    smoothstep: (a, b, c) => {
        // GLSL smoothstep(edge0, edge1, x)
        if (b !== undefined && c !== undefined) {
            const t = Math.min(Math.max((c - a) / (b - a), 0), 1);
            return t * t * (3 - 2 * t);
        }
        // 1-arg form: smoothstep(t) (Hermite)
        const x = Math.min(Math.max((a || 0), 0), 1);
        return x * x * (3 - 2 * x);
    },
    texture: (s, uv) => s && s.sample ? s.sample(uv[0] || 0, uv[1] || 0) : [255, 0, 255, 255],
    sample: (s, uv) => BUILTINS.texture(s, uv)
};

// --- compile ------------------------------------------------------------
export function compileShader(src) {
    const ast = parse(src);
    const attributes = {};
    const varyings = {};
    const uniforms = {};
    for (const d of ast.decls) {
        if (d.type === 'attr') attributes[d.name] = d.dtype;
        if (d.type === 'vary') varyings[d.name] = d.dtype;
        if (d.type === 'uniform') uniforms[d.name] = d.dtype;
    }
    const fns = {};
    for (const f of ast.decls) {
        if (f.type === 'fn') fns[f.name] = f;
    }
    return { attributes, varyings, uniforms, ast, fns };
}

// --- AST-walking executor ----------------------------------------------
// Run a function's body against attribs+uniforms. Varyings are captured
// via writes to `out` (any name that matches a varying).
export function execFn(fnNode, attribs, uniforms) {
    const out = {};
    const locals = new Map();
    const writeback = (name, v) => { locals.set(name, v); out[name] = v; };
    const ret = execStmts(fnNode.body, attribs, uniforms || {}, locals, out, writeback);
    return { out, ret };
}

function execStmts(stmts, attribs, uniforms, locals, out, writeback) {
    for (const st of stmts) {
        if (st.type === 'let' || st.type === 'assign') {
            const v = evalExpr(st.value, attribs, uniforms, locals, out);
            writeback(st.name, v);
        } else if (st.type === 'ret') {
            return evalExpr(st.value, attribs, uniforms, locals, out);
        } else if (st.type === 'if') {
            const c = evalExpr(st.cond, attribs, uniforms, locals, out);
            if (c) execStmts(st.cons, attribs, uniforms, locals, out, writeback);
            else if (st.alt) execStmts(st.alt, attribs, uniforms, locals, out, writeback);
        }
    }
    return undefined;
}

function evalExpr(node, attribs, uniforms, locals, out) {
    switch (node.type) {
        case 'lit': return node.value;
        case 'ref': {
            if (locals.has(node.name)) return locals.get(node.name);
            if (attribs && attribs[node.name] !== undefined) return attribs[node.name];
            if (out && out[node.name] !== undefined) return out[node.name];
            if (uniforms && uniforms[node.name] !== undefined) return uniforms[node.name];
            return [0, 0, 0];
        }
        case 'neg': { const v = evalExpr(node.expr, attribs, uniforms, locals, out); return Array.isArray(v) ? [-v[0], -v[1], -v[2]] : -v; }
        case 'bin': {
            const a = evalExpr(node.l, attribs, uniforms, locals, out);
            const b = evalExpr(node.r, attribs, uniforms, locals, out);
            switch (node.op) {
                case '+': return Array.isArray(a) ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : a + b;
                case '-': return Array.isArray(a) ? [a[0] - b[0], a[1] - b[1], a[2] - b[2]] : a - b;
                case '*': return Array.isArray(a) && Array.isArray(b) ? [a[0] * b[0], a[1] * b[1], a[2] * b[2]] :
                    Array.isArray(a) ? [a[0] * b, a[1] * b, a[2] * b] :
                    Array.isArray(b) ? [a * b[0], a * b[1], a * b[2]] : a * b;
                case '/': return Array.isArray(a) ? [a[0] / b, a[1] / b, a[2] / b] : a / b;
                case '%': return a % b;
                case '^': return Math.pow(a, b);
                case '<': return a < b ? 1 : 0;
                case '>': return a > b ? 1 : 0;
                case '<=': return a <= b ? 1 : 0;
                case '>=': return a >= b ? 1 : 0;
                case '==': return a === b ? 1 : 0;
                case '!=': return a !== b ? 1 : 0;
                case '&&': return a && b ? 1 : 0;
                case '||': return a || b ? 1 : 0;
            }
            return 0;
        }
        case 'ternary': {
            const c = evalExpr(node.cond, attribs, uniforms, locals, out);
            return c ? evalExpr(node.t, attribs, uniforms, locals, out) : evalExpr(node.f, attribs, uniforms, locals, out);
        }
        case 'swizzle': {
            const v = evalExpr(node.expr, attribs, uniforms, locals, out);
            if (typeof v === 'number') return v;
            const sw = node.sw;
            if (sw === 'x' || sw === 'r') return v[0];
            if (sw === 'y' || sw === 'g') return v[1];
            if (sw === 'z' || sw === 'b') return v[2];
            if (sw === 'xy' || sw === 'rg') return [v[0], v[1]];
            if (sw === 'xz' || sw === 'rb') return [v[0], v[2]];
            if (sw === 'yz' || sw === 'gb') return [v[1], v[2]];
            if (sw === 'xyz' || sw === 'rgb') return [v[0], v[1], v[2]];
            if (sw === 'zyx' || sw === 'bgr') return [v[2], v[1], v[0]];
            return v;
        }
        case 'call': {
            const args = node.args.map(a => evalExpr(a, attribs, uniforms, locals, out));
            if (BUILTINS[node.name]) return BUILTINS[node.name](...args);
            throw new Error('Lume: unknown function ' + node.name);
        }
    }
    return 0;
}
