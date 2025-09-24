/**
 * DRAWERS COMPONENT - RainbowGold Tap
 * Manejo de paneles deslizantes laterales (Boosters, Inbox, Profile, Ideas)
 */

// === DRAWER MANAGEMENT ===
let openDrawer = null; // tracking del drawer abierto

/**
 * Abre un drawer específico
 * @param {string} id - ID del drawer (UP, IN, PF, ID)
 */
function openDrawer(id) {
  closeAllDrawers(); // cierra cualquier drawer abierto primero
  
  const drawer = document.getElementById(`drawer${id}`);
  const backdrop = document.getElementById(`backdrop${id}`);
  
  if (!drawer || !backdrop) {
    console.warn(`Drawer ${id} no encontrado`);
    return;
  }

  // Prevenir scroll del body
  document.body.classList.add('has-drawer');
  
  // Mostrar backdrop
  backdrop.classList.add('backdrop--show');
  
  // Mostrar drawer con animación
  drawer.classList.add('drawer--open');
  drawer.style.display = 'block';
  
  // Tracking
  openDrawer = id;
  
  // Focus management para accesibilidad
  const firstFocusable = drawer.querySelector('button, input, select, textarea, [tabindex]');
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 300);
  }
}

/**
 * Cierra un drawer específico
 * @param {string} id - ID del drawer a cerrar
 */
function closeDrawer(id) {
  const drawer = document.getElementById(`drawer${id}`);
  const backdrop = document.getElementById(`backdrop${id}`);
  
  if (!drawer || !backdrop) return;

  // Restaurar scroll del body
  document.body.classList.remove('has-drawer');
  
  // Ocultar backdrop
  backdrop.classList.remove('backdrop--show');
  
  // Ocultar drawer
  drawer.classList.remove('drawer--open');
  
  // Limpiar tracking
  if (openDrawer === id) {
    openDrawer = null;
  }
  
  // Opcional: ocultar drawer después de la animación
  setTimeout(() => {
    if (!drawer.classList.contains('drawer--open')) {
      drawer.style.display = 'none';
    }
  }, 300);
}

/**
 * Cierra todos los drawers abiertos
 */
function closeAllDrawers() {
  const drawers = ['UP', 'IN', 'PF', 'ID'];
  drawers.forEach(id => {
    const drawer = document.getElementById(`drawer${id}`);
    const backdrop = document.getElementById(`backdrop${id}`);
    
    if (drawer && drawer.classList.contains('drawer--open')) {
      closeDrawer(id);
    }
  });
}

/**
 * Toggle de drawer (abre si está cerrado, cierra si está abierto)
 * @param {string} id - ID del drawer
 */
function toggleDrawer(id) {
  const drawer = document.getElementById(`drawer${id}`);
  if (!drawer) return;
  
  if (drawer.classList.contains('drawer--open')) {
    closeDrawer(id);
  } else {
    openDrawer(id);
  }
}

// === EVENT LISTENERS SETUP ===
function initDrawers() {
  // Listeners para abrir drawers
  const openUp = document.getElementById('openUp');
  const inboxBtn = document.getElementById('inboxBtn');
  const profileBtn = document.getElementById('profileBtn');
  const ideasBtn = document.getElementById('ideasBtn');
  
  if (openUp) {
    openUp.addEventListener('click', () => openDrawer('UP'));
  }
  
  if (inboxBtn) {
    inboxBtn.addEventListener('click', () => openDrawer('IN'));
  }
  
  if (profileBtn) {
    profileBtn.addEventListener('click', () => openDrawer('PF'));
  }
  
  if (ideasBtn) {
    ideasBtn.addEventListener('click', () => openDrawer('ID'));
  }

  // Listeners para cerrar drawers (botones X)
  const closeButtons = document.querySelectorAll('.drawer .close');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const drawer = e.target.closest('.drawer');
      if (drawer) {
        const id = drawer.id.replace('drawer', '');
        closeDrawer(id);
      }
    });
  });

  // Cerrar drawer al hacer click en backdrop
  const backdrops = document.querySelectorAll('.backdrop');
  backdrops.forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        const id = backdrop.id.replace('backdrop', '');
        closeDrawer(id);
      }
    });
  });

  // Cerrar drawer con tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openDrawer) {
      closeDrawer(openDrawer);
    }
  });

  // Prevenir scroll cuando hay drawer abierto (touch devices)
  document.addEventListener('touchmove', (e) => {
    if (document.body.classList.contains('has-drawer')) {
      const drawer = document.querySelector('.drawer.drawer--open');
      if (drawer && !drawer.contains(e.target)) {
        e.preventDefault();
      }
    }
  }, { passive: false });
}

// === DRAWER UTILITIES ===

/**
 * Verifica si hay algún drawer abierto
 * @returns {boolean}
 */
function hasOpenDrawer() {
  return openDrawer !== null;
}

/**
 * Obtiene el ID del drawer actualmente abierto
 * @returns {string|null}
 */
function getCurrentDrawer() {
  return openDrawer;
}

/**
 * Aplica fade-in escalonado a elementos dentro del drawer
 * @param {string} drawerId - ID del drawer
 */
function animateDrawerContent(drawerId) {
  const drawer = document.getElementById(`drawer${drawerId}`);
  if (!drawer) return;
  
  const items = drawer.querySelectorAll(':scope > *:not(.close)');
  items.forEach((item, index) => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(10px) scale(.985)';
    
    setTimeout(() => {
      item.style.transition = 'opacity 0.42s cubic-bezier(.22,1,.36,1), transform 0.42s cubic-bezier(.22,1,.36,1)';
      item.style.opacity = '1';
      item.style.transform = 'translateY(0) scale(1)';
    }, index * 40 + 40);
  });
}

// === DRAWER CONTENT HELPERS ===

/**
 * Actualiza el badge del inbox
 * @param {number} count - Número de mensajes no leídos
 */
function updateInboxBadge(count) {
  const badge = document.getElementById('inboxBadge');
  if (!badge) return;
  
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count.toString();
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Añade clase de animación al drawer cuando se abre
 */
function enhanceDrawerAnimation() {
  // Observer para detectar cuando se abre un drawer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.classList.contains('drawer') && target.classList.contains('drawer--open')) {
          const id = target.id.replace('drawer', '');
          setTimeout(() => animateDrawerContent(id), 100);
        }
      }
    });
  });
  
  // Observar todos los drawers
  const drawers = document.querySelectorAll('.drawer');
  drawers.forEach(drawer => {
    observer.observe(drawer, { attributes: true });
  });
}

// === EXPORT PARA USO GLOBAL ===
// Hacer disponibles las funciones globalmente
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.closeAllDrawers = closeAllDrawers;
window.toggleDrawer = toggleDrawer;
window.hasOpenDrawer = hasOpenDrawer;
window.getCurrentDrawer = getCurrentDrawer;
window.updateInboxBadge = updateInboxBadge;

// === INICIALIZACIÓN ===
// Auto-inicialización cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initDrawers();
    enhanceDrawerAnimation();
  });
} else {
  initDrawers();
  enhanceDrawerAnimation();
}