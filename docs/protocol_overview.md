# 백야 프로토콜 개요

백야 프로토콜은 '기여한 만큼 보장받는' 사회규약을 실현하기 위해 설계된 기여기반 탈중앙 사회시스템입니다. 기존의 신용기반 경제구조와 대의제 정치의 구조적 한계를 극복하고, 구성원의 실질적 기여에 기반한 화폐(B-token) 발행을 통해 지속가능한 공동체 운영을 목표로 합니다.

### 문제

구성원과 공동체간 '기여-보장'의 등가교환은 공동체유지 및 운영의 핵심원리이지만, 다음과 같은 현대사회의 구조적 결함으로 인해 구성원의 기여에 대한 보장이 실질적으로 이루어지지 않고 있습니다.

1. 비생산적 경제구조: 생산에 기반하지 않는 화폐발행은 물가대비 임금상승분 격차를 만들고, 구성원은 점진적으로 기여에 대한 분배권을 잃어가며 결국 경기침체와 자산시장붕괴를 맞닥뜨립니다. 이러한 경제구조에서는 실질적 기여자의 원동력기반이 유지될 수 없으므로 공동체의 지속가능성을 확보할 수 없습니다. 이는 기존 중앙은행의 신용기반 화폐발행구조 뿐만 아니라 실질적 생산(공동체 기여)에 기반하지 않고 발행되는 대부분의 탈중앙 암호화폐에도 해당되는 발행구조입니다.
2. 불안정한 연금구조: 사회보장제도는 생산인구의 기여에 달려있으나 분배권의 점진적 상실은 생산위축을 유발하여 생존권마저 상실하게 될 뿐더러, 미래유예적 연금수급 구조는 생존권의 실질적 보장이라 보기 어렵습니다.
3. 대의 정치구조: 의사결정의 효율을 위해 구성원은 참정의 대리인을 선출하고, 참정권은 대리인에게 위임됩니다. 하지만 정치 대리인은 전체 구성원에 대한 정보가 느리고 부족하여 문제에 대한 피드백을 정확히, 적시에 할 수 없는 비효율을 가지며, 대리된 피드백은 정당정치에 의해 왜곡되어 더 큰 시장문제를 유발합니다.

### 대안

백야 프로토콜은 DAO공동체에 대한 기여활동을 기반으로 화폐토큰과 참정토큰을 발행함으로써 기여분배권 및 기여생존권, 기여참정권을 보장합니다.

1. 공통의 목적을 가진 탈중앙화 자율조직(DAO)은 기여활동 및 이에 대응되는 B-token(화폐)가치를 지정하고, 구성원은 이를 행하며, 검증기준 충족시 트랜잭션을 발생시킵니다.
2. 기여에 따라 B-token(화폐토큰)의 발행량을 누적하고, 생애기간 동안 발행하여 기여기반 경제구조를 구축함으로써 기여분배권 및 기여생존권을 보장함과 동시에 공동체 존속기반을 보존합니다.
3. DAO는 기여자에게 P-token(참정토큰)을 발행하여 직접민주적 정치구조를 구축함으로써 모든 기여자의 기여참정권을 보장하고, 공동체 문제를 효율적으로 해결합니다.

### 이점

'기여-보장' 순환구조가 공동체의 원동력이 되어 지속성을 확보합니다.

1. 기여주체에게 화폐가 발행됨으로써 기여원동력이 보존됩니다. 이에 따라 공동체에 대한 지속성이 확보되며, 경제가 침체되지 않습니다.
2. 구성원의 기여활동으로 산출된 화폐 발행량을 "기여에 대한 지속적인 생존권보장"으로써 생애기간 동안 발행하여 연금제도를 대체합니다.
3. 일정기간마다 공동체 기여자에게 참정토큰을 발행하여 "공동체 기여자가 곧 공동체 의사결정 참여자"라는 합리적인 사회계약을 구축합니다.

# 핵심구조

### 흐름도

![protocol diagram](https://github.com/user-attachments/assets/4804efe5-0973-4d49-8eaf-e8f8aedbb001)

DAO-consortium에 지정된 기여활동(DCA) 트리거로 인해 트랜잭션이 발생하고, 기여증명 발행 메커니즘인 CVCM 모듈이 이를 감지 및 검증하며, 생애기간 동안의 시간감쇠 발행방식(LDM)의 BMR을 산출합니다. BMR이 반영되어 DID-wallet에 발행된 B-token은 화폐로써 시장활동에 사용되며, 일부는 네트워크상의 거래 수수료(TF)로 지불되어 Gas Pool에 축적됩니다. 축적된 TF의 일부는 네트워크 검증자 보상으로 사용되어 네트워크 안정성을 확보합니다. 또 다른 일부는 DAO금고에 예치되며, 이는 구성원 합의에 의해 다양한 형태로 사용됩니다. 각 DAO는 일정 주기마다 해당 기간 동안의 모든 기여자에게 등차적으로 P-token을 발행합니다(CAPM). 발행된 P-token은 참정권으로써 DAO 구성원간의 의사결정 합의과정(제안, 투표)에 사용됩니다.

### DAO-consortium

1. 공통의 목적을 가진 탈중앙화 자율 조직으로, 프로토콜상 각각의 모든 DAO는 공통목적과 이에 대한 기여활동을 지정합니다.
2. 지정된 기여활동(DCA)은 고유한 가치기준과 검증기준을 가지며, 이에 따라 BMR산출값 및 검증방식이 결정됩니다. (DCA는 B-token 및 P-token 발행의 원천이 됩니다.)
3. 누구나 지정된 기여활동을 행할 수 있으며, 한 번이라도 기여한 경우 해당 DAO의 기여자로 자동 간주됩니다. (DAO구성원만 기여할 수 있는 것이 아니라 누구나 모든 DAO에 기여할 수 있으며, 해당 기여자가 곧 DAO구성원이 됩니다.)
4. 모든 DAO-consortium에서는, '제안-투표-검토'의 구성원간 합의과정을 거쳐 의사가 결정 및 반영됩니다. [(OP-Governance)](https://github.com/baekya-protocol/baekya-protocol/blob/main/docs/protocol_overview.md#governance)

### CVCM

1. 기여-> 검증-> 계산-> 발행 메커니즘으로, 구성원의 기여를 증명하여 화폐(B-token)를 발행합니다.
2. 기여(Contribution): 구성원은 자신의 의사/선호/상황에 맞게 DAO 내 지정된 기여활동(DCA)을 자율적으로 행합니다.
3. 검증(Verification): 구성원의 기여는 DCA의 고유한 검증기준에 따라 검증되며, 트랜잭션을 발생시켜 계산모듈에 전송합니다.
4. 계산(Calculation): 전송된 구성원의 정보 및 DCA의 B-token가치 정보를 바탕으로 B-token의 생애기간 동안의 시간당 발행량을 산출합니다. (폐기된 아이디어)
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
      - `k`: 동적시간감쇠율 (k = 4.605 / R, 남은생애기간 마지막해에 BMR이 초기값의 1%가 되도록 설정)
      - `t`: 기여 시점 이후 경과 시간
5. 발행량 누적(Minting-rate-accumulate): DCA를 행할 때마다 BMR이 산출되며, 이는 기여자에게 누적됩니다.
6. 예시: 개발DAO의 DCA인 의견제안은 80B의 기여가치를, PR(Pull Reuests)은 250B의 기여가치를 가지며, merged의 여부가 검증기준이 됩니다.
   - 30살 남성 모 구성원은 프로토콜의 더 효율적인 메커니즘을 제안했고, 누군가가 이 의견에 대한 PR-> merged 되어 트랜잭션을 발생시켰습니다.
   - DCA의 B-token가치=80B, 남성 평균 기대수명은 80세로 R=50, 동적시간감쇠율은 k=4.605/50=0.0921로 계산됩니다.
     ```math
     B_{\text{total}} = \int_{0}^{R} A \cdot e^{-kt} \, dt = 80B
     ```
     ```math
     k = \frac{4.605}{R} = \frac{4.605}{50} = 0.0921
     ```
     ```math
     A = \frac{B_{\text{total}} \times k}{1 - e^{-kR}} = \frac{80 \times 0.0921}{1 - e^{-0.0921 \times 50}} \approx 7.44B
     ```
     ```math
     BMR(t) = 7.44 \times e^{-0.0921t}
     ```
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>7.44 × e^0</code></td><td><strong>7.44B</strong></td><td><strong>0.620B</strong></td><td><strong>0.0204B</strong></td><td><strong>0.000849B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>7.44 × e^(-0.0921)</code></td><td><strong>6.79B</strong></td><td><strong>0.566B</strong></td><td><strong>0.0186B</strong></td><td><strong>0.000775B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>7.44 × e^(-0.4605)</code></td><td><strong>4.72B</strong></td><td><strong>0.393B</strong></td><td><strong>0.0129B</strong></td><td><strong>0.000538B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>7.44 × e^(-0.921)</code></td><td><strong>2.96B</strong></td><td><strong>0.247B</strong></td><td><strong>0.00812B</strong></td><td><strong>0.000338B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>7.44 × e^(-2.3025)</code></td><td><strong>0.744B</strong></td><td><strong>0.062B</strong></td><td><strong>0.00204B</strong></td><td><strong>0.0000849B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>7.44 × e^(-4.605)</code></td><td><strong>0.074B</strong></td><td><strong>0.0062B</strong></td><td><strong>0.000204B</strong></td><td><strong>0.00000849B</strong></td></tr>
     </table>
     </div><br>
   - 이 구성원은 이번엔 자신의 의견을 직접 PR하기로 했으며, PR-> merged 되어 트랜잭션을 발생시켰습니다.
     ```math
     B_{\text{total}} = \int_{0}^{R} A \cdot e^{-kt} \, dt = 250B
     ```
     ```math
     A = \frac{250 \times 0.0921}{1 - e^{-0.0921 \times 50}} \approx 23.26B
     ```
     ```math
     BMR(t) = 23.26 \times e^{-0.0921t}
     ```
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>23.26 × e^0</code></td><td><strong>23.26B</strong></td><td><strong>1.939B</strong></td><td><strong>0.0637B</strong></td><td><strong>0.00265B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>23.26 × e^(-0.0921)</code></td><td><strong>21.22B</strong></td><td><strong>1.768B</strong></td><td><strong>0.0581B</strong></td><td><strong>0.00242B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>23.26 × e^(-0.4605)</code></td><td><strong>14.75B</strong></td><td><strong>1.229B</strong></td><td><strong>0.0404B</strong></td><td><strong>0.00168B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>23.26 × e^(-0.921)</code></td><td><strong>9.25B</strong></td><td><strong>0.771B</strong></td><td><strong>0.0254B</strong></td><td><strong>0.00106B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>23.26 × e^(-2.3025)</code></td><td><strong>2.33B</strong></td><td><strong>0.194B</strong></td><td><strong>0.00637B</strong></td><td><strong>0.000266B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>23.26 × e^(-4.605)</code></td><td><strong>0.233B</strong></td><td><strong>0.0194B</strong></td><td><strong>0.000637B</strong></td><td><strong>0.0000266B</strong></td></tr>
     </table>
     </div><br>
   - 위 1회 PR에 대한 BMR은 기존에 반영되어 있던 구성원의 1회 의견제안에 대한 BMR에 누적되어 아래와 같은 BMR을 가집니다.
     <div align="center"><br>
     <table>
     <tr><th>시점</th><th>계산식</th><th>연간 발행량</th><th>월간 발행량</th><th>일간 발행량</th><th>시간당 발행량</th></tr>
     <tr><td>t=0 (즉시)</td><td><code>(7.44 + 23.26) × e^0</code></td><td><strong>30.70B</strong></td><td><strong>2.558B</strong></td><td><strong>0.0841B</strong></td><td><strong>0.003504B</strong></td></tr>
     <tr><td>t=1 (1년 후)</td><td><code>(7.44 + 23.26) × e^(-0.0921)</code></td><td><strong>28.01B</strong></td><td><strong>2.334B</strong></td><td><strong>0.0767B</strong></td><td><strong>0.003196B</strong></td></tr>
     <tr><td>t=5 (5년 후)</td><td><code>(7.44 + 23.26) × e^(-0.4605)</code></td><td><strong>19.47B</strong></td><td><strong>1.623B</strong></td><td><strong>0.0533B</strong></td><td><strong>0.002221B</strong></td></tr>
     <tr><td>t=10 (10년 후)</td><td><code>(7.44 + 23.26) × e^(-0.921)</code></td><td><strong>12.21B</strong></td><td><strong>1.018B</strong></td><td><strong>0.0335B</strong></td><td><strong>0.001393B</strong></td></tr>
     <tr><td>t=25 (25년 후)</td><td><code>(7.44 + 23.26) × e^(-2.3025)</code></td><td><strong>3.07B</strong></td><td><strong>0.256B</strong></td><td><strong>0.00841B</strong></td><td><strong>0.000350B</strong></td></tr>
     <tr><td>t=50 (50년 후)</td><td><code>(7.44 + 23.26) × e^(-4.605)</code></td><td><strong>0.307B</strong></td><td><strong>0.0256B</strong></td><td><strong>0.000841B</strong></td><td><strong>0.0000350B</strong></td></tr>
     </table>
     </div><br>
7. 의의
   - 현대의 법정화폐는 실질적 '기여' 기준이 아닌, '자산 보유' 및 '신용등급'을 기준으로 대출되어 민간에게 분배됩니다. 이러한 발행방식은 오히려 임금대비 물가상승을 유발하고, 이는 곧 공동체의 존속기반인 기여자의 기여원동력에 대한 점진적 결손으로 이어지므로 공동체는 필연적으로 붕괴합니다. 백야 프로토콜은 CVCM-기여증명 발행메커니즘으로 기여에 대해 직접적, 등가적으로 화폐를 발행함으로써 기여원동력의 결손을 방지하고 "기여에 대한 분배권의 완전한 보장"을 실현하여 공동체의 존속기반을 보존합니다.
   - CVCM의 BMR-LDM 방식은 기여시점에 가중치를 부여해 구성원의 동기를 이끌어냄과 동시에, 기여자의 전체 생애기간에 걸쳐 실시간으로 발행하므로 "기여에 대한 생존권의 지속적, 실질적 보장"을 실현합니다.
(기여증명 화폐발행은 프로토콜상 모든 구성원에게 보장되는 "기여에 대한 분배권 및 생존권"의 의미이며, 자유시장에서의 노동임금과는 별개의 개념입니다.)

### B-token (Baekya-token)

1. 백야 네트워크의 화폐로, 기여행위 자체에 화폐가치를 두고, DCA에 의해 발행됩니다.
   - 백야 프로토콜은 현 신용기반 경제구조의 완전한 탈피를 지향하며, 불로소득 및 화폐의 시간가치를 허용하지 않습니다.
   - 외부 화폐(달러, 코인 등)와의 교환을 지원함은 곧 B-token의 가치가 외부 화폐와의 교환가치로 이어짐을 의미합니다. 아무리 합리적이고 효율적인 발행구조를 구축하더라도 상장 및 외부 화폐와의 교환을 지원하는 순간 그 의미는 소멸되어 외부 화폐와의 교환가치만 남고, 기존 화폐를 대체할 가능성을 잃습니다. 고로 B-token의 상장 및 외부 화폐 교환은 지원될 수 없습니다.
   - B-token의 재화/서비스와의 교환가치는 백야 네트워크상에서 규모적/암묵적으로 결정되도록 구성원의 시장심리에 맡겨야 하며, 각 DAO가 지정한 DCA의 B-token발행가치가 재화/서비스에 대한 교환가치의 가치척도로써 작동할 수 있습니다.
2. B-token으로 지불된 트랜잭션 수수료(TF)의 일부는 검증자 풀(Validation Pool)에 사용되어 네트워크 안정성을 확보하며, 또 다른 일부는 구성원간 합의에 의해 다양한 형태로 사용될 DAO금고(DAO-treasury)에 예치됩니다.
   - 프로토콜상 구성원이 발생시킨 TF는 각 소속 DAO에서 구성원이 발생시킨 기여량에 비례하여 DAO-treasury에 예치됩니다.
     ```math
     TF_{validator} = TF_{total} \times r_{validator}
     ```
     ```math
     TF_{dao_i} = TF_{total} \times r_{dao} \times \frac{C_i}{C_{total}}
     ```
     - `TF_total`: 구성원이 발생시킨 총 TF
     - `r_validator`: 검증자 풀 할당 비율 (예: 0.6)
     - `r_dao`: DAO treasury 할당 비율 (예: 0.4)
     - `C_i`: i번째 DAO에서의 기여량
     - `C_total`: 총 기여량 = Σ C_i
   - 예시: 검증자 풀과 DAO금고에 할당되는 TF의 비율을 '6:4'으로 가정하고 모 구성원이 A-DAO에서 60B의 기여를, B-DAO에서 40B의 기여를 발생시켜 '6:4'의 기여율을 가정, 토큰 전송으로 발생된 TF는 '0.1B'으로 가정합니다.
     ```math
     TF_{total} = 0.1B, \quad r_{validator} = 0.6, \quad r_{dao} = 0.4, \quad C_A = 60B, \quad C_B = 40B
     ```
     ```math
     TF_{validator} = 0.1 \times 0.6 = 0.06B
     ```
     ```math
     TF_{dao_A} = 0.1 \times 0.4 \times \frac{60}{100} = 0.1 \times 0.4 \times 0.6 = 0.024B
     ```
     ```math
     TF_{dao_B} = 0.1 \times 0.4 \times \frac{40}{100} = 0.1 \times 0.4 \times 0.4 = 0.016B
     ```

### P-token (Political-token)

1. 프로토콜이 기여자에게 보장하는 "기여에 대한 참정권"의 토큰화로, DAO 내 모든 의사결정 합의과정에 사용되는 참정토큰입니다.
2. 각 DAO-consortium은 일정 주기마다 해당 기간 동안의 총량적 DCA 수치에 따라 기여자를 정렬합니다.
   - P-token은 일정 주기마다 정렬된 모든 기여자에게 등차적으로 발행됩니다(CAPM).
      ```math
      P_i = P_{min} + (i-1) \times d
      ```
      ```math
      d = \frac{2 \times (P_{median} - P_{min})}{N-1}
      ```
      ```math
      P_{total} = N \times P_{median}
      ```
      - `P_i`: i번째 순위 기여자가 받는 P-token (i=1: 최다 기여자, i=N: 최소 기여자)
      - `P_min`: 최소 기여자에게 보장되는 P-token
      - `P_median`: 중간값 P-token
      - `N`: 총 기여자 수
      - `d`: 등차수열의 공차
   - 예시: 총 기여자 수 1000명(=DAO 구성원), 최소 보장값 1p, 중간값 30p를 설정하여 P-token 발행을 가정합니다. (한달 주기)
      ```math
      N = 1000, \quad P_{min} = 1p, \quad P_{median} = 30p
      ```
      ```math
      d = \frac{2 \times (30 - 1)}{1000 - 1} = \frac{58}{999} ≈ 0.058p
      ```
      ```math
      P_1 = 1 + (1000-1) \times 0.058 = 1 + 58 = 59p
      ```
      ```math
      P_{1000} = 1 + (1-1) \times 0.058 = 1p
      ```
      ```math
      P_{total} = 1000 \times 30 = 30,000p
      ```
      <div align="center"><br>
     <table>
     <tr><th>기여자 순위</th><th>계산식</th><th>P-token 발행량</th></tr>
     <tr><td>1등 (최다 기여자)</td><td><code>1 + (1000-1) × 0.058</code></td><td><strong>59p</strong></td></tr>
     <tr><td>100등</td><td><code>1 + (900-1) × 0.058</code></td><td><strong>53.158p</strong></td></tr>
     <tr><td>250등</td><td><code>1 + (750-1) × 0.058</code></td><td><strong>44.442p</strong></td></tr>
     <tr><td>500등 (평균 기여자)</td><td><code>1 + (500-1) × 0.058</code></td><td><strong>30p</strong></td></tr>
     <tr><td>750등</td><td><code>1 + (250-1) × 0.058</code></td><td><strong>15.442p</strong></td></tr>
     <tr><td>900등</td><td><code>1 + (100-1) × 0.058</code></td><td><strong>6.742p</strong></td></tr>
     <tr><td>1000등 (최소 기여자)</td><td><code>1 + (1-1) × 0.058</code></td><td><strong>1p</strong></td></tr>
     </table>
     </div><br>
   - 참정권의 토큰화, P-token은 모든 기여자에게 발행되어 "공동체 기여자가 곧 공동체 의사결정 참여자"라는 합리적인 사회계약을 구현합니다.
   - CAPM 발행방식은 기여량에 따라 차등적으로 참정권을 분배하므로 "기여량이 상대적으로 높은 구성원이 더 많은 참정권을 얻는 구조"를 실현합니다.

### Governance

모든 DAO-consortium에서는 구성원간 합의과정인 '제안-투표-검토' 3단계를 거쳐 의사가 결정 및 반영됩니다.

1. 제안: 모든 구성원은 1P이상을 담보로 지불하여 안건을 제안할 수 있으며, DAO 내 전체 구성원의 1%만큼의 P-token(최소 1P)이 모이면 투표과정으로 진입합니다.
   - 2주 내로 투표진입 실패시 제안은 소각되고, 담보는 돌려받습니다.
   - OP 탄핵안의 경우 DAO 내 전체 구성원의 10%만큼의 P-token(최소 1P)이 모이면 투표과정으로 진입합니다.
2. 투표: 구성원은 0.1P를 대가로 찬성, 반대, 기권중 한가지를 선택할 수 있으며, 2주 내로 정족수가 진입시점의 DAO 내 1P이상 보유자 중 40%(OP 탄핵안의 경우 60%)를 달성되면 투표는 즉시 종료됩니다. 
   - 찬성표가 50%이상인 경우(OP 탄핵안의 경우 60%)에만 제안이 통과되며, 담보를 돌려받게 됩니다.
   - 그 외의 모든 경우에서는 안건과 담보가 모두 소각됩니다. (정족수 실패/기권 + 반대 50%이상)
3. 검토: 통과된 안건은 DAO 내 운영자(OP)에게 검토되며, OP검토에 통과된 안건은 프로토콜 운영DAO인 Ops-DAO(모든 DAO OP의 연합체)에 이송, 검토를 거쳐 최종 반영됩니다.
   - 각 DAO의 OP는 통과된 안건에 대한 거부권을 가지며, 거부시 적절한 이유와 함께 공표하거나 구성원에게 수정안을 제안해야 합니다.
   - Ops-DAO의 모든 구성원(모든 DAO의 OP들)은 Ops-DAO에 이송된 특정DAO의 안건에 대해 2일간의 이의신청 기간을 가지며, 거부/수정/의견 등의 이의가 있다면 이의신청을 남깁니다.
   - 이의신청 여부와 관계없이 기간이 종료되면 Ops-DAO의 OP(프로토콜상 최상위 OP)에 제출되며, 안건의 모든 내용 및 정보를 참고하여 거부하거나 최종 반영합니다.
   - 검토과정의 모든 내용은 해당 DAO 컨소시엄 내 공지탭에 공개됩니다.
4. OP-Governance 구조
   ![DAO diagram](https://github.com/user-attachments/assets/55084286-b8d2-4a7e-b476-98ee174a61b0)
   - 모든 구성원은 Political-DAO의 30P를 담보하여 목적, DCA, 검증기준과 함께 DAO설립을 제안할 수 있으며, 이는 Political-DAO에서 이루어집니다. 
   - 통과시 제안자는 Initial-OP가 되며, 자동으로 Ops-DAO에 소속됩니다. (DAO설립 제안의 검토는 Ops-DAO가 담당하며, 거부될 시 절반만 반환됩니다.)
   - OP의 권한은 거부/제안/반영 이며, OP검토시스템(OP에게만 접근권한이 있는 기능)에서 이루어집니다. OP의 DCA는 Ops-DAO에 명시되며, 누구나 볼 수 있습니다.
   - 탄핵안이 투표과정을 통과기준을 충족하여 통과되면, OP는 탄핵됨과 동시에 OP가 보유한 모든 P-token이 소각됩니다.
   - 모든 DAO의 구성원은 특정인(합리적 제안자 등)에게 P-token을 양도하여 지지를 표할 수 있으며, 기존 OP가 탄핵될 시 'P-token 최대 보유자'에게 OP제안서가 전달됩니다. 이를 거절할 시 다음 순위의 P-token 보유자에게 OP제안서가 전달되며, 이는 반복됩니다.
