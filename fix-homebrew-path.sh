#!/bin/bash
# Run once to permanently add Homebrew (Apple Silicon) to PATH in ~/.bash_profile

BREW_INIT='eval "$(/opt/homebrew/bin/brew shellenv bash)"'
PROFILE="$HOME/.bash_profile"

if [ ! -f /opt/homebrew/bin/brew ]; then
  echo "ERROR: Homebrew not found at /opt/homebrew/bin/brew"
  echo "Install it first: https://brew.sh"
  exit 1
fi

if grep -qF "$BREW_INIT" "$PROFILE" 2>/dev/null; then
  echo "Homebrew init already present in $PROFILE — nothing to do."
else
  echo "" >> "$PROFILE"
  echo "# Homebrew (Apple Silicon)" >> "$PROFILE"
  echo "$BREW_INIT" >> "$PROFILE"
  echo "Added Homebrew init to $PROFILE"
fi

eval "$(/opt/homebrew/bin/brew shellenv bash)"
echo "Homebrew is now active in this session."
echo ""
echo "brew: $(brew --version 2>/dev/null | head -1)"
echo "claude: $(which claude 2>/dev/null || echo 'not installed — run: brew install claude')"
echo ""
echo "Restart your terminal (or run: source ~/.bash_profile) for the change to persist."
