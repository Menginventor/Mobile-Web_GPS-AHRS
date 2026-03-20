document.addEventListener("DOMContentLoaded", () => {
  // -------- Elements --------
  const latEl = document.getElementById("lat");
  const lonEl = document.getElementById("lon");
  const accEl = document.getElementById("acc");
  const altEl = document.getElementById("alt");

  const alphaEl = document.getElementById("alpha");
  const betaEl = document.getElementById("beta");
  const gammaEl = document.getElementById("gamma");

  const headingEl = document.getElementById("heading");
  const headingBig = document.getElementById("headingBig");

  const startBtn = document.getElementById("startBtn");

  // -------- Button --------
  startBtn.onclick = async () => {
    startGPS();
    await startOrientation();
  };

  // -------- GPS --------
  function startGPS() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;

        latEl.textContent = c.latitude.toFixed(6);
        lonEl.textContent = c.longitude.toFixed(6);
        accEl.textContent = c.accuracy.toFixed(1);

        altEl.textContent =
          c.altitude !== null
            ? c.altitude.toFixed(1)
            : "N/A";
      },
      (err) => {
        alert("GPS error: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  }

  // -------- Orientation / AHRS --------
  async function startOrientation() {
    // iOS permission handling
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

    if (!window.DeviceOrientationEvent) {
      alert("Orientation not supported on this device");
      return;
    }

    window.addEventListener("deviceorientation", (event) => {
      const alpha = event.alpha || 0;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;

      alphaEl.textContent = alpha.toFixed(1);
      betaEl.textContent = beta.toFixed(1);
      gammaEl.textContent = gamma.toFixed(1);

      // Basic compass (NOT tilt-compensated)
      let heading = 360 - alpha;
      if (heading < 0) heading += 360;

      headingEl.textContent = heading.toFixed(1);
      headingBig.textContent = heading.toFixed(0) + "°";
    });
  }
});