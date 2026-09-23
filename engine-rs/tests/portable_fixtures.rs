use layout_lab_core::{GeometryDocument, LayoutTreeDocument, layout_document};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

fn fixture_path(name: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("contracts")
        .join("fixtures")
        .join(name)
}

fn read_tree(name: &str) -> LayoutTreeDocument {
    serde_json::from_str(&fs::read_to_string(fixture_path(name)).expect("read layout fixture"))
        .expect("parse layout fixture")
}

fn read_geometry(name: &str) -> GeometryDocument {
    serde_json::from_str(&fs::read_to_string(fixture_path(name)).expect("read geometry fixture"))
        .expect("parse geometry fixture")
}

fn assert_json_close(actual: &Value, expected: &Value, path: &str) {
    match (actual, expected) {
        (Value::Number(actual), Value::Number(expected)) => {
            let actual = actual.as_f64().expect("actual number");
            let expected = expected.as_f64().expect("expected number");
            let tolerance = 1e-9_f64.max(expected.abs() * 1e-12);
            assert!(
                (actual - expected).abs() <= tolerance,
                "{path}: expected {expected}, got {actual}"
            );
        }
        (Value::Array(actual), Value::Array(expected)) => {
            assert_eq!(actual.len(), expected.len(), "{path}: array length differs");
            for (index, (actual, expected)) in actual.iter().zip(expected).enumerate() {
                assert_json_close(actual, expected, &format!("{path}[{index}]"));
            }
        }
        (Value::Object(actual), Value::Object(expected)) => {
            assert_eq!(
                actual.keys().collect::<Vec<_>>(),
                expected.keys().collect::<Vec<_>>(),
                "{path}: object keys differ"
            );
            for (key, expected) in expected {
                assert_json_close(&actual[key], expected, &format!("{path}.{key}"));
            }
        }
        _ => assert_eq!(actual, expected, "{path}: value differs"),
    }
}

fn assert_fixture(layout_name: &str, geometry_name: &str) {
    let input = read_tree(layout_name);
    let expected = read_geometry(geometry_name);
    let actual = layout_document(&input).expect("layout succeeds");

    assert_json_close(
        &serde_json::to_value(actual).expect("serialize actual geometry"),
        &serde_json::to_value(expected).expect("serialize expected geometry"),
        "$",
    );
}

#[test]
fn block_baseline_matches_typescript_fixture() {
    assert_fixture("block-baseline.layout.json", "block-baseline.geometry.json");
}

#[test]
fn flex_baseline_matches_typescript_fixture() {
    assert_fixture("flex-baseline.layout.json", "flex-baseline.geometry.json");
}

#[test]
fn grid_baseline_matches_typescript_fixture() {
    assert_fixture("grid-baseline.layout.json", "grid-baseline.geometry.json");
}

#[test]
fn rejects_a_contract_version_it_does_not_implement() {
    let mut input = read_tree("flex-baseline.layout.json");
    input.contract_version = "layout-lab/portable-layout-v2".to_owned();

    let error = layout_document(&input).expect_err("unknown contract must fail");
    assert!(
        error
            .to_string()
            .contains("unsupported layout contract version"),
        "{error}"
    );
}
