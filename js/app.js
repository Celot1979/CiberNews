document.addEventListener('DOMContentLoaded', () => {
    // Referencias a elementos UI - Principales
    const btnSync = document.getElementById('btn-sync');
    const btnAdd = document.getElementById('btn-add');
    const modal = document.getElementById('add-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnSaveManual = document.getElementById('btn-save-manual');
    const manualInput = document.getElementById('manual-input');
    const newsContainer = document.getElementById('news-container');
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.querySelector('.status-indicator');

    // Referencias a elementos UI - Pestañas
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Referencias a elementos UI - Bookmarks
    const bookmarkUrl = document.getElementById('bookmark-url');
    const bookmarkTitle = document.getElementById('bookmark-title');
    const btnSaveBookmark = document.getElementById('btn-save-bookmark');
    const bookmarksContainer = document.getElementById('bookmarks-container');

    // Referencias a elementos UI - Terminal IA
    const aiInput = document.getElementById('ai-input');
    const btnSendAi = document.getElementById('btn-send-ai');
    const aiChatHistory = document.getElementById('ai-chat-history');
    const apikeyModal = document.getElementById('apikey-modal');
    const apikeyInput = document.getElementById('apikey-input');
    const btnSaveApikey = document.getElementById('btn-save-apikey');
    const btnCloseApikeyModal = document.getElementById('btn-close-apikey-modal');

    // Estado local
    let newsData = [];
    let deletedNewsIds = JSON.parse(localStorage.getItem('cyberDeletedNews') || '[]');
    let bookmarksData = JSON.parse(localStorage.getItem('cyberBookmarks') || '[]');
    let localApiKey = localStorage.getItem('geminiLocalApiKey');

    // --- Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => console.error('Error al registrar Service Worker', err));
        });
    }

    // --- Lógica de Pestañas ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');

            // Si entra a terminal IA sin API key, pedirla
            if (targetId === 'tab-ai' && !localApiKey) {
                apikeyModal.classList.remove('hidden');
            }
        });
    });

    // --- Lógica de Noticias ---
    async function loadNews() {
        showLoading();
        try {
            // Intentamos cargar desde GitHub Pages (news.json)
            const response = await fetch('news.json', { cache: "no-store" });
            if (response.ok) {
                newsData = await response.json();
                updateStatus('Inteligencia obtenida (Nube)', 'var(--neon-green)');
            } else {
                loadFromLocalStorage();
            }
        } catch (error) {
            loadFromLocalStorage();
        }
        renderNews();
    }

    function loadFromLocalStorage() {
        const stored = localStorage.getItem('cyberNews');
        if (stored) {
            newsData = JSON.parse(stored);
            updateStatus('Inteligencia cargada (Local)', 'var(--neon-cyan)');
        } else {
            newsData = [];
            updateStatus('Sistema listo. Sin datos.', 'var(--text-secondary)');
        }
    }

    function renderNews() {
        newsContainer.innerHTML = '';
        
        // Filtrar noticias borradas
        const visibleNews = newsData.filter(n => !deletedNewsIds.includes(n.id));

        if (visibleNews.length === 0) {
            newsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                    <p>No hay inteligencia activa.</p>
                </div>
            `;
            return;
        }

        visibleNews.sort((a, b) => new Date(b.date) - new Date(a.date));

        visibleNews.forEach(news => {
            const dateObj = new Date(news.date);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const card = document.createElement('div');
            card.className = 'news-card';
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-tag">${news.tag || 'ALERTA'}</span>
                    <div class="card-actions">
                        <span class="card-date">${dateStr}</span>
                        <button class="btn-delete-card" data-id="${news.id}" title="Eliminar Alerta">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
                <h3 class="card-title">${news.title}</h3>
                <div class="card-content">
                    <p>${formatContent(news.content)}</p>
                </div>
            `;
            
            // Evento borrar
            card.querySelector('.btn-delete-card').addEventListener('click', () => {
                deleteNews(news.id);
            });
            
            newsContainer.appendChild(card);
        });
    }

    function deleteNews(id) {
        if (!id) return;
        deletedNewsIds.push(id);
        localStorage.setItem('cyberDeletedNews', JSON.stringify(deletedNewsIds));
        renderNews();
    }

    // --- Lógica Ingreso Manual ---
    function parseManualInput(text) {
        if (!text.trim()) return;
        const lines = text.split('\n');
        const newItem = {
            id: 'manual_' + Date.now().toString(),
            date: new Date().toISOString(),
            title: lines[0] || 'Alerta Manual',
            content: lines.slice(1).join('\n').trim() || 'Sin detalles.',
            tag: determineTag(text)
        };
        newsData.push(newItem);
        localStorage.setItem('cyberNews', JSON.stringify(newsData));
        modal.classList.add('hidden');
        renderNews();
    }

    // --- Lógica Bookmarks (Leer más tarde) ---
    function renderBookmarks() {
        bookmarksContainer.innerHTML = '';
        if (bookmarksData.length === 0) {
            bookmarksContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No hay URLs guardadas.</p>';
            return;
        }
        bookmarksData.forEach(b => {
            const item = document.createElement('div');
            item.className = 'bookmark-item';
            item.innerHTML = `
                <a href="${b.url}" target="_blank" class="bookmark-link">${b.title || b.url}</a>
                <button class="btn-delete-card" data-id="${b.id}">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            item.querySelector('.btn-delete-card').addEventListener('click', () => {
                bookmarksData = bookmarksData.filter(x => x.id !== b.id);
                localStorage.setItem('cyberBookmarks', JSON.stringify(bookmarksData));
                renderBookmarks();
            });
            bookmarksContainer.appendChild(item);
        });
    }

    btnSaveBookmark.addEventListener('click', () => {
        if (!bookmarkUrl.value.trim()) return;
        bookmarksData.push({
            id: Date.now().toString(),
            url: bookmarkUrl.value.trim(),
            title: bookmarkTitle.value.trim()
        });
        localStorage.setItem('cyberBookmarks', JSON.stringify(bookmarksData));
        bookmarkUrl.value = '';
        bookmarkTitle.value = '';
        renderBookmarks();
    });

    // --- Lógica Terminal IA (Gemini) ---
    btnSaveApikey.addEventListener('click', () => {
        const key = apikeyInput.value.trim();
        if (key) {
            localStorage.setItem('geminiLocalApiKey', key);
            localApiKey = key;
            apikeyModal.classList.add('hidden');
            appendChatMessage('bot', 'API Key configurada. Conexión segura establecida.');
        }
    });

    btnCloseApikeyModal.addEventListener('click', () => apikeyModal.classList.add('hidden'));

    async function sendToGemini() {
        const prompt = aiInput.value.trim();
        if (!prompt) return;
        if (!localApiKey) {
            apikeyModal.classList.remove('hidden');
            return;
        }

        appendChatMessage('user', prompt);
        aiInput.value = '';
        
        // Elemento temporal de carga
        const loadingId = 'loading_' + Date.now();
        appendChatMessage('bot', '<span class="cyber-spinner" style="display:inline-block; width:15px; height:15px; border-width:1px; margin-bottom:0;"></span> Procesando...', loadingId);

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${localApiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();
            document.getElementById(loadingId).remove(); // quitar loading

            if (data.error) {
                appendChatMessage('bot', `Error de API: ${data.error.message}`);
                // Si la api key es inválida, sugerir cambiarla
                if (data.error.code === 400 || data.error.code === 403) {
                    localStorage.removeItem('geminiLocalApiKey');
                    localApiKey = null;
                }
            } else if (data.candidates && data.candidates[0].content) {
                const reply = data.candidates[0].content.parts[0].text;
                appendChatMessage('bot', formatContent(reply));
            }
        } catch (error) {
            document.getElementById(loadingId)?.remove();
            appendChatMessage('bot', 'Error de conexión local. Revisa tu internet.');
        }
    }

    function appendChatMessage(sender, text, id = null) {
        const div = document.createElement('div');
        div.className = `chat-message ${sender}`;
        if (id) div.id = id;
        
        const senderName = sender === 'bot' ? 'Gemini:' : 'Tú:';
        div.innerHTML = `<span class="chat-sender">${senderName}</span><p>${text}</p>`;
        
        aiChatHistory.appendChild(div);
        aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
    }

    btnSendAi.addEventListener('click', sendToGemini);
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendToGemini();
    });


    // --- Utilidades ---
    function formatContent(text) {
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\n/g, '<br>');
        return formatted;
    }

    function determineTag(text) {
        const lower = text.toLowerCase();
        if (lower.includes('vulnerabilidad') || lower.includes('cve')) return 'VULN';
        if (lower.includes('herramienta') || lower.includes('tool')) return 'TOOL';
        return 'INFO';
    }

    function showLoading() {
        newsContainer.innerHTML = '<div class="loading-state"><div class="cyber-spinner"></div></div>';
    }

    function updateStatus(message, color) {
        statusText.textContent = message;
        statusIndicator.style.backgroundColor = color;
        statusIndicator.style.boxShadow = `0 0 8px ${color}`;
    }

    // --- Init ---
    btnSync.addEventListener('click', loadNews);
    btnAdd.addEventListener('click', () => { modal.classList.remove('hidden'); });
    btnCloseModal.addEventListener('click', () => { modal.classList.add('hidden'); });
    btnSaveManual.addEventListener('click', () => parseManualInput(manualInput.value));

    loadNews();
    renderBookmarks();
});
