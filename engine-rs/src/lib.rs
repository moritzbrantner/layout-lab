use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::error::Error;
use std::fmt::{Display, Formatter};

pub const CONTRACT_VERSION: &str = "layout-lab/portable-layout-v1";
pub const COORDINATE_SPACE: &str = "css-px";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayoutError(String);

impl LayoutError {
    fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl Display for LayoutError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl Error for LayoutError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LayoutDisplay {
    Block,
    Flex,
    Grid,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FlexDirection {
    Row,
    Column,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FlexContainerStyle {
    pub gap: f64,
    pub direction: FlexDirection,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FlexItemStyle {
    pub basis: f64,
    pub grow: f64,
    pub shrink: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GridTrack {
    pub label: String,
    pub min_size: f64,
    pub fr: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GridContainerStyle {
    pub gap: f64,
    pub columns: Vec<GridTrack>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GridItemStyle {
    pub column_start: usize,
    pub column_span: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_contribution: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutStyle {
    pub display: LayoutDisplay,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_block_before: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub margin_block_after: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flex_container: Option<FlexContainerStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flex_item: Option<FlexItemStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grid_container: Option<GridContainerStyle>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grid_item: Option<GridItemStyle>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutNode {
    pub id: String,
    pub label: String,
    pub style: LayoutStyle,
    pub children: Vec<LayoutNode>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutTreeDocument {
    pub contract_version: String,
    pub kind: String,
    pub coordinate_space: String,
    pub root: LayoutNode,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LayoutBox {
    pub id: String,
    pub label: String,
    pub rect: LayoutRect,
    pub children: Vec<LayoutBox>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GeometryDocument {
    pub contract_version: String,
    pub kind: String,
    pub coordinate_space: String,
    pub root: LayoutBox,
}

fn finite_non_negative(value: Option<f64>) -> bool {
    value.is_none_or(|value| value.is_finite() && value >= 0.0)
}

fn validate_min_max(
    node_id: &str,
    minimum: Option<f64>,
    maximum: Option<f64>,
    axis: &str,
) -> Result<(), LayoutError> {
    if let (Some(minimum), Some(maximum)) = (minimum, maximum)
        && maximum < minimum
    {
        return Err(LayoutError::new(format!(
            "{node_id}: max{axis} must be greater than or equal to min{axis}"
        )));
    }
    Ok(())
}

fn validate_style(node: &LayoutNode) -> Result<(), LayoutError> {
    let id = if node.id.is_empty() {
        "<missing-id>"
    } else {
        &node.id
    };
    let style = &node.style;

    for (name, value) in [
        ("width", style.width),
        ("minWidth", style.min_width),
        ("maxWidth", style.max_width),
        ("height", style.height),
        ("minHeight", style.min_height),
        ("maxHeight", style.max_height),
        ("marginBlockBefore", style.margin_block_before),
        ("marginBlockAfter", style.margin_block_after),
    ] {
        if !finite_non_negative(value) {
            return Err(LayoutError::new(format!(
                "{id}: {name} must be finite and non-negative"
            )));
        }
    }
    validate_min_max(id, style.min_width, style.max_width, "Width")?;
    validate_min_max(id, style.min_height, style.max_height, "Height")?;

    match style.display {
        LayoutDisplay::Flex if style.flex_container.is_none() => {
            return Err(LayoutError::new(format!(
                "{id}: flex containers require flexContainer settings"
            )));
        }
        LayoutDisplay::Flex => {}
        _ if style.flex_container.is_some() => {
            return Err(LayoutError::new(format!(
                "{id}: flexContainer settings require display:flex"
            )));
        }
        _ => {}
    }

    if let Some(container) = &style.flex_container
        && (!container.gap.is_finite() || container.gap < 0.0)
    {
        return Err(LayoutError::new(format!(
            "{id}: flex gap must be finite and non-negative"
        )));
    }

    if let Some(item) = &style.flex_item {
        for (name, value) in [
            ("basis", item.basis),
            ("grow", item.grow),
            ("shrink", item.shrink),
        ] {
            if !value.is_finite() || value < 0.0 {
                return Err(LayoutError::new(format!(
                    "{id}: flex {name} must be finite and non-negative"
                )));
            }
        }
    }

    match style.display {
        LayoutDisplay::Grid if style.grid_container.is_none() => {
            return Err(LayoutError::new(format!(
                "{id}: grid containers require gridContainer settings"
            )));
        }
        LayoutDisplay::Grid => {}
        _ if style.grid_container.is_some() => {
            return Err(LayoutError::new(format!(
                "{id}: gridContainer settings require display:grid"
            )));
        }
        _ => {}
    }

    if let Some(container) = &style.grid_container {
        if !container.gap.is_finite() || container.gap < 0.0 {
            return Err(LayoutError::new(format!(
                "{id}: grid gap must be finite and non-negative"
            )));
        }
        if container.columns.is_empty() {
            return Err(LayoutError::new(format!(
                "{id}: grid containers require at least one column"
            )));
        }
        for (index, track) in container.columns.iter().enumerate() {
            if !track.min_size.is_finite() || track.min_size < 0.0 {
                return Err(LayoutError::new(format!(
                    "{id}: grid column {index} minSize must be finite and non-negative"
                )));
            }
            if !track.fr.is_finite() || track.fr < 0.0 {
                return Err(LayoutError::new(format!(
                    "{id}: grid column {index} fr must be finite and non-negative"
                )));
            }
        }
    }

    if let Some(item) = &style.grid_item {
        if item.column_span < 1 {
            return Err(LayoutError::new(format!(
                "{id}: grid columnSpan must be a positive integer"
            )));
        }
        if !finite_non_negative(item.min_contribution) {
            return Err(LayoutError::new(format!(
                "{id}: grid minContribution must be finite and non-negative"
            )));
        }
    }

    Ok(())
}

fn validate_tree(root: &LayoutNode) -> Result<(), LayoutError> {
    let mut ids = HashSet::new();

    fn visit(node: &LayoutNode, ids: &mut HashSet<String>) -> Result<(), LayoutError> {
        if node.id.trim().is_empty() {
            return Err(LayoutError::new("layout nodes require a non-empty id"));
        }
        if !ids.insert(node.id.clone()) {
            return Err(LayoutError::new(format!(
                "duplicate layout node id: {}",
                node.id
            )));
        }
        if node.label.trim().is_empty() {
            return Err(LayoutError::new(format!(
                "{}: layout nodes require a label",
                node.id
            )));
        }
        validate_style(node)?;
        for child in &node.children {
            visit(child, ids)?;
        }
        Ok(())
    }

    visit(root, &mut ids)
}

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    value.max(minimum).min(maximum)
}

fn resolve_width(node: &LayoutNode, containing_width: f64) -> f64 {
    clamp(
        node.style.width.unwrap_or(containing_width),
        node.style.min_width.unwrap_or(0.0),
        node.style.max_width.unwrap_or(f64::INFINITY),
    )
}

fn resolve_height(node: &LayoutNode, content_height: f64) -> f64 {
    clamp(
        node.style.height.unwrap_or(content_height),
        node.style.min_height.unwrap_or(0.0),
        node.style.max_height.unwrap_or(f64::INFINITY),
    )
}

fn ensure_block_only(node: &LayoutNode) -> Result<(), LayoutError> {
    if node.style.display != LayoutDisplay::Block {
        return Err(LayoutError::new(format!(
            "{}: block baseline supports block display only",
            node.id
        )));
    }
    for child in &node.children {
        ensure_block_only(child)?;
    }
    Ok(())
}

fn layout_block_node(
    node: &LayoutNode,
    containing_width: f64,
    origin_x: f64,
    origin_y: f64,
) -> Result<LayoutBox, LayoutError> {
    let width = resolve_width(node, containing_width);
    let mut children = Vec::with_capacity(node.children.len());
    let mut cursor = 0.0;
    let mut previous_after = 0.0;

    for (index, child) in node.children.iter().enumerate() {
        let before = child.style.margin_block_before.unwrap_or(0.0);
        let gap = if index == 0 {
            before
        } else {
            previous_after.max(before)
        };
        let child_y = cursor + gap;
        let child_box = layout_block_node(child, width, origin_x, origin_y + child_y)?;
        cursor = child_y + child_box.rect.height;
        previous_after = child.style.margin_block_after.unwrap_or(0.0);
        children.push(child_box);
    }

    let content_height = if children.is_empty() {
        0.0
    } else {
        cursor + previous_after
    };

    Ok(LayoutBox {
        id: node.id.clone(),
        label: node.label.clone(),
        rect: LayoutRect {
            x: origin_x,
            y: origin_y,
            width,
            height: resolve_height(node, content_height),
        },
        children,
    })
}

fn layout_block_tree(root: &LayoutNode) -> Result<LayoutBox, LayoutError> {
    ensure_block_only(root)?;
    let root_width = root.style.width.ok_or_else(|| {
        LayoutError::new(format!(
            "{}: block baseline requires an explicit root width",
            root.id
        ))
    })?;
    layout_block_node(root, root_width, 0.0, 0.0)
}

#[derive(Clone, Copy)]
enum FlexMode {
    Grow,
    Shrink,
    None,
}

#[derive(Clone, Copy)]
struct FlexInput {
    basis: f64,
    grow: f64,
    shrink: f64,
    minimum: f64,
    maximum: f64,
}

fn resolve_flex_targets(root: &LayoutNode, inner_size: f64, gap: f64) -> Vec<f64> {
    let items: Vec<FlexInput> = root
        .children
        .iter()
        .map(|child| {
            let item = child.style.flex_item.as_ref().expect("validated flex item");
            let minimum = child.style.min_width.unwrap_or(0.0).max(0.0);
            let maximum = child
                .style
                .max_width
                .unwrap_or(f64::INFINITY)
                .max(minimum);
            FlexInput {
                basis: item.basis.max(0.0),
                grow: item.grow.max(0.0),
                shrink: item.shrink.max(0.0),
                minimum,
                maximum,
            }
        })
        .collect();

    let total_gap = items.len().saturating_sub(1) as f64 * gap;
    let total_basis: f64 = items.iter().map(|item| item.basis).sum();
    let free_space = inner_size - total_basis - total_gap;
    let grow_sum: f64 = items.iter().map(|item| item.grow).sum();
    let shrink_sum: f64 = items.iter().map(|item| item.shrink * item.basis).sum();
    let mode = if free_space > 0.0 && grow_sum > 0.0 {
        FlexMode::Grow
    } else if free_space < 0.0 && shrink_sum > 0.0 {
        FlexMode::Shrink
    } else {
        FlexMode::None
    };

    let mut targets: Vec<f64> = items.iter().map(|item| item.basis).collect();
    let mut frozen = vec![false; items.len()];

    if matches!(mode, FlexMode::None) {
        for (index, item) in items.iter().enumerate() {
            let target = clamp(item.basis, item.minimum, item.maximum);
            targets[index] = target;
            frozen[index] = target != item.basis;
        }
        return targets;
    }

    for _ in 1..=items.len() + 1 {
        let mut active = Vec::new();
        let mut frozen_total = 0.0;
        let mut active_basis = 0.0;
        let mut factor_sum = 0.0;

        for (index, item) in items.iter().enumerate() {
            if frozen[index] {
                frozen_total += targets[index];
                continue;
            }
            active.push(index);
            active_basis += item.basis;
            factor_sum += match mode {
                FlexMode::Grow => item.grow,
                FlexMode::Shrink => item.shrink * item.basis,
                FlexMode::None => 0.0,
            };
        }

        if active.is_empty() || factor_sum <= 0.0 {
            break;
        }

        let iteration_free_space = inner_size - total_gap - frozen_total - active_basis;
        let mut candidates = Vec::with_capacity(active.len());
        let mut has_clamp = false;

        for &index in &active {
            let item = items[index];
            let weight = match mode {
                FlexMode::Grow => item.grow,
                FlexMode::Shrink => item.shrink * item.basis,
                FlexMode::None => 0.0,
            };
            let raw = item.basis + iteration_free_space * (weight / factor_sum);
            let clamped = clamp(raw, item.minimum, item.maximum);
            let did_clamp = raw < item.minimum || raw > item.maximum;
            has_clamp |= did_clamp;
            candidates.push((index, raw, clamped, did_clamp));
        }

        if !has_clamp {
            for (index, raw, _, _) in candidates {
                targets[index] = raw;
            }
            break;
        }

        for (index, _, clamped, did_clamp) in candidates {
            if did_clamp {
                targets[index] = clamped;
                frozen[index] = true;
            }
        }
    }

    targets
}

fn layout_flex_tree(root: &LayoutNode) -> Result<LayoutBox, LayoutError> {
    let container = root.style.flex_container.as_ref().ok_or_else(|| {
        LayoutError::new(format!("{}: flex adapter requires a flex container root", root.id))
    })?;
    if root.style.display != LayoutDisplay::Flex {
        return Err(LayoutError::new(format!(
            "{}: flex adapter requires a flex container root",
            root.id
        )));
    }
    if container.direction != FlexDirection::Row {
        return Err(LayoutError::new(format!(
            "{}: current flex resolver adapter supports row direction only",
            root.id
        )));
    }
    let inner_size = root.style.width.ok_or_else(|| {
        LayoutError::new(format!(
            "{}: current numeric resolver adapter requires an explicit finite container width",
            root.id
        ))
    })?;

    for child in &root.children {
        if child.style.display != LayoutDisplay::Block {
            return Err(LayoutError::new(format!(
                "{}: flex baseline supports block leaf items only",
                child.id
            )));
        }
        if !child.children.is_empty() {
            return Err(LayoutError::new(format!(
                "{}: flex baseline does not yet lay out nested item contents",
                child.id
            )));
        }
        if child.style.flex_item.is_none() {
            return Err(LayoutError::new(format!(
                "{}: flex children require flexItem settings",
                child.id
            )));
        }
    }

    let gap = container.gap.max(0.0);
    let targets = resolve_flex_targets(root, inner_size.max(0.0), gap);
    let mut cursor = 0.0;
    let mut children = Vec::with_capacity(root.children.len());

    for (index, child) in root.children.iter().enumerate() {
        let width = targets[index];
        children.push(LayoutBox {
            id: child.id.clone(),
            label: child.label.clone(),
            rect: LayoutRect {
                x: cursor,
                y: 0.0,
                width,
                height: resolve_height(child, 0.0),
            },
            children: Vec::new(),
        });
        cursor += width + gap;
    }

    let content_height = children
        .iter()
        .map(|child| child.rect.height)
        .fold(0.0_f64, f64::max);

    Ok(LayoutBox {
        id: root.id.clone(),
        label: root.label.clone(),
        rect: LayoutRect {
            x: 0.0,
            y: 0.0,
            width: inner_size.max(0.0),
            height: resolve_height(root, content_height),
        },
        children,
    })
}

#[derive(Clone)]
struct GridContribution {
    start: usize,
    span: usize,
    min_size: f64,
}

fn resolve_grid_tracks(
    inner_size: f64,
    gap: f64,
    tracks: &[GridTrack],
    mut contributions: Vec<GridContribution>,
) -> Vec<f64> {
    let total_gap = tracks.len().saturating_sub(1) as f64 * gap;
    let available = (inner_size - total_gap).max(0.0);
    let mut base_sizes: Vec<f64> = tracks.iter().map(|track| track.min_size.max(0.0)).collect();

    contributions.sort_by_key(|contribution| (contribution.span, contribution.start));
    for contribution in contributions {
        let internal_gap = contribution.span.saturating_sub(1) as f64 * gap;
        let required_track_size = (contribution.min_size - internal_gap).max(0.0);
        let current: f64 = base_sizes[contribution.start..contribution.start + contribution.span]
            .iter()
            .sum();
        let deficit = (required_track_size - current).max(0.0);
        let share = deficit / contribution.span as f64;
        for size in &mut base_sizes[contribution.start..contribution.start + contribution.span] {
            *size += share;
        }
    }

    let mut targets = base_sizes.clone();
    let mut frozen: Vec<bool> = tracks.iter().map(|track| track.fr <= 0.0).collect();

    for _ in 0..=tracks.len() {
        let mut active = Vec::new();
        let mut fixed_size = 0.0;
        let mut factor_sum = 0.0;

        for (index, track) in tracks.iter().enumerate() {
            if frozen[index] {
                fixed_size += targets[index];
                continue;
            }
            if track.fr <= 0.0 {
                continue;
            }
            active.push(index);
            factor_sum += track.fr;
        }

        if active.is_empty() {
            break;
        }

        let flex_fraction = if factor_sum > 0.0 {
            ((available - fixed_size) / factor_sum).max(0.0)
        } else {
            0.0
        };

        let undersized: Vec<usize> = active
            .iter()
            .copied()
            .filter(|&index| flex_fraction * tracks[index].fr < base_sizes[index])
            .collect();

        if undersized.is_empty() {
            for index in active {
                targets[index] = flex_fraction * tracks[index].fr;
            }
            break;
        }

        for index in undersized {
            targets[index] = base_sizes[index];
            frozen[index] = true;
        }
    }

    targets
}

fn layout_grid_tree(root: &LayoutNode) -> Result<LayoutBox, LayoutError> {
    let container = root.style.grid_container.as_ref().ok_or_else(|| {
        LayoutError::new(format!("{}: grid adapter requires a grid container root", root.id))
    })?;
    if root.style.display != LayoutDisplay::Grid {
        return Err(LayoutError::new(format!(
            "{}: grid adapter requires a grid container root",
            root.id
        )));
    }
    let inner_size = root.style.width.ok_or_else(|| {
        LayoutError::new(format!(
            "{}: current numeric resolver adapter requires an explicit finite container width",
            root.id
        ))
    })?;
    let track_count = container.columns.len();

    let mut contributions = Vec::new();
    for child in &root.children {
        if child.style.display != LayoutDisplay::Block {
            return Err(LayoutError::new(format!(
                "{}: grid baseline supports block leaf items only",
                child.id
            )));
        }
        if !child.children.is_empty() {
            return Err(LayoutError::new(format!(
                "{}: grid baseline does not yet lay out nested item contents",
                child.id
            )));
        }
        let item = child.style.grid_item.as_ref().ok_or_else(|| {
            LayoutError::new(format!(
                "{}: grid baseline requires explicit column placement",
                child.id
            ))
        })?;
        let end = item
            .column_start
            .checked_add(item.column_span)
            .ok_or_else(|| LayoutError::new(format!(
                "{}: grid placement exceeds the explicit column set",
                child.id
            )))?;
        if end > track_count {
            return Err(LayoutError::new(format!(
                "{}: grid placement exceeds the explicit column set",
                child.id
            )));
        }
        if let Some(min_size) = item.min_contribution {
            contributions.push(GridContribution {
                start: item.column_start,
                span: item.column_span,
                min_size,
            });
        }
    }

    let gap = container.gap.max(0.0);
    let targets = resolve_grid_tracks(
        inner_size.max(0.0),
        gap,
        &container.columns,
        contributions,
    );

    let mut track_starts = Vec::with_capacity(targets.len());
    let mut cursor = 0.0;
    for target in &targets {
        track_starts.push(cursor);
        cursor += target + gap;
    }

    let mut children = Vec::with_capacity(root.children.len());
    for child in &root.children {
        let item = child.style.grid_item.as_ref().expect("validated grid item");
        let end = item.column_start + item.column_span;
        let width = targets[item.column_start..end].iter().sum::<f64>()
            + item.column_span.saturating_sub(1) as f64 * gap;
        children.push(LayoutBox {
            id: child.id.clone(),
            label: child.label.clone(),
            rect: LayoutRect {
                x: track_starts[item.column_start],
                y: 0.0,
                width,
                height: resolve_height(child, 0.0),
            },
            children: Vec::new(),
        });
    }

    let content_height = children
        .iter()
        .map(|child| child.rect.height)
        .fold(0.0_f64, f64::max);

    Ok(LayoutBox {
        id: root.id.clone(),
        label: root.label.clone(),
        rect: LayoutRect {
            x: 0.0,
            y: 0.0,
            width: inner_size.max(0.0),
            height: resolve_height(root, content_height),
        },
        children,
    })
}

pub fn layout_document(document: &LayoutTreeDocument) -> Result<GeometryDocument, LayoutError> {
    if document.contract_version != CONTRACT_VERSION {
        return Err(LayoutError::new(format!(
            "unsupported layout contract version: {}",
            document.contract_version
        )));
    }
    if document.kind != "layout-tree" {
        return Err(LayoutError::new(format!(
            "expected layout-tree document, got {}",
            document.kind
        )));
    }
    if document.coordinate_space != COORDINATE_SPACE {
        return Err(LayoutError::new(format!(
            "unsupported coordinate space: {}",
            document.coordinate_space
        )));
    }

    validate_tree(&document.root)?;

    let root = match document.root.style.display {
        LayoutDisplay::Block => layout_block_tree(&document.root)?,
        LayoutDisplay::Flex => layout_flex_tree(&document.root)?,
        LayoutDisplay::Grid => layout_grid_tree(&document.root)?,
    };

    Ok(GeometryDocument {
        contract_version: CONTRACT_VERSION.to_owned(),
        kind: "geometry".to_owned(),
        coordinate_space: COORDINATE_SPACE.to_owned(),
        root,
    })
}
