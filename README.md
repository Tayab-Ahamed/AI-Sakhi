<<<<<<< Updated upstream
# 🌸 AI Sakhi

> **The Multilingual, Distraction-Free Study Companion for Indian Students.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Groq](https://img.shields.io/badge/AI-Groq%20Llama%203-f97316?style=flat)](https://groq.com/)
[![Hackathon](https://img.shields.io/badge/Status-Hackathon_Ready-22c55e?style=flat)](#)

AI Sakhi is a SaaS-grade educational platform designed to provide a supportive, inclusive, and highly effective learning environment. It replaces generic AI chats with an emotionally intelligent, curriculum-aligned tutor that supports voice input, PDF analysis, gamified quizzes, and distraction-free study timers.

---

## ✨ Key Features

*   **🎙️ Voice & Multilingual Chat:** Speak your doubts naturally! AI Sakhi understands and explains complex topics in English, Hinglish, Hindi, Kannada, and Tamil. Includes a multi-level "Explain Simpler" feature.
*   **📄 PDF Memory Destruct Mode:** Upload PDFs, images, or notes. Sakhi instantly summarizes the document and generates practice questions based *only* on the provided material.
*   **🎯 Adaptive Quizzes:** Generate 5-question quizzes on any topic with Easy, Medium, or Hard difficulties. Get immediate feedback, earn XP, and celebrate perfect scores with confetti animations!
*   **⏱️ Focus Timer & Study Plans:** Automatically generate bite-sized study plans and transition seamlessly into a built-in Pomodoro focus timer with browser notifications.
*   **🏆 Gamification & Analytics:** Keep students engaged with dynamic achievement badges, animated daily streaks, and an interactive heatmap. Compete locally on the School Leaderboard!
*   **📊 Parent/Teacher Insights:** Advanced dashboard allowing educators to export PDF/PNG report cards and identify "Weak Topics" across the student base.

## 🛠️ Tech Stack

**Frontend:**
*   Next.js 16 (App Router)
*   React 18 + TypeScript
*   Tailwind CSS + Framer Motion (Animations)
*   Lucide React (Icons)
*   Web Speech API (Native Voice Recognition)

**Backend:**
*   Python 3.10+ & FastAPI
*   Groq API (Llama 3 70B for ultra-fast, intelligent responses)
*   LLaVa Vision Model (For image/diagram analysis)
*   SQLite (Local persistence)

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   Python 3.10+
*   A [Groq API Key](https://console.groq.com/)

### 1. Backend Setup
=======
# AI Sakhi — Multilingual AI Learning Platform

> Patient explanations. Everyday progress. A personalised AI education companion for every student.

AI Sakhi is a full-stack, production-grade educational platform that combines a multilingual AI tutor, adaptive quizzes, spaced-repetition flashcards, teacher tools, and offline-capable PWA support — all in a single, cohesive application built for the diverse needs of learners across India.

---

## ✨ Features

### 🤖 AI Tutor (Chat)
- Conversational learning powered by **Groq LLaMA 3** — fast, accurate, NCERT-aligned
- Supports **English, Hinglish, Hindi, Kannada, Tamil** with seamless language switching
- Simplify, translate, and explain-differently flows
- Optional **RAG mode**: grounded answers from uploaded NCERT PDFs via ChromaDB

### 📝 Adaptive Quiz Engine
- 5-question MCQs with hints, explanations, and per-question feedback
- **SM-2 adaptive difficulty**: auto-recommends Easy / Medium / Hard based on rolling quiz history
- Offline quiz caching — students can attempt cached quizzes without internet
- Confetti & encouragement on perfect scores

### 🃏 Spaced Repetition Flashcards
- Full **SuperMemo SM-2 algorithm**: dynamic intervals based on student self-rating (Forgot / Hard / Okay / Easy)
- Due-today queue surfaces cards at optimal review intervals
- Per-card easiness factor tracking

### 📊 Student Dashboard
- Streak counter, XP, total quizzes, avg score
- Weak-topic identification and curriculum-aligned recommendations
- Pending assignments banner (from teacher-set tasks)

### 📚 AI Study Notes
- One-click generation of structured markdown notes for any curriculum topic
- Covers: key concepts, explanation, facts/formulas, examples, review questions
- Save locally and download as `.md`

### 📄 PDF Progress Reports
- Client-side PDF generation using **jsPDF** — no server required
- Includes stats, color-coded quiz history table, completed assignments
- Shareable with parents or teachers

### 🏆 Leaderboard & Gamification
- Organisation-level leaderboard ranked by XP
- Daily streaks, achievement badges, XP on quiz completion

### ⏱️ Focus Timer
- Pomodoro-style 25/5/15 minute timer tied to study sessions
- Session history tracking

### 🎓 Teacher Tools
- Create curriculum-aligned assignments with due dates and instructions
- Real-time submission tracking with per-student score breakdown
- Student progress report export

### 👨‍👩‍👧 Parent Dashboard
- Monitor child's streak, avg score, quiz history, and completed assignments
- Low-score alert when student needs more support

### 🛡️ Admin Console
- Organisation-wide user management
- Inline role changing (student / teacher / parent / admin)
- User count breakdown by role

### ♿ Accessibility Suite
- **Dyslexia Mode**: OpenDyslexic font, cream background, wide letter/word spacing
- **Reduce Motion**: disables all CSS transitions and animations
- **Font Scaling**: Small / Medium / Large base size toggle

### 📲 Offline Mode & PWA
- Installable as a native app on Android / iOS / Desktop
- Service Worker with Cache-First static assets and Network-First API caching
- IndexedDB queue for progress writes when offline — synced automatically on reconnect
- Branded offline fallback page

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React, Framer Motion, Tailwind-free Vanilla CSS |
| **Backend** | FastAPI, Python 3.11, SQLite, Uvicorn |
| **AI / LLM** | Groq API (LLaMA 3.3 70B) |
| **RAG** | ChromaDB, `sentence-transformers`, `pypdf` |
| **PDF** | jsPDF (client-side) |
| **Tests** | pytest (SM-2, adaptive difficulty, recommendation engine) |
| **DevOps** | Docker, Docker Compose |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 20+
- A free [Groq API key](https://console.groq.com)

### 1. Clone the repository
```bash
git clone https://github.com/Tayab-Ahamed/AI-Sakhi.git
cd AI-Sakhi
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 3. Backend
>>>>>>> Stashed changes
```bash
cd backend
python -m venv venv
<<<<<<< Updated upstream
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Create a .env file and add your API key:
# GROQ_API_KEY=your_groq_api_key_here

uvicorn main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend-next
=======
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Frontend
```bash
cd frontend
>>>>>>> Stashed changes
npm install
npm run dev
```

<<<<<<< Updated upstream
Navigate to `http://localhost:3000` to start learning! 

## 🎨 Demo & Repository

**Repository:** [GitHub - Tayab-Ahamed/AI-Sakhi](https://github.com/Tayab-Ahamed/AI-Sakhi.git)
*(Include links to your YouTube prototype video or screenshots here)*

## 🤝 Built For
Designed with ❤️ for students, aiming to make quality education accessible, engaging, and less intimidating.
=======
Open [http://localhost:3000](http://localhost:3000).

---

## 🐳 Docker Deployment

```bash
cp .env.example .env   # fill in GROQ_API_KEY
docker compose up --build
```

- Backend available at `http://localhost:8000`
- Frontend available at `http://localhost:3000`

SQLite data is persisted to the `./data/` volume.

---

## 🗂 Project Structure

```
AI-Sakhi/
├── backend/
│   ├── main.py                 # FastAPI app + all endpoints
│   ├── db.py                   # SQLite schema & helpers
│   ├── chat.py                 # Groq LLM integration
│   ├── adaptive.py             # Adaptive difficulty engine
│   ├── spaced_repetition.py    # SM-2 algorithm (pure logic)
│   ├── recommendations.py      # Curriculum recommendation engine
│   ├── teacher_tools.py        # Assignment & submission logic
│   ├── study_notes.py          # AI study notes generator
│   └── tests/                  # pytest unit tests
├── frontend/
│   └── src/
│       ├── app/                # Next.js App Router pages
│       │   ├── chat/           # AI Tutor chat
│       │   ├── quiz/           # Adaptive quiz
│       │   ├── flashcards/     # Spaced repetition
│       │   ├── dashboard/      # Student dashboard
│       │   ├── study-notes/    # AI note generation
│       │   ├── export/         # PDF report export
│       │   ├── teacher/        # Teacher tools
│       │   ├── parent/         # Parent dashboard
│       │   └── admin/          # Admin console
│       ├── components/         # Reusable UI components
│       └── lib/                # API client, hooks, contexts
├── curriculum/                 # NCERT curriculum JSON
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── .env.example
```

---

## 🧪 Running Tests

```bash
python -m pytest backend/tests/ -v
```

21 tests covering:
- SM-2 spaced repetition algorithm (10 tests)
- Adaptive difficulty thresholds (5 tests)
- Recommendation engine ranking logic (4 tests)
- Helper utilities (2 tests)

---

## 🔧 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key — get one free at [console.groq.com](https://console.groq.com) |
| `DB_PATH` | Optional | Path to SQLite DB (default: `./backend/sakhi.db`) |
| `GROQ_MODEL` | Optional | Model name (default: `llama3-8b-8192`) |
| `NEXT_PUBLIC_API_URL` | Optional | Backend URL for Docker deploys (default: `http://localhost:8000`) |

---

## 📖 Optional: NCERT RAG Index

For grounded, textbook-cited answers:

1. Place NCERT PDFs in `rag_data/ncert/`
2. Run the ingestion pipeline:
   ```bash
   python ingest.py
   ```
3. The frontend sidebar will show "RAG active" and all chat responses will cite source pages.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ for students across India</p>
</div>
>>>>>>> Stashed changes
