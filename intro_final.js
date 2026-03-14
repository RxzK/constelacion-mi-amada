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
        createEnvironment(); 
        createVexikIgloo();

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
    const geo = new THREE.PlaneGeometry(300, 300, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        let y = fbm(x * 0.015, z * 0.015, 3) * 6;
        const d = Math.sqrt(x*x + z*z);
        if (d < 16) y *= (d/16);
        pos.setY(i, y - 2);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, emissive: 0x112244, emissiveIntensity: 0.1 });
    const terrain = new THREE.Mesh(geo, mat);
    introScene.add(terrain);
}

function createVexikIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, 0, 0);

    const { normalMap, roughnessMap } = generateSnowTextures();
    
    // Milky Pure Snow
    const snowMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,           
        emissive: 0x66ccff,        
        emissiveIntensity: 0.0,   // Managed by interaction
        roughness: 0.95,            
        metalness: 0.0,           
        normalMap: normalMap,      
        normalScale: new THREE.Vector2(0.3, 0.3),
        roughnessMap: roughnessMap
    });

    // CHUNKY BLOCK DEFINITION
    const bevel = 0.15; 
    const geo = new RoundedBoxGeometry(1, 1, 1, 5, bevel);

    const addBlock = (w, h, d, pos, rot) => {
        const mesh = new THREE.Mesh(geo, snowMat);
        mesh.scale.set(w, h, d);
        
        // Organic Jitter (Slightly stronger for "hand-carved" feel)
        const jX = (Math.random() - 0.5) * 0.1;
        const jY = (Math.random() - 0.5) * 0.06;
        const jZ = (Math.random() - 0.5) * 0.1;
        const jRot = (Math.random() - 0.5) * 0.05;
        
        mesh.position.set(pos.x + jX, pos.y + jY, pos.z + jZ);
        mesh.rotation.set(rot.x + jRot, rot.y + jRot, rot.z + jRot);
        
        mesh.userData.origPos = mesh.position.clone();
        mesh.userData.expandDir = mesh.position.clone().normalize();
        iglooGroup.add(mesh);
    };

    // 1:1 GEOMETRY - ONLY 4 MAIN ROWS
    const domeR = 4.5;
    const rows = 4; // MASSIVE REDUCTION FOR CHUNKY LOOK
    const blockHeight = 1.4; // MUCH TALLER BLOCKS

    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI/2) * 0.98) continue;
        
        const rad = domeR * Math.cos(theta);
        const y = domeR * Math.sin(theta);
        
        // Massive blocks means fewer count
        const circ = 2 * Math.PI * rad;
        const num = Math.max(1, Math.floor(circ / 2.2)); // 2.2 spacing = huge blocks
        const step = (Math.PI * 2) / num;
        const stagger = (r % 2 === 0) ? 0 : step / 2;
        
        for (let i = 0; i < num; i++) {
            const phi = i * step + stagger;
            // Entrance Gap
            if (theta < 0.6 && (phi < 0.5 || phi > Math.PI*2 - 0.5)) continue;
            
            // Scaled based on dome narrowing
            const bw = (circ / num) * 0.98; 
            addBlock(bw, blockHeight, 1.2, { x: rad * Math.sin(phi), y: y, z: rad * Math.cos(phi) }, { x: -theta, y: phi, z: 0 });
        }
    }

    // Integrated Arched Portal (Short, chunky)
    const portalArches = 3;
    for(let i=0; i<portalArches; i++) {
        const z = (domeR - 0.5) + (i * 1.0);
        const scale = 1.0 - (i * 0.1);
        for(let j=0; j<6; j++) {
            const ang = (j/5) * Math.PI;
            addBlock(1.5, 1.0, 1.0, { x: Math.cos(ang) * 2.5 * scale, y: Math.sin(ang) * 2.5 * scale, z: z }, {x:0, y:0, z: ang - Math.PI/2});
        }
    }

    // Intense Internal Glow (Focusing on crack-light)
    const campfire = new THREE.PointLight(0x00ccff, 600, 20);
    campfire.position.set(0, 1.8, -1);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    createVexikGodRays();
    createChimneySmoke();
    createGroundSpecular();

    introScene.add(iglooGroup);
    initIglooInteraction();
}

function generateSnowTextures() {
    const s = 128, h = new Uint8Array(s * s);
    for(let i=0; i<s*s; i++) h[i] = fbm((i%s)*0.06, Math.floor(i/s)*0.06)*255;
    const nCan = document.createElement("canvas"); nCan.width = nCan.height = s;
    const nCtx = nCan.getContext("2d"), nImg = nCtx.createImageData(s, s);
    for(let y=0; y<s; y++) {
        for(let x=0; x<s; x++) {
            const idx = y*s+x, r = h[y*s+((x+1)%s)], d = h[((y+1)%s)*s+x];
            const dx = (r-h[idx])/255, dy = (d-h[idx])/255, nz = 0.5, mag = Math.sqrt(dx*dx+dy*dy+nz*nz);
            const p = idx*4; nImg.data[p]=( (-dx/mag)*0.5+0.5 )*255; nImg.data[p+1]=( (-dy/mag)*0.5+0.5 )*255; nImg.data[p+2]=( (nz/mag)*0.5+0.5 )*255; nImg.data[p+3]=255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);
    const nTex = new THREE.CanvasTexture(nCan); nTex.wrapS = nTex.wrapT = THREE.RepeatWrapping;

    const rCan = document.createElement("canvas"); rCan.width = rCan.height = s;
    const rCtx = rCan.getContext("2d"), rImg = rCtx.createImageData(s, s);
    for(let i=0; i<s*s; i++) {
        const v = h[i];
        const spark = Math.random() > 0.99 ? 0 : 255; // Sparkles
        rImg.data[i*4] = rImg.data[i*4+1] = rImg.data[i*4+2] = Math.min(255, v + spark);
        rImg.data[i*4+3] = 255;
    }
    rCtx.putImageData(rImg, 0, 0);
    const rTex = new THREE.CanvasTexture(rCan); rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;

    return { normalMap: nTex, roughnessMap: rTex };
}

function createVexikGodRays() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0, "rgba(200, 245, 255, 0.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0,0,64,256);
    const tex = new THREE.CanvasTexture(c);
    
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1.2, 12);
    for(let i=0; i<18; i++){
        const beam = new THREE.Mesh(geo, mat);
        beam.userData.isBeam = true;
        const phi = Math.random()*Math.PI*2, theta = Math.random()*Math.PI*0.35, r = 4.0;
        beam.position.set(r*Math.sin(theta)*Math.cos(phi), r*Math.sin(theta)*Math.sin(phi), r*Math.cos(theta));
        beam.lookAt(0,0,0); beam.rotateX(Math.PI/2);
        iglooGroup.add(beam);
    }
}

function createChimneySmoke() {
    const smokeGroup = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    for(let i=0; i<12; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat.clone());
        p.position.set(0, 8 + i*1.2, 0); p.userData.offset = Math.random()*30;
        smokeGroup.add(p);
    }
    iglooGroup.add(smokeGroup); iglooGroup.userData.smoke = smokeGroup;
}

function createGroundSpecular() {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.2, roughness: 0.1, metalness: 0.5 }));
    disc.rotation.x = -Math.PI/2; disc.position.y = -2.1;
    introScene.add(disc);
}

function createEnvironment() {
    for(let i=0; i<8; i++) {
        const a = (i/8)*Math.PI*2 + Math.random(), d = 40+Math.random()*20;
        createSnowPine(Math.cos(a)*d, -2, Math.sin(a)*d, 3.5+Math.random()*3);
    }
}

function createSnowPine(x, y, z, s) {
    const g = new THREE.Group(), lm = new THREE.MeshStandardMaterial({ color: 0x051a0b }), sm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
    for(let i=0; i<4; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), lm); c.position.y = i*2.2; c.scale.set(1-i*0.2, 1, 1-i*0.2); g.add(c);
        const sn = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.2, 8), sm); sn.position.y = i*2.2+0.15; sn.scale.set(1-i*0.2, 0.15, 1-i*0.2); g.add(sn);
    }
    g.position.set(x, y, z); g.scale.set(s, s, s); introScene.add(g);
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
            gsap.to(exp, { value: 0.25, duration: 1.0, onUpdate: () => updateEffects(exp.value) });
            gsap.to(iglooGroup.rotation, { x: -mouse.y*0.06, y: mouse.x*0.12, duration: 1.5 });
        } else {
            document.body.style.cursor = 'default';
            gsap.to(exp, { value: 0, duration: 1.5, ease: "elastic.out(1,0.7)", onUpdate: () => updateEffects(exp.value) });
            gsap.to(iglooGroup.rotation, { x: 0, y: 0, duration: 2.5 });
        }
    });

    window.addEventListener('click', () => {
        if(isOpened) return;
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
            c.material.emissiveIntensity = f * 2.5;
        }
        if (c.userData.isBeam) c.material.opacity = 0.15 + f * 2.5;
    });
}

function triggerTransition() {
    if (iglooGroup.userData.campfire) gsap.to(iglooGroup.userData.campfire, { intensity: 8000, duration: 2, ease: "power4.in" });
    gsap.to(introBloom, { strength: 30, radius: 2.5, duration: 2 });
    setTimeout(() => { if (window.triggerIntroTransition) window.triggerIntroTransition(); }, 1800);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.012); // Slightly slower orbit
    introCamera.position.set(Math.sin(t*0.05)*24, 6 + Math.sin(t*0.15), Math.cos(t*0.05)*24);
    introCamera.lookAt(0, 2, 0);
    
    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let py = pa.getY(i) - 0.05;
            pa.setY(i, py < -2 ? 60 : py);
        }
        pa.needsUpdate = true;
    }
    
    if (iglooGroup && iglooGroup.userData.campfire) {
        iglooGroup.userData.campfire.intensity = 400 + noise(t*12, 0)*250;
    }
    
    if (iglooGroup && iglooGroup.userData.smoke) {
        iglooGroup.userData.smoke.children.forEach((p, i) => {
            p.position.y += 0.05; 
            p.position.x = Math.sin(t*0.4 + p.userData.offset) * 1.2;
            p.material.opacity -= 0.004;
            if(p.material.opacity <= 0) { p.position.y = 8; p.material.opacity = 0.2; }
        });
    }
    
    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
}

window.triggerIntroTransition = function(callback) {
    introActive = false; cancelAnimationFrame(introAnimId);
    gsap.to(introCamera.position, { y: 200, duration: 3, ease: "power3.in" });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 2, delay: 0.5, onComplete: callback });
};

function createPremiumSnow() {
    const count = 7000, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i*3] = (Math.random()-0.5)*250; pos[i*3+1] = Math.random()*70; pos[i*3+2] = (Math.random()-0.5)*250;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.1, color: 0xffffff, transparent: true, opacity: 0.4 }));
    introScene.add(snowParticles);
}
