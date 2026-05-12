#!/usr/bin/env python3
"""
NCERT PDF Ingestion Script — AI Sakhi
======================================
Run this ONCE before starting the app.

Usage:
    python ingest.py

Place NCERT PDF files in:  rag_data/ncert/

Download from: https://ncert.nic.in/textbook.php
Recommended scope:
  - Class 8  Science  (ch1: Crop Production, ch2: Microorganisms, ch7: Conservation, ch9: Reproduction)
  - Class 9  Science  (ch5: Natural Resources, ch6: Atoms & Molecules, ch8: Motion)
  - Class 10 Science  (ch6: Life Processes, ch7: Control & Coordination)
  - Class 8  Maths    (ch1: Rational Numbers, ch2: Linear Equations)
  - Class 9  Maths    (ch1: Number Systems, ch4: Linear Equations, ch5: Intro to Euclid's Geometry)
  - Class 10 Maths    (ch2: Polynomials, ch3: Pair of Linear Equations, ch4: Quadratic Equations)
"""

import os
import sys
from pathlib import Path

# Add project root to path so backend.config works
sys.path.insert(0, str(Path(__file__).parent))

CHROMA_PATH = os.getenv("CHROMA_PATH", "./chroma_db")
PDF_DIR = "./rag_data/ncert"
CHUNK_SIZE = 450   # words per chunk
CHUNK_OVERLAP = 50  # word overlap between chunks

# Keywords that signal educational content worth keeping
EDUCATION_KEYWORDS = [
    "photosynthesis", "cell", "force", "motion", "light", "electricity",
    "atom", "molecule", "plant", "animal", "microorganism", "reproduction",
    "fraction", "equation", "algebra", "geometry", "polynomial",
    "triangle", "quadrilateral", "circle", "statistics", "probability",
    "chapter", "exercise", "example", "solution", "concept", "definition",
    "experiment", "activity", "figure", "table", "formula", "theorem",
    "reaction", "chemical", "physical", "element", "compound", "mixture",
    "energy", "work", "power", "speed", "velocity", "acceleration",
    "number", "integer", "rational", "real", "function", "graph",
]


def chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i: i + CHUNK_SIZE])
        chunks.append(chunk)
        i += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def is_educational(text: str) -> bool:
    """Filter out page numbers, TOC lines, headers — keep substantive content."""
    tl = text.lower()
    # Must contain at least one keyword
    if not any(kw in tl for kw in EDUCATION_KEYWORDS):
        return False
    words = text.split()
    # Too short
    if len(words) < 30:
        return False
    # Mostly numeric (page indices etc.)
    non_num = [w for w in words if not w.replace(".", "").replace(",", "").isdigit()]
    if len(non_num) / max(len(words), 1) < 0.7:
        return False
    return True


def ingest_pdfs():
    # ── Dependency check ──────────────────────────────────
    try:
        import chromadb
        from chromadb.utils import embedding_functions
        import pypdf
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Run: pip install chromadb sentence-transformers pypdf")
        sys.exit(1)

    pdf_dir = Path(PDF_DIR)
    if not pdf_dir.exists():
        pdf_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Created {PDF_DIR}/")
        print("👉 Add NCERT PDF files there, then run this script again.")
        print("   Download from: https://ncert.nic.in/textbook.php")
        return

    pdf_files = list(pdf_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"❌ No PDF files found in {PDF_DIR}")
        print("   Add NCERT PDFs and run again.")
        return

    print(f"📚 Found {len(pdf_files)} PDF file(s). Starting ingestion...\n")

    # ── ChromaDB setup ────────────────────────────────────
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    # Fresh collection
    try:
        client.delete_collection("ncert_chunks")
        print("🗑️  Cleared existing collection.\n")
    except Exception:
        pass

    collection = client.create_collection(
        name="ncert_chunks",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    all_docs, all_ids, all_meta = [], [], []

    for pdf_path in pdf_files:
        print(f"📄 Processing: {pdf_path.name}")
        try:
            reader = pypdf.PdfReader(str(pdf_path))
            full_text = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    full_text += t + "\n"

            chunks = chunk_text(full_text)
            good = [c for c in chunks if is_educational(c)]
            print(f"   ✅ {len(good)} relevant chunks (from {len(chunks)} total)")

            for i, chunk in enumerate(good):
                doc_id = f"{pdf_path.stem}_{i}"
                all_docs.append(chunk)
                all_ids.append(doc_id)
                all_meta.append({"source": pdf_path.name, "chunk_index": i})

        except Exception as e:
            print(f"   ❌ Error: {e}")

    if not all_docs:
        print("\n⚠️  No usable content extracted. Check your PDF files.")
        return

    # ── Batch insert ──────────────────────────────────────
    BATCH = 100
    for i in range(0, len(all_docs), BATCH):
        collection.add(
            documents=all_docs[i: i + BATCH],
            ids=all_ids[i: i + BATCH],
            metadatas=all_meta[i: i + BATCH],
        )
        print(f"   Indexed batch {i // BATCH + 1} / {-(-len(all_docs) // BATCH)}")

    print(f"\n🎉 Done! {len(all_docs)} chunks indexed in ChromaDB at: {CHROMA_PATH}")
    print("✅ AI Sakhi RAG is ready to use!")


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    ingest_pdfs()
