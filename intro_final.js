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
let iglooGroup, snowParticles, cosmicDust, shootingStars = [], introActive = true, introAnimId;
let celestialLabels = []; 
let mouseX = 0, mouseY = 0;
let targetCameraPos = new THREE.Vector3(0, 0, 50);

function initMouseParallax() {
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) - 0.5;
        mouseY = (e.clientY / window.innerHeight) - 0.5;
    });
}
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
        vTag.textContent = "VER: 32.0.0 (The Sacred Bridge)";

        introActive = true;

        // 0. RELIABILITY: Inject CSS & Cleanup old labels
        injectCelestialStyles();
        celestialLabels.forEach(l => { if(l.element.parentNode) l.element.parentNode.removeChild(l.element); });
        celestialLabels = [];

        // 1. RENDERER
        introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        introRenderer.toneMappingExposure = 1.3;
        introRenderer.outputColorSpace = THREE.SRGBColorSpace;

        // 2. SCENE & CAMERA
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020815);
        introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        introCamera.position.set(0, 0, 150); // Start further back for pan-in
        introCamera.lookAt(0, 0, -100);

        // CINEMATIC PAN-IN
        gsap.to(introCamera.position, { z: 50, duration: 6, ease: "slow(0.7, 0.7, false)" });

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
        createCosmicGlitter();
        createSpectacularAurora();
        createCustomConstellation();
        initIglooInteraction();
        initMouseParallax();

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
    const geo = new THREE.SphereGeometry(480, 48, 48);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    
    // Base space color - Deep Deep Void
    ctx.fillStyle = "#010206";
    ctx.fillRect(0, 0, 2048, 2048);

    // Create DIAGONAL Organic 'Cosmic Clouds'
    ctx.filter = 'blur(180px)'; // Even smoother
    
    // Path: Bottom-Left to Top-Right
    // We leave a "dark corridor" in the very center by slightly offsetting clusters
    
    const drawCloud = (x, y, r, color) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    };

    // Layer 1: Deep Violet / Blue Voids
    for(let i=0; i<12; i++) {
        const t = i / 11;
        // Asymmetric diagonal path
        const x = t * 2048 + (Math.random() - 0.5) * 600;
        const y = (1 - t) * 2048 + (Math.random() - 0.5) * 600;
        const r = 500 + Math.random() * 600;
        drawCloud(x, y, r, "rgba(40, 25, 100, 0.12)");
    }

    // Layer 2: Electric Cyan Highlights (The visible "Essence")
    for(let i=0; i<8; i++) {
        const t = i / 7;
        // Offset from center to create the contrast pocket
        const offset = (Math.random() > 0.5 ? 400 : -400); 
        const x = t * 2048 + offset + (Math.random() - 0.5) * 200;
        const y = (1 - t) * 2048 - offset + (Math.random() - 0.5) * 200;
        const r = 250 + Math.random() * 450;
        const h = 195 + Math.random() * 30; // Beautiful Cyan/Blues
        drawCloud(x, y, r, `hsla(${h}, 70%, 25%, 0.15)`);
    }

    // Layer 3: Galactic Dust pockets (Multiply)
    ctx.globalCompositeOperation = "multiply";
    for(let i=0; i<5; i++) {
        const x = Math.random() * 2048, y = Math.random() * 2048;
        const r = 300 + Math.random() * 500;
        drawCloud(x, y, r, "rgba(5, 5, 20, 0.25)");
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = 'none';

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    const mat = new THREE.MeshBasicMaterial({ 
        map: tex, 
        side: THREE.BackSide, 
        depthWrite: false,
        dithering: true 
    });
    const bg = new THREE.Mesh(geo, mat);
    introScene.add(bg);
}

function createCustomConstellation() {
    const group = new THREE.Group();
    window.starsGroup = group;
    
    // ASTRONOMICALLY ACCURATE VIRGO (Shifted Down for Contrast)
    const virgoStars = [
        { x: -30, y: -15, z: -100, size: 2.2, name: "Spica" },
        { x: -23, y: -8, z: -105, size: 1.2, name: "Porrima" },
        { x: -17, y: 2, z: -110, size: 1.0, name: "Vindemiatrix" },
        { x: -27, y: 5, z: -115, size: 0.8, name: "Auva" },
        { x: -35, y: 0, z: -112, size: 0.9, name: "Zavijava" },
        { x: -40, y: -8, z: -108, size: 1.0, name: "Zaniah" },
        { x: -30, y: 15, z: -120, size: 0.7, name: "Heze" }
    ];

    // ASTRONOMICALLY ACCURATE LIBRA (Shifted Down for Contrast)
    const libraStars = [
        { x: 10, y: -5, z: -105, size: 1.8, name: "Zubenelgenubi" },
        { x: 17, y: 8, z: -110, size: 1.6, name: "Zubeneschamali" },
        { x: 27, y: 0, z: -115, size: 1.2, name: "Zubenelhakrabi" },
        { x: 20, y: -12, z: -108, size: 1.1, name: "Brachium" }
    ];

    const starTex = makeGlowTexture("#ffffff"); // High quality halo texture
    const lineMat = new THREE.LineBasicMaterial({ 
        color: 0xaaddff, 
        transparent: true, 
        opacity: 0.5,
        blending: THREE.AdditiveBlending 
    });
    // For Energy Flow animation (v29)
    window.constellationLinesMat = lineMat;

    const allStars = [...virgoStars, ...libraStars];
    
    // VIRGO: Traditionally a 'Y' or a figure
    // LIBRA: A diamond or scales
    const connections = [
        // Virgo Connections
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1], [3, 6],
        // Libra Connections
        [7, 8], [8, 9], [9, 10], [10, 7],
        // The Eternal Bridge (Connecting the two hearts)
        [0, 7]
    ];

    allStars.forEach(s => {
        const mat = new THREE.SpriteMaterial({ 
            map: starTex, 
            transparent: true, 
            opacity: 0.8, 
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(mat);
        sprite.position.set(s.x, s.y, s.z);
        sprite.scale.set(s.size * 7, s.size * 7, 1); // Extra pop
        sprite.userData.baseScale = s.size * 7;
        group.add(sprite);

        // Core point (Internal bright dot)
        const coreGeo = new THREE.BufferGeometry();
        coreGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0,0,0]), 3));
        const coreMat = new THREE.PointsMaterial({ size: s.size * 0.8, color: 0xffffff, transparent: true, opacity: 0.9 });
        const core = new THREE.Points(coreGeo, coreMat);
        sprite.add(core);
    });

    const lineGeo = new THREE.BufferGeometry();
    const linePos = [];
    connections.forEach(([i, j]) => {
        linePos.push(allStars[i].x, allStars[i].y, allStars[i].z);
        linePos.push(allStars[j].x, allStars[j].y, allStars[j].z);
    });
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePos), 3));
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.material.opacity = 0.4;
    group.add(lines);
    group.scale.set(1.2, 1.2, 1.2); 

    // --- CELESTIAL LANDMARKS (V32: REFINED IDENTITY & UNION BRIDGE) ---
    // Virgo Label (Tú)
    addCelestialLabelHTML("6 de Septiembre", "VIRGO · EL LATIDO DE TU CORAZÓN", new THREE.Vector3(-40, 25, -95));
    
    // Libra Label (Ella)
    addCelestialLabelHTML("11 de Octubre", "LIBRA · LA ESENCIA DE SU ALMA", new THREE.Vector3(35, 20, -100));
    
    // THE SACRED UNION (March 20) - The Centerpiece
    addCelestialLabelHTML("NUESTRA UNIÓN", "20 de Marzo", new THREE.Vector3(0, -28, -90), "union");

    // --- THE UNION BRIDGE (V32) ---
    const bridgeGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-25, 10, -95), // Part from Virgo
        new THREE.Vector3(0, -5, -92.5), // Mid point (The Heart)
        new THREE.Vector3(25, 5, -100)   // To Libra
    ]);
    const bridgeMat = new THREE.LineBasicMaterial({ 
        color: 0xffd700, 
        transparent: true, 
        opacity: 0.3, 
        blending: THREE.AdditiveBlending 
    });
    const bridgeLine = new THREE.Line(bridgeGeom, bridgeMat);
    group.add(bridgeLine);

    // THE HEART OF THE UNION STAR
    const unionHeart = new THREE.Mesh(
        new THREE.SphereGeometry(0.8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
    );
    unionHeart.position.set(0, -5, -92.5);
    const heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('#ffd700'),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    }));
    heartGlow.scale.set(8, 8, 1);
    unionHeart.add(heartGlow);
    group.add(unionHeart);

    introScene.add(group);
}

function addCelestialLabelHTML(title, subtitle, pos, type = "normal") {
    const el = document.createElement("div");
    el.className = `celestial-label celestial-${type}`;
    el.innerHTML = `
        <div class="celestial-title">${title}</div>
        <div class="celestial-subtitle">${subtitle}</div>
    `;
    document.body.appendChild(el);
    
    celestialLabels.push({ element: el, pos: pos });
    
    // Controlled fade in
    setTimeout(() => el.classList.add('visible'), type === 'union' ? 3500 : 4500);
}

function updateCelestialLabels() {
    if (!introActive || !introCamera) return;

    celestialLabels.forEach(label => {
        const vector = label.pos.clone();
        vector.project(introCamera);

        // Map to 2D screen coordinates
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = -(vector.y * 0.5 - 0.5) * window.innerHeight;

        // Hide if behind camera or out of bounds (with a safety margin)
        if (vector.z > 1 || x < -200 || x > window.innerWidth + 200 || y < -200 || y > window.innerHeight + 200) {
            label.element.style.opacity = '0';
            label.element.style.pointerEvents = 'none';
        } else {
            label.element.style.left = `${x}px`;
            label.element.style.top = `${y}px`;
            // The 'visible' class handles the fade in once
        }
    });
}

function injectCelestialStyles() {
    if (document.getElementById('celestial-styles')) return;
    const style = document.createElement('style');
    style.id = 'celestial-styles';
    style.textContent = `
        .celestial-label {
            position: absolute;
            top: 0; left: 0;
            pointer-events: none;
            transform: translate(-50%, -120%); /* Position above the star */
            z-index: 99999;
            font-family: 'Outfit', sans-serif;
            color: white;
            text-align: center;
            opacity: 0;
            transition: opacity 2s ease-out;
            filter: drop-shadow(0 0 10px rgba(0,0,0,0.9));
            width: 300px;
        }
        .celestial-label.visible { opacity: 1; }
        .celestial-title {
            font-weight: 700; font-size: 1.2rem;
            letter-spacing: 2px; text-transform: uppercase;
            text-shadow: 0 0 10px currentColor; margin-bottom: 2px;
        }
        .celestial-subtitle {
            font-weight: 300; font-size: 0.85rem;
            opacity: 0.8; color: #aaddff;
        }
        .celestial-union {
            border: 2px solid rgba(255, 215, 0, 0.6);
            background: rgba(0, 0, 0, 0.6);
            padding: 15px 30px;
            border-radius: 50px;
            backdrop-filter: blur(15px);
            color: #ffd700;
            width: 320px;
            box-shadow: 0 0 40px rgba(255, 215, 0, 0.2);
            animation: celestialPulse 2.5s infinite ease-in-out;
            transform: translate(-50%, 50%); /* Position below the bridge */
        }
        .celestial-subtle { opacity: 0.5; font-size: 0.7rem; }
        @keyframes celestialPulse {
            0%, 100% { transform: translate(-50%, 50%) scale(1); box-shadow: 0 0 20px rgba(255, 215, 0, 0.2); }
            50% { transform: translate(-50%, 50%) scale(1.05); box-shadow: 0 0 50px rgba(255, 215, 0, 0.5); }
        }
    `;
    document.head.appendChild(style);
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
    gsap.to(starsGroup.scale, { x: 1.5, y: 1.5, z: 1.5, duration: 3, ease: "power2.inOut" });
    setTimeout(() => { 
        if (window.triggerIntroTransition) window.triggerIntroTransition(); 
    }, 2000);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.01); 
    
    // Pro Parallax Drift + Mouse Control
    const driftX = Math.sin(t * 0.1) * 3;
    const driftY = Math.cos(t * 0.1) * 3;
    
    // Smoothly interpolate towards mouse position
    introCamera.position.x += (mouseX * 15 + driftX - introCamera.position.x) * 0.05;
    introCamera.position.y += (-mouseY * 15 + driftY - introCamera.position.y) * 0.05;
    
    introCamera.lookAt(0, 0, -100);

    // Animate Aurora Shaders
    introScene.traverse(obj => {
        if (obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
            obj.material.uniforms.uTime.value = t;
        }
    });

    // Shooting Stars Logic
    if (Math.random() < 0.005) createShootingStar();
    updateShootingStars();

    // Pulse Constellation Stars
    if (window.starsGroup) {
        window.starsGroup.children.forEach((obj, i) => {
            if (obj instanceof THREE.Sprite) {
                const s = 1 + Math.sin(t * 2 + i) * 0.15;
                obj.scale.x = obj.scale.y = (obj.userData.baseScale || 5) * s;
            }
        });
        // Energy Flow for Lines (v29: Pulsating Pulse)
        if (window.constellationLinesMat) {
            window.constellationLinesMat.opacity = 0.2 + Math.sin(t * 3) * 0.15;
            // Additional magic: subtle color shifting
            window.constellationLinesMat.color.setHSL(0.55 + Math.sin(t * 0.5) * 0.05, 0.7, 0.8);
        }
    }

    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let pz = pa.getZ(i) + 0.08; // Mid-ground stars
            pa.setZ(i, pz > 400 ? -400 : pz);
        }
        pa.needsUpdate = true;
    }

    if (cosmicDust) {
        const pa = cosmicDust.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let pz = pa.getZ(i) + 0.15; // Closer, faster glitter
            pa.setZ(i, pz > 300 ? -300 : pz);
        }
        pa.needsUpdate = true;
        cosmicDust.rotation.y += 0.0005;
    }

    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
    
    updateCelestialLabels(); // Update HTML Overlay positions
}

function makeSoftStarTexture() {
    const size = 32;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(200,230,255,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    const tex = new THREE.CanvasTexture(c);
    return tex;
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
    const starTex = makeSoftStarTexture();
    // Mid-ground stars
    const count = 1500, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 800; 
        pos[i * 3 + 1] = (Math.random() - 0.5) * 800; 
        pos[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ 
        size: 1.5,
        map: starTex,
        transparent: true, 
        opacity: 0.4, 
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    introScene.add(snowParticles);
}

function createCosmicGlitter() {
    const starTex = makeSoftStarTexture();
    // Foreground interactive dust
    const count = 500, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 400; 
        pos[i * 3 + 1] = (Math.random() - 0.5) * 400; 
        pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    cosmicDust = new THREE.Points(geo, new THREE.PointsMaterial({ 
        size: 2.2,
        map: starTex,
        transparent: true, 
        opacity: 0.25, 
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        depthWrite: false
    }));
    introScene.add(cosmicDust);
}

function createShootingStar() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array([0, 0, 0, -10, -5, 0]); // Tail
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
    const line = new THREE.Line(geo, mat);
    
    line.position.set((Math.random()-0.5)*300, 50+Math.random()*50, -150);
    line.rotation.z = Math.random() * Math.PI;
    
    introScene.add(line);
    
    const star = { mesh: line, life: 1.0, speed: 2 + Math.random() * 3 };
    gsap.to(mat, { opacity: 0.8, duration: 0.2 });
    shootingStars.push(star);
}

function updateShootingStars() {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.mesh.position.x += s.speed;
        s.mesh.position.y -= s.speed * 0.5;
        s.life -= 0.02;
        s.mesh.material.opacity = s.life;
        if (s.life <= 0) {
            introScene.remove(s.mesh);
            shootingStars.splice(i, 1);
        }
    }
}
