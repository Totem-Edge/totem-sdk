use crate::types::DeviceKeyRange;

const ADDRESSES_PER_DEVICE: u32 = 8;
const MAX_DEVICE_SLOTS: u32 = 8;

pub fn allocate_device_range(device_slot: u32, device_id: &str) -> Result<DeviceKeyRange, String> {
    if device_slot >= MAX_DEVICE_SLOTS {
        return Err(format!(
            "Device slot must be 0–{}, got {}",
            MAX_DEVICE_SLOTS - 1,
            device_slot
        ));
    }
    let start_address_index = device_slot * ADDRESSES_PER_DEVICE;
    let end_address_index = start_address_index + ADDRESSES_PER_DEVICE - 1;
    Ok(DeviceKeyRange {
        device_id: device_id.to_string(),
        start_address_index,
        end_address_index,
        address_count: ADDRESSES_PER_DEVICE,
    })
}

pub fn device_slot_for_address_index(address_index: u32) -> u32 {
    address_index / ADDRESSES_PER_DEVICE
}
