var map = L.map('map', {attributionControl: false}).setView([20, 0], 2)
var myAttrControl = L.control.attribution().addTo(map);
myAttrControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');


L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);


const API_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query.geojson?starttime=2026-01-01%2000:00:00&endtime=2026-04-01%2023:59:59&minmagnitude=2.5&orderby=time&limit=5000"

let allEarthquakes = [];
let filteredEarthquakes = [];
let markersLayer = L.layerGroup().addTo(map)

async function loadEarthquakes() {
    const response = await fetch(API_URL);
    const data = await response.json();

    allEarthquakes = data.features;
    filteredEarthquakes = allEarthquakes;

    renderEarthquakes(allEarthquakes);
}

loadEarthquakes();

function getMarkerColor(depth) {
    if (depth < 50) return "green";
    if (depth < 100) return "yellow";
    if (depth < 300) return "orange";
    return "red"; 
}

function renderEarthquakes(features) {
    markersLayer.clearLayers();
    
    const markerRadius = parseFloat(document.getElementById("markerRadius").value);
    const fillOpacity = parseFloat(document.getElementById("fillOpacity").value);

    features.forEach(f => {
        const coords = f.geometry.coordinates;

        const lon = coords[0];
        const lat = coords[1];
        const depth = coords[2];
        const mag = f.properties.mag;
        const place = f.properties.place;
        const time = new Date(f.properties.time).toLocaleString();

        const marker = L.circleMarker([lat, lon], {
            radius: mag * markerRadius,
            fillColor: getMarkerColor(depth),
            color: getMarkerColor(depth),
            fillOpacity: fillOpacity,
            weight: 1
        }).addTo(markersLayer);

        marker.bindPopup(`
            <b>${place}</b><br>
            Magnitude: ${mag}<br>
            Depth: ${depth} km<br>
            Date: ${time}
        `);
    });
}

function applyFilter() {
    const maxEvents = parseInt(document.getElementById("maxEvents").value);
    const minMag = parseFloat(document.getElementById("minMag").value) || 0;
    const maxMag = parseFloat(document.getElementById("maxMag").value) || 10;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const minDepth = parseFloat(document.getElementById("minDepth").value) || 0;
    const maxDepth = parseFloat(document.getElementById("maxDepth").value) || Infinity;

    const startTime = startDate ? new Date(startDate).getTime() : 0;
    const endTime = endDate ? new Date(endDate).getTime() : Infinity;

    filteredEarthquakes = allEarthquakes.filter(f => {
        const mag = f.properties.mag;
        const time = f.properties.time;
        const depth = f.geometry.coordinates[2];

        return (
            mag >= minMag &&
            mag <= maxMag &&
            time >= startTime &&
            time <= endTime &&
            depth >= minDepth &&
            depth <= maxDepth
        );
    }).slice(0, maxEvents);

    renderEarthquakes(filteredEarthquakes);
}

function resetFilters() {
    document.getElementById("maxEvents").value = "5000";
    document.getElementById("minMag").value = "2.5";
    document.getElementById("maxMag").value = "10";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("minDepth").value = "0";
    document.getElementById("maxDepth").value = "1000";

    filteredEarthquakes = allEarthquakes;
    renderEarthquakes(filteredEarthquakes);
}

function updateMarkerSettings() {
    renderEarthquakes(filteredEarthquakes);
}
