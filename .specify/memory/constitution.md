<!--
Sync Impact Report:
- Version: 0.0.0 → 1.0.0
- Change type: MAJOR (initial constitution creation)
- Principles added: 5 core principles covering code quality, testing, UX, maintainability
- Templates status:
  ✅ plan-template.md: Compatible (Constitution Check section references this file)
  ✅ spec-template.md: Compatible (no changes needed)
  ✅ tasks-template.md: Compatible (TDD tasks align with Principle II)
- Follow-up: None required
-->

# Realtime Chat Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

All code MUST adhere to the following quality standards:
- **Single Responsibility**: Each module, class, and function serves one clear purpose
- **DRY Principle**: No duplication of logic; extract shared code into reusable components
- **Readability First**: Code is written for humans to read; clarity over cleverness
- **Type Safety**: Use strict typing where available; no implicit any/unknown types
- **Error Handling**: All error paths explicitly handled; no silent failures
- **Code Review Required**: All changes reviewed before merge; no direct commits to main

**Rationale**: High-quality code reduces bugs, accelerates onboarding, and minimizes technical debt. Quality gates prevent degradation over time.

### II. Testing Standards (NON-NEGOTIABLE)

Testing is mandatory and follows Test-Driven Development:
- **TDD Workflow Required**: Write failing tests → Get approval → Implement → Tests pass
- **Coverage Minimums**: 80% unit test coverage, 100% contract test coverage for all APIs
- **Test Categories**:
  - **Contract Tests**: All API endpoints must have passing contract tests
  - **Integration Tests**: All cross-component interactions tested
  - **Unit Tests**: All business logic and validation tested in isolation
- **Test Quality**: Tests must be deterministic, isolated, fast (<1s per test)
- **No Skipped Tests**: Disabled tests must have tickets and timeline for resolution

**Rationale**: TDD prevents regression, documents expected behavior, and enables fearless refactoring. Contract tests ensure API stability.

### III. User Experience Consistency

All user-facing features MUST maintain consistency:
- **Design System**: UI components follow established design tokens (colors, spacing, typography)
- **Interaction Patterns**: Similar actions use identical interaction models across features
- **Performance Budgets**: Page loads <2s, interactions <100ms, API responses <500ms
- **Accessibility**: WCAG 2.1 AA compliance; keyboard navigation, screen reader support
- **Error Messages**: User-friendly, actionable error messages; no raw exceptions exposed
- **Responsive Design**: Mobile-first approach; all features tested on mobile, tablet, desktop

**Rationale**: Consistent UX reduces cognitive load, improves usability, and builds user trust. Performance budgets prevent degradation.

### IV. Maintainability Requirements

Code MUST be designed for long-term maintainability:
- **Documentation**: All public APIs documented with JSDoc/equivalent; complex logic explained with comments
- **Architecture Decisions**: ADRs (Architecture Decision Records) for all major technical choices
- **Dependency Management**: Regular updates; no unmaintained dependencies; security patches applied within 7 days
- **Modularity**: Clear module boundaries; low coupling, high cohesion
- **Refactoring Budget**: 20% of sprint capacity for tech debt reduction
- **Monitoring & Observability**: All production code instrumented with logging, metrics, and tracing

**Rationale**: Maintainable code reduces future costs, enables team velocity, and prevents knowledge silos.

### V. Security & Data Protection

Security is built-in, not bolted-on:
- **Secure by Default**: Authentication required; authorization checked; inputs validated
- **Data Encryption**: Sensitive data encrypted at rest and in transit
- **Secret Management**: No secrets in code; use environment variables or secret managers
- **Audit Logging**: All security-relevant actions logged with user context
- **Regular Audits**: Security reviews quarterly; dependency scans automated
- **Privacy Compliance**: GDPR/CCPA compliance; user data minimization; deletion workflows

**Rationale**: Security breaches destroy user trust and have legal/financial consequences. Proactive security is cheaper than reactive fixes.

## Development Workflow

### Code Contribution Process

1. **Feature Branch**: Create branch from main using naming: `###-feature-name`
2. **Specification**: Write feature spec using `/specify` command
3. **Planning**: Generate implementation plan using `/plan` command
4. **Task Generation**: Create tasks using `/tasks` command
5. **TDD Implementation**: Write tests → Implement → Verify tests pass
6. **Code Review**: Submit PR with all tests passing, coverage maintained
7. **QA Approval**: Manual testing checklist completed
8. **Merge**: Squash merge to main after approvals

### Quality Gates

All PRs MUST pass:
- [ ] All tests passing (unit, integration, contract)
- [ ] Code coverage ≥80% (no decrease from baseline)
- [ ] Linter/formatter passing with zero warnings
- [ ] Security scan passing (no high/critical vulnerabilities)
- [ ] Performance budgets met
- [ ] Accessibility checks passing
- [ ] Code review approved by ≥1 reviewer
- [ ] Documentation updated

### Review Checklist

Reviewers MUST verify:
- [ ] Code follows all Core Principles (I-V)
- [ ] Tests validate requirements from spec
- [ ] Error handling comprehensive
- [ ] No hardcoded values; use configuration
- [ ] Logging appropriate (not excessive, not missing)
- [ ] Breaking changes documented and migration plan provided

## Technical Standards

### Code Style

- **Formatting**: Use automated formatters (Prettier, Black, etc.); no manual formatting debates
- **Naming Conventions**: Descriptive names; avoid abbreviations; use domain language
- **File Organization**: Feature-based folders; co-locate related files
- **Import Order**: Automatic sorting; group by external/internal/relative

### Performance Standards

- **Database Queries**: N+1 queries prohibited; use eager loading, batch operations
- **Caching Strategy**: Cache invalidation strategy documented; TTLs defined
- **Asset Optimization**: Images compressed; lazy loading; code splitting
- **Memory Management**: No memory leaks; monitor heap usage

### API Design

- **RESTful Conventions**: Follow REST principles; consistent URL patterns
- **Versioning**: API versioning required for breaking changes (v1, v2)
- **Rate Limiting**: All public endpoints rate-limited
- **Pagination**: Large datasets paginated; default page size documented
- **Error Responses**: Consistent error format; HTTP status codes correct

## Governance

### Constitutional Authority

This Constitution supersedes all other development practices. When conflicts arise:
1. Constitution principles take precedence
2. Team discusses exception with justification
3. Complexity tracked in Complexity Tracking section of plan.md
4. If no justification possible: simplify approach to comply

### Amendment Process

Constitution changes require:
1. Written proposal with rationale
2. Team review and discussion
3. Approval from tech lead and product owner
4. Migration plan for existing code if needed
5. Version bump following semantic versioning:
   - **MAJOR**: Breaking principle changes or removals
   - **MINOR**: New principles or expanded guidance
   - **PATCH**: Clarifications, wording fixes

### Compliance Review

- **Pre-merge**: All PRs verify constitutional compliance via checklist
- **Quarterly Audits**: Review existing code for drift; create remediation tickets
- **Metrics Dashboard**: Track compliance metrics (test coverage, security scan results, performance)

### Exception Handling

When constitutional compliance is not possible:
1. Document in Complexity Tracking section of plan.md
2. Explain why needed and what simpler alternatives were rejected
3. Get approval from tech lead
4. Create ticket for future refactoring if technical debt incurred

**Version**: 1.0.0 | **Ratified**: 2025-10-03 | **Last Amended**: 2025-10-03
