## [0.14.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.13.1...v0.14.0) (2026-09-04)

### Bug Fixes

* return the fields the comment and deployment tools write ([6c77706](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6c77706da0a0f26b652d796fc514fb2ca5eb98a5))
* resolve known npm audit vulnerabilities ([5bedfc4](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/5bedfc4d7686d2f4b94701b7bf538975b00b3fc0))
* remove unreachable !handler guard in manage_tags ([3ce3272](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/3ce32727bf45f8ae1fe9dc21256fb1a053472dc4))
* raise dependency-review fail threshold to high ([e7f33bd](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/e7f33bd5363044c3e67f418e0e5ad2311f3722f1))
* make request timeout configurable and stabilize its test ([bf1930c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/bf1930c67815e0499a95ce66cf6da157480430f0))
* stop stripping PR properties from list results ([6b6ab48](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6b6ab48df38d1d8cc744eee04b4ae8ac61e8e769))
* correct labels version gate and align server minimum ([30cc859](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/30cc8599a9838f85e90119a2631d7a74b6ec446d))
* tolerate non-error responses on labels E2E for Bitbucket 7.21 ([5765f0d](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/5765f0ddfb4f4c2ccd299a6ca8dc03646be7826a))

### Features

* accept durations with units in env vars ([ea26ab6](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/ea26ab6b680494e9dde049771a002f8b091232e3))
* publish the api layer as a library subpath ([06923c1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/06923c12cc9d57d95c9d532bea2b6cfd5d373b2a))
* move the remaining endpoints into api namespaces ([4e330ad](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4e330adea0907eb3fce534e66deead2711151ba6))
* add branches, commits and tags api namespaces ([b797c94](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/b797c94ae16ef7725bca1087186be49af2b05182))
* add BitbucketClient with a namespaced api surface ([34805aa](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/34805aa13211d8a6020d1e76b347fd668e36dcea))
* extract users tools as core functions ([914a080](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/914a0803934ead7afe2c08b864131be73fb0dde8))
* add typed test data builders for Bitbucket payloads ([71c59c8](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/71c59c89283e0164e219e6af315a811398a570e9))
* add manage_deployments tool with E2E tests ([222b1e7](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/222b1e77ace440a89fa6ff9fd25f0b5bd7e136ea))

### Performance

* move field catalog to on-demand resource ([9147542](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/9147542a4a44767b26cc4a8949768bc3e5f53a07))
* cap limit at 100 to bound response size ([b0d9d2f](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/b0d9d2f32670fa410f61a4a6a6bc8e9f5684f4ca))
* curate condition list ([96a900b](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/96a900b80b41ceaa2eaf7cd1edd5679f7ecfcd64))
* curate code insight reports ([437d98e](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/437d98ec1160fbf6cd5c4bceca75eeea3a00fccc))
* curate deployment get/create responses ([4220923](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/42209234d36965765e1ae7427eaa0823e55d2ff7))
* curate branch/tag create and list_commit_comments ([ec18277](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/ec18277e5b351a3b1b88c7b1ae78faa31ea00ef2))
* curate comment create/edit responses ([8a6269f](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/8a6269f825336e7d55196dccd8adaaffe86e8131))
* curate create_repository and fork_repository ([af1c7f8](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/af1c7f8d92bff5691c32fc7c78a9c16072a42c36))
* curate commits, commit-PRs, and PR mutations ([807fd78](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/807fd78031d5addb3911b33ed342a60d02e71f4b))
* curate webhooks, reviewer groups, and secret scanning ([1ba605e](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/1ba605ea871ed4a43677935552de122d28282fc6))
* curate user profile and search results ([72151bf](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/72151bf273c8b016fba2cf070c943f4885135968))
* curate get_pull_request_activity ([5f75d3f](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/5f75d3f50170d6ce61e5f779071997f9efa5f426))
* minify JSON output ([1e571f0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/1e571f0e03c6e251471908e1c282923c737894da))

### Refactors

* give the api layer its own error type and pagination ([021f4a7](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/021f4a7450a8aa854028ddfe2386f752e59c41c9))
* rename core to api and add the api barrel ([363583d](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/363583de68b37fe2099758de0657baa248de50ce))
* move src/http to src/core/http ([44210bd](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/44210bd3a8741a81e8c1285d9362bcea260b271b))
* migrate remaining 12 E2E files to describeBitbucket ([0870552](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/0870552146a3e5b0ee462d42873893948f47c161))
* extract describeBitbucket helper for E2E test suite ([b20700a](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/b20700aa70d656619ae1e211dbfcfb4d22221cf7))
* extract buildPaginated helper to DRY list-response shape ([de09a0e](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/de09a0e8336f8cdc39c2c8d480369b52f795375c))
* remove unreachable !handler guard from manage_branches ([11e2114](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/11e21148ebf6d7a6a783fd6e5fe6c739a6114f78))
* make Paginated generic to eliminate value-list casts ([df56d99](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/df56d99e95711a4d475abe99e3b8c49173efc831))
* split refs.ts into branches.ts and tags.ts ([e872c9e](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/e872c9efc53319d149cfd9c5f49332e6ee6c5229))
* centralize error handling in the registerTool Proxy ([3dde92e](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/3dde92e3328165ceb4be4ee330b703a97c45cc78))
* filter by hook type and expose name/description ([2d74db0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/2d74db024c710e0cf28090b4ccca53eca5c50f72))
* make curate functions generic ([e69f189](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/e69f189726bc91b047b1b28549254cab11551ee4))
* adopt shared input-param helpers across tools ([61b63fa](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/61b63fa28d7e232f4ff883516aac3a8571ad3d91))
* add fieldsParam helper and adopt it in read tools ([7b62b7d](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/7b62b7d47d7435441635523711059b38249a74b1))
* make formatResponse generic and share named result types ([d058474](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/d05847406b0623707a57ba065fc15f7626af2628))
* unexport fakeResponse from test-utils ([2bc1ba8](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/2bc1ba876c29b85499b18c7aa1370f5e1744c593))

## [0.14.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.14.0...v0.14.1) (2026-09-05)

### Bug Fixes

* authenticate the assets-branch push as the app ([1c5a318](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/1c5a318f1428dd23472e0f46e9d62bfd33cd8cdc))
* land signed release commits through an auto-merged PR ([6e3a4e5](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6e3a4e50e6c92cc2caa1a39da3443d5ad59af210))
## [0.13.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.13.0...v0.13.1) (2026-05-18)


### Bug Fixes

* restore and properly fix E2E tests ([140f503](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/140f503fd437c968f57064c0223d89f0821542cf))

# [0.13.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.12.0...v0.13.0) (2026-05-14)


### Bug Fixes

* handle 404 on empty branch restrictions gracefully ([6f16d03](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6f16d03bbb968bb4ed43f9c0b4c763028128755b))
* relax labels E2E test on unsupported versions ([98749c1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/98749c12eb6bd8f24d58d87dc3d77ec77c23f3e0))
* remove draft PR E2E test (create_pull_request fails via MCP on some versions) ([6ac1fa4](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6ac1fa4912c81858659e3af07b2d695c34a14e6a))
* replace generic types with proper interfaces in default-reviewers and users ([aa35a2b](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/aa35a2b2873c5775aaa2f410a36880961d8dd738))
* update draft PR version note ([816eb23](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/816eb23e327c850af0b565feb0c39b0f3eb5f811))


### Features

* add hooks, merge checks, reviewer groups, secret scanning, user search, SSH, and GPG key tools ([d373ebc](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/d373ebcb19e31aca80767bf6b9b9e00afb6a9f84))
* add list_forks tool ([d4403f1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/d4403f1a34f5cd67390c1365249aa2bf7a3fceac))
* implement Phase 1 tools (forks, labels, webhooks, users, comments, reviewers, restrictions) ([5ca4a69](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/5ca4a6986e88a1463c545b6b2d67ffefc3f71862))
* implement Phase 1 tools with systematic test design ([ac75eb3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/ac75eb317e575faa6f75a113356237549b31baa4))
* implement Phase 2 tools (commit PRs, blame, repo CRUD, draft PR) ([e184621](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/e184621e7a4893dd9774edc6b76662977be445dc))

# [0.12.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.11.1...v0.12.0) (2026-05-07)


### Features

* add opt-in file annotations to get_code_insights ([0c0b72a](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/0c0b72a6a0e5dd6609e315966df5b63e91818822))
* add opt-in file annotations to get_code_insights ([9f56889](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/9f56889654545430cf874caeb531a2c79e90f727))

## [0.11.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.11.0...v0.11.1) (2026-05-06)


### Bug Fixes

* **ci:** revert scorecard-action SHA to dereferenced commit ([c4fa97b](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/c4fa97b10b6f5c046a24b80973d007f54516118b))
* **ci:** scan PR descriptions for issue references in release notifications ([c1c2f32](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/c1c2f32cdcdb760be81491f2d7a6c1123c52cd13))

# [0.11.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.10.1...v0.11.0) (2026-05-06)


### Features

* add edit_file tool for committing file changes via REST API ([c4d4466](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/c4d446612f1fc4e31310fdee26e40130228d9bb0))

## [0.10.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.10.0...v0.10.1) (2026-05-06)

# [0.10.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.9.0...v0.10.0) (2026-05-05)


### Features

* add compare_refs tool ([53b2246](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/53b22468162cd9fb55947f424edc25d2a4195659))
* add get_commit tool ([fb9b624](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/fb9b624a9287c4a99fd11c8ebd3ac7c201130b44))
* add get_tag and delete_tag tools ([4f99bae](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4f99bae7918c7d3e1d6604800478e1b4bb867f6b))
* add list_tags and create_tag tools ([43b963b](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/43b963bc2b8f0710810e210379064c016434e978))
* add manage_branches tool ([cebc0f3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/cebc0f38e6fd191017b9b094c0c0be714e749005))

# [0.9.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.8.4...v0.9.0) (2026-05-04)


### Features

* add opt-in merge vetoes and build summaries to get_pull_request ([b507aa3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/b507aa3c0eb626a0a448dfbad78e1ad8d6fdc507))

## [0.8.4](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.8.3...v0.8.4) (2026-04-30)


### Bug Fixes

* correct rate-limit log message to reflect HTTP layer handles retries ([e9ecc56](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/e9ecc56e27c6a731594777e9d6ebc922b56a422d))
* surface reviewerErrors and validReviewers in Bitbucket error messages ([79c5838](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/79c583883b636b0bfb0fca70d3868cd3079c3b7e))

## [0.8.3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.8.2...v0.8.3) (2026-04-28)


### Bug Fixes

* **deps:** resolve 4 npm audit vulnerabilities in devDependencies ([8677aa5](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/8677aa586c0d642d2346d36f2be077113312c62d))

## [0.8.2](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.8.1...v0.8.2) (2026-04-28)


### Bug Fixes

* **ci:** tolerate empty grep result in release notification script ([a161bad](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/a161bad26da6fc16bafb5c913dd487dc1d6c51a4))

## [0.8.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.8.0...v0.8.1) (2026-04-28)


### Bug Fixes

* API hardening (response validation, rate limit, token redaction, field defaults, update_pr bug) ([94fec39](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/94fec39e1aad554cd5bde08cf1c21ecb7ea04b59))
* **http:** value-based URL redaction and 429 rate-limit warning ([32650f0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/32650f0063bd39be3ce9af9378983e6a201b4b23))
* **response:** include committer fields in DEFAULT_COMMIT_FIELDS ([0f33f80](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/0f33f80f9bf674412b8382f4ff797faf57c252bd))
* **response:** validate paginated API responses with Zod ([1cbc93f](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/1cbc93f06ed48e287aec5b54fa9b71148c102288))
* **tools:** mention fields param in read tool descriptions ([4a99e71](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4a99e71da0b66251b6a04cb8d8bbbbfbfaff9b92))
* **tools:** stop sending author field in update_pull_request PUT body ([81d8306](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/81d83063f1c9452feb6ab58557db0c9cc41e82a3))

# [0.8.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.7.0...v0.8.0) (2026-04-22)


### Bug Fixes

* **e2e:** chown the bind mount to the host uid before stop() ([57749df](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/57749df5cc35f6bba999065912868c90ee17ff84)), closes [#43](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/43)


### Features

* **comments:** expose threadResolved on manage_comment edit ([70d3806](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/70d3806c09183c8cc71030583a3be45fe2b75536))

# [0.7.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.9...v0.7.0) (2026-04-21)


### Bug Fixes

* **errors:** read ky HTTPError.data instead of error.response.data ([3ae8d16](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/3ae8d1608f2da6ba623675858d63450b80c1b48c)), closes [#10433](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/10433)


### Features

* **healthcheck:** optional startup probe with factual failure hints ([c6e9fa0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/c6e9fa0c0ac6832f2cca8d934a9ecb7994c7803a))

## [0.6.9](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.8...v0.6.9) (2026-04-20)


### Bug Fixes

* **ci:** pin slsa-github-generator by tag, not SHA ([11a2b66](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/11a2b66902305dbc877bec101d23c147a77c68cc))

## [0.6.8](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.7...v0.6.8) (2026-04-19)

## [0.6.7](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.6...v0.6.7) (2026-04-17)


### Reverts

* restore semantic-release in devDependencies ([8c6e172](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/8c6e17213383574fcde8e0e4ba8d2348e807033c)), closes [#34](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/34) [#35](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/35) [npm/cli#9194](https://github.com/npm/cli/issues/9194) [npm/cli#9240](https://github.com/npm/cli/issues/9240)

## [0.6.6](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.5...v0.6.6) (2026-04-17)


### Bug Fixes

* **dependabot:** scope .release to direct dependencies only ([163a21c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/163a21c007b0a0c57c9fdc2074d50dbeabe7a5b4)), closes [#35](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/35)

## [0.6.5](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.4...v0.6.5) (2026-04-17)

## [0.6.4](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.3...v0.6.4) (2026-04-17)

## [0.6.3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.2...v0.6.3) (2026-04-17)


### Bug Fixes

* **tests:** restore fc.dictionary in custom-headers property test ([4651f41](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4651f413d742241110af6cb4d117b8b7a7d89ca6))
* **tests:** use fc.dictionary to avoid duplicate keys in property test ([329ebcd](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/329ebcdd352fabd5b83fb6bfc4236e12b863561b))

## [0.6.2](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.1...v0.6.2) (2026-04-17)


### Bug Fixes

* send empty json body on approve to make ky set Content-Type ([fcefe5c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/fcefe5ceae1f13eda6ba65a6352d05b01911d254))

## [0.6.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.6.0...v0.6.1) (2026-04-16)


### Bug Fixes

* curate search response with curateList ([ae8d101](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/ae8d101547a84ce127bd699c885403a8a02eb3f8))
* use POST method for search API ([8749c7c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/8749c7cbb9716f71fbe31a8551ad9a99b730a800))

# [0.6.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.5.0...v0.6.0) (2026-04-15)


### Features

* expose diffType, fileType, and lineType options for inline comments ([4112aa2](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4112aa2b161e002e1122d652c3cd3e7a08ea936c))

# [0.5.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.4.1...v0.5.0) (2026-04-15)


### Features

* add get_server_info tool and update requirements to 8.5+ ([3db9d0c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/3db9d0cc8cad587c12018b2598cc54f61e2e43c1))
* generate API types from official Bitbucket OpenAPI spec ([2afc992](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/2afc992422a3ddb8c128b6501dd9db9e850aef76))

## [0.4.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.4.0...v0.4.1) (2026-04-15)

# [0.4.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.3.0...v0.4.0) (2026-04-14)


### Bug Fixes

* add pagination to get_pr_activity and file-level diff support ([512c265](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/512c265e31210d62555ad6c9f552dffaceed402e))


### Features

* add comment reactions and emoticon search ([bd22333](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/bd22333fa7758a1aa3ab5053334286ee3fb1356a))
* add excludeUsers filter to get_pr_activity ([b27b7d9](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/b27b7d9e5a955237da9b5d1f7f20f53239384b7d))

# [0.3.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.2.1...v0.3.0) (2026-04-14)


### Features

* enforce readOnly and enabledTools config options ([a351592](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/a351592c8b4b5f16b4de579c97060d60fb5eeea0))

## [0.2.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.2.0...v0.2.1) (2026-04-14)

# [0.2.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.6...v0.2.0) (2026-04-13)


### Bug Fixes

* preserve repository info in toRef when updating cross-repo PRs ([4fa3280](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4fa3280a35ea7fae862d654167df026910805344))
* set executable permissions on husky hooks ([6fa99a0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/6fa99a05f55b4a04a00eaadc82fe7d9cb388e3bd))


### Features

* add get_build_status tool for CI build results ([f6a71b7](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/f6a71b7a22ba3c5b56305f33e0a55341804f01eb))
* add stat mode to get_diff for lightweight change summary ([4c7753c](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/4c7753c34fb201763b2980a9de106e5060b6fc22))

## [0.1.6](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.5...v0.1.6) (2026-04-10)


### Bug Fixes

* merge strategy + feat: resolve comments + refactor: prompt ([#15](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/15)) ([2eb0c68](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/2eb0c68a07ad574fad8f76ab948a95c4c9cae4c0))

## [0.1.5](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.4...v0.1.5) (2026-04-10)


### Bug Fixes

* coerce numeric params, add upload_attachment, complete annotations ([#14](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/14)) ([3bf5ed7](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/3bf5ed79e9cef534ad249a124ac95b64c0bebd78))

## [0.1.4](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.3...v0.1.4) (2026-04-08)


### Bug Fixes

* **ci:** concurrency and branch protection for releases ([#13](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/13)) ([82cb833](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/82cb83306f9818c6525f8210b2415f01d6733792))
* **ci:** include all release types in notes + clean CHANGELOG ([#12](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/12)) ([82fd268](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/82fd2688be08ed074f03841de77766c3b089d6c9))
* **ci:** move PR previews to GitHub Packages for full lifecycle control ([#11](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/11)) ([f02304a](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/f02304ab64f879575115d2d985378908d5cfa18e)), closes [npm/cli#8547](https://github.com/npm/cli/issues/8547)

## [0.1.3](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.2...v0.1.3) (2026-04-08)

## [0.1.1](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.1.0...v0.1.1) (2026-04-07)


### Bug Fixes

* tag Docker image with release version instead of commit SHA ([29d3610](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/29d36103ede1011f176d8f4ecfb0e5d3128ca9b6))

# [0.1.0](https://github.com/pavel-kalmykov/bitbucket-server-mcp/compare/v0.0.1...v0.1.0) (2026-04-07)


### Features

* complete MCP server redesign with modular architecture ([#9](https://github.com/pavel-kalmykov/bitbucket-server-mcp/issues/9)) ([9825222](https://github.com/pavel-kalmykov/bitbucket-server-mcp/commit/9825222dcac8dfaecbc3fabae0d89e50ea9d74cd))
