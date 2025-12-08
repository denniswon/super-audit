# Publishing MrklTree to npm

This guide will help you publish your forked MrklTree plugin to npm.

## Prerequisites

1. **npm account**: Make sure you're logged in to npm
2. **Package name**: You'll need to use a scoped package name like `@mrkltree/auditagent` since `auditagent` may already be taken

## Step 1: Update Package Name in Your Fork

Before publishing, you need to update the package name in your fork:

1. Go to your fork: https://github.com/denniswon/auditagent
2. Edit `packages/plugin/package.json`
3. Change the `name` field from `"auditagent"` to `"@mrkltree/auditagent"`
4. Commit and push the change

## Step 2: Publish to npm

### Option A: Using the Publish Script (Recommended)

```bash
cd contracts
bash scripts/publish-auditagent.sh
```

This script will:

1. Clone your fork
2. Build the plugin
3. Update the package name to `@mrkltree/auditagent`
4. Publish to npm

### Option B: Manual Publishing

1. **Clone your fork**:

   ```bash
   git clone https://github.com/denniswon/auditagent.git /tmp/auditagent-publish
   cd /tmp/auditagent-publish/packages/plugin
   ```

2. **Install dependencies and build**:

   ```bash
   pnpm install
   pnpm run build
   ```

3. **Update package name**:

   ```bash
   npm pkg set name="@mrkltree/auditagent"
   ```

4. **Login to npm** (if not already logged in):

   ```bash
   npm login
   # Or use your token:
   echo "//registry.npmjs.org/:_authToken=<token>" > ~/.npmrc
   ```

5. **Publish**:

   ```bash
   npm publish --access public
   ```

## Step 3: Update Your Project to Use Published Package

After publishing, update `contracts/package.json`:

```json
{
  "devDependencies": {
    "@mrkltree/auditagent": "^1.0.0"
  }
}
```

Then update `hardhat.config.ts`:

```typescript
import MrklAgentPlugin from "@mrkltree/auditagent";
```

Finally, install:

```bash
pnpm install
```

You can then remove the `install-auditagent` script from `package.json` since the package will be installed from npm.

## Security Note

⚠️ **Important**: Your npm token is included in the publish script. After publishing, consider:

1. Removing the token from the script
2. Using environment variables instead:
   ```bash
   export NPM_TOKEN=your-token-here
   bash scripts/publish-auditagent.sh
   ```
3. Using `npm login` instead of tokens for local development

## Troubleshooting

### "Package name already exists"

If `@mrkltree/auditagent` is taken, try:

- `@denniswon/auditagent`
- `auditagent-denniswon`
- `@your-org/auditagent`

### "You do not have permission to publish"

Make sure you're logged in:

```bash
npm whoami
npm login
```

### "Invalid package name"

Scoped packages must start with `@username/`. Make sure you're using:

```bash
npm pkg set name="@mrkltree/auditagent"
```

## Updating the Published Package

To publish a new version:

1. Update the version in `packages/plugin/package.json`:

   ```bash
   npm version patch  # for 1.0.0 -> 1.0.1
   npm version minor  # for 1.0.0 -> 1.1.0
   npm version major  # for 1.0.0 -> 2.0.0
   ```

2. Commit and push:

   ```bash
   git add packages/plugin/package.json
   git commit -m "Bump version to X.X.X"
   git push
   ```

3. Run the publish script again:
   ```bash
   bash scripts/publish-auditagent.sh
   ```
