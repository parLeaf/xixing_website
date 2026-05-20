// map.js
// 依赖：leaflet.js 已加载，data.js 已加载（linZexuRouteData 全局可用）

function initMapAndRoutes() {
    // 1. 初始化地图
    var map = L.map('map').setView([36.5, 105.0], 5);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1', '2', '3', '4'],
        maxNativeZoom: 12,
        maxZoom: 18,
        attribution: '© <a href="https://www.amap.com/">高德地图</a> | 数据来源：《林则徐日记》1842年壬寅七月至九月'
    }).addTo(map);

    var routeColor = "#E74C3C";

    // 图层组
    var markersLayer = L.layerGroup();
    var routeLayer = L.layerGroup();
    var categoryLayers = {
        "起点": L.layerGroup(), "终点": L.layerGroup(), "重要城市": L.layerGroup(),
        "重要驿站": L.layerGroup(), "重要地标": L.layerGroup(), "名胜古迹": L.layerGroup(),
        "驿站": L.layerGroup(), "途经": L.layerGroup()
    };
    
    var routePoints = [];
    var validPointsCount = 0;
    var categoryStats = {};
    Object.keys(categoryLayers).forEach(cat => categoryStats[cat] = 0);
    
    // 动态构建弹窗 HTML 的函数（虚拟化）
    function buildPopupHTML(point, markerColor) {
        var name = point.name;
        var date = point.date;
        var category = point.category || "途经";
        var desc = point.desc;
        var modernPlace = point.modernPlace || "未记录";
        var originalPlace = point.originalPlace || "";
        var products = point.products;
        var food = point.food;
        var work = point.work;
        var localRecords = point.localRecords;
        var literature = point.literature;
        var emotion = point.emotion;
        var characters = point.characters;
        
        var detailsHtml = '';
        if (originalPlace) detailsHtml += `<div class="info-section"><span class="info-label">古地名:</span> ${originalPlace}</div>`;
        if (products && products !== "未提及") detailsHtml += `<div class="info-section"><span class="info-label">物产:</span> ${products}</div>`;
        if (food && food !== "未提及") detailsHtml += `<div class="info-section"><span class="info-label">饮食:</span> ${food}</div>`;
        if (work && work !== "未提及") detailsHtml += `<div class="info-section"><span class="info-label">工作:</span> ${work}</div>`;
        if (localRecords) detailsHtml += `<div class="info-section"><span class="info-label">地方志:</span> ${localRecords}</div>`;
        if (literature && literature !== "未提及") detailsHtml += `<div class="info-section"><span class="info-label">诗文:</span> ${literature}</div>`;
        if (emotion) detailsHtml += `<div class="info-section"><span class="info-label">情感:</span> ${emotion}</div>`;
        
        var peopleHtml = '';
        if (characters) {
            var peopleList = characters.split(', ').map(p => `<span class="icon-badge" style="background:#3498db">${p}</span>`).join('');
            peopleHtml = `
            <div class="tab-content" id="tab-people">
                <div class="info-section"><span class="info-label">人物:</span><br>${peopleList}</div>
            </div>`;
        }
        
        return `
            <div class="popup-content">
                <div class="popup-title">${name}</div>
                <div class="popup-section">
                    <div class="info-section"><span class="info-label">日期:</span> ${date}</div>
                    <div class="info-section"><span class="info-label">今地名:</span> ${modernPlace}</div>
                    <div class="info-section"><span class="info-label">类别:</span> <span class="icon-badge" style="background:${markerColor}">${category}</span></div>
                </div>
                <div class="tab-container">
                    <div class="tab active" data-tab="desc">📜 日记摘要</div>
                    <div class="tab" data-tab="details">📋 详细信息</div>
                    ${characters ? '<div class="tab" data-tab="people">👥 相关人物</div>' : ''}
                </div>
                <div class="tab-content active" id="tab-desc"><p>${desc}</p></div>
                <div class="tab-content" id="tab-details">${detailsHtml}</div>
                ${peopleHtml}
            </div>
        `;
    }
    
    // 遍历数据
    linZexuRouteData.forEach(function(point) {
        var lng = point.lng, lat = point.lat, name = point.name, date = point.date, desc = point.desc;
        var category = point.category || "途经";
        if (lng && lat && !isNaN(lng) && !isNaN(lat) && lng != 0 && lat != 0) {
            validPointsCount++;
            categoryStats[category]++;
            
            var markerColor, markerRadius;
            switch(category) {
                case "起点": markerColor = "#27ae60"; markerRadius = 10; break;
                case "终点": markerColor = "#e74c3c"; markerRadius = 10; break;
                case "重要城市": markerColor = "#3498db"; markerRadius = 9; break;
                case "重要驿站": markerColor = "#9b59b6"; markerRadius = 8; break;
                case "重要地标": markerColor = "#f39c12"; markerRadius = 8; break;
                case "名胜古迹": markerColor = "#1abc9c"; markerRadius = 8; break;
                default: markerColor = "#95a5a6"; markerRadius = 6;
            }
            
            var marker = L.circleMarker([lat, lng], {
                radius: markerRadius,
                fillColor: markerColor,
                color: "#fff",
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.7
            });
            
            marker.bindPopup(function() {
                return buildPopupHTML(point, markerColor);
            });
            
            markersLayer.addLayer(marker);
            categoryLayers[category].addLayer(marker);
            routePoints.push([lat, lng, name, date, category]);
        }
    });
    
    // 绘制路线
    if (routePoints.length >= 2) {
        var routeLine = L.polyline(routePoints.map(p => [p[0], p[1]]), {
            color: routeColor, weight: 3, opacity: 0.7,
            lineCap: 'round', lineJoin: 'round', dashArray: '5, 10'
        }).bindPopup('<b>林则徐西行完整路线</b><br>1842年农历七月至十二月<br>从西安到伊犁宽巷').addTo(routeLayer);
        
        routeLine.on('mouseover', function() { this.setStyle({ weight: 6, opacity: 0.9, dashArray: null }); });
        routeLine.on('mouseout', function() { this.setStyle({ weight: 3, opacity: 0.7, dashArray: '5, 10' }); });
        
        if (routePoints.length > 0) {
            var startPoint = routePoints[0], endPoint = routePoints[routePoints.length-1];
            L.circleMarker([startPoint[0], startPoint[1]], { radius: 15, fillColor: "#27ae60", color: "#fff", weight: 3, opacity: 1, fillOpacity: 0.8 })
                .bindPopup(`<div><b style="color:#27ae60;">🏁 行程起点</b><br>📍 ${startPoint[2]}<br>📅 ${startPoint[3]}</div>`).addTo(markersLayer);
            L.circleMarker([endPoint[0], endPoint[1]], { radius: 15, fillColor: "#e74c3c", color: "#fff", weight: 3, opacity: 1, fillOpacity: 0.8 })
                .bindPopup(`<div><b style="color:#e74c3c;">🎯 行程终点</b><br>📍 ${endPoint[2]}<br>📅 ${endPoint[3]}<br>🏁 总里程 ~5,000里</div>`).addTo(markersLayer);
        }
    }
    
    // 时间线控件
    var timelineControl = L.control({position: 'topleft'});
    timelineControl.onAdd = function() {
        var div = L.DomUtil.create('div', 'timeline-control');
        div.innerHTML = `<div><strong>📅 林则徐西行时间线</strong></div>
            <input type="range" min="0" max="${routePoints.length-1}" value="${routePoints.length-1}" class="timeline-slider" id="timeline-slider">
            <div class="date-display" id="date-display">终点: ${routePoints[routePoints.length-1] ? routePoints[routePoints.length-1][2] : ''}</div>
            <div><span>起点: 西安</span> <span>终点: ${routePoints[routePoints.length-1] ? routePoints[routePoints.length-1][2] : '伊犁'}</span></div>`;
        return div;
    };
    timelineControl.addTo(map);
    
    // 统计面板
    var statsPanel = L.control({position: 'bottomright'});
    statsPanel.onAdd = function() {
        var div = L.DomUtil.create('div', 'stats-panel');
        div.innerHTML = `<div><strong>📊 行程统计</strong></div>
            <div>总地点数: ${validPointsCount}</div>
            <div>行程时长: 7-12月</div>
            <div>经停省份: 4省</div>`;
        return div;
    };
    statsPanel.addTo(map);
    
    // 图层控制
    var layerControl = L.control.layers(null, null, { collapsed: false }).addTo(map);
    layerControl.addOverlay(markersLayer, '📍 所有地点标记');
    layerControl.addOverlay(routeLayer, '🛣️ 完整西行路线');
    
    var categoryControl = L.control.layers(null, null, { collapsed: false }).addTo(map);
    categoryControl.setPosition('topright');
    Object.keys(categoryLayers).forEach(cat => {
        if (categoryStats[cat] > 0) {
            var color = {起点:"#27ae60",终点:"#e74c3c",重要城市:"#3498db",重要驿站:"#9b59b6",重要地标:"#f39c12",名胜古迹:"#1abc9c"}[cat] || "#95a5a6";
            categoryControl.addOverlay(categoryLayers[cat], `<span style="color:${color}">●</span> ${cat} (${categoryStats[cat]})`);
        }
    });
    
    markersLayer.addTo(map);
    routeLayer.addTo(map);
    var bounds = L.latLngBounds(routePoints.map(p => [p[0], p[1]]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [100, 100], maxZoom: 6 });
    
    // 图例
    var legend = L.control({position: 'bottomleft'});
    legend.onAdd = function() {
        var div = L.DomUtil.create('div', 'legend');
        div.innerHTML = `<h4>图例</h4>
            <div><i style="background:#27ae60"></i> 起点</div><div><i style="background:#e74c3c"></i> 终点</div>
            <div><i style="background:#3498db"></i> 重要城市</div><div><i style="background:#9b59b6"></i> 重要驿站</div>
            <div><i style="background:#f39c12"></i> 重要地标</div><div><i style="background:#1abc9c"></i> 名胜古迹</div>
            <div><i style="background:#95a5a6"></i> 其他</div><hr><div style="color:#e74c3c;">🛣️ 红色路线</div>`;
        return div;
    };
    legend.addTo(map);
    
    // 时间线滑块交互
    var slider = document.getElementById('timeline-slider');
    var dateDisplay = document.getElementById('date-display');
    var partialRouteLayer = L.layerGroup();
    slider.addEventListener('input', function() {
        var value = parseInt(this.value);
        var currentPoint = routePoints[value];
        if (currentPoint) {
            dateDisplay.textContent = `${currentPoint[2]} (${currentPoint[3]})`;
            map.removeLayer(partialRouteLayer);
            partialRouteLayer = L.layerGroup();
            if (value >= 1) {
                var partialPoints = routePoints.slice(0, value+1);
                var filtered = [], last = null;
                partialPoints.forEach(p => {
                    var coord = [p[0], p[1]];
                    if (!last || coord[0] !== last[0] || coord[1] !== last[1]) {
                        filtered.push(coord);
                        last = coord;
                    }
                });
                if (filtered.length >= 2) {
                    L.polyline(filtered, { color: "#2ECC71", weight: 4, opacity: 0.9 }).addTo(partialRouteLayer);
                }
            }
            L.circleMarker([currentPoint[0], currentPoint[1]], { radius: 14, fillColor: "#F39C12", color: "#fff", weight: 3 })
                .bindPopup(`<b>📍 ${currentPoint[2]}</b><br>📅 ${currentPoint[3]}<br>进度 ${value+1}/${routePoints.length}`).addTo(partialRouteLayer);
            partialRouteLayer.addTo(map);
            map.panTo([currentPoint[0], currentPoint[1]]);
        }
    });
    
    // 按钮事件
    document.getElementById('toggle-markers').addEventListener('click', function() {
        if (map.hasLayer(markersLayer)) { map.removeLayer(markersLayer); this.innerHTML = '<i class="fas fa-map-marker-alt"></i> 显示标记点'; }
        else { markersLayer.addTo(map); this.innerHTML = '<i class="fas fa-map-marker-alt"></i> 隐藏标记点'; }
    });
    document.getElementById('toggle-route').addEventListener('click', function() {
        if (map.hasLayer(routeLayer)) { map.removeLayer(routeLayer); this.innerHTML = '<i class="fas fa-route"></i> 显示路线'; }
        else { routeLayer.addTo(map); this.innerHTML = '<i class="fas fa-route"></i> 隐藏路线'; }
    });
    document.getElementById('reset-view').addEventListener('click', function() {
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
    });
    document.getElementById('export-btn').addEventListener('click', function() {
        let csv = "\uFEFF日期,地点名称,经度,纬度,古地名,今地名,类别,日记摘要\n";
        linZexuRouteData.forEach(p => {
            csv += `"${p.date}","${p.name}",${p.lng},${p.lat},"${p.originalPlace || ''}","${p.modernPlace || ''}","${p.category || ''}","${p.desc}"\n`;
        });
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "林则徐西行路线数据.csv";
        link.click();
        URL.revokeObjectURL(link.href);
        alert("数据已导出为CSV文件！");
    });
    
    // 弹窗标签切换
    map.on('popupopen', function() {
        setTimeout(function() {
            document.querySelectorAll('.leaflet-popup-content .tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    var tabId = this.getAttribute('data-tab');
                    document.querySelectorAll('.leaflet-popup-content .tab, .leaflet-popup-content .tab-content').forEach(el => el.classList.remove('active'));
                    this.classList.add('active');
                    document.getElementById('tab-' + tabId).classList.add('active');
                });
            });
        }, 100);
    });
    
    // 键盘快捷键
    document.addEventListener('keydown', function(e) {
        var s = document.getElementById('timeline-slider');
        if (!s) return;
        if (e.key === 'ArrowLeft') { s.value = Math.max(0, parseInt(s.value)-1); s.dispatchEvent(new Event('input')); }
        if (e.key === 'ArrowRight') { s.value = Math.min(parseInt(s.max), parseInt(s.value)+1); s.dispatchEvent(new Event('input')); }
        if (e.key === 'Home') { s.value = 0; s.dispatchEvent(new Event('input')); }
        if (e.key === 'End') { s.value = s.max; s.dispatchEvent(new Event('input')); }
        if (e.key === 'm' || e.key === 'M') document.getElementById('toggle-markers').click();
        if (e.key === 'r' || e.key === 'R') document.getElementById('toggle-route').click();
    });
    
    // 月份分段功能（懒加载）
    let monthLayer = null;
    function getMonthLayer() {
        if (monthLayer) return monthLayer;
        monthLayer = L.layerGroup();
        var segments = {
            "七月": { start: 0, end: 13, color: "#3498db" },
            "八月": { start: 14, end: 17, color: "#9b59b6" },
            "九月": { start: 18, end: 30, color: "#1abc9c" },
            "十月": { start: 31, end: 46, color: "#f39c12" },
            "十一月": { start: 47, end: 97, color: "#e74c3c" },
            "十二月": { start: 98, end: routePoints.length-1, color: "#34495e" }
        };
        Object.keys(segments).forEach(month => {
            var seg = segments[month];
            if (seg.start < routePoints.length && seg.end < routePoints.length) {
                var pts = routePoints.slice(seg.start, seg.end+1);
                if (pts.length >= 2) {
                    L.polyline(pts.map(p => [p[0], p[1]]), { color: seg.color, weight: 3, opacity: 0.6 })
                        .bindPopup(`<b>${month}行程</b><br>${pts[0][3]} - ${pts[pts.length-1][3]}`).addTo(monthLayer);
                }
            }
        });
        return monthLayer;
    }
    document.getElementById('toggle-months').addEventListener('click', function() {
        var layer = getMonthLayer();
        if (map.hasLayer(layer)) { map.removeLayer(layer); this.innerHTML = '<i class="fas fa-calendar-alt"></i> 显示月份分段'; }
        else { map.addLayer(layer); this.innerHTML = '<i class="fas fa-calendar-alt"></i> 隐藏月份分段'; }
    });
    
    console.log('林则徐西行路线图加载完成！');
}

// 等待 DOM 和依赖数据就绪后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof linZexuRouteData !== 'undefined' && linZexuRouteData.length) {
            initMapAndRoutes();
        } else {
            console.error('data.js 未加载或数据为空');
        }
    });
} else {
    if (typeof linZexuRouteData !== 'undefined' && linZexuRouteData.length) {
        initMapAndRoutes();
    } else {
        console.error('data.js 未加载或数据为空');
    }
}