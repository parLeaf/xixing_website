// map.js - 最终增强版（环绕弹窗 + 术语高亮 + 统计面板高亮）
let map, markersLayer, routeLayer, allPoints = [], routePoints = [];
let currentProgressIndex = 0, isPlaying = false, playInterval = null;
let categoryLayers = {};
let categoryFilterStatus = {};
let pointToIndexMap = new Map();

function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

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
    categoryFilterStatus[cat] = true;
  });

  // 创建标记点
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
      marker.on('click', () => {
        if (isPlaying) stopPlay();
        updateProgress(idx);
        showFloatingInfo(marker, point);
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
    
    const start = routePoints[0], end = routePoints[routePoints.length-1];
    L.circleMarker([start[0], start[1]], { radius: 14, fillColor: "#27ae60", color: "#fff", weight: 2 })
      .bindPopup(`<b>🏁 起点</b><br>${start[2]}<br>${start[3]}`).addTo(markersLayer);
    L.circleMarker([end[0], end[1]], { radius: 14, fillColor: "#e74c3c", color: "#fff", weight: 2 })
      .bindPopup(`<b>🎯 终点</b><br>${end[2]}<br>${end[3]}`).addTo(markersLayer);
    
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
  }

  markersLayer.addTo(map);
  routeLayer.addTo(map);
  Object.values(categoryLayers).forEach(layer => layer.addTo(map));

  // 初始化时间轴控件
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

  bindControlButtons();
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
      map.panTo([point.lat, point.lng]);
      updateStatsPanel(index);
    }
  }

  // 修改后的统计面板：支持术语高亮
  function updateStatsPanel(idx) {
    const statsContent = document.getElementById('stats-content');
    if (!statsContent) return;
    const point = allPoints[idx];
    if (!point) return;
    const catColor = categoryColors[point.category] || "#8B4513";
    
    // 对需要显示的文本进行高亮
    const descHighlight = highlightTerms(point.desc.substring(0, 100) + (point.desc.length > 100 ? '…' : ''));
    const charactersHighlight = highlightTerms(point.characters ? (point.characters.substring(0,40) + (point.characters.length>40?'…':'')) : '');
    const modernPlaceHighlight = highlightTerms(point.modernPlace || '—');
    
    statsContent.innerHTML = `
      <div class="stat-item"><span>总地点数</span><span>${allPoints.length}</span></div>
      <div class="stat-item"><span>当前进度</span><span>${Math.round((idx+1)/allPoints.length*100)}%</span></div>
      <div class="stat-item"><span>当前地点</span><span style="color:${catColor}">${point.name}</span></div>
      <div class="stat-item"><span>日期</span><span>${point.date}</span></div>
      <div class="stat-item"><span>现代位置</span><span>${modernPlaceHighlight}</span></div>
      ${point.characters ? `<div class="stat-item"><span>人物</span><span>${charactersHighlight}</span></div>` : ''}
      <div class="stat-desc"><strong>日记摘要</strong><br>${descHighlight}</div>
    `;
    // 绑定新生成的高亮词条点击事件
    bindTermClick();
  }

  function bindControlButtons() {
    const btnStart = document.getElementById('btn-start');
    const btnPlay = document.getElementById('btn-play');
    const btnEnd = document.getElementById('btn-end');
    if (btnStart) btnStart.onclick = () => { if(isPlaying) stopPlay(); updateProgress(0); };
    if (btnEnd) btnEnd.onclick = () => { if(isPlaying) stopPlay(); updateProgress(allPoints.length-1); };
    if (btnPlay) btnPlay.onclick = togglePlay;
    
    const toggleMarkersBtn = document.getElementById('toggle-markers');
    const toggleRouteBtn = document.getElementById('toggle-route');
    const resetViewBtn = document.getElementById('reset-view');
    const exportBtn = document.getElementById('export-btn');

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

    if (resetViewBtn) {
      resetViewBtn.addEventListener('click', () => {
        const allLatLngs = routePoints.map(p => [p[0], p[1]]);
        if (allLatLngs.length) {
          const bounds = L.latLngBounds(allLatLngs);
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 7 });
        }
      });
    }

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

  function renderLegendAndFilters() {
      // 图例部分不变
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
      
      // 筛选面板
      const filterContainer = document.getElementById('filter-buttons');
      if (filterContainer) {
          // 增加提示文字（如果尚未添加）
          const filterPanel = document.querySelector('.category-filter');
          if (filterPanel && !filterPanel.querySelector('.filter-hint')) {
              const hintDiv = document.createElement('div');
              hintDiv.className = 'filter-hint';
              hintDiv.innerHTML = '<i class="fas fa-info-circle"></i> 点击切换显示/隐藏';
              filterPanel.insertBefore(hintDiv, filterContainer);
          }
          
          const categories = Object.keys(categoryColors);
          filterContainer.innerHTML = categories.map(cat => `
              <button class="filter-btn-cat active" data-category="${cat}">
                  <span class="filter-color-dot" style="background:${categoryColors[cat]}"></span>
                  <span>${cat}</span>
                  <i class="fas fa-check" style="margin-left: auto; font-size: 0.7rem; opacity: 0.9;"></i>
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
                      // 隐藏 ✓ 图标（实际上通过CSS控制显示，但这里可以移出图标）
                      const checkIcon = btn.querySelector('.fa-check');
                      if (checkIcon) checkIcon.style.opacity = '0';
                  } else {
                      map.addLayer(layer);
                      btn.classList.add('active');
                      const checkIcon = btn.querySelector('.fa-check');
                      if (checkIcon) checkIcon.style.opacity = '0.9';
                  }
              });
              // 初始状态所有类别都是显示的，因此按钮为 active 状态，✓ 可见
              const checkIcon = btn.querySelector('.fa-check');
              if (checkIcon) checkIcon.style.opacity = '0.9';
          });
      }
  }
}

// ========== 环绕弹窗与模态框 ==========
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
    return c;
  }).replace(/\n/g, ' ').replace(/"/g, '&quot;');
}

function showDetailModal(content) {
  const modal = document.createElement('div');
  modal.className = 'detail-modal';
  modal.innerHTML = `
    <div class="detail-modal-content">
      <div class="detail-modal-body">${highlightTerms(content)}</div>
      <button class="close-modal">关闭</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.close-modal').addEventListener('click', () => modal.remove());
  bindTermClick();
}

function showFloatingInfo(marker, point) {
  const oldDiv = document.getElementById('floating-info-panel');
  if (oldDiv) oldDiv.remove();

  const latlng = marker.getLatLng();
  // 获取地图容器在视口中的位置
  const mapContainer = document.getElementById('map');
  const mapRect = mapContainer.getBoundingClientRect();
  const pointInMap = map.latLngToContainerPoint(latlng);
  const viewportX = mapRect.left + pointInMap.x;
  const viewportY = mapRect.top + pointInMap.y;

  const panel = document.createElement('div');
  panel.id = 'floating-info-panel';
  panel.className = 'floating-info-container';

  const fields = [
    { label: '📖 日记摘要', key: 'desc', icon: 'fa-book-open', bgColor: '#FDF5E6', borderColor: '#B87C4F' },
    { label: '🏛️ 古地名', key: 'originalPlace', icon: 'fa-landmark', bgColor: '#F4E4C1', borderColor: '#C28B5E' },
    { label: '📍 今地名', key: 'modernPlace', icon: 'fa-map-marker-alt', bgColor: '#F4E4C1', borderColor: '#C28B5E' },
    { label: '👥 人物', key: 'characters', icon: 'fa-users', bgColor: '#E3F0EC', borderColor: '#2F6B5E' },
    { label: '🌾 物产', key: 'products', icon: 'fa-apple-alt', bgColor: '#FFE4B5', borderColor: '#D97A2B' },
    { label: '🍜 饮食', key: 'food', icon: 'fa-utensils', bgColor: '#FAD1C0', borderColor: '#BF6F4A' },
    { label: '😊 情感', key: 'emotion', icon: 'fa-heart', bgColor: '#FCE4EC', borderColor: '#B5495B' },
    { label: '📚 地方志', key: 'localRecords', icon: 'fa-book', bgColor: '#E3EAF0', borderColor: '#3A6B8F' }
  ];

  let cardsHtml = '';
  fields.forEach(f => {
    let value = point[f.key];
    if (value && typeof value === 'string' && value.trim() !== "" && value !== "未提及" && value !== "——" && value !== "无") {
      // 预览文本：只取纯文本前 70 字符，避免 HTML 标签破坏布局
      const plainText = value.replace(/<[^>]*>/g, ''); // 去除可能已存在的HTML
      const preview = plainText.length > 70 ? plainText.substring(0, 70) + '…' : plainText;
      cardsHtml += `
        <div class="info-card" data-fulltext="${escapeHtml(value)}" 
             style="background-color: ${f.bgColor}; border-left-color: ${f.borderColor};">
          <div class="info-card-icon"><i class="fas ${f.icon}" style="color: ${f.borderColor};"></i></div>
          <div class="info-card-content">
            <div class="info-card-title">${f.label}</div>
            <div class="info-card-preview">${escapeHtml(preview)}</div>
          </div>
        </div>
      `;
    }
  });

  if (cardsHtml === '') {
    panel.innerHTML = '<div class="info-card" style="background:#f0e6d2;">无详细资料</div>';
  } else {
    panel.innerHTML = cardsHtml;
  }

  document.body.appendChild(panel);

  // 获取面板尺寸并计算最佳位置（避开地图控件）
  const panelRect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // 定义避让区域（相对视口）
  const avoidAreas = [
    { // 左上角时间轴卡片
      left: 20, right: 340, top: 80, bottom: 380
    },
    { // 右上角操作面板 + 筛选面板
      left: viewportWidth - 200, right: viewportWidth - 20, top: 80, bottom: 480
    },
    { // 左下角图例
      left: 20, right: 200, top: viewportHeight - 200, bottom: viewportHeight - 20
    },
    { // 右下角统计面板
      left: viewportWidth - 310, right: viewportWidth - 20, top: viewportHeight - 350, bottom: viewportHeight - 20
    }
  ];

  // 候选位置（相对于点击点）
  let candidates = [
    { left: viewportX + 15, top: viewportY - panelRect.height / 2 },  // 右侧偏中
    { left: viewportX - panelRect.width - 15, top: viewportY - panelRect.height / 2 }, // 左侧偏中
    { left: viewportX - panelRect.width / 2, top: viewportY - panelRect.height - 15 }, // 上方
    { left: viewportX - panelRect.width / 2, top: viewportY + 15 }  // 下方
  ];

  let bestPos = null;
  let bestOverlap = Infinity;

  for (let cand of candidates) {
    let left = cand.left;
    let top = cand.top;
    // 边界约束
    left = Math.min(Math.max(left, 10), viewportWidth - panelRect.width - 10);
    top = Math.min(Math.max(top, 10), viewportHeight - panelRect.height - 10);
    
    // 计算与各控件的重叠面积
    let overlap = 0;
    for (let area of avoidAreas) {
      const overlapLeft = Math.max(left, area.left);
      const overlapRight = Math.min(left + panelRect.width, area.right);
      const overlapTop = Math.max(top, area.top);
      const overlapBottom = Math.min(top + panelRect.height, area.bottom);
      if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        overlap += (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
      }
    }
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestPos = { left, top };
    }
    if (bestOverlap === 0) break;
  }

  panel.style.position = 'absolute';
  panel.style.left = bestPos.left + 'px';
  panel.style.top = bestPos.top + 'px';
  panel.style.zIndex = 2000;

  // 绑定卡片点击事件（显示完整高亮内容）
  panel.querySelectorAll('.info-card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const fullText = card.getAttribute('data-fulltext');
      if (fullText) showDetailModal(fullText);
    });
  });

  // 点击外部关闭
  setTimeout(() => {
    const closeHandler = (e) => {
      if (!panel.contains(e.target)) {
        panel.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 100);
}

// 辅助：根据背景色计算边框深色
// function getBorderColor(bgColor) {
//   // 简单映射，也可以使用 chroma 库，这里手动定义
//   const map = {
//     '#f9e5b3': '#d4a017',
//     '#c9e9ff': '#2c7da0',
//     '#d4f1f9': '#1f7a8c',
//     '#c8e6d9': '#2e7d64',
//     '#ffe0b5': '#c45c1b',
//     '#fbc4c4': '#b33b3b',
//     '#e0d3ff': '#6a4e9e'
//   };
//   return map[bgColor] || '#555';
// }

window.addEventListener('DOMContentLoaded', initMap);