#!/bin/bash
# Exit 0 = skip build. Exit 1 = proceed with build.
# Skips preview deployments triggered by dependabot — they lack required
# env vars and shouldn't run migrations or builds against the database.
if [ "$VERCEL_GIT_COMMIT_AUTHOR_LOGIN" = "dependabot[bot]" ]; then
  echo "Skipping Vercel build for dependabot PR"
  exit 0
fi
exit 1
