# main.py
from flask import Flask, render_template, request, jsonify, abort
import os
from dotenv import load_dotenv
import google.generativeai as genai
from qa_data import QA_DATA
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, TextSendMessage

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY 環境変数が設定されていません。")
genai.configure(api_key=GOOGLE_API_KEY)

# LINEの認証情報を.envから読み込む
LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
LINE_CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')

if not LINE_CHANNEL_ACCESS_TOKEN or not LINE_CHANNEL_SECRET:
    print("WARNING: LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET is not set. LINE integration will not work.")
    
line_bot_api = LineBotApi(LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(LINE_CHANNEL_SECRET)

app = Flask(__name__)

# QAデータをプロンプトに組み込むためのテキストを作成
qa_prompt_text = "\n\n".join([f"### {key}\n{value}" for key, value in QA_DATA['data'].items()])

def get_gemini_answer(question):
    print(f"質問: {question}")
    try:
        model = genai.GenerativeModel('models/gemini-1.5-flash')
        print("Geminiモデルを初期化しました")

        # QA_DATAをプロンプトに組み込む
        full_question = f"""
        あなたはLARUbotのカスタマーサポートAIです。
        以下の「ルール・規則」セクションに記載されている情報のみに基づいて、お客様からの質問に絵文字を使わずに丁寧に回答してください。
        **記載されていない質問には「申し訳ありませんが、その情報はこのQ&Aには含まれていません。」と答えてください。**
        お客様がスムーズに手続きを進められるよう、元気で丁寧な言葉遣いで案内してください。
        
        ---
        ## ルール・規則
        {qa_prompt_text}
        ---

        お客様の質問: {question}
        """

        print("Gemini APIにリクエストを送信します...")
        response = model.generate_content(full_question, request_options={'timeout': 30})
        print("Gemini APIから応答を受け取りました")

        if response and response.text:
            return response.text.strip()
        else:
            print("APIから応答がありませんでした。")
            return "申し訳ありませんが、その質問にはお答えできませんでした。別の質問をしてください。"

    except Exception as e:
        print(f"Gemini APIエラー: {type(e).__name__} - {e}")
        return "申し訳ありませんが、現在AIが応答できません。しばらくしてから再度お試しください。"

# ホームページ用のルーティング
@app.route('/')
def index():
    example_questions = QA_DATA.get('example_questions', [])
    return render_template('index.html', example_questions=example_questions)

# ウェブサイトのチャットボット用API
@app.route('/ask', methods=['POST'])
def ask_chatbot():
    user_message = request.json.get('message')
    if not user_message:
        return jsonify({'answer': '質問が空です。'})

    bot_answer = get_gemini_answer(user_message)
    return jsonify({'answer': bot_answer})

# ★★★ LINEからのメッセージを受け取るためのルーティング ★★★
@app.route("/callback", methods=['POST'])
def callback():
    # LINEサーバーからのリクエストヘッダーを取得
    signature = request.headers['X-Line-Signature']
    # リクエストボディを取得
    body = request.get_data(as_text=True)

    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        print("Invalid signature. Please check your channel access token/secret.")
        abort(400)

    return 'OK'

# メッセージイベントを処理するハンドラー
@handler.add(MessageEvent, message=TextMessage)
def handle_message(event):
    user_message = event.message.text
    # Geminiで応答を生成
    bot_response = get_gemini_answer(user_message)
    
    line_bot_api.reply_message(
        event.reply_token,
        TextSendMessage(text=bot_response)
    )

if __name__ == '__main__':
    app.run(debug=True, port=5003)