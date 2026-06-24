"""
Relax OpenSSL's strict X.509 verification for LiteLLM's outbound HTTPS.

Python 3.13 turns on ``ssl.VERIFY_X509_STRICT`` by default in
``ssl.create_default_context()``. Combined with OpenSSL 3.x, that rejects the
corporate (Netskope) TLS-inspection CA certs because they lack a ``keyUsage``
extension ("CA cert does not include key usage extension").

The certificates are trusted (added to the system + certifi bundles) and the
full chain + hostname are still verified — we only drop the strict-mode flag so
non-RFC-compliant-but-valid corporate CAs are accepted. This file is imported
automatically by the Python interpreter at startup (it lives on sys.path as
``sitecustomize``), so it applies to every client LiteLLM uses (httpx, aiohttp,
urllib, ...).
"""
import ssl

_orig_create_default_context = ssl.create_default_context


def _create_default_context(*args, **kwargs):
    ctx = _orig_create_default_context(*args, **kwargs)
    ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
    return ctx


ssl.create_default_context = _create_default_context
ssl._create_default_https_context = _create_default_context
