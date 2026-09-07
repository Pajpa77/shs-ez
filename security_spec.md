# Security Specification: Vermisstensuche & Einsatzleitung

## 1. System Invariants & Data Governance

### 1.1 Master Collections & Schema Blueprint
The application operates on four primary Firestore collections:
1. `/users/{userId}`: Personnel profiles, tactical roles, call signs, equipment tags, and battery states.
2. `/operations/{operationId}`: Active and archived search missions, missing person descriptors, HQ location, sectors, findings, and logs.
3. `/user_locations/{userId}`: Real-time GPS coordinates, tracking history, and live telemetry for rescue personnel and search dogs.
4. `/chat_messages/{messageId}`: Tactical radio-chat transmissions, mission alerts, and field coordinates.

### 1.2 Access & State Invariants
- **Authentication & Administrative Gate**: Administrative operations (terminating missions, managing accounts, assigning roles) are restricted to designated incident commanders (`admin` role) and verified bootstrap administrator (`MariaBorth@gmail.com`).
- **Path Variable Integrity (`isValidId`)**: All document keys must conform to `^[a-zA-Z0-9_\-]+$` with maximum length 128 bytes to prevent ID poisoning and directory traversal attacks.
- **Strict Schema Enforcement**: Payloads cannot contain unregistered shadow fields (Anti-Update-Gap). Every write is validated against strict property sets and type constraints.
- **Immutability of Audit Trails**:
  - `chat_messages` are append-only. Mutation (`allow update`) is strictly forbidden (`if false;`) to preserve tamper-proof logs for legal post-incident investigations.
  - Operations cannot have their origin timestamps (`createdAt`) or primary identifiers (`id`) modified during updates.
- **Geographic & Value Bounds**:
  - GPS coordinates must fall within standard physical bounds: Latitude [-90.0, 90.0], Longitude [-180.0, 180.0].
  - Battery levels are strictly bounded between 0 and 100.
  - Lists and serialized fields have hard size limits to prevent Denial of Wallet (DoW) and memory exhaustion.

---

## 2. The "Dirty Dozen" Attack Payloads

| ID | Attack Name | Target Path | Malicious Payload Characteristic | Expected Response |
|---|---|---|---|---|
| **D1** | ID Traversal Poisoning | `/users/../../root` | Document ID containing illegal traversal characters (`..`) | `PERMISSION_DENIED` |
| **D2** | Privilege Escalation | `/users/user_01` | Unauthorized user changing `role: "responder"` to `role: "admin"` | `PERMISSION_DENIED` |
| **D3** | Shadow Field Injection | `/users/user_01` | Payload containing unapproved field `__shadow_admin: true` | `PERMISSION_DENIED` |
| **D4** | Denial of Wallet (DoW) String Bomb | `/users/user_01` | `name` field containing a 100,000-character junk buffer | `PERMISSION_DENIED` |
| **D5** | Telemetry Coordinate Overflow | `/user_locations/user_01` | `currentPosition.lat: 999.99` (exceeds 90.0 degree boundary) | `PERMISSION_DENIED` |
| **D6** | Historic Timestamp Mutability Breach | `/operations/op_01` | Update attempting to alter immutable `createdAt` timestamp | `PERMISSION_DENIED` |
| **D7** | Tactical Log Tampering (Chat Mutation) | `/chat_messages/msg_01` | `updateDoc` call attempting to alter already broadcasted text | `PERMISSION_DENIED` |
| **D8** | Orphaned Chat Injection | `/chat_messages/msg_01` | Message injected with invalid non-conforming `operationId: ""` | `PERMISSION_DENIED` |
| **D9** | Battery Range Poisoning | `/users/user_01` | `batteryLevel: -45` or `batteryLevel: 999` (outside 0-100 range) | `PERMISSION_DENIED` |
| **D10** | Array Size Exhaustion Bomb | `/users/user_01` | `equipment` array containing 500 elements (limit is 20) | `PERMISSION_DENIED` |
| **D11** | Mission Terminal Lock Tampering | `/operations/op_01` | Attempting to arbitrarily corrupt or rewrite an archived mission | `PERMISSION_DENIED` |
| **D12** | Telemetry User Identity Spoofing | `/user_locations/user_01` | Payload specifies `userId: "user_attacker"` while document path is `user_01` | `PERMISSION_DENIED` |

---

## 3. Test Runner & Verification
The test suite `firestore.rules.test.ts` executes each of the Dirty Dozen against the rule definitions to verify that all 12 attack vectors are definitively rejected.
