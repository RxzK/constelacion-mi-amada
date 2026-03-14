import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let introRenderer, introScene, introCamera, introComposer, introBloom;
let snowParticles, iglooGroup;
let introAnimId;
let introActive = true;
const introClock = { t: 0 };

window.initIntroScene = function () {
    const canvas = document.getElementById("intro-canvas");
    if (!canvas) return;

    introActive = true;

    /* ---- RENDERER ---- */
    introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    introRenderer.toneMappingExposure = 1.0;

    /* ---- SCENE ---- */
    introScene = new THREE.Scene();
    introScene.background = new THREE.Color(0x010a15); // Dark deep blue to avoid background bloom
    introScene.fog = new THREE.FogExp2(0x010a15, 0.015); // Match background, subtle density

    /* ---- CAMERA ---- */
    introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    introCamera.position.set(0, 4, 18);
    introCamera.lookAt(0, 2, 0);

    /* ---- LIGHTS ---- */
    const moonLight = new THREE.DirectionalLight(0xffffff, 0.4); // Even darker to let the ice glow dominate
    moonLight.position.set(15, 25, -10); // Back-lighting
    introScene.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0xaaddff, 0.5);
    rimLight.position.set(-15, 10, -20);
    introScene.add(rimLight);

    const ambient = new THREE.AmbientLight(0x050a15, 0.2); 
    introScene.add(ambient);

    /* ---- BUILDER FUNCTIONS ---- */
    createCinematicTerrain();
    createPremiumSnow();
    createEnvironment(); // New framing elements
    createBeveledIgloo();

    /* ---- POST-PROCESSING ---- */
    const renderScene = new RenderPass(introScene, introCamera);
    introBloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8, // Lower strength
        0.3, // Very tight radius for sharp lines
        1.0  // Absolute threshold: only HDR values bloom
    );
    introComposer = new EffectComposer(introRenderer);
    introComposer.addPass(renderScene);
    introComposer.addPass(introBloom);

    /* ---- RESIZE ---- */
    window.addEventListener("resize", () => {
        if (!introActive) return;
        const w = canvas.clientWidth, h = canvas.clientHeight;
        introCamera.aspect = w / h;
        introCamera.updateProjectionMatrix();
        introRenderer.setSize(w, h);
        introComposer.setSize(w, h);
    });

    introAnimate();
};

function createCinematicTerrain() {
    const geo = new THREE.PlaneGeometry(300, 300, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        let y = Math.sin(x * 0.04) * 3 + Math.cos(z * 0.04) * 2;
        const d = Math.sqrt(x * x + z * z);
        if (d < 10) y *= (d / 10);
        pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, roughness: 1.0, metalness: 0.0,
        emissive: 0x88bbff, emissiveIntensity: 0.05
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.y = -2;
    introScene.add(terrain);
}

function createBeveledIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, -0.1, 0);

    // 1. ULTIMATE ICE MATERIAL (MeshPhysical for SSS)
    const { normalMap, roughnessMap } = generateIceTextures();
    
    const iceBlockMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,           // Pure white base
        transmission: 0.95,        // Highly transmissive
        thickness: 2.0,            // Light travel distance
        roughness: 0.2,            // Smooth surface for refraction
        metalness: 0.05,
        ior: 1.31,                 // Real ice index of refraction
        attenuationColor: 0x88ccff, // Light turns blue inside ice
        attenuationDistance: 0.5,
        normalMap: normalMap,      
        normalScale: new THREE.Vector2(0.3, 0.3),
        roughnessMap: roughnessMap, 
        transparent: false,
        envMapIntensity: 1.0,
        specularIntensity: 1.0,
    });

    const bevelRadius = 0.08;
    const geo = new RoundedBoxGeometry(1, 1, 1, 3, bevelRadius);

    const addBlock = (w, h, d, pos, rot) => {
        const mesh = new THREE.Mesh(geo, iceBlockMat);
        mesh.scale.set(w, h, d);
        
        // Very subtle jitter for professional handmade feel
        const jRotX = (Math.random() - 0.5) * 0.02;
        const jRotY = (Math.random() - 0.5) * 0.02;
        const jRotZ = (Math.random() - 0.5) * 0.02;
        const jPosX = (Math.random() - 0.5) * 0.03;
        const jPosY = (Math.random() - 0.5) * 0.02;
        const jPosZ = (Math.random() - 0.5) * 0.03;
        
        mesh.position.set(pos.x + jPosX, pos.y + jPosY, pos.z + jPosZ);
        mesh.rotation.set(rot.x + jRotX, rot.y + jRotY, rot.z + jRotZ);
        
        // Store for hover expansion
        mesh.userData.origPos = mesh.position.clone();
        mesh.userData.expandDir = mesh.position.clone().normalize();
        
        iglooGroup.add(mesh);
        return mesh;
    };

    const domeRadius = 4.2;
    const blockH = 0.65;
    const blockD = 0.6;

    // 1. BASE RING (Solid grounding, slightly larger)
    const baseCount = 22;
    for(let i=0; i<baseCount; i++) {
        const phi = (i/baseCount) * Math.PI * 2;
        // Skip entrance area for tunnel
        if (phi < 0.35 || phi > Math.PI*2 - 0.35) continue;
        const px = Math.cos(phi) * domeRadius;
        const pz = Math.sin(phi) * domeRadius;
        addBlock(1.5, 0.8, 0.8, {x: px, y: 0.3, z: pz}, {x: 0, y: -phi + Math.PI/2, z: 0});
    }

    // 2. STAGGERED DOME
    const rows = 12;
    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI/2) * 0.95) continue; 
        
        const radiusAtTheta = domeRadius * Math.cos(theta);
        const y = domeRadius * Math.sin(theta);
        
        const circ = 2 * Math.PI * radiusAtTheta;
        const numBlocks = Math.max(1, Math.floor(circ / 1.15)); 
        const angleStep = (Math.PI * 2) / numBlocks;
        
        // Offset every other row by half a block (Running Bond)
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;
        
        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;
            
            // Skip blocks where tunnel will be
            if (theta < 0.65 && (phi < 0.5 || phi > Math.PI*2 - 0.5)) continue;

            const px = radiusAtTheta * Math.sin(phi);
            const pz = radiusAtTheta * Math.cos(phi);
            const py = y;

            const bw = (circ / numBlocks) * 0.992; // Micro-gaps for sharp crack-glow
            addBlock(bw, blockH, blockD, {x: px, y: py, z: pz}, {x: -theta, y: phi, z: 0});
        }
    }

    // 3. ARCHED INTEGRATED TUNNEL
    const tWidth = 1.8, tHeight = 2.0, tArches = 8;
    for (let i = 0; i < tArches; i++) {
        const zDist = (domeRadius - 0.5) + (i * 0.7);
        const archRes = 8;
        for (let j = 0; j < archRes; j++) {
            const archAngle = (j / (archRes - 1)) * Math.PI;
            const x = Math.cos(archAngle) * tWidth;
            const y = Math.sin(archAngle) * tHeight;
            
            // Arch gets slightly smaller/tapered
            const tScale = 1.0 - (i * 0.04);
            addBlock(1.3 * tScale, 0.7 * tScale, 0.7 * tScale, 
                { x: x * tScale, y: y * tScale, z: zDist }, 
                { x: 0, y: 0, z: archAngle - Math.PI/2 }
            );
        }
    }

    // 4. DEFINED CHIMNEY
    const chimneyY = domeRadius * 0.96;
    const cRadius = 0.9;
    const cCount = 6;
    for(let i=0; i<cCount; i++) {
        const phi = (i/cCount) * Math.PI * 2;
        const cx = Math.cos(phi) * cRadius;
        const cz = Math.sin(phi) * cRadius;
        addBlock(1.1, 0.9, 0.6, {x: cx, y: chimneyY + 0.6, z: cz}, {x: 0, y: -phi + Math.PI/2, z: 0});
    }

    // Internal HDR Light
    const campfire = new THREE.PointLight(0x00ccff, 450.0, 20); // More intensity for SSS
    campfire.position.set(0, 1.3, 0.5);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    // 5. VOLUMETRIC GOD-RAYS
    createLightBeams();

    introScene.add(iglooGroup);

    // Re-init Interaction
    initIglooInteraction();
}

function createEnvironment() {
    const treeCount = 6;
    for(let i=0; i<treeCount; i++) {
        const angle = (i/treeCount) * Math.PI * 2 + Math.random();
        const dist = 30 + Math.random() * 20;
        const tx = Math.cos(angle) * dist;
        const tz = Math.sin(angle) * dist;
        createSnowPine(tx, -2, tz, 2.5 + Math.random() * 2);
    }
}

function createSnowPine(x, y, z, s) {
    const group = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x0a2211, roughness: 1.0 });
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });

    for(let i=0; i<3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), leafMat);
        cone.position.y = i * 2.5;
        cone.scale.set(1 - i*0.2, 1, 1 - i*0.2);
        group.add(cone);

        const snow = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.1, 8), snowMat);
        snow.position.y = i * 2.5 + 0.1;
        snow.scale.set(1 - i*0.2, 0.2, 1 - i*0.2);
        group.add(snow);
    }
    group.position.set(x, y, z);
    group.scale.set(s, s, s);
    introScene.add(group);
}

function createLightBeams() {
    const beamGeo = new THREE.PlaneGeometry(1, 10);
    const beamTex = createBeamTexture();
    const beamMat = new THREE.MeshBasicMaterial({ 
        map: beamTex, transparent: true, opacity: 0.2, 
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, 
        depthWrite: false 
    });

    const beamCount = 12;
    for(let i=0; i<beamCount; i++) {
        const beam = new THREE.Mesh(beamGeo, beamMat);
        const phi = Math.random() * Math.PI * 2;
        const theta = (Math.random() * 0.5) * Math.PI;
        const r = 4.2;
        beam.position.set(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta));
        beam.lookAt(0,0,0);
        beam.rotateX(Math.PI/2);
        iglooGroup.add(beam);
    }
}

function createBeamTexture() {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(0, 150, 255, 0.8)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 512);
    return new THREE.CanvasTexture(c);
}

function initIglooInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isOpened = false;
    let expansionFactor = { value: 0 };

    window.addEventListener('mousemove', (e) => {
        if (isOpened) return;
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, introCamera);
        const intersects = raycaster.intersectObjects(iglooGroup.children, true);
        
        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
            // Subtle "breathing" expansion on hover
            gsap.to(expansionFactor, { 
                value: 0.4, 
                duration: 0.8, 
                ease: "power2.out",
                onUpdate: () => updateBlockExpansion(expansionFactor.value)
            });
            gsap.to(iglooGroup.rotation, { y: mouse.x * 0.15, duration: 1.0 });
        } else {
            document.body.style.cursor = 'default';
            // Smoothly return to original masonry shape
            gsap.to(expansionFactor, { 
                value: 0.0, 
                duration: 1.0, 
                ease: "elastic.out(1, 0.75)",
                onUpdate: () => updateBlockExpansion(expansionFactor.value)
            });
            gsap.to(iglooGroup.rotation, { y: 0, duration: 1.5 });
        }
    });

    window.addEventListener('click', () => {
        if (isOpened) return;
        raycaster.setFromCamera(mouse, introCamera);
        const intersects = raycaster.intersectObjects(iglooGroup.children, true);
        
        if (intersects.length > 0) {
            isOpened = true;
            document.body.style.cursor = 'default';
            openIglooBlocks();
        }
    });
}

function updateBlockExpansion(factor) {
    if (!iglooGroup) return;
    iglooGroup.children.forEach(child => {
        if (child.isMesh && child.userData.origPos) {
            const dir = child.userData.expandDir;
            child.position.x = child.userData.origPos.x + dir.x * factor;
            child.position.y = child.userData.origPos.y + dir.y * factor;
            child.position.z = child.userData.origPos.z + dir.z * factor;
        }
    });
}

function openIglooBlocks() {
    // Final Transition Shatter (More dramatic than hover)
    iglooGroup.children.forEach((child) => {
        if (child.isMesh && child.userData.origPos) {
            const dir = child.userData.expandDir;
            gsap.to(child.position, {
                x: child.userData.origPos.x + dir.x * 6,
                y: child.userData.origPos.y + dir.y * 6,
                z: child.userData.origPos.z + dir.z * 6,
                duration: 2.5,
                ease: "expo.out"
            });
            gsap.to(child.rotation, {
                x: child.rotation.x + (Math.random() - 0.5) * 4,
                y: child.rotation.y + (Math.random() - 0.5) * 4,
                duration: 2.5
            });
        }
    });

    // Intensify the fire light to whiteout levels
    if (iglooGroup.userData.campfire) {
        gsap.to(iglooGroup.userData.campfire, {
            intensity: 2000,
            duration: 2.0,
            ease: "expo.in"
        });
    }

    // After animation, trigger the scene transition
    setTimeout(() => {
        if (window.triggerIntroTransition) {
            window.triggerIntroTransition();
        }
    }, 2500);
}

function generateIceTextures() {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Helper: Simple Noise (2D)
    const noise = (x, y) => {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return n - Math.floor(n);
    };

    // Helper: Smooth Noise
    const smoothNoise = (x, y) => {
        const xf = x % 1, yf = y % 1;
        const xi = Math.floor(x), yi = Math.floor(y);
        const a = noise(xi, yi);
        const b = noise(xi + 1, yi);
        const c = noise(xi, yi + 1);
        const d = noise(xi + 1, yi + 1);
        const ux = xf * xf * (3 - 2 * xf);
        const uy = yf * yf * (3 - 2 * yf);
        return a * (1-ux) * (1-uy) + b * ux * (1-uy) + c * (1-ux) * uy + d * ux * uy;
    };

    // Helper: FBM (Fractional Brownian Motion)
    const fbm = (x, y, octaves = 6) => {
        let val = 0, amp = 0.5, freq = 1;
        for(let i=0; i<octaves; i++) {
            val += smoothNoise(x * freq, y * freq) * amp;
            freq *= 2.1; amp *= 0.5;
        }
        return val;
    };

    // 1. HEIGHT MAP (Grayscale)
    const heightData = new Uint8Array(size * size);
    for(let y=0; y<size; y++) {
        for(let x=0; x<size; x++) {
            const val = fbm(x * 0.02, y * 0.02) * 255;
            heightData[y * size + x] = val;
        }
    }

    // 2. NORMAL MAP (Calculated from Height)
    const normalCanvas = document.createElement("canvas");
    normalCanvas.width = size; normalCanvas.height = size;
    const nCtx = normalCanvas.getContext("2d");
    const nImg = nCtx.createImageData(size, size);
    for(let y=0; y<size; y++) {
        for(let x=0; x<size; x++) {
            const idx = (y * size + x);
            const r = heightData[((y) * size + (x + 1)) % (size * size)] || heightData[idx];
            const l = heightData[((y) * size + (x - 1 + size)) % (size * size)] || heightData[idx];
            const d = heightData[((y + 1) * size + (x)) % (size * size)] || heightData[idx];
            const u = heightData[((y - 1 + size) * size + (x)) % (size * size)] || heightData[idx];
            
            const dx = (r - l) / 255.0;
            const dy = (d - u) / 255.0;
            const nx = -dx, ny = -dy, nz = 0.2; // Normalize scale
            const mag = Math.sqrt(nx*nx + ny*ny + nz*nz);
            
            const pixelIdx = idx * 4;
            nImg.data[pixelIdx] = (nx/mag * 0.5 + 0.5) * 255;
            nImg.data[pixelIdx+1] = (ny/mag * 0.5 + 0.5) * 255;
            nImg.data[pixelIdx+2] = (nz/mag * 0.5 + 0.5) * 255;
            nImg.data[pixelIdx+3] = 255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);
    const nTex = new THREE.CanvasTexture(normalCanvas);
    nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping;

    // 3. ROUGHNESS MAP (Based on Height)
    const roughCanvas = document.createElement("canvas");
    roughCanvas.width = size; roughCanvas.height = size;
    const rCtx = roughCanvas.getContext("2d");
    const rImg = rCtx.createImageData(size, size);
    for(let i=0; i<heightData.length; i++) {
        const v = heightData[i];
        // Frosty bits are rough (white), shiny bits are smooth (dark)
        const rough = v < 128 ? v * 0.5 : v; 
        rImg.data[i*4] = rough;
        rImg.data[i*4+1] = rough;
        rImg.data[i*4+2] = rough;
        rImg.data[i*4+3] = 255;
    }
    rCtx.putImageData(rImg, 0, 0);
    const rTex = new THREE.CanvasTexture(roughCanvas);
    rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;

    return { normalMap: nTex, roughnessMap: rTex };
}

function createGlowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    // Cyan/Blue inner glow to match the reference
    g.addColorStop(0, "rgba(80, 200, 255, 1)");
    g.addColorStop(0.3, "rgba(0, 100, 255, 0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}

function createPremiumSnow() {
    const count = 5000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 150;
        pos[i * 3 + 1] = Math.random() * 50;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 150;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, opacity: 0.6 });
    snowParticles = new THREE.Points(geo, mat);
    introScene.add(snowParticles);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    introClock.t += 0.016;
    const t = introClock.t;

    const orbitX = Math.sin(t * 0.1) * 18;
    const orbitZ = Math.cos(t * 0.1) * 18;
    introCamera.position.set(orbitX, 4, orbitZ);
    introCamera.lookAt(0, 2, 0);

    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let y = pa.getY(i) - 0.08;
            if (y < -2) y = 50;
            pa.setY(i, y);
        }
        pa.needsUpdate = true;
    }

    if (iglooGroup && iglooGroup.userData.campfire) {
        iglooGroup.userData.campfire.intensity = 200 + Math.sin(t * 10) * 100;
    }

    introComposer.render();
}

window.triggerIntroTransition = function(callback) {
    introActive = false;
    cancelAnimationFrame(introAnimId);
    gsap.to(introCamera.position, { y: 100, duration: 2, ease: "power2.in" });
    gsap.to(introBloom, { strength: 15, duration: 1.5 });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 1.5, delay: 0.5, onComplete: callback });
};
