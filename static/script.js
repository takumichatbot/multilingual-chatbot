// script.js

// ===== ▼▼▼ 修正点：主要な関数をグローバルスコープに移動 ▼▼▼ =====
let currentLang = 'ja';
let translations = {};
let knowledgeBases = {};

async function setLanguage(lang) {
    if (lang === currentLang && translations[lang]) return;
    try {
        if (!translations[lang] || !knowledgeBases[lang]) {
            const [transRes, knowledgeRes] = await Promise.all([
                fetch(`/static/translations/${lang}.json`),
                fetch(`/static/knowledge/${lang}.json`)
            ]);
            translations[lang] = await transRes.json();
            knowledgeBases[lang] = await knowledgeRes.json();
        }
        updateUI(lang);
    } catch (error) {
        console.error('Failed to load language files:', error);
    }
}

function updateUI(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        if (translations[lang] && translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
    document.querySelectorAll('[data-i18n-key-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-key-placeholder');
        if (translations[lang] && translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });
    const examplesContainer = document.getElementById('example-questions-container');
    examplesContainer.innerHTML = '';
    if (knowledgeBases[lang] && knowledgeBases[lang].example_questions) {
        knowledgeBases[lang].example_questions.forEach(q => {
            const button = document.createElement('button');
            button.className = 'example-btn';
            button.textContent = q;
            button.onclick = () => sendMessage(q);
            examplesContainer.appendChild(button);
        });
    }
}
// ===== ▲▲▲ ここまで ▲▲▲ =====

document.addEventListener('DOMContentLoaded', () => {
    // ページ読み込み時にデフォルト言語(日本語)を設定
    setLanguage('ja');

    // 質問例ボタンにイベントリスナーを再設定（言語切り替え時に動的に生成されるため）
    // この処理は updateUI 内に移動しました
    
    const messagesContainer = document.getElementById('chatbot-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

async function sendMessage(message = null) {
    const userInput = document.getElementById('user-input');
    const userMessage = message || userInput.value.trim();
    if (userMessage === '') return;
    addMessageToChat('user', userMessage);
    userInput.value = '';
    const loadingMessageId = 'loading-' + new Date().getTime();
    addMessageToChat('bot', '...', true, loadingMessageId);
    try {
        const response = await fetch('/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMessage })
        });
        if (!response.ok) throw new Error(`サーバーエラー: ${response.status}`);
        const data = await response.json();
        removeLoadingMessage(loadingMessageId);
        addMessageToChat('bot', data.answer);
    } catch (error) {
        console.error('Fetchエラー:', error);
        removeLoadingMessage(loadingMessageId);
        const errorMsg = currentLang === 'en' 
            ? 'Sorry, a network connection issue occurred. Please try again later.'
            : '申し訳ありませんが、ネットワーク接続に問題が発生しました。しばらくしてから再度お試しください。';
        addMessageToChat('bot', errorMsg);
    }
}

function addMessageToChat(sender, message, isLoading = false, id = null) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    if (isLoading) {
        messageDiv.classList.add('loading-message');
        if (id) messageDiv.id = id;
    }
    const linkifiedMessage = message.replace(
        /(https?:\/\/[^\s<>"'()]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #667eea;">$1</a>'
    );
    messageDiv.innerHTML = linkifiedMessage; 
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeLoadingMessage(id) {
    const loadingMessageElement = document.getElementById(id);
    if (loadingMessageElement) {
        loadingMessageElement.remove();
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}