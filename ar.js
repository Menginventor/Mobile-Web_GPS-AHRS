const startBtn = document.getElementById("startBtn");

let currentLat = null;
let currentLon = null;
let currentYaw = 0;

let targetLat = null;
let targetLon = null;

let sensor = null;

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

    document.getElementById("lat").textContent = currentLat.toFixed(6);
    document.getElementById("lon").textContent = currentLon.toFixed(6);
  });
}

// ==========================
// QUATERNION SENSOR (YOUR SYSTEM)
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

      const qx = q[0];
      const qy = q[1];
      const qz = q[2];
      const qw = q[3];

      // forward vector (camera)
      const f = rotateVec(qx, qy, qz, qw, 0, 0, -1);

      const fn = Math.hypot(f.x, f.y, f.z);
      const fx = f.x / fn;
      const fy = f.y / fn;
      const fz = f.z / fn;

      // ✅ CAMERA YAW (correct)
      let yaw = Math.atan2(fx, fy) * 180 / Math.PI;
      yaw = (yaw + 360) % 360;

      currentYaw = yaw;

      document.getElementById("yaw").textContent = yaw.toFixed(1);
    });

    sensor.start();

  } catch (err) {
    alert("Orientation sensor not supported");
    console.warn(err);
  }
}

// ==========================
// ROTATE VECTOR (from your code)
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
// BEARING CALCULATION
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

  let θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

// ==========================
// AR LOOP
// ==========================
function updateAR() {

  if (currentLat !== null && targetLat !== null) {

    const targetBearing = getBearing(
      currentLat, currentLon,
      targetLat, targetLon
    );

    // ✅ CORE AR EQUATION
    let diff = targetBearing - currentYaw;
    diff = ((diff + 540) % 360) - 180;

    document.getElementById("bearing").textContent = targetBearing.toFixed(1);
    document.getElementById("relative").textContent = diff.toFixed(1);

    // map angle → screen
    const screenWidth = window.innerWidth;
    const fov = 35;

    const x = (diff / fov) * screenWidth;

    const marker = document.getElementById("marker");

    // hide if behind camera
    if (Math.abs(diff) > 90) {
      marker.style.display = "none";
    } else {
      marker.style.display = "block";
      marker.style.transform =
        `translate(calc(-50% + ${x}px), -50%)`;
    }
  }

  requestAnimationFrame(updateAR);
}

// ==========================
// INIT
// ==========================
readURL();