import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Spectacular Aurora & Constellation Scene - v10.0.0
 * Focus: Advanced Shaders, Volumetric Aurora, Cosmic Deep Space.
 */

const auroraShader = {
    uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x00ffcc) },
        uColor2: { value: new THREE.Color(0x33ff66) },
        uColor3: { value: new THREE.Color(0x9933ff) }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        void main() {
            vUv = uv;
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        varying vec2 vUv;
        varying vec3 vPosition;

        float hash(vec2 n) {
            return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
        }

        float noise(vec2 n) {
            vec2 i = floor(n);
            vec2 f = fract(n);
            f = f * f * (3.0 - 2.0 * f);
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 n) {
            float total = 0.0, amplitude = 0.5;
            for (int i = 0; i < 4; i++) {
                total += noise(n) * amplitude;
                n += n * 2.0;
                amplitude *= 0.5;
            }
            return total;
        }

        void main() {
            vec2 uv = vUv;
            float t = uTime * 0.2; // Slower, majestic movement
            
            // Core aurora shape with smooth noise
            float n = fbm(uv * vec2(1.5, 0.8) + vec2(t, 0.0));
            float n2 = fbm(uv * vec2(3.0, 1.5) - vec2(t * 0.5, n));
            
            float aurora = smoothstep(0.2, 0.8, n * n2 * 1.3); // Slightly reduced multiplier
            
            // Vertical rays with lower intensity
            float rays = pow(noise(vec2(uv.x * 25.0, t * 0.05)), 4.0) * 0.5; // Reduced from 0.7
            aurora += rays * smoothstep(0.0, 0.4, uv.y) * smoothstep(1.0, 0.6, uv.y);
            
            // Richer, deeper color mapping to avoid white-out
            vec3 vColor1 = vec3(0.0, 0.8, 0.6); // Deeper Emerald
            vec3 vColor2 = vec3(0.0, 0.4, 0.8); // Deeper Cyan
            vec3 vColor3 = vec3(0.4, 0.1, 0.8); // Deeper Purple
            
            vec3 color = mix(vColor1, vColor2, n);
            color = mix(color, vColor3, n2);
            
            // Soft edge fading
            float fade = smoothstep(0.0, 0.4, uv.y) * smoothstep(1.0, 0.8, uv.y);
            fade *= smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x);
            
            gl_FragColor = vec4(color, aurora * fade * 0.75); // Reduced from 0.9
        }
    `
};

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
        vTag.textContent = "VER: 14.0.0 (Harmony)";

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
        introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        introCamera.position.set(0, 0, 50);
        introCamera.lookAt(0, 0, -100);

        // 3. LIGHTS
        const moon = new THREE.DirectionalLight(0xffffff, 0.8);
        moon.position.set(20, 40, -10);
        introScene.add(moon);

        const rim = new THREE.DirectionalLight(0x88ccff, 1.0);
        rim.position.set(-20, 15, -25);
        introScene.add(rim);

        // 4. OBJECTS
        createCosmicBackground();
        createPremiumSnow();
        createSpectacularAurora();
        createCustomConstellation();
        initIglooInteraction();

        // 5. POST-PROCESSING (Balanced Bloom)
        const renderPass = new RenderPass(introScene, introCamera);
        introBloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.1, 0.5, 0.8);
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

// Simplified Sky View

let auroraBands = [];
function createSpectacularAurora() {
    const group = new THREE.Group();
    const count = 4;
    for (let i = 0; i < count; i++) {
        const geo = new THREE.CylinderGeometry(150 + i * 10, 150 + i * 10, 80, 64, 1, true);
        const mat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(auroraShader.uniforms),
            vertexShader: auroraShader.vertexShader,
            fragmentShader: auroraShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            depthWrite: false
        });
        
        // Randomize colors slightly for each layer
        mat.uniforms.uColor1.value.setHSL(0.45 + Math.random() * 0.1, 0.8, 0.5);
        mat.uniforms.uColor2.value.setHSL(0.3 + Math.random() * 0.1, 0.8, 0.5);
        mat.uniforms.uColor3.value.setHSL(0.75 + Math.random() * 0.1, 0.8, 0.5);
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 20;
        mesh.rotation.z = Math.random() * 0.2;
        group.add(mesh);
    }
    introScene.add(group);
}

function createCosmicBackground() {
    // Large sphere for a nebula background
    const geo = new THREE.SphereGeometry(480, 32, 32);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024; // Higher res
    const ctx = canvas.getContext("2d");
    
    // Base space color
    ctx.fillStyle = "#010308";
    ctx.fillRect(0, 0, 1024, 1024);

    // Galactic Plane (Milky Way Band)
    const galacticGrad = ctx.createLinearGradient(0, 0, 1024, 1024);
    galacticGrad.addColorStop(0, "rgba(2, 6, 15, 0)");
    galacticGrad.addColorStop(0.5, "rgba(40, 60, 100, 0.08)");
    galacticGrad.addColorStop(1, "rgba(2, 6, 15, 0)");
    ctx.fillStyle = galacticGrad;
    ctx.fillRect(0, 0, 1024, 1024);
    
    // Add subtle, high-quality nebulas
    for(let i=0; i<12; i++) {
        const x = Math.random() * 1024, y = Math.random() * 1024, r = 150 + Math.random() * 350;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        const h = Math.random() > 0.5 ? 210 : 270; 
        grad.addColorStop(0, `hsla(${h}, 60%, 20%, 0.12)`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 1024);
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false });
    const bg = new THREE.Mesh(geo, mat);
    introScene.add(bg);
}

function createCustomConstellation() {
    const group = new THREE.Group();
    window.starsGroup = group;
    
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
    const enterBtn = document.getElementById('enter-btn');
    if (enterBtn) {
        enterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!introActive) return;
            triggerTransition();
        });
    }
}

function triggerTransition() {
    // Elegant bloom flash, not blinding
    gsap.to(introBloom, { strength: 12, radius: 1.5, duration: 2.5, ease: "power2.inOut" });
    setTimeout(() => { 
        if (window.triggerIntroTransition) window.triggerIntroTransition(); 
    }, 2000);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.01); 
    
    // Slow cinematic drift looking into the void
    introCamera.position.x = Math.sin(t * 0.1) * 5;
    introCamera.position.y = Math.cos(t * 0.1) * 5;
    introCamera.lookAt(0, 0, -100);

    // Animate Aurora Shaders
    introScene.traverse(obj => {
        if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
            obj.material.uniforms.uTime.value = t;
        }
    });

    // Pulse Constellation Stars
    if (window.starsGroup) {
        window.starsGroup.children.forEach((star, i) => {
            if (star instanceof THREE.Mesh) {
                const s = 1 + Math.sin(t * 2 + i) * 0.2;
                star.scale.set(s, s, s);
            }
        });
    }

    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let pz = pa.getZ(i) + 0.05; // Slower drift
            pa.setZ(i, pz > 400 ? -400 : pz);
        }
        pa.needsUpdate = true;
    }

    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
}

window.triggerIntroTransition = function (callback) {
    if (!introActive) return;
    introActive = false; 
    cancelAnimationFrame(introAnimId);
    
    // Smooth camera fly-through
    gsap.to(introCamera.position, { z: -300, duration: 4, ease: "power3.in" });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 2.5, delay: 1, onComplete: callback });
};

function createPremiumSnow() {
    // These are now the "mini stars" from Earth - minimal and clean
    const count = 1000, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 800; 
        pos[i * 3 + 1] = (Math.random() - 0.5) * 800; 
        pos[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ 
        size: 0.15, 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.8, 
        sizeAttenuation: true 
    }));
    introScene.add(snowParticles);
}
