import * as THREE from 'three';

export class TrajectoryManager {
    constructor() {
        this.curve = null;
        this.line = null;
        this.milestoneMarkers = [];
        this.milestones = [
            { t: 0.0, name: 'Décollage', desc: 'Lancement du SLS depuis le Kennedy Space Center.' },
            { t: 0.05, name: 'Orbite Haute (HEO)', desc: 'Tests du vaisseau Orion en orbite terrestre haute.' },
            { t: 0.12, name: 'Injection Trans-Lunaire', desc: 'Le moteur ICPS propulse Orion vers la Lune.' },
            { t: 0.5, name: 'Survol Lunaire (Flyby)', desc: 'Passage au plus proche de la face cachée (LOS).' },
            { t: 0.92, name: 'Réentrée atmosphérique', desc: 'Séparation du module de service et rentrée à 40 000 km/h.' },
            { t: 1.0, name: 'Amérissage', desc: 'Plouf dans l\'Océan Pacifique. Mission accomplie !' }
        ];

        this.updateCurve(100);
    }

    updateCurve(moonDist = 100) {
        // La mission Artemis 2 dure 10 jours. L'orbite lunaire prend 27.3 jours.
        const missionDuration = 10;
        const lunarOrbitPeriod = 27.3;
        const orbitFactor = missionDuration / lunarOrbitPeriod;

        // Calcul de la position relative de la Lune par rapport à la Terre à l'instant T (0 à 1)
        const getMoonPos = (t) => {
            // L'angle 0 est l'angle de départ de la Lune à t=0
            const angle = t * orbitFactor * Math.PI * 2;
            return new THREE.Vector3(Math.cos(angle) * moonDist, 0, Math.sin(angle) * moonDist);
        };

        // On définit les points de contrôle pour former un '8' fluide
        // La Lune se déplace, donc la trajectoire doit intercepter la lune à t=0.5
        const moonAtFlyby = getMoonPos(0.5);
        const moonDir = moonAtFlyby.clone().normalize();
        const moonSide = new THREE.Vector3(-moonDir.z, 0, moonDir.x); // Tangente à l'orbite

        const points = [
            new THREE.Vector3(5.0, 0, 0),           // 0.0 Décollage (proche Terre)
            new THREE.Vector3(6, 0.5, 0.5),         // Ascension
            new THREE.Vector3(10, 2, 5),            // 0.05 Orbite de parking
            new THREE.Vector3(30, 5, 15),           // 0.12 Injection Trans-Lunaire (TLI)
            
            // On s'approche de la Lune par le côté "intérieur" (devant elle)
            moonAtFlyby.clone().add(moonSide.clone().multiplyScalar(35)).add(moonDir.clone().multiplyScalar(-25)),
            
            // On passe derrière la face cachée (Flyby)
            // moonAtFlyby est à la distance moonDist, on rajoute 15 pour être à 315 (derrière)
            moonAtFlyby.clone().add(moonDir.clone().multiplyScalar(15)), 
            
            // On ressort par l'autre côté pour revenir vers la Terre
            moonAtFlyby.clone().add(moonSide.clone().multiplyScalar(-35)).add(moonDir.clone().multiplyScalar(-25)),
            
            new THREE.Vector3(30, -5, -15),         // Mi-chemin retour
            new THREE.Vector3(8, 0, 2),             // 0.92 Réentrée atmosphérique
            new THREE.Vector3(6, -0.5, 0.5),        // Approche finale
            new THREE.Vector3(5.0, 0, 0)            // 1.0 Splashdown
        ];

        this.curve = new THREE.CatmullRomCurve3(points, false, 'chordal');
        this.curve.arcLengthDivisions = 1000;
        
        if (this.line) {
            const newPoints = this.curve.getSpacedPoints(1000);
            this.line.geometry.setFromPoints(newPoints);
            this.line.computeLineDistances();
            this.line.geometry.computeBoundingSphere();
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
        const points = this.curve.getSpacedPoints(1000);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 2,
            gapSize: 1,
            opacity: 0.4,
            transparent: true
        });

        this.line = new THREE.Line(geometry, material);
        this.line.computeLineDistances(); 
        scene.add(this.line);

        // Ajouter les sphères pour les milestones
        this.milestones.forEach(m => {
            const pos = this.curve.getPointAt(m.t);
            const markerGeo = new THREE.SphereGeometry(0.8, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.copy(pos);
            marker.userData.isMilestone = true;
            
            // Halo lumineux
            const glowGeo = new THREE.SphereGeometry(1.5, 16, 16);
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
