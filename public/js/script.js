// Prekladova mapa
const translations = {
  en: {
    title: "Agent Path Calculation",
    downloadMap: "Download Map",
    drawPath: "Draw Path",
    finishDrawing: "Finish Drawing",
    addDelay: "Add Delay",
    addForbiddenZone: "Add Forbidden Zone",
    resetDrawing: "Reset Drawing",
    calculateTime: "Calculate Time",
    totalTime: "Total round trip time (s):",
    distanceM: "Path length (m):",
    distancePx: "Path length (px):",
    addStop: "Add Delay",
    mainTitle: "Agent Path Calculation",
    labelSpeed: "Speed:",
    labelBreakTime: "Delays (seconds):"
  },
  sk: {
    title: "Výpočet trasy agenta",
    downloadMap: "Stiahnuť mapu",
    drawPath: "Kresliť trasu",
    finishDrawing: "Skončiť kreslenie",
    addDelay: "Pridať prestoj",
    addForbiddenZone: "Pridať zakázané pole",
    resetDrawing: "Resetovať kreslenie",
    calculateTime: "Vypočítať čas",
    totalTime: "Celkový čas trasy (s):",
    distanceM: "Dĺžka trasy (m):",
    distancePx: "Dĺžka trasy (px):",
    addStop: "Pridať prestoj",
    mainTitle: "Výpočet trasy agenta",
    labelSpeed: "Rýchlosť:",
    labelBreakTime: "Prestávky (sekundy):"
  }
};

//
document.getElementById('downloadMap').addEventListener('click', function() {
  const targetUrl = 'http://localhost/api/fp';

  const xhr = new XMLHttpRequest();
  xhr.open('GET', targetUrl, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.withCredentials = true;

  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      const data = JSON.parse(xhr.responseText);
      console.log(data);
      if (!Array.isArray(data) || data.length === 0) {
        console.error('No floorplans available');
        return;
      }

      // zober poslednu mapu podľa dátumu aktualizácie
      const latest = data.sort((a, b) => new Date(a.updated) - new Date(b.updated)).pop();

      const imgurl = `http://localhost/${latest.imgurl}`;
      const scale = latest.scale;
      const xoffset = latest.xoffset;
      const yoffset = latest.yoffset;

      initializeMap(imgurl, scale, xoffset, yoffset);
    } else {
      console.error('Request failed:', xhr.statusText);
    }
  };

  xhr.onerror = function() {
    console.error('Request error');
  };

  xhr.send();
});
function switchLanguage(lang) {
  const elements = document.querySelectorAll('[data-key]');
  elements.forEach(el => {
    const key = el.getAttribute('data-key');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
}

function initializeMap(imgUrl, scale) {
  var map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -5,
    maxZoom: 2,
    zoomSnap: 0.5,
    zoomDelta: 0.5
  });

  var bounds = [[0, 0], [1024, 1024]];
  var image = L.imageOverlay(imgUrl, bounds).addTo(map);

  map.fitBounds(bounds);

  var route = [];
  var stops = [];
  var isDrawingRoute = false;
  var isAddingStop = false;
  var isAddingRestrictedArea = false;
  var polyline = L.polyline([], { color: 'blue' }).addTo(map);
  var stopMarkers = [];
  var restrictedAreas = [];
  var gridSize = 10;

  document.getElementById('drawRoute').addEventListener('click', function () {
    isDrawingRoute = !isDrawingRoute;
    this.classList.toggle('active');
    this.textContent = isDrawingRoute
      ? translations[window.currentLang].finishDrawing
      : translations[window.currentLang].drawPath;
  });

  document.getElementById('resetRoute').addEventListener('click', function() {
    route = [];
    stops = [];
    polyline.setLatLngs([]);
    stopMarkers.forEach(marker => map.removeLayer(marker));
    stopMarkers = [];
    restrictedAreas.forEach(area => map.removeLayer(area));
    restrictedAreas = [];
    document.getElementById('result').innerText = '';
    document.getElementById('routeInfo').innerText = '';
  });

  document.getElementById('addStop').addEventListener('click', function () {
    isAddingStop = true;
    isDrawingRoute = false;
    isAddingRestrictedArea = false;
  
    document.getElementById('drawRoute').classList.remove('active');
    document.getElementById('drawRoute').textContent = translations[window.currentLang].drawPath;
  });

  document.getElementById('addRestrictedArea').addEventListener('click', function () {
    isAddingRestrictedArea = !isAddingRestrictedArea;
    this.classList.toggle('active');
  
    this.textContent = isAddingRestrictedArea
      ? translations[window.currentLang].finishDrawing
      : translations[window.currentLang].addForbiddenZone;
  
    isDrawingRoute = false;
    isAddingStop = false;
  
    document.getElementById('drawRoute').classList.remove('active');
    document.getElementById('drawRoute').textContent = translations[window.currentLang].drawPath;
  });

  var restrictedAreaStart = null;

  map.on('click', function(e) {
    var latlng = e.latlng;

    if (isDrawingRoute) {
      if (route.length === 0) {
        latlng = snapToGrid(latlng, gridSize);
        route.push(latlng);
        polyline.addLatLng(latlng);
      } else {
        isDrawingRoute = false;
        document.getElementById('drawRoute').classList.remove('active');
        document.getElementById('drawRoute').textContent = translations[window.currentLang].drawPath;
      }
    }

    if (isAddingStop) {
      latlng = snapToGrid(latlng, gridSize);
      stops.push(latlng);
      var stopMarker = L.circleMarker(latlng, { color: 'green' }).addTo(map);
      stopMarkers.push(stopMarker);
      isAddingStop = false;
    }

    if (isAddingRestrictedArea) {
      if (!restrictedAreaStart) {
        restrictedAreaStart = latlng;
      } else {
        var bounds = [
          [restrictedAreaStart.lat, restrictedAreaStart.lng],
          [latlng.lat, latlng.lng]
        ];
        var restrictedArea = L.rectangle(bounds, { color: 'red', weight: 1 }).addTo(map);
        restrictedAreas.push(restrictedArea);
        restrictedAreaStart = null;
        isAddingRestrictedArea = false;
        document.getElementById('addRestrictedArea').classList.remove('active');
        document.getElementById('addRestrictedArea').textContent = translations[window.currentLang].addForbiddenZone;

      }
    }
  });

  map.on('mousemove', function(e) {
    if (isDrawingRoute && route.length > 0) {
      var latlng = e.latlng;
      var lastPoint = route[route.length - 1];
      var snappedLatLng = snapToGrid(latlng, gridSize);
      var distance = calculateDistance([lastPoint.lat, lastPoint.lng], [snappedLatLng.lat, snappedLatLng.lng]);

      if (distance > 1) {
        if (isInRestrictedArea(snappedLatLng, restrictedAreas)) {
          alert('Kreslíš v zakázanom poli');
          resetDrawing();
        } else {
          polyline.addLatLng(snappedLatLng);
          route.push(snappedLatLng);
        }
      }
    }
  });

  document.getElementById('dataForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var speed = parseFloat(document.getElementById('speed').value);
    var speedUnit = document.getElementById('speedUnit').value;
    var breakTime = parseFloat(document.getElementById('breakTime').value);

    speed = convertSpeedToMetersPerSecond(speed, speedUnit);

    var totalTime = calculateTotalTime(route, stops, speed, breakTime, scale);
    document.getElementById('result').innerText =
      `${translations[window.currentLang].totalTime} ${totalTime.toFixed(2)} s`;

    var totalDistancePixels = calculateTotalDistancePixels(route);
    var totalDistanceMeters = totalDistancePixels * scale;
    document.getElementById('routeInfo1').innerText =
      `${translations[window.currentLang].distanceM} ${totalDistanceMeters.toFixed(2)}`;
    document.getElementById('routeInfo2').innerText =
      `${translations[window.currentLang].distancePx} ${totalDistancePixels.toFixed(2)}`;
  });

  function snapToGrid(latlng, size) {
    var lat = Math.round(latlng.lat / size) * size;
    var lng = Math.round(latlng.lng / size) * size;
    return L.latLng(lat, lng);
  }

  function calculateDistance(point1, point2) {
    var dx = point2[0] - point1[0];
    var dy = point2[1] - point1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function calculateTotalDistancePixels(route) {
    var totalDistance = 0;
    for (var i = 1; i < route.length; i++) {
      totalDistance += calculateDistance([route[i - 1].lat, route[i - 1].lng], [route[i].lat, route[i].lng]);
    }
    return totalDistance;
  }

  function calculateTotalTime(route, stops, speed, breakTime, scale) {
    if (route.length < 2) return 0;

    var totalDistance = calculateTotalDistancePixels(route) * scale;

    var travelTime = (totalDistance / speed) * 2;
    var totalTime = travelTime + (stops.length * breakTime);

    return totalTime;
  }

  function convertSpeedToMetersPerSecond(speed, unit) {
    switch (unit) {
      case 'm/h':
        return speed / 3600;
      case 'km/h':
        return speed / 3.6;
      default:
        return speed;
    }
  }

  function isInRestrictedArea(latlng, restrictedAreas) {
    for (var i = 0; i < restrictedAreas.length; i++) {
      if (restrictedAreas[i].getBounds().contains(latlng)) {
        return true;
      }
    }
    return false;
  }

  function resetDrawing() {
    route = [];
    polyline.setLatLngs([]);
  }
}

//Lokalizacia dyn. textov based on stav 
function updateDynamicTexts(lang, state) {
  const drawRouteBtn = document.getElementById('drawRoute');
  const addRestrictedBtn = document.getElementById('addRestrictedArea');
  const addStopBtn = document.getElementById('addStop');
  const mainTitle = document.querySelector('[data-key="mainTitle"]');
  const labelSpeed = document.querySelector('[data-key="labelSpeed"]');
  const labelBreakTime = document.querySelector('[data-key="labelBreakTime"]');
  const calcTimeBtn = document.querySelector('[data-key="calcTime"]');

  if (drawRouteBtn) {
    drawRouteBtn.textContent = state.isDrawingRoute
      ? translations[lang].finishDrawing
      : translations[lang].drawPath;
  }

  if (addRestrictedBtn) {
    addRestrictedBtn.textContent = state.isAddingRestrictedArea
      ? translations[lang].finishDrawing
      : translations[lang].addForbiddenZone;
  }

  if (addStopBtn) {
    addStopBtn.textContent = translations[lang].addStop;
  }

  if (mainTitle) {
    mainTitle.textContent = translations[lang].mainTitle;
  }

  if (labelSpeed) {
    labelSpeed.textContent = translations[lang].labelSpeed;
  }

  if (labelBreakTime) {
    labelBreakTime.textContent = translations[lang].labelBreakTime;
  }

  if (calcTimeBtn) {
    calcTimeBtn.textContent = translations[lang].calculateTime;
  }
}

//Spusti lokalizaciu pri onload
window.onload = () => {
  switchLanguage('en');
};

//Funkcia na prepnutie jazyka a aktualizaciu textov
function switchLanguage(lang) {
  const elements = document.querySelectorAll('[data-key]');
  elements.forEach(el => {
    const key = el.getAttribute('data-key');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  updateDynamicTexts(lang, {
    isDrawingRoute: document.getElementById('drawRoute')?.classList.contains('active'),
    isAddingRestrictedArea: document.getElementById('addRestrictedArea')?.classList.contains('active')
  });

  window.currentLang = lang;
}


