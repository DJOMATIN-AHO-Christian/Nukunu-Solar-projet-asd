#!/bin/bash
# init-db.sh — Initialisation PostgreSQL pour Nukunu Solar
# Wrappeur qui appelle le vrai init.sql
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/../../../db/init.sql 2>/dev/null || true
