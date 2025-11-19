#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${1:-$ROOT_DIR/fc-rebuild-bundle}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/fullertonconnect}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "Data directory not found: $DATA_DIR" >&2
  exit 1
fi

if ! command -v mongoimport >/dev/null 2>&1; then
  echo "mongoimport is required to restore the database." >&2
  exit 1
fi

collections=(
  users
  profilecards
  posts
  comments
  clubs
  clubposts
  clubcomments
  conversations
  messages
  listings
  gameresults
  gameprofiles
  events
  ads
)

for coll in "${collections[@]}"; do
  file="$DATA_DIR/${coll}.json"
  if [[ -f "$file" ]]; then
    echo "Restoring $coll from $file"
    mongoimport --uri "$MONGO_URI" --collection "$coll" --drop --file "$file" --jsonArray
  else
    echo "Skipping $coll (missing $file)"
  fi
done

echo "MongoDB restore complete."
