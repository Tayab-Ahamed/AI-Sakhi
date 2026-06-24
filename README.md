# AI Sakhi

A multilingual AI tutoring platform for Indian students — Class 1 through 12. Built with Next.js, FastAPI, and Groq's LLaMA 3.

Students can chat with an AI tutor in their own language (English, Hindi, Hinglish, Kannada, Tamil), take adaptive quizzes, review flashcards using spaced repetition, and track their progress over time. Teachers get assignment tools and class analytics. Parents can monitor their child's streaks and performance. Admins manage the whole organization.

---

## What it does

**For students**
- Chat with Sakhi in any supported language — answers are grounded in NCERT textbooks via a local RAG pipeline
- Adaptive quizzes that get harder or easier based on how you're doing
- Spaced repetition flashcards (SM-2 algorithm) so you review at the right time
- Study notes, practice papers, and a focus timer
- XP system, streaks, and a leaderboard to stay motivated
- Topic mastery heatmap so you know exactly what to work on

**For teachers**
- Create and manage assignments per class and topic
- See which students submitted and what they scored
- Leave feedback notes with AI-suggested phrases
- Export progress reports

**For parents**
- View your child's streak, recent quiz scores, and weak subjects
- Get notified when performance drops

**For admins**
- Manage all users in your organization
- Change roles, deactivate accounts, generate org join codes

---

## Stack

| | |
|---|---|
| Frontend | Next.js 16 (App Router), Framer Motion, Vanilla CSS |
| Backend | FastAPI, Python 3.11, Uvicorn |
| Database | SQLite (zero-config, no server needed) |
| Vector Search | ChromaDB + sentence-transformers for NCERT RAG |
| LLM | Groq API — LLaMA 3.3 70B |
| Auth | HttpOnly JWT cookies |

---

## Running locally

You'll need Python 3.11+, Node.js 20+, and a free [Groq API key](https://console.groq.com).

### 1. Clone and configure

```bash
git clone https://github.com/Tayab-Ahamed/AI-Sakhi.git
cd AI-Sakhi
cp .env.example .env
```

Open `.env` and add your key:
```
GROQ_API_KEY=gsk_your_key_here
SAKHI_JWT_SECRET=pick-a-long-random-string
```

### 2. Start the backend

```bash
# From the project root
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

API will be at `http://localhost:8000` — Swagger docs at `http://localhost:8000/docs`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

---

## Loading textbook content (RAG)

Drop your NCERT PDFs into `rag_data/ncert/` and run:

```bash
python ingest.py
```

This chunks, embeds, and indexes them into ChromaDB. Once done, the chat sidebar shows **RAG Active** and answers will cite exact sources.

---

## Project structure

```
AI-Sakhi/
├── backend/
│   ├── main.py              # API routes
│   ├── db.py                # Database schema and queries
│   ├── auth.py              # JWT cookie auth
│   ├── chat.py              # Groq + RAG chat logic
│   ├── quiz.py              # Quiz generation and evaluation
│   ├── adaptive.py          # Difficulty adjustment engine
│   ├── spaced_repetition.py # SM-2 algorithm
│   ├── recommendations.py   # Weak topic detection
│   ├── study_notes.py       # Notes generator
│   ├── flashcards.py        # Flashcard generation
│   ├── study_plan.py        # Study plan builder
│   └── teacher_tools.py     # Assignment analytics
├── frontend/
│   └── src/
│       ├── app/             # Pages (chat, quiz, teacher, admin, etc.)
│       ├── components/      # Sidebar, XP bar, notifications, tour
│       └── lib/             # API client, user context, auth helpers
├── curriculum/              # CBSE curriculum topic maps
├── rag_data/                # Put your PDFs here
├── ingest.py                # RAG ingestion script
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── requirements.txt
```

---

## Docker

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

---

## User roles

When creating an account, pick a role:

| Role | Access |
|---|---|
| `student` | Chat, quiz, flashcards, study tools, leaderboard |
| `teacher` | All student features + assignment management + class analytics |
| `parent` | Child progress view, streak and score monitoring |
| `admin` | Organization management, user roles, join codes |

---

## License

MIT
