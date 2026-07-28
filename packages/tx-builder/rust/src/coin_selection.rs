use crate::types::*;
use crate::decimal::*;
use num_bigint::BigInt;
use num_traits::Zero;

pub fn order_coins_by_amount(coins: &[SpendableCoin]) -> Vec<SpendableCoin> {
    let mut sorted = coins.to_vec();
    sorted.sort_by(|a, b| {
        let cmp = compare_decimal(&b.amount, &a.amount).unwrap_or(0);
        use std::cmp::Ordering;
        match cmp {
            -1 => Ordering::Less,
            0 => a.coin_id.cmp(&b.coin_id),
            1 => Ordering::Greater,
            _ => Ordering::Equal,
        }
    });
    sorted
}

pub fn select_coins(
    coins: &[SpendableCoin],
    options: &CoinSelectionOptions,
    excluded_addresses: &[String],
) -> CoinSelectionResult {
    let mut available_coins: Vec<SpendableCoin> = coins.to_vec();

    if options.mode == "focused" {
        if let Some(ref focused_addr) = options.focused_address {
            available_coins.retain(|c| c.address == *focused_addr);
        }
    }

    let exclusions: Vec<&str> = if let Some(ref opt_exclusions) = options.excluded_addresses {
        opt_exclusions.iter().map(|s| s.as_str()).collect()
    } else {
        excluded_addresses.iter().map(|s| s.as_str()).collect()
    };

    if !exclusions.is_empty() && options.mode == "global" {
        available_coins.retain(|c| !exclusions.contains(&c.address.as_str()));
    }

    if let Some(ref token_id) = options.token_id {
        if token_id != "0x00" {
            available_coins.retain(|c| c.tokenid == *token_id);
        }
    }

    let ordered_coins = order_coins_by_amount(&available_coins);

    let target_bigint = parse_decimal_to_bigint(&options.target_amount)
        .unwrap_or_else(|_| BigInt::zero());
    let mut accumulated = BigInt::zero();
    let mut selected_coins: Vec<SpendableCoin> = Vec::new();
    let mut from_addresses: Vec<String> = Vec::new();

    for coin in &ordered_coins {
        if accumulated >= target_bigint {
            break;
        }

        let coin_amount = parse_decimal_to_bigint(&coin.amount)
            .unwrap_or_else(|_| BigInt::zero());
        selected_coins.push(coin.clone());
        accumulated += coin_amount;

        if !from_addresses.contains(&coin.address) {
            from_addresses.push(coin.address.clone());
        }
    }

    let total_selected = bigint_to_decimal_string(&accumulated);
    let insufficient_funds = accumulated < target_bigint;
    let change = if insufficient_funds {
        "0".to_string()
    } else {
        bigint_to_decimal_string(&(accumulated - target_bigint))
    };

    CoinSelectionResult {
        selected_coins,
        total_selected,
        change,
        insufficient_funds,
        from_addresses,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_coin(id: &str, address: &str, amount: &str) -> SpendableCoin {
        SpendableCoin {
            coin_id: id.to_string(),
            address: address.to_string(),
            amount: amount.to_string(),
            tokenid: "0x00".to_string(),
            created: 0,
        }
    }

    #[test]
    fn test_select_exact() {
        let coins = vec![
            make_coin("c1", "addr1", "10"),
            make_coin("c2", "addr1", "5"),
            make_coin("c3", "addr2", "3"),
        ];
        let options = CoinSelectionOptions {
            mode: "global".to_string(),
            target_amount: "15".to_string(),
            token_id: None,
            focused_address: None,
            excluded_addresses: None,
        };
        let result = select_coins(&coins, &options, &[]);
        assert!(!result.insufficient_funds);
        assert_eq!(result.selected_coins.len(), 2);
        assert_eq!(result.total_selected, "15");
        assert_eq!(result.change, "0");
    }

    #[test]
    fn test_insufficient_funds() {
        let coins = vec![make_coin("c1", "addr1", "5")];
        let options = CoinSelectionOptions {
            mode: "global".to_string(),
            target_amount: "10".to_string(),
            token_id: None,
            focused_address: None,
            excluded_addresses: None,
        };
        let result = select_coins(&coins, &options, &[]);
        assert!(result.insufficient_funds);
    }

    #[test]
    fn test_change() {
        let coins = vec![
            make_coin("c1", "addr1", "10"),
            make_coin("c2", "addr1", "5"),
        ];
        let options = CoinSelectionOptions {
            mode: "global".to_string(),
            target_amount: "12".to_string(),
            token_id: None,
            focused_address: None,
            excluded_addresses: None,
        };
        let result = select_coins(&coins, &options, &[]);
        assert!(!result.insufficient_funds);
        assert_eq!(result.total_selected, "15");
        assert_eq!(result.change, "3");
    }

    #[test]
    fn test_focused_mode() {
        let coins = vec![
            make_coin("c1", "addr1", "10"),
            make_coin("c2", "addr2", "20"),
        ];
        let options = CoinSelectionOptions {
            mode: "focused".to_string(),
            target_amount: "5".to_string(),
            token_id: None,
            focused_address: Some("addr1".to_string()),
            excluded_addresses: None,
        };
        let result = select_coins(&coins, &options, &[]);
        assert_eq!(result.selected_coins.len(), 1);
        assert_eq!(result.selected_coins[0].coin_id, "c1");
    }

    #[test]
    fn test_excluded_addresses() {
        let coins = vec![
            make_coin("c1", "addr1", "10"),
            make_coin("c2", "addr2", "20"),
        ];
        let options = CoinSelectionOptions {
            mode: "global".to_string(),
            target_amount: "5".to_string(),
            token_id: None,
            focused_address: None,
            excluded_addresses: None,
        };
        let result = select_coins(&coins, &options, &["addr1".to_string()]);
        assert_eq!(result.selected_coins.len(), 1);
        assert_eq!(result.selected_coins[0].coin_id, "c2");
    }
}
