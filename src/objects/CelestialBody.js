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
        this.atmosphereFresnelMaterial = null;
        this.atmosphereHaloSpriteMaterial = null;
        this.atmosphereHaloBaseOpacity = 0.06;
        this.mesh = this.createMesh();
        this.label = this.createLabel();
        this.mesh.add(this.label);
        this.currentDist = 100;

        if (this.name === 'Earth') {
            this.clouds = this.createClouds();
            this.mesh.add(this.clouds);
            this.atmosphere = this.createAtmosphere();
            this.mesh.add(this.atmosphere);
            this.auroras = this.createAuroras();
            this.mesh.add(this.auroras);
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
        const material = new THREE.MeshLambertMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_clouds_2048.png'),
            transparent: true,
            opacity: 0.4,
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

        const createGlowSprite = (size, color, opacity, order) => {
            const spriteMaterial = new THREE.SpriteMaterial({
                map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
                color: color,
                transparent: true,
                opacity: opacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false,
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(size, size, 1);
            sprite.renderOrder = order;
            return sprite;
        };

        // Couche 1 : noyau lumineux, moins agressif
        group.add(createGlowSprite(this.radius * 4.0, 0xffffff, 0.45, 120));
        // Couche 2 : halo interne chaud
        group.add(createGlowSprite(this.radius * 7.0, 0xfff7dd, 0.2, 121));
        // Couche 3 : halo externe diffus
        group.add(createGlowSprite(this.radius * 11.0, 0xffefcf, 0.1, 122));
        // Couche 4 : voile large plus subtil
        group.add(createGlowSprite(this.radius * 16.0, 0xfff4df, 0.04, 123));

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
            material = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                map: loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
            });
        } else if (this.name === 'Moon') {
            const loader = new THREE.TextureLoader();
            material = new THREE.MeshLambertMaterial({
                color: 0xffffff,
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
        const group = new THREE.Group();

        // ── Couche 1 : Coquille Fresnel (bleu profond sur le limbe) ──
        const atmosphereGeo = new THREE.SphereGeometry(this.radius * 1.025, 64, 64);
        const atmosphereMat = new THREE.ShaderMaterial({
            uniforms: {
                uSunPosition: { value: new THREE.Vector3(0, 0, 0) }
            },
            vertexShader: `
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    vWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
            fragmentShader: `
                uniform vec3 uSunPosition;
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;
                void main() {
                    vec3 normal = normalize(vWorldNormal);
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    vec3 sunDir = normalize(uSunPosition - vWorldPosition);

                    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
                    fresnel = pow(fresnel, 3.0);

                    // Atténue fortement la diffusion atmosphérique sur la face nuit.
                    float sunlight = smoothstep(-0.2, 0.3, dot(normal, sunDir));

                    vec3 innerBlue  = vec3(0.15, 0.45, 1.0);
                    vec3 outerCyan  = vec3(0.3, 0.7, 1.0);
                    vec3 color = mix(innerBlue, outerCyan, fresnel);
                    color *= mix(0.2, 1.0, sunlight);

                    float alpha = fresnel * mix(0.02, 0.3, sunlight);
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            blending: THREE.NormalBlending,
            side: THREE.FrontSide,
            depthWrite: false
        });
        this.atmosphereFresnelMaterial = atmosphereMat;
        group.add(new THREE.Mesh(atmosphereGeo, atmosphereMat));

        // ── Couche 2 : Halo externe (sprite large, bleu vif) ──
        const spriteMaterial = new THREE.SpriteMaterial({
            map: new THREE.TextureLoader().load('https://threejs.org/examples/textures/lensflare/lensflare0.png'),
            color: 0x1a55ff,
            transparent: true,
            opacity: this.atmosphereHaloBaseOpacity,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
        this.atmosphereHaloSpriteMaterial = spriteMaterial;
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(this.radius * 2.8, this.radius * 2.8, 1);
        group.add(sprite);

        return group;
    }

    updateAtmosphereLighting(sunPosition, cameraPosition) {
        if (this.name !== 'Earth' || !this.atmosphere) return;

        if (this.atmosphereFresnelMaterial?.uniforms?.uSunPosition && sunPosition) {
            this.atmosphereFresnelMaterial.uniforms.uSunPosition.value.copy(sunPosition);
        }

        if (!this.atmosphereHaloSpriteMaterial || !sunPosition || !cameraPosition) return;

        const earthWorldPos = new THREE.Vector3();
        this.mesh.getWorldPosition(earthWorldPos);

        const sunDirFromEarth = sunPosition.clone().sub(earthWorldPos).normalize();
        const viewDirFromEarth = cameraPosition.clone().sub(earthWorldPos).normalize();
        const viewSunAlignment = sunDirFromEarth.dot(viewDirFromEarth);

        // Quasi nul dos au Soleil, remonte progressivement quand on se rapproche du côté jour.
        const haloFactor = THREE.MathUtils.smoothstep(viewSunAlignment, -0.25, 0.35);
        this.atmosphereHaloSpriteMaterial.opacity = this.atmosphereHaloBaseOpacity * haloFactor;
    }

    // ── Aurores Boréales & Australes (interaction vents solaires / magnétosphère) ──
    createAuroras() {
        const group = new THREE.Group();

        const vertexShader = `
            attribute float aAngle;
            attribute float aHeight;
            attribute float aRandom;
            uniform float uTime;
            varying float vHeight;
            varying float vRandom;
            varying float vAngle;
            varying float vAlpha;

            void main() {
                vRandom = aRandom;
                vAngle  = aAngle;

                vec3 pos    = position;
                vec3 radial = normalize(pos);

                // Ondes multiples → rideau lumineux animé
                float w1 = sin(aAngle * 4.0 + uTime * 0.8) * 0.5 + 0.5;
                float w2 = sin(aAngle * 9.0 - uTime * 0.5 + aRandom * 3.14) * 0.5 + 0.5;
                float w3 = sin(aAngle * 2.0 + uTime * 0.3) * 0.5 + 0.5;
                float heightFactor = w1 * w2 * w3;

                vHeight = aHeight * heightFactor;
                vAlpha  = heightFactor;

                // Déplacement radial vers l'extérieur (rideau qui s'élève)
                pos += radial * aHeight * heightFactor * 0.6;

                vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
                float sizeByDistance = 2.0 * (220.0 / -mvPos.z);
                gl_PointSize = clamp(sizeByDistance, 1.2, 5.0);
                gl_Position  = projectionMatrix * mvPos;
            }
        `;

        const fragmentShader = `
            uniform float uTime;
            varying float vHeight;
            varying float vRandom;
            varying float vAngle;
            varying float vAlpha;

            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                float softEdge = 1.0 - smoothstep(0.05, 0.5, dist);
                float radialFog = exp(-9.0 * dist * dist);

                // Palette aurore : vert ↔ cyan ↔ violet
                vec3 green  = vec3(0.15, 1.0, 0.4);
                vec3 cyan   = vec3(0.1,  0.7, 1.0);
                vec3 purple = vec3(0.6,  0.15, 0.85);

                float t1 = sin(vAngle * 3.0 + uTime * 0.6) * 0.5 + 0.5;
                float t2 = sin(vAngle * 7.0 - uTime * 0.4 + vRandom * 6.28) * 0.5 + 0.5;

                vec3 color = mix(green, cyan, t1);
                color = mix(color, purple, t2 * 0.35);

                // Scintillement
                float shimmer = 0.5 + 0.5 * sin(uTime * 1.5 + vRandom * 12.56 + vAngle * 5.0);

                float alpha = softEdge * radialFog * vAlpha * (0.65 + 0.35 * shimmer) * 0.08;
                gl_FragColor = vec4(color, alpha);
            }
        `;

        // Aurores sur les deux poles (Nord = +1, Sud = -1)
        [1, -1].forEach(pole => {
            const count = 280;
            const positions = new Float32Array(count * 3);
            const aAngles   = new Float32Array(count);
            const aHeights  = new Float32Array(count);
            const aRandoms  = new Float32Array(count);

            // Polar cap: 4deg-14deg from pole keeps curtains near magnetic caps.
            const minPolarAngle = THREE.MathUtils.degToRad(4);
            const maxPolarAngle = THREE.MathUtils.degToRad(14);

            // Non-uniform longitude to break symmetry with localized arcs.
            const arcCenters = [
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
            ];
            const arcWidth = 0.55 + Math.random() * 0.35;

            for (let i = 0; i < count; i++) {
                const arcCenter = arcCenters[Math.floor(Math.random() * arcCenters.length)];
                const angle = arcCenter + (Math.random() - 0.5) * arcWidth;

                // theta is measured from the pole axis.
                const theta = minPolarAngle + Math.random() * (maxPolarAngle - minPolarAngle);
                const r = this.radius * 1.015;
                const ringRadius = r * Math.sin(theta);

                positions[i * 3] = ringRadius * Math.cos(angle);
                positions[i * 3 + 1] = pole * r * Math.cos(theta);
                positions[i * 3 + 2] = ringRadius * Math.sin(angle);

                aAngles[i]  = angle;
                aHeights[i] = 0.15 + Math.random() * 0.35;
                aRandoms[i] = Math.random();
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('aAngle',   new THREE.BufferAttribute(aAngles,   1));
            geometry.setAttribute('aHeight',  new THREE.BufferAttribute(aHeights,  1));
            geometry.setAttribute('aRandom',  new THREE.BufferAttribute(aRandoms,  1));

            const material = new THREE.ShaderMaterial({
                uniforms:       { uTime: { value: 0 } },
                vertexShader,
                fragmentShader,
                transparent: true,
                blending:    THREE.NormalBlending,
                depthWrite:  false,
            });

            group.add(new THREE.Points(geometry, material));
        });

        group.name = 'Auroras';
        return group;
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

            // Gestion du Night side emmisive (très subtil pour ne pas polluer le côté éclairé)
            if (this.mesh.material && this.mesh.material.emissive) {
                this.mesh.material.emissive.setHex(0x050810);
                this.mesh.material.emissiveIntensity = 0.08;
            }

            if (this.clouds) {
                this.clouds.rotation.y += 0.0001;
                this.clouds.rotation.z += 0.00005;
            }

            // Mise à jour du temps pour l'animation des aurores boréales
            if (this.auroras) {
                const t = performance.now() * 0.001;
                this.auroras.children.forEach(child => {
                    if (child.material && child.material.uniforms) {
                        child.material.uniforms.uTime.value = t;
                    }
                });
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
