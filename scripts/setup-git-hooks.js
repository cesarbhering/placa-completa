#!/usr/bin/env node

/**
 * Setup Git Hooks
 * Creates a pre-commit hook that runs tests before each commit
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const gitHooksDir = path.join(projectRoot, '.git', 'hooks')
const preCommitPath = path.join(gitHooksDir, 'pre-commit')

// Pre-commit hook content
const preCommitHook = `#!/bin/sh
# Pre-commit hook - Run tests before committing

echo "🧪 Running tests before commit..."

# Run all tests
npm run test:all

# Check if tests passed
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Commit aborted."
  echo "Fix the failing tests or use 'git commit --no-verify' to skip tests."
  exit 1
fi

echo "✅ All tests passed!"
exit 0
`

try {
  // Check if .git directory exists
  if (!fs.existsSync(gitHooksDir)) {
    console.error('❌ .git/hooks directory not found. Are you in a git repository?')
    process.exit(1)
  }

  // Write pre-commit hook
  fs.writeFileSync(preCommitPath, preCommitHook, { mode: 0o755 })
  console.log('✅ Pre-commit hook installed successfully!')
  console.log('📍 Location:', preCommitPath)
  console.log('')
  console.log('ℹ️  Tests will now run automatically before each commit.')
  console.log('ℹ️  To skip tests, use: git commit --no-verify')
} catch (error) {
  console.error('❌ Failed to install pre-commit hook:', error.message)
  process.exit(1)
}
