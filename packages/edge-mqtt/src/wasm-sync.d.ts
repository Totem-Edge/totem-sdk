declare module '../rust/pkg/edge_mqtt_wasm.js' {
  export function to_hex(bytes: Uint8Array): string;
  export function canonical_json(value: any): string;
  export function compute_mqtt_event_id(event: any): string;
  export function encode_mqtt_edge_message(
    topic: string,
    payload_str: string | null | undefined,
    payload_bytes: Uint8Array | null | undefined,
    received_at: number,
    qos?: number | null,
    retain?: boolean | null,
    properties?: any | null,
  ): Uint8Array;
  export function decode_mqtt_edge_message(bytes: Uint8Array): any;
  export function create_default_mqtt_topics(deviceId: string): any;
  export function create_sensor_topic(deviceId: string, sensorType: string, sensorId: string): string;
  export function match_mqtt_topic(topic: string, pattern: string): boolean;
  export function to_scaled(value: string, decimals: number): string;
  export function from_scaled(scaled: string, decimals: number): string;
  export function add_decimal(a: string, b: string, decimals: number): string;
  export function compare_decimal(a: string, b: string, decimals: number): number;
  export function is_over_limit(value: string, limit: string, decimals: number): boolean;
}
