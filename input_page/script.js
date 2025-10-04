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

// Handle form submission
document.getElementById('weatherForm').addEventListener('submit', function(e) {
  e.preventDefault();

  let lat = document.getElementById('lat').value;
  let lon = document.getElementById('lon').value;
  let date = document.getElementById('date').value;
  let time = document.getElementById('time').value; // <-- New line to get time input

  if (!lat || !lon) {
    alert("Please select a location on the map.");
    return;
  }

  // Redirect to output page with query params (include time)
  window.location.href = `../output_page/index.html?lat=${lat}&lon=${lon}&date=${date}&time=${time}`;
});
