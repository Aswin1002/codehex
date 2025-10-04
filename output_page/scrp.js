// Parse query params
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date");
const time = urlParams.get("time");

async function getLocationName(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
    );
    const data = await res.json();
    return (
      data.address.city ||
      data.address.town ||
      data.address.village ||
      data.address.state ||
      data.address.country ||
      "Unknown Location"
    );
  } catch (error) {
    console.error("Error fetching location name:", error);
    return "Unknown Location";
  }
}

async function getHistoricalAverage() {
  const resultsDiv = document.getElementById("results");

  if (!lat || !lon || !date) {
    resultsDiv.innerHTML = "Please provide latitude, longitude, and date.";
    return;
  }

  const inputDate = new Date(date);
  const month = inputDate.getMonth() + 1;
  const day = inputDate.getDate();
  const currentYear = new Date().getFullYear();
  const yearsBack = 20;

  try {
    // Get readable location name
    const locationName = await getLocationName(lat, lon);

    // Fetch past 20 years of data
    const fetchPromises = [];
    for (let y = currentYear - yearsBack; y <= currentYear - 1; y++) {
      const formattedDate = `${y}-${month.toString().padStart(2, "0")}-${day
        .toString()
        .padStart(2, "0")}`;
      const startEnd = formattedDate.replace(/-/g, "");
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,RH2M&community=RE&longitude=${lon}&latitude=${lat}&start=${startEnd}&end=${startEnd}&format=JSON`;

      fetchPromises.push(
        fetch(url)
          .then((res) => res.json())
          .then((data) => ({ year: y, data }))
      );
    }

    const responses = await Promise.all(fetchPromises);

    let temps = [],
      winds = [],
      humidities = [],
      years = [];

    for (let resp of responses) {
      const weather = resp.data.properties?.parameter;
      if (!weather) {
        console.warn("No data object for year:", resp.year);
        continue;
      }

      const tKeys = Object.keys(weather.T2M || {});
      if (tKeys.length) temps.push(weather.T2M[tKeys[0]]);

      const wKeys = Object.keys(weather.WS2M || {});
      if (wKeys.length) winds.push(weather.WS2M[wKeys[0]]);

      const hKeys = Object.keys(weather.RH2M || {});
      if (hKeys.length) humidities.push(weather.RH2M[hKeys[0]]);

      years.push(resp.year);
    }

    if (temps.length === 0) {
      resultsDiv.innerHTML = "No historical data available for this date.";
      return;
    }

    const avg = (arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const tempAvg = avg(temps).toFixed(1);
    const windAvg = avg(winds).toFixed(1);
    const humidityAvg = avg(humidities).toFixed(1);

    let condition = "Clear";
    if (windAvg > 10) condition = "Windy";
    else if (tempAvg > 35) condition = "Very Hot";
    else if (tempAvg < 5) condition = "Very Cold";
    else if (humidityAvg > 80) condition = "Humid";

   resultsDiv.innerHTML = `
  <div class="output">
    <div class="card">
      <h2>Location & Time</h2>
      <p class="loctn"><b>Location:</b> ${locationName}</p>
      <p><b>Date:</b> ${date}</p>
      <p><b>Time:</b> ${time || "N/A"}</p>
    </div>
    
    <div class="card">
      <h2>Temperature & Humidity</h2>
      <p><b>Average Temperature:</b> ${tempAvg} °C</p>
      <p><b>Average Humidity:</b> ${humidityAvg} %</p>
    </div>
    
    <div class="card">
      <h2>Wind & Condition</h2>
      <p><b>Average Wind Speed:</b> ${windAvg} m/s</p>
      <p><b>Condition:</b> ${condition}</p>
    </div>
  </div>
`;

  } catch (error) {
    console.error(error);
    resultsDiv.innerHTML = "Error fetching historical weather data.";
  }
}

getHistoricalAverage();
