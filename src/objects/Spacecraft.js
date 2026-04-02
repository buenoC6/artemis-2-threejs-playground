import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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

        // Corps principal
        const geometry = new THREE.ConeGeometry(0.5, 1, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 100 });
        const cone = new THREE.Mesh(geometry, material);
        cone.rotation.x = Math.PI / 2;
        cone.castShadow = true;
        cone.receiveShadow = true;
        group.add(cone);

        // Bouclier thermique
        const shieldGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.2, 16);
        const shieldMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const shield = new THREE.Mesh(shieldGeo, shieldMat);
        shield.position.z = -0.5;
        shield.rotation.x = Math.PI / 2;
        shield.castShadow = true;
        shield.receiveShadow = true;
        group.add(shield);

        // Moteur / Tuyère (pour le bloom)
        const engineGeo = new THREE.CylinderGeometry(0.2, 0.3, 0.2, 8);
        const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.engineMesh = new THREE.Mesh(engineGeo, engineMat);
        this.engineMesh.position.z = -0.7;
        this.engineMesh.rotation.x = Math.PI / 2;
        group.add(this.engineMesh);

        // Système de particules (Propulsion)
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

        // Animation des particules
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length / 3; i++) {
            positions[i * 3 + 2] -= 0.05 * engineIntensity;
            if (positions[i * 3 + 2] < -3) {
                positions[i * 3 + 2] = -0.7;
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.visible = engineIntensity > 0.05;
        this.engineMesh.material.color.setHex(engineIntensity > 0.5 ? 0xffaa00 : 0x00ffff);
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

        // Loi en 1/d² - on utilise des constantes arbitraires pour le visuel
        // La Terre est beaucoup plus massive, on lui donne un bonus de base
        const forceTerre = (5000 / (distTerre * distTerre));
        const forceLune = (500 / (distLune * distLune));

        // On transforme les directions en local (le mesh d'orion tourne)
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
