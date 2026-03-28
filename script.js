const startBtn = document.getElementById("startBtn");
const toggleARBtn = document.getElementById("toggleARBtn");

let sensor = null;
let cameraStream = null;
let arEnabled = false;

// ==========================
// START BUTTON (SENSORS)
// ==========================
startBtn.addEventListener("click", async () => {

  if (typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      await DeviceMotionEvent.requestPermission();
    } catch (e) {
      console.warn("Permission denied");
    }
  }

  startGPS();
  startQuaternionSensor();
});


// ==========================
// CAMERA TOGGLE
// ==========================
toggleARBtn.addEventListener("click", async () => {

  const video = document.getElementById("camera");

  if (!arEnabled) {
    await startCamera();
    video.classList.remove("hidden");
    toggleARBtn.textContent = "Disable AR";
    arEnabled = true;
  } else {
    stopCamera();
    video.classList.add("hidden");
    toggleARBtn.textContent = "Enable AR";
    arEnabled = false;
  }

});


// ==========================
// CAMERA FUNCTIONS
// ==========================
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    const video = document.getElementById("camera");
    video.srcObject = cameraStream;

  } catch (err) {
    console.error("Camera error:", err);
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  const video = document.getElementById("camera");
  video.srcObject = null;
}


// ==========================
// GPS
// ==========================
function startGPS() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    document.getElementById("lat").textContent = lat.toFixed(6);
    document.getElementById("lon").textContent = lon.toFixed(6);
    document.getElementById("acc").textContent = pos.coords.accuracy.toFixed(2);
    document.getElementById("alt").textContent =
      pos.coords.altitude ? pos.coords.altitude.toFixed(2) : "-";
  });
}


// ==========================
// QUATERNION SENSOR
// ==========================
function startQuaternionSensor() {
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

      document.getElementById("qx").textContent = qx.toFixed(4);
      document.getElementById("qy").textContent = qy.toFixed(4);
      document.getElementById("qz").textContent = qz.toFixed(4);
      document.getElementById("qw").textContent = qw.toFixed(4);

      const rpy = getCameraRPY(qx, qy, qz, qw);

      document.getElementById("yaw").textContent = rpy.yaw.toFixed(1);
      document.getElementById("pitch").textContent = rpy.pitch.toFixed(1);
      document.getElementById("roll").textContent = rpy.roll.toFixed(1);

      document.getElementById("heading").textContent = rpy.yaw.toFixed(1);
      document.getElementById("headingBig").textContent =
        rpy.yaw.toFixed(0) + "°";
    });

    sensor.start();

  } catch (err) {
    console.warn("Sensor not supported:", err);
    alert("Orientation sensor not supported");
  }
}


// ==========================
// CAMERA RPY
// ==========================
function getCameraRPY_old(qx, qy, qz, qw) {

  // Forward vector
  let fx = 0, fy = 0, fz = 1;

  // Up vector
  let ux = 0, uy = 1, uz = 0;

  // Rotate forward
  const f_ix =  qw * fx + qy * fz - qz * fy;
  const f_iy =  qw * fy + qz * fx - qx * fz;
  const f_iz =  qw * fz + qx * fy - qy * fx;
  const f_iw = -qx * fx - qy * fy - qz * fz;

  const fx_w = f_ix * qw + f_iw * -qx + f_iy * -qz - f_iz * -qy;
  const fy_w = f_iy * qw + f_iw * -qy + f_iz * -qx - f_ix * -qz;
  const fz_w = f_iz * qw + f_iw * -qz + f_ix * -qy - f_iy * -qx;

  // Rotate up
  const u_ix =  qw * ux + qy * uz - qz * uy;
  const u_iy =  qw * uy + qz * ux - qx * uz;
  const u_iz =  qw * uz + qx * uy - qy * ux;
  const u_iw = -qx * ux - qy * uy - qz * uz;

  const ux_w = u_ix * qw + u_iw * -qx + u_iy * -qz - u_iz * -qy;
  const uy_w = u_iy * qw + u_iw * -qy + u_iz * -qx - u_ix * -qz;
  const uz_w = u_iz * qw + u_iw * -qz + u_ix * -qy - u_iy * -qx;

  // Compute RPY
  let yaw = Math.atan2(fx_w, fy_w);

  const fz_clamped = Math.max(-1, Math.min(1, fz_w));
  let pitch = Math.asin(fz_clamped);

  let roll = Math.atan2(ux_w, uz_w);

  return {
    roll: roll * 180 / Math.PI,
    pitch: pitch * 180 / Math.PI,
    yaw: (yaw * 180 / Math.PI + 360) % 360
  };
}
function getCameraRPY(qx, qy, qz, qw) {

  // 🔁 Inverse quaternion (device → world)
  const ix = -qx, iy = -qy, iz = -qz, iw = qw;

  // ✅ BACK CAMERA forward (camera frame)
  let fx = 0, fy = 0, fz = -1;

  // Up vector (camera up ≈ device +Y flipped already handled by forward choice)
  let ux = 0, uy = 1, uz = 0;

  // ---- rotate forward (device → world) ----
  const f_ix =  iw * fx + iy * fz - iz * fy;
  const f_iy =  iw * fy + iz * fx - ix * fz;
  const f_iz =  iw * fz + ix * fy - iy * fx;
  const f_iw = -ix * fx - iy * fy - iz * fz;

  const fx_w = f_ix * iw + f_iw * -ix + f_iy * -iz - f_iz * -iy;
  const fy_w = f_iy * iw + f_iw * -iy + f_iz * -ix - f_ix * -iz;
  const fz_w = f_iz * iw + f_iw * -iz + f_ix * -iy - f_iy * -ix;

  // ---- rotate up ----
  const u_ix =  iw * ux + iy * uz - iz * uy;
  const u_iy =  iw * uy + iz * ux - ix * uz;
  const u_iz =  iw * uz + ix * uy - iy * ux;
  const u_iw = -ix * ux - iy * uy - iz * uz;

  const ux_w = u_ix * iw + u_iw * -ix + u_iy * -iz - u_iz * -iy;
  const uy_w = u_iy * iw + u_iw * -iy + u_iz * -ix - u_ix * -iz;
  const uz_w = u_iz * iw + u_iw * -iz + u_ix * -iy - u_iy * -ix;

  // -----------------------------
  // 🎯 YAW (compass heading)
  // -----------------------------
  let yaw = Math.atan2(fx_w, fy_w);

  // -----------------------------
  // 📐 PITCH
  // -----------------------------
  const fz_clamped = Math.max(-1, Math.min(1, fz_w));
  let pitch = Math.asin(fz_clamped);

  // -----------------------------
  // 🔄 ROLL (improved)
  // -----------------------------
  // Use horizontal right vector instead of unstable up-only method
  const rx_w = uy_w * fz_w - uz_w * fy_w;
  const ry_w = uz_w * fx_w - ux_w * fz_w;
  const rz_w = ux_w * fy_w - uy_w * fx_w;

  let roll = Math.atan2(rx_w, rz_w);

  return {
    roll: roll * 180 / Math.PI,
    pitch: pitch * 180 / Math.PI,
    yaw: (yaw * 180 / Math.PI + 360) % 360
  };
}