const startBtn = document.getElementById("startBtn");

// ==========================
// STATE
// ==========================
let currentLat = null;
let currentLon = null;
let currentAlt = null;

let currentYaw = 0;
let currentPitch = 0;
let currentRoll = 0;

let targetLat = null;
let targetLon = null;
let targetAlt = null;

let sensor = null;

// ✅ NEW: runtime control
let isRunning = false;
let stream = null;
let gpsWatchId = null;
let animationId = null;

// ✅ FOV
let fovX = 60;

// ==========================
// FOV STORAGE
// ==========================
function loadFOV() {
  const saved = localStorage.getItem("fovX");
  if (saved) fovX = parseFloat(saved);
}

function saveFOV() {
  localStorage.setItem("fovX", fovX);
}

// ==========================
// FOV UI
// ==========================
const panel = document.getElementById("settingsPanel");
const openBtn = document.getElementById("openFovBtn");
const closeBtn = document.getElementById("closeFovBtn");
const saveBtn = document.getElementById("saveFovBtn");
const fovXInput = document.getElementById("fovXInput");

if (openBtn) {
  openBtn.onclick = () => {
    panel.classList.remove("hidden");
    fovXInput.value = fovX;
  };

  closeBtn.onclick = () => panel.classList.add("hidden");

  saveBtn.onclick = () => {
    fovX = parseFloat(fovXInput.value);
    saveFOV();
    panel.classList.add("hidden");
  };
}

// ==========================
// READ URL
// ==========================
function readURL() {
  const params = new URLSearchParams(window.location.search);

  targetLat = parseFloat(params.get("lat"));
  targetLon = parseFloat(params.get("lon"));

  const altParam = params.get("alt");
  targetAlt = (altParam !== null) ? parseFloat(altParam) : null;

  if (!isNaN(targetLat) && !isNaN(targetLon)) {
    console.log("Target:", targetLat, targetLon, "Alt:", targetAlt);
  } else {
    alert("No lat/lon in URL");
  }
}

// ==========================
// START / STOP BUTTON
// ==========================
startBtn.addEventListener("click", async () => {

  if (!isRunning) {
    await startCamera();
    startGPS();
    startQuaternion();

    animationId = requestAnimationFrame(updateAR);

    startBtn.textContent = "Stop AR";
    isRunning = true;

  } else {
    stopAR();

    startBtn.textContent = "Start AR";
    isRunning = false;
  }
});

// ==========================
// CAMERA
// ==========================
async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  document.getElementById("camera").srcObject = stream;
}

// ==========================
// GPS
// ==========================
function startGPS() {
  gpsWatchId = navigator.geolocation.watchPosition((pos) => {

    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;

    const altitude = pos.coords.altitude;

    if (altitude !== null) {
      currentAlt = altitude;
      document.getElementById("altitude").textContent =
        altitude.toFixed(1) + " m";
    } else {
      currentAlt = null;
      document.getElementById("altitude").textContent = "N/A";
    }

    document.getElementById("lat").textContent = currentLat.toFixed(6);
    document.getElementById("lon").textContent = currentLon.toFixed(6);

  }, console.warn, {
    enableHighAccuracy: true
  });
}

// ==========================
// SENSOR
// ==========================
function startQuaternion() {
  if (sensor) return;

  try {
    sensor = new AbsoluteOrientationSensor({
      frequency: 60,
      referenceFrame: "device"
    });

    sensor.addEventListener("reading", () => {

      const q = sensor.quaternion;
      const [qx, qy, qz, qw] = q;

      const f = rotateVec(qx, qy, qz, qw, 0, 0, -1);
      const u = rotateVec(qx, qy, qz, qw, 0, 1, 0);

      const fn = Math.hypot(f.x, f.y, f.z);
      const fx = f.x / fn, fy = f.y / fn, fz = f.z / fn;

      const un = Math.hypot(u.x, u.y, u.z);
      const ux = u.x / un, uy = u.y / un, uz = u.z / un;

      let yaw = (Math.atan2(fx, fy) * 180 / Math.PI + 360) % 360;
      let pitch = Math.asin(Math.max(-1, Math.min(1, fz))) * 180 / Math.PI;

      let roll = 0;
      const wx = 0, wy = 0, wz = 1;

      const dot_fu = fx*ux + fy*uy + fz*uz;
      const u_px = ux - dot_fu * fx;
      const u_py = uy - dot_fu * fy;
      const u_pz = uz - dot_fu * fz;

      const dot_fw = fx*wx + fy*wy + fz*wz;
      const w_px = wx - dot_fw * fx;
      const w_py = wy - dot_fw * fy;
      const w_pz = wz - dot_fw * fz;

      const un2 = Math.hypot(u_px, u_py, u_pz);
      const wn2 = Math.hypot(w_px, w_py, w_pz);

      if (un2 > 1e-6 && wn2 > 1e-6) {
        const ux2 = u_px / un2, uy2 = u_py / un2, uz2 = u_pz / un2;
        const wx2 = w_px / wn2, wy2 = w_py / wn2, wz2 = w_pz / wn2;

        const dot = ux2*wx2 + uy2*wy2 + uz2*wz2;

        const cx = uy2*wz2 - uz2*wy2;
        const cy = uz2*wx2 - ux2*wz2;
        const cz = ux2*wy2 - uy2*wx2;

        const sign = fx*cx + fy*cy + fz*cz;
        roll = Math.atan2(sign, dot) * 180 / Math.PI;
      }

      currentYaw = yaw;
      currentPitch = pitch;
      currentRoll = roll;

      document.getElementById("yaw").textContent = yaw.toFixed(1);
      document.getElementById("pitch").textContent = pitch.toFixed(1);
      document.getElementById("roll").textContent = roll.toFixed(1);

      // horizon
      const horizon = document.getElementById("horizon");
      if (horizon) {
        const h = window.innerHeight;
        const fovY = fovX * (h / window.innerWidth);
        const yOffset = (currentPitch / fovY) * h;

        horizon.style.transform = `
          translate(-50%, calc(-50% + ${yOffset}px))
          rotate(${currentRoll}deg)
        `;
      }
    });

    sensor.start();

  } catch (err) {
    alert("Orientation sensor not supported");
  }
}

// ==========================
// STOP EVERYTHING
// ==========================
function stopAR() {

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    document.getElementById("camera").srcObject = null;
  }

  if (sensor) {
    sensor.stop();
    sensor = null;
  }

  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

// ==========================
// UTILS
// ==========================
function rotateVec(qx, qy, qz, qw, vx, vy, vz) {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);

  return {
    x: vx + qw * tx + (qy * tz - qz * ty),
    y: vy + qw * ty + (qz * tx - qx * tz),
    z: vz + qw * tz + (qx * ty - qy * tx)
  };
}

function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2)**2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ==========================
// AR LOOP
// ==========================
function updateAR() {

  if (currentLat !== null && targetLat !== null) {

    const bearing = getBearing(currentLat, currentLon, targetLat, targetLon);
    const distance = getDistance(currentLat, currentLon, targetLat, targetLon);

    let diff = ((bearing - currentYaw + 540) % 360) - 180;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const fovY = fovX * (h / w);

    let deltaAlt = 0;
    if (targetAlt !== null && currentAlt !== null) {
      deltaAlt = targetAlt - currentAlt;
    }

    const pitchTarget = Math.atan2(deltaAlt, Math.max(distance,1)) * 180 / Math.PI;
    const verticalDiff = pitchTarget - currentPitch;

    const x0 = (diff / fovX) * w;
    const y0 = (verticalDiff / fovY) * h;

    const r = currentRoll * Math.PI / 180;

    const x = x0 * Math.cos(r) - y0 * Math.sin(r);
    const y = x0 * Math.sin(r) + y0 * Math.cos(r);

    document.getElementById("marker").style.transform = `
      translate(calc(-50% + ${x}px), calc(-50% + ${y}px))
      rotate(${currentRoll}deg)
    `;
  }

  animationId = requestAnimationFrame(updateAR);
}

// ==========================
// INIT
// ==========================
loadFOV();
readURL();