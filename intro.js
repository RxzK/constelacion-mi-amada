/* ===== 3D PANORAMIC AURORA INTRO =====
   Renders a winter landscape with aurora borealis,
   falling snow, and a glowing portal beacon.
========================================= */

(function () {
    "use strict";

    let introRenderer, introScene, introCamera, introComposer, introBloom;
    let snowParticles, auroraGroup, portalGroup;
    let introAnimId;
    let introActive = true;
    const introClock = { t: 0 };

    window.initIntroScene = function () {
        const canvas = document.getElementById("intro-canvas");
        if (!canvas) return;

        /* ---- RENDERER ---- */
        introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        introRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        introRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
        introRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        introRenderer.toneMappingExposure = 0.8;

        /* ---- SCENE ---- */
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020818);
        introScene.fog = new THREE.FogExp2(0x020818, 0.015);

        /* ---- CAMERA ---- */
        introCamera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 5, 25);
        introCamera.lookAt(0, 6, 0);

        /* ---- LIGHTS ---- */
        const ambient = new THREE.AmbientLight(0x2233aa, 0.6);
        introScene.add(ambient);
        const moonLight = new THREE.DirectionalLight(0x8899ff, 0.8);
        moonLight.position.set(10, 30, 20);
        introScene.add(moonLight);

        /* ---- TERRAIN ---- */
        createTerrain();

        /* ---- STARFIELD ---- */
        createIntroStarfield();

        /* ---- AURORA BOREALIS ---- */
        createAurora();

        /* ---- FALLING SNOW ---- */
        createSnow();

        /* ---- PORTAL BEACON ---- */
        createPortal();

        /* ---- POST-PROCESSING (BLOOM) ---- */
        const renderScene = new THREE.RenderPass(introScene, introCamera);
        introBloom = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.2, 0.5, 0.7
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

    /* ==== TERRAIN ==== */
    function createTerrain() {
        const geo = new THREE.PlaneGeometry(200, 200, 100, 100);
        geo.rotateX(-Math.PI / 2);

        // Gentle hills displacement
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            let y = 0;
            y += Math.sin(x * 0.05) * 1.5;
            y += Math.cos(z * 0.08) * 1.0;
            y += Math.sin(x * 0.02 + z * 0.03) * 2.5;
            // Lower the terrain beneath the camera
            const dist = Math.sqrt(x * x + z * z);
            if (dist < 15) y = Math.max(y, -0.5);
            pos.setY(i, y);
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xc8ddf0,
            roughness: 0.85,
            metalness: 0.1,
            flatShading: true,
        });
        const terrain = new THREE.Mesh(geo, mat);
        terrain.position.y = -2;
        introScene.add(terrain);

        // Ice patches (subtle reflective spots)
        for (let i = 0; i < 8; i++) {
            const iceGeo = new THREE.CircleGeometry(2 + Math.random() * 3, 16);
            iceGeo.rotateX(-Math.PI / 2);
            const iceMat = new THREE.MeshStandardMaterial({
                color: 0xaaddff,
                roughness: 0.1,
                metalness: 0.4,
                transparent: true,
                opacity: 0.3,
            });
            const ice = new THREE.Mesh(iceGeo, iceMat);
            ice.position.set(
                (Math.random() - 0.5) * 60,
                -1.8,
                (Math.random() - 0.5) * 60
            );
            introScene.add(ice);
        }
    }

    /* ==== STARFIELD ==== */
    function createIntroStarfield() {
        const count = 3000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const r = 80 + Math.random() * 120;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = Math.abs(r * Math.sin(phi) * Math.sin(theta)) + 10;
            pos[i * 3 + 2] = r * Math.cos(phi);
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

        // Create glow texture
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.3, "rgba(255,255,255,0.5)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
        const tex = new THREE.CanvasTexture(c);

        const mat = new THREE.PointsMaterial({
            size: 0.4, map: tex, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        introScene.add(new THREE.Points(geo, mat));
    }

    /* ==== AURORA BOREALIS ==== */
    function createAurora() {
        auroraGroup = new THREE.Group();

        const auroraColors = [
            new THREE.Color(0x00ff88), // green
            new THREE.Color(0x00ccff), // teal
            new THREE.Color(0x8855ff), // violet
            new THREE.Color(0x22ffaa), // seafoam
        ];

        for (let band = 0; band < 6; band++) {
            const segments = 60;
            const geo = new THREE.PlaneGeometry(120, 18, segments, 1);

            const color = auroraColors[band % auroraColors.length];
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.08 + Math.random() * 0.06,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (Math.random() - 0.5) * 30,
                40 + band * 5 + Math.random() * 8,
                -30 - Math.random() * 40
            );
            mesh.rotation.x = -0.3 + Math.random() * 0.2;
            mesh.rotation.z = (Math.random() - 0.5) * 0.3;

            // Store wave data
            mesh.userData = {
                basePositions: new Float32Array(geo.attributes.position.array),
                speed: 0.3 + Math.random() * 0.5,
                amplitude: 3 + Math.random() * 4,
                offset: Math.random() * Math.PI * 2,
            };

            auroraGroup.add(mesh);
        }
        introScene.add(auroraGroup);
    }

    /* ==== FALLING SNOW ==== */
    function createSnow() {
        const count = 4000;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 120;
            pos[i * 3 + 1] = Math.random() * 60;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
            velocities[i] = 0.02 + Math.random() * 0.06;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const ctx = c.getContext("2d");
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
        const snowTex = new THREE.CanvasTexture(c);

        const mat = new THREE.PointsMaterial({
            size: 0.15, map: snowTex, transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        snowParticles = new THREE.Points(geo, mat);
        snowParticles.userData.velocities = velocities;
        introScene.add(snowParticles);
    }

    /* ==== PORTAL BEACON ==== */
    function createPortal() {
        portalGroup = new THREE.Group();
        portalGroup.position.set(0, -1, 0);

        // Base platform — a glowing circular pad
        const padGeo = new THREE.CylinderGeometry(2, 2.5, 0.3, 32);
        const padMat = new THREE.MeshStandardMaterial({
            color: 0x00ddff,
            emissive: 0x004488,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.8,
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        portalGroup.add(pad);

        // Pillar of light
        const pillarGeo = new THREE.CylinderGeometry(0.3, 1.5, 30, 16, 1, true);
        const pillarMat = new THREE.MeshBasicMaterial({
            color: 0x00eeff,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.y = 15;
        portalGroup.add(pillar);

        // Inner pillar (brighter, thinner)
        const innerGeo = new THREE.CylinderGeometry(0.1, 0.6, 30, 8, 1, true);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.08,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.y = 15;
        portalGroup.add(inner);

        // Point light at the base
        const portalLight = new THREE.PointLight(0x00eeff, 3, 20);
        portalLight.position.y = 1;
        portalGroup.add(portalLight);

        // Orbiting sparkles
        for (let i = 0; i < 12; i++) {
            const sparkGeo = new THREE.SphereGeometry(0.06, 8, 8);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8 });
            const spark = new THREE.Mesh(sparkGeo, sparkMat);
            spark.userData = {
                angle: (i / 12) * Math.PI * 2,
                radius: 2 + Math.random() * 0.5,
                speed: 0.5 + Math.random() * 0.5,
                yOffset: Math.random() * 3,
            };
            portalGroup.add(spark);
        }

        introScene.add(portalGroup);
    }

    /* ==== ANIMATION LOOP ==== */
    function introAnimate() {
        if (!introActive) return;
        introAnimId = requestAnimationFrame(introAnimate);
        introClock.t += 0.016;
        const t = introClock.t;

        // Slow camera orbit
        const camRadius = 25;
        const camSpeed = 0.04;
        introCamera.position.x = Math.sin(t * camSpeed) * camRadius;
        introCamera.position.z = Math.cos(t * camSpeed) * camRadius;
        introCamera.position.y = 5 + Math.sin(t * 0.1) * 1.5;
        introCamera.lookAt(0, 6, 0);

        // Animate aurora waves
        if (auroraGroup) {
            auroraGroup.children.forEach(mesh => {
                const ud = mesh.userData;
                const positions = mesh.geometry.attributes.position;
                const base = ud.basePositions;
                for (let i = 0; i < positions.count; i++) {
                    const bx = base[i * 3];
                    const by = base[i * 3 + 1];
                    const wave = Math.sin(bx * 0.1 + t * ud.speed + ud.offset) * ud.amplitude;
                    const wave2 = Math.cos(bx * 0.05 + t * ud.speed * 0.7) * ud.amplitude * 0.5;
                    positions.setY(i, by + wave + wave2);
                }
                positions.needsUpdate = true;
                // Slowly pulse opacity
                mesh.material.opacity = (0.06 + Math.abs(Math.sin(t * 0.3 + ud.offset)) * 0.08);
            });
        }

        // Animate falling snow
        if (snowParticles) {
            const pos = snowParticles.geometry.attributes.position;
            const vels = snowParticles.userData.velocities;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i);
                y -= vels[i];
                // Gentle wind sway
                let x = pos.getX(i);
                x += Math.sin(t * 0.5 + i) * 0.003;
                if (y < -2) {
                    y = 55 + Math.random() * 5;
                    x = (Math.random() - 0.5) * 120;
                    pos.setZ(i, (Math.random() - 0.5) * 120);
                }
                pos.setX(i, x);
                pos.setY(i, y);
            }
            pos.needsUpdate = true;
        }

        // Animate portal sparkles
        if (portalGroup) {
            portalGroup.children.forEach(child => {
                if (child.userData && child.userData.angle !== undefined) {
                    const ud = child.userData;
                    ud.angle += ud.speed * 0.016;
                    child.position.x = Math.cos(ud.angle) * ud.radius;
                    child.position.z = Math.sin(ud.angle) * ud.radius;
                    child.position.y = ud.yOffset + Math.sin(t * 2 + ud.angle) * 1.5 + 1;
                    child.material.opacity = 0.5 + Math.sin(t * 3 + ud.angle) * 0.3;
                }
            });
        }

        introComposer.render();
    }

    /* ==== TRANSITION TO UNIVERSE ==== */
    window.triggerIntroTransition = function (callback) {
        introActive = false;
        cancelAnimationFrame(introAnimId);

        // Camera rockets upward
        gsap.to(introCamera.position, {
            y: 80,
            duration: 2.5,
            ease: "power2.in",
        });
        gsap.to(introBloom, {
            strength: 8,
            duration: 2.5,
        });

        // White out effect
        const whiteOverlay = document.getElementById("intro-whiteout");
        if (whiteOverlay) {
            gsap.to(whiteOverlay, {
                opacity: 1,
                duration: 2.5,
                delay: 0.5,
                onComplete: () => {
                    // Dispose intro scene
                    introRenderer.dispose();
                    // Call the constellation init
                    if (callback) callback();
                }
            });
        } else {
            setTimeout(() => {
                introRenderer.dispose();
                if (callback) callback();
            }, 2800);
        }
    };

    /* ==== CLEANUP ==== */
    window.disposeIntroScene = function () {
        introActive = false;
        if (introAnimId) cancelAnimationFrame(introAnimId);
    };

})();
