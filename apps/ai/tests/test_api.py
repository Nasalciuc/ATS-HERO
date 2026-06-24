"""API endpoint tests (FastAPI TestClient)."""
from .sample_data import STRONG_CV


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "model_loaded" in body


def test_score_endpoint(client):
    r = client.post("/score", json={"text": STRONG_CV})
    assert r.status_code == 200
    body = r.json()
    assert 0 <= body["overall_score"] <= 100
    assert len(body["signals"]) == 6
    assert "Go" in body["detected"]["skills"]
    assert "C#" in body["detected"]["skills"]


def test_score_rejects_empty(client):
    r = client.post("/score", json={"text": ""})
    assert r.status_code == 422  # pydantic min_length


def test_extract_endpoint_docx(client, sample_docx_bytes):
    files = {
        "file": (
            "cv.docx",
            sample_docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    r = client.post("/extract", files=files)
    assert r.status_code == 200
    body = r.json()
    assert body["format"] == "docx"
    assert body["page_count"] >= 1
    assert "Jane Developer" in body["text"]


def test_extract_endpoint_pdf(client, sample_pdf_bytes):
    files = {"file": ("cv.pdf", sample_pdf_bytes, "application/pdf")}
    r = client.post("/extract", files=files)
    assert r.status_code == 200
    assert r.json()["format"] == "pdf"


def test_extract_rejects_unsupported(client):
    files = {"file": ("cv.txt", b"hello world", "text/plain")}
    r = client.post("/extract", files=files)
    assert r.status_code == 415


def test_extract_rejects_empty(client):
    files = {"file": ("cv.docx", b"", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    r = client.post("/extract", files=files)
    assert r.status_code == 400
