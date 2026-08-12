"""Admin uploads study notes (any file); authenticated users download them.

Files are stored in MongoDB via GridFS (bucket name ``notes``), so no local
disk is needed and it works the same on local Mongo or Atlas.
"""

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from ..database import get_db
from ..models import NoteSummary, NoteUpdate
from ..security import get_current_user, require_admin

router = APIRouter(tags=["notes"])

FILES_COLLECTION = "notes.files"


def _bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(get_db(), bucket_name="notes")


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "y", "locked"}


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
        "is_locked": _as_bool(meta.get("is_locked", False)),
        "price_rupees": int(meta.get("price_rupees", 0) or 0),
    }


@router.post("/admin/notes")
async def upload_note(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    is_locked: bool = Form(False),
    price_rupees: int = Form(0),
    admin: dict = Depends(require_admin),
):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if price_rupees < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    bucket = _bucket()
    file_id = await bucket.upload_from_stream(
        file.filename or "note",
        content,
        metadata={
            "title": title,
            "description": description,
            "content_type": file.content_type or "application/octet-stream",
            "uploaded_by": str(admin["_id"]),
            "is_locked": bool(is_locked),
            "price_rupees": int(price_rupees or 0),
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

    meta = doc.get("metadata", {}) or {}
    is_locked = _as_bool(meta.get("is_locked", False))
    if is_locked and user.get("role") != "admin":
        from .payments import _access_status

        if not _access_status(user).active:
            raise HTTPException(
                status_code=402,
                detail="Note access is locked. Please purchase or activate test access to download this note.",
            )

    bucket = _bucket()
    stream = await bucket.open_download_stream(oid)
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


@router.patch("/admin/notes/{note_id}", response_model=NoteSummary)
async def update_note(note_id: str, payload: NoteUpdate, admin: dict = Depends(require_admin)):
    oid = _oid(note_id)
    db = get_db()
    doc = await db[FILES_COLLECTION].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Note not found")

    meta = doc.get("metadata", {}) or {}
    update_meta = {}
    if payload.title is not None:
        update_meta["title"] = payload.title
    if payload.description is not None:
        update_meta["description"] = payload.description
    if payload.is_locked is not None:
        update_meta["is_locked"] = payload.is_locked
    if payload.price_rupees is not None:
        update_meta["price_rupees"] = payload.price_rupees

    if update_meta:
        await db[FILES_COLLECTION].update_one({"_id": oid}, {"$set": {"metadata": {**meta, **update_meta}}})

    updated = await db[FILES_COLLECTION].find_one({"_id": oid})
    updated_meta = updated.get("metadata", {}) or {}
    return NoteSummary(
        id=str(updated["_id"]),
        title=updated_meta.get("title") or updated.get("filename", "Untitled"),
        description=updated_meta.get("description", ""),
        filename=updated.get("filename", "file"),
        size=updated.get("length", 0),
        content_type=updated_meta.get("content_type", "application/octet-stream"),
        uploaded_at=updated.get("uploadDate"),
        is_locked=_as_bool(updated_meta.get("is_locked", False)),
        price_rupees=int(updated_meta.get("price_rupees", 0) or 0),
    )


@router.delete("/admin/notes/{note_id}", status_code=204)
async def delete_note(note_id: str, admin: dict = Depends(require_admin)):
    oid = _oid(note_id)
    bucket = _bucket()
    try:
        await bucket.delete(oid)
    except Exception:
        raise HTTPException(status_code=404, detail="Note not found")
