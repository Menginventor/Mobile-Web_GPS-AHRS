const startBtn = document.getElementById("startBtn");

// ==========================
// START BUTTON
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
// GPS
// ==========================
function startGPS() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition((pos) => {
    document.getElementById("lat").textContent = pos.coords.latitude.toFixed(6);
    document.getElementById("lon").textContent = pos.coords.longitude.toFixed(6);
    document.getElementById("acc").textContent = pos.coords.accuracy.toFixed(2);
    document.getElementById("alt").textContent =
      pos.coords.altitude ? pos.coords.altitude.toFixed(2) : "-";
  });
}


// ==========================
// QUATERNION SENSOR
// ==========================
let sensor = null;

function startQuaternionSensor() {
  try {
    sensor = new AbsoluteOrientationSensor({
      frequency: 60,
      referenceFrame: "device"
    });

    sensor.addEventListener("reading", () => {
      const q = sensor.quaternion; // [x, y, z, w]

      const qx = q[0];
      const qy = q[1];
      const qz = q[2];
      const qw = q[3];

      // Display quaternion
      document.getElementById("qx").textContent = qx.toFixed(4);
      document.getElementById("qy").textContent = qy.toFixed(4);
      document.getElementById("qz").textContent = qz.toFixed(4);
      document.getElementById("qw").textContent = qw.toFixed(4);

      // Compute camera RPY
      const rpy = getCameraRPY(qx, qy, qz, qw);

      document.getElementById("yaw").textContent = rpy.yaw.toFixed(1);
      document.getElementById("pitch").textContent = rpy.pitch.toFixed(1);
      document.getElementById("roll").textContent = rpy.roll.toFixed(1);

      // Use yaw as heading
      document.getElementById("heading").textContent = rpy.yaw.toFixed(1);
      document.getElementById("headingBig").textContent =
        rpy.yaw.toFixed(0) + "°";
    });

    sensor.addEventListener("error", (event) => {
      console.error("Sensor error:", event.error.name);
    });

    sensor.start();

  } catch (err) {
    console.warn("AbsoluteOrientationSensor not supported:", err);
    alert("Quaternion sensor not supported on this device/browser.");
  }
}


// ==========================
// CAMERA RPY (CRITICAL PART)
// ==========================
function getCameraRPY(qx, qy, qz, qw) {

  // Camera forward (back camera)
  let fx = 0, fy = 0, fz = -1;

  // Camera up
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

  // ---- compute RPY ----
  let yaw = Math.atan2(fx_w, fy_w);
  let pitch = -Math.asin(-fz_w);
  let roll = Math.atan2(ux_w, uy_w);

  return {
    roll: roll * 180 / Math.PI,
    pitch: pitch * 180 / Math.PI,
    yaw: (yaw * 180 / Math.PI + 360) % 360
  };
}