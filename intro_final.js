import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

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
    loadBlockyIgloo();

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

function loadBlockyIgloo() {
    iglooGroup = new THREE.Group();
    iglooGroup.position.set(0, -0.1, 0);

    // 1:1 REAL ICE MATERIAL (The TikTok Secret)
    const iceBlockMat = new THREE.MeshPhysicalMaterial({
        color: 0xeefbff,
        emissive: 0x44aaff,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0,
        transmission: 0.9, // Refraction!
        ior: 1.31,        // Index of Refraction for Ice
        thickness: 2.0,   // Light passing THROUGH the block
        specularIntensity: 1.0,
        clearcoat: 0.5,
        transparent: true
    });

    const loader = new OBJLoader();
    loader.load('igloo.obj', (object) => {
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = iceBlockMat;
            }
        });
        iglooGroup.add(object);
    });

    // Intense internal pulsing fire
    const campfire = new THREE.PointLight(0xffaa22, 15.0, 25);
    campfire.position.set(0, 1.5, 2.0);
    iglooGroup.add(campfire);
    iglooGroup.userData.campfire = campfire;

    introScene.add(iglooGroup);
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
        iglooGroup.userData.campfire.intensity = 15 + Math.sin(t * 10) * 5;
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
