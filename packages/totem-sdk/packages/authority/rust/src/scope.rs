use crate::types::{ActionIntent, MandateConstraint};

pub fn match_scope(action: &str, scope: &str) -> bool {
    if scope == "*" {
        return true;
    }
    if action == scope {
        return true;
    }

    let a_parts: Vec<&str> = action.split(':').collect();
    let s_parts: Vec<&str> = scope.split(':').collect();

    let mut ai: usize = 0;
    let mut si: usize = 0;
    while ai < a_parts.len() && si < s_parts.len() {
        if s_parts[si] == "*" {
            if si == s_parts.len() - 1 {
                return true;
            }
            si += 1;
            let need = a_parts.len() as isize - (s_parts.len() as isize - si as isize);
            if need < ai as isize {
                return false;
            }
            ai = need as usize;
            continue;
        }
        if a_parts[ai] != s_parts[si] {
            return false;
        }
        ai += 1;
        si += 1;
    }

    ai == a_parts.len() && si == s_parts.len()
}

fn compare_numeric(actual: &serde_json::Value, value: &serde_json::Value, operator: &str) -> bool {
    let a_num: Option<f64> = match actual {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    };
    let b_num: Option<f64> = match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.parse::<f64>().ok(),
        _ => None,
    };

    match (a_num, b_num) {
        (Some(a), Some(b)) => match operator {
            "lt" => a < b,
            "lte" => a <= b,
            "gt" => a > b,
            "gte" => a >= b,
            _ => false,
        },
        _ => false,
    }
}

pub fn match_constraints(action: &ActionIntent, constraints: &[MandateConstraint]) -> bool {
    let action_constraints = match &action.constraints {
        Some(c) => c,
        None => return constraints.is_empty(),
    };

    for c in constraints {
        let actual = match action_constraints.get(&c.field) {
            Some(v) => v,
            None => return false,
        };

        match c.operator.as_str() {
            "eq" => {
                if actual != &c.value {
                    return false;
                }
            }
            "lt" | "lte" | "gt" | "gte" => {
                if !compare_numeric(actual, &c.value, &c.operator) {
                    return false;
                }
            }
            "in" => {
                if let serde_json::Value::Array(arr) = &c.value {
                    if let serde_json::Value::Array(actual_arr) = actual {
                        if !actual_arr.iter().any(|a| arr.contains(a)) {
                            return false;
                        }
                    } else if !arr.contains(actual) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            "not_in" => {
                if let serde_json::Value::Array(arr) = &c.value {
                    if let serde_json::Value::Array(actual_arr) = actual {
                        if actual_arr.iter().any(|a| arr.contains(a)) {
                            return false;
                        }
                    } else if arr.contains(actual) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
            _ => return false,
        }
    }
    true
}
