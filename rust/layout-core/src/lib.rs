use std::collections::HashSet;

pub const CONTRACT_VERSION: &str = "layout-core-v1";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Display {
    Block,
    Flex,
    Grid,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FlexDirection {
    Row,
    Column,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FlexContainerStyle {
    pub gap: f64,
    pub direction: FlexDirection,
}

#[derive(Clone, Debug, PartialEq)]
pub struct FlexItemStyle {
    pub basis: f64,
    pub grow: f64,
    pub shrink: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GridTrack {
    pub label: String,
    pub min_size: f64,
    pub fr: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GridContainerStyle {
    pub gap: f64,
    pub columns: Vec<GridTrack>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GridItemStyle {
    pub column_start: usize,
    pub column_span: usize,
    pub min_contribution: Option<f64>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct LayoutStyle {
    pub display: Display,
    pub width: Option<f64>,
    pub min_width: Option<f64>,
    pub max_width: Option<f64>,
    pub height: Option<f64>,
    pub min_height: Option<f64>,
    pub max_height: Option<f64>,
    pub margin_block_before: Option<f64>,
    pub margin_block_after: Option<f64>,
    pub flex_container: Option<FlexContainerStyle>,
    pub flex_item: Option<FlexItemStyle>,
    pub grid_container: Option<GridContainerStyle>,
    pub grid_item: Option<GridItemStyle>,
}

impl Default for LayoutStyle {
    fn default() -> Self {
        Self {
            display: Display::Block,
            width: None,
            min_width: None,
            max_width: None,
            height: None,
            min_height: None,
            max_height: None,
            margin_block_before: None,
            margin_block_after: None,
            flex_container: None,
            flex_item: None,
            grid_container: None,
            grid_item: None,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct LayoutNode {
    pub id: String,
    pub label: String,
    pub style: LayoutStyle,
    pub children: Vec<LayoutNode>,
}

impl LayoutNode {
    pub fn new(id: &str, label: &str, style: LayoutStyle, children: Vec<LayoutNode>) -> Self {
        Self {
            id: id.to_string(),
            label: label.to_string(),
            style,
            children,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Geometry {
    pub id: String,
    pub rect: Rect,
}

impl Geometry {
    pub fn new(id: &str, x: f64, y: f64, width: f64, height: f64) -> Self {
        Self {
            id: id.to_string(),
            rect: Rect { x, y, width, height },
        }
    }
}

#[derive(Clone, Debug)]
struct LayoutBox {
    id: String,
    rect: Rect,
    children: Vec<LayoutBox>,
}

fn clamp(value: f64, minimum: f64, maximum: f64) -> f64 {
    value.max(minimum).min(maximum)
}

fn minimum(value: Option<f64>) -> f64 {
    value.unwrap_or(0.0)
}

fn maximum(value: Option<f64>, minimum: f64) -> f64 {
    value.unwrap_or(f64::INFINITY).max(minimum)
}

fn resolve_width(node: &LayoutNode, containing_width: f64) -> f64 {
    let minimum = minimum(node.style.min_width);
    let maximum = maximum(node.style.max_width, minimum);
    clamp(node.style.width.unwrap_or(containing_width), minimum, maximum)
}

fn resolve_height(node: &LayoutNode, content_height: f64) -> f64 {
    let minimum = minimum(node.style.min_height);
    let maximum = maximum(node.style.max_height, minimum);
    clamp(node.style.height.unwrap_or(content_height), minimum, maximum)
}

fn flatten_box(layout_box: &LayoutBox, output: &mut Vec<Geometry>) {
    output.push(Geometry {
        id: layout_box.id.clone(),
        rect: layout_box.rect,
    });
    for child in &layout_box.children {
        flatten_box(child, output);
    }
}

fn finite_non_negative(value: Option<f64>) -> bool {
    value.is_none_or(|number| number.is_finite() && number >= 0.0)
}

fn validate_style(node: &LayoutNode) -> Result<(), String> {
    let style = &node.style;
    for (name, value) in [
        ("width", style.width),
        ("min_width", style.min_width),
        ("max_width", style.max_width),
        ("height", style.height),
        ("min_height", style.min_height),
        ("max_height", style.max_height),
        ("margin_block_before", style.margin_block_before),
        ("margin_block_after", style.margin_block_after),
    ] {
        if !finite_non_negative(value) {
            return Err(format!("{}: {name} must be finite and non-negative", node.id));
        }
    }
    if let (Some(min), Some(max)) = (style.min_width, style.max_width)
        && max < min
    {
        return Err(format!("{}: max_width must be >= min_width", node.id));
    }
    if let (Some(min), Some(max)) = (style.min_height, style.max_height)
        && max < min
    {
        return Err(format!("{}: max_height must be >= min_height", node.id));
    }

    match style.display {
        Display::Flex => {
            let container = style
                .flex_container
                .as_ref()
                .ok_or_else(|| format!("{}: flex container settings are required", node.id))?;
            if !container.gap.is_finite() || container.gap < 0.0 {
                return Err(format!("{}: flex gap must be finite and non-negative", node.id));
            }
        }
        _ if style.flex_container.is_some() => {
            return Err(format!("{}: flex container settings require display flex", node.id));
        }
        _ => {}
    }

    if let Some(item) = &style.flex_item {
        if !item.basis.is_finite()
            || !item.grow.is_finite()
            || !item.shrink.is_finite()
            || item.basis < 0.0
            || item.grow < 0.0
            || item.shrink < 0.0
        {
            return Err(format!("{}: flex item values must be finite and non-negative", node.id));
        }
    }

    match style.display {
        Display::Grid => {
            let container = style
                .grid_container
                .as_ref()
                .ok_or_else(|| format!("{}: grid container settings are required", node.id))?;
            if container.columns.is_empty() {
                return Err(format!("{}: grid requires at least one column", node.id));
            }
            if !container.gap.is_finite() || container.gap < 0.0 {
                return Err(format!("{}: grid gap must be finite and non-negative", node.id));
            }
            for track in &container.columns {
                if !track.min_size.is_finite()
                    || !track.fr.is_finite()
                    || track.min_size < 0.0
                    || track.fr < 0.0
                {
                    return Err(format!("{}: grid track values must be finite and non-negative", node.id));
                }
            }
        }
        _ if style.grid_container.is_some() => {
            return Err(format!("{}: grid container settings require display grid", node.id));
        }
        _ => {}
    }

    if let Some(item) = &style.grid_item {
        if item.column_span == 0 {
            return Err(format!("{}: grid column_span must be positive", node.id));
        }
        if !finite_non_negative(item.min_contribution) {
            return Err(format!("{}: grid min contribution must be finite and non-negative", node.id));
        }
    }

    Ok(())
}

pub fn validate_tree(root: &LayoutNode) -> Result<(), String> {
    let mut ids = HashSet::new();
    fn visit(node: &LayoutNode, ids: &mut HashSet<String>) -> Result<(), String> {
        if node.id.trim().is_empty() {
            return Err("layout nodes require a non-empty id".to_string());
        }
        if node.label.trim().is_empty() {
            return Err(format!("{}: layout nodes require a label", node.id));
        }
        if !ids.insert(node.id.clone()) {
            return Err(format!("duplicate layout node id: {}", node.id));
        }
        validate_style(node)?;
        for child in &node.children {
            visit(child, ids)?;
        }
        Ok(())
    }
    visit(root, &mut ids)
}

fn layout_block_box(
    node: &LayoutNode,
    containing_width: f64,
    origin_x: f64,
    origin_y: f64,
) -> Result<LayoutBox, String> {
    if node.style.display != Display::Block {
        return Err(format!("{}: block baseline supports block display only", node.id));
    }
    let width = resolve_width(node, containing_width);
    let mut children = Vec::with_capacity(node.children.len());
    let mut cursor = 0.0;
    let mut previous_after = 0.0;

    for (index, child) in node.children.iter().enumerate() {
        let before = child.style.margin_block_before.unwrap_or(0.0);
        let gap = if index == 0 { before } else { previous_after.max(before) };
        let child_y = cursor + gap;
        let child_box = layout_block_box(child, width, origin_x, origin_y + child_y)?;
        cursor = child_y + child_box.rect.height;
        previous_after = child.style.margin_block_after.unwrap_or(0.0);
        children.push(child_box);
    }

    let content_height = if node.children.is_empty() {
        0.0
    } else {
        cursor + previous_after
    };
    let height = resolve_height(node, content_height);
    Ok(LayoutBox {
        id: node.id.clone(),
        rect: Rect {
            x: origin_x,
            y: origin_y,
            width,
            height,
        },
        children,
    })
}

fn layout_block(root: &LayoutNode) -> Result<Vec<Geometry>, String> {
    let width = root
        .style
        .width
        .ok_or_else(|| format!("{}: block baseline requires an explicit root width", root.id))?;
    let root_box = layout_block_box(root, width, 0.0, 0.0)?;
    let mut geometry = Vec::new();
    flatten_box(&root_box, &mut geometry);
    Ok(geometry)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FlexMode {
    Grow,
    Shrink,
    None,
}

fn resolve_flex_sizes(root: &LayoutNode) -> Result<Vec<f64>, String> {
    let inner_size = root
        .style
        .width
        .ok_or_else(|| format!("{}: flex requires an explicit root width", root.id))?;
    let container = root
        .style
        .flex_container
        .as_ref()
        .ok_or_else(|| format!("{}: flex container settings are required", root.id))?;
    if container.direction != FlexDirection::Row {
        return Err(format!("{}: portable flex supports row direction only", root.id));
    }
    let gap = container.gap;

    struct Item {
        basis: f64,
        grow: f64,
        shrink: f64,
        minimum: f64,
        maximum: f64,
    }

    let mut items = Vec::with_capacity(root.children.len());
    for child in &root.children {
        if child.style.display != Display::Block || !child.children.is_empty() {
            return Err(format!("{}: portable flex supports block leaf items only", child.id));
        }
        let item = child
            .style
            .flex_item
            .as_ref()
            .ok_or_else(|| format!("{}: flex item settings are required", child.id))?;
        let minimum = minimum(child.style.min_width);
        let maximum = maximum(child.style.max_width, minimum);
        items.push(Item {
            basis: item.basis.max(0.0),
            grow: item.grow.max(0.0),
            shrink: item.shrink.max(0.0),
            minimum,
            maximum,
        });
    }

    let total_gap = root.children.len().saturating_sub(1) as f64 * gap;
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

    let mut target_sizes: Vec<f64> = items.iter().map(|item| item.basis).collect();
    let mut frozen = vec![false; items.len()];

    if mode == FlexMode::None {
        for (index, item) in items.iter().enumerate() {
            target_sizes[index] = clamp(item.basis, item.minimum, item.maximum);
        }
        return Ok(target_sizes);
    }

    for _ in 0..=items.len() {
        let active: Vec<usize> = (0..items.len()).filter(|index| !frozen[*index]).collect();
        if active.is_empty() {
            break;
        }
        let frozen_total: f64 = (0..items.len())
            .filter(|index| frozen[*index])
            .map(|index| target_sizes[index])
            .sum();
        let active_basis: f64 = active.iter().map(|index| items[*index].basis).sum();
        let iteration_free_space = inner_size - total_gap - frozen_total - active_basis;
        let factor_sum: f64 = active
            .iter()
            .map(|index| match mode {
                FlexMode::Grow => items[*index].grow,
                FlexMode::Shrink => items[*index].shrink * items[*index].basis,
                FlexMode::None => 0.0,
            })
            .sum();
        if factor_sum <= 0.0 {
            break;
        }

        let mut proposed = Vec::with_capacity(active.len());
        let mut newly_frozen = false;
        for index in &active {
            let item = &items[*index];
            let weight = match mode {
                FlexMode::Grow => item.grow,
                FlexMode::Shrink => item.shrink * item.basis,
                FlexMode::None => 0.0,
            };
            let raw = item.basis + iteration_free_space * (weight / factor_sum);
            let clamped = clamp(raw, item.minimum, item.maximum);
            let constrained = clamped != raw;
            if constrained {
                newly_frozen = true;
            }
            proposed.push((*index, raw, clamped, constrained));
        }

        if !newly_frozen {
            for (index, raw, _, _) in proposed {
                target_sizes[index] = raw;
            }
            break;
        }

        for (index, _, clamped, constrained) in proposed {
            if constrained {
                target_sizes[index] = clamped;
                frozen[index] = true;
            }
        }
    }

    Ok(target_sizes)
}

fn layout_flex(root: &LayoutNode) -> Result<Vec<Geometry>, String> {
    let inner_size = root.style.width.ok_or_else(|| format!("{}: flex requires width", root.id))?;
    let gap = root.style.flex_container.as_ref().ok_or_else(|| format!("{}: missing flex settings", root.id))?.gap;
    let sizes = resolve_flex_sizes(root)?;
    let mut children = Vec::with_capacity(root.children.len());
    let mut cursor = 0.0;
    for (index, child) in root.children.iter().enumerate() {
        let width = sizes[index];
        let height = resolve_height(child, 0.0);
        children.push(LayoutBox {
            id: child.id.clone(),
            rect: Rect { x: cursor, y: 0.0, width, height },
            children: Vec::new(),
        });
        cursor += width + gap;
    }
    let derived_height = children.iter().fold(0.0_f64, |maximum, child| maximum.max(child.rect.height));
    let root_height = resolve_height(root, derived_height);
    let root_box = LayoutBox {
        id: root.id.clone(),
        rect: Rect { x: 0.0, y: 0.0, width: inner_size, height: root_height },
        children,
    };
    let mut geometry = Vec::new();
    flatten_box(&root_box, &mut geometry);
    Ok(geometry)
}

#[derive(Clone, Debug)]
struct GridResolution {
    target_sizes: Vec<f64>,
    starts: Vec<f64>,
}

fn resolve_grid(root: &LayoutNode) -> Result<GridResolution, String> {
    let inner_size = root.style.width.ok_or_else(|| format!("{}: grid requires width", root.id))?;
    let container = root.style.grid_container.as_ref().ok_or_else(|| format!("{}: missing grid settings", root.id))?;
    let gap = container.gap;
    let track_count = container.columns.len();
    let total_gap = track_count.saturating_sub(1) as f64 * gap;
    let available = (inner_size - total_gap).max(0.0);
    let mut base_sizes: Vec<f64> = container.columns.iter().map(|track| track.min_size.max(0.0)).collect();

    let mut contributions = Vec::new();
    for child in &root.children {
        if let Some(item) = &child.style.grid_item
            && let Some(min_contribution) = item.min_contribution
        {
            contributions.push((item.column_start, item.column_span, min_contribution.max(0.0)));
        }
    }
    contributions.sort_by_key(|(start, span, _)| (*span, *start));
    for (start, requested_span, min_contribution) in contributions {
        if start >= track_count {
            continue;
        }
        let span = requested_span.max(1).min(track_count - start);
        let internal_gap = span.saturating_sub(1) as f64 * gap;
        let required_track_size = (min_contribution - internal_gap).max(0.0);
        let current: f64 = base_sizes[start..start + span].iter().sum();
        let deficit = (required_track_size - current).max(0.0);
        let share = deficit / span as f64;
        for size in &mut base_sizes[start..start + span] {
            *size += share;
        }
    }

    let mut target_sizes = base_sizes.clone();
    let mut frozen: Vec<bool> = container.columns.iter().map(|track| track.fr <= 0.0).collect();
    for _ in 0..=track_count {
        let active: Vec<usize> = (0..track_count)
            .filter(|index| !frozen[*index] && container.columns[*index].fr > 0.0)
            .collect();
        if active.is_empty() {
            break;
        }
        let fixed_size: f64 = (0..track_count)
            .filter(|index| frozen[*index])
            .map(|index| target_sizes[index])
            .sum();
        let factor_sum: f64 = active.iter().map(|index| container.columns[*index].fr).sum();
        let flex_fraction = if factor_sum > 0.0 {
            ((available - fixed_size) / factor_sum).max(0.0)
        } else {
            0.0
        };
        let undersized: Vec<usize> = active
            .iter()
            .copied()
            .filter(|index| flex_fraction * container.columns[*index].fr < base_sizes[*index])
            .collect();
        if undersized.is_empty() {
            for index in active {
                target_sizes[index] = flex_fraction * container.columns[index].fr;
            }
            break;
        }
        for index in undersized {
            target_sizes[index] = base_sizes[index];
            frozen[index] = true;
        }
    }

    let mut starts = Vec::with_capacity(track_count);
    let mut cursor = 0.0;
    for size in &target_sizes {
        starts.push(cursor);
        cursor += *size + gap;
    }
    Ok(GridResolution { target_sizes, starts })
}

fn layout_grid(root: &LayoutNode) -> Result<Vec<Geometry>, String> {
    let inner_size = root.style.width.ok_or_else(|| format!("{}: grid requires width", root.id))?;
    let container = root.style.grid_container.as_ref().ok_or_else(|| format!("{}: missing grid settings", root.id))?;
    let resolution = resolve_grid(root)?;
    let mut children = Vec::with_capacity(root.children.len());

    for child in &root.children {
        if child.style.display != Display::Block || !child.children.is_empty() {
            return Err(format!("{}: portable grid supports block leaf items only", child.id));
        }
        let item = child.style.grid_item.as_ref().ok_or_else(|| format!("{}: grid placement required", child.id))?;
        let end = item.column_start + item.column_span;
        if end > resolution.target_sizes.len() {
            return Err(format!("{}: grid placement exceeds explicit columns", child.id));
        }
        let width: f64 = resolution.target_sizes[item.column_start..end].iter().sum::<f64>()
            + item.column_span.saturating_sub(1) as f64 * container.gap;
        let height = resolve_height(child, 0.0);
        children.push(LayoutBox {
            id: child.id.clone(),
            rect: Rect {
                x: resolution.starts[item.column_start],
                y: 0.0,
                width,
                height,
            },
            children: Vec::new(),
        });
    }

    let derived_height = children.iter().fold(0.0_f64, |maximum, child| maximum.max(child.rect.height));
    let root_height = resolve_height(root, derived_height);
    let root_box = LayoutBox {
        id: root.id.clone(),
        rect: Rect { x: 0.0, y: 0.0, width: inner_size, height: root_height },
        children,
    };
    let mut geometry = Vec::new();
    flatten_box(&root_box, &mut geometry);
    Ok(geometry)
}

pub fn layout(root: &LayoutNode) -> Result<Vec<Geometry>, String> {
    validate_tree(root)?;
    match root.style.display {
        Display::Block => layout_block(root),
        Display::Flex => layout_flex(root),
        Display::Grid => layout_grid(root),
    }
}

pub fn compare_geometry(actual: &[Geometry], expected: &[Geometry], tolerance: f64) -> Vec<String> {
    if !tolerance.is_finite() || tolerance < 0.0 {
        return vec!["geometry tolerance must be finite and non-negative".to_string()];
    }
    let mut errors = Vec::new();
    let mut ids: Vec<&str> = actual.iter().map(|geometry| geometry.id.as_str()).collect();
    ids.extend(expected.iter().map(|geometry| geometry.id.as_str()));
    ids.sort_unstable();
    ids.dedup();
    for id in ids {
        let actual_geometry = actual.iter().find(|geometry| geometry.id == id);
        let expected_geometry = expected.iter().find(|geometry| geometry.id == id);
        let (Some(actual_geometry), Some(expected_geometry)) = (actual_geometry, expected_geometry) else {
            errors.push(format!("{id}: geometry missing"));
            continue;
        };
        for (field, actual_value, expected_value) in [
            ("x", actual_geometry.rect.x, expected_geometry.rect.x),
            ("y", actual_geometry.rect.y, expected_geometry.rect.y),
            ("width", actual_geometry.rect.width, expected_geometry.rect.width),
            ("height", actual_geometry.rect.height, expected_geometry.rect.height),
        ] {
            let delta = (actual_value - expected_value).abs();
            if delta > tolerance {
                errors.push(format!("{id}.{field}: delta {delta} exceeds {tolerance}"));
            }
        }
    }
    errors
}
