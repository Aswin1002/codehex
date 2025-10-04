let map = L.map('map').setView([20, 78], 5); // Default India view

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let marker;

map.on('click', function(e) {
  if (marker) map.removeLayer(marker);
  marker = L.marker(e.latlng).addTo(map);

  document.getElementById('lat').value = e.latlng.lat;
  document.getElementById('lon').value = e.latlng.lng;
});

document.getElementById('weatherForm').addEventListener('submit', function(e) {
  e.preventDefault();
  let lat = document.getElementById('lat').value;
  let lon = document.getElementById('lon').value;
  let date = document.getElementById('date').value;

  // Redirect to output page with query params
  window.location.href = `../output_page/index.html?lat=${lat}&lon=${lon}&date=${date}`;
});
