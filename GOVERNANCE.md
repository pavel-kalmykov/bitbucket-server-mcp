# Governance

## Overview

This project uses a **benevolent dictator** governance model. The maintainer
has final authority over all decisions: code, releases, and direction. This is
the most common model for small open-source projects — ArduPilot, SAPL, and
many others use it — and it matches the project's current size.

As the project grows, the model will evolve to include additional maintainers
with shared decision-making.

## Roles

### Maintainer

The maintainer is responsible for:

- Reviewing and merging pull requests
- Cutting releases and publishing to npm
- Triaging issues and feature requests
- Maintaining documentation
- Enforcing the code of conduct
- Managing CI/CD and repository settings
- Setting project direction and scope

The current maintainer is **Pável Kalmykov Razgovórov**
([@pavel-kalmykov](https://github.com/pavel-kalmykov)).

### Contributors

Anyone who submits a pull request, reports an issue, or participates in
discussions. Contributors are expected to:

- Follow the [contribution guidelines](CONTRIBUTING.md)
- Adhere to the [Code of Conduct](CODE_OF_CONDUCT.md)
- Write tests for new functionality
- Keep pull requests focused and small

### Community members

Everyone else who uses the project, reads the docs, or joins discussions.
Community members help by reporting bugs, suggesting features, and giving
feedback. No formal responsibilities; just follow the Code of Conduct.

### Becoming a maintainer

Contributors with a track record of high-quality work and commitment to the
project may be invited as maintainers. Invitations are at the maintainer's
discretion. There is no fixed timeline or checklist — the bar is sustained,
trustworthy contributions over time.

## Decision-making

- **Pull requests**: Reviewed and merged by the maintainer. Others can review
  and approve, but only the maintainer merges.
- **Feature requests and bugs**: Discussed in GitHub Issues. The maintainer
  decides what to prioritize.
- **Breaking changes**: Require a written proposal in a GitHub Issue, with a
  migration path.
- **Releases**: Triggered by the maintainer via semantic-release. Details in
  [CONTRIBUTING.md](CONTRIBUTING.md#development-setup).

## Access continuity

To keep the project alive if the maintainer becomes unavailable:

- **Repository ownership**: The repo is under
  [pavel-kalmykov](https://github.com/pavel-kalmykov). If needed, GitHub
  Support can transfer it to a designated successor.
- **Publishing rights**: The package `bitbucket-server-mcp` is on npm under
  `@pavel-kalmykov`. An npm token with publish rights lives in GitHub Actions
  (`NPM_TOKEN`). A successor would need a new npm token and a GitHub PAT with
  repo admin scope.
- **Designated successor**: Once a trusted contributor emerges with sustained
  involvement, they will be added as a GitHub collaborator with admin rights
  and given the release credentials.
- **Bus factor**: Currently 1. Co-maintainers are welcome.

## Developer Certificate of Origin (DCO)

By submitting a pull request, you certify that:

1. You created the contribution (in whole or in part) and have the right to
   submit it under the Apache-2.0 license.
2. You understand the contribution is public and that a record of it
   (including your personal information) is kept indefinitely and may be
   redistributed under the project's open source license.

See https://developercertificate.org/.
