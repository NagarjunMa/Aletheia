.PHONY: help dev build start lint type-check format format-check \
        test test-watch test-coverage test-ui \
        guardrails guardrails-watch \
        e2e e2e-ui e2e-debug \
        analyze validate clean ci

# ─── Default ──────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo "Aletheia — available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Development ──────────────────────────────────────────────────────────────

dev: ## Start development server on :3000
	npm run dev

build: ## Production Next.js build
	npm run build

start: ## Start production server (run build first)
	npm run start

# ─── Code Quality ─────────────────────────────────────────────────────────────

lint: ## Run ESLint
	npm run lint

type-check: ## TypeScript type check (tsc --noEmit)
	npm run type-check

format: ## Format all files with Prettier
	npm run format

format-check: ## Check formatting without writing (CI-safe)
	npm run format:check

# ─── Unit Tests ───────────────────────────────────────────────────────────────

test: ## Run unit tests once (non-interactive)
	npm run test -- --run

test-watch: ## Run unit tests in watch mode
	npm run test:watch

test-coverage: ## Run unit tests + generate coverage report in coverage/
	npm run test:coverage

test-ui: ## Open Vitest browser UI
	npm run test:ui

# ─── Guardrail Tests ──────────────────────────────────────────────────────────

guardrails: ## Run guardrail tests (mandatory before any lib/ai/ PR)
	npm run test:guardrails -- --run

guardrails-watch: ## Run guardrail tests in watch mode
	npm run test:guardrails:watch

# ─── E2E Tests ────────────────────────────────────────────────────────────────

e2e: ## Run Playwright E2E tests (requires running server or starts one)
	npm run test:e2e

e2e-ui: ## Open Playwright UI mode
	npm run test:e2e:ui

e2e-debug: ## Run Playwright in debug mode
	npm run test:e2e:debug

# ─── Utilities ────────────────────────────────────────────────────────────────

analyze: ## Analyse bundle sizes (opens browser report)
	npm run analyze

validate: ## Run startup environment validation script
	npm run validate

clean: ## Remove Next.js build output and Vite cache
	rm -rf .next node_modules/.cache coverage

# ─── CI Simulation ────────────────────────────────────────────────────────────

ci: lint type-check test guardrails build ## Run full CI pipeline locally (lint → type-check → test → guardrails → build)
