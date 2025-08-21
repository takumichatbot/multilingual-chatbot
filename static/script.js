// script.js (イベント委任方式による最終修正版)

let currentLang = 'ja';
let translations = {};
let knowledgeBases = {};

// --- 関数定義 ---

// 言語データを読み込み、UIを更新するメイン関数
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

// UIの表示を更新する関数
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
            examplesContainer.appendChild(button);
        });
    }
}

// メッセージを送信する関数
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

// チャットにメッセージを追加する関数
function addMessageToChat(sender, message, isLoading = false, id = null) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    if (isLoading) {
        messageDiv.classList.add('loading-message');
        if (id) messageDiv.id = id;
    }
    const linkifiedMessage = message.replace(/(https?:\/\/[^\s<>"'()]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #667eea;">$1</a>');
    messageDiv.innerHTML = linkifiedMessage;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ローディングメッセージを削除する関数
function removeLoadingMessage(id) {
    const loadingMessageElement = document.getElementById(id);
    if (loadingMessageElement) loadingMessageElement.remove();
}

// Enterキーで送信する関数
function handleKeyPress(event) {
    if (event.key === 'Enter') sendMessage();
}

// --- イベントリスナー設定 ---

document.addEventListener('DOMContentLoaded', () => {
    
    // 言語スイッチャーのイベント委任
    const langSwitcher = document.querySelector('.language-switcher');
    if (langSwitcher) {
        langSwitcher.addEventListener('click', (event) => {
            // ===== ▼▼▼ ここを修正 ▼▼▼ =====
            // クリックされた要素、またはその親から `data-lang` 属性を持つ要素を探す
            const button = event.target.closest('[data-lang]');
            if (button) {
                const lang = button.getAttribute('data-lang');
                setLanguage(lang);
            }
            // ===== ▲▲▲ ここまで ▲▲▲ =====
        });
    }

    // 質問例ボタンのイベント委任
    const examplesContainer = document.getElementById('example-questions-container');
    if (examplesContainer) {
        examplesContainer.addEventListener('click', (event) => {
            if (event.target.classList.contains('example-btn')) {
                sendMessage(event.target.textContent);
            }
        });
    }

    // 送信ボタン
    const sendButton = document.getElementById('send-button');
    if(sendButton) {
        sendButton.addEventListener('click', () => sendMessage());
    }

    // 初期言語を設定
    setLanguage('ja');
});