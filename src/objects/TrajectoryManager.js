import * as THREE from 'three';

export class TrajectoryManager {
    constructor() {
        this.curve = null;
        this.line = null;
        this.milestoneMarkers = [];
        this.milestones = [
            { t: 0.0, name: 'Décollage', desc: 'Lancement du SLS depuis le Kennedy Space Center.' },
            { t: 0.07, name: 'Apogée HEO', desc: 'Point culminant de l\'orbite elliptique haute. Tests systèmes du vaisseau Orion.' },
            { t: 0.12, name: 'Injection Trans-Lunaire', desc: 'Burn TLI au point de périgée. Voyage de ~4 jours vers la Lune.' },
            { t: 0.50, name: 'Survol Lunaire (Flyby)', desc: 'Passage à ~7 500 km derrière la face cachée. Vue de la Terre et de la Lune.' },
            { t: 0.94, name: 'Séparation CM/SM', desc: 'Le Crew Module se sépare du Service Module (CM/SM Separation) avant la rentrée.' },
            { t: 0.97, name: 'Entry Interface', desc: 'Rentrée atmosphérique à environ 40 000 km/h.' },
            { t: 1.0, name: 'Amérissage', desc: 'Déploiement des 11 parachutes et splashdown dans l\'Océan Pacifique à ~32 km/h.' }
        ];

        this.updateCurve(100);
    }

    updateCurve(moonDist = 100) {
        const earthR = 5;
        const missionDuration = 10;
        const lunarOrbitPeriod = 27.3;
        const orbitFactor = missionDuration / lunarOrbitPeriod;

        // Position de la Lune en fonction du temps de mission (0 → 1)
        const getMoonPos = (t) => {
            const angle = t * orbitFactor * Math.PI * 2;
            return new THREE.Vector3(Math.cos(angle) * moonDist, 0, Math.sin(angle) * moonDist);
        };

        // Position de la Lune au moment du survol (~jour 5 sur 10)
        const moonAtFlyby = getMoonPos(0.5);
        const moonDir = moonAtFlyby.clone().normalize();           // direction Terre → Lune
        const moonSide = new THREE.Vector3(-moonDir.z, 0, moonDir.x); // perpendiculaire (plan xz)

        // ──────────────────────────────────────────────────────────
        // Orbite elliptique haute (HEO) pré-TLI
        // Périgée bas, apogée haute et bien visible
        // ──────────────────────────────────────────────────────────
        const perigeeR = earthR + 1.5;    // ~8 300 km d'altitude
        const apogeeR  = earthR * 6;      // ~32 000 km d'altitude
        const sma      = (perigeeR + apogeeR) / 2;
        const ecc      = (apogeeR - perigeeR) / (apogeeR + perigeeR);
        const semiLat  = sma * (1 - ecc * ecc);

        // Génère un point sur l'ellipse képlérienne (foyer = Terre)
        // θ = 0 → périgée (direction +moonSide)
        // θ = π → apogée  (direction -moonSide)
        // Au périgée la vitesse tangentielle pointe en +moonDir → idéal pour le TLI
        const orbitPt = (theta, y = 0) => {
            const r = semiLat / (1 + ecc * Math.cos(theta));
            return moonSide.clone().multiplyScalar(r * Math.cos(theta))
                .add(moonDir.clone().multiplyScalar(r * Math.sin(theta)))
                .setY(y);
        };

        const PI = Math.PI;

        const points = [
            // ═══ PHASE 1 : DÉCOLLAGE ═══
            moonSide.clone().multiplyScalar(earthR + 0.3).setY(0),

            // ═══ PHASE 2 : ORBITE ELLIPTIQUE HAUTE (HEO) ═══
            // Montée vers l'apogée (grande apogée)
            orbitPt(PI * 0.25, 0.8),
            orbitPt(PI * 0.50, 1.5),
            orbitPt(PI * 0.75, 2.2),
            orbitPt(PI,        2.5),         // ← APOGÉE (point culminant)
            // Redescente vers le périgée (petit périgée)
            orbitPt(PI * 1.25, 2.0),
            orbitPt(PI * 1.50, 1.2),
            orbitPt(PI * 1.75, 0.5),

            // ═══ PHASE 3 : INJECTION TRANS-LUNAIRE AU PÉRIGÉE ═══
            // Le burn TLI a lieu ici, au point le plus bas de l'orbite
            moonSide.clone().multiplyScalar(perigeeR).setY(0),

            // ═══ PHASE 4 : TRANSIT TERRE → LUNE (Voyage de ~4 jours) ═══
            // Trajectoire aller : on passe "devant" (côté +moonSide) et on s'élève un peu pour la figure en 8
            moonDir.clone().multiplyScalar(moonDist * 0.3)
                .add(moonSide.clone().multiplyScalar(moonDist * 0.20))
                .setY(5.0),

            moonDir.clone().multiplyScalar(moonDist * 0.7)
                .add(moonSide.clone().multiplyScalar(moonDist * 0.25))
                .setY(3.0),

            // ═══ PHASE 5 : SURVOL LUNAIRE (FLYBY) ═══
            // Survol lointain à environ ~7 500 km derrière la face cachée (donc plus loin de la surface lunaire).
            // La lune est à 'moonAtFlyby', et a un rayon de ~1.35 unités dans la scène.
            // On s'éloigne notablement du côté opposé à la Terre (prolongation sur l'axe moonDir).

            // 1. Approche par le côté (+moonSide)
            moonAtFlyby.clone()
                .add(moonSide.clone().multiplyScalar(15))
                .add(moonDir.clone().multiplyScalar(-5))
                .setY(1.0),

            // 2. Point le plus lointain (~7 500 km beyond the far side)
            // On le place largement derrière la lune par rapport à la Terre
            moonAtFlyby.clone()
                .add(moonDir.clone().multiplyScalar(22))
                .setY(0),

            // 3. Sortie du survol (-moonSide), marquant l'inversion caractéristique de la figure en 8
            moonAtFlyby.clone()
                .add(moonSide.clone().multiplyScalar(-15))
                .add(moonDir.clone().multiplyScalar(-5))
                .setY(-1.0),

            // ═══ PHASE 6 : TRANSIT RETOUR LUNE → TERRE ═══
            // On croise l'axe Terre-Lune par en-dessous / l'autre côté pour finaliser la boucle en 8.
            moonDir.clone().multiplyScalar(moonDist * 0.7)
                .add(moonSide.clone().multiplyScalar(-moonDist * 0.25))
                .setY(-3.0),

            moonDir.clone().multiplyScalar(moonDist * 0.3)
                .add(moonSide.clone().multiplyScalar(-moonDist * 0.20))
                .setY(-5.0),

            // ═══ PHASE 7 : SÉPARATION CM/SM & RÉENTRÉE ATMOSPHÉRIQUE (Entry Interface) ═══
            moonDir.clone().multiplyScalar(earthR * 3.5)
                .add(moonSide.clone().multiplyScalar(-earthR * 2.0))
                .setY(-1.0),

            moonDir.clone().multiplyScalar(earthR * 1.5)
                .add(moonSide.clone().multiplyScalar(-earthR * 1.0))
                .setY(-0.2),

            // ═══ PHASE 8 : AMERISSAGE ═══
            // Avec les parachutes dans le Pacifique
            new THREE.Vector3().copy(moonDir).multiplyScalar(0.1)
                .add(moonSide.clone().multiplyScalar(-0.8))
                .normalize()
                .multiplyScalar(earthR + 0.3),
        ];

        // NOUVEAU: Ajouter les manoeuvres (Burn Nodes / Maneuver nodes visibles)
        this.burnNodes = [
            { t: 0.12, type: 'prograde', label: 'TLI Burn' },
            { t: 0.50, type: 'retrograde', label: 'Lunar Flyby Correction' },
            { t: 0.97, type: 'retrograde', label: 'Entry Interface' }
        ];

        this.curve = new THREE.CatmullRomCurve3(points, false, 'chordal');
        this.curve.arcLengthDivisions = 1000;

        if (this.line) {
            this.line.geometry.dispose();
            // TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
            this.line.geometry = new THREE.TubeGeometry(this.curve, 1500, 0.003, 6, false);

            // Mise à jour de la ligne 2D de secours (fallback)
            const fallbackLine = this.line.children.find(c => c.isLine);
            if (fallbackLine) {
                fallbackLine.geometry.dispose();
                fallbackLine.geometry = new THREE.BufferGeometry().setFromPoints(this.curve.getSpacedPoints(1500));
                fallbackLine.computeLineDistances();
            }
        }

        // Mettre à jour les sphères de milestones
        if (this.milestoneMarkers.length > 0) {
            this.milestones.forEach((m, index) => {
                if (this.milestoneMarkers[index]) {
                    const pos = this.curve.getPointAt(m.t);
                    this.milestoneMarkers[index].position.copy(pos);
                }
            });
        }
    }

    createCurve() {
        // Redondant car updateCurve est appelé, mais gardé pour la compatibilité initiale si besoin
        this.updateCurve();
        return this.curve;
    }

    createMilestoneMarker(position, milestone) {
        const group = new THREE.Group();
        group.position.copy(position);
        group.userData.isMilestone = true;
        group.userData.label = milestone.name;

        const core = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x5fd4ff,
                emissive: 0x1a7aa8,
                emissiveIntensity: 0.8,
                roughness: 0.3,
                metalness: 0.1,
                transparent: true,
                opacity: 0.95,
            })
        );
        group.add(core);

        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x89e2ff,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.01, 10, 42), ringMat);
        ring1.rotation.x = Math.PI / 2;
        group.add(ring1);

        const ring2 = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.008, 10, 42),
            ringMat.clone()
        );
        ring2.material.opacity = 0.35;
        ring2.rotation.z = Math.PI / 2;
        group.add(ring2);

        const beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.004, 0.004, 0.5, 8),
            new THREE.MeshBasicMaterial({
                color: 0x8ad8ff,
                transparent: true,
                opacity: 0.35,
                depthWrite: false,
            })
        );
        beacon.position.y = 0.25;
        group.add(beacon);

        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 14, 14),
            new THREE.MeshBasicMaterial({
                color: 0x336677,
                transparent: true,
                opacity: 0.08,
                depthWrite: false,
            })
        );
        group.add(halo);

        return group;
    }

    createBurnNodeMarker(position, node) {
        const isPrograde = node.type === 'prograde';
        const accentColor = isPrograde ? 0x3dff9a : 0xffa54a;

        const group = new THREE.Group();
        group.position.copy(position);
        group.userData.isMilestone = true;
        group.userData.isBurnNode = true;
        group.userData.label = node.label;

        const poly = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.12, 0),
            new THREE.MeshStandardMaterial({
                color: accentColor,
                emissive: accentColor,
                emissiveIntensity: 0.45,
                roughness: 0.5,
                metalness: 0.2,
                transparent: true,
                opacity: 0.9,
            })
        );
        group.add(poly);

        const wire = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16, 0)),
            new THREE.LineBasicMaterial({
                color: accentColor,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
            })
        );
        group.add(wire);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.2, 0.008, 8, 36),
            new THREE.MeshBasicMaterial({
                color: accentColor,
                transparent: true,
                opacity: 0.5,
                depthWrite: false,
            })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        return group;
    }

    drawTrajectory(scene) {
        // Tube 3D fin et discret
        const geometry = new THREE.TubeGeometry(this.curve, 1500, 0.003, 6, false);

        const material = new THREE.MeshBasicMaterial({
            color: 0xaabbcc,
            transparent: true,
            opacity: 0.35,
        });

        this.line = new THREE.Mesh(geometry, material);

        // Ligne 2D de secours (visible au zoom arrière extrême)
        const fallbackGeo = new THREE.BufferGeometry().setFromPoints(this.curve.getSpacedPoints(1500));
        const fallbackMat = new THREE.LineBasicMaterial({
            color: 0xaabbcc,
            transparent: true,
            opacity: 0.25
        });
        const fallbackLine = new THREE.Line(fallbackGeo, fallbackMat);
        this.line.add(fallbackLine);

        scene.add(this.line);

        // Ajouter des points de passage stylises (type simulation)
        this.milestones.forEach(m => {
            const pos = this.curve.getPointAt(m.t);
            const marker = this.createMilestoneMarker(pos, m);

            scene.add(marker);
            this.milestoneMarkers.push(marker);
        });

        // Dessiner les Burn Nodes
        if (this.burnNodes) {
             this.burnNodes.forEach(node => {
                 const pos = this.curve.getPointAt(node.t);
                 const burnMarker = this.createBurnNodeMarker(pos, node);
                 scene.add(burnMarker);
                 this.milestoneMarkers.push(burnMarker);
             });
        }

        return this.line;
    }

    getEventAt(percent) {
        return this.events.find(e => Math.abs(e.t - percent) < 0.005);
    }

    getMilestoneAt(percent) {
        // Retourne un milestone si on est à moins de 2% de distance
        return this.milestones.find(m => Math.abs(m.t - percent) < 0.02);
    }

    getPositionAt(percent) {
        const t = Math.max(0, Math.min(1, percent));
        return this.curve.getPointAt(t);
    }
}
