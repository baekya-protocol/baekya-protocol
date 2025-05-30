# Baekya Protocol Overview

### Problem

The foundational principle of maintaining and operating a sustainable community lies in the equivalent exchange of contribution and guarantee between individual members and the collective.
However, due to the following structural defects of modern society, such guarantees based on contribution are failing to be realized in practice.

1. Unproductive Economic Structure:
The issuance of unproductive currency leads to capital concentration in asset markets, causing a growing gap between price inflation and wage increases. As a result, individuals gradually lose their right to a fair share of value based on their contribution, ultimately facing economic stagnation and asset market collapse.
2. Uncertain Pension Structure: 
Social security systems depend on the contributions of the productive population. However, as distribution rights deteriorate, both consumption and production decline, eventually resulting in the collapse of the pension system and the loss of the right to survival based on contribution.
3. Representative Democratic Structure:
Political representatives operate with delayed and incomplete information from the collective. This inefficiency prevents accurate and timely feedback on issues, leading to distorted policy responses and even larger market failures.

### Solution

The Baekya Protocol guarantees the right to distribution, survival, and political participation by issuing tokens based on proof of contributive economic activity (PoC).

1. Contributive economic activities (labor, consumption, etc.) performed by individuals are officially recognized as contributions to the community and are recorded on-chain to calculate each member’s contribution score.
2. Based on contribution scores, B-tokens (basic tokens) are issued and accumulated, forming a productive and circular economy that ensures the right to distribution and the right to survival.
3. Based on contribution rankings, P-tokens (political tokens) are conditionally issued to build a system of direct democracy, thereby guaranteeing the right to political participation.

### Advantages

“Circular Economy”, “Sustainable Guarantee”, “Participatory Governance”

1. By issuing currency directly to economic agents in proportion to their productive contributions, a fundamental engine of production is created. This ensures that currency issuance is tied to real economic activity and circulates within the production market, preventing economic stagnation.
2. The total amount of B-tokens issued based on each member’s contributive activity is translated into an hourly cumulative issuance system, functioning as a continuous guarantee of survival that can effectively replace traditional pension systems.
3. P-tokens are issued to top contributors over a defined period, forming a rational social contract where “those who contribute to the community participate in its decision-making.”

# architecture

### Flow map

![protocol diagram](https://github.com/user-attachments/assets/5c641d00-4917-43e1-9529-158a521bcda7)

When a Contributive Economic Activity (CEA) is triggered, a transaction is generated. The Proof of Contribution (PoC) issuance mechanism—CRCM—calculates and reflects BMR (Basic Mining Rate) and TCCM (Top Contributor Conditional Minting), and issues tokens to the contributor's DID wallet. The issued B-token is then reused in CEA, forming a closed-loop economic cycle. A portion of the transaction fee is used as gas and accumulated in the Gas Pool (Validator Reward Pool and SPA Reward Pool). P-tokens, conditionally issued via TCCM, can be exchanged for B-tokens or used for political activities (SPA) within the DAO consortium.

### [Core Engine](https://github.com/baekya-protocol/baekya-protocol/blob/main/core/README.md)

1. Blockchain Engine: The foundational layer of the Baekya Protocol, built on a proprietary blockchain engine with a contribution-based consensus mechanism. It integrates closely with the CEA framework and ensures reliable runtime and peer-to-peer networking.
2. Gas System: Implements a self-contained gas system based on B-tokens, preserving the protocol's independence. It includes gas calculation logic, fee distribution mechanisms, and manages the gas pool consisting of the Validator Reward Pool and SPA Reward Pool.
3. Node Manager: Clearly defines the roles and responsibilities of validator, full, and light nodes. Develops and maintains node software required for operation and coordination.

### [CRCM](https://github.com/baekya-protocol/baekya-protocol/blob/main/crcm/README.md)

1. Activity Detection: Detects contributive economic activities (labor, consumption, production, social contribution) and records them on-chain via relevant transactions. Supports integration with off-chain detectors via an integration layer.
2. Proof of Contribution: Based on the detected data, generates verifiable PoC. Incorporates multi-signature validation, reputation systems, and anti-abuse mechanisms to prevent manipulation.
3. Contribution Calculator: A core engine that calculates individual contribution levels based on generated PoC. Determines BMR for B-token issuance and TCCM for P-token issuance. Features anti-fraud logic, time-weighted scoring, and balance across contribution categories.

### [Token Ecosystem](https://github.com/baekya-protocol/baekya-protocol/blob/main/token/README.md)
1. BMS (Basic Minting System): Issues B-tokens based on BMR from CRCM. Implements pension-like accumulation by tracking and accumulating issuance per hour to ensure contributors' long-term survival rights.
2. PMS (Political Minting System): Issues P-tokens conditionally based on TCCM results from CRCM. Supports governance proposals, voting participation rewards, and allows P→B token exchange to increase utility.
3. Economic Models: Continuously research and apply models for inflation control, token circulation velocity, and economic system stability into protocol parameters.

### [DAO Governance](https://github.com/baekya-protocol/baekya-protocol/blob/main/governance/README.md)

1. Voting System: Builds a direct democracy voting system based on P-tokens. Includes proposal lifecycle management, vote aggregation, quorum calculation, etc.
2. Proposal Engine: Supports the full proposal flow using P-tokens: from AI-assisted draft creation → DAO algorithmic review → DAO voting. Handles validation, impact analysis, cost estimation, and scheduling.
3. SPA Framework: Defines selective political activities critical to community governance. Tracks participation, distributes P-token rewards, and manages delegation rights.
4. Governance Rules: Codifies rules such as the protocol constitution, amendment procedures, emergency response protocols, and conflict resolution mechanisms.

### [DID Identity](https://github.com/baekya-protocol/baekya-protocol/blob/main/identity/README.md)

1. Identity Core: Establishes a reliable decentralized identity (DID) system for tracking and managing members’ contributions and guarantees. Includes DID registry, lifecycle management, key rotation, and recovery.
2. Wallet Engine: Develops the core logic of a wallet that allows users to manage their DID, store and exchange B- and P-tokens, report CEA, sign transactions, and use USIM-based secure identity features.
3. Privacy Layer: Applies zero-knowledge proofs and selective disclosure to protect user privacy while allowing transparent validation of required contribution data.

### [Applications](https://github.com/baekya-protocol/baekya-protocol/blob/main/app/README.md)

1. Wallet App: Based on the wallet engine, this application enables users to easily record CEAs, manage tokens, and participate in governance. Available on mobile, web, and desktop platforms.
2. DAO Portal: A user-friendly web portal for participating in DAO governance activities including proposal submission, discussions, voting, and SPA engagement.
