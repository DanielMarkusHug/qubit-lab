# Version 9 Excel Format Additions

Version 9 keeps the Version 8 workbook format and adds optional exact
type-budget constraints.

## Assets Sheet

The following columns are optional unless the matching type constraint is active:

- `Type A Size`
- `Type B Size`
- `Type C Size`
- `Type D Size`
- `Type E Size`

These columns are stable parser fields. Do not rename them to include user
labels such as `Type A Size: Bond`. Use the settings sheet for labels.

Missing size cells are treated as `0`. Non-empty non-numeric values fail
validation.

## Settings Sheet

Set:

- `Additional Type Constraints`

The value must be an integer from `0` to `5`. Missing is equivalent to `0`.

For each active type, starting from A in order, set:

- `Type A Name`
- `Type A Budget`
- `Type A Budget Penalty`

and similarly for `Type B` through `Type E`.

`Type X Name` is a user-facing label only. The backend keeps stable internal
IDs: `type_a`, `type_b`, `type_c`, `type_d`, and `type_e`.

## QUBO Term

For each active type constraint:

```text
lambda_k * ((fixed_type_exposure_k + sum_i variable_type_size_i * x_i) / budget_k - 1)^2
```

This is an exact normalized portfolio-level target penalty. Fixed rows
contribute to the offset, and selected variable rows contribute through the
binary decision vector. Version 9 does not implement `<=` or `>=`
slack-variable variants for these additional type budgets.
