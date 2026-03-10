/* ===== MAIN 3D UNIVERSE ENGINE =====
   Uses Three.js r128 (loaded via CDN)
   Memories data loaded from memories.js
====================================== */

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

    enterBtn.addEventListener("click", () => {
        introScreen.classList.add("fade-out");
        setTimeout(() => {
            introScreen.classList.add("hidden");
            universeScreen.classList.remove("hidden");
            if (!sceneInitialized) {
                initThreeJS();
                sceneInitialized = true;
            }
        }, 1200);
    });

    backBtn.addEventListener("click", () => {
        introScreen.classList.remove("hidden");
        introScreen.classList.remove("fade-out");
        universeScreen.classList.add("hidden");
    });

    /* ============================
       THREE.JS SCENE
    =========================== */
    let renderer, scene, camera, animFrameId;
    let starMeshes = [];
    let nebulaParts, bgStarfield;

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
        MEMORIES.forEach(mem => {
            const group = createMemoryStar(mem);
            scene.add(group);
            starMeshes.push({ group, mem, core: group.children[0] });
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

        /* ---- EVENTS ---- */
        setupEvents(canvas);

        /* ---- RENDER LOOP ---- */
        animate();

        /* ---- RESIZE ---- */
        window.addEventListener("resize", () => {
            const w = canvas.clientWidth, h = canvas.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
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
            size: 0.18, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85,
        });
        return new THREE.Points(geo, mat);
    }

    /* ==== NEBULA ==== */
    function createNebula() {
        const geo = new THREE.BufferGeometry();
        const count = 600;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const nebulaColors = [
            [0.0, 0.81, 1.0],    // cyan
            [0.79, 0.50, 1.0],   // violet
            [1.0, 0.43, 0.71],   // pink
            [1.0, 0.84, 0.0],    // gold
            [0.25, 0.88, 0.82],  // teal
        ];
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 30;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
            const c = nebulaColors[Math.floor(Math.random() * nebulaColors.length)];
            col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({
            size: 0.55, vertexColors: true, sizeAttenuation: true,
            transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending,
        });
        return new THREE.Points(geo, mat);
    }

    /* ==== MEMORY STAR ==== */
    function createMemoryStar(mem) {
        const group = new THREE.Group();
        group.position.set(mem.position.x, mem.position.y, mem.position.z);

        const hexColor = new THREE.Color(mem.color);

        // Core sphere
        const coreGeo = new THREE.SphereGeometry(mem.size, 20, 20);
        const coreMat = new THREE.MeshBasicMaterial({ color: hexColor });
        const core = new THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        // Glow sprite using a programmatic canvas texture
        const glowTex = makeGlowTexture(mem.color);
        const glowMat = new THREE.SpriteMaterial({
            map: glowTex, color: hexColor,
            transparent: true, opacity: 0.7,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const glow = new THREE.Sprite(glowMat);
        const gs = mem.size * 10;
        glow.scale.set(gs, gs, 1);
        group.add(glow);

        // Outer pulsing ring
        const ringGeo = new THREE.RingGeometry(mem.size * 1.4, mem.size * 1.7, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: hexColor, side: THREE.DoubleSide,
            transparent: true, opacity: 0.35,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.lookAt(new THREE.Vector3(0, 0, 10));
        group.add(ring);

        // Store refs for animation
        group.userData = { mem, core, glow, ring, phase: Math.random() * Math.PI * 2 };

        return group;
    }

    /* Glow radial gradient texture */
    function makeGlowTexture(hexStr) {
        const size = 128;
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grad.addColorStop(0, hexStr);
        grad.addColorStop(0.3, hexStr + "99");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(c);
    }

    /* ==== CONSTELLATION LINES ==== */
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
        const mat = new THREE.LineBasicMaterial({
            color: 0x5533aa, transparent: true, opacity: 0.18,
        });
        return new THREE.LineSegments(geo, mat);
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

        // Animate each memory star
        starMeshes.forEach(s => {
            const d = s.group.userData;
            const pulse = 0.85 + 0.15 * Math.sin(t * 1.5 + d.phase);
            d.core.scale.setScalar(pulse);
            d.glow.material.opacity = 0.5 + 0.25 * Math.sin(t * 1.2 + d.phase);
            d.ring.material.opacity = 0.15 + 0.25 * Math.abs(Math.sin(t * 0.8 + d.phase));
            d.ring.rotation.z = t * 0.3 + d.phase;
        });

        // Slow nebula drift
        if (nebulaParts) nebulaParts.rotation.y = t * 0.01;
        if (bgStarfield) bgStarfield.rotation.y = t * 0.002;

        renderer.render(scene, camera);
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
        const hitTargets = starMeshes.map(s => s.core);
        const hits = raycaster.intersectObjects(hitTargets, false);
        if (hits.length > 0) {
            const hitCore = hits[0].object;
            const found = starMeshes.find(s => s.core === hitCore);
            if (found) openMemoryCard(found.mem);
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

        // Tint the card glow color
        overlay.style.setProperty("--card-accent", mem.color);
        const card = document.getElementById("memory-card");
        card.style.boxShadow = `0 0 80px ${mem.glowColor}, 0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`;
        document.getElementById("card-title").style.textShadow = `0 0 30px ${mem.glowColor}`;

        overlay.classList.remove("hidden");
    }

    function closeMemoryCard() {
        overlay.classList.add("hidden");
    }

    cardClose.addEventListener("click", closeMemoryCard);
    overlay.addEventListener("click", e => {
        if (e.target === overlay) closeMemoryCard();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeMemoryCard();
    });

    }); // End DOMContentLoaded

})();
