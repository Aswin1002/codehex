// --- Parse query parameters ---
const urlParams = new URLSearchParams(window.location.search);
const lat = urlParams.get("lat");
const lon = urlParams.get("lon");
const date = urlParams.get("date"); // YYYY-MM-DD
const resultsDiv = document.getElementById("results");

// --- Helpers ---
const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;

function classifyWeather(temp, wind, humidity) {  
    if (wind > 10) return "Windy";
    if (temp > 35) return "Very Hot";
    if (temp < 5) return "Very Cold";
    if (humidity > 80) return "Humid";
    return "Clear";
}

// --- Fetch NASA POWER historical data ---
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

// --- Main function ---
async function displayForecast() {
    if (!lat || !lon || !date) {
        resultsDiv.innerHTML = "Please provide latitude, longitude, and date.";
        return;
    }

    resultsDiv.innerHTML = "Loading data from NASA POWER API...";

    try {
        const responses = await fetchNASAData(lat, lon, date);

        let temps=[], winds=[], humidities=[];
        let conditionCounts = {Clear:0, Windy:0, "Very Hot":0, "Very Cold":0, Humid:0};
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

        // --- Display numeric averages ---
        const tempAvg = avg(temps).toFixed(1);
        const windAvg = avg(winds).toFixed(1);
        const humidityAvg = avg(humidities).toFixed(1);

        resultsDiv.innerHTML = `
            <div class="output">
                <p><b>Latitude:</b> ${lat}, <b>Longitude:</b> ${lon}</p>
                <p><b>Date:</b> ${date}</p>
                <p><b>Average Temp:</b> ${tempAvg} °C</p>
                <p><b>Average Wind:</b> ${windAvg} m/s</p>
                <p><b>Average Humidity:</b> ${humidityAvg} %</p>
            </div>
        `;

        // --- Chart.js graphs ---
        // Temperature trend
        new Chart(document.getElementById('tempChart'), {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Temperature (°C)',
                    data: temps,
                    borderColor: '#ff6384',
                    backgroundColor: 'rgba(255,99,132,0.2)',
                    fill: true
                }]
            },
            options: { responsive:true, plugins:{legend:{display:true}} }
        });

        // Humidity trend
        new Chart(document.getElementById('humidityChart'), {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Humidity (%)',
                    data: humidities,
                    borderColor: '#36a2eb',
                    backgroundColor: 'rgba(54,162,235,0.2)',
                    fill: true
                }]
            }
        });

        // Wind trend
        new Chart(document.getElementById('windChart'), {
            type: 'line',
            data: {
                labels: years,
                datasets: [{
                    label: 'Wind Speed (m/s)',
                    data: winds,
                    borderColor: '#ffce56',
                    backgroundColor: 'rgba(255,206,86,0.2)',
                    fill: true
                }]
            }
        });

        // Probable weather conditions (pie chart)
        new Chart(document.getElementById('conditionChart'), {
            type: 'pie',
            data: {
                labels: Object.keys(conditionCounts),
                datasets: [{
                    label: 'Condition Frequency',
                    data: Object.values(conditionCounts),
                    backgroundColor: [
                        '#36a2eb', '#ff6384', '#ffce56', '#8a2be2', '#00ff7f'
                    ]
                }]
            }
        });

    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = "Error fetching data from NASA POWER API.";
    }
}

displayForecast();
