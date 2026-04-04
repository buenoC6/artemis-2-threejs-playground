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

        this.curve = new THREE.CatmullRomCurve3(points, false, 'chordal');
        this.curve.arcLengthDivisions = 1000;

        if (this.line) {
            this.line.geometry.dispose();
            // TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
            this.line.geometry = new THREE.TubeGeometry(this.curve, 1500, 0.005, 6, false);

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

    drawTrajectory(scene) {
        // Tube 3D fin et discret
        const geometry = new THREE.TubeGeometry(this.curve, 1500, 0.005, 6, false);

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

        // Ajouter les sphères pour les milestones
        this.milestones.forEach(m => {
            const pos = this.curve.getPointAt(m.t);
            const markerGeo = new THREE.SphereGeometry(0.15, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.copy(pos);
            marker.userData.isMilestone = true;
            
            // Halo lumineux
            const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.2 });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            marker.add(glow);

            scene.add(marker);
            this.milestoneMarkers.push(marker);
        });

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
