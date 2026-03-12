/* ===== 3D HIGH-FIDELITY TIKTOK-STYLE INTRO =====
   Recreated from scratch to match the cinematic quality 
   of the TikTok reference: blocky ice igloo, frosted materials,
   warm internal glow, and moonlit atmosphere.
================================================== */

(function () {
    "use strict";

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
        introRenderer.toneMappingExposure = 1.2;
        introRenderer.physicallyCorrectLights = true;
        introRenderer.shadowMap.enabled = true;
        introRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

        /* ---- SCENE ---- */
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020a24);
        introScene.fog = new THREE.FogExp2(0x020a24, 0.012);

        /* ---- CAMERA ---- */
        introCamera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 4, 18);
        introCamera.lookAt(0, 2, 0);

        /* ---- LIGHTS ---- */
        // 1. Primary Moonlight (Casts Shadows)
        const moonLight = new THREE.DirectionalLight(0x7dadff, 1.5);
        moonLight.position.set(15, 25, 10);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(2048, 2048);
        moonLight.shadow.bias = -0.001;
        introScene.add(moonLight);

        // 2. Rim Light (Backlight to highlight silhouettes)
        const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
        rimLight.position.set(-15, 10, -20);
        introScene.add(rimLight);

        // 3. Ambient blue sky
        const ambient = new THREE.AmbientLight(0x1a2a5a, 0.5);
        introScene.add(ambient);

        /* ---- BUILDER FUNCTIONS ---- */
        createCinematicTerrain();
        createPremiumSnow();
        loadBlockyIgloo();

        /* ---- POST-PROCESSING (BLOOM) ---- */
        const renderScene = new THREE.RenderPass(introScene, introCamera);
        introBloom = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.6, 0.5, 0.85
        );
        introComposer = new THREE.EffectComposer(introRenderer);
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

        /* ---- ANIMATE ---- */
        introAnimate();
    };

    /* ==== TERRAIN: SPARKLY SNOW ==== */
    function createCinematicTerrain() {
        const geo = new THREE.PlaneGeometry(300, 300, 150, 150);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            let y = 0;
            y += Math.sin(x * 0.035) * 3.0;
            y += Math.cos(z * 0.045) * 2.2;
            y += Math.sin(x * 0.2 + z * 0.15) * 0.3;
            // Clear space for igloo
            const dist = Math.sqrt(x * x + z * z);
            if (dist < 9) {
                const f = Math.min(1, Math.max(0, (dist - 4.5) / 4.5));
                y *= f;
            }
            pos.setY(i, y);
        }
        geo.computeVertexNormals();

        // Physically Based Snow (with sparkles)
        const snowMat = new THREE.MeshPhysicalMaterial({
            color: 0xeef8ff,
            roughness: 0.9,
            metalness: 0.0,
            clearcoat: 0.5,
            clearcoatRoughness: 0.2, // Simulated crystals/sparkles
            flatShading: false,
        });
        
        const terrain = new THREE.Mesh(geo, snowMat);
        terrain.position.y = -2;
        terrain.receiveShadow = true;
        introScene.add(terrain);

        // Add "sparkle" dust on ground
        for (let i = 0; i < 15; i++) {
            const iceGeo = new THREE.CircleGeometry(3 + Math.random() * 5, 8);
            iceGeo.rotateX(-Math.PI / 2);
            const iceMat = new THREE.MeshPhysicalMaterial({
                color: 0xddeeff,
                roughness: 0.01,
                metalness: 0.4,
                transparent: true,
                opacity: 0.15,
                reflectivity: 1.0,
            });
            const patch = new THREE.Mesh(iceGeo, iceMat);
            patch.position.set((Math.random()-0.5)*80, -1.9, (Math.random()-0.5)*80);
            introScene.add(patch);
        }
    }

    /* ==== HIGH-FIDELITY IGLOO ==== */
    function loadBlockyIgloo() {
        iglooGroup = new THREE.Group();
        iglooGroup.position.set(0, -2, 0);

        // 1:1 Solid Frosted Ice Material
        const iceBlockMat = new THREE.MeshStandardMaterial({
            color: 0xeefaff,
            emissive: 0x4488ff,
            emissiveIntensity: 0.1,
            roughness: 0.8, // Frosted look
            metalness: 0.0,
            transparent: false,
            opacity: 1.0
        });

        const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });

        const loader = new THREE.OBJLoader();
        loader.load('igloo.obj', function (object) {
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.material = iceBlockMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.geometry.computeVertexNormals();

                    // Create structured outlines
                    const edges = new THREE.EdgesGeometry(child.geometry, 15);
                    const line = new THREE.LineSegments(edges, edgeMat);
                    child.add(line);
                }
            });
            iglooGroup.add(object);
        });

        // Glowing Core / Mortar Gaps
        const mortarMat = new THREE.MeshBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.4,
            side: THREE.BackSide
        });
        const mortarDom = new THREE.Mesh(
            new THREE.SphereGeometry(3.6, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
            mortarMat
        );
        iglooGroup.add(mortarDom);

        // Warm internal pulsing fire
        const campfire = new THREE.PointLight(0xff5500, 5.0, 18);
        campfire.position.set(0, 1.5, 2.5);
        campfire.castShadow = true;
        campfire.shadow.bias = -0.005;
        iglooGroup.add(campfire);
        iglooGroup.userData.campfire = campfire;

        // Volumetric spill glow (Doorway)
        const glowTex = createGlowTexture();
        const glowMat = new THREE.SpriteMaterial({ 
            map: glowTex, transparent: true, opacity: 0.7, 
            blending: THREE.AdditiveBlending, depthWrite: false 
        });
        const spill = new THREE.Sprite(glowMat);
        spill.position.set(0, 1.2, 4.5);
        spill.scale.set(8, 7, 1);
        iglooGroup.add(spill);
        iglooGroup.userData.spill = spill;

        introScene.add(iglooGroup);
    }

    function createGlowTexture() {
        const c = document.createElement("canvas");
        c.width = c.height = 256;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, "rgba(255, 100, 0, 1)");
        g.addColorStop(0.3, "rgba(255, 60, 0, 0.4)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
    }

    /* ==== CINEMATIC SNOW ==== */
    function createPremiumSnow() {
        const count = 7000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const vels = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 160;
            pos[i * 3+1] = Math.random() * 60;
            pos[i * 3+2] = (Math.random() - 0.5) * 160;
            vels[i] = 0.04 + Math.random() * 0.1;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const tex = createSnowTex();
        const mat = new THREE.PointsMaterial({
            size: 0.16, map: tex, transparent: true, opacity: 0.65,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        snowParticles = new THREE.Points(geo, mat);
        snowParticles.userData.vels = vels;
        introScene.add(snowParticles);
    }

    function createSnowTex() {
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(c);
    }

    /* ==== ANIMATION: HANDHELD & POLISH ==== */
    function introAnimate() {
        if (!introActive) return;
        introAnimId = requestAnimationFrame(introAnimate);
        introClock.t += 0.016;
        const t = introClock.t;

        // Cinematic Orbit + Handheld Shake
        const radius = 18;
        const speed = 0.08;
        const orbitX = Math.sin(t * speed) * radius;
        const orbitZ = Math.cos(t * speed) * radius;
        
        // Handheld wiggle (Multi-frequency noise)
        const shakeX = Math.sin(t * 1.5) * 0.2 + Math.cos(t * 3.1) * 0.1;
        const shakeY = Math.cos(t * 1.2) * 0.15 + Math.sin(t * 2.8) * 0.05;
        const shakeZ = Math.sin(t * 0.9) * 0.1;

        introCamera.position.set(orbitX + shakeX, 4 + shakeY, orbitZ + shakeZ);
        introCamera.lookAt(shakeX * 2, 2 + shakeY, shakeZ * 2);

        // Snow Falling
        if (snowParticles) {
            const pa = snowParticles.geometry.attributes.position;
            const vs = snowParticles.userData.vels;
            for (let i = 0; i < pa.count; i++) {
                let y = pa.getY(i) - vs[i];
                let x = pa.getX(i) + Math.sin(t + i) * 0.006;
                if (y < -2.1) y = 60;
                pa.setX(i, x);
                pa.setY(i, y);
            }
            pa.needsUpdate = true;
        }

        // Fire & Glow Pulsing
        if (iglooGroup) {
            const campfire = iglooGroup.userData.campfire;
            const spill = iglooGroup.userData.spill;
            if (campfire) {
                // High-freq flicker + low-freq pulse
                campfire.intensity = 5.0 + Math.sin(t * 12) * 0.8 + Math.cos(t * 3) * 0.5 + Math.random() * 0.4;
            }
            if (spill) {
                spill.material.opacity = 0.6 + Math.sin(t * 5.5) * 0.15;
                const s = 8 + Math.sin(t * 2.1) * 0.6;
                spill.scale.set(s, s*0.9, 1);
            }
        }

        introComposer.render();
    }

    /* ==== TRANSITION ==== */
    window.triggerIntroTransition = function (callback) {
        introActive = false;
        cancelAnimationFrame(introAnimId);
        
        function tLoop() {
            if (introComposer) introComposer.render();
            if (!introActive) requestAnimationFrame(tLoop);
        }
        tLoop();

        gsap.to(introCamera.position, { y: 80, duration: 2.5, ease: "power2.in" });
        gsap.to(introBloom, { strength: 12, duration: 2.5 });

        const overlay = document.getElementById("intro-whiteout");
        if (overlay) {
            gsap.to(overlay, {
                opacity: 1, duration: 2.5, delay: 0.5,
                onComplete: () => {
                    introRenderer.dispose();
                    if (callback) callback();
                }
            });
        }
    };

    window.disposeIntroScene = function () {
        introActive = false;
        if (introAnimId) cancelAnimationFrame(introAnimId);
    };

})();
