document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos
    const btnSync = document.getElementById('btn-sync');
    const btnAdd = document.getElementById('btn-add');
    const modal = document.getElementById('add-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveManual = document.getElementById('btn-save-manual');
    const manualInput = document.getElementById('manual-input');
    const newsContainer = document.getElementById('news-container');
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.querySelector('.status-indicator');

    // Estado inicial
    let newsData = [];

    // --- Service Worker y Notificaciones ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registrado', reg))
                .catch(err => console.error('Error al registrar Service Worker', err));
        });
    }

    async function requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Permiso de notificación concedido.');
            }
        }
    }

    function sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: 'assets/icons/icon-192.png'
            });
        }
    }

    // --- Lógica de UI y Datos ---
    
    // Cargar datos (Intenta leer news.json local, sino usa localStorage)
    async function loadNews() {
        showLoading();
        try {
            // Intentar cargar desde un archivo local (generado por la automatización futura)
            const response = await fetch('news.json', { cache: "no-store" });
            if (response.ok) {
                const data = await response.json();
                newsData = data;
                updateStatus('Inteligencia obtenida (Archivo local)', 'var(--neon-green)');
            } else {
                // Fallback a localStorage si el archivo no existe
                loadFromLocalStorage();
            }
        } catch (error) {
            console.log('No se pudo cargar news.json, usando almacenamiento local.');
            loadFromLocalStorage();
        }
        
        renderNews();
        checkNewDataAndNotify();
    }

    function loadFromLocalStorage() {
        const stored = localStorage.getItem('cyberNews');
        if (stored) {
            newsData = JSON.parse(stored);
            updateStatus('Inteligencia cargada (Almacenamiento local)', 'var(--neon-cyan)');
        } else {
            newsData = [];
            updateStatus('Sistema listo. Sin datos nuevos.', 'var(--text-secondary)');
        }
    }

    function renderNews() {
        newsContainer.innerHTML = '';
        
        if (newsData.length === 0) {
            newsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                    <p>No hay inteligencia registrada hoy.</p>
                    <p style="font-size: 0.8em; margin-top: 10px;">Usa el botón "+" para ingresar los datos de Gemini.</p>
                </div>
            `;
            return;
        }

        // Ordenar por fecha descendente (más recientes primero)
        newsData.sort((a, b) => new Date(b.date) - new Date(a.date));

        newsData.forEach(news => {
            const dateObj = new Date(news.date);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const card = document.createElement('div');
            card.className = 'news-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-tag">${news.tag || 'ALERTA'}</span>
                    <span class="card-date">${dateStr}</span>
                </div>
                <h3 class="card-title">${news.title}</h3>
                <div class="card-content">
                    <p>${formatContent(news.content)}</p>
                </div>
            `;
            newsContainer.appendChild(card);
        });
    }

    // Parsea texto plano (ej. pegado desde Gemini) a formato de tarjeta
    function parseManualInput(text) {
        if (!text.trim()) return;
        
        // Asume un formato simple: la primera línea es el título, el resto es contenido
        const lines = text.split('\n');
        const title = lines[0];
        const content = lines.slice(1).join('\n').trim();

        const newItem = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            title: title || 'Noticia sin título',
            content: content || 'Sin detalles.',
            tag: determineTag(title + ' ' + content)
        };

        newsData.push(newItem);
        localStorage.setItem('cyberNews', JSON.stringify(newsData));
        
        closeModal();
        renderNews();
        sendNotification('Nueva Inteligencia Registrada', newItem.title);
        updateStatus('Nueva entrada guardada manualmente.', 'var(--neon-green)');
    }

    // Utilidades
    function formatContent(text) {
        // Reemplaza asteriscos dobles de markdown por negritas HTML
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convertir saltos de línea en <br>
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    function determineTag(text) {
        const lower = text.toLowerCase();
        if (lower.includes('vulnerabilidad') || lower.includes('cve')) return 'VULN';
        if (lower.includes('herramienta') || lower.includes('tool')) return 'TOOL';
        if (lower.includes('malware') || lower.includes('ransomware')) return 'MALWARE';
        return 'INFO';
    }

    function showLoading() {
        newsContainer.innerHTML = `
            <div class="loading-state">
                <div class="cyber-spinner"></div>
                <p>Descifrando información...</p>
            </div>
        `;
    }

    function updateStatus(message, color) {
        statusText.textContent = message;
        statusIndicator.style.backgroundColor = color;
        statusIndicator.style.boxShadow = `0 0 8px ${color}`;
    }

    function checkNewDataAndNotify() {
        const lastCount = localStorage.getItem('newsCount') || 0;
        if (newsData.length > lastCount) {
            sendNotification('Inteligencia Actualizada', `Se han detectado ${newsData.length - lastCount} nuevas alertas.`);
            localStorage.setItem('newsCount', newsData.length);
        }
    }

    // --- Event Listeners ---
    btnSync.addEventListener('click', () => {
        loadNews();
    });

    btnAdd.addEventListener('click', () => {
        modal.classList.remove('hidden');
        manualInput.value = '';
        manualInput.focus();
    });

    function closeModal() {
        modal.classList.add('hidden');
    }

    btnCloseModal.addEventListener('click', closeModal);
    
    // Cerrar clickeando fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    btnSaveManual.addEventListener('click', () => {
        parseManualInput(manualInput.value);
    });

    // Inicialización
    requestNotificationPermission();
    loadNews();
});
