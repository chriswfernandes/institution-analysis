FROM ghcr.io/berriai/litellm:main-latest

# Trust the corporate (Netskope) CA chain so outbound HTTPS (e.g. Azure OpenAI)
# works behind TLS inspection. The base image is Wolfi (no update-ca-certificates),
# so we append the corporate roots directly to both trust stores:
#   - the system bundle (used by aiohttp via SSL_CERT_FILE)
#   - certifi's cacert.pem (used by httpx / the OpenAI SDK)
# The certs are provided as base64 build args sourced from .env.litellm
# (see scripts/start-litellm.mjs); both are optional and skipped when empty.
ARG NETSKOPE_ROOT_CA_B64=""
ARG NETSKOPE_TENANT_CA_B64=""
RUN mkdir -p /usr/local/share/corp-certs \
    && if [ -n "$NETSKOPE_ROOT_CA_B64" ]; then printf '%s' "$NETSKOPE_ROOT_CA_B64" | base64 -d > /usr/local/share/corp-certs/netskope-root.crt; fi \
    && if [ -n "$NETSKOPE_TENANT_CA_B64" ]; then printf '%s' "$NETSKOPE_TENANT_CA_B64" | base64 -d > /usr/local/share/corp-certs/netskope-tenant.crt; fi \
    && if ls /usr/local/share/corp-certs/*.crt >/dev/null 2>&1; then \
         cat /usr/local/share/corp-certs/*.crt >> /etc/ssl/certs/ca-certificates.crt \
         && cat /usr/local/share/corp-certs/*.crt >> "$(python -c 'import certifi; print(certifi.where())')"; \
       fi

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Python 3.13 enables ssl.VERIFY_X509_STRICT by default, which OpenSSL 3.x uses
# to reject the Netskope CA certs (they have no keyUsage extension). This startup
# hook relaxes only that strict flag; chain + hostname verification still apply.
COPY sitecustomize.py /tmp/sitecustomize.py
RUN cp /tmp/sitecustomize.py "$(python -c 'import site; print(site.getsitepackages()[0])')/sitecustomize.py" \
    && rm /tmp/sitecustomize.py
