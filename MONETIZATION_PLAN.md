💰 ForgeTrack Sustainability and Donation Plan

ForgeTrack operates under an Open Core / Freemium model. Our commitment is to keep the core functionality—inventory tracking, data parsing, and auditing—free and open-source for everyone.

The specialized "Deep Access" features, however, require dedicated server infrastructure (the RPi Proxy server) and ongoing maintenance, which incurs real-world costs. We rely on a one-time donation to ensure the long-term stability and security of these advanced services.

💸 Access Tiers

Tier

Access & Features

Cost

Required Account

Free Access

Core Inventory Management - Includes unlimited systems, multi-OS tracking, IP/MAC validation, System Info Parser, Performance History, and Data Export.

$0 (Free)

Required for security and data integrity.

Deep Access (Lifetime)

All Free features PLUS Advanced Remote Management - Unlocks the future RPi Proxy Server integration, including Secure File Browsing/Transfer and advanced network diagnostics/connectivity checks.

$10 (One-Time Donation)

Permanent Account (Google, GitHub, etc.)

💡 Why the Donation is Necessary

The features offered under the Deep Access tier rely on constant, secure communication between the web app (client) and your self-hosted RPi Proxy server. The donation helps cover core project expenses, including:

Project Maintenance: Ensuring the integrity and security of the open-source client and core data model.

Infrastructure Costs: Covering domain registration, SSL certificates, and future cloud services required to support the proxy infrastructure.

Dedicated Development: Funding the security reviews and development time required for complex, high-utility features like secure file transfer protocols.

✅ How Deep Access is Secured

The integrity of your inventory and the viability of the project are secured as follows:

Client Code is Public: Anyone can download, modify, and run the ForgeTrack client code (the Angular app).

Service Access is Restricted: The Deep Access features are locked by a user token/key. When a Deep Access feature is requested, the client sends the user's permanent, authenticated UID and a validation token to the RPi Proxy server.

Server Validation: The RPi Proxy server verifies the token or UID against a secure registry to confirm the user has made the required donation before allowing access to local network functions (e.g., file browsing via SFTP).

By contributing, you are directly investing in the future feature development and stability of ForgeTrack!
