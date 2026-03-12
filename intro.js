/* ===== 3D PANORAMIC AURORA INTRO =====
   Renders a winter landscape with igloo, aurora borealis,
   falling snow, warm glow, and real-time shadows.
========================================= */

(function () {
    "use strict";

    let introRenderer, introScene, introCamera, introComposer, introBloom;
    let snowParticles, auroraGroup, iglooGroup;
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
        introRenderer.toneMappingExposure = 0.9;
        introRenderer.shadowMap.enabled = true;
        introRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

        /* ---- SCENE ---- */
        introScene = new THREE.Scene();
        introScene.background = new THREE.Color(0x020818);
        introScene.fog = new THREE.FogExp2(0x020818, 0.012);

        /* ---- CAMERA ---- */
        introCamera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
        introCamera.position.set(0, 4, 18);
        introCamera.lookAt(0, 3, 0);

        /* ---- LIGHTS ---- */
        // Moonlight (casts shadows)
        const moonLight = new THREE.DirectionalLight(0x6688cc, 1.0);
        moonLight.position.set(15, 25, 10);
        moonLight.castShadow = true;
        moonLight.shadow.mapSize.set(1024, 1024);
        moonLight.shadow.camera.near = 0.5;
        moonLight.shadow.camera.far = 80;
        moonLight.shadow.camera.left = -30;
        moonLight.shadow.camera.right = 30;
        moonLight.shadow.camera.top = 30;
        moonLight.shadow.camera.bottom = -10;
        introScene.add(moonLight);

        // Subtle blue ambient
        const ambient = new THREE.AmbientLight(0x1a2244, 0.8);
        introScene.add(ambient);

        // Hemisphere light (sky blue top, snow reflection bottom)
        const hemi = new THREE.HemisphereLight(0x3344aa, 0x445566, 0.4);
        introScene.add(hemi);

        /* ---- BUILD SCENE ---- */
        createTerrain();
        createIntroStarfield();
        createAurora();
        createSnow();
        createIgloo();

        /* ---- POST-PROCESSING (BLOOM) ---- */
        const renderScene = new THREE.RenderPass(introScene, introCamera);
        introBloom = new THREE.UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.0, 0.4, 0.75
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
        const geo = new THREE.PlaneGeometry(200, 200, 120, 120);
        geo.rotateX(-Math.PI / 2);

        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            let y = 0;
            y += Math.sin(x * 0.04) * 1.8;
            y += Math.cos(z * 0.06) * 1.2;
            y += Math.sin(x * 0.02 + z * 0.03) * 2.5;
            // Flatten around igloo area
            const dist = Math.sqrt(x * x + z * z);
            if (dist < 8) {
                const fade = Math.max(0, (dist - 3) / 5);
                y = y * fade;
            }
            pos.setY(i, y);
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xd4e8f7,
            roughness: 0.9,
            metalness: 0.05,
            flatShading: true,
        });
        const terrain = new THREE.Mesh(geo, mat);
        terrain.position.y = -2;
        terrain.receiveShadow = true;
        introScene.add(terrain);

        // Snow drifts (small mounds near igloo)
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r = 6 + Math.random() * 4;
            const driftGeo = new THREE.SphereGeometry(1 + Math.random() * 1.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
            const driftMat = new THREE.MeshStandardMaterial({
                color: 0xd8ecf8,
                roughness: 0.85,
                metalness: 0.05,
            });
            const drift = new THREE.Mesh(driftGeo, driftMat);
            drift.position.set(Math.cos(angle) * r, -2, Math.sin(angle) * r);
            drift.receiveShadow = true;
            drift.castShadow = true;
            introScene.add(drift);
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
            new THREE.Color(0x00ff88),
            new THREE.Color(0x00ccff),
            new THREE.Color(0x8855ff),
            new THREE.Color(0x22ffaa),
        ];

        for (let band = 0; band < 6; band++) {
            const segments = 60;
            const geo = new THREE.PlaneGeometry(120, 18, segments, 1);
            const color = auroraColors[band % auroraColors.length];
            const mat = new THREE.MeshBasicMaterial({
                color, transparent: true,
                opacity: 0.08 + Math.random() * 0.06,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(
                (Math.random() - 0.5) * 30,
                35 + band * 5 + Math.random() * 8,
                -30 - Math.random() * 40
            );
            mesh.rotation.x = -0.3 + Math.random() * 0.2;
            mesh.rotation.z = (Math.random() - 0.5) * 0.3;
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
        const count = 5000;
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

    /* ==== ICE BLOCK TEXTURE GENERATOR ==== */
    function generateIceBlockTexture() {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 256;
        const ctx = c.getContext("2d");

        // Base color (mostly transparent, handles emit map)
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, 512, 256);

        // Draw grid
        const rows = 8;
        const cols = 16;
        const w = 512 / cols;
        const h = 256 / rows;

        ctx.strokeStyle = "#44ccff"; // Cyan glow color
        ctx.lineWidth = 4;
        ctx.lineJoin = "round";

        for (let r = 0; r < rows; r++) {
            const offset = (r % 2 === 0) ? 0 : w / 2;
            for (let c = 0; c < cols + 1; c++) {
                const x = c * w - offset;
                const y = r * h;
                
                // Draw block outline
                ctx.strokeRect(x, y, w, h);
                
                // Inner glow (softer lines)
                ctx.lineWidth = 2;
                ctx.strokeStyle = "rgba(100, 220, 255, 0.4)";
                ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
                
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#44ccff";
            }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        return tex;
    }

    /* ==== IGLOO ==== */
    function createIgloo() {
        iglooGroup = new THREE.Group();
        iglooGroup.position.set(0, -2, 0);

        // Generate ice block texture with glowing seams
        const iceBlockTex = generateIceBlockTexture();

        // Ice block material (with seam glow)
        const iceBlockMat = new THREE.MeshStandardMaterial({
            map: iceBlockTex,
            color: 0xb8d4e8,
            roughness: 0.4,
            metalness: 0.15,
            emissive: 0x004466,
            emissiveIntensity: 0.3,
            emissiveMap: iceBlockTex,
        });

        // Main dome (half sphere) — with ice blocks
        const domeGeo = new THREE.SphereGeometry(3.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = new THREE.Mesh(domeGeo, iceBlockMat);
        dome.castShadow = true;
        dome.receiveShadow = true;
        iglooGroup.add(dome);

        // Snow cap on top
        const capGeo = new THREE.SphereGeometry(3.7, 24, 8, 0, Math.PI * 2, 0, Math.PI / 6);
        const capMat = new THREE.MeshStandardMaterial({
            color: 0xf0f5ff, roughness: 0.9, metalness: 0,
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.castShadow = true;
        iglooGroup.add(cap);

        // Entrance tunnel — also with ice blocks
        const tunnelGeo = new THREE.CylinderGeometry(1.2, 1.4, 3, 16, 1, true, 0, Math.PI);
        tunnelGeo.rotateZ(Math.PI / 2);
        tunnelGeo.rotateY(Math.PI / 2);
        const tunnel = new THREE.Mesh(tunnelGeo, iceBlockMat);
        tunnel.position.set(0, 0.8, 3.8);
        tunnel.castShadow = true;
        tunnel.receiveShadow = true;
        iglooGroup.add(tunnel);

        // Entrance tunnel roof
        const roofGeo = new THREE.CylinderGeometry(1.3, 1.5, 3.2, 16, 1, false, 0, Math.PI);
        roofGeo.rotateZ(Math.PI / 2);
        roofGeo.rotateY(Math.PI / 2);
        const roof = new THREE.Mesh(roofGeo, iceBlockMat.clone());
        roof.position.set(0, 0.85, 4);
        roof.castShadow = true;
        iglooGroup.add(roof);

        // Entrance opening (dark hole)
        const entranceGeo = new THREE.CircleGeometry(1.0, 16);
        const entranceMat = new THREE.MeshBasicMaterial({
            color: 0x110800,
            side: THREE.FrontSide,
        });
        const entrance = new THREE.Mesh(entranceGeo, entranceMat);
        entrance.position.set(0, 0.8, 5.3);
        iglooGroup.add(entrance);

        // Warm interior glow leaking out of entrance
        const warmLight = new THREE.PointLight(0xff8833, 2.5, 12);
        warmLight.position.set(0, 1.0, 3);
        warmLight.castShadow = true;
        iglooGroup.add(warmLight);
        iglooGroup.userData.warmLight = warmLight;

        // Secondary warm glow (softer, wider)
        const warmLight2 = new THREE.PointLight(0xffaa44, 1.0, 8);
        warmLight2.position.set(0, 1.5, 1);
        iglooGroup.add(warmLight2);
        iglooGroup.userData.warmLight2 = warmLight2;

        // Warm glow sprite visible through entrance
        const glowC = document.createElement("canvas");
        glowC.width = glowC.height = 128;
        const gctx = glowC.getContext("2d");
        const gg = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gg.addColorStop(0, "rgba(255, 150, 50, 1)");
        gg.addColorStop(0.4, "rgba(255, 120, 30, 0.5)");
        gg.addColorStop(1, "rgba(255, 80, 0, 0)");
        gctx.fillStyle = gg;
        gctx.fillRect(0, 0, 128, 128);
        const glowTex = new THREE.CanvasTexture(glowC);

        const glowMat = new THREE.SpriteMaterial({
            map: glowTex,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        const glowSprite = new THREE.Sprite(glowMat);
        glowSprite.position.set(0, 1.0, 4.5);
        glowSprite.scale.set(3, 3, 1);
        iglooGroup.add(glowSprite);
        iglooGroup.userData.glowSprite = glowSprite;

        // Chimney smoke (small particle column)
        const smokeCount = 60;
        const smokeGeo = new THREE.BufferGeometry();
        const smokePos = new Float32Array(smokeCount * 3);
        for (let i = 0; i < smokeCount; i++) {
            smokePos[i * 3] = (Math.random() - 0.5) * 0.3;
            smokePos[i * 3 + 1] = 3.5 + Math.random() * 5;
            smokePos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
        }
        smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
        const smokeMat = new THREE.PointsMaterial({
            size: 0.3,
            color: 0xaabbcc,
            transparent: true,
            opacity: 0.15,
            blending: THREE.NormalBlending,
            depthWrite: false,
        });
        const smoke = new THREE.Points(smokeGeo, smokeMat);
        iglooGroup.add(smoke);
        iglooGroup.userData.smoke = smoke;

        // Snow ring around igloo base
        const ringGeo = new THREE.TorusGeometry(3.8, 0.4, 8, 32);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xe8f0ff,
            roughness: 0.9,
            metalness: 0,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0;
        ring.receiveShadow = true;
        iglooGroup.add(ring);

        introScene.add(iglooGroup);
    }

    /* ==== ANIMATION LOOP ==== */
    function introAnimate() {
        if (!introActive) return;
        introAnimId = requestAnimationFrame(introAnimate);
        introClock.t += 0.016;
        const t = introClock.t;

        // Slow camera orbit around igloo
        const camRadius = 16;
        const camSpeed = 0.06;
        introCamera.position.x = Math.sin(t * camSpeed) * camRadius;
        introCamera.position.z = Math.cos(t * camSpeed) * camRadius;
        introCamera.position.y = 3.5 + Math.sin(t * 0.08) * 1.0;
        introCamera.lookAt(0, 1.5, 0);

        // Animate aurora waves
        if (auroraGroup) {
            auroraGroup.children.forEach(mesh => {
                const ud = mesh.userData;
                if (!ud.basePositions) return;
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
                mesh.material.opacity = 0.06 + Math.abs(Math.sin(t * 0.3 + ud.offset)) * 0.08;
            });
        }

        // Animate falling snow
        if (snowParticles) {
            const pos = snowParticles.geometry.attributes.position;
            const vels = snowParticles.userData.velocities;
            for (let i = 0; i < pos.count; i++) {
                let y = pos.getY(i);
                y -= vels[i];
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

        // Animate igloo effects
        if (iglooGroup) {
            const ud = iglooGroup.userData;
            // Flickering warm light (campfire effect)
            if (ud.warmLight) {
                ud.warmLight.intensity = 2.0 + Math.sin(t * 6) * 0.5 + Math.sin(t * 9.3) * 0.3;
            }
            if (ud.warmLight2) {
                ud.warmLight2.intensity = 0.8 + Math.sin(t * 4) * 0.2;
            }
            // Pulsing glow sprite
            if (ud.glowSprite) {
                ud.glowSprite.material.opacity = 0.4 + Math.sin(t * 5) * 0.15;
                const s = 3 + Math.sin(t * 3) * 0.3;
                ud.glowSprite.scale.set(s, s, 1);
            }
            // Rising smoke
            if (ud.smoke) {
                const sp = ud.smoke.geometry.attributes.position;
                for (let i = 0; i < sp.count; i++) {
                    let y = sp.getY(i);
                    y += 0.01 + Math.random() * 0.005;
                    let x = sp.getX(i);
                    x += Math.sin(t + i) * 0.002;
                    if (y > 9) {
                        y = 3.5;
                        x = (Math.random() - 0.5) * 0.3;
                        sp.setZ(i, (Math.random() - 0.5) * 0.3);
                    }
                    sp.setX(i, x);
                    sp.setY(i, y);
                }
                sp.needsUpdate = true;
            }
        }

        introComposer.render();
    }

    /* ==== TRANSITION TO UNIVERSE ==== */
    window.triggerIntroTransition = function (callback) {
        introActive = false;
        cancelAnimationFrame(introAnimId);

        // Keep rendering during transition
        function transRender() {
            if (introComposer) introComposer.render();
            if (!introActive) requestAnimationFrame(transRender);
        }
        transRender();

        gsap.to(introCamera.position, {
            y: 60, duration: 2.5, ease: "power2.in",
        });
        gsap.to(introBloom, {
            strength: 8, duration: 2.5,
        });

        const whiteOverlay = document.getElementById("intro-whiteout");
        if (whiteOverlay) {
            gsap.to(whiteOverlay, {
                opacity: 1, duration: 2.5, delay: 0.5,
                onComplete: () => {
                    introRenderer.dispose();
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

    window.disposeIntroScene = function () {
        introActive = false;
        if (introAnimId) cancelAnimationFrame(introAnimId);
    };

})();
