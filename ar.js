const startBtn = document.getElementById("startBtn");

let currentLat = null;
let currentLon = null;
let currentYaw = 0;

let targetLat = null;
let targetLon = null;

// ==========================
// READ URL PARAM
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
  startOrientation();

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
// ORIENTATION (COMPASS)
// ==========================
function startOrientation() {

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission();
  }

  window.addEventListener("deviceorientationabsolute", (e) => {

    if (e.alpha !== null) {
      currentYaw = e.alpha; // compass heading
      document.getElementById("yaw").textContent = currentYaw.toFixed(1);
    }
  });
}

// ==========================
// BEARING CALC
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
// AR UPDATE LOOP
// ==========================
function updateAR() {

  if (currentLat !== null && targetLat !== null) {

    const bearing = getBearing(currentLat, currentLon, targetLat, targetLon);

    let diff = bearing - currentYaw;
    diff = ((diff + 540) % 360) - 180;

    document.getElementById("bearing").textContent = bearing.toFixed(1);
    document.getElementById("relative").textContent = diff.toFixed(1);

    // map to screen
    const screenWidth = window.innerWidth;
    const fov = 60;

    const x = (diff / fov) * screenWidth;

    const marker = document.getElementById("marker");
    marker.style.transform = `translate(calc(-50% + ${x}px), -50%)`;
  }

  requestAnimationFrame(updateAR);
}

// ==========================
// INIT
// ==========================
readURL();