#!/usr/bin/env bash
# Publish this project to a PUBLIC GitHub repo, deploy the demo to GitHub Pages,
# and lock the main branch so nobody (admins included) can push to it directly.
#
# Usage (Git Bash / macOS / Linux):
#   ./scripts/publish-to-github.sh [repo-name]
#
# Needs: git, GitHub CLI (gh) logged in with `repo` and `workflow` scopes (`gh auth login`).
# Safe to re-run: each step skips what is already done.
set -euo pipefail
export MSYS_NO_PATHCONV=1 # stop Git Bash on Windows rewriting /paths

cd "$(dirname "$0")/.."
REPO_NAME="${1:-$(basename "$PWD")}"
DESCRIPTION="ShopDesk - inventory, POS and GST tax invoicing for an independent Sydney electronics accessories shop (Next.js demo)"

step() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

step "Checking tools"
command -v git >/dev/null || fail "git is not installed"
command -v gh >/dev/null || fail "GitHub CLI is not installed: https://cli.github.com"
gh auth status >/dev/null 2>&1 || fail "Not logged in to GitHub. Run: gh auth login"
git config user.email >/dev/null || fail "Set your git identity: git config --global user.email you@example.com"
OWNER="$(gh api user --jq .login)"
echo "GitHub account: $OWNER   Repo: $OWNER/$REPO_NAME (public)"

step "Preparing local git repository"
if [ ! -d .git ]; then
  git init -b main
fi
git checkout -B main >/dev/null 2>&1 || true
git add -A
if ! git diff --cached --quiet; then
  git commit -m "ShopDesk retail management demo" >/dev/null
  echo "Committed changes."
else
  echo "Nothing new to commit."
fi

step "Creating public GitHub repository"
if gh repo view "$OWNER/$REPO_NAME" >/dev/null 2>&1; then
  echo "Repository already exists."
  gh repo edit "$OWNER/$REPO_NAME" --visibility public --accept-visibility-change-consequences >/dev/null
else
  gh repo create "$OWNER/$REPO_NAME" --public --description "$DESCRIPTION" >/dev/null
  echo "Created https://github.com/$OWNER/$REPO_NAME"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO_NAME.git"

step "Pushing code to main"
# Must happen before main is protected; afterwards every change goes through a pull request.
if gh api "repos/$OWNER/$REPO_NAME/branches/main/protection" >/dev/null 2>&1; then
  echo "main is already protected - skipping direct push. Open a pull request for new changes."
else
  git push -u origin main
fi

step "Enabling GitHub Pages and deploying"
if gh api "repos/$OWNER/$REPO_NAME/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null
else
  gh api -X POST "repos/$OWNER/$REPO_NAME/pages" -f build_type=workflow >/dev/null
fi
echo "Pages source: GitHub Actions"
# The push above may have started a run before Pages existed; start a fresh one (it cancels the old).
gh workflow run deploy-pages.yml --repo "$OWNER/$REPO_NAME" --ref main >/dev/null 2>&1 \
  || echo "Could not start the deploy run automatically - start it from the Actions tab."

step "Protecting main (no direct pushes, PR + passing build required)"
gh api -X PUT "repos/$OWNER/$REPO_NAME/branches/main/protection" \
  -H "Accept: application/vnd.github+json" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["build"] },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "Direct pushes, force pushes and deleting main are blocked for everyone, including admins."
echo "Changes reach main only through a pull request whose 'build' check passes."

step "Done"
echo "Code:  https://github.com/$OWNER/$REPO_NAME"
echo "Demo:  https://$OWNER.github.io/$REPO_NAME/   (live in ~2 minutes)"
echo "Build: https://github.com/$OWNER/$REPO_NAME/actions"
