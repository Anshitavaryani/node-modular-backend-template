#!/bin/bash
# Run by the MariaDB image on first start (empty data volume). Lets the app user create and reset *_test databases,
# which npm test needs: it builds app_test from the migrations. No other database is opened to it.
# On a volume created before this script existed, run the GRANT once by hand (README, "Run it with Docker").
# Kept executable: Docker Desktop shows bind-mounted files as executable, so the image runs this file instead of
# sourcing it, and the entrypoint's helper functions are not available here.
set -eu
mariadb --protocol=socket -uroot --password="${MARIADB_ROOT_PASSWORD}" <<EOSQL
GRANT ALL PRIVILEGES ON \`%\_test\`.* TO '${MARIADB_USER}'@'%';
EOSQL
