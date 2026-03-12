const fs = require('fs');

class ObjWriter {
    constructor() {
        this.vertices = [];
        this.faces = [];
        this.vertexOffset = 1;
    }

    addBox(w, h, d, x, y, z, rotY = 0, rotZ = 0) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;

        const baseVerts = [
            [-hw, -hh,  hd], [ hw, -hh,  hd], [ hw,  hh,  hd], [-hw,  hh,  hd], // Front
            [-hw, -hh, -hd], [ hw, -hh, -hd], [ hw,  hh, -hd], [-hw,  hh, -hd], // Back
        ];

        const cy = Math.cos(rotY), sy = Math.sin(rotY);
        const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

        const transformedVerts = baseVerts.map(v => {
            let px = v[0], py = v[1], pz = v[2];
            // 1. Latitude tilt
            let x1 = px * cz - py * sz;
            let y1 = px * sz + py * cz;
            px = x1; py = y1;
            // 2. Longitude wrap
            let x2 = px * cy + pz * sy;
            let z2 = -px * sy + pz * cy;
            px = x2; pz = z2;
            return [px + x, py + y, pz + z];
        });

        transformedVerts.forEach(v => this.vertices.push(v));
        const vo = this.vertexOffset;
        this.faces.push([vo, vo+1, vo+2, vo+3]); // Front
        this.faces.push([vo+1, vo+5, vo+6, vo+2]); // Right
        this.faces.push([vo+5, vo+4, vo+7, vo+6]); // Back
        this.faces.push([vo+4, vo, vo+3, vo+7]); // Left
        this.faces.push([vo+3, vo+2, vo+6, vo+7]); // Top
        this.faces.push([vo+4, vo+5, vo+1, vo]); // Bottom
        this.vertexOffset += 8;
    }

    getObjString() {
        let str = "# TikTok Perfect Igloo\no Igloo\n";
        this.vertices.forEach(v => str += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`);
        this.faces.forEach(f => str += `f ${f[0]} ${f[1]} ${f[2]} ${f[3]}\n`);
        return str;
    }
}

function buildIglooObj() {
    const writer = new ObjWriter();
    
    const radius = 3.65;
    const blockH = 0.58; // Slightly shorter for "wide" look
    const rows = 9;
    const blockD = 0.45; // Flatter bricks

    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI / 2) * 0.96) continue;

        const rCurrent = radius * Math.cos(theta);
        const yCurrent = radius * Math.sin(theta);
        
        const circ = 2 * Math.PI * rCurrent;
        // Target much wider bricks ~1.85 width
        const numBlocks = Math.max(1, Math.floor(circ / 1.85));
        const angleStep = (Math.PI * 2) / numBlocks;

        // PERFECT STAGGERING: Running bond pattern
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;

        for (let i = 0; i < numBlocks; i++) {
            const angle = i * angleStep + stagger;
            
            // Precise door cutout
            if (r < 3 && angle > Math.PI*0.36 && angle < Math.PI*0.64) continue;

            const x = Math.cos(angle) * rCurrent;
            const z = Math.sin(angle) * rCurrent;
            
            // Tight gaps for mortar bleed
            const bw = (circ / numBlocks) * 0.94; 
            writer.addBox(
                bw, blockH * 0.94, blockD,
                x, yCurrent, z,
                -angle, theta 
            );
        }
    }

    // High-Fidelity Graduated Tunnel
    const tBaseRadius = radius;
    for (let i = 0; i < 4; i++) {
        const tz = tBaseRadius + 0.3 + (i * 0.7);
        const scale = 1.0 - (i * 0.05); // Tapers slightly
        const tWidth = 1.5 * scale;
        const tHeight = 1.6 * scale;
        
        for (let j = 0; j < 5; j++) {
            const tAngle = (j / 4) * Math.PI;
            const tx = Math.cos(tAngle) * tWidth;
            const ty = Math.sin(tAngle) * tHeight;
            writer.addBox(1.2, 0.65, 0.65, tx, ty, tz, 0, tAngle - Math.PI/2);
        }
    }

    return writer.getObjString();
}

fs.writeFileSync('igloo.obj', buildIglooObj());
console.log('igloo.obj created successfully.');
