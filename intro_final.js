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
    const moonLight = new THREE.DirectionalLight(0xffffff, 0.8); // Darker night
    moonLight.position.set(15, 25, 10);
    introScene.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0xaaddff, 0.6);
    rimLight.position.set(-15, 10, -20);
    introScene.add(rimLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.2); // Low ambient
    introScene.add(ambient);

    /* ---- BUILDER FUNCTIONS ---- */
    createCinematicTerrain();
    createPremiumSnow();
    createBeveledIgloo();

    /* ---- POST-PROCESSING ---- */
    const renderScene = new RenderPass(introScene, introCamera);
    introBloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2, // Strength
        0.4, // Sharper radius
        0.95 // VERY High threshold: ONLY the internal fires bleed through cracks
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

    // Generate Frost Noise Texture
    const frostNormal = createIceNoiseTexture();
    
    // Opaque frosty ice material (forces light to ONLY escape through gaps)
    const iceBlockMat = new THREE.MeshStandardMaterial({
        color: 0x88aaff,           // Darker blue for better contrast
        emissive: 0x011144,        // Nearly zero surface emission
        emissiveIntensity: 0.1,    
        roughness: 0.8,            // High roughness for frosted look
        metalness: 0.1,
        bumpMap: frostNormal,      // Apply physical crystalline texture
        bumpScale: 0.08,           
        transparent: false,        
        opacity: 1.0               
    });

    const bevelRadius = 0.08; 
    // Shrink blocks to create micro-fissures for light to escape
    const blockD = 0.46; // Thinner depth
    const blockH = 0.55; // Shorter height
    const domeRadius = 3.6;

    // Shared geometry
    const geo = new RoundedBoxGeometry(1, 1, 1, 3, bevelRadius);

    const addBlock = (w, h, d, pos, rot) => {
        const mesh = new THREE.Mesh(geo, iceBlockMat);
        mesh.scale.set(w, h, d);
        
        // Organic Jitter ("Hand-built" look)
        const jRotX = (Math.random() - 0.5) * 0.1;
        const jRotY = (Math.random() - 0.5) * 0.1;
        const jRotZ = (Math.random() - 0.5) * 0.1;
        const jPosX = (Math.random() - 0.5) * 0.06;
        const jPosY = (Math.random() - 0.5) * 0.04;
        const jPosZ = (Math.random() - 0.5) * 0.06;
        
        mesh.position.set(pos.x + jPosX, pos.y + jPosY, pos.z + jPosZ);
        mesh.rotation.set(rot.x + jRotX, rot.y + jRotY, rot.z + jRotZ);
        iglooGroup.add(mesh);
    };

    const addDomeBlock = (w, h, d, radius, phi, theta) => {
        const cp = Math.cos(phi), sp = Math.sin(phi);
        const ct = Math.cos(theta), st = Math.sin(theta);
        const px = radius * ct * sp;
        const py = radius * st;
        const pz = radius * ct * cp;
        addBlock(w, h, d, { x: px, y: py, z: pz }, { x: -theta, y: phi, z: 0 });
    };

    // 1. DOME
    const rows = 11;
    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI/2) * 0.9) continue; 
        const radiusAtTheta = domeRadius * Math.cos(theta);
        const circ = 2 * Math.PI * radiusAtTheta;
        // Use max blocks, no gaps. We want them to overlap.
        const numBlocks = Math.max(1, Math.floor(circ / 1.4)); 
        const angleStep = (Math.PI * 2) / numBlocks;
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;
        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;
            if (theta < 0.6 && (phi < 0.4 || phi > Math.PI*2 - 0.4)) continue;
            // Blocks are WIDER than the step to overlap slightly, but leave gaps
            const bw = (circ / numBlocks) * 0.95; 
            addDomeBlock(bw, blockH, blockD, domeRadius, phi, theta);
        }
    }

    // 2. TUNNEL
    const tWidth = 1.3, tHeight = 1.6, tArches = 6;
    for (let i = 0; i < tArches; i++) {
        const zDist = domeRadius - 0.5 + (i * 0.6);
        const numArchBlocks = 7;
        for (let j = 0; j < numArchBlocks; j++) {
            const archAngle = (j / (numArchBlocks - 1)) * Math.PI;
            const x = Math.cos(archAngle) * tWidth;
            const y = Math.sin(archAngle) * tHeight;
            const staggerY = (i % 2 === 0) ? 0 : 0.05;
            // Shrunk to leave gaps (1.0 instead of 1.2)
            addBlock(1.0, 0.6, 0.6, { x: x, y: y + staggerY, z: zDist }, { x: 0, y: 0, z: archAngle - Math.PI/2 });
        }
    }

    // 3. CHIMNEY
    const chimneyRadius = 0.8;
    for (let r = 0; r < 2; r++) {
        const cY = domeRadius - 0.2 + (r * 0.5);
        const numCBlocks = 6;
        for (let i = 0; i < numCBlocks; i++) {
            const phi = (i / numCBlocks) * Math.PI * 2 + (r * 0.3);
            const cx = Math.cos(phi) * chimneyRadius;
            const cz = Math.sin(phi) * chimneyRadius;
            // Shrunk blocks
            addBlock(0.9, 0.5, 0.5, { x: cx, y: cY, z: cz }, { x: 0, y: -phi + Math.PI/2, z: 0 });
        }
    }

    // Intense internal pulsing fire (Shines through gaps)
    const campfire = new THREE.PointLight(0x66ccff, 150.0, 20);
    campfire.position.set(0, 1.0, 0.5);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    // Volumetric glow inside the dome
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({ 
        map: glowTex, transparent: true, opacity: 0.9, 
        blending: THREE.AdditiveBlending, depthWrite: false 
    });
    const spill = new THREE.Sprite(glowMat);
    spill.position.set(0, 1.5, 0); // Moved INSIDE the dome
    spill.scale.set(6, 6, 6);      // Scaled to fit inside the dome
    iglooGroup.add(spill);
    iglooGroup.userData.spill = spill;

    introScene.add(iglooGroup);

    // Interaction Setup
    initIglooInteraction();
}

function initIglooInteraction() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isOpened = false;

    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, introCamera);
        const intersects = raycaster.intersectObjects(iglooGroup.children, true);
        
        if (intersects.length > 0 && !isOpened) {
            document.body.style.cursor = 'pointer';
            gsap.to(iglooGroup.rotation, { y: mouse.x * 0.1, duration: 0.5 });
        } else {
            document.body.style.cursor = 'default';
        }
    });

    window.addEventListener('click', () => {
        if (isOpened) return;
        
        raycaster.setFromCamera(mouse, introCamera);
        const intersects = raycaster.intersectObjects(iglooGroup.children, true);
        
        if (intersects.length > 0) {
            isOpened = true;
            openIglooBlocks();
        }
    });
}

function openIglooBlocks() {
    // Reveal the giant internal resplandor by moving blocks apart
    iglooGroup.children.forEach((child) => {
        if (child.isMesh) {
            const dir = child.position.clone().normalize();
            gsap.to(child.position, {
                x: child.position.x + dir.x * 2,
                y: child.position.y + dir.y * 2,
                z: child.position.z + dir.z * 2,
                duration: 2.0,
                ease: "power2.out"
            });
            gsap.to(child.rotation, {
                x: child.rotation.x + (Math.random() - 0.5) * 2,
                y: child.rotation.y + (Math.random() - 0.5) * 2,
                duration: 2.0
            });
        }
    });

    // Intensify the fire light
    if (iglooGroup.userData.campfire) {
        gsap.to(iglooGroup.userData.campfire, {
            intensity: 800,
            duration: 1.5,
            ease: "expo.out"
        });
    }

    // After animation, trigger the scene transition
    setTimeout(() => {
        if (window.triggerIntroTransition) {
            window.triggerIntroTransition();
        }
    }, 2500);
}

function createIceNoiseTexture() {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(size, size);
    
    // Simple white noise for bump
    for (let i = 0; i < imgData.data.length; i += 4) {
        const val = Math.random() * 255;
        imgData.data[i] = val;
        imgData.data[i+1] = val;
        imgData.data[i+2] = 255; // Normal map Z is full
        imgData.data[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
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
        iglooGroup.userData.campfire.intensity = 100 + Math.sin(t * 8) * 50;
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
