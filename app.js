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
                <h2>TrapAi 🔥</h2>
                <p>Twój asystent do trapowych newsów, muzyki i kultury</p>
                <p class="welcome-hint">Zapytaj o najnowsze premiery, artystów, newsy</p>
                <div class="quick-commands">
                    <button class="quick-cmd" onclick="quickAsk('Co słychać w trapie?')">Newsy trapowe</button>
                    <button class="quick-cmd" onclick="quickAsk('Polecisz dobre trap albumy?')">Albumy</button>
                    <button class="quick-cmd" onclick="quickAsk('Kto jest hot w trapie?')">Hot artyści</button>
                    <button class="quick-cmd" onclick="quickAsk('Co to jest trap?')">Czym jest trap?</button>
                </div>
            </div>
        `;
        return;
    }

    elements.messages.innerHTML = chat.messages.map(msg => {
        const searchBadge = msg.searched ? '<span class="search-badge">Wyszukiwanie</span>' : '';
        return `
            <div class="message ${msg.role}">
                <div class="message-role">${msg.role === 'user' ? 'Ty' : 'TrapAi'}${searchBadge}</div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
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

async function searchWeb(query) {
    try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await puter.net.fetch(searchUrl);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        doc.querySelectorAll('div.g, div[data-sokoban-container]').forEach((el, i) => {
            if (i >= 5) return;
            const title = el.querySelector('h3')?.textContent || '';
            const snippet = el.querySelector('div[data-sncf], div.VwiC3b, span.aCOpRe')?.textContent || '';
            const link = el.querySelector('a')?.href || '';
            if (title) {
                results.push({ title, snippet, link });
            }
        });
        
        if (results.length > 0) {
            return results.map(r => `${r.title}\n${r.snippet}\n${r.link}`).join('\n\n');
        }
        return 'Nie znaleziono wyników wyszukiwania.';
    } catch (error) {
        return `Błąd wyszukiwania: ${error.message}`;
    }
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
        const systemPrompt = `Jesteś TrapAi - ekspertem od trapowej muzyki, kultury i newsów. 

Twoje zadania:
- Odpowiadasz o trapowej muzyce (polskiej i światowej)
- Znasz najnowsze newsy, premiery, plotki ze świata trapu
- Polecasz albumy, utwory, artystów
- Wyjaśniasz historię i ewolucję trapu
- Odpowiadasz o kulturze hip-hopu i streetwearze
- Język: polski (chyba że użytkownik pisze po angielsku)
- Styl: luźny, ale kompetentny - jak kumpel który zna się na rzeczy
- Emoji: używaj trapowych emoji 🔥🎤🎧💀`;

        let searchResults = '';
        let searched = false;

        if (searchEnabled || text.toLowerCase().includes('szukaj') || text.toLowerCase().includes('sprawdź') || text.toLowerCase().includes('newsy') || text.toLowerCase().includes('najnowsze')) {
            searchResults = await searchWeb(text + ' trap muzyka 2025 2026');
            searched = true;
        }

        let userMessage = text;
        if (searchResults && searchResults !== 'Nie znaleziono wyników wyszukiwania.') {
            userMessage = `${text}\n\n[Wyniki wyszukiwania w internecie]:\n${searchResults}`;
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

        chat.messages.push({ role: 'assistant', content: aiResponse, searched });
        saveChats();

    } catch (error) {
        chat.messages.push({ role: 'assistant', content: `Błąd: ${error.message}` });
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
