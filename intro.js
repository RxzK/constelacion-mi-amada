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
        introRenderer.toneMapping = THREE.ReinhardToneMapping;
        introRenderer.toneMappingExposure = 1.0;
        introRenderer.shadowMap.enabled = true;
        introRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

        /* ---- SCENE ---- */
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x010512);
        introScene.fog = new THREE.FogExp2(0x010512, 0.015);

        /* ---- CAMERA ---- */
        introCamera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 4, 20);
        introCamera.lookAt(0, 2, 0);

        /* ---- LIGHTS ---- */
        // Cinematic Moonlight
        const moonLight = new THREE.DirectionalLight(0x7dabff, 1.2);
        moonLight.position.set(15, 20, 10);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(1024, 1024);
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 100;
        moonLight.shadow.bias = -0.005;
        introScene.add(moonLight);

        // Soft Fill Light
        const fillLight = new THREE.PointLight(0x3344aa, 0.5);
        fillLight.position.set(-10, 5, -5);
        introScene.add(fillLight);

        // Ambient (Deep Blue Sky)
        const ambient = new THREE.AmbientLight(0x101530, 0.6);
        introScene.add(ambient);

        /* ---- BUILDER FUNCTIONS ---- */
        createCinematicTerrain();
        createPremiumSnow();
        loadBlockyIgloo();

        /* ---- POST-PROCESSING (BLOOM) ---- */
        const renderScene = new THREE.RenderPass(introScene, introCamera);
        introBloom = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.45, 0.8
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

    /* ==== TERRAIN: CINEMATIC NOISE ==== */
    function createCinematicTerrain() {
        const geo = new THREE.PlaneGeometry(250, 250, 128, 128);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            let y = 0;
            // Larger hills
            y += Math.sin(x * 0.03) * 2.5;
            y += Math.cos(z * 0.04) * 2.0;
            // Small noise
            y += Math.sin(x * 0.15 + z * 0.1) * 0.4;
            // Flat area for the igloo
            const dist = Math.sqrt(x * x + z * z);
            if (dist < 8) {
                const factor = Math.min(1, Math.max(0, (dist - 4) / 4));
                y *= factor;
            }
            pos.setY(i, y);
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xe0f1ff,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: false,
        });
        const terrain = new THREE.Mesh(geo, mat);
        terrain.position.y = -2;
        terrain.receiveShadow = true;
        introScene.add(terrain);
    }

    /* ==== LOAD BLOCKY IGLOO (TRUE 3D) ==== */
    function loadBlockyIgloo() {
        iglooGroup = new THREE.Group();
        iglooGroup.position.set(0, -2, 0);

        // Premium Frosted Ice Material (Physical)
        const iceBlockMat = new THREE.MeshPhysicalMaterial({
            color: 0xd0e8ff,
            emissive: 0x002233,
            emissiveIntensity: 0.5,
            metalness: 0.1,
            roughness: 0.25,
            transmission: 0.6,
            thickness: 0.5,
            transparent: true,
            opacity: 0.95,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
        });

        const loader = new THREE.OBJLoader();
        loader.load('igloo.obj', function (object) {
            object.traverse(function (child) {
                if (child.isMesh) {
                    child.material = iceBlockMat;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.geometry.computeVertexNormals();
                }
            });
            iglooGroup.add(object);
        });

        // 1. Warm campfire light (Very bright focal point)
        const campfire = new THREE.PointLight(0xff7700, 4.0, 15);
        campfire.position.set(0, 1.2, 3);
        campfire.castShadow = true;
        campfire.shadow.bias = -0.01;
        iglooGroup.add(campfire);
        iglooGroup.userData.campfire = campfire;

        // 2. Volumetric-style glow Sprite at entrance
        const glowTex = createGlowTexture(0xff5500);
        const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
        const entryGlow = new THREE.Sprite(glowMat);
        entryGlow.position.set(0, 1.2, 4.5);
        entryGlow.scale.set(6, 6, 1);
        iglooGroup.add(entryGlow);
        iglooGroup.userData.entryGlow = entryGlow;

        // 3. Snow cap (Fluffy top layer)
        const capGeo = new THREE.SphereGeometry(3.7, 32, 12, 0, Math.PI * 2, 0, Math.PI / 5);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.castShadow = true;
        iglooGroup.add(cap);

        introScene.add(iglooGroup);
    }

    function createGlowTexture(colorStr) {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        g.addColorStop(0, "rgba(255, 120, 0, 1)");
        g.addColorStop(0.3, "rgba(255, 80, 0, 0.4)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
    }

    /* ==== DENSE CINEMATIC SNOW ==== */
    function createPremiumSnow() {
        const count = 6000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const vels = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 150;
            pos[i * 3 + 1] = Math.random() * 60;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 150;
            vels[i] = 0.03 + Math.random() * 0.08;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

        const tex = createSnowFlakeTexture();
        const mat = new THREE.PointsMaterial({
            size: 0.18, map: tex, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        snowParticles = new THREE.Points(geo, mat);
        snowParticles.userData.vels = vels;
        introScene.add(snowParticles);
    }

    function createSnowFlakeTexture() {
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

    /* ==== ANIMATION LOOP ==== */
    function introAnimate() {
        if (!introActive) return;
        introAnimId = requestAnimationFrame(introAnimate);
        introClock.t += 0.016;
        const t = introClock.t;

        // Dynamic Camera Orbit (Tighter focus on igloo)
        const radius = 17;
        const speed = 0.07;
        introCamera.position.x = Math.sin(t * speed) * radius;
        introCamera.position.z = Math.cos(t * speed) * radius;
        introCamera.position.y = 3.5 + Math.sin(t * 0.12) * 0.8;
        introCamera.lookAt(0, 1.8, 0);

        // Falling Snow Animation
        if (snowParticles) {
            const pa = snowParticles.geometry.attributes.position;
            const vs = snowParticles.userData.vels;
            for (let i = 0; i < pa.count; i++) {
                let py = pa.getY(i) - vs[i];
                let px = pa.getX(i) + Math.sin(t * 0.8 + i) * 0.005;
                if (py < -2) py = 60;
                pa.setX(i, px);
                pa.setY(i, py);
            }
            pa.needsUpdate = true;
        }

        // Igloo Dynamic Effects
        if (iglooGroup) {
            const campfire = iglooGroup.userData.campfire;
            const glow = iglooGroup.userData.entryGlow;
            if (campfire) {
                // Intense flickering
                campfire.intensity = 4.0 + Math.sin(t * 8) * 0.6 + Math.random() * 0.4;
            }
            if (glow) {
                // Pulsing volumetric effect
                glow.material.opacity = 0.5 + Math.sin(t * 4) * 0.15;
                const s = 6 + Math.sin(t * 2.5) * 0.4;
                glow.scale.set(s, s, 1);
            }
        }

        introComposer.render();
    }

    /* ==== TRANSITION LOGIC ==== */
    window.triggerIntroTransition = function (callback) {
        introActive = false;
        cancelAnimationFrame(introAnimId);

        // Render transition loop
        function loop() {
            if (introComposer) introComposer.render();
            if (!introActive) requestAnimationFrame(loop);
        }
        loop();

        gsap.to(introCamera.position, { y: 70, duration: 2.5, ease: "power2.in" });
        gsap.to(introBloom, { strength: 10, duration: 2.5 });

        const whiteout = document.getElementById("intro-whiteout");
        if (whiteout) {
            gsap.to(whiteout, {
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
