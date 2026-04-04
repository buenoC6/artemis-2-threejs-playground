import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            preserveDrawingBuffer: true // Requis pour les captures d'écran
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.labelRenderer = new CSS2DRenderer();
        
        // Raycaster pour les Hotspots
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Cibles pour la caméra (Navigation)
        this.cameraTarget = null;
        this.cameraOffset = new THREE.Vector3(50, 40, 150);
        this.lookAtTarget = null;
        this.hublotTarget = null; // Mode hublot (POV)
        this.isLerping = false;
        this.isInteracting = false;
        this.introActive = false; // Empêche updateExposure d'écraser l'opacité des étoiles pendant l'intro

        this.init();
        this.initPostProcessing();
        this.initControls();
        this.initHelpers();
    }

    initHelpers() {
        // Grille de coordonnées écliptiques
        this.grid = new THREE.GridHelper(1000, 50, 0x444444, 0x222222);
        this.grid.position.y = -20;
        this.grid.visible = false; // Cachée par défaut dès la création
        this.scene.add(this.grid);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 0.05;
        this.controls.maxDistance = 20000;
        
        // Arrêter l'interpolation si l'utilisateur interagit, mais GARDER la cible pour le suivi
        this.controls.addEventListener('start', () => {
            this.isLerping = false;
            this.isInteracting = true;
        });

        this.controls.addEventListener('end', () => {
            this.isInteracting = false;
        });

        this.controls.addEventListener('change', () => {
            if (!this.isLerping && this.cameraTarget && this.isInteracting) {
                // Mettre à jour l'offset quand l'utilisateur bouge manuellement
                const targetPos = new THREE.Vector3();
                if (this.cameraTarget instanceof THREE.Object3D) {
                    this.cameraTarget.getWorldPosition(targetPos);
                } else {
                    targetPos.copy(this.cameraTarget);
                }
                this.cameraOffset.subVectors(this.camera.position, targetPos);
            }
        });
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0px';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.container.appendChild(this.labelRenderer.domElement);

        this.camera.position.copy(this.cameraOffset);

        // Lumières (Soleil directionnel fixe)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sunLight.position.set(-100, 40, 100); 
        this.sunLight.castShadow = true;
        
        // Configuration ombres pour l'espace
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 1000;
        this.sunLight.shadow.camera.left = -200;
        this.sunLight.shadow.camera.right = 200;
        this.sunLight.shadow.camera.top = 200;
        this.sunLight.shadow.camera.bottom = -200;

        this.scene.add(this.sunLight);

        // Position du Soleil (Mesh + Lumière)
        this.sunPos = new THREE.Vector3(-300, 100, 300);
        this.sunLight.position.copy(this.sunPos);

        // Étoiles en fond
        this.addStars();
        this.toggleGrid(false); 

        this.initAudio();
        this.musicLoaded = false;
        this.isMusicPlaying = false;
        this.shouldBePlaying = false;

        window.addEventListener('resize', () => this.onWindowResize(), false);
        window.addEventListener('click', (e) => this.onMouseClick(e), false);
        
        // Gestion de l'autoplay bloqué (Cliquer n'importe où pour activer l'audio au premier contact)
        const unlockAudio = () => {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    console.log("AudioContext débloqué par l'utilisateur.");
                    if (this.shouldBePlaying && this.bgMusic && !this.isMusicPlaying) {
                        if (this.musicLoaded) {
                            this.bgMusic.play();
                            this.isMusicPlaying = true;
                        }
                    }
                });
            } else if (this.shouldBePlaying && this.bgMusic && !this.isMusicPlaying) {
                if (this.musicLoaded) {
                    this.bgMusic.play();
                    this.isMusicPlaying = true;
                }
            }
            
            // On enlève les écouteurs une fois débloqué
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
            window.removeEventListener('mousedown', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('touchstart', unlockAudio);
        window.addEventListener('mousedown', unlockAudio);
    }

    initAudio() {
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        
        this.soundEffect = new THREE.Audio(this.listener);
        this.bgMusic = new THREE.Audio(this.listener);
        
        this.audioCtx = THREE.AudioContext.getContext();
    }

    toggleMusic(enabled) {
        if (!this.bgMusic) return;
        this.shouldBePlaying = enabled;

        if (enabled) {
            // Toujours tenter de reprendre l'AudioContext car il peut être suspendu par défaut
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            if (!this.musicLoaded) {
                const audioLoader = new THREE.AudioLoader();
                audioLoader.load('/songs/ksp.mp3', (buffer) => {
                    this.bgMusic.setBuffer(buffer);
                    this.bgMusic.setLoop(true);
                    this.bgMusic.setVolume(this.currentVolume || 0.3);
                    
                    this.musicLoaded = true;

                    // Tentative de lecture immédiate (ne fonctionnera que si déjà débloqué)
                    if (this.audioCtx.state === 'running') {
                        this.bgMusic.play();
                        this.isMusicPlaying = true;
                    }
                }, undefined, (err) => {
                    console.warn("Échec du chargement du fichier local ksp.mp3, passage en mode synthèse spatiale.");
                    this.startAmbientSynthesis();
                });
            } else if (!this.isMusicPlaying) {
                this.bgMusic.play();
                this.isMusicPlaying = true;
            }
        } else {
            if (this.isMusicPlaying) {
                this.bgMusic.pause();
                this.isMusicPlaying = false;
            }
            if (this.ambientOscillators) {
                this.stopAmbientSynthesis();
            }
        }
    }

    setVolume(value) {
        this.currentVolume = value;
        if (this.bgMusic && this.musicLoaded) {
            this.bgMusic.setVolume(value);
        }
        if (this.ambientOscillators) {
            this.ambientOscillators.forEach(item => {
                item.gain.gain.setValueAtTime(value * 0.1, this.audioCtx.currentTime);
            });
        }
    }

    startAmbientSynthesis() {
        // Synthèse d'ambiance spatiale si le fichier ne charge pas
        if (!this.audioCtx) return;
        this.ambientOscillators = [];
        const frequencies = [110, 164, 220]; // Accords profonds
        
        frequencies.forEach(f => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
            gain.gain.setValueAtTime(0.02, this.audioCtx.currentTime);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            this.ambientOscillators.push({ osc, gain });
        });
        this.isMusicPlaying = true;
    }

    stopAmbientSynthesis() {
        if (this.ambientOscillators) {
            this.ambientOscillators.forEach(item => {
                item.gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1);
                setTimeout(() => item.osc.stop(), 1000);
            });
            this.ambientOscillators = null;
        }
    }

    playBip() {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    onMouseClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        const hotspot = intersects.find(i => i.object.userData && i.object.userData.isHotspot);
        if (hotspot && this.onHotspotClick) {
            this.onHotspotClick(hotspot.object.userData);
        }
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6, // Force
            0.4, // Rayon
            0.85 // Seuil
        );
        this.composer.addPass(this.bloomPass);

        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }

    setHublotMode(target) {
        this.hublotTarget = target;
        this.cameraTarget = null;
        this.lookAtTarget = null;
        this.isLerping = false;
        this.controls.enabled = false;
        // Near clip très proche pour voir l'intérieur du cockpit miniature
        this.camera.near = 0.001;
        this.camera.updateProjectionMatrix();
    }

    setCameraTarget(target, offset = new THREE.Vector3(20, 10, 20), lookAtPos = null, speed = 0.05) {
        this.hublotTarget = null; // Quitter le mode hublot
        // Restaurer le near clip normal
        if (this.camera.near < 0.1) {
            this.camera.near = 0.1;
            this.camera.updateProjectionMatrix();
        }
        this.cameraTarget = target;
        this.cameraOffset.copy(offset);
        this.lookAtTarget = lookAtPos;
        this.lerpSpeed = speed; // Permettre d'ajuster la vitesse du lerp
        this.isLerping = true;
        
        // Désactiver temporairement les contrôles pour la transition
        this.controls.enabled = false;
    }

    updateCamera() {
        // ── Mode Hublot (POV) : caméra collée au cockpit ──
        if (this.hublotTarget) {
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            this.hublotTarget.getWorldPosition(pos);
            this.hublotTarget.getWorldQuaternion(quat);

            // Offset local : légèrement vers le haut et l'avant du cockpit (échelle 0.03)
            const offset = new THREE.Vector3(0, 0.002, 0.006);
            offset.applyQuaternion(quat);
            this.camera.position.copy(pos).add(offset);

            // Regarder loin devant dans la direction de vol
            const forward = new THREE.Vector3(0, 0, 15);
            forward.applyQuaternion(quat);
            this.camera.lookAt(pos.clone().add(forward));

            this.updateLabelsLOD();
            this.updateMilestonesLOD();
            return;
        }

        const targetPos = new THREE.Vector3();
        const lookTarget = new THREE.Vector3();

        if (this.cameraTarget) {
            if (this.cameraTarget instanceof THREE.Object3D) {
                this.cameraTarget.getWorldPosition(targetPos);
            } else {
                targetPos.copy(this.cameraTarget);
            }
            lookTarget.copy(targetPos);
        } else if (this.lookAtTarget) {
            lookTarget.copy(this.lookAtTarget);
            targetPos.set(0, 0, 0); 
        }

        const lerpFactor = this.lerpSpeed || 0.05;

        if (!this.isLerping) {
            // Si on a une cible mais qu'on ne lerp plus, on suit la cible de manière instantanée
            if (this.cameraTarget) {
                // On met à jour le target des contrôles pour suivre la cible mouvante
                this.controls.target.copy(lookTarget);
                
                // On déplace la caméra pour maintenir l'offset par rapport à la cible
                const nextPos = lookTarget.clone().add(this.cameraOffset);
                this.camera.position.copy(nextPos);
            }
            this.controls.update();
            this.updateLabelsLOD();
            this.updateMilestonesLOD();
            return;
        }

        const desiredPos = targetPos.clone().add(this.cameraOffset);
        
        // Transition fluide (Lerp)
        this.camera.position.lerp(desiredPos, lerpFactor);
        
        // Initialisation du lookAtProxy si nécessaire pour éviter les sauts brusques
        if (!this.lookAtProxy) {
            this.lookAtProxy = new THREE.Vector3();
            this.camera.getWorldDirection(this.lookAtProxy);
            this.lookAtProxy.add(this.camera.position);
        }
        this.lookAtProxy.lerp(lookTarget, lerpFactor);
        this.camera.lookAt(this.lookAtProxy);
        this.controls.target.lerp(lookTarget, lerpFactor);

        // Désactiver l'interpolation si on est très proche
        if (this.camera.position.distanceTo(desiredPos) < 0.1 && this.lookAtProxy.distanceTo(lookTarget) < 0.1) {
            this.isLerping = false;
            this.controls.enabled = true;
            if (!this.cameraTarget) {
                this.lookAtTarget = null;
            }
        }

        this.updateLabelsLOD();
        this.updateMilestonesLOD();
    }

    updateLabelsLOD() {
        // LOD simple pour les labels CSS2D
        this.scene.traverse((obj) => {
            if (obj.isCSS2DObject) {
                const worldPos = new THREE.Vector3();
                obj.getWorldPosition(worldPos);
                const dist = this.camera.position.distanceTo(worldPos);
                // Si on est trop loin, on cache les labels
                obj.visible = dist < 400;
            }
        });
    }

    updateMilestonesLOD() {
        // Ajuster la taille des milestones selon le zoom
        this.scene.traverse((obj) => {
            if (obj.userData && obj.userData.isMilestone) {
                const worldPos = new THREE.Vector3();
                obj.getWorldPosition(worldPos);
                const dist = this.camera.position.distanceTo(worldPos);
                
                // Calculer une échelle proportionnelle à la distance
                // On veut qu'il ne soit pas trop gros quand on est proche
                // Taille de base 1 à une distance de 100
                let scale = dist / 100;
                
                // Limiter l'échelle pour qu'il ne disparaisse pas complètement 
                // et qu'il ne devienne pas géant
                scale = Math.max(0.1, Math.min(1.5, scale));
                
                obj.scale.set(scale, scale, scale);
                
                // Optionnel : On peut aussi jouer sur l'opacité si c'est un MeshBasicMaterial
                if (obj.material) {
                    obj.material.opacity = Math.min(0.6, scale * 0.6);
                }
            }
        });
    }

    addStars() {
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({ 
            color: 0xdddddd, // Etoiles légèrement moins brillantes de base
            size: 0.08, // Taille réduite
            transparent: true,
            opacity: 0.08 // Opacité de base réduite (avant 0.1)
        });

        const starVertices = [];
        const starColors = [];
        const color = new THREE.Color();

        for (let i = 0; i < 8000; i++) { // Réduits (au lieu de 30000) pour accentuer l'orbite orion
            // Sphère géante pour une répartition uniforme
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos(2 * Math.random() - 1);
            const radius = 35000 + Math.random() * 10000;

            const x = radius * Math.sin(theta) * Math.cos(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(theta);
            
            starVertices.push(x, y, z);
            
            // Légères variations de couleur (bleuté, blanc, jaunâtre)
            const r = 0.8 + Math.random() * 0.2;
            const g = 0.8 + Math.random() * 0.2;
            const b = 0.9 + Math.random() * 0.1;
            starColors.push(r, g, b);
        }

        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
        
        // Utilisation des couleurs d'attributs
        starMaterial.vertexColors = true;

        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }

    toggleStars(visible) {
        if (this.stars) this.stars.visible = visible;
    }

    toggleGrid(visible) {
        if (this.grid) this.grid.visible = visible;
    }

    updateExposure() {
        if (this.introActive) return; // Ne pas toucher à l'opacité des étoiles pendant l'intro
        if (!this.stars || !this.stars.material || !this.sunPos) return;

        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);

        const sunDir = this.sunPos.clone().sub(this.camera.position).normalize();
        const dot = camDir.dot(sunDir);

        // Opacité normale de base des étoiles
        let targetOpacity = 0.08;

        // Simulation de l'éblouissement caméra/œil quand on regarde vers le Soleil
        if (dot > 0.3) {
            // Plus on regarde vers le centre du Soleil (dot = 1), plus les étoiles disparaissent
            const glare = Math.min((dot - 0.3) / 0.7, 1.0);
            targetOpacity = 0.08 * (1 - glare * 0.95); // Disparaissent quasi totalement
        }

        if (this.currentStarOpacity === undefined) this.currentStarOpacity = 0.08;

        // Transition douce (lerp) pour simuler l'adaptation de l'iris / temps d'exposition
        this.currentStarOpacity += (targetOpacity - this.currentStarOpacity) * 0.05;
        this.stars.material.opacity = this.currentStarOpacity;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
    }

    render(callback) {
        if (!this.animationId) {
            const loop = () => {
                this.animationId = requestAnimationFrame(loop);
                if (this.currentCallback) this.currentCallback();
                this.updateCamera();
                this.updateExposure();
                this.composer.render();
                this.labelRenderer.render(this.scene, this.camera);
            };
            this.animationId = requestAnimationFrame(loop);
        }
        this.currentCallback = callback;
    }

    takeScreenshot() {
        // Un rendu synchrone pour capturer l'image actuelle sans relancer de boucle
        this.updateCamera();
        this.composer.render();
        this.labelRenderer.render(this.scene, this.camera);
        
        const dataURL = this.renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'artemis2-mission.png';
        link.href = dataURL;
        link.click();
    }

    add(object) {
        this.scene.add(object);
    }
}
