// map.js - 最终增强版
let map, markersLayer, routeLayer, allPoints = [], routePoints = [];
let currentProgressIndex = 0, isPlaying = false, playInterval = null;
let categoryLayers = {};     // 存储每个类别对应的图层组
let categoryFilterStatus = {}; // 记录每个类别的显隐状态
let pointToIndexMap = new Map(); // 将每个地点对象映射到其在 allPoints 中的索引

function initMap() {
    map = L.map('map').setView([36.5, 105.0], 5);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
        subdomains: ['1','2','3','4'],
        maxNativeZoom: 12,
        maxZoom: 18,
        attribution: '© 高德地图 | 数据来源：《林则徐日记》'
    }).addTo(map);

    // 准备数据
    allPoints = [...linZexuRouteData];
    allPoints.forEach((p, idx) => { pointToIndexMap.set(p, idx); });
    
    // 构建 routePoints 用于路线绘制
    routePoints = [];
    allPoints.forEach(p => {
        if (p.lng && p.lat && !isNaN(p.lng) && !isNaN(p.lat) && p.lng !== 0 && p.lat !== 0) {
            routePoints.push([p.lat, p.lng, p.name, p.date, p.category]);
        }
    });

    // 初始化图层组
    markersLayer = L.layerGroup();
    routeLayer = L.layerGroup();
    const allCategories = [...new Set(allPoints.map(p => p.category))];
    allCategories.forEach(cat => {
        categoryLayers[cat] = L.layerGroup();
        categoryFilterStatus[cat] = true; // 默认全部显示
    });

    // 创建标记点（不绑定默认弹窗，改为点击事件）
    allPoints.forEach((point, idx) => {
        const { lng, lat, category } = point;
        if (lng && lat && !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
            const color = categoryColors[category] || "#95a5a6";
            const radius = getMarkerRadius(category);
            const marker = L.circleMarker([lat, lng], {
                radius: radius,
                fillColor: color,
                color: "#fff",
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.7
            });
            // 点击事件：同步时间轴
            marker.on('click', () => {
                if (isPlaying) stopPlay();
                updateProgress(idx);
                // 同时打开环绕弹窗（如果你已经实现了环绕弹窗，可以在这里调用）
                // 若没有，可以复用原先的弹窗方式，这里为了简洁不重复实现
                // 但为了体验，可以弹出一个简单的信息框
                showSimplePopup(marker, point);
            });
            markersLayer.addLayer(marker);
            categoryLayers[category].addLayer(marker);
        }
    });

    // 绘制完整路线
    if (routePoints.length >= 2) {
        const latlngs = routePoints.map(p => [p[0], p[1]]);
        const routeLine = L.polyline(latlngs, {
            color: "#E74C3C",
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10'
        }).bindPopup('<b>林则徐西行完整路线</b><br>1842年七月至十二月').addTo(routeLayer);
        routeLine.on('mouseover', function() { this.setStyle({ weight: 6, opacity: 0.9, dashArray: null }); });
        routeLine.on('mouseout', function() { this.setStyle({ weight: 3, opacity: 0.7, dashArray: '5, 10' }); });
        
        // 添加起点终点大标记
        const start = routePoints[0], end = routePoints[routePoints.length-1];
        L.circleMarker([start[0], start[1]], { radius: 14, fillColor: "#27ae60", color: "#fff", weight: 2 })
            .bindPopup(`<b>🏁 起点</b><br>${start[2]}<br>${start[3]}`).addTo(markersLayer);
        L.circleMarker([end[0], end[1]], { radius: 14, fillColor: "#e74c3c", color: "#fff", weight: 2 })
            .bindPopup(`<b>🎯 终点</b><br>${end[2]}<br>${end[3]}`).addTo(markersLayer);
        
        const bounds = L.latLngBounds(latlngs);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
    }

    // 添加图层到地图（初始显示所有）
    markersLayer.addTo(map);
    routeLayer.addTo(map);
    Object.values(categoryLayers).forEach(layer => layer.addTo(map));

    // 初始化时间轴控件（需要确保 DOM 元素存在）
    const slider = document.getElementById('timeline-slider');
    const progressCountSpan = document.getElementById('progress-count');
    const currentPointInfoDiv = document.getElementById('current-point-info');
    if (slider) {
        slider.max = allPoints.length - 1;
        slider.value = allPoints.length - 1;
        progressCountSpan.innerText = `${allPoints.length}/${allPoints.length}`;
        updateProgress(allPoints.length - 1);
        slider.addEventListener('input', (e) => {
            if (isPlaying) stopPlay();
            updateProgress(parseInt(e.target.value));
        });
    }

    // 绑定播放按钮等（已有代码，略，但需确保按钮存在）
    bindControlButtons();

    // 生成图例和筛选按钮
    renderLegendAndFilters();

    // 辅助函数
    function getMarkerRadius(cat) {
        const radii = { "起点":10, "终点":10, "重要城市":9, "重要驿站":8, "重要地标":8, "名胜古迹":8 };
        return radii[cat] || 6;
    }

    function updateProgress(index) {
        if (index < 0) index = 0;
        if (index >= allPoints.length) index = allPoints.length - 1;
        currentProgressIndex = index;
        const point = allPoints[index];
        if (point) {
            if (slider) slider.value = index;
            if (progressCountSpan) progressCountSpan.innerText = `${index+1}/${allPoints.length}`;
            if (currentPointInfoDiv) currentPointInfoDiv.innerHTML = `<strong>${point.name}</strong> · ${point.date}`;
            // 移动地图视角
            map.panTo([point.lat, point.lng]);
            // 更新统计面板（如果有）
            updateStatsPanel(index);
        }
    }

    function updateStatsPanel(idx) {
        const statsContent = document.getElementById('stats-content');
        if (!statsContent) return;
        const point = allPoints[idx];
        if (!point) return;
        const catColor = categoryColors[point.category] || "#8B4513";
        statsContent.innerHTML = `
            <div class="stat-item"><span>总地点数</span><span>${allPoints.length}</span></div>
            <div class="stat-item"><span>当前进度</span><span>${Math.round((idx+1)/allPoints.length*100)}%</span></div>
            <div class="stat-item"><span>当前地点</span><span style="color:${catColor}">${point.name}</span></div>
            <div class="stat-item"><span>日期</span><span>${point.date}</span></div>
            <div class="stat-item"><span>现代位置</span><span>${point.modernPlace || '—'}</span></div>
            ${point.characters ? `<div class="stat-item"><span>人物</span><span>${point.characters.substring(0,40)}${point.characters.length>40?'…':''}</span></div>` : ''}
            <div class="stat-desc"><strong>日记摘要</strong><br>${point.desc.substring(0,100)}${point.desc.length>100?'…':''}</div>
        `;
    }

    function bindControlButtons() {
        const btnStart = document.getElementById('btn-start');
        const btnPlay = document.getElementById('btn-play');
        const btnEnd = document.getElementById('btn-end');
        if (btnStart) btnStart.onclick = () => { if(isPlaying) stopPlay(); updateProgress(0); };
        if (btnEnd) btnEnd.onclick = () => { if(isPlaying) stopPlay(); updateProgress(allPoints.length-1); };
        if (btnPlay) btnPlay.onclick = togglePlay;
        // 其他按钮（切换标记、路线、重置）原有逻辑保留，此处略
        // 获取按钮元素
        const toggleMarkersBtn = document.getElementById('toggle-markers');
        const toggleRouteBtn = document.getElementById('toggle-route');
        const resetViewBtn = document.getElementById('reset-view');
        const exportBtn = document.getElementById('export-btn');

        // 隐藏/显示所有标记点（切换 markersLayer）
        if (toggleMarkersBtn) {
            toggleMarkersBtn.addEventListener('click', () => {
                if (map.hasLayer(markersLayer)) {
                    map.removeLayer(markersLayer);
                    toggleMarkersBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> 显示标记点';
                } else {
                    map.addLayer(markersLayer);
                    toggleMarkersBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> 隐藏标记点';
                }
            });
        }

        // 隐藏/显示完整路线（切换 routeLayer）
        if (toggleRouteBtn) {
            toggleRouteBtn.addEventListener('click', () => {
                if (map.hasLayer(routeLayer)) {
                    map.removeLayer(routeLayer);
                    toggleRouteBtn.innerHTML = '<i class="fas fa-route"></i> 显示路线';
                } else {
                    map.addLayer(routeLayer);
                    toggleRouteBtn.innerHTML = '<i class="fas fa-route"></i> 隐藏路线';
                }
            });
        }

        // 重置视图：将地图视野调整到所有路线的边界
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                const allLatLngs = routePoints.map(p => [p[0], p[1]]);
                if (allLatLngs.length) {
                    const bounds = L.latLngBounds(allLatLngs);
                    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
                }
            });
        }

        // 导出 CSV：导出所有地点的数据（或当前进度）
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                let csv = "\uFEFF日期,地点名称,经度,纬度,古地名,今地名,类别,日记摘要\n";
                allPoints.forEach(p => {
                    csv += `"${p.date}","${p.name}",${p.lng},${p.lat},"${p.originalPlace || ''}","${p.modernPlace || ''}","${p.category || ''}","${p.desc.replace(/"/g, '""')}"\n`;
                });
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'linzexu_route_data.csv';
                link.click();
                URL.revokeObjectURL(link.href);
                alert('数据已导出为 CSV 文件！');
            });
        }
    }

    function togglePlay() {
        if (isPlaying) stopPlay();
        else startPlay();
    }
    function startPlay() {
        if (currentProgressIndex >= allPoints.length - 1) updateProgress(0);
        isPlaying = true;
        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
        playInterval = setInterval(() => {
            if (currentProgressIndex + 1 >= allPoints.length) stopPlay();
            else updateProgress(currentProgressIndex + 1);
        }, 1000);
    }
    function stopPlay() {
        if (playInterval) clearInterval(playInterval);
        isPlaying = false;
        const playBtn = document.getElementById('btn-play');
        if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> 播放';
    }

    function showSimplePopup(marker, point) {
        // 简单的信息窗口（可复用之前的环绕弹窗或使用 Leaflet 默认弹窗）
        const content = `
            <div style="min-width:200px;">
                <strong>${point.name}</strong><br>
                ${point.date}<br>
                ${point.desc.substring(0,80)}...
            </div>
        `;
        marker.bindPopup(content).openPopup();
    }

    function renderLegendAndFilters() {
        // 生成图例
        const legendContainer = document.getElementById('legend-items');
        if (legendContainer) {
            const categories = Object.keys(categoryColors);
            legendContainer.innerHTML = categories.map(cat => `
                <div class="legend-item">
                    <span class="legend-color" style="background:${categoryColors[cat]}"></span>
                    <span class="legend-label">${cat}</span>
                </div>
            `).join('');
        }
        // 生成筛选按钮
        const filterContainer = document.getElementById('filter-buttons');
        if (filterContainer) {
            const categories = Object.keys(categoryColors);
            filterContainer.innerHTML = categories.map(cat => `
                <button class="filter-btn-cat" data-category="${cat}">
                    <span class="filter-color-dot" style="background:${categoryColors[cat]}"></span>
                    <span>${cat}</span>
                </button>
            `).join('');
            // 绑定筛选事件
            document.querySelectorAll('.filter-btn-cat').forEach(btn => {
                btn.addEventListener('click', () => {
                    const cat = btn.getAttribute('data-category');
                    const layer = categoryLayers[cat];
                    if (!layer) return;
                    const isVisible = map.hasLayer(layer);
                    if (isVisible) {
                        map.removeLayer(layer);
                        btn.classList.remove('active');
                    } else {
                        map.addLayer(layer);
                        btn.classList.add('active');
                    }
                });
                // 默认所有类别都是显示的，添加 active 类
                btn.classList.add('active');
            });
        }
    }
}

// 启动地图
window.addEventListener('DOMContentLoaded', initMap);