# Security Policy: SHS-EZ (Spürhunde-Salzlandkreis e.V.)

## Supported Versions

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 4.0.x   | :white_check_mark: | Active Production Release |
| < 4.0   | :x:                | Deprecated |

## Architecture & Authentication Model

- **Field Authentication**: Fast pin/password-based access designed for tactical field responders and emergency dog handlers without requiring personal email addresses.
- **Credential Governance**: Administrative oversight via designated incident commanders (`admin` / `einsatzleitung`).
- **Data Protection**: Audit log immutability on tactical chat messages (`chat_messages` append-only rule), protected First-Admin identity (`user-maria`), and strict coordinate boundaries.
- **Reporting Vulnerabilities**: Contact the IT & Incident Command team of Spürhunde-Salzlandkreis e.V.
