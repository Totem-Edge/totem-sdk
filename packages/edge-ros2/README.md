# @totemsdk/edge-ros2

Edge runtime adapter for ROS 2 — robotics, DDS middleware, typed topics.

## Install

```bash
npm install @totemsdk/edge-ros2
```

## Design

This package does **not** import `rclnodejs`, `rclcpp`, or any ROS 2 client library. All DDS/ROS behaviour is injected via `Ros2TransportPort`. The package handles topic subscription, service calls, and proof generation.

## Quick start

```ts
import { createEdgeRuntime, createEdgeDevice, createCapabilitySet } from '@totemsdk/edge';
import { createRos2Gateway, createRos2SensorBridge } from '@totemsdk/edge-ros2';
import type { Ros2TransportPort } from '@totemsdk/edge-ros2';

// 1. Implement Ros2TransportPort (e.g. using rclnodejs)
const transport: Ros2TransportPort = {
  async init(args) { /* initialise ROS 2 context */ },
  async shutdown() { /* shutdown */ },
  async createPublisher(topic, messageType) { /* create publisher */ return { async publish(msg) {}, async destroy() {} }; },
  async createSubscription(topic, messageType, handler) { /* create subscription */ return { async destroy() {} }; },
  async createClient(service, serviceType) { /* create service client */ return { async call(req, timeout) { return { data: new Uint8Array(), type: '', receivedAt: Date.now() }; }, async destroy() {} }; },
  async createService(service, serviceType, handler) { /* create service server */ return { async destroy() {} }; },
  onError(handler) { return () => {}; },
};

// 2. Wire into Edge runtime
const runtime = createEdgeRuntime({
  deviceId: 'ros2-gateway-01',
  capabilities: createCapabilitySet(['transport:ros2', 'proof:create']),
  ports: { /* proof port */ },
});

// 3. Create gateway with topic subscriptions
const gateway = createRos2Gateway({
  runtime,
  transport,
  nodeName: 'totem_edge_node',
  subscriptions: [
    { topic: '/sensors/temperature', messageType: 'sensor_msgs/msg/Temperature', sensorId: 'temp-sensor' },
    { topic: '/odom', messageType: 'nav_msgs/msg/Odometry', sensorId: 'odometry' },
  ],
});
await gateway.start();
// Topic messages are automatically sent to the proof port

// 4. Publish a message
const pub = await gateway.createPublisher('/cmd_vel', 'geometry_msgs/msg/Twist');
await pub.publish({ data: new TextEncoder().encode('...'), type: 'geometry_msgs/msg/Twist', receivedAt: Date.now() });

// 5. Call a service
const result = await gateway.callService('/get_pose', 'nav_msgs/srv/GetPose', { data: new Uint8Array(), type: 'nav_msgs/srv/GetPose_Request', receivedAt: Date.now() });

// 6. Or use the sensor bridge with field extraction
const bridge = createRos2SensorBridge({
  runtime,
  transport,
  gateway,
  bindings: [
    {
      sensorId: 'battery-voltage',
      topic: '/battery_state',
      messageType: 'sensor_msgs/msg/BatteryState',
      dataType: 'voltage',
      unit: 'V',
      fieldExtractor: (msg) => {
        // Extract voltage field from serialised message
        return new DataView(msg.data.buffer).getFloat32(0, true);
      },
    },
  ],
});
await bridge.start();
```

## Transport port

| Method | Description |
|--------|-------------|
| `init(args?)` | Initialise ROS 2 context |
| `shutdown()` | Shutdown ROS 2 context |
| `createPublisher(topic, type)` | Create a publisher on a typed topic |
| `createSubscription(topic, type, handler)` | Create a subscription on a typed topic |
| `createClient(service, type)` | Create a service client |
| `createService(service, type, handler)` | Create a service server |
| `onError(handler)` | Register handler for node errors |

## Capabilities

- `transport:ros2` — required for ROS 2 transport

## License

MIT
