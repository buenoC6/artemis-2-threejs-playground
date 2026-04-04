import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function createSolarGridTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fond sombre
    ctx.fillStyle = '#222222';
    ctx.fillRect(0, 0, 512, 512);

    // Grille brillante pour simuler les jonctions des cellules
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    for (let i = 0; i <= 512; i += 32) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Ajuster la répétition selon la taille de ton panneau
    texture.repeat.set(6, 2);
    return texture;
}

const solarBumpTexture = createSolarGridTexture();

// NOUVEAU: Alpha Map générée procéduralement pour "trouer" la coque (Hublots)
function createHullAlphaMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Blanc = Opaque
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 512);

    // Noir = Transparent (Trous des fenêtres rectangulaires)
    ctx.fillStyle = '#000000';
    const drawRectHole = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
        ctx.fill();
    };

    // Fenêtre frontale (coupée sur la jointure de la texture cylindrique U=0 et U=1)
    // Tailles calibrées pour correspondre exactement aux encadrements 3D
    drawRectHole(0, 110, 62, 90, 8);
    drawRectHole(1024, 110, 62, 90, 8);

    // Fenêtres latérales (U=0.125 et U=0.875)
    drawRectHole(128, 139, 52, 80, 6);
    drawRectHole(896, 139, 52, 80, 6);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
}

const hullAlphaTexture = createHullAlphaMap();

export class Spacecraft {
    constructor(name = 'Orion') {
        this.name = name;
        this.mesh = this.createMesh();
        this.label = this.createLabel();
        this.mesh.add(this.label);

        // Vecteurs de force (Gravité)
        this.gravityTerre = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0, 0x4488ff);
        this.gravityLune = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 0, 0x888888);
        this.mesh.add(this.gravityTerre);
        this.mesh.add(this.gravityLune);
    }

    createMesh() {
        const group = new THREE.Group();

        // --- MATÉRIAUX PBR PHYSIQUES AVANCÉS ---

        // CM : Effet métallique avec un vernis de protection
        const cmMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,
            metalness: 0.4,
            roughness: 0.6,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
            transparent: true,           // Rendu de trou possible
            alphaMap: hullAlphaTexture,  // Applique les trois trous
            alphaTest: 0.5,              // Stencil net plutôt qu'une transparence fantôme
            side: THREE.DoubleSide       // Pour ne pas voir le vide noir depuis le hublot
        });

        // Bouclier Avcoat
        const heatShieldMat = new THREE.MeshStandardMaterial({
            color: 0x110d0a,
            metalness: 0.0,
            roughness: 0.95
        });

        // ESM
        const smMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.3,
            roughness: 0.4,
            clearcoat: 0.2
        });

        // MLI
        const mliMat = new THREE.MeshPhysicalMaterial({
            color: 0xeaeaea,
            metalness: 0.8,
            roughness: 0.5,
            clearcoat: 0.2,
            clearcoatRoughness: 0.4
        });

        // Panneaux
        const solarMat = new THREE.MeshPhysicalMaterial({
            color: 0x050b14,
            metalness: 0.9,
            roughness: 0.2,
            iridescence: 1.0,
            iridescenceIOR: 1.4,
            bumpMap: solarBumpTexture,
            bumpScale: 0.002,
            side: THREE.DoubleSide
        });

        const engineMetal = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.2,
            roughness: 0.5,
            clearcoat: 0.3,
            side: THREE.DoubleSide
        });

        // --- 1. CREW MODULE (CM) ---
        const cmGroup = new THREE.Group();

        const cmGeo = new THREE.CylinderGeometry(0.18, 0.5, 0.35, 64, 1, true); // openEnded pour éviter l'alpha map sur les caps
        const cm = new THREE.Mesh(cmGeo, cmMat);
        cm.position.z = 0.2;
        cm.rotation.x = Math.PI / 2;
        cm.castShadow = true; cm.receiveShadow = true;
        cmGroup.add(cm);

        // Caps solides séparés (sans alpha map = pas de trous parasites)
        const cmCapMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,
            metalness: 0.4,
            roughness: 0.6,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });
        const topCapGeo = new THREE.CircleGeometry(0.18, 64);
        const topCap = new THREE.Mesh(topCapGeo, cmCapMat);
        topCap.rotation.x = -Math.PI / 2;
        topCap.position.y = 0.175;
        cm.add(topCap);

        const bottomCapGeo = new THREE.CircleGeometry(0.5, 64);
        const bottomCap = new THREE.Mesh(bottomCapGeo, cmCapMat);
        bottomCap.rotation.x = Math.PI / 2;
        bottomCap.position.y = -0.175;
        cm.add(bottomCap);

        const shieldGeo = new THREE.CylinderGeometry(0.5, 0.45, 0.05, 64);
        const shield = new THREE.Mesh(shieldGeo, heatShieldMat);
        shield.position.set(0, -0.2, 0);
        cm.add(shield);

        const dockGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.12, 32);
        const dockMat = new THREE.MeshPhysicalMaterial({
            color: 0xdddddd,
            metalness: 0.4,
            roughness: 0.6,
            clearcoat: 0.5,
            clearcoatRoughness: 0.1,
            side: THREE.DoubleSide
        });
        const dock = new THREE.Mesh(dockGeo, dockMat);
        dock.position.set(0, 0.2, 0);
        cm.add(dock);

        // --- Modélisation de l'intérieur visible ---
        const interiorGroup = new THREE.Group();

        // Ecrans MFD (Multifunction Displays) qui éclairent l'avant
        const screenGeo = new THREE.PlaneGeometry(0.15, 0.06);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x00ccff, side: THREE.DoubleSide }); // Cyan brillant
        const screen1 = new THREE.Mesh(screenGeo, screenMat);
        screen1.position.set(0, 0.05, 0.18);
        screen1.rotation.x = -Math.PI / 4;
        interiorGroup.add(screen1);

        // Sièges des astronautes (4 sièges vides, disposition sobre/sombre)
        const seatGeo = new THREE.BoxGeometry(0.07, 0.03, 0.12);
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.2, roughness: 0.8, side: THREE.DoubleSide });
        const seatPositions = [
            { x:  0.08, z:  0.08 }, // Avant droit
            { x: -0.08, z:  0.08 }, // Avant gauche
            { x:  0.08, z: -0.06 }, // Arrière droit
            { x: -0.08, z: -0.06 }  // Arrière gauche
        ];
        seatPositions.forEach(pos => {
            const seat = new THREE.Mesh(seatGeo, seatMat);
            seat.position.set(pos.x, -0.05, pos.z);
            seat.rotation.x = Math.PI / 6;
            interiorGroup.add(seat);
        });

        // Plancher interne gris
        const floorGeo = new THREE.CircleGeometry(0.35, 32);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x333333, side: THREE.DoubleSide, roughness: 0.9 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, -0.15, 0);
        interiorGroup.add(floor);

        // Lumière locale pour éclairer cet intérieur à travers la vitre !
        const intLight = new THREE.PointLight(0xffeedd, 1.0, 0.8);
        intLight.position.set(0, 0.0, 0.1);
        interiorGroup.add(intLight);

        cm.add(interiorGroup);

        // --- Hublots rectangulaires fidèles à la capsule Orion ---
        // Helper : crée un rectangle arrondi (Shape ou Path)
        const makeRoundedRect = (Cls, w, h, r) => {
            const s = new Cls();
            s.moveTo(-w / 2 + r, -h / 2);
            s.lineTo( w / 2 - r, -h / 2);
            s.absarc( w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
            s.lineTo( w / 2,  h / 2 - r);
            s.absarc( w / 2 - r,  h / 2 - r, r, 0, Math.PI / 2, false);
            s.lineTo(-w / 2 + r,  h / 2);
            s.absarc(-w / 2 + r,  h / 2 - r, r, Math.PI / 2, Math.PI, false);
            s.lineTo(-w / 2, -h / 2 + r);
            s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
            return s;
        };

        const windowMat = new THREE.MeshPhysicalMaterial({
            color: 0x223344,
            metalness: 0.8,
            roughness: 0.05,
            clearcoat: 1.0,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });

        const frameMat = new THREE.MeshStandardMaterial({
            color: 0x050505, // Encadrement noir profond
            metalness: 0.8,
            roughness: 0.3
        });

        const buildWindow = (w, h) => {
            const group = new THREE.Group();
            const r = Math.min(w, h) * 0.18; // Coins légèrement arrondis
            const t = 0.012; // Épaisseur de l'encadrement

            // Vitre
            const glassShape = makeRoundedRect(THREE.Shape, w, h, r);
            const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape), windowMat);
            group.add(glass);

            // Encadrement noir extrudé (rectangle creux)
            const outerShape = makeRoundedRect(THREE.Shape, w + t * 2, h + t * 2, r + t);
            const hole = makeRoundedRect(THREE.Path, w, h, r);
            outerShape.holes.push(hole);

            const frameGeo = new THREE.ExtrudeGeometry(outerShape, {
                depth: 0.01,
                bevelEnabled: false
            });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.z = -0.004;
            group.add(frame);

            return group;
        };

        // Fenêtre frontale (légèrement plus large, fidèle à Orion)
        const windowFront = buildWindow(0.07, 0.055);
        windowFront.position.set(0, 0.1, 0.24);
        windowFront.rotation.x = -Math.PI / 6;
        cm.add(windowFront);

        // Fenêtres latérales
        for (let i = 0; i < 2; i++) {
            const sideWindow = buildWindow(0.06, 0.05);
            const sideAngle = (i === 0 ? 1 : -1) * Math.PI / 4;
            sideWindow.position.set(Math.sin(sideAngle) * 0.28, 0.08, 0.18);
            sideWindow.rotation.y = sideAngle;
            sideWindow.rotation.x = -Math.PI / 6;
            cm.add(sideWindow);
        }

        group.add(cmGroup);

        // --- 2. EUROPEAN SERVICE MODULE (ESM) ---
        const smGroup = new THREE.Group();

        // --- TRANSITION CM/ESM: Architecture de découplage fidèle Artemis/Orion ---

        // 1. Anneau de séparation pyrotechnique (Frangible Joint)
        // Joint frangible avec boulons explosifs FCDC permettant le découplage CM/SM
        const sepRingGeo = new THREE.TorusGeometry(0.46, 0.014, 12, 64);
        const sepRingMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, metalness: 0.95, roughness: 0.2
        });
        const sepRing = new THREE.Mesh(sepRingGeo, sepRingMat);
        sepRing.position.z = -0.025;
        sepRing.rotation.x = Math.PI / 2;
        smGroup.add(sepRing);

        // Boulons pyrotechniques répartis sur l'anneau
        const boltGeo = new THREE.SphereGeometry(0.007, 8, 6);
        const boltMat = new THREE.MeshStandardMaterial({
            color: 0x999999, metalness: 0.9, roughness: 0.15
        });
        for (let i = 0; i < 16; i++) {
            const bolt = new THREE.Mesh(boltGeo, boltMat);
            const bAngle = (i * Math.PI * 2) / 16;
            bolt.position.set(Math.cos(bAngle) * 0.46, Math.sin(bAngle) * 0.46, -0.025);
            smGroup.add(bolt);
        }

        // 2. Crew Module Adapter (CMA) - 3 panneaux coniques largables (Forward Bay Cover)
        const cmaH = 0.10;
        const cmaTopR = 0.45;
        const cmaBotR = 0.405;
        const cmaCenter = -0.075;
        const numCmaPanels = 3;
        const cmaPanelMat = new THREE.MeshPhysicalMaterial({
            color: 0xf0ece0, // Blanc cassé caractéristique des fairings Orion
            metalness: 0.1,
            roughness: 0.7,
            clearcoat: 0.05,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < numCmaPanels; i++) {
            const startA = (i * Math.PI * 2) / numCmaPanels + 0.025;
            const arcA = (Math.PI * 2) / numCmaPanels - 0.05;
            const pGeo = new THREE.CylinderGeometry(
                cmaTopR, cmaBotR, cmaH, 16, 1, true, startA, arcA
            );
            const panel = new THREE.Mesh(pGeo, cmaPanelMat);
            panel.position.z = cmaCenter;
            panel.rotation.x = Math.PI / 2;
            panel.castShadow = true;
            panel.receiveShadow = true;
            smGroup.add(panel);
        }

        // Longerons structurels (raidisseurs) dans les gaps entre panneaux
        const longeronMat = new THREE.MeshStandardMaterial({
            color: 0x555555, metalness: 0.85, roughness: 0.3
        });
        for (let i = 0; i < numCmaPanels; i++) {
            const lAngle = (i * Math.PI * 2) / numCmaPanels;
            const lr = (cmaTopR + cmaBotR) / 2;
            const longGeo = new THREE.BoxGeometry(0.008, 0.008, cmaH);
            const longeron = new THREE.Mesh(longGeo, longeronMat);
            longeron.position.set(Math.cos(lAngle) * lr, Math.sin(lAngle) * lr, cmaCenter);
            smGroup.add(longeron);
        }

        // 3. Ressorts de poussée (Push-off springs) pour la séparation
        const springGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6);
        const springMat = new THREE.MeshStandardMaterial({
            color: 0xbbaa00, metalness: 0.75, roughness: 0.4
        });
        for (let i = 0; i < 6; i++) {
            const spring = new THREE.Mesh(springGeo, springMat);
            const sAngle = (i * Math.PI * 2) / 6 + Math.PI / 6;
            spring.position.set(Math.cos(sAngle) * 0.44, Math.sin(sAngle) * 0.44, -0.035);
            spring.rotation.x = Math.PI / 2;
            smGroup.add(spring);
        }

        // 4. Spacecraft Adapter (SA) Ring — anneau structurel de jonction CMA/ESM
        const saRingGeo = new THREE.CylinderGeometry(0.415, 0.415, 0.025, 64);
        const saRingMat = new THREE.MeshStandardMaterial({
            color: 0x444444, metalness: 0.88, roughness: 0.2
        });
        const saRing = new THREE.Mesh(saRingGeo, saRingMat);
        saRing.position.z = -0.13;
        saRing.rotation.x = Math.PI / 2;
        saRing.castShadow = true;
        smGroup.add(saRing);

        // 5. Panneau ombilical (connexions électriques + fluides CM↔ESM)
        const umbGeo = new THREE.BoxGeometry(0.015, 0.06, 0.05);
        const umbMat = new THREE.MeshStandardMaterial({
            color: 0x777777, metalness: 0.6, roughness: 0.5
        });
        const umbPanel = new THREE.Mesh(umbGeo, umbMat);
        umbPanel.position.set(0.44, 0, cmaCenter);
        smGroup.add(umbPanel);

        // Connecteurs ombilicaux dorés
        const connGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.02, 6);
        const connMat = new THREE.MeshStandardMaterial({
            color: 0xcc8800, metalness: 0.85, roughness: 0.3
        });
        for (let j = -1; j <= 1; j += 2) {
            const conn = new THREE.Mesh(connGeo, connMat);
            conn.position.set(0.455, j * 0.015, cmaCenter);
            conn.rotation.z = Math.PI / 2;
            smGroup.add(conn);
        }

        // Cylindre principal ESM (Diamètre fidèlement plus petit que la capsule)
        const smGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 64);
        const sm = new THREE.Mesh(smGeo, smMat);
        sm.position.z = -0.325;
        sm.rotation.x = Math.PI / 2;
        sm.castShadow = true; sm.receiveShadow = true;
        smGroup.add(sm);

        // Bande externe en MLI (Isolation thermique métallisée)
        const mliGeo = new THREE.CylinderGeometry(0.402, 0.402, 0.15, 64);
        const mli = new THREE.Mesh(mliGeo, mliMat);
        mli.position.set(0, 0.125, 0);
        sm.add(mli);

        const radGeo = new THREE.PlaneGeometry(0.12, 0.35);
        for(let i = 0; i < 8; i++) {
            // Radiateurs : Blancs mais très mats pour la dissipation thermique
            const radMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.1, roughness: 0.9 });
            const rad = new THREE.Mesh(radGeo, radMat);
            const angle = (i * Math.PI) / 4;
            rad.position.set(Math.cos(angle) * 0.405, -0.025, Math.sin(angle) * 0.405);
            rad.rotation.y = -angle + Math.PI/2;
            sm.add(rad);
        }

        const adapterGeo = new THREE.CylinderGeometry(0.4, 0.25, 0.15, 64);
        const adapter = new THREE.Mesh(adapterGeo, mliMat);
        adapter.position.set(0, -0.275, 0);
        sm.add(adapter);

        // --- 3. PROPULSEUR PRINCIPAL (OMS AJ10) ET AUXILIAIRES ---
        const points = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            const r = 0.04 + 0.14 * Math.pow(t, 2);
            const y = -0.25 * t;
            points.push(new THREE.Vector2(r, y));
        }
        const engineGeo = new THREE.LatheGeometry(points, 32);
        this.engineMesh = new THREE.Mesh(engineGeo, engineMetal);
        this.engineMesh.rotation.x = Math.PI / 2;
        this.engineMesh.position.z = -0.65;
        smGroup.add(this.engineMesh);

        const glowGeo = new THREE.CylinderGeometry(0.01, 0.15, 0.20, 32);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending });
        this.engineGlow = new THREE.Mesh(glowGeo, glowMat);
        this.engineGlow.rotation.x = -Math.PI / 2;
        this.engineGlow.position.z = -0.7;
        smGroup.add(this.engineGlow);

        const auxGeo = new THREE.CylinderGeometry(0.01, 0.02, 0.06, 16);
        for(let i = 0; i < 8; i++) {
            const aux = new THREE.Mesh(auxGeo, engineMetal);
            const angle = (i * Math.PI) / 4 + Math.PI/8;
            aux.position.set(Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, -0.62);
            aux.rotation.x = Math.PI / 2;
            smGroup.add(aux);
        }

        group.add(smGroup);

        // --- 4. PANNEAUX SOLAIRES (X-WING) ---
        this.solarWings = [];
        for (let i = 0; i < 4; i++) {
            const pivotRoot = new THREE.Group();
            const angle = (i * Math.PI) / 2 + Math.PI / 4;
            pivotRoot.rotation.z = angle;
            pivotRoot.position.z = -0.325; // Aligné avec le centre du module

            const sweptPivot = new THREE.Group();
            sweptPivot.rotation.y = Math.PI / 12;
            pivotRoot.add(sweptPivot);

            const solarTracker = new THREE.Group();
            sweptPivot.add(solarTracker);
            this.solarWings.push(solarTracker);

            const strutGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 16);
            strutGeo.rotateZ(Math.PI / 2);
            // Bras structurel plus sombre
            const strutMat = new THREE.MeshStandardMaterial({color: 0x555555, metalness: 0.8, roughness: 0.5});
            const strut = new THREE.Mesh(strutGeo, strutMat);
            strut.position.x = 0.4 + 0.175; // S'attache bord au nouveau rayon (0.4)
            solarTracker.add(strut);

            const segmentGeo = new THREE.BoxGeometry(0.5, 0.005, 0.35); // Légèrement plus fins

            // On peut garder les edges pour structurer les panneaux, c'est un bon choix stylistique
            const edgeGeo = new THREE.EdgesGeometry(segmentGeo);
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x5588cc, opacity: 0.3, transparent: true });

            for (let p = 0; p < 3; p++) {
                const segment = new THREE.Mesh(segmentGeo, solarMat);
                segment.position.x = 0.4 + 0.35 + 0.25 + (p * 0.52);

                const edges = new THREE.LineSegments(edgeGeo, edgeMat);
                segment.add(edges);

                segment.castShadow = true;
                segment.receiveShadow = true;
                solarTracker.add(segment);
            }

            group.add(pivotRoot);
        }

        this.particles = this.createParticles();
        group.add(this.particles);

        group.name = this.name;
        return group;
    }

    createParticles() {
        const count = 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const scales = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = -0.7 - Math.random() * 2;
            scales[i] = Math.random();
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));

        const material = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.1,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        return points;
    }

    createLabel() {
        const div = document.createElement('div');
        div.className = 'text-white text-[10px] bg-red-600/80 px-1 rounded font-bold pointer-events-none';
        div.textContent = this.name;

        const label = new CSS2DObject(div);
        label.position.set(0, 1, 0);
        return label;
    }

    updatePosition(position, lookAtTarget, engineIntensity = 0.5) {
        this.mesh.position.copy(position);

        if (lookAtTarget) {
            this.mesh.lookAt(lookAtTarget);
        }

        if (this.solarWings && this.solarWings.length > 0) {
            this.mesh.updateMatrixWorld(true);
            const sunWorldPos = new THREE.Vector3(0, 0, 0);
            this.solarWings.forEach(tracker => {
                const localSun = tracker.parent.worldToLocal(sunWorldPos.clone());
                tracker.rotation.x = Math.atan2(localSun.z, localSun.y);
            });
        }

        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 2] -= 0.05 * engineIntensity;
            if (positions[i * 3 + 2] < -3) {
                positions[i * 3 + 2] = -0.7;
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.visible = engineIntensity > 0.05;

        if (this.engineGlow) {
            this.engineGlow.material.opacity = engineIntensity > 0.05 ? Math.min(1.0, engineIntensity) : 0;
            const colorHex = engineIntensity > 1.0 ? 0xffffff : (engineIntensity > 0.5 ? 0xffcc00 : 0xff4400);
            this.engineGlow.material.color.setHex(colorHex);
        }
    }

    updateForces(earthPos, moonPos, visible = true) {
        this.gravityTerre.visible = visible;
        this.gravityLune.visible = visible;
        if (!visible) return;

        const dirTerre = earthPos.clone().sub(this.mesh.position);
        const distTerre = dirTerre.length();
        dirTerre.normalize();

        const dirLune = moonPos.clone().sub(this.mesh.position);
        const distLune = dirLune.length();
        dirLune.normalize();

        const forceTerre = (5000 / (distTerre * distTerre));
        const forceLune = (500 / (distLune * distLune));

        const localDirTerre = dirTerre.clone().applyQuaternion(this.mesh.quaternion.clone().invert());
        const localDirLune = dirLune.clone().applyQuaternion(this.mesh.quaternion.clone().invert());

        this.gravityTerre.setDirection(localDirTerre);
        this.gravityTerre.setLength(Math.min(10, forceTerre), 0.5, 0.2);

        this.gravityLune.setDirection(localDirLune);
        this.gravityLune.setLength(Math.min(10, forceLune), 0.5, 0.2);
    }

    getMesh() {
        return this.mesh;
    }
}
