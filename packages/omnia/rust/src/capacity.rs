use crate::types::CapacityAssessment;

pub const WOTS_CAPACITY_TOTAL: u32 = 4096;
pub const CAPACITY_WARNING_APPROACHING: u32 = 3072; // 75%
pub const CAPACITY_WARNING_CRITICAL: u32 = 3686; // 90%
pub const CAPACITY_NEAR_EXHAUSTION: u32 = 3891; // 95%

pub fn assess_capacity(used: u32) -> Result<CapacityAssessment, String> {
    if used >= WOTS_CAPACITY_TOTAL {
        return Err(format!(
            "Channel WOTS capacity exhausted: {}/{} signing slots used",
            used, WOTS_CAPACITY_TOTAL
        ));
    }
    if used >= CAPACITY_NEAR_EXHAUSTION {
        return Ok(CapacityAssessment {
            warning: Some("critical".to_string()),
            near_exhaustion: true,
        });
    }
    if used >= CAPACITY_WARNING_CRITICAL {
        return Ok(CapacityAssessment {
            warning: Some("critical".to_string()),
            near_exhaustion: false,
        });
    }
    if used >= CAPACITY_WARNING_APPROACHING {
        return Ok(CapacityAssessment {
            warning: Some("approaching".to_string()),
            near_exhaustion: false,
        });
    }
    Ok(CapacityAssessment {
        warning: None,
        near_exhaustion: false,
    })
}

pub fn flat_signing_index(l1: u32, l2: u32) -> u32 {
    l1 * 64 + l2
}
