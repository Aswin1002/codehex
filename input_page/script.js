// Initialize map
let map = L.map('map').setView([20, 78], 5); // Default India view

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;

// Handle map clicks
map.on('click', function(e) {
  if (marker) map.removeLayer(marker);
  marker = L.marker(e.latlng).addTo(map);

  document.getElementById('lat').value = e.latlng.lat;
  document.getElementById('lon').value = e.latlng.lng;
});

// --- Text location input ---
const locationInput = document.getElementById('location');
locationInput.addEventListener('change', async function() {
  const location = locationInput.value.trim();
  if (!location) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      // Set hidden inputs
      document.getElementById('lat').value = lat;
      document.getElementById('lon').value = lon;

      // Move map and add marker
      if (marker) map.removeLayer(marker);
      marker = L.marker([lat, lon]).addTo(map);
      map.setView([lat, lon], 10);
    } else {
      alert("Location not found. Please enter a valid location.");
    }
  } catch (err) {
    console.error(err);
    alert("Error fetching location data.");
  }
});

// Handle form submission
document.getElementById('weatherForm').addEventListener('submit', function(e) {
  e.preventDefault();

  let lat = document.getElementById('lat').value;
  let lon = document.getElementById('lon').value;
  let date = document.getElementById('date').value;
  let time = document.getElementById('time').value;

  if (!lat || !lon) {
    alert("Please select a location on the map or enter a location.");
    return;
  }

  // Check if date is today
  const today = new Date();
  const inputDate = new Date(date);
  const isToday = (inputDate.toDateString() === today.toDateString());

  // Append a flag in URL to indicate live data or historical
  window.location.href = `../output_page/index.html?lat=${lat}&lon=${lon}&date=${date}&time=${time}&live=${isToday}`;
});
