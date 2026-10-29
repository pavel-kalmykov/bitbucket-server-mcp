# Work-leak guard: blocks commits/pushes that carry internal-work markers
# into this public repository. Shared by pre-commit (staged content) and
# pre-push (outgoing commits). Called with one argument: staged|push.
set -u

MODE="${1:?usage: work-leak-guard.sh staged|push}"

# Split so this file never contains the literal markers it blocks.
COMPANY="$(printf 'acr''onis')"

PATTERNS="${COMPANY}|draas-[0-9]+|dr-""service|adrc-""service|runvm-""agent|zta-""proxy|grp""m"
EMAIL_DOMAIN="${COMPANY}.com"

fail() {
  echo "work-leak-guard: blocked. Possible internal-work reference:" >&2
  echo "" >&2
  echo "$1" >&2
  echo "" >&2
  echo "work-leak-guard: remove it, or adjust the PATTERNS list in .husky/work-leak-guard.sh" >&2
  exit 1
}

scan() {
  local what="$1" text="$2" hits
  hits="$(printf '%s' "$text" | grep -inE "$PATTERNS" | head -5)"
  if [ -n "$hits" ]; then
    fail "$what:
$hits"
  fi
}

check_emails() {
  local what="$1"
  shift
  local email
  for email in "$@"; do
    if printf '%s' "$email" | grep -iq "$EMAIL_DOMAIN"; then
      fail "$what: author/committer email '$email' belongs to $EMAIL_DOMAIN"
    fi
  done
}

case "$MODE" in
  staged)
    scan "staged diff" "$(git diff --cached)"
    ;;
  push)
    RANGE="$(git rev-parse --verify --quiet '@{push}')"
    if [ -z "$RANGE" ]; then
      RANGE="$(git rev-parse --verify --quiet origin/main)"
    fi
    if [ -n "$RANGE" ]; then
      scan "outgoing diff ($RANGE..HEAD)" "$(git diff "$RANGE..HEAD")"
      check_emails "outgoing commits" "$(git log --format='%ae %ce' "$RANGE..HEAD")"
    fi
    ;;
  *)
    echo "work-leak-guard: unknown mode '$MODE'" >&2
    exit 1
    ;;
esac

exit 0
