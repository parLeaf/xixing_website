// common.js
// 此文件被所有页面共享，包含导航栏渲染和公共变量

// 导航栏 HTML 模板（统一风格）
function renderNavbar(activePage) {
  return `
    <nav class="navbar">
      <div class="nav-brand">西行数字史馆</div>
      <div class="nav-links">
        <a href="index.html" class="${activePage === 'home' ? 'active' : ''}">首页</a>
        <a href="map.html" class="${activePage === 'map' ? 'active' : ''}">地图</a>
        <a href="timeline.html" class="${activePage === 'timeline' ? 'active' : ''}">时间线</a>
      </div>
    </nav>
  `;
}

// 插入导航栏到页面中（需要在 body 内预留一个 <div id="navbar-container"></div>）
function insertNavbar(activePage) {
  const container = document.getElementById('navbar-container');
  if (container) {
    container.innerHTML = renderNavbar(activePage);
  }
}

// 导出全局引用（非模块化环境）
window.isMeaningfulValue = isMeaningfulValue;
window.getRouteMonths = getRouteMonths;
window.categoryColors = categoryColors;
window.renderNavbar = renderNavbar;
window.insertNavbar = insertNavbar;