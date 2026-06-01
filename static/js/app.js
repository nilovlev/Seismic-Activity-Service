var map = L.map('map', {attributionControl: false, wheelPxPerZoomLevel: 200, zoomSnap: 0, worldCopyJump: true}).setView([20, 0], 2)
var myAttrControl = L.control.attribution().addTo(map);
myAttrControl.setPrefix('<a href="https://leafletjs.com/">Leaflet</a>');

var Stadia_AlidadeSmooth = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.{ext}', {
	minZoom: 0,
	maxZoom: 20,
	attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	ext: 'png'
});

var Esri_WorldStreetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
}).addTo(map);

var GeoportailFrance_plan = L.tileLayer('https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE={style}&TILEMATRIXSET=PM&FORMAT={format}&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', {
	attribution: '<a target="_blank" href="https://www.geoportail.gouv.fr/">Geoportail France</a>',
	bounds: [[-75, -180], [81, 180]],
	minZoom: 2,
	maxZoom: 18,
	format: 'image/png',
	style: 'normal'
});

var Esri_WorldPhysical = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', {
	attribution: 'Tiles &copy; Esri &mdash; Source: US National Park Service',
	maxZoom: 8
});

let allEarthquakes = [];
let markersLayer = L.layerGroup().addTo(map);
let riskLayer = L.layerGroup();

L.control.layers({
    Stadia_AlidadeSmooth,
    Esri_WorldStreetMap,
    Esri_WorldPhysical,
    GeoportailFrance_plan
}, {
    "Earthquakes": markersLayer,
    "Risk map": riskLayer,
}).addTo(map);

async function loadEarthquakes(params = {}) {
    const query = new URLSearchParams(params).toString()
    const url = `/earthquakes?${query}`;

    const response = await fetch(url);
    allEarthquakes = await response.json();
    allEarthquakes.reverse();

    renderEarthquakes(allEarthquakes);
}

loadEarthquakes();

async function loadStatistics(params = {}) {
    const query = new URLSearchParams(params).toString()
    const url = `/statistics?${query}`;

    const response = await fetch(url);
    statistics = await response.json();

    renderCharts(statistics);
}

function getMarkerColor(depth) {
    if (depth <= 50) return "green";
    if (depth <= 100) return "yellow";
    if (depth <= 300) return "orange";
    return "red"; 
}

function renderEarthquakes(features, clear = true) {
    if (clear) {
        markersLayer.clearLayers();
    }
    
    const markerRadius = parseFloat(document.getElementById("markerRadius").value);
    const fillOpacity = parseFloat(document.getElementById("fillOpacity").value);

    features.forEach(f => {
        const lon = f.longitude;
        const lat = f.latitude;
        const depth = f.depth;
        const mag = f.mag;
        const place = f.place;
        const time = new Date(f.time).toLocaleString();

        const shifts = [-360, 0, 360];
        shifts.forEach( shift => {
            const marker = L.circleMarker([lat, lon + shift], {
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
    });
}

function renderCharts(statistics) {
    const yearsStatistics = statistics.years;
    const years = yearsStatistics.map(x => x.year);
    const count = yearsStatistics.map(x => x.count);
    const count3 = yearsStatistics.map(x => x.count3);
    const count4 = yearsStatistics.map(x => x.count4);
    const count5 = yearsStatistics.map(x => x.count5);
    const count6 = yearsStatistics.map(x => x.count6);
    const avgMag = yearsStatistics.map(x => x.avg_mag);
    const avgDepth = yearsStatistics.map(x => x.avg_depth);

    const magStatistics = statistics.mag_hist;
    const magBins = magStatistics.map(x => x.mag_bin);
    const magCounts = magStatistics.map(x => x.count);

    const depthStatistics = statistics.depth_hist;
    const depthBins = depthStatistics.map(x => x.depth_bin);
    const depthCounts = depthStatistics.map(x => x.count);

    const scatterStatistics = statistics.scatter_chart;
    const scatterData = scatterStatistics.map(x => ({x: x.depth, y: x.mag}));

    const countCtx = document.getElementById('countChart');
    const avgMagCtx = document.getElementById('avgMagChart');
    const avgDepthCtx = document.getElementById('avgDepthChart');
    const magHistCtx = document.getElementById('magHistChart');
    const depthHistCtx = document.getElementById('depthHistChart');
    const scatterChartCtx = document.getElementById('scatterChart');

    const chart_ids = ['countChart', 'avgMagChart', 'avgDepthChart', 'magHistChart', 'depthHistChart', 'scatterChart'];
    chart_ids.forEach(chartId => {
        const chartStatus = Chart.getChart(chartId); 
        if (chartStatus != undefined) {
            chartStatus.destroy();
        }
    });

    new Chart(countCtx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Number of earthquakes',
                data: count
            }, {
                label: 'Magnitude >= 3',
                data: count3
            }, {
                label: 'Magnitude >= 4',
                data: count4
            }, {
                label: 'Magnitude >= 5',
                data: count5
            }, {
                label: 'Magnitude >= 6',
                data: count6
            }]
        }
    });

    new Chart(avgMagCtx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Average magnitude',
                data: avgMag
            }]
        }
    });

    new Chart(avgDepthCtx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [{
                label: 'Average depth',
                data: avgDepth
            }]
        }
    });

    new Chart(magHistCtx, {
        type: 'bar',
        data: {
            labels: magBins,
            datasets: [{
                label: 'Magnitude distribution',
                data: magCounts
            }]
        }
    });

    new Chart(depthHistCtx, {
        type: 'bar',
        data: {
            labels: depthBins,
            datasets: [{
                label: 'Depth distribution',
                data: depthCounts
            }]
        }
    });

    new Chart(scatterChartCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Depth vs Magnitude',
                data: scatterData
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Depth'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Magnitude'
                    }
                }
            }
        }
    });    
}

async function applyFilter() {
    const params = {
        maxEarthquakes: parseInt(document.getElementById("maxEarthquakes").value),
        selectMode: document.getElementById("selectMode").value,
        minMag: parseFloat(document.getElementById("minMag").value),
        maxMag: parseFloat(document.getElementById("maxMag").value),
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        minDepth: parseFloat(document.getElementById("minDepth").value),
        maxDepth: parseFloat(document.getElementById("maxDepth").value)
    }

    await loadEarthquakes(params);
}

async function getStatistics() {
    const params = {
        minMag: parseFloat(document.getElementById("minMag").value),
        maxMag: parseFloat(document.getElementById("maxMag").value),
        startDate: document.getElementById("startDate").value,
        endDate: document.getElementById("endDate").value,
        minDepth: parseFloat(document.getElementById("minDepth").value),
        maxDepth: parseFloat(document.getElementById("maxDepth").value)
    }

    await loadStatistics(params);
}

function resetFilters() {
    document.getElementById("maxEarthquakes").value = "1000";
    document.getElementById("selectMode").value = "newest";
    document.getElementById("minMag").value = "2.5";
    document.getElementById("maxMag").value = "10";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("minDepth").value = "0";
    document.getElementById("maxDepth").value = "1000";

    applyFilter();
}

function updateMarkerSettings() {
    renderEarthquakes(allEarthquakes);
}

async function loadPred() {
    const response = await fetch("/static/data/pred.json");
    const data = await response.json();

    renderRisks(data);
}

loadPred();

function getRiskColor(risk) {
    if (risk < 0.6) return "yellow";
    if (risk < 0.9) return "orange";
    return "red";
}

function renderRisks(data) {
    riskLayer.clearLayers();

    data.forEach( cell => {
        const lat = cell.grid_lat;
        const lon = cell.grid_lon;
        const risk = cell.pred;

        if (risk < 0.5) return;

        const shifts = [-360, 0, 360];
        shifts.forEach( shift => {
            const rect = L.rectangle([[lat, lon + shift], [lat + 1, lon + 1 + shift]], {
                color: getRiskColor(risk),
                fillColor: getRiskColor(risk),
                fillOpacity: 0.4,
                weight: 0
            }).addTo(riskLayer);
        });
    });
}

function renderLegend() {
    const legend = L.control({position: 'bottomleft'});
    const levels = [50, 100, 300];

    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'legend');
        levels.forEach( l => {
            div.innerHTML += '<div><i style="background:' + getMarkerColor(l) + '"></i> <' + l + ' km</div>';
        });

        div.innerHTML += '<div><i style="background:' + getMarkerColor(levels.at(-1) + 1) + '"></i> ' + levels.at(-1) + '+ km</div>';
        return div;
    }

    legend.addTo(map);
}

renderLegend();

function displayMap() {
    document.getElementById('analysis-module').style.display = 'none';
    document.getElementById('map-module').style.display = 'block';
    document.getElementById('map-settings').style.display = 'block';
    document.getElementById('map-buttons').style.display = 'block';
    document.getElementById('analysis-buttons').style.display = 'none';
}

async function displayAnalysis() {
    await getStatistics();

    document.getElementById('analysis-module').style.display = 'block';
    document.getElementById('map-module').style.display = 'none';
    document.getElementById('map-settings').style.display = 'none';
    document.getElementById('map-buttons').style.display = 'none';
    document.getElementById('analysis-buttons').style.display = 'block';
}

let animation = null;
let lastCount = 0;

function updateTimeline() {
    let value = document.getElementById('timeline').value;
    let count = Math.floor(allEarthquakes.length * value / 100);

    if (count > lastCount) {
        renderEarthquakes(allEarthquakes.slice(lastCount, count), false);
    } else {
        renderEarthquakes(allEarthquakes.slice(0, count));
    }

    lastCount = count;
}

function switchAnimation() {
    const animationButton = document.getElementById('animationButton');

    if (animation) {
        clearInterval(animation);
        animation = null;

        animationButton.textContent = 'Start';
        animationButton.classList.remove('btn-danger');
        animationButton.classList.add('btn-success');
    } else {
        if (document.getElementById('timeline').value == 0) {
            updateTimeline();
        }

        animation = setInterval(timelineStep, 100);

        animationButton.textContent = 'Stop';
        animationButton.classList.remove('btn-success');
        animationButton.classList.add('btn-danger');
    }
}

function timelineStep() {
    let timeline = document.getElementById('timeline');
    if (timeline.value >= 100) {
        switchAnimation();
        return;
    }

    timeline.value++;
    updateTimeline();
}
