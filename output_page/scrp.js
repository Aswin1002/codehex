// Parse query params
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date"); // YYYY-MM-DD
const time = urlParams.get("time"); // HH:MM
const live = urlParams.get("live") === "true"; // true if date = today

const resultsDiv = document.getElementById("results");

// Helper: average function
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

// Helper: simple weather condition classifier
function classifyWeather(temp, wind, humidity) {
  let condition = "Clear";
  if (wind > 10) condition = "Windy";
  else if (temp > 35) condition = "Very Hot";
  else if (temp < 5) condition = "Very Cold";
  else if (humidity > 80) condition = "Humid";
  return condition;
}

// Helper: get location name from coordinates
async function getLocationName(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    return data.address.city || data.address.town || data.address.village || data.address.state || `${lat}, ${lon}`;
  } catch {
    return `${lat}, ${lon}`;
  }
}

// Fetch live or historical data
async function displayWeather() {
  const locationName = await getLocationName(lat, lon);

  if (!lat || !lon || !date) {
    resultsDiv.innerHTML = "Please provide latitude, longitude, and date.";
    return;
  }

  try {
    if (live) {
      // --- LIVE WEATHER using OpenWeatherMap API ---
      const apiKey = "YOUR_OPENWEATHERMAP_API_KEY"; // <-- add your API key
      const liveUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      const res = await fetch(liveUrl);
      const data = await res.json();

      const temp = data.main.temp;
      const humidity = data.main.humidity;
      const wind = data.wind.speed;
      const condition = classifyWeather(temp, wind, humidity);

      resultsDiv.innerHTML = `
        <div class="output">
          <div class="card">
            <h2>Location & Time</h2>
            <p><b>Location:</b> ${locationName}</p>
            <p><b>Date:</b> ${date}</p>
            <p><b>Time:</b> ${time || "N/A"}</p>
          </div>
          <div class="card">
            <h2>Temperature & Humidity</h2>
            <p><b>Temperature:</b> ${temp.toFixed(1)} °C</p>
            <p><b>Humidity:</b> ${humidity} %</p>
          </div>
          <div class="card">
            <h2>Wind & Condition</h2>
            <p><b>Wind Speed:</b> ${wind} m/s</p>
            <p><b>Condition:</b> ${condition}</p>
          </div>
        </div>
      `;
    } else {
      // --- HISTORICAL WEATHER (NASA POWER API) ---
      const inputDate = new Date(date);
      const month = inputDate.getMonth() + 1;
      const day = inputDate.getDate();
      const currentYear = new Date().getFullYear();
      const yearsBack = 20;

      const fetchPromises = [];
      for (let y = currentYear - yearsBack; y <= currentYear - 1; y++) {
        const formattedDate = `${y}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
        const startEnd = formattedDate.replace(/-/g, "");
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,RH2M&community=RE&longitude=${lon}&latitude=${lat}&start=${startEnd}&end=${startEnd}&format=JSON`;
        fetchPromises.push(fetch(url).then(res=>res.json()).then(data=>({year:y,data})));
      }

      const responses = await Promise.all(fetchPromises);

      let temps=[], winds=[], humidities=[];

      for (let resp of responses) {
        const weather = resp.data.properties?.parameter;
        if (!weather) continue;

        const tKeys = Object.keys(weather.T2M||{});
        if(tKeys.length) temps.push(weather.T2M[tKeys[0]]);

        const wKeys = Object.keys(weather.WS2M||{});
        if(wKeys.length) winds.push(weather.WS2M[wKeys[0]]);

        const hKeys = Object.keys(weather.RH2M||{});
        if(hKeys.length) humidities.push(weather.RH2M[hKeys[0]]);
      }

      const tempAvg = avg(temps).toFixed(1);
      const windAvg = avg(winds).toFixed(1);
      const humidityAvg = avg(humidities).toFixed(1);
      const condition = classifyWeather(tempAvg, windAvg, humidityAvg);

      resultsDiv.innerHTML = `
        <div class="output">
          <div class="card">
            <h2>Location & Time</h2>
            <p><b>Location:</b> ${locationName}</p>
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
    }
  } catch (error) {
    console.error(error);
    resultsDiv.innerHTML = "Error fetching weather data.";
  }
}

displayWeather();
