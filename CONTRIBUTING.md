# Contributing to Watchdog

Thank you for your interest in contributing to Watchdog! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. **Check existing issues** to see if it's already reported
2. **Use the latest version** to see if the bug still exists
3. **Collect information** about your environment

To report a bug:
1. Use the **Bug Report** template
2. Provide a clear title and description
3. Include steps to reproduce
4. Add relevant logs and screenshots
5. Specify your environment (OS, Node version, etc.)

### Suggesting Features

Before suggesting a feature:
1. **Check existing issues** for similar suggestions
2. **Review the roadmap** in README.md
3. **Consider if it fits** the project's scope

To suggest a feature:
1. Use the **Feature Request** template
2. Explain the problem it solves
3. Describe your proposed solution
4. Consider alternatives and trade-offs

### Asking Questions

- Use the **Question** issue template
- Check documentation first (README, CONFIGURATION, ARCHITECTURE)
- Search existing issues for similar questions

### Code Contributions

For detailed development guidelines, see [DEVELOPMENT.md](DEVELOPMENT.md).

**Quick Start**:
```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/watchdog.git
cd watchdog

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/your-feature

# Make changes and test
npm test
npm run lint

# Commit and push
git commit -m "feat: add awesome feature"
git push origin feature/your-feature

# Create Pull Request on GitHub
```

### Pull Request Process

1. **Before submitting**:
   - [ ] Tests pass: `npm test`
   - [ ] Linter passes: `npm run lint`
   - [ ] Documentation updated
   - [ ] CHANGELOG.md updated
   - [ ] Commits follow conventional format

2. **PR Requirements**:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes
   - Test coverage for new code

3. **Review Process**:
   - At least one approval required
   - All checks must pass
   - Address review feedback
   - Squash and merge when approved

4. **After merge**:
   - Delete your branch
   - Update your fork
   - Celebrate! 🎉

## Development Guidelines

### Code Style

- **Style Guide**: Airbnb JavaScript Style Guide
- **Formatting**: Auto-fixed by ESLint
- **ES Modules**: Use `import/export`, include `.js` extensions
- **Naming**: camelCase for variables/functions, PascalCase for classes

### Testing

- **Write tests** for new features
- **Maintain coverage** above 80%
- **Test types**: Unit tests + integration tests
- **Run tests**: `npm test`

See [tests/README.md](tests/README.md) for testing guidelines.

### Documentation

- **README.md**: User-facing features
- **CONFIGURATION.md**: Configuration options
- **ARCHITECTURE.md**: Internal design
- **DEVELOPMENT.md**: Contributor guide

Update relevant docs with your changes.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting changes
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Example**:
```
feat: add Redis health checker

Implements RedisChecker that uses redis-cli to verify connection.
Supports authentication and custom ports.

Closes #123
```

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue` - these are great for new contributors.

### High Priority Areas

- **Test coverage**: Add tests for uncovered code
- **Documentation**: Improve examples and guides
- **Bug fixes**: Address open bugs
- **Performance**: Optimize hot paths

### Ideas for Contributions

- Add new health checkers (MongoDB, PostgreSQL, etc.)
- Add notification channels (Slack, Discord, Email)
- Improve dashboard with graphs
- Add custom alerting rules
- Write tutorials and blog posts
- Translate documentation

## Community

- **Discussions**: [GitHub Discussions](https://github.com/yourusername/watchdog/discussions)
- **Issues**: [GitHub Issues](https://github.com/yourusername/watchdog/issues)
- **Pull Requests**: [GitHub PRs](https://github.com/yourusername/watchdog/pulls)

## Recognition

Contributors are recognized in:
- Git commit history
- CHANGELOG.md
- Release notes
- Project README (for significant contributions)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Read [DEVELOPMENT.md](DEVELOPMENT.md) for technical details
- Ask in [Discussions](https://github.com/yourusername/watchdog/discussions)
- Open an issue with the "Question" template

---

Thank you for making Watchdog better! 🐕
