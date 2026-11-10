"""Migrate Marai to the selected Aiven service, asking only for its password."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
from hashlib import sha256
import json
import os
from pathlib import Path
import socket
import ssl
import struct
import subprocess
import sys
from urllib.parse import quote

from dotenv import set_key
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import URL, make_url

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import settings  # noqa: E402
from app.database_engine import create_database_engine, create_verified_ssl_context  # noqa: E402
from app.models import Base  # noqa: E402

DEFAULT_HOST = "pg-21fba3e9-germinareteste.b.aivencloud.com"
TABLES = list(Base.metadata.sorted_tables)


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=23560)
    parser.add_argument("--database", default="marai")
    parser.add_argument("--username", default="avnadmin")
    parser.add_argument("--ca", type=Path, help="Optional CA certificate location")
    parser.add_argument("--app-port", type=int, default=8001)
    parser.add_argument("--check", action="store_true", help="Check source and TLS without migrating")
    return parser.parse_args()


def prepare_certificate(explicit_path: Path | None = None) -> Path:
    candidates = [explicit_path] if explicit_path else [
        ROOT / "ca.pem",
        Path.home() / "marai-ca.pem",
        ROOT / ".runtime" / "ca.pem",
    ]
    original = next((path for path in candidates if path.is_file()), None)
    if original is None:
        raise RuntimeError("Salve o certificado CA baixado do Aiven como ca.pem na pasta do Marai.")

    certificate = original.read_bytes()
    # Validate and keep a project-local certificate, independent of a user profile path.
    ssl.create_default_context().load_verify_locations(cadata=certificate.decode("utf-8-sig"))
    original = original.resolve()
    if original.is_relative_to(ROOT):
        return original
    directory = ROOT / ".runtime" / "certificates"
    directory.mkdir(parents=True, exist_ok=True)
    prepared = directory / f"aiven-{sha256(certificate).hexdigest()[:16]}.pem"
    if not prepared.exists() or prepared.read_bytes() != certificate:
        prepared.write_bytes(certificate)
    return prepared


def check_tls(host: str, port: int, certificate: Path) -> None:
    context = create_verified_ssl_context(certificate)
    with socket.create_connection((host, port), timeout=10) as connection:
        # PostgreSQL negotiates TLS with SSLRequest before the normal login packet.
        connection.sendall(struct.pack("!II", 8, 80877103))
        if connection.recv(1) != b"S":
            raise RuntimeError("O servidor não aceitou a conexão TLS.")
        with context.wrap_socket(connection, server_hostname=host):
            pass


def canonical_value(value):
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="microseconds")
    raise TypeError(f"Tipo de dado inesperado: {type(value).__name__}")


def fingerprint(connection, table) -> dict:
    digest = sha256()
    count = 0
    query = select(table).order_by(*table.primary_key.columns)
    with connection.execute(query.execution_options(stream_results=True)) as result:
        for row in result.mappings():
            encoded = json.dumps(
                dict(row), sort_keys=True, ensure_ascii=False,
                separators=(",", ":"), default=canonical_value,
            ).encode("utf-8")
            digest.update(len(encoded).to_bytes(8, "big"))
            digest.update(encoded)
            count += 1
    return {"count": count, "sha256": digest.hexdigest()}


def fingerprints(connection) -> dict:
    return {table.name: fingerprint(connection, table) for table in TABLES}


def destination_state(engine, expected: dict) -> str:
    existing = set(inspect(engine).get_table_names())
    overlap = existing & {table.name for table in TABLES}
    if not overlap:
        return "empty"
    if len(overlap) != len(TABLES):
        raise RuntimeError("O Aiven contém parte das tabelas do Marai; revise o destino antes de continuar.")
    with engine.connect() as connection:
        actual = fingerprints(connection)
    if actual == expected:
        return "identical"
    if all(value["count"] == 0 for value in actual.values()):
        return "empty"
    raise RuntimeError(
        "O Aiven já contém dados diferentes da origem. A cópia foi cancelada para evitar sobrescrita."
    )


def apply_schema(target_url: URL) -> None:
    migration_env = os.environ.copy()
    migration_env["DATABASE_URL"] = target_url.render_as_string(hide_password=False)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=ROOT, env=migration_env, capture_output=True, text=True, errors="replace",
    )
    if result.returncode:
        raise RuntimeError("Não foi possível preparar as tabelas:\n" + result.stderr)


def copy_records(source, destination, expected: dict) -> None:
    for table in TABLES:
        with source.execute(select(table).execution_options(stream_results=True)) as result:
            records = result.mappings()
            while rows := records.fetchmany(500):
                destination.execute(table.insert(), [dict(row) for row in rows])
    if fingerprints(destination) != expected:
        raise RuntimeError("A conferência dos dados falhou; a transação no destino será desfeita.")


def ensure_app_stopped(port: int) -> None:
    with socket.socket() as connection:
        connection.settimeout(1)
        if connection.connect_ex(("127.0.0.1", port)) == 0:
            raise RuntimeError(
                f"Feche o Marai que está rodando na porta {port} (Ctrl+C) e execute este iniciador novamente."
            )


def migrate() -> None:
    args = arguments()
    local_url = make_url(settings.database_url)
    if local_url.host not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError(
            "O .env já aponta para um banco remoto. Esta ferramenta copia somente a partir do banco local."
        )
    if not args.host.endswith(".aivencloud.com"):
        raise RuntimeError("O destino precisa ser um host PostgreSQL do Aiven.")

    print(f"Destino: {args.host}:{args.port} / {args.database}")
    certificate = prepare_certificate(args.ca)
    check_tls(args.host, args.port, certificate)
    print("Certificado preparado automaticamente; conexão TLS e identidade do servidor verificadas.")
    if not args.check:
        ensure_app_stopped(args.app_port)

    source_engine = create_engine(local_url, pool_pre_ping=True, hide_parameters=True,
                                  connect_args={"connect_timeout": 5})
    target_engine = None
    password = ""
    try:
        with source_engine.connect().execution_options(isolation_level="REPEATABLE READ") as source:
            source.execute(text("SET TRANSACTION READ ONLY"))
            expected = fingerprints(source)
            print("Registros locais:")
            for table_name, details in expected.items():
                print(f"  {table_name}: {details['count']}")
            if args.check:
                print("Verificação concluída. Nenhum banco ou arquivo .env foi alterado.")
                return

            print("A cópia será conferida antes de atualizar a conexão do Marai.")
            password = getpass.getpass("Senha do Aiven (não será exibida): ")
            if not password:
                raise RuntimeError("Informe a senha do usuário do banco no Aiven.")
            target_url = URL.create(
                "postgresql+pg8000", username=args.username, password=password,
                host=args.host, port=args.port, database=args.database,
                query={"sslmode": "verify-full", "sslrootcert": certificate.relative_to(ROOT).as_posix(),
                       "connect_timeout": "10"},
            )
            target_engine = create_database_engine(target_url)
            state = destination_state(target_engine, expected)
            apply_schema(target_url)
            if state == "empty":
                print("Copiando registros...")
                with target_engine.begin() as destination:
                    copy_records(source, destination, expected)
                    destination.execute(text("ANALYZE"))
            else:
                print("Os dados já estão idênticos no Aiven; vou concluir a configuração.")

        # Check the committed destination using a new connection before switching the app.
        with target_engine.connect() as destination:
            if fingerprints(destination) != expected:
                raise RuntimeError("Os dados no Aiven não conferem; o .env ainda aponta para o banco local.")
        report = ROOT / ".runtime" / "migration-aiven.json"
        report.parent.mkdir(exist_ok=True)
        report.write_text(json.dumps({
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "host": args.host, "database": args.database, "tables": expected,
        }, indent=2), encoding="utf-8")
        set_key(str(ROOT / ".env"), "DATABASE_URL",
                target_url.render_as_string(hide_password=False), quote_mode="always")
        print("CONCLUÍDO: registros e conteúdo conferidos; o .env agora aponta para o Aiven.")
        print("O banco local foi preservado. Abra Iniciar Marai.cmd para usar o Aiven, sem iniciar o Docker.")
    except Exception as error:
        message = str(error)
        if password:
            for secret in (password, quote(password, safe="")):
                message = message.replace(secret, "[senha omitida]")
        raise RuntimeError(message) from None
    finally:
        source_engine.dispose()
        if target_engine is not None:
            target_engine.dispose()


if __name__ == "__main__":
    try:
        migrate()
    except KeyboardInterrupt:
        print("\nOperação interrompida. Confira a mensagem anterior antes de tentar novamente.")
        raise SystemExit(130)
    except Exception as error:
        print(f"Migração não concluída: {error}", file=sys.stderr)
        raise SystemExit(1)
