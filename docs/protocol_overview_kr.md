# 백야 프로토콜 개요

### 문제

구성원과 공동체간의 '기여-보장' 등가교환의 원리는 공동체유지 및 운영의 핵심원리이지만, 다음과 같은 현대사회의 구조적 결함으로 인해 구성원의 기여에 대한 보장이 실질적으로 이루어지지 못하고 있습니다.

1. 비생산적 경제구조: 생산에 기반하지 않는 화폐발행은 생산시장이 아닌 자산시장으로의 자본집중을 유발하여 물가대비 임금상승분 격차를 만들고, 구성원은 점진적으로 기여에 대한 분배권을 잃어가며 결국 경기침체와 자산시장붕괴를 맞닥뜨립니다. 이러한 경제구조에서는 실질적 기여자의 생산원동력기반이 유지될 수 없으므로 공동체의 지속가능성을 확보할 수 없습니다. 이는 기존 중앙은행의 신용기반 화폐발행구조 뿐만 아니라 실질적 생산(공동체 기여)에 기반하지 않고 발행되는 대부분의 탈중앙 암호화폐에도 해당되는 발행구조입니다.
2. 불안정한 연금구조: 사회보장제도는 생산인구의 기여에 달려있으나 분배권의 점진적 상실은 생산위축을 유발하여 생존권마저 상실하게 될 뿐더러, 미래유예적 연금수급 구조는 생존권의 실질적 보장이라 보기 어렵습니다.
3. 대의 정치구조: 의사결정의 효율을 위해 구성원은 참정의 대리인을 선출하고, 참정권은 대리인에게 강제 위임됩니다. 하지만 정치 대리인은 전체 구성원에 대한 정보가 느리고 부족하여 문제에 대한 피드백을 정확히, 적시에 할 수 없는 비효율을 가지며, 대리된 피드백은 정당정치에 의해 왜곡되어 더 큰 시장문제를 유발합니다.

### 대안

백야 프로토콜은 공동체에 대한 기여활동을 기반으로 화폐토큰과 참정토큰을 발행함으로써 기여분배권 및 기여생존권, 기여참정권을 보장합니다.

1. 공통의 목적을 가진 공동체(DAO-consortium)는 기여활동 및 이에 대응되는 B-token(화폐)가치를 지정하고, 구성원은 이를 행하여 트랜잭션을 발생시킵니다.
2. 기여에 따라 B-token(화폐토큰)의 발행량을 누적하여 기여기반 경제구조를 구축함으로써 기여분배권 및 기여생존권을 보장하고, 공동체 존손기반을 보존합니다.
3. DAO는 기여자에게 P-token(참정토큰)을 발행하여 직접민주적 정치구조를 구축함으로써 모든 기여자의 기여참정권을 보장하고, 공동체 문제를 효율적으로 해결합니다.

### 이점

'기여-보장' 순환구조가 공동체의 원동력이 되어 지속성을 확보합니다.

1. 기여주체에게 화폐가 발행됨으로써 기여원동력이 보존됩니다. 이에 따라 공동체에 대한 지속성이 확보되며, 경제가 침체되지 않습니다.
2. 구성원의 기여활동으로 산출된 화폐 발행량을 "기여에 대한 지속적인 생존권보장"으로써 시간당 발행량으로 환산하여 연금제도를 대체합니다.
3. 일정기간마다 공동체 기여자에게 참정토큰을 발행하여 "공동체 기여자가 곧 공동체 의사결정 참여자"라는 합리적인 사회계약을 구축합니다.

# 핵심구조

### 흐름도

![protocol diagram](https://github.com/user-attachments/assets/646ff1a7-f1c6-4fe6-afc7-48e74a9e2af7)

DAO-consortium에 지정된 기여활동(DCA) 트리거로 인해 트랜잭션이 발생하고, 기여증명(PoC) 발행 메커니즘인 CVCM 모듈이 이를 감지 및 검증하며, 시간감쇠 발행방식(LDM)의 BMR을 산출합니다. BMR이 반영되어 DID-wallet에 발행된 B-token은 화폐로써 시장활동에 사용되며, 일부는 네트워크상의 거래 수수료(TF)로 지불되어 Gas Pool에 축적됩니다. 축적된 TF의 일부는 네트워크 검증자 보상으로 사용되어 네트워크 안전성을 확보합니다. 또 다른 일부는 DAO금고에 예치되며, 프로토콜증진 기여에 대한 이익배당(PCY)을 부여받습니다. 각 DAO는 일정 주기마다 해당 기간 동안의 모든 기여자에게 등차적으로 P-token을 발행합니다(CAPM). 발행된 P-token은 참정권으로써 DAO 구성원간의 의사결정 합의과정(제안, 투표)에 사용됩니다.

### DAO-consortium

1. 공통의 목적을 가진 탈중앙화 자율 조직으로, 프로토콜상 각각의 모든 DAO는 공통목적과 이에 대한 기여활동을 지정합니다.
2. 지정된 기여활동(DCA)은 고유한 가치기준과 검증기준을 가지며, 이에 따라 BMR산출값 및 검증방식이 결정됩니다.
3. 누구나 지정된 기여활동을 행할 수 있으며, 한 번이라도 기여한 경우 해당 DAO의 기여자로 자동 간주됩니다.

### CVCM

1. 기여-> 검증-> 계산-> 발행 메커니즘으로, 구성원의 기여를 증명하여 화폐(B-token)를 발행합니다.
2. 기여(Contribution): 구성원은 자신의 의사/선호/상황에 맞게 DAO 내 지정된 기여활동(DCA)을 자율적으로 행합니다.
3. 검증(Verification): 구성원의 기여는 DCA의 고유한 검증기준에 따라 검증되며, 트랜잭션을 발생시켜 BMR계산모듈에 전송합니다.
4. 계산(Calculation): 전송된 구성원의 정보 및 DCA의 B-token가치 정보를 바탕으로 B-token의 시간당 발행량(BMR)을 산출합니다.
   - B-token은 구성원의 남은 기대 생애기간 (R = 평균 기대수명 − 현재 나이)에 걸쳐서, 기여시점에 가중치를 두고 시간이 흐를수록 점차 감소하는 구조로 발행됩니다(LDM: Lifetime Decay Minting 방식). 
   ```math
   \text{DCA의 B-token 가치} = B_{\text{total}} = \int_{0}^{R} BMR(t) \, dt
   ```
   ```math
   BMR(t) = A \cdot e^{-kt}
   ```
   - `R`: 남은 기대 생애기간 (R = 평균 기대수명 − 현재 나이)
   - `BMR(t)`: t년 후의 B-token 발행량
   - `A`: 초기 발행량 (t = 0 시점)
   - `k`: 시간 감쇠율 (지정가능)
   - `t`: 기여 시점 이후 경과 시간
5. 발행량 누적(Minting-rate-accumulate): DCA를 행할 때마다 BMR이 산출되며, 이는 기여자에게 누적됩니다.
6. 예시: 개발DAO의 DCA인 의견제안은 80B의 기여가치를, PR(Pull Reuests)은 250B의 기여가치를 가지며, merged의 여부가 검증기준이 됩니다.
   - 30살 남성 모 구성원은 프로토콜의 더 효율적인 메커니즘을 제안했고, 누군가가 이 의견에 대한 PR-> merged 되어 트랜잭션을 발생시켰습니다.
   - DCA의 B-token가치=80B, 남성 평균 기대수명은 80세로 R=50, 시간 감쇠율은 k=0.016으로 지정합니다.
     ```math
     B_{\text{total}} = \int_{0}^{R} A \cdot e^{-kt} \, dt = 80B
     ```
     ```math
     \int_{0}^{50} A \cdot e^{-0.016t} \, dt = A \times \left[-\frac{1}{0.016} \times e^{-0.016t}\right]_0^{50}
     ```
     ```math
     A \times 34.44 = 80 \quad \Rightarrow \quad A = \frac{80}{34.44} \approx 2.32B
     ```
     ```math
     BMR(t) = 2.32 \times e^{-0.016t}
     ```
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>2.32 × e^0</code></td><td><strong>2.32B</strong></td><td><strong>0.193B</strong></td><td><strong>0.00636B</strong></td><td><strong>0.000265B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>2.32 × e^(-0.016)</code></td><td><strong>2.28B</strong></td><td><strong>0.190B</strong></td><td><strong>0.00625B</strong></td><td><strong>0.000260B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>2.32 × e^(-0.08)</code></td><td><strong>2.14B</strong></td><td><strong>0.178B</strong></td><td><strong>0.00586B</strong></td><td><strong>0.000244B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>2.32 × e^(-0.16)</code></td><td><strong>1.97B</strong></td><td><strong>0.164B</strong></td><td><strong>0.00540B</strong></td><td><strong>0.000225B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>2.32 × e^(-0.4)</code></td><td><strong>1.55B</strong></td><td><strong>0.129B</strong></td><td><strong>0.00425B</strong></td><td><strong>0.000177B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>2.32 × e^(-0.8)</code></td><td><strong>1.04B</strong></td><td><strong>0.087B</strong></td><td><strong>0.00285B</strong></td><td><strong>0.000119B</strong></td></tr>
     </table>
     </div><br>
   - 이 구성원은 이번엔 자신의 의견을 직접 PR하기로 했으며, PR-> merged 되어 트랜잭션을 발생시켰습니다.
     ```math
     B_{\text{total}} = \int_{0}^{R} A \cdot e^{-kt} \, dt = 250B
     ```
     ```math
     BMR(t) = 7.26 \times e^{-0.016t}
     ```
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>7.26 × e^0</code></td><td><strong>7.26B</strong></td><td><strong>0.605B</strong></td><td><strong>0.0199B</strong></td><td><strong>0.000829B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>7.26 × e^(-0.016)</code></td><td><strong>7.14B</strong></td><td><strong>0.595B</strong></td><td><strong>0.0196B</strong></td><td><strong>0.000815B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>7.26 × e^(-0.08)</code></td><td><strong>6.70B</strong></td><td><strong>0.558B</strong></td><td><strong>0.0184B</strong></td><td><strong>0.000765B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>7.26 × e^(-0.16)</code></td><td><strong>6.17B</strong></td><td><strong>0.514B</strong></td><td><strong>0.0169B</strong></td><td><strong>0.000704B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>7.26 × e^(-0.4)</code></td><td><strong>4.86B</strong></td><td><strong>0.405B</strong></td><td><strong>0.0133B</strong></td><td><strong>0.000555B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>7.26 × e^(-0.8)</code></td><td><strong>3.26B</strong></td><td><strong>0.272B</strong></td><td><strong>0.00893B</strong></td><td><strong>0.000372B</strong></td></tr>
     </table>
     </div><br>
   - 위 1회 PR에 대한 BMR은 기존에 반영되어 있던 구성원의 1회 의견제안에 대한 BMR에 누적되어 아래와 같은 BMR을 가집니다.
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>(2.32 + 7.26) × e^0</code></td><td><strong>9.58B</strong></td><td><strong>0.798B</strong></td><td><strong>0.0263B</strong></td><td><strong>0.001094B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>(2.32 + 7.26) × e^(-0.016)</code></td><td><strong>9.42B</strong></td><td><strong>0.785B</strong></td><td><strong>0.0259B</strong></td><td><strong>0.001075B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>(2.32 + 7.26) × e^(-0.08)</code></td><td><strong>8.84B</strong></td><td><strong>0.736B</strong></td><td><strong>0.0243B</strong></td><td><strong>0.001009B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>(2.32 + 7.26) × e^(-0.16)</code></td><td><strong>8.14B</strong></td><td><strong>0.678B</strong></td><td><strong>0.0223B</strong></td><td><strong>0.000929B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>(2.32 + 7.26) × e^(-0.4)</code></td><td><strong>6.41B</strong></td><td><strong>0.534B</strong></td><td><strong>0.0176B</strong></td><td><strong>0.000732B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>(2.32 + 7.26) × e^(-0.8)</code></td><td><strong>4.30B</strong></td><td><strong>0.359B</strong></td><td><strong>0.0118B</strong></td><td><strong>0.000491B</strong></td></tr>
     </table>
     </div><br>
7. 의의
   - 현대의 법정화폐는 실질적 “기여” 기준이 아닌, “자산 보유” 및 “신용등급”을 기준으로 대출되어 민간에게 분배됩니다. 이러한 발행방식은 오히려 임금대비 물가상승을 유발하고, 이는 곧 공동체의 존속기반인 기여자의 기여원동력에 대한 점진적 결손으로 이어지므로 공동체는 필연적으로 붕괴합니다. 백야 프로토콜은 CVCM-기여증명 발행메커니즘으로 기여에 대해 직접적, 등가적으로 화폐를 발행함으로써 기여원동력의 결손을 방지하고 "기여에 대한 분배권의 완전한 보장"을 실현하여 공동체의 존속기반을 보존합니다.
   - CVCM의 BMR-LDM 방식은 기여시점에 가중치를 부여해 구성원의 동기를 이끌어냄과 동시에, 기여자의 전체 생애기간에 걸쳐 실시간으로 발행하므로 "기여에 대한 생존권의 지속적, 실질적 보장"을 실현합니다.
(기여증명 화폐발행은 '기여에 대한 분배권 및 생존권 보장'의 의미이며, 노동임금과는 별개의 개념입니다.)

### B-token (Baekya-token)

1. 백야 네트워크의 화폐로, 기여행위 자체에 화폐가치를 두고, DCA에 의해 발행됩니다.
   - 백야 프로토콜은 현 신용기반 경제구조의 완전한 탈피를 지향합니다. 외부 화폐(달러, 코인 등)와의 교환을 지원함은 곧 B-token의 가치가 외부 화폐와의 교환가치로 이어짐을 의미합니다. 아무리 합리적이고 효율적인 발행구조를 구축하더라도 상장 및 외부 화폐와의 교환을 지원하는 순간 그 의미는 소멸되어 외부 화폐와의 교환가치만 남고, 기존 화폐를 대체할 가능성을 잃습니다. (이는 상장된 암호화폐가 법정화폐를 대체하여 통용될 수 없는 이유이기도 합니다.) 고로 B-token의 상장 및 외부 화폐 교환은 지원될 수 없으며, B-token의 재화/서비스와의 교환가치는 백야 네트워크상에서 규모적/암묵적으로 결정되도록 구성원의 시장심리에 맡겨야 합니다. (각 DAO가 지정한 DCA의 B-token발행가치가 재화/서비스에 대한 교환가치의 가치척도로써 작동할 수 있습니다.)
2. 발생된 트랜잭션 수수료(TF)는 

# 개발구조

### [코어엔진](https://github.com/baekya-protocol/baekya-protocol/blob/main/core/README.md)

1. Blockchain Engine: 백야 프로토콜의 근간이 되는 기여증명 합의 메커니즘 기반의 자체 블록체인 엔진입니다. 이는 기여증명 프레임워크와 긴밀하게 연동되어 작동하며, 안정적이고 효율적인 런타임 및 P2P 네트워킹이 뒷받침됩니다.
2. Gas System: 프로토콜의 독립성을 위해 B-Token을 사용하는 자체 가스시스템을 구현합니다. 가스비 계산 로직, 수수료 분배 메커니즘을 자체적으로 구축하며, 검증자 보상 풀(Validation Reward Pool) 및 SPA 보상 풀(SPA Reward Pool) 등으로 구성된 가스 풀(gas-pools) 관리가 핵심입니다.
3. Node Manager: 검증자 노드, 전체 노드, 경량 노드의 역할과 기능을 명확히 정의하고, 각 노드 운영에 필요한 소프트웨어를 개발합니다.

### [기여증명](https://github.com/baekya-protocol/baekya-protocol/blob/main/crcm/README.md)

1. Activity Detection: 기여적 경제활동(노동, 소비, 생산, 사회적 기여)을 기여와 관련된 트랜잭션을 감지함으로써 온체인에 기록합니다. integration-layer를 통해 오프체인 디텍터와 연동하여 기여감지구조 설정을 지원합니다.
2. Proof of Contribution: 감지된 경제활동 데이터를 기반으로 신뢰할 수 있는 기여증명(PoC)을 생성하고, 이를 검증하는 시스템을 구축합니다. 다중서명 검증, 평판 시스템 등을 활용하여 조작 및 어뷰징을 방지합니다.
3. Contribution Calculator: 생성된 PoC를 바탕으로 각 구성원의 기여도를 정량적으로 산출하는 핵심 계산 엔진입니다. 이는 B-Token 발행량의 발행량과 P-Token 발행량의 근거가 되는 TCCM(상위 기여자 조건발행)을 산출하며 부정행위 방지, 시간적 가중치, 기여 카테고리 간 균형 등을 고려한 정교한 로직을 지원합니다.

### [토큰 생태계](https://github.com/baekya-protocol/baekya-protocol/blob/main/token/README.md)

1. BMS: CRCM에서 산출된 BMR을 기반으로 B-Token을 발행하는 엔진입니다. 기여에 대한 지속적인 생존권 보장을 위해 연금 누적기능을 구현하여 시간당 발행량을 누적합니다.
2. PMS: CRCM에서 산출된 TCCM을 기반으로 P-Token을 조건부로 발행하는 엔진입니다. 거버넌스 제안 및 투표 메커니즘과 참여보상을 지원하여 활발한 거버넌스 참여를 유도합니다. P->B교환 기능을 지원하여 효용성을 높입니다.
3. Economic Models: 인플레이션 제어, 화폐 유통 속도 추적, 시스템 안정성 확보를 위한 경제 모델을 지속적으로 연구하고 프로토콜 파라미터에 반영합니다.
* (백야 네트워크 외부의 그 어떤 화폐와도 교환을 지원하지 않습니다.)

### [분산조직 거버넌스](https://github.com/baekya-protocol/baekya-protocol/blob/main/governance/README.md)

1. Voting System: P-Token을 활용한 직접민주주의 방식의 투표 시스템을 구축합니다. 제안의 생명주기 관리, 투표 집계, 정족수 계산 등의 기능을 포함합니다.
2. Proposal Engine: 'P-token 안건발의(교정ai 지원)-> 관련DAO심사(알고리즘 배포)-> 적용DAO의 표결' 에 필요한 엔진으로, 커뮤니티 구성원이 P-Token을 활용하여 프로토콜 변경이나 개선에 대한 제안을 제출하고, 이에 대한 검증, 영향도 평가, 비용 추정, 실행 계획 등을 관리하는 시스템을 개발합니다.
3. SPA Framework: 공동체 운영에 필요한 특정 정치적 활동을 정의하고, 이에 대한 참여 추적, P-Token 기반의 보상 분배, 위임 관리 기능을 구현합니다.
4. Governance Rules: 프로토콜의 헌법, 주요 정책 변경을 위한 수정 절차, 비상 상황 발생 시 대응 프로토콜, 갈등 해결 메커니즘 등을 코드 또는 명문화된 규칙으로 정의합니다.

### [분산신원 지갑](https://github.com/baekya-protocol/baekya-protocol/blob/main/identity/README.md)

1. Identity Core: 각 구성원의 기여와 보장을 기록하고 관리하기 위한 안전하고 신뢰할 수 있는 분산신원(DID) 시스템을 구축합니다. DID 레지스트리, 신원 관리, 키 순환 및 복구 메커니즘이 포함됩니다.
2. Wallet Engine: 사용자가 자신의 DID를 관리하고, B-Token과 P-Token 보관 및 교환, CEA(기여적 경제활동) 보고, 트랜잭션 서명 및 전송 등의 기능 및 USIM기능을 수행할 수 있는 지갑의 핵심 로직을 개발합니다.
3. Privacy Layer: 영지식 증명, 선택적 정보 공개 등의 기술을 활용하여 사용자의 프라이버시를 보호하면서도 필요한 기여 정보는 투명하게 검증될 수 있도록 합니다.

### [어플리케이션](https://github.com/baekya-protocol/baekya-protocol/blob/main/app/README.md)

1. Wallet App: did-identity의 wallet-engine을 기반으로 사용자들이 CEA를 손쉽게 기록하고, 토큰을 관리하며, 거버넌스에 참여할 수 있는 직관적인 모바일, 웹, 데스크톱 지갑 애플리케이션을 개발합니다.
2. Dao Portal: DAO 거버넌스 활동(제안 제출 및 토론, 투표, SPA 참여 등)을 위한 사용자 친화적인 웹 포털을 구축합니다.

### DAPP UI 예시

![ui 예시](https://github.com/user-attachments/assets/00b97401-797f-421c-8ba0-717c0b6e54d4)


# 의의

신용에 기반한 화폐시스템은 부의 양극화와 침체를 낳고, 대의제는 공동체 문제에 대한 피드백을 사실상 불가능하게 만듭니다. 이러한 구조는 사회보장제도까지 마비시키며, 
공동체의 존속 기반을 붕괴시킵니다.

백야 프로토콜은 이러한 악순환을 끊기 위한 하나의 실천적 제안으로 기여와 분배, 기여와 생존, 기여와 참정이 정합적으로 연결되는 사회구조를 제시합니다.

이를 위해 공동체유지에 필수적인 권한을 토큰화하고, 기여에 기반한 적절한 발행기준과 사용기준을 설정하여 전체 구성원에게 분산화한 새로운 사회 프로토콜을 제시합니다.
B-Token은 분배와 생존을, P-Token은 참정을 보장하며, 그 모든 작동을 DApp위에서 구현하여 중앙 없이도 작동하는 모두의 사회를 제시합니다.

![의의](https://github.com/user-attachments/assets/d3d52ff4-bbbd-4ab1-a127-0bf3586eb4ed)

