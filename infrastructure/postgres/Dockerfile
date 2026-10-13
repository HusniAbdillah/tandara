FROM postgres:16-bookworm
# PG major stays 16 so existing data volumes remain compatible.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git ca-certificates postgresql-server-dev-16 postgresql-16-postgis-3 \
    && git clone --depth 1 --branch v0.8.7 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && make -C /tmp/pgvector && make -C /tmp/pgvector install \
    && rm -rf /tmp/pgvector /var/lib/apt/lists/*
