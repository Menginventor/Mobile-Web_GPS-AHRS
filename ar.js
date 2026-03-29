const startBtn = document.getElementById("startBtn");

// ==========================
// STATE
// ==========================
let currentLat = null;
let currentLon = null;

let currentYaw = 0;
let currentPitch = 0;
let currentRoll = 0;

let targetLat = null;
let targetLon = null;

let sensor = null;

// ✅ FOV (user-controlled)
let fovX = 60;

// ==========================
// FOV STORAGE
// ==========================
function loadFOV() {
  const saved = localStorage.getItem("fovX");
  if (saved) {
    fovX = parseFloat(saved);
  }
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

  closeBtn.onclick = () => {
    panel.classList.add("hidden");
  };

  saveBtn.onclick = () => {
    fovX = parseFloat(fovXInput.value);
    saveFOV();
    panel.classList.add("hidden");
  };
}

// ==========================
// READ TARGET FROM URL
// ==========================
function readURL() {
  const params = new URLSearchParams(window.location.search);

  targetLat = parseFloat(params.get("lat"));
  targetLon = parseFloat(params.get("lon"));

  if (!isNaN(targetLat) && !isNaN(targetLon)) {
    console.log("Target:", targetLat, targetLon);
  } else {
    alert("No lat/lon in URL");
  }
}

// ==========================
// START BUTTON
// ==========================
startBtn.addEventListener("click", async () => {
  await startCamera();
  startGPS();
  startQuaternion();
  requestAnimationFrame(updateAR);
});

// ==========================
// CAMERA
// ==========================
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  document.getElementById("camera").srcObject = stream;
}

// ==========================
// GPS
// ==========================
function startGPS() {
  navigator.geolocation.watchPosition((pos) => {

    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;

    const altitude = pos.coords.altitude;
    const accuracy = pos.coords.altitudeAccuracy;

    document.getElementById("lat").textContent = currentLat.toFixed(6);
    document.getElementById("lon").textContent = currentLon.toFixed(6);

    // altitude display
    if (altitude !== null) {
      document.getElementById("altitude").textContent =
        altitude.toFixed(1) + " m";
    } else {
      document.getElementById("altitude").textContent = "N/A";
    }

    // (optional debug)
    console.log("Altitude:", altitude, "Accuracy:", accuracy);

  }, (err) => {
    console.warn("GPS error:", err);
  }, {
    enableHighAccuracy: true
  });
}

// ==========================
// QUATERNION SENSOR
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
      const qx = q[0], qy = q[1], qz = q[2], qw = q[3];

      const f = rotateVec(qx, qy, qz, qw, 0, 0, -1);
      const u = rotateVec(qx, qy, qz, qw, 0, 1, 0);

      const fn = Math.hypot(f.x, f.y, f.z);
      const fx = f.x / fn;
      const fy = f.y / fn;
      const fz = f.z / fn;

      const un = Math.hypot(u.x, u.y, u.z);
      const ux = u.x / un;
      const uy = u.y / un;
      const uz = u.z / un;

      // YAW
      let yaw = Math.atan2(fx, fy) * 180 / Math.PI;
      yaw = (yaw + 360) % 360;

      // PITCH
      let pitch = Math.asin(Math.max(-1, Math.min(1, fz))) * 180 / Math.PI;

      // ROLL
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
        const ux2 = u_px / un2;
        const uy2 = u_py / un2;
        const uz2 = u_pz / un2;

        const wx2 = w_px / wn2;
        const wy2 = w_py / wn2;
        const wz2 = w_pz / wn2;

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
      //
      const horizon = document.getElementById("horizon");

    // convert roll to radians
    const r = currentRoll * Math.PI / 180;

    // optional: include pitch shift
    const h = window.innerHeight;
    const fovY = fovX * (h / window.innerWidth);

    // move horizon with pitch
    const yOffset = (currentPitch / fovY) * h;

    // apply transform
    horizon.style.transform = `
      translate(-50%, calc(-50% + ${yOffset}px))
      rotate(${currentRoll}deg)
    `;
    });

    sensor.start();

  } catch (err) {
    alert("Orientation sensor not supported");
  }
}

// ==========================
// ROTATE VECTOR
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

// ==========================
// BEARING
// ==========================
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

// ==========================
// DISTANCE
// ==========================
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

    let diff = bearing - currentYaw;
    diff = ((diff + 540) % 360) - 180;

    document.getElementById("bearing").textContent = bearing.toFixed(1);
    document.getElementById("relative").textContent = diff.toFixed(1);

    const distText = distance < 1000
      ? distance.toFixed(1) + " m"
      : (distance/1000).toFixed(2) + " km";

    document.getElementById("distance").textContent = distText;
    document.getElementById("markerLabel").textContent = distText;

    const w = window.innerWidth;
    const h = window.innerHeight;

    const fovY = fovX * (h / w);

    const x0 = (diff / fovX) * w;
    const y0 = (currentPitch / fovY) * h;

    const r = currentRoll * Math.PI / 180;

    const x = x0 * Math.cos(r) - y0 * Math.sin(r);
    const y = x0 * Math.sin(r) + y0 * Math.cos(r);

    const marker = document.getElementById("marker");

    if (Math.abs(diff) > 90) {
      marker.style.display = "none";
    } else {
      marker.style.display = "block";

      const scale = Math.max(0.6, Math.min(2.5, 200 / distance));

      marker.style.transform = `
        translate(calc(-50% + ${x}px), calc(-50% + ${y}px))
        rotate(${currentRoll}deg)
        scale(${scale})
      `;
    }
  }

  requestAnimationFrame(updateAR);
}

// ==========================
// INIT
// ==========================
loadFOV();
readURL();