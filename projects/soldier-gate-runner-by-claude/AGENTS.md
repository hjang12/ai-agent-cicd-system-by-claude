# Agent instructions


- 공통 Governance: `../../GOVERNANCE/GOVERNANCE.md`
- 시작 절차와 Task 선택은 Workspace root `AGENT_START.md` 및 `GOVERNANCE/docs/DEVELOPMENT_TASKS.md`를 따른다.
- 프로젝트의 `AGENT_START.md`, `docs/CURRENT_STATUS.md`, 관련 Checkpoint / Requirement Contract를 확인한 후 실제 코드와 CI 상태를 검증한다.
- 실제 Repository 상태가 채팅 설명 또는 오래된 문서와 다르면 실제 상태를 우선하고 문서 불일치를 수정한다.
- 핵심 domain/source와 계층 경계를 유지하고 최소 변경을 우선한다.
- 변경 후 프로젝트에 맞는 compile/build/test 및 필요한 regression 검증을 수행한다.
- 외부 Dependency의 필요성·라이선스·운영 영향과 Production 변경 위험을 검토한다.
- Governance / Requirement / 승인된 Architecture 방향과 충돌하거나 권한을 벗어나는 변경은 임의 실행하지 않고 근거와 영향을 보고한다.
- 중요한 결정, 반복 장애, 검증 결과는 관련 Context / History에 간결하게 기록한다.


## 프로젝트 고유 규칙

- 정적 사이트(HTML/CSS/JavaScript)로 구현하며 런타임 외부 라이브러리와 외부 리소스를 사용하지 않는다.
- 게임 로직은 렌더링과 분리해 순수 함수로 유지하고, 도로 경계·명중·병력 계산은 자동 테스트로 검증한다.
- 탄환은 유도 없이 직선으로만 이동한다(발사자의 좌우 위치 고정). 도로 정규화 좌표(왼쪽 경계 -1, 오른쪽 경계 +1)에서 이동하고 화면에 투영한다. 도로 밖으로 나가는 탄환을 잘라내는 방식으로 숨기지 않는다.
- 원작 게임의 이미지·코드를 복제하지 않고 독자적인 그래픽을 구현한다.
