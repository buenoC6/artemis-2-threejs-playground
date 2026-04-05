import "./style.css";
import * as THREE from "three";
import { SceneManager } from "./src/core/SceneManager.js";
import { TelemetryService } from "./src/core/TelemetryService.js";
import { CelestialBody } from "./src/objects/CelestialBody.js";
import { TrajectoryManager } from "./src/objects/TrajectoryManager.js";
import { Spacecraft } from "./src/objects/Spacecraft.js";
import * as TWEEN from "@tweenjs/tween.js";
import Stats from "stats.js";

const appContainer = document.querySelector("#app");
const sceneManager = new SceneManager(appContainer);

// Groupe TWEEN global (requis en v25 — les tweens ne s'enregistrent plus automatiquement)
const tweenGroup = new TWEEN.Group();

// Stats.js (dev only)
const stats = new Stats();
if (import.meta.env.DEV) {
  stats.showPanel(0);
  document.body.appendChild(stats.dom);
  stats.dom.style.top = "auto";
  stats.dom.style.bottom = "10px";
  stats.dom.style.left = "10px";
}

// Constantes de temps et progression initiale
const LAUNCH_DATE = new Date("2026-04-01T15:00:00Z");
const MISSION_DURATION_MS = 10 * 24 * 60 * 60 * 1000;
const telemetryService = new TelemetryService({ missionStartDate: LAUNCH_DATE });
telemetryService.start();

const nowInit = new Date();
const elapsedInit = nowInit - LAUNCH_DATE;
let startProgress = 0;
if (elapsedInit > 0) {
  startProgress = Math.min(1, elapsedInit / MISSION_DURATION_MS);
}

// Initialisation des corps célestes
const earth = new CelestialBody(
  CelestialBody.CONSTANTS.EARTH_RADIUS,
  null,
  "Earth",
);
earth.toggleVanAllen(false); // Désactivé par défaut
sceneManager.add(earth.getMesh());



const moon = new CelestialBody(
  CelestialBody.CONSTANTS.MOON_RADIUS,
  null,
  "Moon",
);
moon.currentDist = CelestialBody.CONSTANTS.EARTH_MOON_DIST; // Respecter l'échelle réelle
const moonMesh = moon.getMesh();
// Position initiale de la Lune (sera mise à jour dans la boucle)
sceneManager.add(moonMesh);

// Initialisation du Soleil au centre
const sun = new CelestialBody(CelestialBody.CONSTANTS.SUN_RADIUS, null, "Sun");
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
  const mat = new THREE.MeshBasicMaterial({
    color: 0x887744,
    transparent: true,
    opacity: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  mesh.userData = { ...data, isHotspot: true };
  if (moonMesh) moonMesh.add(mesh);
};

createHotspot(new THREE.Vector3(0, -1.5, 0), {
  title: "Cratère Shackleton",
  desc: "Le Pôle Sud lunaire contient de la glace d'eau dans ses cratères éternellement ombragés, une ressource vitale.",
});

createHotspot(new THREE.Vector3(0.5, 1, 1), {
  title: "Mer de la Tranquillité",
  desc: "Site d'alunissage d'Apollo 11 (1969). Un lieu historique que les astronautes d'Artemis 2 survoleront.",
});

// Trajectoire (doit être attachée à la Terre car elle est mobile)
const trajectoryManager = new TrajectoryManager();
trajectoryManager.updateCurve(CelestialBody.CONSTANTS.EARTH_MOON_DIST);
trajectoryManager.drawTrajectory(earth.getMesh());

// Capsule Orion (doit être attachée à la Terre)
const orion = new Spacecraft("Orion");
orion.getMesh().scale.setScalar(0.03); // Échelle réaliste par rapport aux corps célestes
orion.createHotspots(); // Active les hotspots pédagogiques 3D
earth.getMesh().add(orion.getMesh());

// === SÉQUENCE D'INTRODUCTION NARRATIVE ===

// Désactiver le suivi caméra automatique pour l'intro
sceneManager.cameraTarget = null;
sceneManager.lookAtTarget = null;
sceneManager.introActive = true;

// Empêcher OrbitControls d'écraser la caméra pendant les Tweens
const originalUpdate = sceneManager.controls.update;
sceneManager.controls.update = function () {
  if (this.enabled) originalUpdate.call(this);
};
sceneManager.controls.enabled = false;

// Pré-calculer les positions
earth.update(null, startProgress);

// Cacher TOUT au départ — fond noir avec seulement le texte 3D
sunMesh.visible = false;
if (sun.glow) sun.glow.visible = false;
earth.getMesh().visible = false;
moonMesh.visible = false;
moonOrbitLine.visible = false;

// --- Créer le texte "LOADING MISSION." en tant que Sprite 3D ---
const createTextSprite = (text) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 1024, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(40, 5, 1);
  return sprite;
};

// Créer un sprite pour le point "."
const createDotSprite = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(64, 64, 20, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 2, 1);
  return sprite;
};

// Placer texte et point sur l'axe Z devant la caméra
const introTextSprite = createTextSprite("LOADING MISSION");
introTextSprite.position.set(0, 0, 7950); // Juste devant la caméra
sceneManager.scene.add(introTextSprite);

const introDotSprite = createDotSprite();
introDotSprite.position.set(0, 0, 0); // Au centre de la scène = position du Soleil
sceneManager.scene.add(introDotSprite);

// Caméra loin, regardant vers l'origine (le point et le Soleil)
const introStartPos = new THREE.Vector3(0, 0, 8000);
const introSunNearPos = new THREE.Vector3(0, 30, 2000);
const sunCenter = new THREE.Vector3(0, 0, 0);

sceneManager.camera.position.copy(introStartPos);
sceneManager.camera.lookAt(sunCenter);

// Étoiles et bloom
sceneManager.stars.material.opacity = 0;
sceneManager.bloomPass.strength = 0;

const introLookAt = new THREE.Vector3();

// L'overlay HTML n'existe plus — tout est en 3D

// --- Phase 1 : Texte visible 1.5s, puis fade-out du texte ---
setTimeout(() => {
  // Fade-out du texte "LOADING MISSION" (le sprite)
  new TWEEN.Tween(introTextSprite.material, tweenGroup)
    .to({ opacity: 0 }, 800)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      sceneManager.scene.remove(introTextSprite);
      introTextSprite.material.map.dispose();
      introTextSprite.material.dispose();
    })
    .start();

  // --- Phase 2 : Zoom vers le point/Soleil (après 500ms) ---
  setTimeout(() => {
    // Le point "." est à (0,0,0), la caméra fonce dessus
    new TWEEN.Tween({ t: 0 }, tweenGroup)
      .to({ t: 1 }, 3000)
      .easing(TWEEN.Easing.Cubic.InOut)
      .onUpdate((obj) => {
        sceneManager.camera.position.lerpVectors(
          introStartPos,
          introSunNearPos,
          obj.t,
        );
        sceneManager.camera.lookAt(sunCenter);

        // À 40% du zoom, remplacer le point par le Soleil et révéler la scène
        if (obj.t > 0.4 && !sunMesh.visible) {
          sunMesh.visible = true;
          if (sun.glow) sun.glow.visible = true;
          earth.getMesh().visible = true;
          moonMesh.visible = true;
          moonOrbitLine.visible = true;
          // Fade-out du point
          new TWEEN.Tween(introDotSprite.material, tweenGroup)
            .to({ opacity: 0 }, 600)
            .onComplete(() => {
              sceneManager.scene.remove(introDotSprite);
              introDotSprite.material.map.dispose();
              introDotSprite.material.dispose();
            })
            .start();
        }
      })
      .onComplete(() => {
        // --- Phase 3 : Travelling Soleil → Orion ---
        const travelStartPos = sceneManager.camera.position.clone();
        const travelStartLook = sunCenter.clone();
        const targetCamOffset = new THREE.Vector3(0.15, 0.08, 0.15);

        new TWEEN.Tween({ t: 0 }, tweenGroup)
          .to({ t: 1 }, 4000)
          .easing(TWEEN.Easing.Quartic.InOut)
          .onUpdate((obj) => {
            const currentOrionPos = new THREE.Vector3();
            orion.getMesh().getWorldPosition(currentOrionPos);
            const currentCamTarget = currentOrionPos
              .clone()
              .add(targetCamOffset);

            sceneManager.camera.position.lerpVectors(
              travelStartPos,
              currentCamTarget,
              obj.t,
            );

            introLookAt.lerpVectors(travelStartLook, currentOrionPos, obj.t);
            sceneManager.camera.lookAt(introLookAt);
          })
          .onComplete(() => {
            // --- Phase 4 : HUD Reveal ---
            const uiLayer = document.getElementById("ui-layer");
            const leftDrawer = document.getElementById("left-drawer");
            const rightDrawer = document.getElementById("right-drawer");

            if (uiLayer) uiLayer.classList.remove("opacity-0");
            // Sur desktop : retirer le décalage initial ET forcer translate-x-0
            // Sur mobile, ils restent contrôlés par les checkboxes CSS
            if (leftDrawer) {
              leftDrawer.classList.remove("md:-translate-x-[150%]");
              leftDrawer.classList.add("md:translate-x-0");
            }
            if (rightDrawer) {
              rightDrawer.classList.remove("md:translate-x-[150%]");
              rightDrawer.classList.add("md:translate-x-0");
            }

            sceneManager.controls.enabled = true;
            const finalOrionPos = new THREE.Vector3();
            orion.getMesh().getWorldPosition(finalOrionPos);
            sceneManager.controls.target.copy(finalOrionPos);
            sceneManager.setCameraTarget(orion.getMesh(), targetCamOffset);
            sceneManager.introActive = false;
          })
          .start();

        // Bloom vers valeur nominale adoucie
        new TWEEN.Tween(sceneManager.bloomPass, tweenGroup)
          .to({ strength: 0.85 }, 4000)
          .easing(TWEEN.Easing.Quadratic.Out)
          .start();
      })
      .start();

    // Fade-in étoiles
    new TWEEN.Tween(sceneManager.stars.material, tweenGroup)
      .to({ opacity: 0.08 }, 3000)
      .easing(TWEEN.Easing.Quadratic.InOut)
      .start();

    // Bloom 0 -> 1.2 pendant le zoom (present mais moins agressif)
    new TWEEN.Tween(sceneManager.bloomPass, tweenGroup)
      .to({ strength: 1.2 }, 3000)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
  }, 500);
}, 1500);

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
  window.removeEventListener("click", initAudioOnInteraction);
  window.removeEventListener("keydown", initAudioOnInteraction);
  window.removeEventListener("touchstart", initAudioOnInteraction);
  window.removeEventListener("mousedown", initAudioOnInteraction);
};
window.addEventListener("click", initAudioOnInteraction);
window.addEventListener("keydown", initAudioOnInteraction);
window.addEventListener("touchstart", initAudioOnInteraction);
window.addEventListener("mousedown", initAudioOnInteraction);

window.addEventListener("beforeunload", () => {
  telemetryService.stop();
});

// NOUVEAU: Chatter Radio NASA aléatoire
const playRadioChatter = () => {
  if (!isLive) return; // Uniquement pendant la simu active
  // Chatter uniquement en Hublot ou Orion Close
  if (sceneManager.cameraTarget !== orion.getMesh() && !sceneManager.hublotTarget) return;
  sceneManager.playBip(2000, 0.02); // Petit bip
  setTimeout(() => sceneManager.playBip(2200, 0.02), 100);
};

// UI Elements
const slider = document.getElementById("timeline-slider");
const missionDay = document.getElementById("mission-day");
const distanceInfo = document.getElementById("distance-info");
const distanceMoonInfo = document.getElementById("distance-moon-info");
const speedInfo = document.getElementById("speed-info");
const tempInfo = document.getElementById("temp-info");
const signalDelay = document.getElementById("signal-delay");
const liveBtn = document.getElementById("live-btn");
const toast = document.getElementById("milestone-toast");
const toastText = document.getElementById("milestone-text");
const vanAllenAlert = document.getElementById("van-allen-alert");

const snapBtn = document.getElementById("snap-btn");
const toggleForcesBtn = document.getElementById("toggle-forces");
const toggleStarsBtn = document.getElementById("toggle-stars");
const toggleGridBtn = document.getElementById("toggle-grid");
const toggleVanAllenBtn = document.getElementById("toggle-van-allen");
const toggleOrbitBtn = document.getElementById("toggle-orbit");
const toggleAudioBtn = document.getElementById("toggle-audio");
const volumeSlider = document.getElementById("volume-slider");
const volValue = document.getElementById("vol-value");

// Désactiver la grille visuellement dans l'UI par défaut
toggleGridBtn.innerText = "Grille: OFF";
toggleVanAllenBtn.innerText = "Belts: OFF";

const modal = document.getElementById("hotspot-modal");
const modalTitle = document.getElementById("modal-title");
const modalDesc = document.getElementById("modal-desc");
const closeModal = document.getElementById("close-modal");

// Camera UI
const camSystem = document.getElementById("cam-system");
const camOrion = document.getElementById("cam-orion");
const camHublot = document.getElementById("cam-hublot");
const camMoon = document.getElementById("cam-moon");
const hublotOverlay = document.getElementById("hublot-overlay");

const bioHeart = document.getElementById("bio-heart");
const bioO2 = document.getElementById("bio-o2");
const bioRad = document.getElementById("bio-rad");

let isLive = true;
let showForces = false;

let currentProgress = 0;
let targetProgress = 0;
let shipTween = null;

const KM_PER_SCENE_UNIT = 1274;
const LIGHT_SPEED_KM_S = 299792.458;

const getMissionPhaseTargetSpeed = (percent) => {
  if (percent < 0.05) return THREE.MathUtils.lerp(18000, 28500, percent / 0.05);
  if (percent < 0.12) return THREE.MathUtils.lerp(28500, 39500, (percent - 0.05) / 0.07);
  if (percent < 0.5) return THREE.MathUtils.lerp(39500, 9000, (percent - 0.12) / 0.38);
  if (percent < 0.9) return THREE.MathUtils.lerp(9000, 17000, (percent - 0.5) / 0.4);
  if (percent < 0.97) return THREE.MathUtils.lerp(17000, 26000, (percent - 0.9) / 0.07);
  return THREE.MathUtils.lerp(26000, 39000, (percent - 0.97) / 0.03);
};

const getLocalSpeedSampleKmH = (percent, dp) => {
  const p0 = Math.max(0, percent - dp);
  const p1 = Math.min(1, percent + dp);
  const a = trajectoryManager.curve.getPointAt(p0);
  const b = trajectoryManager.curve.getPointAt(p1);
  const travelKm = a.distanceTo(b) * KM_PER_SCENE_UNIT;
  const deltaHours = Math.max(0.001, (p1 - p0) * (MISSION_DURATION_MS / 3600000));
  return travelKm / deltaHours;
};

const estimateSpeedFromTimeline = (percent) => {
  const s1 = getLocalSpeedSampleKmH(percent, 0.0015);
  const s2 = getLocalSpeedSampleKmH(percent, 0.0035);
  const s3 = getLocalSpeedSampleKmH(percent, 0.007);
  const derivativeSpeed = s1 * 0.55 + s2 * 0.3 + s3 * 0.15;

  const phaseTarget = getMissionPhaseTargetSpeed(percent);
  const blended = THREE.MathUtils.lerp(derivativeSpeed, phaseTarget, 0.4);

  // Limiteur souple: garde la dynamique tout en evitant les pics abrupts.
  const minBound = Math.max(7000, phaseTarget * 0.58);
  const maxBound = Math.min(43000, phaseTarget * 1.42);
  return THREE.MathUtils.clamp(blended, minBound, maxBound);
};

const estimateTelemetryFromTimeline = (percent, posLocal) => {
  const totalDays = 10;
  const missionLabel = `Jour ${(percent * totalDays).toFixed(2)} / ${totalDays} (EST)`;

  const earthKm = posLocal.length() * KM_PER_SCENE_UNIT;

  const moonOrbitPercentOfCircle = 10 / 27.3;
  const moonAngle = percent * moonOrbitPercentOfCircle * Math.PI * 2;
  const moonLocalPos = new THREE.Vector3(
    Math.cos(moonAngle) * moon.currentDist,
    0,
    Math.sin(moonAngle) * moon.currentDist,
  );
  const moonKm = posLocal.distanceTo(moonLocalPos) * KM_PER_SCENE_UNIT;

  const speedKmH = estimateSpeedFromTimeline(percent);

  let temperatureC = -120 + Math.sin(percent * Math.PI * 6) * 12;
  if (moonKm < 110000) {
    const lunarProximity = 1 - THREE.MathUtils.clamp((moonKm - 60000) / 50000, 0, 1);
    temperatureC += lunarProximity * 8;
  }
  if (percent > 0.95) {
    const reentry = (percent - 0.95) / 0.05;
    temperatureC = 40 + reentry * 2700;
  }

  const signalDelayS = earthKm / LIGHT_SPEED_KM_S;

  return {
    missionLabel,
    speedKmH,
    temperatureC,
    earthKm,
    moonKm,
    signalDelayS,
  };
};

const updateUI = (percent, posLocal, posWorld, milestone) => {
  const telemetry = telemetryService.getSnapshot();
  const estimated = estimateTelemetryFromTimeline(percent, posLocal);
  const USE_EXTERNAL_ORION_TELEMETRY = false;

  const liveVehicle = telemetry?.vehicle;
  const liveDistances = telemetry?.distances;
  const hasLiveCore = USE_EXTERNAL_ORION_TELEMETRY &&
    (liveVehicle?.status === "live" || liveVehicle?.status === "stale")
    && Number.isFinite(liveVehicle?.speedKmH)
    && Number.isFinite(liveDistances?.earthKm)
    && Number.isFinite(liveDistances?.moonKm);

  missionDay.innerText = hasLiveCore && telemetry?.mission?.label
    ? `${telemetry.mission.label} (LIVE)`
    : estimated.missionLabel;

  const tempC = Number.isFinite(liveVehicle?.temperatureC)
    ? liveVehicle.temperatureC
    : estimated.temperatureC;
  tempInfo.innerText = `${tempC.toFixed(1)} °C`;
  if (tempC > 1000) tempInfo.className = "font-mono text-red-500 text-sm block animate-pulse";
  else if (tempC > 50) tempInfo.className = "font-mono text-orange-400 text-sm block";
  else if (tempC < 0) tempInfo.className = "font-mono text-blue-400 text-sm block";
  else tempInfo.className = "font-mono text-green-400 text-sm block";

  const distKm = Math.round(hasLiveCore ? liveDistances.earthKm : estimated.earthKm);
  const moonDistKm = Math.round(hasLiveCore ? liveDistances.moonKm : estimated.moonKm);

  distanceInfo.innerText = `${distKm.toLocaleString()} km`;
  if (distanceMoonInfo) {
    distanceMoonInfo.innerText = `${moonDistKm.toLocaleString()} km`;
  }

  const speedKmH = Math.round(hasLiveCore ? liveVehicle.speedKmH : estimated.speedKmH);
  speedInfo.innerText = `${speedKmH.toLocaleString()} km/h`;

  const delayS = Number.isFinite(liveDistances?.signalDelayS)
    ? liveDistances.signalDelayS
    : estimated.signalDelayS;
  signalDelay.innerText = `${delayS.toFixed(3)}s delay`;

  const heartBase = 65 + Math.sin(percent * 50) * 5;
  const heartVal = milestone ? heartBase + 20 : heartBase;
  bioHeart.innerText = `${Math.floor(heartVal)} BPM`;
  bioO2.innerText = `${(98 - percent * 2).toFixed(1)}%`;

  const isInVanAllen = percent > 0.01 && percent < 0.13;
  const liveWeather = telemetryService.getSnapshot().spaceWeather;
  let radVal;

  if (liveWeather.status === "live" || liveWeather.status === "stale") {
    const liveBase = liveWeather.radiationMsVh || 0.08;
    radVal = isInVanAllen ? liveBase * 1.8 : liveBase;
    const sourceTag = liveWeather.status === "live" ? "LIVE NOAA" : "STALE NOAA";
    bioRad.innerText = `${radVal.toFixed(2)} mSv/h (${sourceTag})`;
  } else {
    radVal = isInVanAllen
      ? 0.5 + Math.random() * 2
      : 0.05 + Math.random() * 0.02;
    bioRad.innerText = `${radVal.toFixed(2)} mSv/h (SIM)`;
  }

  if (milestone) {
    if (toast.classList.contains("hidden")) sceneManager.playBip();
    toast.classList.remove("hidden");
    toast.classList.add("flex");
    toastText.innerText = `${milestone.name} : ${milestone.desc}`;
  } else {
    toast.classList.add("hidden");
    toast.classList.remove("flex");
  }

  if (isInVanAllen) {
    vanAllenAlert.classList.remove("hidden");
  } else {
    vanAllenAlert.classList.add("hidden");
  }
};

const animateShipTo = (targetValue) => {
  if (shipTween) shipTween.stop();

  isLive = false;
  liveBtn.classList.remove("bg-red-600", "animate-pulse");
  liveBtn.classList.add("bg-gray-600");
  liveBtn.innerText = "OFFLINE";

  shipTween = new TWEEN.Tween({ p: currentProgress }, tweenGroup)
    .to({ p: targetValue }, 2500)
    .easing(TWEEN.Easing.Quadratic.InOut) // Démarrage et arrivée en douceur
    .onUpdate((obj) => {
      targetProgress = obj.p;
      currentProgress = obj.p;
      slider.value = currentProgress * 100; // Maj visuelle du slider
      updateMissionLogic(currentProgress);
    })
    .start();
};

const updateMissionLogic = (percent) => {
  if (
    !trajectoryManager ||
    !orion ||
    !earth ||
    !moonMesh ||
    !trajectoryManager.curve
  )
    return;

  const path = trajectoryManager.curve;
  const pos = path.getPointAt(percent);
  const tangent = path.getTangentAt(percent);

  // Convertir en coord mondiales pour le lookAt de la capsule
  const posWorld = new THREE.Vector3();
  earth.getMesh().localToWorld(posWorld.copy(pos));
  const globalTangent = tangent
    .clone()
    .transformDirection(earth.getMesh().matrixWorld);
  const lookAtTarget = posWorld.clone().add(globalTangent);

  const milestone = trajectoryManager.getMilestoneAt(percent);
  let engineIntensity = 0;
  if (percent < 0.05) engineIntensity = 1.0;
  else if (milestone && milestone.name === "Injection Trans-Lunaire")
    engineIntensity = 1.5;
  else if (milestone) engineIntensity = 0.3;

  orion.updatePosition(pos, lookAtTarget, engineIntensity);
  orion.updateForces(earth.getMesh().position, moonMesh.position, showForces);

  updateUI(percent, pos, posWorld, milestone);
};

// Gestion des forces et de l'échelle
toggleForcesBtn.addEventListener("click", () => {
  showForces = !showForces;
  toggleForcesBtn.innerText = `Forces Gravitationnelles: ${showForces ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

toggleStarsBtn.addEventListener("click", () => {
  const isVisible = toggleStarsBtn.innerText.includes("OFF");
  sceneManager.toggleStars(isVisible);
  toggleStarsBtn.innerText = `Étoiles: ${isVisible ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

toggleGridBtn.addEventListener("click", () => {
  const isVisible = toggleGridBtn.innerText.includes("OFF");
  sceneManager.toggleGrid(isVisible);
  toggleGridBtn.innerText = `Grille: ${isVisible ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

toggleVanAllenBtn.addEventListener("click", () => {
  const isVisible = toggleVanAllenBtn.innerText.includes("OFF");
  earth.toggleVanAllen(isVisible);
  toggleVanAllenBtn.innerText = `Belts: ${isVisible ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

toggleOrbitBtn.addEventListener("click", () => {
  const isVisible = toggleOrbitBtn.innerText.includes("OFF");
  moonOrbitLine.visible = isVisible;
  toggleOrbitBtn.innerText = `Orbite: ${isVisible ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

toggleAudioBtn.addEventListener("click", () => {
  const isEnabled = toggleAudioBtn.innerText.includes("OFF");
  sceneManager.toggleMusic(isEnabled);
  toggleAudioBtn.innerText = `🎵 Audio: ${isEnabled ? "ON" : "OFF"}`;
  sceneManager.playBip();
});

volumeSlider.addEventListener("input", (e) => {
  const vol = e.target.value;
  volValue.innerText = `${vol}%`;
  sceneManager.setVolume(vol / 100);
});

// Gestion de la caméra
camOrion.addEventListener("click", () => {
  hublotOverlay.classList.add("hidden");
  sceneManager.setCameraTarget(orion.getMesh(), new THREE.Vector3(0.15, 0.08, 0.15));
});

camHublot.addEventListener("click", () => {
  sceneManager.playBip();
  hublotOverlay.classList.remove("hidden");
  sceneManager.setHublotMode(orion.getMesh());
});

camMoon.addEventListener("click", () => {
  sceneManager.playBip();
  hublotOverlay.classList.add("hidden");
  sceneManager.setCameraTarget(moonMesh, new THREE.Vector3(15, 5, 15));
});

camSystem.addEventListener("click", () => {
  // Vue globale du système (Terre au centre pour la caméra)
  hublotOverlay.classList.add("hidden");
  sceneManager.setCameraTarget(
    earth.getMesh(),
    new THREE.Vector3(200, 100, 500),
  );
});

// Capture et Hotspots
snapBtn.addEventListener("click", () => {
  sceneManager.takeScreenshot();
});

sceneManager.onHotspotClick = (data) => {
  sceneManager.playBip();
  modalTitle.innerText = data.title;
  modalDesc.innerText = data.desc;
  modal.classList.remove("hidden");
};

closeModal.addEventListener("click", () => {
  modal.classList.add("hidden");
});

const handleLiveUpdate = () => {
  if (!isLive) return;

  const now = new Date();
  const elapsed = now - LAUNCH_DATE;

  if (elapsed < 0) {
    targetProgress = 0;
    missionDay.innerText = "En attente du lancement...";
    return;
  }

  const progress = Math.min(1, elapsed / MISSION_DURATION_MS);
  targetProgress = progress;
  slider.value = progress * 100;

  if (progress >= 1) {
    isLive = false;
    liveBtn.classList.remove("bg-red-600", "animate-pulse");
    liveBtn.classList.add("bg-gray-600");
    liveBtn.innerText = "TERMINÉ";
  }
};

// Modification : Le slider contrôle directement le vaisseau lors du glissement
slider.addEventListener("input", (e) => {
  const targetValue = e.target.value / 100;

  // Arrêter toute animation en cours si l'utilisateur manipule le curseur manuellement
  if (shipTween) shipTween.stop();

  isLive = false;
  liveBtn.classList.remove("bg-red-600", "animate-pulse");
  liveBtn.classList.add("bg-gray-600");
  liveBtn.innerText = "OFFLINE";

  // Mise à jour de la cible, la boucle Render fera le lissage
  currentProgress = targetValue;
  targetProgress = targetValue;
  updateMissionLogic(currentProgress);
});

liveBtn.addEventListener("click", () => {
  isLive = true;
  liveBtn.classList.add("bg-red-600", "animate-pulse");
  liveBtn.classList.remove("bg-gray-600");
  liveBtn.innerText = "LIVE";
});

// Configuration des Phases Clés Pédagogiques
const missionPhases = {
  TLI: {
    id: "TLI",
    timelineProgress: 0.12,
    target: "orion",
    offset: new THREE.Vector3(0.3, 0.15, -0.3),
    lookAt: null,
    title: "Injection Trans-Lunaire (TLI)",
    desc: "Le moteur propulse Orion à plus de 39 000 km/h pour échapper à l'attraction terrestre. C'est le début du voyage de 4 jours vers la Lune.",
  },
  MoonFlyby: {
    id: "MoonFlyby",
    timelineProgress: 0.5,
    target: "moon",
    offset: new THREE.Vector3(15, 10, -25),
    lookAt: new THREE.Vector3(0, 0, 0),
    title: "Survol Lunaire (Flyby)",
    desc: "Orion utilise la gravité lunaire pour se propulser vers la Terre (Free Return Trajectory) sans consommer de carburant excessif. La face cachée est survolée à ~7 500 km.",
  },
  ReEntry: {
    id: "ReEntry",
    timelineProgress: 0.97,
    target: "orion",
    offset: new THREE.Vector3(0.15, 0.05, 0.15),
    lookAt: null,
    title: 'Rentrée Atmosphérique "Skip Entry"',
    desc: "Orion rebondit sur la haute atmosphère comme un galet sur l'eau. Ce \"Skip Re-entry\" permet de dissiper la chaleur infernale (2800°C) et de réduire la décélération ressentie par l'équipage.",
  },
};

const phasePanel = document.getElementById("phase-info-panel");
const phaseTitle = document.getElementById("phase-info-title");
const phaseDesc = document.getElementById("phase-info-desc");
let phaseHideTimeout;

const goToPhase = (phaseName) => {
  const phase = missionPhases[phaseName];
  if (!phase) return;

  // Couper le live si actif
  isLive = false;
  liveBtn.classList.remove("bg-red-600", "animate-pulse");
  liveBtn.classList.add("bg-gray-600");
  liveBtn.innerText = "OFFLINE";

  sceneManager.playBip();

  // 1. Déplacer la caméra doucement avec le SceneManager existant
  let targetMesh = earth.getMesh();
  if (phase.target === "moon") targetMesh = moonMesh;
  if (phase.target === "orion") targetMesh = orion.getMesh();

  hublotOverlay.classList.add("hidden");
  sceneManager.setCameraTarget(targetMesh, phase.offset, phase.lookAt, 0.03);

  // Transition fluide du vaisseau via TWEEN à la place de l'update direct
  animateShipTo(phase.timelineProgress);

  // Afficher le panneau descriptif
  phaseTitle.innerText = phase.title;
  phaseDesc.innerText = phase.desc;
  phasePanel.classList.remove("hidden");
  // Petit délai pour l'animation CSS (opacity)
  setTimeout(() => phasePanel.classList.remove("opacity-0"), 50);

  clearTimeout(phaseHideTimeout);
  phaseHideTimeout = setTimeout(() => {
    phasePanel.classList.add("opacity-0");
    setTimeout(() => phasePanel.classList.add("hidden"), 700);
  }, 8000); // Cacher après 8s
};

// Initialisation de la timeline avec marqueurs
const initTimelineMarkers = () => {
  const markersContainer = document.getElementById("timeline-markers");
  if (!markersContainer || !trajectoryManager) return;

  markersContainer.innerHTML = ""; // Nettoyer les anciens marqueurs

  // Afficher les milestones classiques sous forme de petits traits
  trajectoryManager.milestones.forEach((m) => {
    const marker = document.createElement("div");
    marker.className =
      "absolute w-px h-full flex flex-col items-center justify-center group pointer-events-none transition-all";
    marker.style.left = `${m.t * 100}%`;

    const line = document.createElement("div");
    line.className = "w-px h-2 bg-white/20 z-0";

    marker.appendChild(line);
    markersContainer.appendChild(marker);
  });

  // Afficher les Phases Clés interactives (Pédagogiques)
  Object.values(missionPhases).forEach((phase) => {
    const marker = document.createElement("div");
    marker.className =
      "absolute w-3 h-3 flex items-center justify-center group cursor-pointer transition-all z-30 pointer-events-auto transform -translate-x-1/2 hover:scale-150";
    marker.style.left = `${phase.timelineProgress * 100}%`;

    const dot = document.createElement("div");
    dot.className =
      "w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.8)] group-hover:bg-white transition-colors";

    const pulse = document.createElement("div");
    pulse.className =
      "absolute inset-0 rounded-full bg-blue-400/50 animate-ping group-hover:hidden";

    const tooltip = document.createElement("div");
    tooltip.className =
      "absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-blue-900/90 text-[8px] text-blue-100 font-bold px-2 py-1 rounded border border-blue-400/50 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-widest shadow-lg";
    tooltip.textContent = phase.id;

    marker.appendChild(pulse);
    marker.appendChild(dot);
    marker.appendChild(tooltip);

    marker.addEventListener("click", () => {
      goToPhase(phase.id);
    });

    markersContainer.appendChild(marker);
  });
};

initTimelineMarkers();

// Traitement initial
targetProgress = startProgress;
currentProgress = startProgress; // Aligne instantanément pour éviter une longue animation d'entrée
slider.value = startProgress * 100;
updateMissionLogic(startProgress);

if (startProgress >= 1) {
  isLive = false;
  liveBtn.classList.remove("bg-red-600", "animate-pulse");
  liveBtn.classList.add("bg-gray-600");
  liveBtn.innerText = "TERMINÉ";
} else {
  isLive = true;
  liveBtn.classList.add("bg-red-600", "animate-pulse");
  liveBtn.classList.remove("bg-gray-600");
  liveBtn.innerText = "LIVE";
}

// Boucle de rendu
sceneManager.render(() => {
  stats.begin();
  TWEEN.update();
  tweenGroup.update();

  // Interpolation linéaire (Lerp) pour lisser le mouvement manuel
  if (Math.abs(targetProgress - currentProgress) > 0.0001) {
    currentProgress += (targetProgress - currentProgress) * 0.1;
    updateMissionLogic(currentProgress);
  }

  // Mettre à jour la trajectoire en fonction de la distance actuelle de la lune (si elle change)
  if (trajectoryManager && moon) {
    trajectoryManager.updateCurve(moon.currentDist);
  }

  if (earth) earth.update(null, currentProgress);
  if (sun) sun.update(null, currentProgress);
  if (moon && earth) {
    moon.update(earth.getMesh(), currentProgress);
    moon.updateOrbitLine(earth.getMesh());
  }

  if (earth) {
    earth.updateAtmosphereLighting(sceneManager.sunLight.position, sceneManager.camera.position);
  }

  // Chatter Radio Random
  if (Math.random() < 0.001) { // Faible probabilité à chaque frame
     playRadioChatter();
  }


  // Eclairage solaire stable: position/target configures une fois a l'initialisation.

  handleLiveUpdate();
  stats.end();
});

console.log("Artemis 2 Mission Visualization Initialized - Phase 6 Final");
