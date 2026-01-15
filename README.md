
<img src="assets/images/logo.png" alt="Norrath Navigator Logo" align="center"> 

ForgeTrack is a simple, cloud-synchronized HomeLab and IT inventory management tool built using Angular and Google Firestore. It allows you to centrally track the hardware, configuration, and accounts for your personal servers, Raspberry Pis, and workstations in a clean, dark-themed interface.

It is designed to provide a "single source of truth" for managing your complex home infrastructure.

✨ Key Features (Free Tier)

Data Entry & Validation

System Info Parser (BETA): Allows users to copy/paste system information dumps (e.g., Windows 'About' screen text) and automatically extracts and populates fields like CPU, RAM, and System Name.

Validated Network Fields: Implements field-level validation for IP Address and MAC Address to ensure data quality.

Multi-OS Support: Track dual-boot and multi-boot systems via a dedicated Operating System list editor.

Custom Properties: Add unlimited, arbitrary key-value pairs (key/value) to any system for unique metadata tracking (e.g., GPU Driver Version, NAS Volume Size).

Management & Auditing

Dark Theme UI: Professional, circuit-inspired dark aesthetic.

System Grouping: Use the Tags feature to organize and group devices (e.g., #docker-hosts, #gaming-rigs).

Performance History: Use the Snapshot button to timestamp and log performance baseline observations (e.g., benchmark scores, CPU load reports) over time.

Data Export: Export your entire comprehensive inventory (including nested lists like Accounts and Custom Properties) to organized JSON or CSV files for backup and reporting.

Security Guard: Requires Google Sign-in to ensure all data is tied to a secure, permanent user account, avoiding anonymous data loss.

Remote Access Launchpad

Remote Links: Generates copy-paste SSH and RDP connection commands based on saved account details and IP addresses.

Clickable Services: Makes local service ports and URLs clickable for instant access to web consoles (e.g., Portainer, Pi-hole Web UI).

💰 Deep Access (PRO Tier)

ForgeTrack follows an Open Core / Freemium model. The core inventory functionality is open-source and free, while specialized features that require dedicated, managed network infrastructure are part of the paid "Deep Access" tier.

Deep Access Features: Integration with a self-hosted RPi Proxy server to enable secure, advanced features like Remote File Browsing and Secure Diagnostics.

Cost: A one-time $10 donation is requested to support the long-term maintenance of the project and necessary infrastructure (See [MONETIZATION_PLAN](MONETIZATION_PLAN.md)).

🚀 Getting Started

ForgeTrack is a standalone Angular application. Please refer to the HOWTO.md for detailed setup and usage instructions.

Dependencies

Frontend: Angular (with Signals)

Styling: Tailwind CSS

Database: Google Firestore (for secure, real-time persistence)

🌐 Community and Development

We encourage community contributions! Please check the ROADMAP.md for planned features.
