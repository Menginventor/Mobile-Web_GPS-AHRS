const startBtn = document.getElementById("startBtn");

// ==========================
// START BUTTON
// ==========================
startBtn.addEventListener("click", async () => {

  // iOS permission (safe fallback)
  if (typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      await DeviceMotionEvent.requestPermission();
    } catch (e) {
      console.warn("Permission denied");
    }
  }

  startGPS();
  startOrientation();
  startQuaternionSensor(); // ✅ NEW
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
// DEVICE ORIENTATION (Euler)
// ==========================
function startOrientation() {
  window.addEventListener("deviceorientation", (event) => {

    const alpha = event.alpha || 0;
    const beta  = event.beta  || 0;
    const gamma = event.gamma || 0;

    document.getElementById("alpha").textContent = alpha.toFixed(2);
    document.getElementById("beta").textContent  = beta.toFixed(2);
    document.getElementById("gamma").textContent = gamma.toFixed(2);

    // ==========================
    // COMPASS HEADING
    // ==========================
    let heading;

    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading; // iOS
    } else {
      heading = 360 - alpha; // Android fallback
    }

    heading = (heading + 360) % 360;

    document.getElementById("heading").textContent = heading.toFixed(1);
    document.getElementById("headingBig").textContent =
      heading.toFixed(0) + "°";
  });
}


// ==========================
// QUATERNION (Sensor API)
// ==========================
let orientationSensor = null;

function startQuaternionSensor() {
  try {
    orientationSensor = new AbsoluteOrientationSensor({
      frequency: 60,
      referenceFrame: "device"
    });

    orientationSensor.addEventListener("reading", () => {
      const q = orientationSensor.quaternion; // [x, y, z, w]

      document.getElementById("qx").textContent = q[0].toFixed(4);
      document.getElementById("qy").textContent = q[1].toFixed(4);
      document.getElementById("qz").textContent = q[2].toFixed(4);
      document.getElementById("qw").textContent = q[3].toFixed(4);
    });

    orientationSensor.addEventListener("error", (event) => {
      console.error("Quaternion sensor error:", event.error.name);
    });

    orientationSensor.start();

  } catch (err) {
    console.warn("AbsoluteOrientationSensor not supported:", err);
  }
}