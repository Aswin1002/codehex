// --- Parse query parameters ---
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date"); // YYYY-MM-DD

// --- Helper functions ---
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

// Weighted average: weights recent years more
function weightedAverage(values, weights) {
    const totalWeight = weights.reduce((a,b)=>a+b,0);
    return values.reduce((sum, val, i) => sum + val * weights[i], 0) / totalWeight;
}

// Simple linear regression for trend estimation
function linearTrend(x, y) {
    const n = x.length;
    const meanX = avg(x);
    const meanY = avg(y);
    const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX)*(y[i] - meanY), 0);
    const denominator = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;
    return { slope, intercept };
}

function classifyWeather(temp, wind, humidity) {  
    if (wind > 10) return "Windy";
    if (temp > 35) return "Very Hot";
    if (temp < 5) return "Very Cold";
    if (humidity > 80) return "Humid";
    return "Clear";
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

// --- Fetch NASA POWER historical data ---
async function fetchNASAData(lat, lon, dateStr) {
    const inputDate = new Date(dateStr);
    const month = inputDate.getMonth() + 1;
    const day = inputDate.getDate();
    const currentYear = new Date().getFullYear();
    const yearsBack = 5;

    const fetchPromises = [];
    for (let y = currentYear - yearsBack; y <= currentYear - 1; y++) {
        const formattedDate = `${y}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
        const startEnd = formattedDate.replace(/-/g,"");
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,WS2M,RH2M&community=RE&longitude=${lon}&latitude=${lat}&start=${startEnd}&end=${startEnd}&format=JSON`;
        fetchPromises.push(fetch(url).then(res=>res.json()).then(data=>({year:y,data})));
    }

    return await Promise.all(fetchPromises);
}

// --- Display forecast and allow download ---
async function displayForecast() {
    if (!lat || !lon || !date) return;

    const locationName = await getLocationName(lat, lon);
    const responses = await fetchNASAData(lat, lon, date);

    let temps = [], winds = [], humidities = [];
    let conditionCounts = { Clear:0, Windy:0, "Very Hot":0, "Very Cold":0, Humid:0 };
    let years = [];

    for (let resp of responses) {
        const weather = resp.data.properties?.parameter;
        if (!weather) continue;

        const tVal = weather.T2M ? Object.values(weather.T2M)[0] : null;
        const wVal = weather.WS2M ? Object.values(weather.WS2M)[0] : null;
        const hVal = weather.RH2M ? Object.values(weather.RH2M)[0] : null;

        if (tVal !== null) temps.push(tVal);
        if (wVal !== null) winds.push(wVal);
        if (hVal !== null) humidities.push(hVal);

        if (tVal !== null && wVal !== null && hVal !== null) {
            const condition = classifyWeather(tVal, wVal, hVal);
            conditionCounts[condition]++;
        }

        years.push(resp.year);
    }

    // --- Weight setup: more recent years have higher weights ---
    const weights = years.map((_, i) => i + 1);

    // --- Weighted averages ---
    const tempWeighted = weightedAverage(temps, weights);
    const windWeighted = weightedAverage(winds, weights);
    const humidityWeighted = weightedAverage(humidities, weights);

    // --- Trend-based projection (predict for next year) ---
    const tempTrend = linearTrend(years, temps);
    const windTrend = linearTrend(years, winds);
    const humidityTrend = linearTrend(years, humidities);

    const nextYear = Math.max(...years) + 1;
    const projectedTemp = tempTrend.intercept + tempTrend.slope * nextYear;
    const projectedWind = windTrend.intercept + windTrend.slope * nextYear;
    const projectedHumidity = humidityTrend.intercept + humidityTrend.slope * nextYear;

    // --- Combine weighted + trend for more robust estimate ---
    const tempAvg = ((tempWeighted + projectedTemp) / 2).toFixed(1);
    const windAvg = ((windWeighted + projectedWind) / 2).toFixed(1);
    const humidityAvg = ((humidityWeighted + projectedHumidity) / 2).toFixed(1);

    const overallCondition = classifyWeather(tempAvg, windAvg, humidityAvg);

    let descriptionText = "";
    switch (overallCondition) {
        case "Clear": descriptionText = "CLEAR:The weather is likely to be clear and pleasant."; break;
        case "Windy": descriptionText = "WINDY:Expect breezy or windy conditions during this time."; break;
        case "Very Hot": descriptionText = "VERY HOT:Temperatures are likely to be very high; stay hydrated!"; break;
        case "Very Cold": descriptionText = "VERY COLD:The weather may be quite cold; warm clothing is advised."; break;
        case "Humid": descriptionText = "HUMID:High humidity levels expected; it may feel muggy."; break;
    }

    // --- Update UI ---
    document.getElementById('locName').innerText = locationName;
    document.getElementById('locDate').innerText = `📅 On date: ${date}`;
    document.getElementById('locDescription').innerText = descriptionText;
    document.getElementById('tempAvg').innerText = `Estimated Avg: ${tempAvg} °C`;
    document.getElementById('humidityAvg').innerText = `Estimated Avg: ${humidityAvg} %`;
    document.getElementById('windAvg').innerText = `Estimated Avg: ${windAvg} m/s`;

    // --- Chart Rendering ---
    Chart.defaults.color = '#ffffff';
    new Chart(document.getElementById('tempChart'), {
        type: 'line',
        data: { labels: years, datasets: [{ label:'Temperature (°C)', data: temps, borderColor:'#ff6384', backgroundColor:'rgba(255,99,132,0.2)', fill:true }] }
    });

    new Chart(document.getElementById('humidityChart'), {
        type: 'line',
        data: { labels: years, datasets: [{ label:'Humidity (%)', data: humidities, borderColor:'#36a2eb', backgroundColor:'rgba(54,162,235,0.2)', fill:true }] }
    });

    new Chart(document.getElementById('windChart'), {
        type: 'line',
        data: { labels: years, datasets: [{ label:'Wind Speed (m/s)', data: winds, borderColor:'#ffce56', backgroundColor:'rgba(255,206,86,0.2)', fill:true }] }
    });

    new Chart(document.getElementById('conditionChart'), {
        type: 'pie',
        data: { labels:Object.keys(conditionCounts), datasets:[{data:Object.values(conditionCounts), backgroundColor:['#36a2eb','#ff6384','#ffce56','#8a2be2','#00ff7f']}] }
    });

    // --- Prepare data for JSON download ---
    const weatherData = {
        location: locationName,
        coordinates: { lat, lon },
        date,
        description: descriptionText,
        averages: { temperature: tempAvg, windSpeed: windAvg, humidity: humidityAvg },
        trendSlopes: { tempTrend: tempTrend.slope, windTrend: windTrend.slope, humidityTrend: humidityTrend.slope },
        yearlyData: years.map((y,i)=>({
            year: y,
            temperature: temps[i],
            windSpeed: winds[i],
            humidity: humidities[i]
        })),
        probableConditions: conditionCounts
    };

    // --- Attach download to existing button ---
    const downloadButton = document.getElementById("downloadJson");
    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            try {
                const jsonStr = JSON.stringify(weatherData, null, 2);
                const blob = new Blob([jsonStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);

                const safeLocation = (locationName || "location").replace(/[^\w\-_. ]+/g, "_");
                const safeDate = (date || "date").replace(/[^\w\-_. ]+/g, "_");
                const filename = `${safeLocation}_${safeDate}_weather.json`;

                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (err) {
                console.error("Download failed:", err);
                alert("Failed to download JSON — check console for details.");
            }
        });
    }
}

displayForecast();
