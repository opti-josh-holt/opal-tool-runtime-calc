# Claude Code Configuration

This is a repo of tools that implement the Opal Tools SDK. The first tool is an experiment runtime calculation tool.

## Development Commands

```bash
# Start development server
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Build for Vercel deployment
npm run vercel-build
```

## Project Structure

- `api/index.ts` - Main Express server entry point
- `api/calculate-runtime.ts` - Runtime calculation logic
- `vercel.json` - Vercel deployment configuration
- `tsconfig.json` - TypeScript configuration

## Tech Stack

- TypeScript
- Express.js
- Opal Tools SDK
- Vercel (deployment platform)

---

## Implementation Best Practices

### Before Coding

- **BP-1 (MUST)** Ask clarifying questions for complex features
- **BP-2 (SHOULD)** Draft and confirm approach for non-trivial changes

### While Coding

- **C-1 (MUST)** Follow TDD: write failing test → implement → refactor
- **C-2 (MUST)** Use consistent naming with existing codebase
- **C-3 (SHOULD)** Prefer simple, testable functions over classes
- **C-4 (MUST)** Use `import type { … }` for type-only imports
- **C-5 (SHOULD NOT)** Add comments except for critical caveats
- **C-6 (SHOULD)** Default to `type`; use `interface` only when needed

### Testing

- **T-1 (MUST)** Colocate unit tests in `*.spec.ts` files
- **T-2 (SHOULD)** Prefer integration tests over heavy mocking
- **T-3 (SHOULD)** Test edge cases and realistic inputs

### Tooling Gates

- **G-1 (MUST)** `npm run build` passes
- **G-2 (MUST)** TypeScript compilation succeeds

### Git

- **GH-1 (MUST)** Use Conventional Commits format
- **GH-2 (SHOULD NOT)** Refer to Claude or Anthropic in commit messages

---

## Writing Functions Best Practices

When evaluating whether a function you implemented is good or not, use this checklist:

1. Can you read the function and HONESTLY easily follow what it's doing? If yes, then stop here.
2. Does the function have very high cyclomatic complexity? (number of independent paths, or, in a lot of cases, number of nesting if if-else as a proxy). If it does, then it's probably sketchy.
3. Are there any common data structures and algorithms that would make this function much easier to follow and more robust? Parsers, trees, stacks / queues, etc.
4. Are there any unused parameters in the function?
5. Are there any unnecessary type casts that can be moved to function arguments?
6. Is the function easily testable without mocking core features (e.g. sql queries, redis, etc.)? If not, can this function be tested as part of an integration test?
7. Does it have any hidden untested dependencies or any values that can be factored out into the arguments instead? Only care about non-trivial dependencies that can actually change or affect the function.
8. Brainstorm 3 better function names and see if the current name is the best, consistent with rest of codebase.

IMPORTANT: you SHOULD NOT refactor out a separate function unless there is a compelling need, such as:

- the refactored function is used in more than one place
- the refactored function is easily unit testable while the original function is not AND you can't test it any other way
- the original function is extremely hard to follow and you resort to putting comments everywhere just to explain it

---

## Shortcuts

### QNEW

```
Understand all BEST PRACTICES listed in CLAUDE.md.
Your code SHOULD ALWAYS follow these best practices.
```

### QPLAN

When I type "qplan", this means:

```
Analyze similar parts of the codebase and determine whether your plan:
- is consistent with rest of codebase
- introduces minimal changes
- reuses existing code
```

### QCODE

```
Implement your plan and make sure tests pass.
Always run `npm run build` to ensure TypeScript compilation.
```

### QCHECK

When I type "qcheck", this means:

```
You are a SKEPTICAL senior software engineer.
Perform this analysis for every MAJOR function you added or edited (skip minor changes):

1. CLAUDE.md checklist Writing Functions Best Practices.
```

### QUX

When I type "qux", this means:

```
Imagine you are a human UX tester of the feature you implemented.
Output a comprehensive list of scenarios you would test, sorted by highest priority.
```

### QGIT

```
Add all changes to staging, create a commit, and push to remote.
Use Conventional Commits format without referencing Claude/Anthropic.
```
