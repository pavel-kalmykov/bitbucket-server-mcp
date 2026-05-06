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
