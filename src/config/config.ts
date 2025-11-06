export default () => ({
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/fingerprint_db?authSource=admin',
  },

  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || 'admin',
    password: process.env.MQTT_PASSWORD || 'secure_mqtt_password_123',
  },

  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  esp32: {
    apiKeys: {
      esp32_001: process.env.ESP32_API_KEY_001 || 'secret-esp32-api-key-123',
    },
  },
});