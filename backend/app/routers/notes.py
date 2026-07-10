"""Admin uploads study notes (any file); authenticated users download them.

Files are stored in MongoDB via GridFS (bucket name ``notes``), so no local
disk is needed and it works the same on local Mongo or Atlas.
"""

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from ..database import get_db
from ..security import get_current_user, require_admin

router = APIRouter(tags=["notes"])

FILES_COLLECTION = "notes.files"


def _bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(get_db(), bucket_name="notes")


def _serialize(doc: dict) -> dict:
    meta = doc.get("metadata", {}) or {}
    return {
        "id": str(doc["_id"]),
        "title": meta.get("title") or doc.get("filename", "Untitled"),
        "description": meta.get("description", ""),
        "filename": doc.get("filename", "file"),
        "size": doc.get("length", 0),
        "content_type": meta.get("content_type", "application/octet-stream"),
        "uploaded_at": doc.get("uploadDate"),
    }


@router.post("/admin/notes")
async def upload_note(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    admin: dict = Depends(require_admin),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    bucket = _bucket()
    file_id = await bucket.upload_from_stream(
        file.filename or "note",
        content,
        metadata={
            "title": title,
            "description": description,
            "content_type": file.content_type or "application/octet-stream",
            "uploaded_by": str(admin["_id"]),
        },
    )
    doc = await get_db()[FILES_COLLECTION].find_one({"_id": file_id})
    return _serialize(doc)


@router.get("/notes")
async def list_notes(user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db[FILES_COLLECTION].find().sort("uploadDate", -1)
    return [_serialize(doc) async for doc in cursor]


def _oid(note_id: str) -> ObjectId:
    try:
        return ObjectId(note_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")


@router.get("/notes/{note_id}/download")
async def download_note(note_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    oid = _oid(note_id)
    doc = await db[FILES_COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")

    bucket = _bucket()
    stream = await bucket.open_download_stream(oid)
    meta = doc.get("metadata", {}) or {}
    filename = doc.get("filename", "note")

    async def chunks():
        while True:
            data = await stream.readchunk()
            if not data:
                break
            yield data

    return StreamingResponse(
        chunks(),
        media_type=meta.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/admin/notes/{note_id}", status_code=204)
async def delete_note(note_id: str, admin: dict = Depends(require_admin)):
    oid = _oid(note_id)
    bucket = _bucket()
    try:
        await bucket.delete(oid)
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")
