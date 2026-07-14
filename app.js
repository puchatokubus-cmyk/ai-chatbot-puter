const elements = {
    messages: document.getElementById('messages'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    newChat: document.getElementById('newChat'),
    chatHistory: document.getElementById('chatHistory'),
    chatTitle: document.getElementById('chatTitle'),
    modelSelect: document.getElementById('modelSelect'),
    searchToggle: document.getElementById('searchToggle'),
};

let chats = JSON.parse(localStorage.getItem('trap_chats') || '[]');
let currentChatId = localStorage.getItem('trap_current_chat');
let searchEnabled = false;
const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

function saveChats() {
    localStorage.setItem('trap_chats', JSON.stringify(chats));
    localStorage.setItem('trap_current_chat', currentChatId);
}

function createChat() {
    const chat = {
        id: Date.now().toString(),
        title: 'Nowy czat',
        messages: [],
        createdAt: new Date().toISOString(),
    };
    chats.unshift(chat);
    currentChatId = chat.id;
    saveChats();
    renderChatHistory();
    renderMessages();
    elements.userInput.focus();
}

function getCurrentChat() {
    return chats.find(c => c.id === currentChatId);
}

function renderChatHistory() {
    elements.chatHistory.innerHTML = chats.map(chat => `
        <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" data-id="${chat.id}">
            ${chat.title}
        </div>
    `).join('');

    elements.chatHistory.querySelectorAll('.chat-item').forEach(el => {
        el.addEventListener('click', () => {
            currentChatId = el.dataset.id;
            saveChats();
            renderChatHistory();
            renderMessages();
        });
    });
}

function renderMessages() {
    const chat = getCurrentChat();
    if (!chat) {
        elements.messages.innerHTML = '';
        elements.chatTitle.textContent = 'TrapAi';
        return;
    }

    elements.chatTitle.textContent = chat.title === 'Nowy czat' ? 'TrapAi' : chat.title;

    if (chat.messages.length === 0) {
        elements.messages.innerHTML = `
            <div class="welcome-msg">
                <h2>TrapAi</h2>
                <p>Twoj asystent do trapowych newsow, muzyki i kultury</p>
                <p class="welcome-hint">Zapytaj o najnowsze premiery, artystow, newsy</p>
                <div class="quick-commands">
                    <button class="quick-cmd" onclick="quickAsk('Co slychac w trapie?')">Newsy trapowe</button>
                    <button class="quick-cmd" onclick="quickAsk('Polecisz dobre trap albumy?')">Albumy</button>
                    <button class="quick-cmd" onclick="quickAsk('Kto jest hot w trapie?')">Hot artysci</button>
                    <button class="quick-cmd" onclick="quickAsk('Co to jest trap?')">Czym jest trap?</button>
                </div>
            </div>
        `;
        return;
    }

    elements.messages.innerHTML = chat.messages.map(msg => {
        const searchBadge = msg.searched ? '<span class="search-badge">+ szukanie w sieci</span>' : '';
        const sourcesHtml = msg.sources && msg.sources.length > 0 
            ? `<div class="message-sources"><span>Zrodla:</span> ${msg.sources.map((s, i) => `<a href="${s}" target="_blank">[${i+1}]</a>`).join(' ')}</div>`
            : '';
        return `
            <div class="message ${msg.role}">
                <div class="message-role">${msg.role === 'user' ? 'Ty' : 'TrapAi'}${searchBadge}</div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
                ${sourcesHtml}
            </div>
        `;
    }).join('');

    elements.messages.scrollTop = elements.messages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.quickAsk = function(text) {
    elements.userInput.value = text;
    sendMessage();
};

function getCachedResults(query) {
    const cached = searchCache.get(query);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    searchCache.delete(query);
    return null;
}

function setCacheResults(query, data) {
    searchCache.set(query, { data, timestamp: Date.now() });
    if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
}

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await puter.net.fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

async function searchDuckDuckGo(query) {
    try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetchWithTimeout(searchUrl, 15000);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const resultElements = doc.querySelectorAll('.result');
        
        for (let i = 0; i < Math.min(resultElements.length, 8); i++) {
            const el = resultElements[i];
            const titleEl = el.querySelector('.result__title');
            const linkEl = titleEl ? titleEl.querySelector('a') : null;
            const snippetEl = el.querySelector('.result__snippet');
            
            if (linkEl) {
                const title = linkEl.textContent.trim();
                const href = linkEl.getAttribute('href');
                let url = href;
                if (href && href.includes('uddg=')) {
                    const match = href.match(/uddg=([^&]+)/);
                    if (match) url = decodeURIComponent(match[1]);
                }
                const snippet = snippetEl ? snippetEl.textContent.trim() : '';
                results.push({ title, snippet, url });
            }
        }
        
        return results;
    } catch (error) {
        return [];
    }
}

async function searchBrave(query) {
    try {
        const searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
        const response = await fetchWithTimeout(searchUrl, 15000);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const resultElements = doc.querySelectorAll('.snippet');
        
        for (let i = 0; i < Math.min(resultElements.length, 8); i++) {
            const el = resultElements[i];
            const titleEl = el.querySelector('.snippet-title');
            const linkEl = el.querySelector('a');
            const descEl = el.querySelector('.snippet-description');
            
            if (titleEl && linkEl) {
                results.push({
                    title: titleEl.textContent.trim(),
                    url: linkEl.href,
                    snippet: descEl ? descEl.textContent.trim() : ''
                });
            }
        }
        
        return results;
    } catch (error) {
        return [];
    }
}

async function searchGoogle(query) {
    try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=pl`;
        const response = await fetchWithTimeout(searchUrl, 15000);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const resultElements = doc.querySelectorAll('div.g, div[data-sokoban-container]');
        
        for (let i = 0; i < Math.min(resultElements.length, 8); i++) {
            const el = resultElements[i];
            const titleEl = el.querySelector('h3');
            const linkEl = el.querySelector('a');
            const snippetEl = el.querySelector('div[data-sncf], div.VwiC3b, span.aCOpRe');
            
            if (titleEl && linkEl && linkEl.href.startsWith('http')) {
                results.push({
                    title: titleEl.textContent.trim(),
                    url: linkEl.href,
                    snippet: snippetEl ? snippetEl.textContent.trim() : ''
                });
            }
        }
        
        return results;
    } catch (error) {
        return [];
    }
}

async function searchWeb(query) {
    const cached = getCachedResults(query);
    if (cached) return cached;
    
    let results = [];
    
    results = await searchDuckDuckGo(query);
    if (results.length === 0) {
        results = await searchBrave(query);
    }
    if (results.length === 0) {
        results = await searchGoogle(query);
    }
    
    if (results.length > 0) {
        setCacheResults(query, results);
    }
    
    return results;
}

function formatSearchResults(results) {
    if (!results || results.length === 0) {
        return { text: '', sources: [] };
    }
    
    const sources = results.map(r => r.url).filter(u => u);
    const text = results.map((r, i) => {
        return `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`;
    }).join('\n\n');
    
    return { text, sources };
}

async function sendMessage() {
    const text = elements.userInput.value.trim();
    if (!text) return;

    let chat = getCurrentChat();
    if (!chat) {
        createChat();
        chat = getCurrentChat();
    }

    chat.messages.push({ role: 'user', content: text });

    if (chat.messages.length === 1) {
        chat.title = text.substring(0, 40) + (text.length > 40 ? '...' : '');
    }

    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    elements.sendBtn.disabled = true;
    renderMessages();
    renderChatHistory();

    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant';
    typingEl.innerHTML = `
        <div class="message-role">TrapAi</div>
        <div class="typing-indicator"><span></span><span></span><span></span></div>
    `;
    elements.messages.appendChild(typingEl);
    elements.messages.scrollTop = elements.messages.scrollHeight;

    try {
        const model = elements.modelSelect.value;
        
        const lowerText = text.toLowerCase();
        const shouldSearch = searchEnabled || 
            lowerText.includes('szukaj') || 
            lowerText.includes('sprawdz') || 
            lowerText.includes('newsy') || 
            lowerText.includes('najnowsze') ||
            lowerText.includes('aktualne') ||
            lowerText.includes('co sie dzieje') ||
            lowerText.includes('premiera') ||
            lowerText.includes('premiery') ||
            lowerText.includes('kto jest') ||
            lowerText.includes('jakie sa') ||
            lowerText.includes('co nowego') ||
            lowerText.includes('nowy') ||
            lowerText.includes('nowa');

        let searchResults = [];
        let searched = false;
        let sources = [];

        if (shouldSearch) {
            searchResults = await searchWeb(text + ' trap muzyka 2025 2026');
            searched = true;
        }

        const formatted = formatSearchResults(searchResults);
        sources = formatted.sources;

        let systemPrompt = `Jestes TrapAi - ekspertem od trapowej muzyki, kultury i newsow. 

Twoje zadania:
- Odpowiadasz o trapowej muzyce (polskiej i swiatowej)
- Znasz najnowsze newsy, premiery, plotki ze swiata trapu
- Polecasz albumy, utwory, artystow
- Wyjasniasz historie i ewolucje trapu
- Odpowiadasz o kulturze hip-hopu i streetwearze
- Jezyk: polski (chyba ze uzytkownik pisze po angielsku)
- Styl: luzny, ale kompetentny - jak kumpel ktory zna sie na rzeczy
- Zawsze podawaj aktualne informacje z 2025/2026 roku`;

        let userMessage = text;
        if (formatted.text) {
            systemPrompt += `\n\nMasz dostep do swiezych wynikow wyszukiwania z internecie. Uzyj ich aby odpowiedziec na pytanie uzytkownika. Podawaj aktualne informacje. Jesli wyniki wyszukiwania zawieraja relevantne informacje, odnies sie do nich i podaj zrodla.`;
            userMessage = `${text}\n\n--- WYNIKI WYSZUKIWANIA ---\n${formatted.text}\n--- KONIEC WYNIKOW ---`;
        }

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...chat.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage }
        ];

        const response = await puter.ai.chat(messagesPayload, { model });

        let aiResponse = '';
        if (typeof response === 'string') {
            aiResponse = response;
        } else if (response?.message?.content) {
            aiResponse = response.message.content;
        } else if (response?.choices?.[0]?.message?.content) {
            aiResponse = response.choices[0].message.content;
        } else if (response?.text) {
            aiResponse = response.text;
        } else {
            aiResponse = JSON.stringify(response);
        }

        chat.messages.push({ role: 'assistant', content: aiResponse, searched, sources });
        saveChats();

    } catch (error) {
        chat.messages.push({ role: 'assistant', content: `Blad: ${error.message}` });
        saveChats();
    }

    renderMessages();
    renderChatHistory();
    elements.sendBtn.disabled = false;
    elements.userInput.focus();
}

elements.sendBtn.addEventListener('click', sendMessage);

elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

elements.userInput.addEventListener('input', () => {
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 200) + 'px';
});

elements.searchToggle.addEventListener('click', () => {
    searchEnabled = !searchEnabled;
    elements.searchToggle.classList.toggle('active', searchEnabled);
});

elements.newChat.addEventListener('click', createChat);

if (chats.length === 0) {
    createChat();
} else if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
    currentChatId = chats[0].id;
}

renderChatHistory();
renderMessages();
