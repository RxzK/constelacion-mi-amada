import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * IGloo HIGH-FIDELITY - v6.0.8 (Stable Deployment)
 * Fixed: Duplicate declarations, missing createBeamTexture, and scoping issues.
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
    return a * (1-ux) * (1-uy) + b * ux * (1-uy) + c * (1-ux) * uy + d * ux * uy;
};

const fbm = (x, y, oct = 6) => {
    let v = 0, a = 0.5, f = 1;
    for(let i=0; i<oct; i++) { v += smoothNoise(x*f, y*f)*a; f *= 2.1; a *= 0.5; }
    return v;
};

// --- SCENE GLOBALS ---
let introRenderer, introScene, introCamera, introComposer, introBloom;
let iglooGroup, snowParticles, introActive = true, introAnimId;
const introClock = { t: 0 };

window.initIntroScene = function() {
    console.log("Initializing Intro Scene v6.0.8...");
    try {
        const canvas = document.getElementById("intro-canvas");
        if (!canvas) { console.error("Canvas not found"); return; }

        // Persistent Version Indicator for Troubleshooting
        let vTag = document.getElementById("v-tag");
        if (!vTag) {
            vTag = document.createElement("div");
            vTag.id = "v-tag";
            vTag.style.cssText = "position:fixed;top:10px;left:10px;color:cyan;z-index:10000;font-family:monospace;background:rgba(0,0,0,0.5);padding:4px;";
            document.body.appendChild(vTag);
        }
        vTag.textContent = "VER: 6.0.8";

        introActive = true;

        // 1. RENDERER
        introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        introRenderer.toneMappingExposure = 1.0;

        // 2. SCENE & CAMERA
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x010c1a);
        introScene.fog = new THREE.FogExp2(0x010c1a, 0.015);

        introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 4, 18);
        introCamera.lookAt(0, 2, 0);

        // 3. LIGHTS
        const moon = new THREE.DirectionalLight(0xffffff, 0.5);
        moon.position.set(15, 25, -10);
        introScene.add(moon);
        
        const rim = new THREE.DirectionalLight(0xaaddff, 0.6);
        rim.position.set(-15, 10, -20);
        introScene.add(rim);

        introScene.add(new THREE.AmbientLight(0x050a15, 0.2));

        // 4. OBJECTS
        createCinematicTerrain();
        createPremiumSnow();
        createEnvironment(); 
        createBeveledIgloo();

        // 5. POST-PROCESSING (Bloom)
        const renderPass = new RenderPass(introScene, introCamera);
        introBloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);
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
        console.log("Intro Scene v6.0.8 Running.");

    } catch (err) {
        console.error("CRASH v6.0.8:", err);
        const vTag = document.getElementById("v-tag");
        if (vTag) { vTag.style.color = "red"; vTag.textContent = "CRASH: " + err.message; }
    }
};

// --- BUILDER FUNCTIONS ---

function createCinematicTerrain() {
    const geo = new THREE.PlaneGeometry(300, 300, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        let y = Math.sin(x * 0.05) * 2 + Math.cos(z * 0.05) * 2;
        const d = Math.sqrt(x*x + z*z);
        if (d < 12) y *= (d/12);
        pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 1, emissive: 0x002244, emissiveIntensity: 0.1 });
    const terrain = new THREE.Mesh(geo, mat);
    terrain.position.y = -2;
    introScene.add(terrain);
}

function createBeveledIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, -0.1, 0);

    const { normalMap, roughnessMap } = generateIceTextures();
    const iceBlockMat = new THREE.MeshStandardMaterial({
        color: 0xe0f5ff, emissive: 0x00aaff, emissiveIntensity: 0,
        roughness: 0.7, metalness: 0.3, 
        normalMap: normalMap, roughnessMap: roughnessMap
    });

    const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.08);

    const addBlock = (w, h, d, pos, rot) => {
        const mesh = new THREE.Mesh(geo, iceBlockMat);
        mesh.scale.set(w, h, d);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.rotation.set(rot.x, rot.y, rot.z);
        mesh.userData.origPos = mesh.position.clone();
        mesh.userData.expandDir = mesh.position.clone().normalize();
        iglooGroup.add(mesh);
    };

    const domeR = 4.2;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI/2) * 0.95) continue; 
        const rad = domeR * Math.cos(theta);
        const y = domeR * Math.sin(theta);
        const num = Math.max(1, Math.floor((2 * Math.PI * rad) / 1.15));
        const step = (Math.PI * 2) / num;
        const stagger = (r % 2 === 0) ? 0 : step / 2;
        for (let i = 0; i < num; i++) {
            const phi = i * step + stagger;
            if (theta < 0.65 && (phi < 0.5 || phi > Math.PI*2 - 0.5)) continue;
            addBlock(1, 0.65, 0.6, { x: rad * Math.sin(phi), y: y, z: rad * Math.cos(phi) }, { x: -theta, y: phi, z: 0 });
        }
    }

    // Tunnel
    for (let i = 0; i < 8; i++) {
        const zDist = (domeR - 0.5) + (i * 0.7);
        for (let j = 0; j < 8; j++) {
            const ang = (j / 7) * Math.PI, scale = 1.0 - (i * 0.04);
            addBlock(1.3 * scale, 0.7 * scale, 0.7 * scale, { x: Math.cos(ang) * 1.8 * scale, y: Math.sin(ang) * 2 * scale, z: zDist }, { x: 0, y: 0, z: ang - Math.PI/2 });
        }
    }

    // Chimney & Light
    const camp = new THREE.PointLight(0x00ccff, 350, 15);
    camp.position.set(0, 1.3, 0);
    iglooGroup.add(camp);
    iglooGroup.userData.campfire = camp;

    createLightBeams();
    createChimneySmoke();
    createGroundSpecular();

    introScene.add(iglooGroup);
    initIglooInteraction();
}

function createLightBeams() {
    const beamGeo = new THREE.PlaneGeometry(1, 10);
    const beamTex = createBeamTexture();
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    for(let i=0; i<12; i++) {
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.userData.isBeam = true;
        const phi = Math.random() * Math.PI * 2, theta = (Math.random() * 0.5) * Math.PI, r = 4.2;
        beam.position.set(r * Math.sin(theta) * Math.cos(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta));
        beam.lookAt(0,0,0); beam.rotateX(Math.PI/2);
        iglooGroup.add(beam);
    }
}

function createBeamTexture() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "rgba(0, 150, 255, 0.8)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 512);
    return new THREE.CanvasTexture(c);
}

function generateIceTextures() {
    const s = 128, h = new Uint8Array(s * s);
    for(let i=0; i<s*s; i++) h[i] = fbm((i%s)*0.08, Math.floor(i/s)*0.08)*255;
    const nCan = document.createElement("canvas"); nCan.width = nCan.height = s;
    const nCtx = nCan.getContext("2d"), nImg = nCtx.createImageData(s, s);
    for(let y=0; y<s; y++) {
        for(let x=0; x<s; x++) {
            const idx = y*s+x, r = h[y*s+((x+1)%s)], d = h[((y+1)%s)*s+x];
            const dx = (r-h[idx])/255, dy = (d-h[idx])/255, nz = 0.2, mag = Math.sqrt(dx*dx+dy*dy+nz*nz);
            const p = idx*4; nImg.data[p] = ((-dx/mag)*0.5+0.5)*255; nImg.data[p+1] = ((-dy/mag)*0.5+0.5)*255; nImg.data[p+2] = ((nz/mag)*0.5+0.5)*255; nImg.data[p+3] = 255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);
    const rCan = document.createElement("canvas"); rCan.width = rCan.height = s;
    const rCtx = rCan.getContext("2d"), rImg = rCtx.createImageData(s, s);
    for(let i=0; i<s*s; i++) { const v = h[i], r = v < 128 ? v*0.5 : v; rImg.data[i*4] = rImg.data[i*4+1] = rImg.data[i*4+2] = r; rImg.data[i*4+3] = 255; }
    rCtx.putImageData(rImg, 0, 0);
    return { normalMap: new THREE.CanvasTexture(nCan), roughnessMap: new THREE.CanvasTexture(rCan) };
}

function initIglooInteraction() {
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isOpened = false, exp = { value: 0 };
    window.addEventListener('mousemove', (e) => {
        if (isOpened) return;
        mouse.x = (e.clientX/window.innerWidth)*2-1; mouse.y = -(e.clientY/window.innerHeight)*2+1;
        ray.setFromCamera(mouse, introCamera);
        const hits = ray.intersectObjects(iglooGroup.children, true);
        if (hits.length > 0) {
            document.body.style.cursor = 'pointer';
            gsap.to(exp, { value: 0.25, duration: 0.8, onUpdate: () => updateEffects(exp.value) });
            gsap.to(iglooGroup.rotation, { x: -mouse.y*0.1, y: mouse.x*0.2, duration: 1.2 });
        } else {
            document.body.style.cursor = 'default';
            gsap.to(exp, { value: 0, duration: 1.2, ease: "elastic.out(1,0.8)", onUpdate: () => updateEffects(exp.value) });
            gsap.to(iglooGroup.rotation, { x: 0, y: 0, duration: 2 });
        }
    });
    window.addEventListener('click', () => {
        ray.setFromCamera(mouse, introCamera);
        if (ray.intersectObjects(iglooGroup.children, true).length > 0) {
            isOpened = true; triggerTransition();
        }
    });
}

function updateEffects(f) {
    iglooGroup.children.forEach(c => {
        if (c.userData.origPos) {
            const d = c.userData.expandDir;
            c.position.set(c.userData.origPos.x + d.x*f, c.userData.origPos.y + d.y*f, c.userData.origPos.z + d.z*f);
        }
        if (c.userData.isBeam) c.material.opacity = 0.2 + f*2;
    });
}

function triggerTransition() {
    if (iglooGroup.userData.campfire) gsap.to(iglooGroup.userData.campfire, { intensity: 5000, duration: 1.2 });
    gsap.to(introBloom, { strength: 20, duration: 1.5 });
    setTimeout(() => { if (window.triggerIntroTransition) window.triggerIntroTransition(); }, 1200);
}

function createChimneySmoke() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    for(let i=0; i<8; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mat.clone());
        p.position.set(0, 7.5 + Math.random()*2, 0); p.userData.offset = Math.random()*10;
        g.add(p);
    }
    iglooGroup.add(g); iglooGroup.userData.smoke = g;
}

function createGroundSpecular() {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.8 }));
    disc.rotation.x = -Math.PI/2; disc.position.y = -2.15;
    introScene.add(disc);
}

function createEnvironment() {
    for(let i=0; i<6; i++) {
        const a = (i/6)*Math.PI*2+Math.random(), d = 30+Math.random()*20;
        createSnowPine(Math.cos(a)*d, -2, Math.sin(a)*d, 2.5+Math.random()*2);
    }
}

function createSnowPine(x, y, z, s) {
    const g = new THREE.Group(), lm = new THREE.MeshStandardMaterial({ color: 0x0a2211 }), sm = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for(let i=0; i<3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), lm); c.position.y = i*2.5; c.scale.set(1-i*0.2, 1, 1-i*0.2); g.add(c);
        const sn = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.1, 8), sm); sn.position.y = i*2.5+0.1; sn.scale.set(1-i*0.2, 0.2, 1-i*0.2); g.add(sn);
    }
    g.position.set(x, y, z); g.scale.set(s, s, s); introScene.add(g);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.016);
    introCamera.position.set(Math.sin(t*0.1)*18, 4, Math.cos(t*0.1)*18);
    introCamera.lookAt(0, 2, 0);
    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let y = pa.getY(i) - 0.08;
            pa.setY(i, y < -2 ? 50 : y);
        }
        pa.needsUpdate = true;
    }
    if (iglooGroup && iglooGroup.userData.campfire) iglooGroup.userData.campfire.intensity = 300 + noise(t*15, 0)*150;
    if (iglooGroup && iglooGroup.userData.smoke) {
        iglooGroup.userData.smoke.children.forEach(p => {
            p.position.y += 0.05; p.position.x = Math.sin(t+p.userData.offset)*0.5; p.material.opacity -= 0.005;
            if(p.material.opacity <= 0) { p.position.y = 7.5; p.material.opacity = 0.3; }
        });
    }
    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
}

window.triggerIntroTransition = function(callback) {
    introActive = false; cancelAnimationFrame(introAnimId);
    gsap.to(introCamera.position, { y: 100, duration: 2, ease: "power2.in" });
    gsap.to(introBloom, { strength: 15, duration: 1.5 });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 1.5, delay: 0.5, onComplete: callback });
};

function createPremiumSnow() {
    const count = 5000, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i*3] = (Math.random()-0.5)*150; pos[i*3+1] = Math.random()*50; pos[i*3+2] = (Math.random()-0.5)*150;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff, transparent: true, opacity: 0.6 }));
    introScene.add(snowParticles);
}
