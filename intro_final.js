import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * IGloo MAJESTIC SNOW - v6.0.9 (1:1 Fidelity Overhaul)
 * Focus: Soft snow volumes, subsurface glow, crystalline sparkles.
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
    console.log("Initializing Majestic Snow v6.0.9...");
    try {
        const canvas = document.getElementById("intro-canvas");
        if (!canvas) return;

        // Persistent Version Indicator
        let vTag = document.getElementById("v-tag");
        if (!vTag) {
            vTag = document.createElement("div");
            vTag.id = "v-tag";
            vTag.style.cssText = "position:fixed;top:10px;left:10px;color:#aaddff;z-index:10000;font-family:monospace;background:rgba(0,0,0,0.3);padding:4px;border-radius:4px;";
            document.body.appendChild(vTag);
        }
        vTag.textContent = "VER: 6.0.9 (Majestic Snow)";

        introActive = true;

        // 1. RENDERER
        introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        introRenderer.toneMappingExposure = 1.2; // Slightly brighter for snow feel

        // 2. SCENE & CAMERA
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020812);
        introScene.fog = new THREE.FogExp2(0x020812, 0.012);

        introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 5, 20);
        introCamera.lookAt(0, 2, 0);

        // 3. LIGHTS
        const moon = new THREE.DirectionalLight(0xddeeff, 0.7);
        moon.position.set(20, 30, -10);
        introScene.add(moon);
        
        const rim = new THREE.DirectionalLight(0x88ccff, 0.8);
        rim.position.set(-20, 15, -25);
        introScene.add(rim);

        const softAmbient = new THREE.AmbientLight(0x112244, 0.3);
        introScene.add(softAmbient);

        // 4. OBJECTS
        createCinematicTerrain();
        createPremiumSnow();
        createEnvironment(); 
        createMajesticIgloo();

        // 5. POST-PROCESSING (Enhanced Bloom)
        const renderPass = new RenderPass(introScene, introCamera);
        // Soft, wide bloom for "hazy morning" feel
        introBloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.5, 0.75);
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
        console.error("CRASH v6.0.9:", err);
    }
};

function createCinematicTerrain() {
    // Smoother dunes (low frequency, higher amplitude)
    const geo = new THREE.PlaneGeometry(300, 300, 100, 100);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        // Soft rolling dunes
        let y = fbm(x * 0.02, z * 0.02, 3) * 5;
        const d = Math.sqrt(x*x + z*z);
        if (d < 15) y *= (d/15); // Flatten area around igloo
        pos.setY(i, y - 2);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        roughness: 0.9, 
        emissive: 0x113366, 
        emissiveIntensity: 0.1 
    });
    const terrain = new THREE.Mesh(geo, mat);
    introScene.add(terrain);
}

function createMajesticIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, 0, 0);

    const { normalMap, roughnessMap } = generateSnowTextures();
    
    // Soft snow material with subsurface-like bleed
    const snowMat = new THREE.MeshStandardMaterial({
        color: 0xf5fbff,           // Very clean white/blue
        emissive: 0x66ccff,        // Subsurface glow
        emissiveIntensity: 0.05,   // Base glow
        roughness: 0.8,            
        metalness: 0.1,           
        normalMap: normalMap,      
        normalScale: new THREE.Vector2(0.4, 0.4),
        roughnessMap: roughnessMap
    });

    // More rounded, soft geometry
    const bevel = 0.12; 
    const geo = new RoundedBoxGeometry(1, 1, 1, 4, bevel);

    const addBlock = (w, h, d, pos, rot) => {
        const mesh = new THREE.Mesh(geo, snowMat);
        mesh.scale.set(w, h, d);
        
        // NATURAL JITTER: Not perfectly aligned
        const jX = (Math.random() - 0.5) * 0.08;
        const jY = (Math.random() - 0.5) * 0.05;
        const jZ = (Math.random() - 0.5) * 0.08;
        const jRot = (Math.random() - 0.5) * 0.04;
        
        mesh.position.set(pos.x + jX, pos.y + jY, pos.z + jZ);
        mesh.rotation.set(rot.x + jRot, rot.y + jRot, rot.z + jRot);
        
        mesh.userData.origPos = mesh.position.clone();
        mesh.userData.expandDir = mesh.position.clone().normalize();
        iglooGroup.add(mesh);
    };

    const domeR = 4.0;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
        const theta = (r / rows) * (Math.PI / 2);
        if (theta > (Math.PI/2) * 0.96) continue;
        const rad = domeR * Math.cos(theta);
        const y = domeR * Math.sin(theta);
        const circ = 2 * Math.PI * rad;
        const num = Math.max(1, Math.floor(circ / 1.1));
        const step = (Math.PI * 2) / num;
        const stagger = (r % 2 === 0) ? 0 : step / 2;
        
        for (let i = 0; i < num; i++) {
            const phi = i * step + stagger;
            if (theta < 0.6 && (phi < 0.4 || phi > Math.PI*2 - 0.4)) continue;
            addBlock(1.05, 0.7, 0.7, { x: rad * Math.sin(phi), y: y, z: rad * Math.cos(phi) }, { x: -theta, y: phi, z: 0 });
        }
    }

    // Tapered Integrated Tunnel
    for(let i=0; i<7; i++) {
        const z = (domeR - 0.5) + (i * 0.7);
        const scale = 1.0 - (i * 0.05);
        for(let j=0; j<8; j++) {
            const ang = (j/7) * Math.PI;
            const x = Math.cos(ang) * 1.9 * scale;
            const y = Math.sin(ang) * 2.2 * scale;
            addBlock(1.3 * scale, 0.7 * scale, 0.7 * scale, {x, y, z}, {x:0, y:0, z: ang - Math.PI/2});
        }
    }

    // Internal Soft Light
    const campfire = new THREE.PointLight(0x00ccff, 400, 18);
    campfire.position.set(0, 1.5, 0);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    createLightBeams();
    createChimneySmoke();
    createGroundSpecular();

    introScene.add(iglooGroup);
    initIglooInteraction();
}

function generateSnowTextures() {
    const s = 256; // Higher res for sparkles
    const h = new Uint8Array(s * s);
    for(let i=0; i<s*s; i++) h[i] = fbm((i%s)*0.05, Math.floor(i/s)*0.05)*255;
    
    const nCan = document.createElement("canvas"); nCan.width = nCan.height = s;
    const nCtx = nCan.getContext("2d"), nImg = nCtx.createImageData(s, s);
    for(let y=0; y<s; y++) {
        for(let x=0; x<s; x++) {
            const idx = y*s+x, r = h[y*s+((x+1)%s)], d = h[((y+1)%s)*s+x];
            const dx = (r-h[idx])/255, dy = (d-h[idx])/255, nz = 0.3, mag = Math.sqrt(dx*dx+dy*dy+nz*nz);
            const p = idx*4; nImg.data[p] = ((-dx/mag)*0.5+0.5)*255; nImg.data[p+1] = ((-dy/mag)*0.5+0.5)*255; nImg.data[p+2] = ((nz/mag)*0.5+0.5)*255; nImg.data[p+3] = 255;
        }
    }
    nCtx.putImageData(nImg, 0, 0);

    const rCan = document.createElement("canvas"); rCan.width = rCan.height = s;
    const rCtx = rCan.getContext("2d"), rImg = rCtx.createImageData(s, s);
    for(let i=0; i<s*s; i++) {
        // High roughness (white) but with random SPARKLES (black pixels)
        const spark = Math.random() > 0.995 ? 0 : 255;
        rImg.data[i*4] = rImg.data[i*4+1] = rImg.data[i*4+2] = Math.min(255, h[i] + spark);
        rImg.data[i*4+3] = 255;
    }
    rCtx.putImageData(rImg, 0, 0);
    
    return { 
        normalMap: new THREE.CanvasTexture(nCan), 
        roughnessMap: new THREE.CanvasTexture(rCan) 
    };
}

function createLightBeams() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0, "rgba(200, 240, 255, 0.4)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0,0,64,256);
    const tex = new THREE.CanvasTexture(c);
    
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const geo = new THREE.PlaneGeometry(1, 10);
    for(let i=0; i<15; i++){
        const beam = new THREE.Mesh(geo, mat);
        beam.userData.isBeam = true;
        const phi = Math.random()*Math.PI*2, theta = Math.random()*Math.PI*0.4, r = 3.8;
        beam.position.set(r*Math.sin(theta)*Math.cos(phi), r*Math.sin(theta)*Math.sin(phi), r*Math.cos(theta));
        beam.lookAt(0,0,0); beam.rotateX(Math.PI/2);
        iglooGroup.add(beam);
    }
}

function createChimneySmoke() {
    const smokeGroup = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    for(let i=0; i<10; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat.clone());
        p.position.set(0, 7.5 + i*0.8, 0); p.userData.offset = Math.random()*20;
        smokeGroup.add(p);
    }
    iglooGroup.add(smokeGroup); iglooGroup.userData.smoke = smokeGroup;
}

function createGroundSpecular() {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(14, 32), new THREE.MeshStandardMaterial({ color: 0xccdcff, transparent: true, opacity: 0.15, roughness: 0.1, metalness: 0.8 }));
    disc.rotation.x = -Math.PI/2; disc.position.y = -2.1;
    introScene.add(disc);
}

function createEnvironment() {
    for(let i=0; i<8; i++) {
        const a = (i/8)*Math.PI*2 + Math.random(), d = 35+Math.random()*25;
        createSnowPine(Math.cos(a)*d, -2, Math.sin(a)*d, 3+Math.random()*3);
    }
}

function createSnowPine(x, y, z, s) {
    const g = new THREE.Group(), lm = new THREE.MeshStandardMaterial({ color: 0x071a0d }), sm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    for(let i=0; i<4; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), lm); c.position.y = i*2; c.scale.set(1-i*0.2, 1, 1-i*0.2); g.add(c);
        const sn = new THREE.Mesh(new THREE.ConeGeometry(2.1, 4.1, 8), sm); sn.position.y = i*2+0.1; sn.scale.set(1-i*0.2, 0.15, 1-i*0.2); g.add(sn);
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
            gsap.to(exp, { value: 0.25, duration: 0.8, onUpdate: () => updateEffects(exp.value) });
            gsap.to(iglooGroup.rotation, { x: -mouse.y*0.08, y: mouse.x*0.15, duration: 1.5 });
        } else {
            document.body.style.cursor = 'default';
            gsap.to(exp, { value: 0, duration: 1.2, ease: "elastic.out(1,0.8)", onUpdate: () => updateEffects(exp.value) });
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
            c.material.emissiveIntensity = 0.05 + f * 1.5;
        }
        if (c.userData.isBeam) c.material.opacity = 0.2 + f * 2;
    });
}

function triggerTransition() {
    if (iglooGroup.userData.campfire) gsap.to(iglooGroup.userData.campfire, { intensity: 6000, duration: 1.5, ease: "power4.in" });
    gsap.to(introBloom, { strength: 25, radius: 2.0, duration: 1.8 });
    setTimeout(() => { if (window.triggerIntroTransition) window.triggerIntroTransition(); }, 1500);
}

function introAnimate() {
    if (!introActive) return;
    introAnimId = requestAnimationFrame(introAnimate);
    const t = (introClock.t += 0.016);
    introCamera.position.set(Math.sin(t*0.06)*22, 5 + Math.sin(t*0.2), Math.cos(t*0.06)*22);
    introCamera.lookAt(0, 2, 0);
    
    if (snowParticles) {
        const pa = snowParticles.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            let py = pa.getY(i) - 0.06;
            pa.setY(i, py < -2 ? 50 : py);
        }
        pa.needsUpdate = true;
    }
    
    if (iglooGroup && iglooGroup.userData.campfire) {
        iglooGroup.userData.campfire.intensity = 350 + noise(t*18, 0)*180;
    }
    
    if (iglooGroup && iglooGroup.userData.smoke) {
        iglooGroup.userData.smoke.children.forEach((p, i) => {
            p.position.y += 0.04; 
            p.position.x = Math.sin(t*0.5 + p.userData.offset) * 0.8;
            p.material.opacity -= 0.003;
            if(p.material.opacity <= 0) { p.position.y = 7.5; p.material.opacity = 0.2; }
        });
    }
    
    if (introComposer) introComposer.render();
    else introRenderer.render(introScene, introCamera);
}

window.triggerIntroTransition = function(callback) {
    introActive = false; cancelAnimationFrame(introAnimId);
    gsap.to(introCamera.position, { y: 150, duration: 2.5, ease: "power3.in" });
    gsap.to("#intro-whiteout", { opacity: 1, duration: 1.8, delay: 0.5, onComplete: callback });
};

function createPremiumSnow() {
    const count = 6000, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i*3] = (Math.random()-0.5)*200; pos[i*3+1] = Math.random()*60; pos[i*3+2] = (Math.random()-0.5)*200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowParticles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, color: 0xffffff, transparent: true, opacity: 0.5 }));
    introScene.add(snowParticles);
}
