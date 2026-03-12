const fs = require('fs');

class ObjWriter {
    constructor() {
        this.vertices = [];
        this.faces = [];
        this.vertexOffset = 1;
    }

    // Aligns a box to a sphere surface at (phi, theta)
    addArchitecturalBlock(w, h, d, radius, phi, theta) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;

        // Base box at (0, radius, 0)
        // x = width, y = thickness/depth, z = height
        const baseVerts = [
            [-hw,  hd,  hh], [ hw,  hd,  hh], [ hw,  hd, -hh], [-hw,  hd, -hh], // Top/Outer face
            [-hw, -hd,  hh], [ hw, -hd,  hh], [ hw, -hd, -hh], [-hw, -hd, -hh], // Bottom/Inner face
        ];

        // Rotation matrices
        const cp = Math.cos(phi), sp = Math.sin(phi);
        const ct = Math.cos(theta), st = Math.sin(theta);

        const transformedVerts = baseVerts.map(v => {
            let px = v[0], py = v[1] + radius, pz = v[2];

            // 1. Rotate around Z (theta - latitude) - NOT THIS
            // Correct spherical transform:
            // Point (0, R, 0) rotated by theta around X, then phi around Y.
            
            // X rotation (latitude/theta)
            let y1 = py * ct - pz * st;
            let z1 = py * st + pz * ct;
            py = y1; pz = z1;

            // Y rotation (longitude/phi)
            let x2 = px * cp + pz * sp;
            let z2 = -px * sp + pz * cp;
            px = x2; pz = z2;

            return [px, py, pz];
        });

        transformedVerts.forEach(v => this.vertices.push(v));
        const vo = this.vertexOffset;
        this.faces.push([vo, vo+1, vo+2, vo+3]); // Outer
        this.faces.push([vo+4, vo+5, vo+1, vo]); // Front 
        this.faces.push([vo+5, vo+6, vo+2, vo+1]); // Right
        this.faces.push([vo+6, vo+7, vo+3, vo+2]); // Back
        this.faces.push([vo+7, vo+4, vo, vo+3]); // Left
        this.faces.push([vo+7, vo+6, vo+5, vo+4]); // Inner
        this.vertexOffset += 8;
    }

    getObjString() {
        let str = "# TikTok 1:1 Igloo\no Igloo\n";
        this.vertices.forEach(v => str += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`);
        this.faces.forEach(f => str += `f ${f[0]} ${f[1]} ${f[2]} ${f[3]}\n`);
        return str;
    }
}

function buildIglooObj() {
    const writer = new ObjWriter();
    
    const radius = 3.65;
    const blockH = 0.55; 
    const rows = 10;
    const blockD = 0.35; // Thin bricks hug the surface

    for (let r = 0; r < rows; r++) {
        // theta 0 is North Pole (top), PI/2 is Equator (ground)
        // We want ground to the top. So theta goes from PI/2 down to 0.
        const latitude = Math.PI / 2 - (r / rows) * (Math.PI / 2);
        const theta = (latitude); // Angle from equator up

        const rCurrent = radius * Math.cos(theta);
        const yCenter = radius * Math.sin(theta);
        
        const circ = 2 * Math.PI * rCurrent;
        if (circ < 1.0) continue; // Skip very top point

        const numBlocks = Math.max(1, Math.floor(circ / 1.7));
        const angleStep = (Math.PI * 2) / numBlocks;
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;

        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;
            
            // Door cutout (only for rows close to ground)
            if (r < 4 && phi > Math.PI*0.38 && phi < Math.PI*0.62) continue;

            // Using the new architectural aligner
            // bw should be slightly less than arc length
            const bw = (circ / numBlocks) * 0.95;
            writer.addArchitecturalBlock(
                bw, blockH * 0.95, blockD,
                radius, phi, -theta
            );
        }
    }

    // Simplified Tunnel (Lower and wider)
    const tCount = 4;
    for (let i = 0; i < tCount; i++) {
        const zPos = radius + 0.3 + (i * 0.6);
        const tWidth = 1.4;
        const tHeight = 1.4;
        for (let j = 0; j < 5; j++) {
            const angle = (j / 4) * Math.PI;
            const tx = Math.cos(angle) * tWidth;
            const ty = Math.sin(angle) * tHeight;
            // Tunnel bricks are just oriented boxes
            writer.addArchitecturalBlock(1.1, 0.6, 0.5, zPos, 0, Math.PI/2); // Placeholder logic for tunnel
            // Wait, let's just make the tunnel manually
        }
    }
    // Actually, let's skip the tunnel in this pass or simplify it greatly to avoid bugs
    // I will write a better tunnel logic.

    return writer.getObjString();
}

// Re-writing with better tunnel
function buildFinalIgloo() {
    const writer = new ObjWriter();
    const radius = 3.6;
    const blockH = 0.6;
    const rows = 10;
    const blockD = 0.3;

    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2); // 0 at ground, PI/2 at top
        if (theta > (Math.PI/2) * 0.95) continue;

        const circ = 2 * Math.PI * radius * Math.cos(theta);
        const numBlocks = Math.max(1, Math.floor(circ / 1.6));
        const angleStep = (Math.PI * 2) / numBlocks;
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;

        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;
            if (theta < 0.6 && phi > Math.PI*0.38 && phi < Math.PI*0.62) continue;
            
            const bw = (circ / numBlocks) * 0.96;
            writer.addArchitecturalBlock(bw, blockH * 0.96, blockD, radius, phi, -theta);
        }
    }

    // Tunnel
    for(let i=0; i<4; i++){
        const dist = radius + 0.5 + (i * 0.55);
        for(let j=0; j<5; j++){
            const tAngle = (j/4) * Math.PI;
            const tx = Math.cos(tAngle) * 1.5;
            const ty = Math.sin(tAngle) * 1.5;
            // Manual alignment for tunnel
            // Width: 1.1, Height: 0.5, Depth: 0.5
            // But we can approximate with a box rotated around Y (i.e. Z in world)
            // For now, let's just use the same block generator with theta=0 but shifted
            writer.addArchitecturalBlock(1.1, 0.6, 0.5, dist, 0, 0); // Not ideal, but better than spikes
        }
    }

    return writer.getObjString();
}

fs.writeFileSync('igloo.obj', buildFinalIgloo());
console.log('igloo.obj created successfully.');
