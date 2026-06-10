# Migration Guide: From IoTAgent-UL to IoTAgent-JSON

> This guide is intended for users currently using the deprecated **IoTAgent-UL (Ultralight 2.0)** and wishing to
> migrate their setup to the actively maintained **IoTAgent-JSON**.

---

## 📌 Why Migrate?

-   **IoTAgent-UL is deprecated** and no longer actively maintained.
-   **IoTAgent-JSON** supports a richer data format and active development.
-   JSON is a more flexible and widely-used format for IoT payloads.

---

## 🧭 Overview of Differences

| Feature            | IoTAgent-UL                     | IoTAgent-JSON          |
| ------------------ | ------------------------------- | ---------------------- |
| Payload Format     | Ultralight 2.0 (compact string) | JSON (structured data) |
| Data Encoding      | Key-value pairs or value lists  | Fully structured JSON  |
| Supported Commands | Predefined format               | More flexible          |
| Active Maintenance | ❌ Deprecated                   | ✅ Active              |
| Custom Mappings    | Limited                         | Extensive via mappings |

---

## 📦 1. Prepare Your Environment

### Requirements

-   **IoTAgent-JSON** Docker container or source
-   Orion Context Broker (or any NGSI-compatible broker)
-   MongoDB (for device registry)
-   Node.js (if using from source)

### Install IoTAgent-JSON

```bash
docker pull telefonicaiot/iotagent-json
```

Or clone the repository:

```bash
git clone https://github.com/telefonicaid/iotagent-json
cd iotagent-json
npm install
```

---

## 🔄 2. Convert Device Payload Format

### Example: Ultralight ➜ JSON

#### Ultralight Payload (incoming)

```
t|23|h|45
```

#### JSON Payload (equivalent)

```json
{
    "t": 23,
    "h": 45
}
```

> You will need to adapt your devices or use middleware to convert Ultralight payloads to JSON format.

---

## 🛠️ 3. Update Device Configuration

In UL, you defined devices like:

```json
{
    "device_id": "sensor001",
    "entity_name": "Sensor:001",
    "entity_type": "Sensor",
    "protocol": "PDI-IoTA-UltraLight",
    "transport": "HTTP",
    "attributes": [
        { "object_id": "t", "name": "temperature", "type": "Number" },
        { "object_id": "h", "name": "humidity", "type": "Number" }
    ]
}
```

In JSON, it becomes:

```json
{
    "device_id": "sensor001",
    "entity_name": "Sensor:001",
    "entity_type": "Sensor",
    "protocol": "IoTA-JSON",
    "transport": "HTTP",
    "attributes": [
        { "name": "temperature", "type": "Number" },
        { "name": "humidity", "type": "Number" }
    ]
}
```

✅ **Remove `object_id`**, as JSON payloads use attribute names directly.

---

## ⚙️ 4. Reconfigure IoTAgent Settings

### Sample `config.json`

```json
{
    "contextBroker": {
        "host": "orion",
        "port": "1026"
    },
    "server": {
        "port": 4041
    },
    "mongoDb": {
        "host": "mongo",
        "port": "27017",
        "db": "iotagentjson"
    },
    "devices": {
        "attributes": {},
        "commands": {}
    },
    "logLevel": "DEBUG"
}
```

---

## 🔄 5. Replace IoTAgent-UL with IoTAgent-JSON in Docker Compose

```yaml
iotagent-json:
    image: telefonicaiot/iotagent-json
    hostname: iotagent-json
    container_name: iotagent-json
    depends_on:
        - mongo
        - orion
    networks:
        - default
    ports:
        - "4041:4041"
    environment:
        - IOTA_CB_HOST=orion
        - IOTA_CB_PORT=1026
        - IOTA_NORTH_PORT=4041
        - IOTA_REGISTRY_TYPE=mongodb
        - IOTA_MONGO_HOST=mongo
        - IOTA_MONGO_PORT=27017
        - IOTA_MONGO_DB=iotagentjson
        - IOTA_DEFAULT_RESOURCE=/iot/json
        - IOTA_TIMESTAMP=true
        - IOTA_AUTOCAST=true
```

---

## 📡 6. Adjust Device Communication

Update your devices or gateways to send data to:

```
POST http://<iotagent-host>:4041/iot/json
Content-Type: application/json

{
  "temperature": 23,
  "humidity": 45
}
```

Make sure headers and payloads follow the new format.

---

## ✅ 7. Test the Integration

1.  Register device via IoTAgent-JSON API or by provisioning JSON file.
2.  Send JSON payload from device.
3.  Check Orion Context Broker to verify data is received.
4.  Confirm attributes are correctly updated.

---

## 🧹 8. Clean Up UL Agent

Once your devices are fully switched over:

-   Decommission the `iotagent-ul` container.
-   Remove UL-specific provisioning or scripts.
-   Monitor for errors or missing data.

---
---

## 🔁 9. Alternative Migration Strategy: UL Payload + JEXL Transformation

If modifying devices to send JSON is not feasible, you can adopt an intermediate approach:

➡️ Send the **Ultralight payload as a raw string** to a JSON attribute, and  
➡️ Use **JEXL expressions** in the IoTAgent-JSON mappings to parse and extract values.

---

### ✅ Step 1: Send UL Payload as a JSON Attribute

Instead of converting the payload in the device, send it unchanged as a string:

```bash
POST 'http://localhost:7897/iot/json/attrs/tramaUL?i=disp2&k=APIKEY1' \
  -H 'Content-Type: application/json' \
  -d '"t|23|h|45"'
```
📌 This stores the full UL message in the attribute tramaUL.

### ✅ Step 2: Configure JEXL Transformations

Define attribute mappings in IoTAgent-JSON using JEXL expressions to extract values from tramaUL.
Example mapping for temperature (t):

```
{
  "name": "t",
  "type": "Number",
  "expression": "tramaUL | substr(tramaUL | indexOf('t|') + 2, tramaUL | indexOf('|h') - 2)"
}
```
🔎 Explanation:

    indexOf('t|') + 2 → start of value
    indexOf('|h') → end delimiter
    substr(...) → extracts "23"

Result in Orion:
```
"t": {
  "type": "Number",
  "value": 23
}
```
### ✅ Step 3: Apply the Same Logic for Other Attributes
Example mapping for humidity (h):

```
{
  "name": "h",
  "type": "Number",
  "expression": "tramaUL | substr(tramaUL | indexOf('h|') + 2)"
}
```

Result in Orion: 
```
"h": {
  "type": "Number",
  "value": 45
}
```
### ⚠️ Considerations

    This approach avoids modifying device firmware, ideal for legacy deployments.
    String parsing via JEXL can become complex for larger payloads.
    Performance may be impacted if expressions are very heavy.
    Ensure delimiters (|) and attribute identifiers (t, h) are consistent.

### 🧠 When to Use This Approach

✔️ Devices cannot be updated
✔️ Quick migration needed
✔️ UL format is simple and stable

### 🚫 Avoid if:

    Payload format changes frequently
    Many attributes with complex parsing are required

### 💡 Recommendation

Use this method as a transitional strategy, and plan to eventually move to native JSON payloads for better scalability and maintainability.

---

## 📚 Resources

-   [IoTAgent-JSON GitHub](https://github.com/telefonicaid/iotagent-json)
-   [FIWARE Tutorials](https://fiware-tutorials.readthedocs.io/)
-   [NGSI v2 Specification](https://fiware.github.io/specifications/ngsiv2/latest/)

---

## 🛡️ Notes

-   **Payload validation** is stricter in JSON – ensure correct data types.
-   Use **Postman** or **curl** to test endpoints during migration.
-   Consider creating a **translator service** if your devices cannot send JSON natively.

---

## 📞 Need Help?

Post issues at
[https://github.com/telefonicaid/iotagent-json/issues](https://github.com/telefonicaid/iotagent-json/issues) or ask in
the [FIWARE Forum](https://fiware.discourse.group/).

---
