// map.js
// 地图初始化及所有交互逻辑

let map;
let markersLayer, routeLayer, categoryLayers;
let routePoints = [];        // 存储 [lat, lng, name, date, category]
let allPoints = [];          // 存储完整数据对象引用
let currentProgressIndex = 0;
let isPlaying = false;
let playInterval = null;
let bounds;

// 获取 DOM 元素
const slider = document.getElementById('timeline-slider');
const progressCountSpan = document.getElementById('progress-count');
const currentPointInfoDiv = document.getElementById('current-point-info');
const btnStart = document.getElementById('btn-start');
const btnPlay = document.getElementById('btn-play');
const btnEnd = document.getElementById('btn-end');
const statsContent = document.getElementById('stats-content');

// 月份标签映射
const monthOrder = ["七月", "八月", "九月", "十月", "十一月", "十二月"];

// 初始化地图
function initMap() {
  map = L.map('map').setView([36.5, 105.0], 5);
  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    subdomains: ['1', '2', '3', '4'],
    maxNativeZoom: 12,
    maxZoom: 18,
    attribution: '© 高德地图 | 数据来源：《林则徐日记》'
  }).addTo(map);
  
  markersLayer = L.layerGroup();
  routeLayer = L.layerGroup();
  categoryLayers = {
    "起点": L.layerGroup(), "终点": L.layerGroup(), "重要城市": L.layerGroup(),
    "重要驿站": L.layerGroup(), "重要地标": L.layerGroup(), "名胜古迹": L.layerGroup(),
    "驿站": L.layerGroup(), "途经": L.layerGroup()
  };
  
  // 遍历数据构建标记点和路线点
  linZexuRouteData.forEach((point, idx) => {
    const { lng, lat, name, date, category = "途经", desc } = point;
    if (lng && lat && !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
      allPoints.push(point);
      routePoints.push([lat, lng, name, date, category, idx]);
      
      const markerColor = getMarkerColor(category);
      const radius = getMarkerRadius(category);
      
      const marker = L.circleMarker([lat, lng], {
        radius, fillColor: markerColor, color: "#fff", weight: 1.5,
        opacity: 0.9, fillOpacity: 0.7
      });
      
      marker.bindPopup(() => buildPopupHTML(point, markerColor));
      markersLayer.addLayer(marker);
      if (categoryLayers[category]) categoryLayers[category].addLayer(marker);
    }
  });
  
  // 绘制完整路线
  if (routePoints.length >= 2) {
    const latlngs = routePoints.map(p => [p[0], p[1]]);
    const routeLine = L.polyline(latlngs, { color: "#E74C3C", weight: 3, opacity: 0.7, dashArray: '5, 10' })
      .bindPopup('<b>林则徐西行完整路线</b><br>1842年七月至十二月').addTo(routeLayer);
    
    // 起点终点大标记
    const start = routePoints[0], end = routePoints[routePoints.length-1];
    L.circleMarker([start[0], start[1]], { radius: 14, fillColor: "#27ae60", color: "#fff", weight: 2 })
      .bindPopup(`<b>🏁 起点</b><br>${start[2]}<br>${start[3]}`).addTo(markersLayer);
    L.circleMarker([end[0], end[1]], { radius: 14, fillColor: "#e74c3c", color: "#fff", weight: 2 })
      .bindPopup(`<b>🎯 终点</b><br>${end[2]}<br>${end[3]}`).addTo(markersLayer);
    
    bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
  }
  
  // 初始添加图层
  markersLayer.addTo(map);
  routeLayer.addTo(map);
  
  // 设置滑块范围
  slider.max = routePoints.length - 1;
  progressCountSpan.innerText = `0/${routePoints.length}`;
  updateProgress(0);
  
  // 事件绑定
  slider.addEventListener('input', (e) => {
    if (isPlaying) stopPlay();
    updateProgress(parseInt(e.target.value));
  });
  btnStart.addEventListener('click', () => { if(isPlaying) stopPlay(); updateProgress(0); });
  btnEnd.addEventListener('click', () => { if(isPlaying) stopPlay(); updateProgress(routePoints.length-1); });
  btnPlay.addEventListener('click', togglePlay);
  document.getElementById('toggle-markers').addEventListener('click', () => toggleLayer(markersLayer, 'toggle-markers', '隐藏标记点', '显示标记点'));
  document.getElementById('toggle-route').addEventListener('click', () => toggleLayer(routeLayer, 'toggle-route', '隐藏路线', '显示路线'));
  document.getElementById('reset-view').addEventListener('click', () => map.fitBounds(bounds, { padding: [80, 80] }));
  document.getElementById('export-btn').addEventListener('click', exportCSV);
  
  // 渲染月份刻度
  renderMonthMarks();
  
  // 初始化完成后，更新右侧面板
  updateStatsPanel();
}

// 工具函数
function getMarkerColor(category) {
  const colors = { "起点":"#27ae60","终点":"#e74c3c","重要城市":"#3498db","重要驿站":"#9b59b6","重要地标":"#f39c12","名胜古迹":"#1abc9c" };
  return colors[category] || "#95a5a6";
}
function getMarkerRadius(category) {
  const radii = { "起点":10, "终点":10, "重要城市":9, "重要驿站":8, "重要地标":8, "名胜古迹":8 };
  return radii[category] || 6;
}

function buildPopupHTML(point, color) {
  const { name, date, category, desc, modernPlace, originalPlace, products, food, work, localRecords, literature, emotion, characters } = point;
  const detailsHtml = `
    ${originalPlace ? `<div><strong>古地名：</strong> ${originalPlace}</div>` : ''}
    ${modernPlace ? `<div><strong>今地名：</strong> ${modernPlace}</div>` : ''}
    ${isMeaningfulValue(products) ? `<div><strong>物产：</strong> ${products}</div>` : ''}
    ${isMeaningfulValue(food) ? `<div><strong>饮食：</strong> ${food}</div>` : ''}
    ${isMeaningfulValue(work) ? `<div><strong>工作：</strong> ${work}</div>` : ''}
    ${localRecords ? `<div><strong>地方志：</strong> ${localRecords}</div>` : ''}
    ${isMeaningfulValue(literature) ? `<div><strong>诗文：</strong> ${literature}</div>` : ''}
    ${isMeaningfulValue(emotion) ? `<div><strong>情感：</strong> ${emotion}</div>` : ''}
  `;
  const peopleHtml = characters ? `<div><strong>人物：</strong> ${characters}</div>` : '';
  return `
    <div style="min-width:240px; max-width:320px;">
      <h4 style="color:${color}; margin:0 0 5px;">${name}</h4>
      <div><strong>${date}</strong> · ${category}</div>
      <div style="margin-top:8px;">${desc}</div>
      ${detailsHtml}
      ${peopleHtml}
    </div>
  `;
}

function updateProgress(index) {
  if (index < 0) index = 0;
  if (index >= routePoints.length) index = routePoints.length - 1;
  currentProgressIndex = index;
  slider.value = index;
  progressCountSpan.innerText = `${index+1}/${routePoints.length}`;
  
  const pointData = allPoints[index];
  if (pointData) {
    currentPointInfoDiv.innerHTML = `<strong>${pointData.name}</strong> · ${pointData.date}`;
    // 地图中心移动到当前点
    map.panTo([routePoints[index][0], routePoints[index][1]]);
    updateStatsPanel(index);
  } else {
    currentPointInfoDiv.innerHTML = '—';
  }
}

function updateStatsPanel(index = currentProgressIndex) {
  if (!allPoints.length) return;
  const point = allPoints[index];
  if (!point) return;
  const catColor = getMarkerColor(point.category);
  const datePrefix = point.date;
  const month = datePrefix.match(/[一二三四五六七八九十]+月/)?.[0] || '';
  statsContent.innerHTML = `
    <div class="stat-item"><span>总地点数</span><span>${allPoints.length}</span></div>
    <div class="stat-item"><span>当前进度</span><span>${Math.round((index+1)/allPoints.length*100)}%</span></div>
    <div class="stat-item"><span>当前地点</span><span style="color:${catColor}">${point.name}</span></div>
    <div class="stat-item"><span>日期</span><span>${point.date}</span></div>
    <div class="stat-item"><span>现代位置</span><span>${point.modernPlace || '—'}</span></div>
    ${point.characters ? `<div class="stat-item"><span>人物</span><span>${point.characters.substring(0,40)}${point.characters.length>40?'…':''}</span></div>` : ''}
    <div class="stat-desc"><strong>日记摘要</strong><br>${point.desc.substring(0,100)}${point.desc.length>100?'…':''}</div>
  `;
}

function togglePlay() {
  if (isPlaying) {
    stopPlay();
  } else {
    startPlay();
  }
}
function startPlay() {
  if (currentProgressIndex >= routePoints.length - 1) {
    updateProgress(0);
  }
  isPlaying = true;
  btnPlay.innerHTML = '<i class="fas fa-pause"></i> 暂停';
  playInterval = setInterval(() => {
    if (currentProgressIndex + 1 >= routePoints.length) {
      stopPlay();
    } else {
      updateProgress(currentProgressIndex + 1);
    }
  }, 1000);
}
function stopPlay() {
  if (playInterval) clearInterval(playInterval);
  isPlaying = false;
  btnPlay.innerHTML = '<i class="fas fa-play"></i> 播放';
}
function toggleLayer(layer, btnId, hideText, showText) {
  const btn = document.getElementById(btnId);
  if (map.hasLayer(layer)) {
    map.removeLayer(layer);
    btn.innerHTML = `<i class="fas ${btnId === 'toggle-markers' ? 'fa-map-marker-alt' : 'fa-route'}"></i> ${showText}`;
  } else {
    map.addLayer(layer);
    btn.innerHTML = `<i class="fas ${btnId === 'toggle-markers' ? 'fa-map-marker-alt' : 'fa-route'}"></i> ${hideText}`;
  }
}
function exportCSV() {
  const subset = allPoints.slice(0, currentProgressIndex+1);
  let csv = "\uFEFF日期,地点名称,经度,纬度,古地名,今地名,类别,日记摘要\n";
  subset.forEach(p => {
    csv += `"${p.date}","${p.name}",${p.lng},${p.lat},"${p.originalPlace || ''}","${p.modernPlace || ''}","${p.category}","${p.desc.replace(/"/g, '""')}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `linzexu_progress_${currentProgressIndex+1}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderMonthMarks() {
  const container = document.getElementById('month-marks');
  container.innerHTML = '';
  // 为每个月份找到第一个出现的索引
  const marks = [];
  monthOrder.forEach(month => {
    const idx = allPoints.findIndex(p => p.date.includes(month));
    if (idx !== -1) marks.push({ month, index: idx });
  });
  marks.forEach(({ month, index }) => {
    const btn = document.createElement('button');
    btn.className = 'month-mark';
    btn.innerText = month;
    btn.addEventListener('click', () => {
      if (isPlaying) stopPlay();
      updateProgress(index);
    });
    container.appendChild(btn);
  });
}

// 启动
window.addEventListener('DOMContentLoaded', () => {
  initMap();
});