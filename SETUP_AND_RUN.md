# Setup and Run Guide

This guide runs AI Sakhi locally with the FastAPI backend and the single Next.js frontend in `frontend/`.

## 1. Open Project Folder

```powershell
cd C:\Projects\AI Sakhi
```

## 2. Create Python Environment

Run once:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

## 3. Add Groq API Key

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

## 4. Start Backend

Open Terminal 1:

```powershell
cd C:\Projects\AI Sakhi
venv\Scripts\activate
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend health check:

```text
http://127.0.0.1:8000/health
```

## 5. Start Frontend

Open Terminal 2:

```powershell
cd C:\Projects\AI Sakhi\frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## 6. Demo Flow

1. Onboard as a Class 8 student.
2. Ask: `Explain photosynthesis simply`.
3. Use the simplify action in chat.
4. Upload a short notes file or image in chat.
5. Generate a quiz and submit it.
6. Generate a study plan from the dashboard or study-plan page.
7. Start the focus timer.
8. Click `Load Demo Data` in the sidebar.
9. Open Dashboard and Leaderboard to show reports and rankings.

## 7. Optional NCERT RAG

Add NCERT PDFs to:

```text
rag_data\ncert\
```

Then run:

```powershell
python ingest.py
```

The frontend sidebar will show whether RAG is ready.

## 8. Run Tests

```powershell
python -m unittest discover tests -v
```
