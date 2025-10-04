// --- Parse query parameters ---
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date"); // YYYY-MM-DD
const time = urlParams.get("time"); // HH:MM
const resultsDiv = document.getElementById("results");

// --- Helpers ---
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

function classifyWeather(temp, wind, humidity) {
    let condition = "Clear";
    if (wind > 10) condition = "Windy";
    else if (temp > 35) condition = "Very Hot";
    else if (temp < 5) condition = "Very Cold";
    else if (humidity > 80) condition = "Humid";
    return condition;
}

async function getLocationName(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await res.json();
        return data.address.city || data.address.town || data.address.village || data.address.state || `${lat}, ${lon}`;
    } catch {
        return `${lat}, ${lon}`;
    }
}

// --- NASA POWER API fetch function ---
async function fetchNASAData(lat, lon, dateStr) {
    const inputDate = new Date(dateStr);
    const month = inputDate.getMonth() + 1;
    const day = inputDate.getDate();
    const currentYear = new Date().getFullYear();
    const yearsBack = 20;

    const fetchPromises = [];
    for (let y = currentYear - yearsBack; y <= currentYear - 1; y++) {
        const formattedDate = `${y}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
        const startEnd = formattedDate.replace(/-/g,"");
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,RH2M&community=RE&longitude=${lon}&latitude=${lat}&start=${startEnd}&end=${startEnd}&format=JSON`;
        fetchPromises.push(fetch(url).then(res=>res.json()).then(data=>({year:y,data})));
    }

    return await Promise.all(fetchPromises);
}

// --- GIBS / GPM Image URL Helper ---
function getSatelliteImageURL(lat, lon) {
    // Example: NASA GIBS Blue Marble Cloud Layer (static for simplicity)
    // You can replace with actual GIBS WMTS tiles for interactive maps
    return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&HEIGHT=300&WIDTH=300&BBOX=${lat-1},${lon-1},${lat+1},${lon+1}&CRS=EPSG:4326`;
}

// --- Display function ---
async function displayWeather() {
    if (!lat || !lon || !date) {
        resultsDiv.innerHTML = "Please provide latitude, longitude, and date.";
        return;
    }

    const locationName = await getLocationName(lat, lon);
    const inputDate = new Date(date);
    const isToday = inputDate.toDateString() === new Date().toDateString();

    let tempAvg=0, windAvg=0, humidityAvg=0;

    try {
        // --- Fetch historical data ---
        const responses = await fetchNASAData(lat, lon, date);
        console.log(responses);
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

        tempAvg = avg(temps).toFixed(1);
        windAvg = avg(winds).toFixed(1);
        humidityAvg = avg(humidities).toFixed(1);

        const condition = classifyWeather(tempAvg, windAvg, humidityAvg);

        // --- Satellite Image URL ---
        const satImgURL = getSatelliteImageURL(parseFloat(lat), parseFloat(lon));

        // --- Display Cards ---
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
                <div class="card">
                    <h2>Satellite View</h2>
                    <img src="${satImgURL}" alt="Satellite Image" style="width:100%;border-radius:12px;"/>
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = "Error fetching weather data from NASA APIs.";
    }
}

displayWeather();
