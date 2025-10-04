// Parse query params
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date"); // format YYYY-MM-DD

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
    // Fetch past 20 years of data
    const fetchPromises = [];
    for (let y = currentYear - yearsBack; y <= currentYear - 1; y++) {
      const formattedDate = `${y}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
      const startEnd = formattedDate.replace(/-/g,"");
      const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,RH2M,PRECTOT&community=RE&longitude=${lon}&latitude=${lat}&start=${startEnd}&end=${startEnd}&format=JSON`;
      fetchPromises.push(
        fetch(url)
          .then(res => res.json())
          .then(data => ({year: y, data}))
      );
    }

    const responses = await Promise.all(fetchPromises);

    let temps = [], winds = [], humidities = [], rains = [], years = [];

    for (let resp of responses) {
      const weather = resp.data.properties?.parameter;
      if (!weather) {
        console.warn("No data object for year:", resp.year);
        continue; // skip if no data
      }

      // Get the keys for T2M safely
      const tKeys = Object.keys(weather.T2M || {});
      const wKeys = Object.keys(weather.WS2M || {});
      const hKeys = Object.keys(weather.RH2M || {});
      const rKeys = Object.keys(weather.PRECTOT || {});

      if (tKeys.length === 0) {
        console.warn("No temperature data for year:", resp.year);
      } else {
        const key = tKeys[0];
        temps.push(weather.T2M[key]);
      }

      if (wKeys.length === 0) {
        console.warn("No wind data for year:", resp.year);
      } else {
        const key = wKeys[0];
        winds.push(weather.WS2M[key]);
      }

      if (hKeys.length === 0) {
        console.warn("No humidity data for year:", resp.year);
      } else {
        const key = hKeys[0];
        humidities.push(weather.RH2M[key]);
      }

      if (rKeys.length === 0) {
        console.warn("No precipitation data for year:", resp.year);
      } else {
        const key = rKeys[0];
        rains.push(weather.PRECTOT[key]);
      }

      years.push(resp.year); // track which years had data
    }

    if (temps.length === 0) {
      resultsDiv.innerHTML = "No historical data available for this date.";
      return;
    }

    // Helper: safe average
    const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

    // Compute averages
    const tempAvg = avg(temps).toFixed(1);
    const windAvg = avg(winds).toFixed(1);
    const humidityAvg = avg(humidities).toFixed(1);
    const rainAvg = avg(rains).toFixed(1);

    // Simple condition classifier
    let condition = "Clear";
    if (rainAvg > 5) condition = "Rainy";
    else if (windAvg > 10) condition = "Windy";
    else if (tempAvg > 35) condition = "Very Hot";
    else if (tempAvg < 5) condition = "Very Cold";
    else if (humidityAvg > 80) condition = "Humid";

    resultsDiv.innerHTML = `
      <p><b>Location:</b> [${lat}, ${lon}]</p>
      <p><b>Date (Input):</b> ${date}</p>
      <p><b>Average Temperature:</b> ${tempAvg} °C</p>
      <p><b>Average Humidity:</b> ${humidityAvg} %</p>
      <p><b>Average Wind Speed:</b> ${windAvg} m/s</p>
      <p><b>Average Precipitation:</b> ${rainAvg} mm</p>
      <p><b>Condition:</b> ${condition}</p>
    `;

  } catch (error) {
    console.error(error);
    resultsDiv.innerHTML = "Error fetching historical weather data.";
  }
}

// Run the function
getHistoricalAverage();
