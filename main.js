import './style.css';
import * as THREE from 'three';
import { SceneManager } from './src/core/SceneManager.js';
import { CelestialBody } from './src/objects/CelestialBody.js';
import { TrajectoryManager } from './src/objects/TrajectoryManager.js';
import { Spacecraft } from './src/objects/Spacecraft.js';
import Stats from 'stats.js';

const appContainer = document.querySelector('#app');
const sceneManager = new SceneManager(appContainer);

// Stats.js
const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);
stats.dom.style.top = 'auto';
stats.dom.style.bottom = '10px';
stats.dom.style.left = '10px';

// Initialisation des corps célestes
const earth = new CelestialBody(CelestialBody.CONSTANTS.EARTH_RADIUS, null, 'Earth');
earth.toggleVanAllen(false); // Désactivé par défaut
sceneManager.add(earth.getMesh());

// Ajouter l'orbite terrestre à la scène (elle est autour du Soleil à 0,0,0)
sceneManager.add(earth.earthOrbitLine);

const moon = new CelestialBody(CelestialBody.CONSTANTS.MOON_RADIUS, null, 'Moon');
moon.currentDist = CelestialBody.CONSTANTS.EARTH_MOON_DIST; // Respecter l'échelle réelle
const moonMesh = moon.getMesh();
// Position initiale de la Lune (sera mise à jour dans la boucle)
sceneManager.add(moonMesh);

// Initialisation du Soleil au centre
const sun = new CelestialBody(CelestialBody.CONSTANTS.SUN_RADIUS, null, 'Sun');
const sunMesh = sun.getMesh();
sunMesh.position.set(0, 0, 0); // Le Soleil est au centre du système solaire
sceneManager.add(sunMesh);

// Mettre à jour la position de la lumière pour qu'elle vienne du Soleil (0,0,0)
sceneManager.sunPos.set(0, 0, 0);
sceneManager.sunLight.position.set(0, 0, 0);
sceneManager.sunLight.target = earth.getMesh(); // La lumière pointe vers la Terre

// Ligne d'orbite lunaire (activée par défaut)
const moonOrbitLine = moon.createOrbitLine();
moonOrbitLine.visible = true;
sceneManager.add(moonOrbitLine);

// Hotspots sur la Lune
const createHotspot = (pos, data) => {
    const geo = new THREE.SphereGeometry(0.5, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData = { ...data, isHotspot: true };
    if (moonMesh) moonMesh.add(mesh);
};

createHotspot(new THREE.Vector3(0, -1.5, 0), { 
    title: 'Cratère Shackleton', 
    desc: 'Le Pôle Sud lunaire contient de la glace d\'eau dans ses cratères éternellement ombragés, une ressource vitale.' 
});

createHotspot(new THREE.Vector3(0.5, 1, 1), { 
    title: 'Mer de la Tranquillité', 
    desc: 'Site d\'alunissage d\'Apollo 11 (1969). Un lieu historique que les astronautes d\'Artemis 2 survoleront.' 
});

// Trajectoire (doit être attachée à la Terre car elle est mobile)
const trajectoryManager = new TrajectoryManager();
trajectoryManager.updateCurve(CelestialBody.CONSTANTS.EARTH_MOON_DIST);
trajectoryManager.drawTrajectory(earth.getMesh());

// Capsule Orion (doit être attachée à la Terre)
const orion = new Spacecraft('Orion');
earth.getMesh().add(orion.getMesh());

// Variable pour stocker la position mondiale suivante pour lookAt
const nextPosWorld = new THREE.Vector3();

// Positionner la caméra loin pour le travelling de départ (vue large du système solaire)
sceneManager.camera.position.set(2000, 1000, 5000);
sceneManager.camera.lookAt(0, 0, 0);

// Ajustement caméra initiale (Travelling vers Orion) après un court délai pour laisser le temps au rendu de démarrer
setTimeout(() => {
    // Premier passage : On se rapproche de la Terre
    sceneManager.setCameraTarget(earth.getMesh(), new THREE.Vector3(500, 200, 500), null, 0.02);
    
    // Deuxième passage : On fonce vers Orion après 3 secondes
    setTimeout(() => {
        sceneManager.setCameraTarget(orion.getMesh(), new THREE.Vector3(5, 2, 5), null, 0.05);
    }, 3000);
}, 1000);

// Audio par défaut (Tentative immédiate et fallback)
const startAudio = () => {
    sceneManager.toggleMusic(true);
    sceneManager.setVolume(0.3);
};

// Tentative immédiate au chargement
startAudio();

// Fallback sur interaction pour les restrictions d'autoplay
const initAudioOnInteraction = () => {
    startAudio();
    window.removeEventListener('click', initAudioOnInteraction);
    window.removeEventListener('keydown', initAudioOnInteraction);
    window.removeEventListener('touchstart', initAudioOnInteraction);
    window.removeEventListener('mousedown', initAudioOnInteraction);
};
window.addEventListener('click', initAudioOnInteraction);
window.addEventListener('keydown', initAudioOnInteraction);
window.addEventListener('touchstart', initAudioOnInteraction);
window.addEventListener('mousedown', initAudioOnInteraction);

// UI Elements
const slider = document.getElementById('timeline-slider');
const missionDay = document.getElementById('mission-day');
const distanceInfo = document.getElementById('distance-info');
const speedInfo = document.getElementById('speed-info');
const tempInfo = document.getElementById('temp-info');
const signalDelay = document.getElementById('signal-delay');
const liveBtn = document.getElementById('live-btn');
const toast = document.getElementById('milestone-toast');
const toastText = document.getElementById('milestone-text');
const vanAllenAlert = document.getElementById('van-allen-alert');

const snapBtn = document.getElementById('snap-btn');
const toggleForcesBtn = document.getElementById('toggle-forces');
const toggleStarsBtn = document.getElementById('toggle-stars');
const toggleGridBtn = document.getElementById('toggle-grid');
const toggleVanAllenBtn = document.getElementById('toggle-van-allen');
const toggleOrbitBtn = document.getElementById('toggle-orbit');
const toggleVideoBtn = document.getElementById('toggle-video');
const toggleAudioBtn = document.getElementById('toggle-audio');
const volumeSlider = document.getElementById('volume-slider');
const volValue = document.getElementById('vol-value');

// Désactiver la grille visuellement dans l'UI par défaut
toggleGridBtn.innerText = 'Grille: OFF';
toggleVanAllenBtn.innerText = 'Belts: OFF';
toggleVideoBtn.innerText = '📺 Vidéo: ON';

const modal = document.getElementById('hotspot-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const closeModal = document.getElementById('close-modal');
const videoPanel = document.getElementById('video-panel');
const hideVideoBtn = document.getElementById('hide-video');
const pullTab = document.getElementById('video-pull-tab');
const ytPlayer = document.getElementById('yt-player');

let isVideoHidden = false;
let isVideoEnabled = true; // Activé par défaut

const updateVideoState = () => {
    if (isVideoEnabled) {
        videoPanel.classList.remove('hidden');
        toggleVideoBtn.innerText = '📺 Vidéo: ON';
        toggleVideoBtn.classList.add('bg-green-600/20', 'text-green-300', 'border-green-500/30');
        toggleVideoBtn.classList.remove('bg-red-600/20', 'text-red-300', 'border-red-500/30');
    } else {
        videoPanel.classList.add('hidden');
        toggleVideoBtn.innerText = '📺 Vidéo: OFF';
        toggleVideoBtn.classList.remove('bg-green-600/20', 'text-green-300', 'border-green-500/30');
        toggleVideoBtn.classList.add('bg-red-600/20', 'text-red-300', 'border-red-500/30');
        // On arrête la vidéo en rechargeant l'iframe
        const currentSrc = ytPlayer.src;
        ytPlayer.src = '';
        ytPlayer.src = currentSrc;
    }
};

// Video Panel Toggle
toggleVideoBtn.addEventListener('click', () => {
    isVideoEnabled = !isVideoEnabled;
    updateVideoState();
    sceneManager.playBip();
});

hideVideoBtn.addEventListener('click', () => {
    isVideoHidden = true;
    videoPanel.style.transform = 'translateY(-50%) translateX(calc(-100% + 32px))';
    pullTab.classList.remove('hidden');
    pullTab.classList.add('flex');
    hideVideoBtn.classList.add('hidden');
    sceneManager.playBip();
});

pullTab.addEventListener('click', () => {
    isVideoHidden = false;
    videoPanel.style.transform = 'translateY(-50%) translateX(0)';
    pullTab.classList.add('hidden');
    pullTab.classList.remove('flex');
    hideVideoBtn.classList.remove('hidden');
    sceneManager.playBip();
});

// Initialiser l'état au démarrage
updateVideoState();

// Camera UI
const camSystem = document.getElementById('cam-system');
const camOrion = document.getElementById('cam-orion');
const camHublot = document.getElementById('cam-hublot');
const camMoon = document.getElementById('cam-moon');
const hublotOverlay = document.getElementById('hublot-overlay');

const bioHeart = document.getElementById('bio-heart');
const bioO2 = document.getElementById('bio-o2');
const bioRad = document.getElementById('bio-rad');

let isLive = true;
let showForces = false;
let isRealScale = false; // Gardé pour la logique interne si nécessaire
const LAUNCH_DATE = new Date('2026-04-01T15:00:00Z');
const MISSION_DURATION_MS = 10 * 24 * 60 * 60 * 1000;

const updateMissionLogic = (percent) => {
    if (!trajectoryManager || !orion || !earth || !moonMesh) return;
    const pos = trajectoryManager.getPositionAt(percent);
    const nextT = Math.min(1, percent + 0.005);
    const nextPosLocal = trajectoryManager.getPositionAt(nextT);
    
    // Convertir en coord mondiales pour le lookAt de la capsule
    earth.getMesh().localToWorld(nextPosWorld.copy(nextPosLocal));
    
    // Intensité propulsion (plus forte aux milestones)
    const milestone = trajectoryManager.getMilestoneAt(percent);
    
    // Intensité du moteur : seulement au décollage (t < 0.05) et Injection Trans-Lunaire
    let engineIntensity = 0;
    if (percent < 0.05) {
        engineIntensity = 1.0; // Décollage
    } else if (milestone && milestone.name === 'Injection Trans-Lunaire') {
        engineIntensity = 1.5; // TLI
    } else if (milestone) {
        engineIntensity = 0.3; // Autres milestones (léger feedback visuel)
    }
    
    orion.updatePosition(pos, nextPosWorld, engineIntensity);
    orion.updateForces(earth.getMesh().position, moonMesh.position, showForces);

    // Mise à jour UI : Mission de 10 jours
    const totalDays = 10;
    const currentDay = (percent * totalDays).toFixed(1);
    missionDay.innerText = `Jour ${currentDay} / ${totalDays}`;

    // Télémétrie réaliste (conversion local -> world pour distances)
    const posWorld = new THREE.Vector3();
    earth.getMesh().localToWorld(posWorld.copy(pos));
    
    const distUnits = pos.length(); // Distance à la Terre (car pos est local à la Terre)
    const distToMoonUnits = posWorld.distanceTo(moonMesh.position);
    
    // Échelle : 1 unité = 1274 km (Rayon Terre 5 = 6370 km)
    const distKm = Math.floor(distUnits * 1274);
    distanceInfo.innerText = `${distKm.toLocaleString()} km`;

    // Vitesse (Kepler : plus lent loin de la Terre/Lune)
    const speedFactor = 1 / (0.1 + (distUnits / 100) * (distToMoonUnits / 100));
    const speedKmH = Math.floor(15000 + speedFactor * 20000);
    speedInfo.innerText = `${speedKmH.toLocaleString()} km/h`;

    // Signal Delay (vitesse de la lumière : 300 000 km/s)
    const totalDistKm = Math.floor(posWorld.distanceTo(new THREE.Vector3(0,0,0)) * 1274); // Distance au Soleil ou juste distance Terre-Vaisseau pour le delay?
    // Habituellement on parle du délai Terre-Vaisseau
    const delay = (distKm / 300000).toFixed(3);
    signalDelay.innerText = `${delay}s delay`;

    // Bio-données simulées
    const heartBase = 65 + Math.sin(percent * 50) * 5;
    const heartVal = milestone ? heartBase + 20 : heartBase;
    bioHeart.innerText = `${Math.floor(heartVal)} BPM`;
    bioO2.innerText = `${(98 - percent * 2).toFixed(1)}%`;
    
    // Radiations (Van Allen) — traversée pendant la phase orbitale HEO
    const isInVanAllen = percent > 0.01 && percent < 0.13;
    const radVal = isInVanAllen ? (0.5 + Math.random() * 2) : (0.05 + Math.random() * 0.02);
    bioRad.innerText = `${radVal.toFixed(2)} mSv/h`;

    // Milestones
    if (milestone) {
        if (toast.classList.contains('hidden')) sceneManager.playBip();
        toast.classList.remove('hidden');
        toast.classList.add('flex'); // Pour le layout flex du nouveau toast
        toastText.innerText = `${milestone.name} : ${milestone.desc}`;
    } else {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
    }

    // Van Allen Alert (traversée des ceintures pendant la phase HEO)
    if (percent > 0.01 && percent < 0.13) {
        vanAllenAlert.classList.remove('hidden');
    } else {
        vanAllenAlert.classList.add('hidden');
    }
};

// Gestion des forces et de l'échelle
toggleForcesBtn.addEventListener('click', () => {
    showForces = !showForces;
    toggleForcesBtn.innerText = `Forces Gravitationnelles: ${showForces ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

toggleStarsBtn.addEventListener('click', () => {
    const isVisible = toggleStarsBtn.innerText.includes('OFF');
    sceneManager.toggleStars(isVisible);
    toggleStarsBtn.innerText = `Étoiles: ${isVisible ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

toggleGridBtn.addEventListener('click', () => {
    const isVisible = toggleGridBtn.innerText.includes('OFF');
    sceneManager.toggleGrid(isVisible);
    toggleGridBtn.innerText = `Grille: ${isVisible ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

toggleVanAllenBtn.addEventListener('click', () => {
    const isVisible = toggleVanAllenBtn.innerText.includes('OFF');
    earth.toggleVanAllen(isVisible);
    toggleVanAllenBtn.innerText = `Belts: ${isVisible ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

toggleOrbitBtn.addEventListener('click', () => {
    const isVisible = toggleOrbitBtn.innerText.includes('OFF');
    moonOrbitLine.visible = isVisible;
    toggleOrbitBtn.innerText = `Orbite: ${isVisible ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

toggleAudioBtn.addEventListener('click', () => {
    const isEnabled = toggleAudioBtn.innerText.includes('OFF');
    sceneManager.toggleMusic(isEnabled);
    toggleAudioBtn.innerText = `🎵 Audio: ${isEnabled ? 'ON' : 'OFF'}`;
    sceneManager.playBip();
});

volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value;
    volValue.innerText = `${vol}%`;
    sceneManager.setVolume(vol / 100);
});

// Gestion de la caméra
camOrion.addEventListener('click', () => {
    hublotOverlay.classList.add('hidden');
    sceneManager.setCameraTarget(orion.getMesh(), new THREE.Vector3(5, 2, 5));
});

camHublot.addEventListener('click', () => {
    sceneManager.playBip();
    hublotOverlay.classList.remove('hidden');
    // Vue interne : la caméra est à l'intérieur du mesh, on regarde vers l'avant (nextPosition)
    sceneManager.setCameraTarget(orion.getMesh(), new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0, 0, 10));
});

camMoon.addEventListener('click', () => {
    sceneManager.playBip();
    hublotOverlay.classList.add('hidden');
    sceneManager.setCameraTarget(moonMesh, new THREE.Vector3(15, 5, 15));
});

camSystem.addEventListener('click', () => {
    // Vue globale du système (Terre au centre pour la caméra)
    hublotOverlay.classList.add('hidden');
    sceneManager.setCameraTarget(earth.getMesh(), new THREE.Vector3(200, 100, 500));
});

// Capture et Hotspots
snapBtn.addEventListener('click', () => {
    sceneManager.takeScreenshot();
});

sceneManager.onHotspotClick = (data) => {
    sceneManager.playBip();
    modalTitle.innerText = data.title;
    modalDesc.innerText = data.desc;
    modal.classList.remove('hidden');
};

closeModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

const handleLiveUpdate = () => {
    if (!isLive) return;

    const now = new Date();
    const elapsed = now - LAUNCH_DATE;
    
    if (elapsed < 0) {
        updateMissionLogic(0);
        missionDay.innerText = "En attente du lancement...";
        return;
    }

    const progress = Math.min(1, elapsed / MISSION_DURATION_MS);
    updateMissionLogic(progress);
    slider.value = progress * 100;

    if (progress >= 1) {
        isLive = false;
        liveBtn.classList.remove('bg-red-600', 'animate-pulse');
        liveBtn.classList.add('bg-gray-600');
        liveBtn.innerText = "TERMINÉ";
    }
};

slider.addEventListener('input', (e) => {
    isLive = false;
    liveBtn.classList.remove('bg-red-600', 'animate-pulse');
    liveBtn.classList.add('bg-gray-600');
    
    const value = e.target.value / 100;
    updateMissionLogic(value);
});

liveBtn.addEventListener('click', () => {
    isLive = true;
    liveBtn.classList.add('bg-red-600', 'animate-pulse');
    liveBtn.classList.remove('bg-gray-600');
    liveBtn.innerText = "LIVE";
});

// Initialisation de la timeline avec marqueurs
const initTimelineMarkers = () => {
    const markersContainer = document.getElementById('timeline-markers');
    if (!markersContainer || !trajectoryManager) return;

    markersContainer.innerHTML = ''; // Nettoyer les anciens marqueurs

    trajectoryManager.milestones.forEach(m => {
        const marker = document.createElement('div');
        marker.className = 'absolute w-px h-full flex flex-col items-center justify-center group cursor-help transition-all';
        marker.style.left = `${m.t * 100}%`;
        
        // La ligne visuelle (petite barre)
        const line = document.createElement('div');
        line.className = 'w-px h-2 bg-blue-400/50 group-hover:bg-blue-300 transition-colors z-20';
        
        // Un petit point au milieu de la ligne pour marquer l'intersection avec le slider
        const dot = document.createElement('div');
        dot.className = 'w-1.5 h-1.5 rounded-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity absolute -translate-y-1/2 top-1/2';

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/80 text-[7px] text-white px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-tighter z-30 shadow-lg';
        tooltip.textContent = m.name;
        
        marker.appendChild(line);
        marker.appendChild(dot);
        marker.appendChild(tooltip);
        markersContainer.appendChild(marker);
    });
};

initTimelineMarkers();

// Boucle de rendu
sceneManager.render(() => {
    stats.begin();
    
    // Calcul de la progression actuelle pour les mises à jour
    const currentPercent = slider.value / 100;
    
    // Mettre à jour la trajectoire en fonction de la distance actuelle de la lune (si elle change)
    if (trajectoryManager && moon) {
        trajectoryManager.updateCurve(moon.currentDist);
    }

    if (earth) earth.update(null, currentPercent);
    if (moon && earth) {
        moon.update(earth.getMesh(), currentPercent);
        moon.updateOrbitLine(earth.getMesh());
    }
    
    // Éclairage astronomique : Le Soleil est au centre (0,0,0)
    // On peut quand même faire varier légèrement la hauteur de la lumière si besoin
    sceneManager.sunLight.position.set(0, 0, 0);
    sceneManager.sunLight.target = earth.getMesh();

    handleLiveUpdate();
    stats.end();
});

console.log('Artemis 2 Mission Visualization Initialized - Phase 6 Final');
