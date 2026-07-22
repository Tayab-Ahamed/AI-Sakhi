#!/usr/bin/env python3
"""Index textbook PDFs with page-level source metadata."""
from __future__ import annotations
import os,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
CHROMA_PATH=os.getenv('CHROMA_PATH','./chroma_db'); PDF_DIR=Path(os.getenv('RAG_PDF_DIR','./rag_data/ncert')); CHUNK_WORDS=420; OVERLAP=50

def chunks(text:str):
    words=text.split(); step=CHUNK_WORDS-OVERLAP
    return [' '.join(words[i:i+CHUNK_WORDS]) for i in range(0,len(words),step) if len(words[i:i+CHUNK_WORDS])>=40]

def metadata_from_name(path:Path)->dict:
    # Recommended: CBSE_Class8_Science_Chapter5_Title.pdf
    stem=path.stem.replace('-','_'); parts=[p for p in stem.split('_') if p]
    data={'source':path.name,'board':'NCERT'}
    for part in parts:
        low=part.lower()
        if low in {'cbse','ncert','icse'}: data['board']=part.upper()
        elif re.fullmatch(r'class\d{1,2}',low): data['class_level']=re.sub(r'\D','',part)
        elif low.startswith('chapter'): data['chapter']=part
        elif low in {'science','maths','mathematics','english','hindi','socialscience','physics','chemistry','biology'}: data['subject']=part
    return data

def ingest():
    import chromadb,pypdf
    from chromadb.utils import embedding_functions
    PDF_DIR.mkdir(parents=True,exist_ok=True); files=sorted(PDF_DIR.glob('*.pdf'))
    if not files: raise SystemExit(f'No PDFs found in {PDF_DIR}')
    client=chromadb.PersistentClient(path=CHROMA_PATH); ef=embedding_functions.SentenceTransformerEmbeddingFunction(model_name='all-MiniLM-L6-v2')
    try: client.delete_collection('ncert_chunks')
    except Exception: pass
    col=client.create_collection('ncert_chunks',embedding_function=ef,metadata={'hnsw:space':'cosine'}); docs=[]; ids=[]; metas=[]
    for pdf in files:
        base=metadata_from_name(pdf); reader=pypdf.PdfReader(str(pdf))
        for page_no,page in enumerate(reader.pages,1):
            text=page.extract_text() or ''
            for index,chunk in enumerate(chunks(text)):
                docs.append(chunk); ids.append(f'{pdf.stem}-p{page_no}-c{index}'); metas.append({**base,'page_number':page_no,'chunk_index':index})
    if not docs: raise SystemExit('No usable text extracted')
    for start in range(0,len(docs),100): col.add(documents=docs[start:start+100],ids=ids[start:start+100],metadatas=metas[start:start+100])
    print(f'Indexed {len(docs)} page-attributed chunks from {len(files)} PDFs')
if __name__=='__main__':
    from dotenv import load_dotenv; load_dotenv(); ingest()
