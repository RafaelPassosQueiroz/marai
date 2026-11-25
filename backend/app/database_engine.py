"""Shared engine configuration for the app, migrations and remote transfer."""

import os
from pathlib import Path
import ssl

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def read_ca_certificate(certificate) -> str:
    """Resolve a configured CA with project-local recovery for moved installations."""
    configured = Path(os.path.expandvars(str(certificate))).expanduser()
    if not configured.is_absolute():
        configured = PROJECT_ROOT / configured
    candidates = (
        configured,
        PROJECT_ROOT / "ca.pem",
        PROJECT_ROOT / ".runtime" / "ca.pem",
        Path.home() / "marai-ca.pem",
    )
    for candidate in candidates:
        if candidate.is_file():
            # Python opens Unicode paths reliably; OpenSSL receives the PEM contents.
            return candidate.read_bytes().decode("utf-8-sig")
    raise FileNotFoundError(
        "Certificado CA do PostgreSQL não encontrado. "
        f"Salve o certificado baixado do Aiven em {PROJECT_ROOT / 'ca.pem'} "
        "ou corrija sslrootcert na configuração do banco."
    )


def create_verified_ssl_context(certificate=None):
    if certificate:
        return ssl.create_default_context(cadata=read_ca_certificate(certificate))
    return ssl.create_default_context()


def create_database_engine(database_url, **options):
    url = make_url(database_url)
    connect_args = dict(options.pop("connect_args", {}))
    if url.drivername == "postgresql+pg8000":
        query = dict(url.query)
        mode = query.pop("sslmode", "verify-full")
        certificate = query.pop("sslrootcert", None)
        timeout = int(query.pop("connect_timeout", "10"))
        if mode != "verify-full":
            raise ValueError("A conexão pg8000 exige verificação completa do certificado TLS.")
        context = create_verified_ssl_context(certificate)
        connect_args.update(ssl_context=context, timeout=timeout)
        url = url.set(query=query)
    elif url.drivername.startswith("postgresql"):
        connect_args.setdefault("connect_timeout", 5)
    options.setdefault("pool_pre_ping", True)
    options.setdefault("hide_parameters", True)
    return create_engine(url, connect_args=connect_args, **options)
