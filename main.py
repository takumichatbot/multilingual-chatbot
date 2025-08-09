# main.py
from flask import Flask, render_template, request, jsonify
import os
from dotenv import load_dotenv
import google.generativeai as genai
from qa_data import QA_DATA

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY 環境変数が設定されていません。")
genai.configure(api_key=GOOGLE_API_KEY)

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


@app.route('/')
def index():
    # 質問例のテキストをHTMLテンプレートに渡す
    example_questions = QA_DATA.get('example_questions', [])
    return render_template('index.html', example_questions=example_questions)

@app.route('/ask', methods=['POST'])
def ask_chatbot():
    user_message = request.json.get('message')
    if not user_message:
        return jsonify({'answer': '質問が空です。'})

    bot_answer = get_gemini_answer(user_message)
    return jsonify({'answer': bot_answer})

if __name__ == '__main__':
    app.run(debug=True, port=5003)