import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * IGloo VEXIK CLONE - v6.1.0 (1:1 FIDELITY OVERHAUL)
 * Focus: Massive Chunky Blocks, Milky Snow, Soft Bloom.
 */

// --- GLOBAL HELPERS (Hoisted) ---
const noise = (x, y) => {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
};

const smoothNoise = (x, y) => {
    const xf = x % 1, yf = y % 1;
    const xi = Math.floor(x), yi = Math.floor(y);
    const a = noise(xi, yi), b = noise(xi + 1, yi);
    const c = noise(xi, yi + 1), d = noise(xi + 1, yi + 1);
    const ux = xf * xf * (3 - 2 * xf), uy = yf * yf * (3 - 2 * yf);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
};

const fbm = (x, y, oct = 6) => {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { v += smoothNoise(x * f, y * f) * a; f *= 2.1; a *= 0.5; }
    return v;
};

// --- SCENE GLOBALS ---
let introRenderer, introScene, introCamera, introComposer, introBloom;
let iglooGroup, snowParticles, introActive = true, introAnimId;
const introClock = { t: 0 };

window.initIntroScene = function () {
    console.log("Initializing Vexik Clone v6.1.0...");
    try {
        const canvas = document.getElementById("intro-canvas");
        if (!canvas) return;

        let vTag = document.getElementById("v-tag");
        if (!vTag) {
            vTag = document.createElement("div");
            vTag.id = "v-tag";
            vTag.style.cssText = "position:fixed;top:10px;left:10px;color:#aaddff;z-index:10000;font-family:monospace;background:rgba(0,0,0,0.3);padding:4px;border-radius:4px;opacity:0.5;";
            document.body.appendChild(vTag);
        }
        vTag.textContent = "VER: 6.1.0 (Vexik Clone)";

        introActive = true;

        // 1. RENDERER
        introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        introRenderer.toneMappingExposure = 1.3;

        // 2. SCENE & CAMERA
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020815);
        introScene.fog = new THREE.FogExp2(0x020815, 0.01);

        introCamera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 6, 22);
        introCamera.lookAt(0, 2, 0);

        // 3. LIGHTS
        const moon = new THREE.DirectionalLight(0xffffff, 0.8);
        moon.position.set(20, 40, -10);
        introScene.add(moon);

        const rim = new THREE.DirectionalLight(0x88ccff, 1.0);
        rim.position.set(-20, 15, -25);
        introScene.add(rim);

        introScene.add(new THREE.AmbientLight(0x223355, 0.4));

        // 4. OBJECTS
        createCinematicTerrain();
        createPremiumSnow();
        createAurora();
        createCustomConstellation();
        initIglooInteraction();

        // 5. POST-PROCESSING (Creamy Bloom)
        const renderPass = new RenderPass(introScene, introCamera);
        introBloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.6, 0.7);
        introComposer = new EffectComposer(introRenderer);
        introComposer.addPass(renderPass);
        introComposer.addPass(introBloom);

        window.addEventListener("resize", () => {
            if (!introActive) return;
            const w = canvas.clientWidth, h = canvas.clientHeight;
            introCamera.aspect = w / h;
            introCamera.updateProjectionMatrix();
            introRenderer.setSize(w, h);
            introComposer.setSize(w, h);
        });

        introAnimate();

    } catch (err) {
        console.error("CRASH v6.1.0:", err);
    }
};

function createCinematicTerrain() {
    const geo = new THREE.PlaneGeometry(500, 500, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        let y = fbm(x * 0.01, z * 0.01, 4) * 12;
        // Make center a bit flatter but still slightly hilly
        const d = Math.sqrt(x * x + z * z);
        if (d < 30) y *= (d / 30);
        pos.setY(i, y - 5);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0xeeeeff, 
        roughness: 0.9, 
        emissive: 0x112244, 
        emissiveIntensity: 0.2 
    });
    const terrain = new THREE.Mesh(geo, mat);
    introScene.add(terrain);
}

let auroraBands = [];
function createAurora() {
    const group = new THREE.Group();
    const bandCount = 3;
    const colors = [0x00ffcc, 0x33ff66, 0x9933ff]; // Teal, Green, Purple

    for (let b = 0; b < bandCount; b++) {
        const segs = 60;
        const width = 150 + Math.random() * 50;
        const height = 40 + Math.random() * 20;
        const geo = new THREE.PlaneGeometry(width, height, segs, 10);
        
        const mat = new THREE.MeshBasicMaterial({
            color: colors[b % colors.length],
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const band = new THREE.Mesh(geo, mat);
        band.position.set(0, 50 + b * 15, -120 - b * 20);
        band.rotation.x = Math.PI * 0.1;
        
        // Custom attribute for animation
        band.userData.phases = [];
        for (let i = 0; i < (segs + 1) * 11; i++) {
            band.userData.phases.push(Math.random() * Math.PI * 2);
        }

        group.add(band);
        auroraBands.push(band);
    }
    introScene.add(group);
}

function createCustomConstellation() {
    const group = new THREE.Group();
    
    // VIRGO (approx points)
    const virgoStars = [
        { x: -15, y: 35, z: -80, size: 0.4 }, // Spica
        { x: -12, y: 38, z: -82, size: 0.2 },
        { x: -10, y: 42, z: -85, size: 0.2 },
        { x: -14, y: 45, z: -83, size: 0.25 },
        { x: -18, y: 43, z: -80, size: 0.2 },
        { x: -20, y: 39, z: -78, size: 0.2 },
        { x: -22, y: 35, z: -75, size: 0.2 }
    ];

    // LIBRA (approx points)
    const libraStars = [
        { x: 10, y: 38, z: -85, size: 0.3 },
        { x: 15, y: 42, z: -88, size: 0.3 },
        { x: 18, y: 37, z: -82, size: 0.2 },
        { x: 14, y: 33, z: -80, size: 0.2 }
    ];

    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

    const allStars = [...virgoStars, ...libraStars];
    
    // Combine Virgil and Libra with a symbolic bridge
    const connections = [
        // Virgo lines
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0],
        // Libra lines
        [7, 8], [8, 9], [9, 10], [10, 7],
        // The Bridge (Heart-like connection)
        [0, 10]
    ];

    allStars.forEach(s => {
        const starGeo = new THREE.SphereGeometry(s.size, 8, 8);
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(s.x, s.y, s.z);
        group.add(star);
        
        // Add glow
        const glowTex = makeGlowTexture("#ffffff");
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(s.size * 10, s.size * 10, 1);
        star.add(glow);
    });

    const lineGeo = new THREE.BufferGeometry();
    const linePos = [];
    connections.forEach(([i, j]) => {
        linePos.push(allStars[i].x, allStars[i].y, allStars[i].z);
        linePos.push(allStars[j].x, allStars[j].y, allStars[j].z);
    });
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    group.add(lines);

    introScene.add(group);
}

function makeGlowTexture(color) {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
}

// Igloo removal cleanup

function initIglooInteraction() {
    // This function can be kept empty or removed as we don't have the igloo anymore
    // But we can add a simple interaction with the landscape
    window.addEventListener('click', () => {
        if (!introActive) return;
        triggerTransition();
    });
}

function triggerTransition() {
    gsap.to(introBloom, { strength: 30, radius: 2.5, duration: 2 });
    setTimeout(() => { if (window.triggerIntroTransition) window.triggerIntroTransition(); }, 1800);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.012); 
    
    // Smooth camera orbit
    const camRadius = 30 + Math.sin(t * 0.2) * 2;
    introCamera.position.set(Math.sin(t * 0.03) * camRadius, 8 + Math.sin(t * 0.1), Math.cos(t * 0.03) * camRadius);
    introCamera.lookAt(0, 4, -40);

    // Animate Aurora
    auroraBands.forEach((band, b) => {
        const pos = band.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const phase = band.userData.phases[i];
            const wave = Math.sin(t * 0.5 + x * 0.05 + phase * 0.2) * 5;
            pos.setY(i, wave);
        }
        pos.needsUpdate = true;
        band.material.opacity = 0.1 + Math.sin(t * 0.4 + b) * 0.05;
    });

    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let py = pa.getY(i) - 0.08;
            pa.setY(i, py < -5 ? 60 : py);
        }
        pa.needsUpdate = true;
    }

    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
}

window.triggerIntroTransition = function (callback) {
    introActive = false; cancelAnimationFrame(introAnimId);
    gsap.to(introCamera.position, { y: 200, duration: 3, ease: "power3.in" });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 2, delay: 0.5, onComplete: callback });
};

function createPremiumSnow() {
    const count = 7000, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 250; pos[i * 3 + 1] = Math.random() * 70; pos[i * 3 + 2] = (Math.random() - 0.5) * 250;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, color: 0xffffff, transparent: true, opacity: 0.4 }));
    introScene.add(snowParticles);
}
