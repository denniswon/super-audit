#!/bin/bash
# Script to publish SuperAudit plugin to npm
# This script clones your fork, builds it, and publishes to npm

set -e

REPO_URL="https://github.com/denniswon/super-audit.git"
TEMP_DIR="/tmp/superaudit-publish"
# Use NPM_TOKEN environment variable if set, otherwise use the provided token
# SECURITY: Consider using environment variable instead of hardcoding
NPM_TOKEN="${NPM_TOKEN:-token}"

echo "📦 Publishing SuperAudit plugin to npm..."

# Clean up temp directory if it exists
rm -rf "$TEMP_DIR"

# Clone the repository
echo "Cloning SuperAudit repository..."
git clone "$REPO_URL" "$TEMP_DIR" --depth 1

# Navigate to plugin directory
cd "$TEMP_DIR/packages/plugin"

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build the plugin
echo "Building plugin..."
pnpm run build

# Configure npm with your token
echo "Configuring npm authentication..."
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc

# Update package name to avoid conflicts
# Change from "super-audit" to "@jhwon0820/super-audit"
echo "Updating package name..."
npm pkg set name="@jhwon0820/super-audit"

# Publish to npm
echo "Publishing to npm..."
npm publish --access public

# Clean up
rm -rf "$TEMP_DIR"

echo "✅ Successfully published @jhwon0820/super-audit to npm!"
echo ""
echo "You can now install it with:"
echo "  pnpm install @jhwon0820/super-audit"
