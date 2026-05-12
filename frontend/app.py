"""
AI Sakhi — Streamlit Frontend
WhatsApp-educational hybrid UI with onboarding, chat, quiz, and study plan.
"""
import streamlit as st
import requests
import uuid
import json
from datetime import datetime

BACKEND = "http://localhost:8000"

# ── Page config ───────────────────────────────────────────
st.set_page_config(
    page_title="AI Sakhi 🌸 — Your Study Companion",
    page_icon="🌸",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS ───────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* { font-family: 'Inter', sans-serif; box-sizing: border-box; }

/* Hide Streamlit chrome */
#MainMenu, footer, header { visibility: hidden; }
.block-container { padding: 0 !important; }

/* App layout */
.stApp { background: #f0f2f5; }

/* Sidebar */
section[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1a3c2e 0%, #0f2318 100%);
    border-right: none;
}
section[data-testid="stSidebar"] * { color: #e8f5e9 !important; }
section[data-testid="stSidebar"] .stButton > button {
    background: rgba(37,211,102,0.2);
    border: 1px solid rgba(37,211,102,0.4);
    color: #e8f5e9 !important;
    border-radius: 12px;
    width: 100%;
    transition: all 0.2s;
}
section[data-testid="stSidebar"] .stButton > button:hover {
    background: rgba(37,211,102,0.4);
    transform: translateY(-1px);
}

/* Chat header */
.chat-header {
    background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 14px;
    border-radius: 0 0 16px 16px;
    margin-bottom: 8px;
    box-shadow: 0 4px 20px rgba(37,211,102,0.3);
}
.chat-header h2 { color: white; margin: 0; font-size: 1.2rem; font-weight: 600; }
.chat-header p  { color: rgba(255,255,255,0.85); margin: 0; font-size: 0.8rem; }
.avatar { font-size: 2.4rem; }

/* Chat messages */
.chat-area {
    padding: 12px 20px;
    min-height: 400px;
    max-height: 520px;
    overflow-y: auto;
}
.msg-row-user { display: flex; justify-content: flex-end; margin: 6px 0; }
.msg-row-ai   { display: flex; justify-content: flex-start; margin: 6px 0; }

.bubble-user {
    background: #dcf8c6;
    color: #111;
    padding: 10px 14px;
    border-radius: 18px 18px 4px 18px;
    max-width: 72%;
    font-size: 0.92rem;
    line-height: 1.5;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.bubble-ai {
    background: #ffffff;
    color: #111;
    padding: 10px 14px;
    border-radius: 18px 18px 18px 4px;
    max-width: 72%;
    font-size: 0.92rem;
    line-height: 1.5;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.msg-time { font-size: 0.68rem; color: #999; margin-top: 2px; text-align: right; }

/* Quiz card */
.quiz-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin: 10px 0;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    border-left: 4px solid #25D366;
}
.quiz-card h4 { color: #128C7E; margin-bottom: 12px; }

/* Plan card */
.plan-card {
    background: linear-gradient(135deg, #e8f5e9, #f1f8e9);
    border-radius: 16px;
    padding: 18px;
    margin: 8px 0;
    border-left: 4px solid #25D366;
}
.plan-section { margin: 10px 0; padding: 10px; background: white; border-radius: 10px; }
.plan-section h5 { color: #128C7E; margin: 0 0 6px 0; }

/* Streak badge */
.streak-badge {
    background: linear-gradient(135deg, #FF6B35, #FF8C00);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-weight: 700;
    font-size: 1.1rem;
    text-align: center;
    margin: 8px 0;
}

/* Input area */
.stTextInput > div > div > input {
    border-radius: 24px !important;
    border: 2px solid #e0e0e0 !important;
    padding: 12px 20px !important;
    font-size: 0.95rem !important;
    transition: border-color 0.2s;
}
.stTextInput > div > div > input:focus {
    border-color: #25D366 !important;
    box-shadow: 0 0 0 3px rgba(37,211,102,0.15) !important;
}

/* Send button */
.stButton > button {
    border-radius: 24px !important;
    background: linear-gradient(135deg, #25D366, #128C7E) !important;
    color: white !important;
    border: none !important;
    font-weight: 600 !important;
    transition: all 0.2s;
}
.stButton > button:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(37,211,102,0.4) !important; }

/* Simplify button */
.simplify-btn > button {
    background: linear-gradient(135deg, #667eea, #764ba2) !important;
    font-size: 0.8rem !important;
    padding: 4px 14px !important;
}

/* Onboarding */
.onboard-card {
    background: white;
    border-radius: 20px;
    padding: 32px;
    max-width: 520px;
    margin: 40px auto;
    box-shadow: 0 8px 40px rgba(0,0,0,0.12);
    border-top: 5px solid #25D366;
}
.onboard-card h2 { color: #128C7E; margin-bottom: 6px; }

/* Mode tabs */
.mode-tab { 
    display: inline-block; padding: 6px 16px; border-radius: 20px; 
    margin: 4px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
}
.mode-active { background: #25D366; color: white; }
.mode-inactive { background: #f0f0f0; color: #555; }

/* Score bar */
.score-bar { background: #e0e0e0; border-radius: 8px; height: 8px; margin: 6px 0; }
.score-fill { background: linear-gradient(90deg, #25D366, #128C7E); height: 8px; border-radius: 8px; transition: width 0.5s; }
</style>
""", unsafe_allow_html=True)


# ── Session state init ────────────────────────────────────
def init_state():
    defaults = {
        "onboarded": False,
        "user_id": None,
        "user_name": "",
        "user_class": "8",
        "user_language": "English",
        "user_subject": "Science",
        "session_id": str(uuid.uuid4()),
        "messages": [],           # [{"role": "user"|"ai", "text": str, "time": str}]
        "mode": "chat",           # chat | quiz | plan
        "quiz_data": None,
        "quiz_answers": {},
        "quiz_results": {},
        "quiz_submitted": False,
        "plan_data": None,
        "streak": 0,
        "last_ai_msg": "",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_state()


# ── Helpers ───────────────────────────────────────────────
def now_str():
    return datetime.now().strftime("%I:%M %p")

def api_post(path: str, payload: dict):
    try:
        r = requests.post(f"{BACKEND}{path}", json=payload, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def api_get(path: str):
    try:
        r = requests.get(f"{BACKEND}{path}", timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def add_message(role: str, text: str):
    st.session_state.messages.append({"role": role, "text": text, "time": now_str()})
    if role == "ai":
        st.session_state.last_ai_msg = text

def send_chat(user_text: str, simplify: bool = False):
    if not simplify:
        add_message("user", user_text)
    with st.spinner("Sakhi is thinking... 🌸"):
        result = api_post("/chat", {
            "session_id": st.session_state.session_id,
            "message": user_text,
            "class_": st.session_state.user_class,
            "simplify": simplify,
        })
    if "error" in result:
        add_message("ai", f"⚠️ Could not connect to backend. Make sure it's running on port 8000.")
    else:
        add_message("ai", result.get("response", ""))


# ── Onboarding screen ─────────────────────────────────────
def show_onboarding():
    st.markdown("""
    <div class="onboard-card">
        <div style="text-align:center;margin-bottom:20px">
            <span style="font-size:3.5rem">🌸</span>
            <h2>Welcome to AI Sakhi</h2>
            <p style="color:#666">Your personal study companion. Let's get started!</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    with st.form("onboard_form"):
        col1, col2 = st.columns(2)
        with col1:
            name = st.text_input("Your name", placeholder="e.g. Rani")
            class_ = st.selectbox("Your class", ["6", "7", "8", "9", "10", "11", "12"])
        with col2:
            language = st.selectbox("Preferred language", ["English", "Hinglish", "Hindi"])
            subject = st.selectbox("Weak subject (to focus on)", ["Science", "Maths", "Both"])

        submitted = st.form_submit_button("Start Learning! 🌸", use_container_width=True)

    if submitted and name.strip():
        result = api_post("/user/create", {
            "name": name.strip(),
            "class_": class_,
            "language": language,
            "weak_subject": subject,
        })
        if "user_id" in result:
            st.session_state.user_id = result["user_id"]
            st.session_state.user_name = name.strip()
            st.session_state.user_class = class_
            st.session_state.user_language = language
            st.session_state.user_subject = subject
            st.session_state.onboarded = True
            # Send greeting
            greeting = (
                f"Hi {name.strip()}! 🌸 I'm Sakhi, your study companion. "
                f"I'm so excited to learn with you today! "
                f"You're in Class {class_} — amazing! "
                f"What would you like to study? You can ask me a doubt, request a quiz, or get today's study plan!"
            )
            add_message("ai", greeting)
            st.rerun()
        else:
            st.error("Could not connect to backend. Please start the FastAPI server first.")
    elif submitted:
        st.warning("Please enter your name to continue.")


# ── Sidebar ───────────────────────────────────────────────
def show_sidebar():
    with st.sidebar:
        st.markdown(f"""
        <div style="text-align:center;padding:20px 0 10px">
            <span style="font-size:3rem">🌸</span>
            <h2 style="margin:8px 0 2px;color:#e8f5e9">AI Sakhi</h2>
            <p style="color:rgba(255,255,255,0.6);font-size:0.8rem">Your Study Companion</p>
        </div>
        """, unsafe_allow_html=True)

        st.divider()

        # Profile
        st.markdown(f"""
        <div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:12px">
            <p style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin:0">STUDYING AS</p>
            <h3 style="margin:4px 0;color:#e8f5e9">{st.session_state.user_name}</h3>
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:0.85rem">
                Class {st.session_state.user_class} &nbsp;·&nbsp; {st.session_state.user_subject}
            </p>
        </div>
        """, unsafe_allow_html=True)

        # Streak
        streak = st.session_state.streak
        st.markdown(f"""
        <div class="streak-badge">🔥 {streak} Day Streak</div>
        """, unsafe_allow_html=True)

        st.divider()

        # Mode selector
        st.markdown("<p style='font-size:0.75rem;color:rgba(255,255,255,0.5)'>LEARNING MODE</p>", unsafe_allow_html=True)
        if st.button("💬 Chat with Sakhi", use_container_width=True):
            st.session_state.mode = "chat"
            st.rerun()
        if st.button("📝 Take a Quiz", use_container_width=True):
            st.session_state.mode = "quiz"
            st.rerun()
        if st.button("📅 Today's Study Plan", use_container_width=True):
            st.session_state.mode = "plan"
            st.rerun()

        st.divider()

        # RAG status
        rag = api_get("/rag/stats")
        if rag.get("ready"):
            st.markdown(f"<p style='font-size:0.75rem;color:#4CAF50'>✅ NCERT RAG: {rag.get('chunk_count',0)} chunks ready</p>", unsafe_allow_html=True)
        else:
            st.markdown("<p style='font-size:0.75rem;color:#FF9800'>⚠️ RAG not loaded — run ingest.py</p>", unsafe_allow_html=True)

        st.divider()
        if st.button("🔄 New Session", use_container_width=True):
            for k in ["messages", "quiz_data", "quiz_answers", "quiz_results",
                      "quiz_submitted", "plan_data", "last_ai_msg"]:
                st.session_state[k] = [] if k == "messages" else None if "data" in k or k == "last_ai_msg" else {} if "answers" in k or "results" in k else False
            st.session_state.session_id = str(uuid.uuid4())
            st.rerun()


# ── Chat messages renderer ────────────────────────────────
def render_messages():
    for msg in st.session_state.messages:
        if msg["role"] == "user":
            st.markdown(f"""
            <div class="msg-row-user">
                <div>
                    <div class="bubble-user">{msg["text"]}</div>
                    <div class="msg-time">{msg["time"]}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="msg-row-ai">
                <span style="margin-right:8px;font-size:1.4rem">🌸</span>
                <div>
                    <div class="bubble-ai">{msg["text"]}</div>
                    <div class="msg-time">{msg["time"]}</div>
                </div>
            </div>
            """, unsafe_allow_html=True)


# ── Chat mode ─────────────────────────────────────────────
def show_chat():
    render_messages()
    st.markdown("<div style='height:12px'></div>", unsafe_allow_html=True)

    # Input row
    col1, col2 = st.columns([5, 1])
    with col1:
        user_input = st.text_input(
            "message_input", label_visibility="collapsed",
            placeholder="Ask Sakhi anything... 💬",
            key="chat_input"
        )
    with col2:
        send = st.button("Send ➤", use_container_width=True)

    if send and user_input.strip():
        send_chat(user_input.strip())
        st.rerun()

    # Explain Simpler button (only after AI has responded)
    if st.session_state.last_ai_msg:
        st.markdown("<div style='height:4px'></div>", unsafe_allow_html=True)
        col_a, col_b, col_c = st.columns([1, 2, 1])
        with col_b:
            if st.button("🔽 Explain Simpler", use_container_width=True, key="simplify_btn"):
                send_chat(st.session_state.last_ai_msg, simplify=True)
                st.rerun()


# ── Quiz mode ─────────────────────────────────────────────
def show_quiz():
    st.markdown("""
    <div class="chat-header" style="margin-bottom:16px">
        <span class="avatar">📝</span>
        <div>
            <h2>Quiz Time!</h2>
            <p>Test your knowledge with 5 questions</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.quiz_data is None:
        with st.form("quiz_setup"):
            topic = st.text_input("What topic do you want to be quizzed on?",
                                  placeholder="e.g. Photosynthesis, Fractions, Motion")
            start = st.form_submit_button("Generate Quiz 🎯", use_container_width=True)
        if start and topic.strip():
            with st.spinner("Generating your quiz... 🌸"):
                result = api_post("/quiz/generate", {
                    "topic": topic.strip(),
                    "class_": st.session_state.user_class,
                })
            if "questions" in result:
                st.session_state.quiz_data = result
                st.session_state.quiz_answers = {}
                st.session_state.quiz_results = {}
                st.session_state.quiz_submitted = False
                st.rerun()
            else:
                st.error(f"Could not generate quiz: {result.get('error', 'Unknown error')}")
        return

    quiz = st.session_state.quiz_data
    st.markdown(f"<h3 style='color:#128C7E'>📖 Topic: {quiz.get('topic','')}</h3>", unsafe_allow_html=True)

    for q in quiz.get("questions", []):
        qid = str(q["id"])
        st.markdown(f"""
        <div class="quiz-card">
            <h4>Q{q['id']}. {q['question']}</h4>
        </div>
        """, unsafe_allow_html=True)

        options = q.get("options", {})
        choice = st.radio(
            f"Select answer for Q{q['id']}",
            list(options.keys()),
            format_func=lambda k, opts=options: f"{k}. {opts[k]}",
            key=f"q_{qid}",
            label_visibility="collapsed",
        )
        st.session_state.quiz_answers[qid] = choice

        # Show hint expander
        with st.expander("💡 Need a hint?"):
            st.info(q.get("hint", "Think carefully!"))

        # Show result if submitted
        if st.session_state.quiz_submitted and qid in st.session_state.quiz_results:
            res = st.session_state.quiz_results[qid]
            if res["is_correct"]:
                st.success(res["feedback"])
            else:
                st.warning(res["feedback"])

        st.divider()

    if not st.session_state.quiz_submitted:
        if st.button("Submit Quiz ✅", use_container_width=True):
            score = 0
            for q in quiz["questions"]:
                qid = str(q["id"])
                ans = st.session_state.quiz_answers.get(qid, "A")
                res = api_post("/quiz/evaluate", {"question": q, "user_answer": ans})
                st.session_state.quiz_results[qid] = res
                if res.get("is_correct"):
                    score += 1
            st.session_state.quiz_submitted = True

            # Save progress
            if st.session_state.user_id:
                prog = api_post("/progress/update", {
                    "user_id": st.session_state.user_id,
                    "topic": quiz.get("topic", ""),
                    "score": score,
                    "total": 5,
                })
                st.session_state.streak = prog.get("streak", st.session_state.streak)

            st.rerun()
    else:
        # Show score summary
        score = sum(1 for r in st.session_state.quiz_results.values() if r.get("is_correct"))
        pct = int((score / 5) * 100)
        st.markdown(f"""
        <div style="background:white;border-radius:16px;padding:20px;text-align:center;margin:12px 0;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
            <h2 style="color:#128C7E">Your Score: {score}/5</h2>
            <div class="score-bar"><div class="score-fill" style="width:{pct}%"></div></div>
            <p style="color:#555;margin-top:8px">{pct}%</p>
        </div>
        """, unsafe_allow_html=True)

        # Encouragement via chat
        enc_result = api_post("/chat", {
            "session_id": st.session_state.session_id,
            "message": f"I scored {score} out of 5 on a quiz about {quiz.get('topic','')}. Please encourage me!",
            "class_": st.session_state.user_class,
            "simplify": False,
        })
        if "response" in enc_result:
            st.info(f"🌸 Sakhi says: {enc_result['response']}")

        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔄 Try Another Quiz", use_container_width=True):
                st.session_state.quiz_data = None
                st.rerun()
        with col2:
            if st.button("💬 Ask Sakhi a Doubt", use_container_width=True):
                st.session_state.mode = "chat"
                st.rerun()


# ── Study Plan mode ───────────────────────────────────────
def show_plan():
    st.markdown("""
    <div class="chat-header" style="margin-bottom:16px">
        <span class="avatar">📅</span>
        <div>
            <h2>Today's Study Plan</h2>
            <p>Your personalized 20-minute session</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.plan_data is None:
        with st.form("plan_setup"):
            col1, col2 = st.columns(2)
            with col1:
                topic = st.text_input("Topic", placeholder="e.g. Photosynthesis")
            with col2:
                subject = st.selectbox("Subject", ["Science", "Maths"])
            gen = st.form_submit_button("Generate My Plan 📅", use_container_width=True)
        if gen and topic.strip():
            with st.spinner("Creating your study plan... 🌸"):
                result = api_post("/study-plan", {
                    "topic": topic.strip(),
                    "subject": subject,
                    "class_": st.session_state.user_class,
                })
            if "sections" in result:
                st.session_state.plan_data = result
                st.rerun()
            else:
                st.error(f"Could not generate plan: {result.get('error','Unknown error')}")
        return

    plan = st.session_state.plan_data
    st.markdown(f"""
    <div class="plan-card">
        <h3 style="color:#128C7E;margin:0 0 6px">📖 {plan.get('topic','')} — {plan.get('subject','')} Class {plan.get('class_','')}</h3>
        <p style="color:#555;margin:0">🎯 <strong>Goal:</strong> {plan.get('goal','')}</p>
        <p style="color:#888;margin:4px 0 0;font-size:0.85rem">⏱ {plan.get('duration_minutes',20)} minutes</p>
    </div>
    """, unsafe_allow_html=True)

    for section in plan.get("sections", []):
        with st.expander(f"⏰ {section.get('time','')} — {section.get('title','')}", expanded=True):
            st.markdown(f"<div class='plan-section'>", unsafe_allow_html=True)
            if "content" in section:
                st.write(section["content"])
            if "example" in section:
                st.info(f"💡 Example: {section['example']}")
            if "questions" in section:
                st.markdown("**Practice Questions:**")
                for i, q in enumerate(section["questions"], 1):
                    st.markdown(f"{i}. {q}")
            if "key_points" in section:
                st.markdown("**Key Points to Remember:**")
                for pt in section["key_points"]:
                    st.markdown(f"✅ {pt}")
            st.markdown("</div>", unsafe_allow_html=True)

    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#25D366,#128C7E);border-radius:14px;padding:16px;margin-top:12px;text-align:center">
        <p style="color:white;margin:0;font-size:1rem">💪 {plan.get('motivation','You can do it!')}</p>
    </div>
    """, unsafe_allow_html=True)

    col1, col2 = st.columns(2)
    with col1:
        if st.button("🔄 New Plan", use_container_width=True):
            st.session_state.plan_data = None
            st.rerun()
    with col2:
        if st.button("📝 Quiz on This Topic", use_container_width=True):
            st.session_state.quiz_data = None
            st.session_state.mode = "quiz"
            st.rerun()


# ── Main layout ───────────────────────────────────────────
def main():
    if not st.session_state.onboarded:
        show_onboarding()
        return

    show_sidebar()

    # Chat header
    mode_label = {
        "chat": ("💬 Chat with Sakhi", "Ask any doubt — I'm here to help!"),
        "quiz": ("📝 Quiz Mode", "Let's test your knowledge!"),
        "plan": ("📅 Study Plan", "Your personalized 20-minute plan"),
    }
    title, subtitle = mode_label.get(st.session_state.mode, ("🌸 AI Sakhi", ""))

    st.markdown(f"""
    <div class="chat-header">
        <span class="avatar">🌸</span>
        <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
        </div>
    </div>
    """, unsafe_allow_html=True)

    if st.session_state.mode == "chat":
        show_chat()
    elif st.session_state.mode == "quiz":
        show_quiz()
    elif st.session_state.mode == "plan":
        show_plan()


main()
