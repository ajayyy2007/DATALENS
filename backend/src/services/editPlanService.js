// backend/src/services/editPlanService.js
// Validates and executes structured edit plans against dataset rows.
// AI proposes a plan; this module is the only thing that ever
// actually mutates data, and only after validation.

const ALLOWED_OPS = ["set_cell_where", "add_row", "delete_rows_where"];

function validateEditPlan(plan, columns, rowCount) {
    const columnNames = columns.map((c) => c.name);

    if (!plan || !ALLOWED_OPS.includes(plan.operation)) {
        return { valid: false, reason: "Unsupported edit operation" };
    }

    if (plan.operation === "set_cell_where") {
        if (!plan.targetColumn || !columnNames.includes(plan.targetColumn)) {
            return { valid: false, reason: "Unknown target column" };
        }
        if (!plan.whereColumn || !columnNames.includes(plan.whereColumn)) {
            return { valid: false, reason: "Unknown filter column" };
        }
        if (plan.whereValue === undefined || plan.newValue === undefined) {
            return { valid: false, reason: "Missing whereValue or newValue" };
        }
    }

    if (plan.operation === "delete_rows_where") {
        if (!plan.whereColumn || !columnNames.includes(plan.whereColumn)) {
            return { valid: false, reason: "Unknown filter column" };
        }
        if (plan.whereValue === undefined) {
            return { valid: false, reason: "Missing whereValue" };
        }
    }

    if (plan.operation === "add_row") {
        if (!plan.newRow || typeof plan.newRow !== "object") {
            return { valid: false, reason: "Missing newRow data" };
        }
        const invalidKeys = Object.keys(plan.newRow).filter((k) => !columnNames.includes(k));
        if (invalidKeys.length > 0) {
            return { valid: false, reason: `Unknown column(s) in newRow: ${invalidKeys.join(", ")}` };
        }
    }

    return { valid: true };
}

/** Returns which row indices would be affected, without mutating anything. */
function previewEditPlan(plan, rows) {
    if (plan.operation === "set_cell_where" || plan.operation === "delete_rows_where") {
        const affected = rows
            .map((row, idx) => ({ row, idx }))
            .filter(({ row }) =>
                String(row[plan.whereColumn]).trim().toLowerCase() ===
                String(plan.whereValue).trim().toLowerCase()
            );
        return affected.map((a) => a.idx);
    }
    if (plan.operation === "add_row") {
        return [];
    }
    return [];
}

/** Applies a validated plan to rows. Returns new rows array (does not mutate input). */
function applyEditPlan(plan, rows) {
    const newRows = rows.map((r) => ({ ...r }));

    if (plan.operation === "set_cell_where") {
        newRows.forEach((row) => {
            if (
                String(row[plan.whereColumn]).trim().toLowerCase() ===
                String(plan.whereValue).trim().toLowerCase()
            ) {
                row[plan.targetColumn] = plan.newValue;
            }
        });
        return newRows;
    }

    if (plan.operation === "delete_rows_where") {
        return newRows.filter(
            (row) =>
                String(row[plan.whereColumn]).trim().toLowerCase() !==
                String(plan.whereValue).trim().toLowerCase()
        );
    }

    if (plan.operation === "add_row") {
        newRows.push({ ...plan.newRow });
        return newRows;
    }

    return newRows;
}

module.exports = { validateEditPlan, previewEditPlan, applyEditPlan, ALLOWED_OPS };