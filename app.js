import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {
        /* ---- LIVE COUNTER ---- */
    function updateCounter() {
        const now = new Date();
        const diff = Math.max(0, now - SITE_CONFIG.startDate);
        const secs = Math.floor(diff / 1000) % 60;
        const mins = Math.floor(diff / 60000) % 60;
        const hours = Math.floor(diff / 3600000) % 24;
        const days = Math.floor(diff / 86400000);
        document.getElementById("cnt-days").textContent = String(days).padStart(2, "0");
        document.getElementById("cnt-hours").textContent = String(hours).padStart(2, "0");
        document.getElementById("cnt-mins").textContent = String(mins).padStart(2, "0");
        document.getElementById("cnt-secs").textContent = String(secs).padStart(2, "0");
    }
    updateCounter();
    setInterval(updateCounter, 1000);

    /* ---- ROTATING SUBTITLE ---- */
    let subtitleIdx = 0;
    const subtitleEl = document.getElementById("subtitle-text");
    function nextSubtitle() {
        subtitleEl.style.opacity = "0";
        setTimeout(() => {
            subtitleEl.textContent = SITE_CONFIG.subtitles[subtitleIdx];
            subtitleEl.style.opacity = "1";
            subtitleIdx = (subtitleIdx + 1) % SITE_CONFIG.subtitles.length;
        }, 500);
    }
    nextSubtitle();
    setInterval(nextSubtitle, 4000);

    /* ---- SCREEN TRANSITIONS ---- */
    const introScreen = document.getElementById("intro-screen");
    const universeScreen = document.getElementById("universe-screen");
    const enterBtn = document.getElementById("enter-btn");
    const backBtn = document.getElementById("back-btn");

    let sceneInitialized = false;

    // Initialize the 3D intro scene immediately
    if (window.initIntroScene) {
        window.initIntroScene();
    }

    enterBtn.addEventListener("click", () => {
        const overlay = document.getElementById("intro-overlay");
        gsap.to(overlay, { opacity: 0, duration: 0.8 });

        if (window.triggerIntroTransition) {
            window.triggerIntroTransition(() => {
                introScreen.classList.add("hidden");
                universeScreen.classList.remove("hidden");
                if (!sceneInitialized) {
                    initThreeJS();
                    sceneInitialized = true;
                }
                gsap.fromTo(camera.position, { z: 50 }, { z: 10, duration: 2.5, ease: "power2.out" });
                if (bloomPass) gsap.fromTo(bloomPass, { strength: 10 }, { strength: 1.5, duration: 3 });
            });
        }
    });

    backBtn.addEventListener("click", () => {
        introScreen.classList.remove("hidden");
        universeScreen.classList.add("hidden");
        // Re-init the intro scene
        if (window.initIntroScene) {
            window.initIntroScene();
        }
        // Show the overlay again
        const overlay = document.getElementById("intro-overlay");
        if (overlay) overlay.style.opacity = "1";
        // Reset the white-out
        const whiteout = document.getElementById("intro-whiteout");
        if (whiteout) whiteout.style.opacity = "0";
    });

    /* ---- MUSIC TOGGLE ---- */
    const musicToggle = document.getElementById("music-toggle");
    const bgMusic = document.getElementById("bg-music");
    let isMusicPlaying = false;

    if (musicToggle && bgMusic) {
        musicToggle.addEventListener("click", () => {
            if (isMusicPlaying) {
                bgMusic.pause();
                musicToggle.querySelector(".text").textContent = "Música: OFF";
                musicToggle.classList.remove("active");
            } else {
                bgMusic.play().catch(e => console.log("Audio play blocked", e));
                musicToggle.querySelector(".text").textContent = "Música: ON";
                musicToggle.classList.add("active");
            }
            isMusicPlaying = !isMusicPlaying;
        });
    }



    /* ============================
       THREE.JS SCENE
    =========================== */
    let renderer, scene, camera, animFrameId;
    let composer, bloomPass;
    let starMeshes = [];
    let nebulaParts, bgStarfield, stardust;
    let mouseTrail = [];
    let particleTexture;

    // Orbit / drag state
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let rotation = { x: 0.15, y: 0 };
    let targetRot = { x: 0.15, y: 0 };
    let autoRotate = true;

    // Touch state
    let lastTouch = null;

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse3D = new THREE.Vector2();

    function initThreeJS() {
        const canvas = document.getElementById("three-canvas");

        /* ---- RENDERER ---- */
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);

        /* ---- SCENE ---- */
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000008);
        scene.fog = new THREE.FogExp2(0x000008, 0.045);

        /* ---- CAMERA ---- */
        camera = new THREE.PerspectiveCamera(65, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
        camera.position.set(0, 0, 10);

        /* ---- PARTICLE TEXTURE ---- */
        particleTexture = createGlowTexture();

        /* ---- AMBIENT LIGHT ---- */
        const ambient = new THREE.AmbientLight(0x111133, 2);
        scene.add(ambient);

        /* ---- BACKGROUND STARFIELD ---- */
        bgStarfield = createStarfield(2200);
        scene.add(bgStarfield);

        /* ---- NEBULA PARTICLE CLOUDS ---- */
        nebulaParts = createNebula();
        scene.add(nebulaParts);

        /* ---- MEMORY STARS ---- */
        // Load custom user stars
        const stored = localStorage.getItem("customStars_v1");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                parsed.forEach(m => MEMORIES.push(m));
            } catch (e) {}
        }
        
        MEMORIES.forEach(mem => {
            const group = createMemoryStar(mem);
            scene.add(group);
            starMeshes.push({ group, mem, userData: group.userData });
        });

        /* ---- CONSTELLATION LINES ---- */
        const lines = createConstellationLines();
        scene.add(lines);

        /* ---- ORBIT PIVOT ---- */
        // Stars are parented to a pivot for easy rotation
        const pivot = new THREE.Object3D();
        scene.add(pivot);
        starMeshes.forEach(s => {
            scene.remove(s.group);
            pivot.add(s.group);
        });
        scene.remove(lines);
        pivot.add(lines);
        window._pivot = pivot;

        const renderScene = new RenderPass(scene, camera);
        bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // Strength
            0.4, // Radius
            0.85 // Threshold
        );
        
        composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        /* ---- DYNAMIC STARDUST ---- */
        stardust = createStardust(1200);
        scene.add(stardust);

        /* ---- EVENTS ---- */
        setupEvents(canvas);

        /* ---- RENDER LOOP ---- */
        animate();

        /* ---- UI EXPERIENCES ---- */
        setupUIEvents();

        /* ---- RESIZE ---- */
        window.addEventListener("resize", () => {
            const w = canvas.clientWidth, h = canvas.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        });
    }

    /* ==== STARFIELD ==== */
    function createStarfield(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const starColors = [
            [1.0, 1.0, 1.0],
            [0.8, 0.85, 1.0],
            [1.0, 0.75, 0.85],
            [0.75, 0.85, 1.0],
            [1.0, 0.95, 0.7],
        ];
        for (let i = 0; i < count; i++) {
            const r = 50 + Math.random() * 80;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);
            const c = starColors[Math.floor(Math.random() * starColors.length)];
            col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.35, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9, map: particleTexture, depthWrite: false, blending: THREE.AdditiveBlending
        });
        return new THREE.Points(geo, mat);
    }

    /* ==== GLOW TEXTURE GENERATOR ==== */
    function createGlowTexture() {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
        gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    /* ==== VOLUMETRIC NEBULA (PREMIUM) ==== */
    function createNebula() {
        const group = new THREE.Group();
        const count = 75; // Increased density
        
        // Create a softer, wider cloud-like radial gradient
        const size = 512;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        grad.addColorStop(0.3, "rgba(255, 255, 255, 0.3)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        const cloudTex = new THREE.CanvasTexture(c);

        // Deep space colors matching the premium theme
        const nebulaColors = [
            0x00cfff, // cyan
            0x25e0c5, // teal/emerald
            0x1a237e, // deep blue
            0x31004a, // deep purple
            0xffd700  // rare golden accents
        ];

        for (let i = 0; i < count; i++) {
            const color = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
            const opacity = color === 0xffd700 ? 0.05 : 0.15; // Gold is subtler
            const mat = new THREE.SpriteMaterial({
                map: cloudTex, color: color,
                transparent: true, opacity: opacity,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            const sprite = new THREE.Sprite(mat);
            
            // Random positions spread out further for depth
            sprite.position.x = (Math.random() - 0.5) * 60;
            sprite.position.y = (Math.random() - 0.5) * 40;
            sprite.position.z = (Math.random() - 0.5) * 30 - 15;
            
            // Huge scale for volume
            const scale = 25 + Math.random() * 30;
            sprite.scale.set(scale, scale, 1);
            
            group.add(sprite);
        }
        return group;
    }

    /* ==== MEMORY STAR (PREMIUM CRYSTALLINE) ==== */
    function createMemoryStar(mem) {
        const group = new THREE.Group();
        group.position.set(mem.position.x, mem.position.y, mem.position.z);

        const hexColor = new THREE.Color(mem.color);

        // Core Glowing Crystal (Sharper)
        const coreGeo = new THREE.IcosahedronGeometry(mem.size * 0.5, 0);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const core = new THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        // Outer Glass Shell (More ethereal)
        const shellGeo = new THREE.IcosahedronGeometry(mem.size * 1.2, 1);
        const shellMat = new THREE.MeshPhysicalMaterial({
            color: hexColor,
            metalness: 0.2,
            roughness: 0.1,
            transmission: 0.98,
            ior: 1.2,
            transparent: true,
            opacity: 1,
            side: THREE.FrontSide
        });
        const shell = new THREE.Mesh(shellGeo, shellMat);
        group.add(shell);

        // Dynamic Point Light (Stronger)
        const light = new THREE.PointLight(hexColor, 2.5, 12);
        group.add(light);

        // Subtle Glow Sprite (High Res)
        const glowTex = makeGlowTexture(mem.color);
        const glowMat = new THREE.SpriteMaterial({
            map: glowTex, color: 0xffffff,
            transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const glow = new THREE.Sprite(glowMat);
        const gs = mem.size * 10;
        glow.scale.set(gs, gs, 1);
        group.add(glow);

        group.userData = { 
            mem, core, shell, light, glow, 
            phase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.5 + Math.random() * 1.5,
            baseScale: 1.0, targetScale: 1.0
        };

        return group;
    }

    /* Glow radial gradient texture */
    function makeGlowTexture(hexStr) {
        const size = 256;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.1, hexStr);
        grad.addColorStop(0.4, hexStr + "66");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(c);
    }

    /* ==== CONSTELLATION LINES (ENERGY FLOW) ==== */
    // Keep reference to material for animation
    let globalLineMat;
    function createConstellationLines() {
        const positions = [];
        const pairs = [[0, 1], [1, 4], [4, 3], [3, 2], [2, 5], [5, 6], [6, 0], [1, 3]];
        pairs.forEach(([a, b]) => {
            const pa = MEMORIES[a].position;
            const pb = MEMORIES[b].position;
            positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
        
        globalLineMat = new THREE.LineBasicMaterial({
            color: 0x88ffcc, // Emerald tint to match Zubeneschamali
            transparent: true, 
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        return new THREE.LineSegments(geo, globalLineMat);
    }

    /* ==== ANIMATION LOOP ==== */
    let clock = { t: 0 };
    function animate() {
        animFrameId = requestAnimationFrame(animate);
        clock.t += 0.016;
        const t = clock.t;

        // Auto-rotate pivot
        if (autoRotate) {
            targetRot.y += 0.0008;
        }
        rotation.x += (targetRot.x - rotation.x) * 0.05;
        rotation.y += (targetRot.y - rotation.y) * 0.05;

        if (window._pivot) {
            window._pivot.rotation.x = rotation.x;
            window._pivot.rotation.y = rotation.y;
        }

        // Check Hover State
        raycaster.setFromCamera(mouse3D, camera);
        const hitTargets = starMeshes.map(s => s.userData.shell);
        const hovers = raycaster.intersectObjects(hitTargets, false);
        const hoveredShell = hovers.length > 0 ? hovers[0].object : null;

        // Animate each memory star with Twinkle
        starMeshes.forEach(s => {
            const d = s.userData;
            const isHovered = (hoveredShell === d.shell);
            
            // Smooth scaling physics
            d.targetScale = isHovered ? 1.5 : 1.0;
            d.baseScale += (d.targetScale - d.baseScale) * 0.1;
            
            const pulse = 0.9 + 0.1 * Math.sin(t * d.twinkleSpeed + d.phase);
            const finalScale = pulse * d.baseScale;
            
            d.core.scale.setScalar(finalScale);
            d.shell.scale.setScalar(finalScale);
            
            // Complex rotation
            d.shell.rotation.x = t * 0.2 + d.phase;
            d.shell.rotation.y = t * 0.3 + d.phase;

            // Lights and glow react to hover strongly
            d.glow.material.opacity = 0.4 + 0.2 * Math.sin(t * d.twinkleSpeed * 2 + d.phase) + (isHovered ? 0.4 : 0);
            d.light.intensity = isHovered ? 4 : 2;
        });

        // Pulsate energy lines
        if (globalLineMat) {
            globalLineMat.opacity = 0.2 + 0.3 * Math.sin(t * 2);
        }

        // Slow nebula drift with Parallax Depth
        if (nebulaParts) {
            nebulaParts.rotation.y = t * 0.01 + mouse3D.x * 0.08;
            nebulaParts.rotation.x = mouse3D.y * 0.08;
        }
        if (bgStarfield) {
            bgStarfield.rotation.y = t * 0.002 + mouse3D.x * 0.04;
            bgStarfield.rotation.x = mouse3D.y * 0.04;
        }

        // Animate stardust
        if (stardust) {
            stardust.rotation.y += 0.0005;
            stardust.position.y = Math.sin(t * 0.5) * 0.2;
        }

        // Mouse trail animation
        for (let i = mouseTrail.length - 1; i >= 0; i--) {
            const p = mouseTrail[i];
            p.life -= 0.02;
            p.mesh.material.opacity = p.life;
            p.mesh.scale.setScalar(p.life);
            if (p.life <= 0) {
                scene.remove(p.mesh);
                mouseTrail.splice(i, 1);
            }
        }

        // Meteor Shower Animation
        for (let i = meteors.length - 1; i >= 0; i--) {
            const m = meteors[i];
            m.mesh.position.add(m.velocity);
            m.life -= 0.015;
            m.mesh.material.opacity = m.life;
            m.mesh.scale.set(m.life, m.life, m.life * 4); // Stretch as it fades
            if (m.life <= 0) {
                scene.remove(m.mesh);
                meteors.splice(i, 1);
            }
        }

        // Random Meteor Spawner
        if (Math.random() < 0.005) { // 0.5% chance per frame
            spawnMeteor();
        }

        composer.render();
    }

    /* ==== METEOR SHOWER ==== */
    let meteors = [];
    function spawnMeteor() {
        if (!scene) return;
        const color = 0xffffff;
        const geo = new THREE.SphereGeometry(0.04, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(geo, mat);
        
        // Start high up and right
        mesh.position.set(
            15 + Math.random() * 10,
            10 + Math.random() * 10,
            -10 + Math.random() * 5
        );
        
        // Fast diagonal movement
        const velocity = new THREE.Vector3(-0.4 - Math.random() * 0.2, -0.3 - Math.random() * 0.2, 0);
        
        scene.add(mesh);
        meteors.push({ mesh, velocity, life: 1.0 });
    }

    /* ==== EVENTS ==== */
    function setupEvents(canvas) {
        // Mouse down
        canvas.addEventListener("mousedown", e => {
            isDragging = true;
            autoRotate = false;
            prevMouse = { x: e.clientX, y: e.clientY };
        });
        // Mouse move
        window.addEventListener("mousemove", e => {
            const rect = canvas.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            emitTrail(mx, my);

            if (!isDragging) return;
            const dx = e.clientX - prevMouse.x;
            const dy = e.clientY - prevMouse.y;
            targetRot.y += dx * 0.005;
            targetRot.x += dy * 0.005;
            targetRot.x = Math.max(-0.8, Math.min(0.8, targetRot.x));
            prevMouse = { x: e.clientX, y: e.clientY };
        });
        // Mouse up → check for click
        window.addEventListener("mouseup", e => {
            if (!isDragging) return;
            isDragging = false;
            // Resume auto-rotate after 5s of inactivity
            clearTimeout(window._autoTimer);
            window._autoTimer = setTimeout(() => { autoRotate = true; }, 5000);
        });

        // Click
        canvas.addEventListener("click", e => {
            const rect = canvas.getBoundingClientRect();
            mouse3D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse3D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            checkStarClick();
        });

        // Touch events
        canvas.addEventListener("touchstart", e => {
            isDragging = true; autoRotate = false;
            lastTouch = e.touches[0];
        }, { passive: true });
        canvas.addEventListener("touchmove", e => {
            if (!isDragging || !lastTouch) return;
            const t = e.touches[0];
            const dx = t.clientX - lastTouch.clientX;
            const dy = t.clientY - lastTouch.clientY;
            targetRot.y += dx * 0.005;
            targetRot.x += dy * 0.005;
            targetRot.x = Math.max(-0.8, Math.min(0.8, targetRot.x));
            lastTouch = t;
        }, { passive: true });
        canvas.addEventListener("touchend", e => {
            isDragging = false;
            clearTimeout(window._autoTimer);
            window._autoTimer = setTimeout(() => { autoRotate = true; }, 5000);

            // Tap detection
            if (e.changedTouches[0]) {
                const rect = canvas.getBoundingClientRect();
                const t = e.changedTouches[0];
                mouse3D.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
                mouse3D.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
                checkStarClick();
            }
        }, { passive: true });
    }

    /* ==== RAYCASTING ==== */
    function checkStarClick() {
        raycaster.setFromCamera(mouse3D, camera);
        const hitTargets = starMeshes.map(s => s.userData.shell);
        const hits = raycaster.intersectObjects(hitTargets, false);
        if (hits.length > 0) {
            const hitShell = hits[0].object;
            const found = starMeshes.find(s => s.userData.shell === hitShell);
            if (found && !window._isZooming) {
                // Camera Zoom
                window._isZooming = true;
                
                // Get target position relative to world
                const targetPos = new THREE.Vector3();
                found.group.getWorldPosition(targetPos);
                
                // Calculate camera destination (slightly in front of the star)
                const offset = new THREE.Vector3(0, 0, 4);
                const camDest = targetPos.clone().add(offset);
                
                // Animate camera
                gsap.to(camera.position, {
                    x: camDest.x, y: camDest.y, z: camDest.z,
                    duration: 1.5, ease: "power2.inOut",
                    onComplete: () => {
                        openMemoryCard(found.mem);
                    }
                });
                
                // Center the orbit target
                gsap.to(targetRot, { x: 0, y: 0, duration: 1.5 });
            }
        }

        // Mini-game: Catch the Meteor
        const hitMeteors = raycaster.intersectObjects(meteors.map(m => m.mesh), false);
        if (hitMeteors.length > 0) {
            const mMesh = hitMeteors[0].object;
            const idx = meteors.findIndex(m => m.mesh === mMesh);
            if (idx > -1) {
                meteors[idx].life = 0; // Desintegrate meteor
                alert("✨ ¡Atrapaste una estrella fugaz! ✨\nPidamos un deseo juntos...");
            }
        }
    }

    /* ==== MEMORY CARD ==== */
    const overlay = document.getElementById("card-overlay");
    const cardClose = document.getElementById("card-close");

    function openMemoryCard(mem) {
        document.getElementById("card-emoji").textContent = mem.emoji;
        document.getElementById("card-date-badge").textContent = mem.date;
        document.getElementById("card-title").textContent = mem.title;
        document.getElementById("card-desc").textContent = mem.description;

        // Image Gallery injection
        const galleryContainer = document.getElementById("card-gallery");
        if (galleryContainer) {
            if (mem.image) {
                galleryContainer.innerHTML = `<img src="${mem.image}" alt="Memory image" class="memory-photo">`;
                galleryContainer.style.display = "block";
            } else {
                galleryContainer.style.display = "none";
            }
        }

        // Tint the card glow color
        overlay.style.setProperty("--card-accent", mem.color);
        const card = document.getElementById("memory-card");
        card.style.boxShadow = `0 0 80px ${mem.glowColor}, 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`;
        document.getElementById("card-title").style.textShadow = `0 0 30px ${mem.glowColor}`;

        overlay.classList.remove("hidden");
    }

    cardClose.addEventListener("click", closeMemoryCard);
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeMemoryCard();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeMemoryCard();
    });

    function closeMemoryCard() {
        overlay.classList.add("hidden");
        // Zoom out smoothly
        gsap.to(camera.position, {
            x: 0, y: 0, z: 10,
            duration: 1.5, ease: "power2.out",
            onComplete: () => {
                window._isZooming = false;
            }
        });
    }

    /* ==== DYNAMIC STARDUST ==== */
    function createStardust(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
            sizes[i] = Math.random();
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.15, color: 0xffffff, transparent: true, opacity: 0.4, map: particleTexture, blending: THREE.AdditiveBlending, depthWrite: false
        });
        return new THREE.Points(geo, mat);
    }

    /* ==== MOUSE TRAIL ==== */
    function emitTrail(x, y) {
        if (!camera) return;
        const ray = new THREE.Raycaster();
        const m = new THREE.Vector2(x, y);
        ray.setFromCamera(m, camera);
        const pos = new THREE.Vector3();
        ray.ray.at(8, pos); 

        const p = new THREE.Mesh(
            new THREE.SphereGeometry(0.015, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
        );
        p.position.copy(pos);
        scene.add(p);
        mouseTrail.push({ mesh: p, life: 1.0 });
    }

    /* ==== PEAK INTERACTIVITY (UI) ==== */
    function setupUIEvents() {
        // 1. "Crea tu Estrella" Modal
        const modal = document.getElementById("create-star-modal");
        const btnOpen = document.getElementById("add-star-btn");
        const btnClose = document.getElementById("create-star-close");
        const form = document.getElementById("create-star-form");

        if(btnOpen) btnOpen.addEventListener("click", () => modal.classList.remove("hidden"));
        if(btnClose) btnClose.addEventListener("click", () => modal.classList.add("hidden"));

        if(form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const title = document.getElementById("star-title").value;
                const desc = document.getElementById("star-desc").value;
                const emoji = document.getElementById("star-emoji").value;
                const color = document.getElementById("star-color").value;

                const newMem = {
                    id: Date.now(),
                    title: title,
                    emoji: emoji,
                    date: "Nueva Estrella",
                    color: color,
                    glowColor: color + "88",
                    description: desc,
                    position: { 
                        x: (Math.random() - 0.5) * 15, 
                        y: (Math.random() - 0.5) * 15, 
                        z: (Math.random() - 0.5) * 10 
                    },
                    size: 0.25
                };

                MEMORIES.push(newMem);
                const group = createMemoryStar(newMem);
                if (window._pivot) window._pivot.add(group);
                else scene.add(group);
                
                // Important: Need the shell inside userData to be raycastable
                starMeshes.push({ group, mem: newMem, userData: group.userData });

                const stored = localStorage.getItem("customStars_v1");
                const parsed = stored ? JSON.parse(stored) : [];
                parsed.push(newMem);
                localStorage.setItem("customStars_v1", JSON.stringify(parsed));

                modal.classList.add("hidden");
                form.reset();
                
                // Fly to the new star
                if (!window._isZooming) {
                    window._isZooming = true;
                    const tp = new THREE.Vector3();
                    group.getWorldPosition(tp);
                    gsap.to(camera.position, {
                        x: tp.x + 0, y: tp.y + 0, z: tp.z + 4,
                        duration: 2, ease: "power3.out",
                        onComplete: () => { window._isZooming = false; openMemoryCard(newMem); }
                    });
                }
            });
        }

        // 2. 3D Hologram Polaroid Effect on Mousemove
        const overlay = document.getElementById("card-overlay");
        overlay.addEventListener("mousemove", (e) => {
            const photo = document.querySelector(".memory-photo");
            if (photo) {
                photo.classList.add("hologram");
                const rect = photo.getBoundingClientRect();
                // If mouse is inside photo bounds
                if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    const rotateY = (x / (rect.width / 2)) * 12;
                    const rotateX = -(y / (rect.height / 2)) * 12;
                    photo.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
                } else {
                    photo.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)`;
                }
            }
        });
    }

    }); // End DOMContentLoaded

})();
