🔨 ForgeTrack - HomeLab Inventory Tracker

ForgeTrack is a simple, cloud-synchronized HomeLab and IT inventory management tool built using Angular and Google Firestore. It allows you to centrally track the hardware, configuration, and accounts for your personal servers, Raspberry Pis, and workstations in a clean, dark-themed interface.

It is designed to provide a "single source of truth" for managing your complex home infrastructure.

✨ Key Features

Asset Management & Data Integrity (Free Tier)

Dark Theme UI: Professional, circuit-inspired dark aesthetic.

Multi-OS Support: Track dual-boot and multi-boot systems via an Operating System list editor.

Smart Data Entry: Use the System Info Parser feature to copy/paste system information dumps (e.g., Windows 'About' screen text) and automatically populate fields like CPU, RAM, and System Name.

Component Detail: Dedicated fields for Device Model and detailed Component Specs.

Validated Network Fields: Implements field-level validation for IP Address and MAC Address to ensure data quality.

Custom Properties: Add unlimited, arbitrary key-value pairs to any system for unique metadata tracking (e.g., GPU Driver Version, RAID Level).

Data Export: Export your entire inventory to organized JSON or CSV files for backup or external reporting.

Performance Auditing: Use the Performance History log to timestamp and save performance baseline observations (e.g., benchmark scores, temperature reports) over time.

Remote Access (Deep Access Tier)

Remote Launchpad: Generates ready-to-use SSH and RDP connection commands based on saved account details and IP addresses.

Clickable Service Links: Directly links local service ports (e.g., Portainer, Pi-hole Web UI) for easy access.

Deep Access (Future): This functionality is architected to utilize a self-hosted Raspberry Pi proxy server (or similar service) to enable secure, advanced features like file transfer and remote diagnostics.

🚀 Getting Started

ForgeTrack is a standalone Angular application. Please refer to the HOWTO.md for detailed setup and usage instructions.

Dependencies

Frontend: Angular (with Signals)

Styling: Tailwind CSS

Database: Google Firestore (for real-time persistence)

🌐 Community and Development

We encourage community contributions! Please check the ROADMAP.md for planned features.

📝 License

This project is licensed under the MIT License. See the LICENSE.md file for details.
