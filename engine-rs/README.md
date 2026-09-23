# Rust layout core

This crate is the H11 portability implementation of Layout Lab's established H5 block, Flexbox, and Grid subset.

It consumes the versioned language-neutral documents in `../contracts` and is tested against the same block, Flex, and Grid fixtures as the TypeScript reference implementation.

## Authority

This crate is **not yet the production authority**. TypeScript remains authoritative until the later H11 gates are complete: shared edge-case conformance, WASM adapter integration, browser differential verification, and an explicit single-authority handoff.

## Validation

```sh
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
cargo fmt --check
```

Rust is pinned by `rust-toolchain.toml`, and the dependency graph is pinned by `Cargo.lock`.
