const fs = require('fs');

class ObjWriter {
    constructor() {
        this.vertices = [];
        this.normals = [];
        this.uvs = [];
        this.faces = [];
        this.vertexOffset = 1;
    }

    addBox(w, h, d, x, y, z, rotY = 0, rotX = 0, rotZ = 0) {
        // Simple box generation
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;

        const baseVerts = [
            [-hw, -hh,  hd], [ hw, -hh,  hd], [ hw,  hh,  hd], [-hw,  hh,  hd], // Front
            [-hw, -hh, -hd], [ hw, -hh, -hd], [ hw,  hh, -hd], [-hw,  hh, -hd], // Back
        ];

        // Apply rotations and translation
        const cy = Math.cos(rotY), sy = Math.sin(rotY);
        const cx = Math.cos(rotX), sx = Math.sin(rotX);
        const cz = Math.cos(rotZ), sz = Math.sin(rotZ);

        const transformedVerts = baseVerts.map(v => {
            let px = v[0], py = v[1], pz = v[2];

            // Rot X
            let y1 = py * cx - pz * sx;
            let z1 = py * sx + pz * cx;
            py = y1; pz = z1;

            // Rot Y
            let x2 = px * cy + pz * sy;
            let z2 = -px * sy + pz * cy;
            px = x2; pz = z2;

            // Rot Z
            let x3 = px * cz - py * sz;
            let y3 = px * sz + py * cz;
            px = x3; py = y3;

            return [px + x, py + y, pz + z];
        });

        transformedVerts.forEach(v => this.vertices.push(v));

        const vo = this.vertexOffset;
        // Faces (1-indexed based on offset)
        // Front
        this.faces.push([vo, vo+1, vo+2, vo+3]);
        // Right
        this.faces.push([vo+1, vo+5, vo+6, vo+2]);
        // Back
        this.faces.push([vo+5, vo+4, vo+7, vo+6]);
        // Left
        this.faces.push([vo+4, vo, vo+3, vo+7]);
        // Top
        this.faces.push([vo+3, vo+2, vo+6, vo+7]);
        // Bottom
        this.faces.push([vo+4, vo+5, vo+1, vo]);

        this.vertexOffset += 8;
    }

    getObjString() {
        let str = "# Generated Igloo OBJ\n";
        str += "o Igloo\n";
        this.vertices.forEach(v => {
            str += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`;
        });
        
        // We skip exact normals and UVs for simplicity, Three.js will compute if missing or we use standard material
        this.faces.forEach(f => {
            str += `f ${f[0]} ${f[1]} ${f[2]} ${f[3]}\n`;
        });
        
        return str;
    }
}

function buildIglooObj() {
    const writer = new ObjWriter();
    
    const radius = 3.75;
    const blockH = 0.66;
    const rows = 7;
    const blockD = 0.65; // Thicker for solid feel

    // Tiers of the dome
    for (let r = 0; r < rows; r++) {
        const theta1 = (r / rows) * (Math.PI / 2);
        
        const rCurrent = radius * Math.cos(theta1);
        const yCurrent = radius * Math.sin(theta1);
        
        const circ = 2 * Math.PI * rCurrent;
        // Large, clean blocks
        const numBlocks = Math.max(1, Math.floor(circ / 1.55));
        const angleStep = (Math.PI * 2) / numBlocks;

        for (let i = 0; i < numBlocks; i++) {
            const angle = i * angleStep;
            
            // Door cutout
            if (r < 2) {
                if (angle > Math.PI*0.35 && angle < Math.PI*0.65) {
                    continue; 
                }
            }

            const x = Math.cos(angle) * rCurrent;
            const z = Math.sin(angle) * rCurrent;
            
            // Perfect tangency
            const rotX = -theta1 * Math.sin(angle);
            const rotZ = theta1 * Math.cos(angle);
            
            // NO RANDOMNESS - Perfectly clean architectural blocks
            const bw = (circ / numBlocks) * 0.98; 
            writer.addBox(
                bw, 
                blockH * 0.98, 
                blockD,
                x, 
                yCurrent + blockH/2, 
                z,
                -angle, 
                rotX, 
                rotZ
            );
        }
    }

    // High-fidelity Tunnel (Structured)
    const tWidth = 1.4;
    const tHeight = 1.5;
    for (let i = 0; i < 4; i++) { 
        const tz = radius + 0.3 + (i * 0.8);
        for (let j = 0; j < 5; j++) { 
            const tAngle = (j / 4) * Math.PI;
            const tx = Math.cos(tAngle) * tWidth;
            const ty = Math.sin(tAngle) * tHeight;
            
            writer.addBox(
                1.1, 0.7, 0.7,
                tx, 
                ty + 0.2, 
                tz,
                0, 0, tAngle
            );
        }
    }

    return writer.getObjString();
}

fs.writeFileSync('igloo.obj', buildIglooObj());
console.log('igloo.obj created successfully.');
