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

      // -------------------------
      // Show quaternion
      // -------------------------
      document.getElementById("qx").textContent = qx.toFixed(4);
      document.getElementById("qy").textContent = qy.toFixed(4);
      document.getElementById("qz").textContent = qz.toFixed(4);
      document.getElementById("qw").textContent = qw.toFixed(4);

      // -------------------------
      // Get camera forward & up
      // -------------------------
      const f = rotateVec(qx, qy, qz, qw, 0, 0, -1); // forward
      const u = rotateVec(qx, qy, qz, qw, 0, 1, 0);  // up

      // normalize
      const fn = Math.hypot(f.x, f.y, f.z);
      const fx = f.x / fn;
      const fy = f.y / fn;
      const fz = f.z / fn;

      const un = Math.hypot(u.x, u.y, u.z);
      const ux = u.x / un;
      const uy = u.y / un;
      const uz = u.z / un;

      // show forward vector
      document.getElementById("fx").textContent = fx.toFixed(3);
      document.getElementById("fy").textContent = fy.toFixed(3);
      document.getElementById("fz").textContent = fz.toFixed(3);

      // -------------------------
      // YAW (heading)
      // -------------------------
      let yaw = Math.atan2(fx, fy) * 180 / Math.PI;
      yaw = (yaw + 360) % 360;

      // -------------------------
      // PITCH
      // -------------------------
      let pitch = Math.asin(Math.max(-1, Math.min(1, fz))) * 180 / Math.PI;

      // -------------------------
      // ROLL (correct)
      // -------------------------
      let roll = 0;

      // world up
      const wx = 0, wy = 0, wz = 1;

      // project up vectors onto plane ⟂ forward
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

      // -------------------------
      // UI update
      // -------------------------
      document.getElementById("yaw").textContent = yaw.toFixed(1);
      document.getElementById("pitch").textContent = pitch.toFixed(1);
      document.getElementById("roll").textContent = roll.toFixed(1);

      document.getElementById("heading").textContent = yaw.toFixed(1);
      document.getElementById("headingBig").textContent = yaw.toFixed(0) + "°";
    });

    sensor.start();

  } catch (err) {
    console.warn("Sensor not supported:", err);
    alert("Orientation sensor not supported");
  }
}


// ==========================
// Quaternion vector rotation
// ==========================
function rotateVec(qx, qy, qz, qw, vx, vy, vz) {

  // NOTE: using q as-is (works with your current "device" frame behavior)

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

  // ✅ BACK CAMERA forward
  let fx = 0, fy = 0, fz = -1;

  // Up vector
  let ux = 0, uy = 1, uz = 0;

  // ---- rotate forward ----
  const f_ix =  qw * fx + qy * fz - qz * fy;
  const f_iy =  qw * fy + qz * fx - qx * fz;
  const f_iz =  qw * fz + qx * fy - qy * fx;
  const f_iw = -qx * fx - qy * fy - qz * fz;

  const fx_w = f_ix * qw + f_iw * -qx + f_iy * -qz - f_iz * -qy;
  const fy_w = f_iy * qw + f_iw * -qy + f_iz * -qx - f_ix * -qz;
  const fz_w = f_iz * qw + f_iw * -qz + f_ix * -qy - f_iy * -qx;

  // ---- rotate up ----
  const u_ix =  qw * ux + qy * uz - qz * uy;
  const u_iy =  qw * uy + qz * ux - qx * uz;
  const u_iz =  qw * uz + qx * uy - qy * ux;
  const u_iw = -qx * ux - qy * uy - qz * uz;

  const ux_w = u_ix * qw + u_iw * -qx + u_iy * -qz - u_iz * -qy;
  const uy_w = u_iy * qw + u_iw * -qy + u_iz * -qx - u_ix * -qz;
  const uz_w = u_iz * qw + u_iw * -qz + u_ix * -qy - u_iy * -qx;

  // ✅ YAW from horizontal projection (correct for AR)
  let yaw = Math.atan2(fx_w, fy_w);

  // pitch
  const fz_clamped = Math.max(-1, Math.min(1, fz_w));
  let pitch = Math.asin(fz_clamped);

  // roll (stable enough)
  let roll = Math.atan2(ux_w, uz_w);

  return {
    roll: roll * 180 / Math.PI,
    pitch: pitch * 180 / Math.PI,
    yaw: (yaw * 180 / Math.PI + 360) % 360
  };
}
function getCameraVector(qx, qy, qz, qw) {
  // 1. Camera forward in DEVICE frame (usually -Z)
  const vx = 0, vy = 0, vz = -1;

  // 2. Extract the vector part of the quaternion
  // Using the formula: v' = v + 2w(q_vec x v) + 2(q_vec x (q_vec x v))

  // To rotate world -> device, use (qx, qy, qz, qw)
  // To rotate device -> world, use inverse: (-qx, -qy, -qz, qw)
  const ix = -qx, iy = -qy, iz = -qz, iw = qw;

  // Calculate the cross product [q_vec x v]
  const tx = 2 * (iy * vz - iz * vy);
  const ty = 2 * (iz * vx - ix * vz);
  const tz = 2 * (ix * vy - iy * vx);

  // Apply the final rotation
  const x = vx + iw * tx + (iy * tz - iz * ty);
  const y = vy + iw * ty + (iz * tx - ix * tz);
  const z = vz + iw * tz + (ix * ty - iy * tx);

  return { x, y, z };
}
function getWorldVectorFromDevice(qx, qy, qz, qw) {
  // 1. Define the camera "Forward" in the DEVICE frame
  // Usually, the back camera points toward -Z (out the back of the screen)
  const vx = 0, vy = 0, vz = -1;

  // 2. To go Device -> World, use the quaternion AS IS (no negation)
  const xq = qx, yq = qy, zq = qz, wq = qw;

  // 3. Calculate (q_vec x v) - the cross product of quaternion vector part and device vector
  const tx = 2 * (yq * vz - zq * vy);
  const ty = 2 * (zq * vx - xq * vz);
  const tz = 2 * (xq * vy - yq * vx);

  // 4. Calculate v_world = v + w*t + (q_vec x t)
  const resX = vx + wq * tx + (yq * tz - zq * ty);
  const resY = vy + wq * ty + (zq * tx - xq * tz);
  const resZ = vz + wq * tz + (xq * ty - yq * tx);

  return { x: resX, y: resY, z: resZ };
}