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
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await puter.net.fetch(searchUrl);
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const results = [];
        const resultElements = doc.querySelectorAll('.result');
        
        for (let i = 0; i < Math.min(resultElements.length, 5); i++) {
            const el = resultElements[i];
            const titleEl = el.querySelector('.result__title a, .result__a');
            const snippetEl = el.querySelector('.result__snippet');
            
            if (titleEl) {
                const title = titleEl.textContent.trim();
                const snippet = snippetEl ? snippetEl.textContent.trim() : '';
                results.push(`${title} - ${snippet}`);
            }
        }
        
        if (results.length > 0) {
            return results.join('\n\n');
        }
        
        const allText = doc.body.innerText.substring(0, 2000);
        return allText || 'Brak wynikow';
    } catch (error) {
        return `Blad: ${error.message}`;
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
            lowerText.includes('kto') ||
            lowerText.includes('jakie') ||
            lowerText.includes('jakie sa') ||
            lowerText.includes('co nowego');

        let searchContext = '';
        let searched = false;

        if (shouldSearch) {
            const searchQuery = text + ' trap muzyka 2025 2026';
            searchContext = await searchWeb(searchQuery);
            searched = true;
        }

        let systemPrompt = `Jestes TrapAi - ekspertem od trapowej muzyki, kultury i newsow. 

Twoje zadania:
- Odpowiadasz o trapowej muzyce (polskiej i swiatowej)
- Znasz najnowsze newsy, premiery, plotki ze swiata trapu
- Polecasz albumy, utwory, artystow
- Wyjasniasz historie i ewolucje trapu
- Odpowiadasz o kulturze hip-hopu i streetwearze
- Jezyk: polski (chyba ze uzytkownik pisze po angielsku)
- Styl: luzny, ale kompetentny - jak kumpel ktory zna sie na rzeczy`;

        if (searchContext) {
            systemPrompt += `\n\nMasz dostep do swiezych wynikow wyszukiwania z internecie. Uzyj ich aby odpowiedziec na pytanie uzytkownika. Podawaj aktualne informacje z 2025/2026 roku. Jesli wyniki wyszukiwania zawieraja relevantne informacje, odnies sie do nich.`;
        }

        let userMessage = text;
        if (searchContext) {
            userMessage = `${text}\n\n--- WYNIKI WYSZUKIWANIA W INTERNECIE ---\n${searchContext}\n--- KONIEC WYNIKOW ---`;
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
