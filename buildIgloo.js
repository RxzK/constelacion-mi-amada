const fs = require('fs');

class ObjWriter {
    constructor() {
        this.vertices = [];
        this.faces = [];
        this.vertexOffset = 1;
    }

    // Aligns a box to a surface at given position and Euler-like rotation
    addBlock(w, h, d, pos, rot) {
        const hw = w / 2;
        const hh = h / 2;
        const hd = d / 2;

        const baseVerts = [
            [-hw, -hd, hh], [hw, -hd, hh], [hw, -hd, -hh], [-hw, -hd, -hh], // Inner face
            [-hw, hd, hh], [hw, hd, hh], [hw, hd, -hh], [-hw, hd, -hh], // Outer face
        ];

        const { x: rx, y: ry, z: rz } = rot;
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const cy = Math.cos(ry), sy = Math.sin(ry);
        const cz = Math.cos(rz), sz = Math.sin(rz);

        const transformedVerts = baseVerts.map(v => {
            let x = v[0], y = v[1], z = v[2];

            // Rotate X
            let y1 = y * cx - z * sx;
            let z1 = y * sx + z * cx;
            y = y1; z = z1;

            // Rotate Y
            let x1 = x * cy + z * sy;
            let z1b = -x * sy + z * cy;
            x = x1; z = z1b;

            // Rotate Z
            let x2 = x * cz - y * sz;
            let y2 = x * sz + y * cz;
            x = x2; y = y2;

            return [x + pos.x, y + pos.y, z + pos.z];
        });

        transformedVerts.forEach(v => this.vertices.push(v));
        const vo = this.vertexOffset;
        this.faces.push([vo, vo + 1, vo + 2, vo + 3]); // Inner
        this.faces.push([vo + 4, vo + 5, vo + 1, vo]); // Front 
        this.faces.push([vo + 5, vo + 6, vo + 2, vo + 1]); // Right
        this.faces.push([vo + 6, vo + 7, vo + 3, vo + 2]); // Back
        this.faces.push([vo + 7, vo + 4, vo, vo + 3]); // Left
        this.faces.push([vo + 7, vo + 6, vo + 5, vo + 4]); // Outer
        this.vertexOffset += 8;


        // Position on sphere
        const px = radius * ct * sp;
        const py = radius * st;
        const pz = radius * ct * cp;

        // Rotation to face center
        // phi is rotation around Y, -theta is tilt around X (in local space after phi)
        this.addBlock(w, h, d, { x: px, y: py, z: pz }, { x: -theta, y: phi, z: 0 });
    }

    getObjString() {
        let str = "# TikTok 1:1 Igloo Definitive\no Igloo\n";
        this.vertices.forEach(v => str += `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`);
        this.faces.forEach(f => str += `f ${f[0]} ${f[1]} ${f[2]} ${f[3]}\n`);
        return str;
    }
}

function buildDefinitiveIgloo() {
    const writer = new ObjWriter();

    // 1. DOME
    const domeRadius = 3.6;
    const blockH = 0.55;
    const blockD = 0.35;
    const rows = 11;

    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI / 2) * 0.9) continue; // Leave hole for chimney

        const radiusAtTheta = domeRadius * Math.cos(theta);
        const circ = 2 * Math.PI * radiusAtTheta;
        const numBlocks = Math.max(1, Math.floor(circ / 1.5));
        const angleStep = (Math.PI * 2) / numBlocks;
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;

        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;

            // Door cutout (front is roughly phi=0 or PI)
            // Let's use phi=0 as front
            if (theta < 0.6 && (phi < 0.4 || phi > Math.PI * 2 - 0.4)) continue;

            const bw = (circ / numBlocks) * 0.96;
            writer.addDomeBlock(bw, blockH * 0.96, blockD, domeRadius, phi, theta);
        }
    }

    // 2. TUNNEL (The curved entrance)
    const tWidth = 1.3;
    const tHeight = 1.6;
    const tLength = 3.5;
    const tArches = 6;

    for (let i = 0; i < tArches; i++) {
        const zDist = domeRadius - 0.5 + (i * 0.6);
        const numArchBlocks = 7;
        for (let j = 0; j < numArchBlocks; j++) {
            const archAngle = (j / (numArchBlocks - 1)) * Math.PI;
            const x = Math.cos(archAngle) * tWidth;
            const y = Math.sin(archAngle) * tHeight;

            // Stagger tunnel arches
            const staggerY = (i % 2 === 0) ? 0 : 0.1;

            writer.addBlock(1.0, 0.6, 0.5,
                { x: x, y: y + staggerY, z: zDist },
                { x: 0, y: 0, z: archAngle - Math.PI / 2 }
            );
        }
    }

    // 3. CHIMNEY (Resting on top)
    const chimneyRadius = 0.8;
    for (let r = 0; r < 2; r++) {
        const cY = domeRadius - 0.2 + (r * 0.5);
        const numCBlocks = 6;
        for (let i = 0; i < numCBlocks; i++) {
            const phi = (i / numCBlocks) * Math.PI * 2 + (r * 0.3);
            const cx = Math.cos(phi) * chimneyRadius;
            const cz = Math.sin(phi) * chimneyRadius;
            writer.addBlock(0.8, 0.5, 0.4,
                { x: cx, y: cY, z: cz },
                { x: 0, y: -phi + Math.PI / 2, z: 0 }
            );
        }
    }

    return writer.getObjString();
}

fs.writeFileSync('igloo.obj', buildDefinitiveIgloo());
console.log('igloo.obj created successfully.');
