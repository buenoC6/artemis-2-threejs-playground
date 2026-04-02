import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class CelestialBody {
    static CONSTANTS = {
        EARTH_RADIUS: 5,
        MOON_RADIUS: 5 * 0.27,
        SUN_RADIUS: 5 * 20, // 109 réel mais réduit pour visibilité
        EARTH_MOON_DIST: 5 * 60, // ~300 unités
        EARTH_SUN_DIST: 5 * 1000, // ~5000 unités (réel 23000 mais réduit pour visibilité/performance)
    };

    constructor(radius, texturePath, name) {
        this.radius = radius;
        this.texturePath = texturePath;
        this.name = name;
        this.mesh = this.createMesh();
        this.label = this.createLabel();
        this.mesh.add(this.label);
        this.currentDist = 100; // Distance par défaut

        if (this.name === 'Earth') {
            this.atmosphere = this.createAtmosphere();
            this.mesh.add(this.atmosphere);
            this.vanAllen = this.createVanAllenBelts();
            this.mesh.add(this.vanAllen);
            this.earthOrbitLine = this.createEarthOrbitLine();
        }

        if (this.name === 'Sun') {
            this.glow = this.createSunGlow();
            this.mesh.add(this.glow);
        }
    }

    createSunGlow() {
        const spriteMaterial = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
            color: 0xffdd88,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(this.radius * 6, this.radius * 6, 1);
        return sprite;
    }

    createMesh() {
        const geometry = new THREE.SphereGeometry(this.radius, 128, 128);
        
        let material;
        if (this.name === 'Sun') {
            material = new THREE.MeshBasicMaterial({
                color: 0xffffff
            });
        } else {
            material = new THREE.MeshPhongMaterial({
                color: this.name === 'Earth' ? 0x2233ff : 0x888888,
                shininess: 5
            });
        }

        if (this.texturePath) {
            const loader = new THREE.TextureLoader();
            loader.load(this.texturePath, (texture) => {
                material.map = texture;
                material.needsUpdate = true;
            });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = this.name;
        
        if (this.name === 'Sun') {
            mesh.castShadow = false;
            mesh.receiveShadow = false;
        } else {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
        return mesh;
    }

    createLabel() {
        if (this.name === 'Sun') return new THREE.Group(); // Pas de label pour le Soleil
        
        const div = document.createElement('div');
        div.className = 'text-white text-[10px] bg-black/50 px-1 rounded border border-white/20 pointer-events-none';
        div.textContent = this.name;
        
        const label = new CSS2DObject(div);
        label.position.set(0, this.radius + 1, 0);
        return label;
    }

    createAtmosphere() {
        // Simple halo avec un Sprite
        const spriteMaterial = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'), // Fallback ou texture générée
            color: 0x4488ff,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(this.radius * 2.5, this.radius * 2.5, 1);
        return sprite;
    }

    createVanAllenBelts() {
        const group = new THREE.Group();
        
        // Ceinture intérieure (Tore)
        const innerGeo = new THREE.TorusGeometry(this.radius * 1.5, 0.5, 16, 100);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide
        });
        const innerBelt = new THREE.Mesh(innerGeo, innerMat);
        innerBelt.rotation.x = Math.PI / 2.2;
        group.add(innerBelt);

        // Ceinture extérieure (Tore plus large)
        const outerGeo = new THREE.TorusGeometry(this.radius * 2.5, 0.8, 16, 100);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide
        });
        const outerBelt = new THREE.Mesh(outerGeo, outerMat);
        outerBelt.rotation.x = Math.PI / 2.2;
        group.add(outerBelt);

        return group;
    }

    toggleVanAllen(visible) {
        if (this.vanAllen) this.vanAllen.visible = visible;
    }

    createOrbitLine() {
        // Crée un cercle représentant l'orbite de la Lune
        // On utilise un rayon de 1 et on scale ensuite pour éviter les problèmes de géométrie fixe
        const geometry = new THREE.RingGeometry(0.995, 1.005, 128);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x66aaff, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.4 
        });
        const orbitLine = new THREE.Mesh(geometry, material);
        orbitLine.rotation.x = Math.PI / 2;
        this.orbitLine = orbitLine;
        return orbitLine;
    }

    updateOrbitLine(earthMesh) {
        if (this.orbitLine) {
            // Appliquer la distance actuelle via le scale
            const s = this.currentDist;
            this.orbitLine.scale.set(s, s, 1);
            
            // Suivre la Terre
            if (earthMesh) {
                this.orbitLine.position.copy(earthMesh.position);
            }
        }
    }

    createEarthOrbitLine() {
        // Orbite de la Terre autour du Soleil
        const dist = CelestialBody.CONSTANTS.EARTH_SUN_DIST;
        const geometry = new THREE.RingGeometry(dist - 2, dist + 2, 256);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffaa, 
            side: THREE.DoubleSide, 
            transparent: true, 
            opacity: 0.15 
        });
        const orbitLine = new THREE.Mesh(geometry, material);
        orbitLine.rotation.x = Math.PI / 2;
        orbitLine.visible = true;
        return orbitLine;
    }

    update(earthMesh, percent = 0) {
        if (this.name === 'Moon' && earthMesh) {
            // Orbite lunaire : environ 27.3 jours
            // Mission Artemis 2 : 10 jours
            const orbitPercentOfCircle = 10 / 27.3;
            // On ajoute un petit offset à l'angle pour que la Lune soit alignée avec la trajectoire au Flyby (t=0.5)
            // L'offset dépend de la construction de la trajectoire dans TrajectoryManager
            const angle = percent * orbitPercentOfCircle * Math.PI * 2;
            
            this.mesh.position.x = earthMesh.position.x + Math.cos(angle) * this.currentDist;
            this.mesh.position.z = earthMesh.position.z + Math.sin(angle) * this.currentDist;
            
            this.mesh.lookAt(earthMesh.position);
        } else if (this.name === 'Earth') {
            // Orbite terrestre autour du Soleil (fixe à 0,0,0)
            // On peut simuler un petit mouvement sur les 10 jours de mission
            // 10 / 365.25 jours
            const earthOrbitProgress = 10 / 365.25;
            const angle = percent * earthOrbitProgress * Math.PI * 2 + Math.PI / 4; // Offset arbitraire
            const dist = CelestialBody.CONSTANTS.EARTH_SUN_DIST;
            
            this.mesh.position.x = Math.cos(angle) * dist;
            this.mesh.position.z = Math.sin(angle) * dist;
            
            // Rotation propre de la Terre (1 tour par jour) - Désactivée à la demande de l'utilisateur pour simplification
            // this.mesh.rotation.y = percent * 10 * Math.PI * 2;
        } else {
            const speed = 0.001;
            this.mesh.rotation.y += speed;
        }
    }

    getMesh() {
        return this.mesh;
    }
}
