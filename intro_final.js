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
    introScene.background = new THREE.Color(0x020a24);
    introScene.fog = new THREE.FogExp2(0x020a24, 0.015);

    /* ---- CAMERA ---- */
    introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    introCamera.position.set(0, 4, 18);
    introCamera.lookAt(0, 2, 0);

    /* ---- LIGHTS ---- */
    const moonLight = new THREE.DirectionalLight(0x7dadff, 2.0);
    moonLight.position.set(15, 25, 10);
    introScene.add(moonLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.5);
    rimLight.position.set(-15, 10, -20);
    introScene.add(rimLight);

    const ambient = new THREE.AmbientLight(0x1a2a5a, 0.6);
    introScene.add(ambient);

    /* ---- BUILDER FUNCTIONS ---- */
    createCinematicTerrain();
    createPremiumSnow();
    createBeveledIgloo();

    /* ---- POST-PROCESSING ---- */
    const renderScene = new RenderPass(introScene, introCamera);
    introBloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        2.5, 0.5, 0.8
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
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0xeef8ff, roughness: 0.95, metalness: 0
    });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.y = -2;
    introScene.add(terrain);
}

function createBeveledIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, -0.1, 0);

    // Procedural Ice Bump Map
    const iceNoiseTex = createIceNoiseTexture();
    
    // Cloudier, rougher ice material
    const iceBlockMat = new THREE.MeshPhysicalMaterial({
        color: 0xeefbff,
        emissive: 0x44abff,
        emissiveIntensity: 0.15,
        roughness: 0.75, // Much rougher for 'frosted' look
        metalness: 0,
        transmission: 0.8, // Less transparent
        ior: 1.33,        
        thickness: 4.0,   // Thicker to diffuse light more
        specularIntensity: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.6,
        transparent: true,
        normalMap: iceNoiseTex,
        normalScale: new THREE.Vector2(0.5, 0.5)
    });

    const bevelRadius = 0.08; // Softer edges
    const blockD = 0.38; // Thicker blocks
    const blockH = 0.58;
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
        // Divide by a larger number to make gaps wider for light bleeding
        const numBlocks = Math.max(1, Math.floor(circ / 1.7)); 
        const angleStep = (Math.PI * 2) / numBlocks;
        const stagger = (r % 2 === 0) ? 0 : angleStep / 2;
        for (let i = 0; i < numBlocks; i++) {
            const phi = i * angleStep + stagger;
            if (theta < 0.6 && (phi < 0.4 || phi > Math.PI*2 - 0.4)) continue;
            // Blocks are slightly smaller than the step to leave gaps
            const bw = (circ / numBlocks) * 0.90; 
            addDomeBlock(bw, blockH * 0.90, blockD, domeRadius, phi, theta);
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
            addBlock(1.0, 0.6, 0.5, { x: x, y: y + staggerY, z: zDist }, { x: 0, y: 0, z: archAngle - Math.PI/2 });
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
            addBlock(0.8, 0.5, 0.4, { x: cx, y: cY, z: cz }, { x: 0, y: -phi + Math.PI/2, z: 0 });
        }
    }

    // Intense internal pulsing fire
    const campfire = new THREE.PointLight(0xffaa22, 25.0, 30);
    campfire.position.set(0, 1.5, 1.0);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    // Volumetric glow
    const glowTex = createGlowTexture();
    const glowMat = new THREE.SpriteMaterial({ 
        map: glowTex, transparent: true, opacity: 0.8, 
        blending: THREE.AdditiveBlending, depthWrite: false 
    });
    const spill = new THREE.Sprite(glowMat);
    spill.position.set(0, 1.3, 6.5);
    spill.scale.set(10, 8, 1);
    iglooGroup.add(spill);
    iglooGroup.userData.spill = spill;

    introScene.add(iglooGroup);
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
        // Smooth it slightly by blending with neighbors would be ideal, 
        // but raw noise creates a nice "frost" grain when used as a normal map
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
    g.addColorStop(0, "rgba(255, 120, 0, 1)");
    g.addColorStop(0.3, "rgba(255, 60, 0, 0.4)");
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
        iglooGroup.userData.campfire.intensity = 20 + Math.sin(t * 10) * 8;
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
