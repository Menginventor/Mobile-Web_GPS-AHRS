const latEl = document.getElementById("lat");
const lonEl = document.getElementById("lon");
const accEl = document.getElementById("acc");

const alphaEl = document.getElementById("alpha");
const betaEl = document.getElementById("beta");
const gammaEl = document.getElementById("gamma");
const headingEl = document.getElementById("heading");

document.getElementById("startBtn").onclick = async () => {
  startGPS();
  await startOrientation();
};

// ---------------- GPS ----------------
function startGPS() {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.watchPosition(
    (pos) => {
      latEl.textContent = pos.coords.latitude.toFixed(6);
      lonEl.textContent = pos.coords.longitude.toFixed(6);
      accEl.textContent = pos.coords.accuracy.toFixed(1);
    },
    (err) => {
      alert("GPS error: " + err.message);
    },
    { enableHighAccuracy: true }
  );
}

// ---------------- AHRS / Orientation ----------------
async function startOrientation() {
  // iOS permission
  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    try {
      const response = await DeviceOrientationEvent.requestPermission();
      if (response !== "granted") {
        alert("Permission denied");
        return;
      }
    } catch (e) {
      alert("Permission error");
      return;
    }
  }

  window.addEventListener("deviceorientation", (event) => {
    const alpha = event.alpha || 0; // Z
    const beta = event.beta || 0;   // X
    const gamma = event.gamma || 0; // Y

    alphaEl.textContent = alpha.toFixed(1);
    betaEl.textContent = beta.toFixed(1);
    gammaEl.textContent = gamma.toFixed(1);

    // Approx compass heading
    const heading = 360 - alpha;
    headingEl.textContent = heading.toFixed(1);
  });
}