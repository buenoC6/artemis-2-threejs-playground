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

        // --- Module de Commande (CM) - La capsule pressurisée (cône tronqué) ---
        // Rayon haut: 0.15, Rayon bas: 0.5, Hauteur: 0.4
        const cmGeo = new THREE.CylinderGeometry(0.15, 0.5, 0.4, 32);
        const cmMat = new THREE.MeshPhongMaterial({ color: 0xeeeeee, shininess: 80 }); // Blanc brillant / Aluminium
        const cm = new THREE.Mesh(cmGeo, cmMat);
        cm.rotation.x = Math.PI / 2;
        cm.position.z = 0.2; // Placé vers l'avant
        cm.castShadow = true;
        cm.receiveShadow = true;
        group.add(cm);

        // Fenêtres des hublots (un ensemble de fenêtres réparties)
        const windowGeo = new THREE.CircleGeometry(0.04, 16);
        const windowMat = new THREE.MeshPhongMaterial({ 
            color: 0x111111, 
            shininess: 200, 
            specular: 0x444444 
        });

        // Fenêtre centrale avant
        const windowFront = new THREE.Mesh(windowGeo, windowMat);
        windowFront.position.set(0, 0.08, 0.205); // Placée sur la pente du cône
        windowFront.rotation.x = -Math.PI / 12; // Inclinée selon la pente du CM
        cm.add(windowFront);

        // Fenêtres latérales (2 de chaque côté)
        for (let i = 0; i < 2; i++) {
            const sideWindow = new THREE.Mesh(windowGeo, windowMat);
            const sideAngle = (i === 0 ? 1 : -1) * Math.PI / 4;
            sideWindow.position.set(Math.sin(sideAngle) * 0.3, 0.05, 0.2);
            sideWindow.rotation.y = sideAngle;
            sideWindow.rotation.x = -Math.PI / 12;
            cm.add(sideWindow);
        }

        // --- Lumières de Position (LEDs de navigation) ---
        const ledGeo = new THREE.SphereGeometry(0.015, 8, 8);
        const redLedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const greenLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const whiteLedMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const leftLed = new THREE.Mesh(ledGeo, redLedMat);
        leftLed.position.set(-0.48, 0, 0); // Bord gauche du CM
        cm.add(leftLed);

        const rightLed = new THREE.Mesh(ledGeo, greenLedMat);
        rightLed.position.set(0.48, 0, 0); // Bord droit du CM
        cm.add(rightLed);

        const topLed = new THREE.Mesh(ledGeo, whiteLedMat);
        topLed.position.set(0, 0.15, 0.15); // Sommet du CM
        cm.add(topLed);

        // --- Module de Service (SM) - Le cylindre technique ---
        // Rayon: 0.5, Hauteur: 0.5
        const smGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32);
        const smMat = new THREE.MeshPhongMaterial({ color: 0xdddddd, shininess: 50 });
        const sm = new THREE.Mesh(smGeo, smMat);
        sm.rotation.x = Math.PI / 2;
        sm.position.z = -0.25; // Placé derrière le CM
        sm.castShadow = true;
        sm.receiveShadow = true;
        group.add(sm);

        // --- Détails du SM : Radiateurs et Antennes ---
        // Bandes verticales (Radiateurs)
        const radGeo = new THREE.PlaneGeometry(0.1, 0.45);
        const radMat = new THREE.MeshPhongMaterial({ color: 0xbbbbbb, shininess: 30 });
        for (let i = 0; i < 8; i++) {
            const rad = new THREE.Mesh(radGeo, radMat);
            const angle = (i * Math.PI * 2) / 8;
            rad.position.set(Math.cos(angle) * 0.501, Math.sin(angle) * 0.501, 0);
            rad.rotation.z = angle + Math.PI / 2;
            sm.add(rad);
        }

        // Antennes (4 petites antennes paraboliques ou fouets)
        const antGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 8);
        const antMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        for (let i = 0; i < 2; i++) {
            const ant = new THREE.Mesh(antGeo, antMat);
            const angle = (i * Math.PI) + Math.PI/2;
            ant.position.set(Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, 0.2);
            ant.rotation.z = angle + Math.PI/2;
            sm.add(ant);
        }

        // Adaptateur / Section arrière (un peu plus étroite)
        const adapterGeo = new THREE.CylinderGeometry(0.5, 0.4, 0.1, 32);
        const adapter = new THREE.Mesh(adapterGeo, smMat);
        adapter.rotation.x = Math.PI / 2;
        adapter.position.z = -0.55;
        group.add(adapter);

        // --- Panneaux Solaires (4 panneaux en croix) ---
        const solarMat = new THREE.MeshPhongMaterial({ 
            color: 0x112244, 
            shininess: 150,
            specular: 0x3366ff
        });
        
        // Un panneau fait environ 1.5 de long et 0.4 de large
        const panelGeo = new THREE.BoxGeometry(1.5, 0.02, 0.4);
        
        for (let i = 0; i < 4; i++) {
            const panel = new THREE.Mesh(panelGeo, solarMat);
            // On les écarte du centre du SM
            const angle = (i * Math.PI) / 2 + Math.PI / 4; // Décalés de 45°
            const dist = 0.5; // Rayon du SM
            
            panel.position.x = Math.cos(angle) * (dist + 0.75); // + 0.75 car le centre du panneau est à la moitié de sa longueur
            panel.position.y = Math.sin(angle) * (dist + 0.75);
            panel.position.z = -0.25; // Alignés avec le SM
            
            // On oriente le panneau vers le centre
            panel.rotation.z = angle;
            
            panel.castShadow = true;
            panel.receiveShadow = true;
            group.add(panel);
        }

        // --- Moteur / Tuyère principal ---
        const engineGeo = new THREE.CylinderGeometry(0.1, 0.2, 0.2, 16);
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
