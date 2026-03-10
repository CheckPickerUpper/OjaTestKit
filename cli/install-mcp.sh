#!/usr/bin/env bash
set -euo pipefail

# When installed as a dependency, neutralize our node_modules so Rojo
# treats it as a ModuleScript (not a traversable Folder). Without this,
# TS.getModule finds our empty node_modules first, does WaitForChild("@rbxts")
# on it, and yields forever. An init.luau makes Rojo see it as a leaf module.
if [ ! -f "tsconfig.json" ] && [ -d "node_modules" ]; then
  echo "return nil" > node_modules/init.luau
fi

REPO="CheckPickerUpper/ai-lab"
BIN="rbx-studio-mcp"
INSTALL_DIR="node_modules/.bin"
VERSION="${STUDIO_MCP_VERSION:-latest}"

if command -v "$BIN" &>/dev/null; then
  echo "$BIN already installed at $(command -v "$BIN")"
  exit 0
fi

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)  TARGET="x86_64-unknown-linux-gnu" ;;
  Darwin)
    case "$ARCH" in
      arm64) TARGET="aarch64-apple-darwin" ;;
      *)     TARGET="x86_64-apple-darwin" ;;
    esac
    ;;
  MINGW*|MSYS*|CYGWIN*) TARGET="x86_64-pc-windows-msvc" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

TARBALL="$BIN-$TARGET.tar.gz"

echo "Downloading $BIN ($TARGET) from $REPO"
mkdir -p "$INSTALL_DIR"

if [ "$VERSION" = "latest" ]; then
  gh release download --repo "$REPO" --pattern "$TARBALL" --dir /tmp --clobber
else
  gh release download "$VERSION" --repo "$REPO" --pattern "$TARBALL" --dir /tmp --clobber
fi

tar xzf "/tmp/$TARBALL" -C "$INSTALL_DIR"
chmod +x "$INSTALL_DIR/$BIN"
rm "/tmp/$TARBALL"

echo "Installed $BIN to $INSTALL_DIR/$BIN"
