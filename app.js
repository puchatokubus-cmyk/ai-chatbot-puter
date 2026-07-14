const elements = {
    messages: document.getElementById('messages'),
    userInput: document.getElementById('userInput'),
    sendBtn: document.getElementById('sendBtn'),
    newChat: document.getElementById('newChat'),
    chatHistory: document.getElementById('chatHistory'),
    chatTitle: document.getElementById('chatTitle'),
    modelSelect: document.getElementById('modelSelect'),
};

let chats = JSON.parse(localStorage.getItem('ai_chats') || '[]');
let currentChatId = localStorage.getItem('ai_current_chat');

function saveChats() {
    localStorage.setItem('ai_chats', JSON.stringify(chats));
    localStorage.setItem('ai_current_chat', currentChatId);
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
        elements.chatTitle.textContent = 'Nowy czat';
        return;
    }

    elements.chatTitle.textContent = chat.title;

    if (chat.messages.length === 0) {
        elements.messages.innerHTML = `
            <div class="welcome-msg">
                <h2>Witaj w AI Chat!</h2>
                <p>Wybierz model i napisz wiadomość.</p>
                <p class="welcome-hint">Darmowe API - GPT, Claude, Gemini i więcej</p>
            </div>
        `;
        return;
    }

    elements.messages.innerHTML = chat.messages.map(msg => `
        <div class="message ${msg.role}">
            <div class="message-role">${msg.role === 'user' ? 'Ty' : 'AI'}</div>
            <div class="message-content">${escapeHtml(msg.content)}</div>
        </div>
    `).join('');

    elements.messages.scrollTop = elements.messages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        <div class="message-role">AI</div>
        <div class="typing-indicator"><span></span><span></span><span></span></div>
    `;
    elements.messages.appendChild(typingEl);
    elements.messages.scrollTop = elements.messages.scrollHeight;

    try {
        const model = elements.modelSelect.value;
        const systemPrompt = "Jesteś pomocnym asystentem AI. Odpowiadaj po polsku, chyba że użytkownik pisze w innym języku. Bądź zwięzły i konkretny.";

        const messagesPayload = [
            { role: 'system', content: systemPrompt },
            ...chat.messages.map(m => ({ role: m.role, content: m.content }))
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

        chat.messages.push({ role: 'assistant', content: aiResponse });
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

elements.newChat.addEventListener('click', createChat);

if (chats.length === 0) {
    createChat();
} else if (!currentChatId || !chats.find(c => c.id === currentChatId)) {
    currentChatId = chats[0].id;
}

renderChatHistory();
renderMessages();
