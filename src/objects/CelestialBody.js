import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export class CelestialBody {
    static CONSTANTS = {
        EARTH_RADIUS: 5,
        MOON_RADIUS: 5 * 0.2727,
        SUN_RADIUS: 5 * 20,
        EARTH_MOON_DIST: 5 * 60.33,
        EARTH_SUN_DIST: 5 * 1000,
    };

    constructor(radius, texturePath, name) {
        this.radius = radius;
        this.texturePath = texturePath;
        this.name = name;
        this.mesh = this.createMesh();
        this.label = this.createLabel();
        this.mesh.add(this.label);
        this.currentDist = 100;

        if (this.name === 'Earth') {
            this.clouds = this.createClouds();
            this.mesh.add(this.clouds);
            this.atmosphere = this.createAtmosphere();
            this.mesh.add(this.atmosphere);
            this.vanAllen = this.createVanAllenBelts();
            this.mesh.add(this.vanAllen);
        }

        if (this.name === 'Sun') {
            this.glow = this.createSunGlow();
            this.mesh.add(this.glow);
        }
    }

    createClouds() {
        const geometry = new THREE.SphereGeometry(this.radius * 1.015, 128, 128);
        const material = new THREE.MeshPhongMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_clouds_2048.png'),
            transparent: true,
            opacity: 0.6,
            depthWrite: false
        });
        const clouds = new THREE.Mesh(geometry, material);
        clouds.name = 'EarthClouds';
        return clouds;
    }

    // ── Texture procédurale très subtile pour le Soleil ──
    _generateSunTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Fond blanc très légèrement chaud
        ctx.fillStyle = '#fffef8';
        ctx.fillRect(0, 0, size, size);

        // Subtile variation de luminosité (granulation à peine perceptible)
        ctx.globalCompositeOperation = 'multiply';
        for (let i = 0; i < 1500; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 4 + Math.random() * 12;
            const lum = 240 + Math.floor(Math.random() * 15);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${lum}, ${lum}, ${Math.floor(lum * 0.97)}, 0.08)`;
            ctx.fill();
        }

        // Quelques zones très légèrement plus chaudes
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = 20 + Math.random() * 60;
            const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
            grad.addColorStop(0, 'rgba(255, 252, 240, 0.06)');
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }

    createSunGlow() {
        const group = new THREE.Group();

        const createGlowSprite = (size, color, opacity) => {
            const spriteMaterial = new THREE.SpriteMaterial({
                map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
                color: color,
                transparent: true,
                opacity: opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(size, size, 1);
            return sprite;
        };

        // Couche 1 : Glow blanc intense et proche
        group.add(createGlowSprite(this.radius * 3.5, 0xffffff, 0.6));
        // Couche 2 : Glow blanc-chaud moyen
        group.add(createGlowSprite(this.radius * 6, 0xfff8ee, 0.25));
        // Couche 3 : Halo large, blanc subtil
        group.add(createGlowSprite(this.radius * 10, 0xfff4e0, 0.08));

        return group;
    }

    createMesh() {
        const geometry = new THREE.SphereGeometry(this.radius, 128, 128);
        
        let material;
        if (this.name === 'Sun') {
            const sunTex = this._generateSunTexture();
            material = new THREE.MeshBasicMaterial({
                map: sunTex,
                color: 0xffffff,
            });
        } else if (this.name === 'Earth') {
            const loader = new THREE.TextureLoader();
            material = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 15,
                map: loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
                specularMap: loader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
                normalMap: loader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
                normalScale: new THREE.Vector2(0.85, 0.85)
            });
        } else if (this.name === 'Moon') {
            const loader = new THREE.TextureLoader();
            material = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                shininess: 0,
                map: loader.load('https://threejs.org/examples/textures/planets/moon_1024.jpg'),
            });
        } else {
            material = new THREE.MeshPhongMaterial({
                color: this.name === 'Earth' ? 0x2233ff : 0x888888,
                shininess: 5
            });
        }

        if (this.texturePath && this.name !== 'Earth' && this.name !== 'Sun') {
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
        if (this.name === 'Sun') return new THREE.Group();

        const div = document.createElement('div');
        div.className = 'text-white text-[10px] bg-black/50 px-1 rounded border border-white/20 pointer-events-none';
        div.textContent = this.name;
        
        const label = new CSS2DObject(div);
        label.position.set(0, this.radius + 1, 0);
        return label;
    }

    createAtmosphere() {
        const spriteMaterial = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
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
        
        const innerGeo = new THREE.TorusGeometry(this.radius * 1.5, 0.5, 16, 100);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00, transparent: true, opacity: 0.1, side: THREE.DoubleSide
        });
        const innerBelt = new THREE.Mesh(innerGeo, innerMat);
        innerBelt.rotation.x = Math.PI / 2.2;
        group.add(innerBelt);

        const outerGeo = new THREE.TorusGeometry(this.radius * 2.5, 0.8, 16, 100);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0x00aaff, transparent: true, opacity: 0.05, side: THREE.DoubleSide
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
        const geometry = new THREE.TorusGeometry(1, 0.0004, 8, 128);
        const material = new THREE.MeshBasicMaterial({
            color: 0xcccccc, transparent: true, opacity: 0.5
        });
        const orbitLine = new THREE.Mesh(geometry, material);
        orbitLine.rotation.x = Math.PI / 2;

        const pts = [];
        for (let i = 0; i <= 128; i++) {
            const a = (i / 128) * Math.PI * 2;
            pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.3 });
        orbitLine.add(new THREE.Line(lineGeo, lineMat));

        this.orbitLine = orbitLine;
        return orbitLine;
    }

    updateOrbitLine(earthMesh) {
        if (this.orbitLine) {
            const s = this.currentDist;
            this.orbitLine.scale.set(s, s, s);
            if (earthMesh) {
                this.orbitLine.position.copy(earthMesh.position);
            }
        }
    }

    update(earthMesh, percent = 0) {
        if (this.name === 'Moon' && earthMesh) {
            const orbitPercentOfCircle = 10 / 27.3;
            const angle = percent * orbitPercentOfCircle * Math.PI * 2;

            this.mesh.position.x = earthMesh.position.x + Math.cos(angle) * this.currentDist;
            this.mesh.position.z = earthMesh.position.z + Math.sin(angle) * this.currentDist;

            this.mesh.lookAt(earthMesh.position);
        } else if (this.name === 'Earth') {
            const earthOrbitProgress = 10 / 365.25;
            const angle = percent * earthOrbitProgress * Math.PI * 2 + Math.PI / 4;
            const dist = CelestialBody.CONSTANTS.EARTH_SUN_DIST;
            
            this.mesh.position.x = Math.cos(angle) * dist;
            this.mesh.position.z = Math.sin(angle) * dist;
            
            if (this.clouds) {
                this.clouds.rotation.y += 0.0001;
                this.clouds.rotation.z += 0.00005;
            }
        } else if (this.name === 'Sun') {
            // Rotation lente
            this.mesh.rotation.y += 0.0002;
        } else {
            this.mesh.rotation.y += 0.001;
        }
    }

    getMesh() {
        return this.mesh;
    }
}
