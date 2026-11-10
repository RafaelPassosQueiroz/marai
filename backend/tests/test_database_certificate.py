from datetime import datetime, timedelta, timezone
import ssl

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID
import pytest

from app import database_engine


@pytest.fixture
def pem():
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Marai test CA")])
    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(hours=1))
        .not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )
    return certificate.public_bytes(serialization.Encoding.PEM).decode("ascii")


@pytest.fixture
def project(tmp_path, monkeypatch):
    directory = tmp_path / "Área de Trabalho" / "Marai"
    directory.mkdir(parents=True)
    monkeypatch.setattr(database_engine, "PROJECT_ROOT", directory)
    monkeypatch.setattr(database_engine.Path, "home", classmethod(lambda cls: tmp_path / "user"))
    return directory


def test_recovers_missing_absolute_certificate_from_project(project, pem):
    (project / "ca.pem").write_text(pem, encoding="ascii")
    context = database_engine.create_verified_ssl_context(project / "old-profile" / "missing.pem")
    assert context.check_hostname is True
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.cert_store_stats()["x509_ca"] >= 1


def test_relative_unicode_path_is_resolved_from_project_not_working_directory(project, pem, tmp_path, monkeypatch):
    certificate = project / "certificados" / "conexão.pem"
    certificate.parent.mkdir()
    certificate.write_bytes(pem.encode("utf-8-sig"))
    monkeypatch.chdir(tmp_path)
    assert database_engine.read_ca_certificate("certificados/conexão.pem") == pem
    context = database_engine.create_verified_ssl_context("certificados/conexão.pem")
    assert context.check_hostname is True


def test_explicit_certificate_takes_priority_over_project_fallback(project, pem):
    explicit = project / "selected.pem"
    explicit.write_bytes(pem.encode("ascii"))
    (project / "ca.pem").write_text("unrelated certificate", encoding="ascii")
    assert database_engine.read_ca_certificate(explicit) == pem


def test_missing_certificate_has_actionable_error_and_does_not_disable_validation(project):
    with pytest.raises(FileNotFoundError, match="Salve o certificado baixado do Aiven"):
        database_engine.create_verified_ssl_context("missing.pem")


def test_remote_driver_rejects_disabled_certificate_verification():
    with pytest.raises(ValueError, match="verificação completa"):
        database_engine.create_database_engine("postgresql+pg8000://localhost/test?sslmode=disable")
