"""Cloudflare entrypoints for the API and private password computation."""

from urllib.parse import urlsplit

# The SDK hooks this import to initialize the Rust hash-map seed in the snapshot.
# Authlib can otherwise load the Rust bindings through hashes before the hook runs.
import cryptography.exceptions  # noqa: F401
from js import Blob, Object, Request as FetchRequest
from pyodide.ffi import to_js
from starlette.formparsers import MultiPartParser
from workers import DurableObject, Request, Response, WorkerEntrypoint, asgi

from app.config import BODY_OVERHEAD_BYTES, settings
from app.main import app
from app.security import hasher, verify_password


MAX_REQUEST_BYTES = settings.max_audio_bytes + BODY_OVERHEAD_BYTES
# The Worker caps the body before ASGI buffers it. Keep multipart uploads in
# memory so Starlette does not dispatch temporary file I/O to native threads.
MultiPartParser.spool_max_size = MAX_REQUEST_BYTES


async def bounded_request(request):
    length = request.headers.get("content-length")
    if length:
        if not length.isdecimal() or int(length) > MAX_REQUEST_BYTES:
            return None
        return request
    if not request.body:
        return request

    # ASGI buffers the request before calling the app. Cap uploads without a
    # Content-Length in the edge stream before handing them to the adapter.
    chunks = []
    size = 0
    reader = request.body.getReader()
    try:
        while True:
            chunk = await reader.read()
            if chunk.done:
                break
            size += chunk.value.byteLength
            if size > MAX_REQUEST_BYTES:
                await reader.cancel()
                return None
            chunks.append(chunk.value)
    finally:
        reader.releaseLock()

    body = Blob.new(to_js(chunks))
    init = to_js({"body": body}, dict_converter=Object.fromEntries)
    return FetchRequest.new(request, init)


class PasswordKdf(DurableObject):
    # This binding is only called by the API. Passwords and hashes are never
    # written to Durable Object storage.
    async def hash(self, password: str) -> str:
        return hasher.hash(password)

    async def verify_password(self, encoded_hash: str, password: str) -> bool:
        return verify_password(encoded_hash, password)


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        if isinstance(request, Request):
            request = request.js_object
        request = await bounded_request(request)
        if request is None:
            return Response.json(
                {"detail": "Arquivo muito grande."},
                status=413,
                headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
            )

        # Use the effective Worker URL for origin checks and OAuth callbacks.
        host = urlsplit(request.url).netloc.encode("ascii")

        async def worker_app(scope, receive, send):
            if scope["type"] == "http":
                scope["headers"] = [
                    (name, value) for name, value in scope["headers"] if name != b"host"
                ] + [(b"host", host)]
            await app(scope, receive, send)

        return await asgi.fetch(worker_app, request, self.env, self.ctx)
